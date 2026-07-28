import json
import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth import get_current_user

logger = logging.getLogger("forecast")

router = APIRouter(prefix="/api", tags=["forecast"])

BASE_AVG = {
    "S5":  [1430, 1400, 1350, 1420, 1380, 1300, 1150],
    "S10": [1100, 1050, 1000, 1080, 1020,  900,  450],
    "S15": [2550, 2480, 2400, 2500, 2450, 2000, 1100],
    "S20": [720,   700,  680,  690,  650,  580,  280],
    "S30": [430,   400,  380,  410,  370,  300,  130],
    "S75": [1750, 1700, 1680, 1720, 1500, 1450, 1150],
    "S100":[1250, 1200, 1150, 1200, 1100, 1000,  700],
    "S150":[850,   800,  780,  820,  750,  680,  480],
}

STOCK_DATA = [
    {"sku": "S5", "qty": 8200},
    {"sku": "S10", "qty": 11500},
    {"sku": "S15", "qty": 4800},
    {"sku": "S20", "qty": 10100},
    {"sku": "S30", "qty": 6300},
    {"sku": "S75", "qty": 1900},
    {"sku": "S100", "qty": 3200},
    {"sku": "S150", "qty": 1400},
]

WEEK_VAR = [50, -30, 60, -20, 40, -50, 30, -10]
DAY_KEYS = ["sen", "sel", "rab", "kam", "jum", "sab", "min"]


def _build_historical():
    rows = []
    for week in range(8):
        for sku, avgs in BASE_AVG.items():
            var = WEEK_VAR[week]
            row = {"minggu": week + 1, "sku": sku}
            for i, key in enumerate(DAY_KEYS):
                row[key] = avgs[i] + var
            rows.append(row)
    return rows


HISTORICAL_DATA = _build_historical()


def _fmt_stock_table(data):
    lines = ["| SKU | QTY |", "|-----|-----|"]
    for s in data:
        lines.append(f"| {s['sku']} | {s['qty']} |")
    return "\n".join(lines)


def _fmt_hist_table(data):
    lines = ["| Minggu | SKU | Sen | Sel | Rab | Kam | Jum | Sab | Min |", "|--------|-----|-----|-----|-----|-----|-----|-----|-----|"]
    for h in data:
        lines.append(f"| {h['minggu']} | {h['sku']} | {h['sen']} | {h['sel']} | {h['rab']} | {h['kam']} | {h['jum']} | {h['sab']} | {h['min']} |")
    return "\n".join(lines)


def _build_prompt(stock_table, hist_table, start_date, end_date):
    return f"""Anda adalah analis data yang menghitung proyeksi kebutuhan inventory.

## Input yang diterima:
1. Tabel Stok Saat Ini (SKU & QTY)
2. Tabel Historis Penjualan 8 Pekan Terakhir (SKU, Pekan, QTY per Hari: Sen, Sel, Rab, Kam, Jum, Sab, Min)
3. Start Date: {start_date}
4. End Date: {end_date}

## Tugas Anda:
Lakukan langkah-langkah berikut:

### 1. Hitung Rata-Rata Harian per SKU
Dari tabel historis, untuk setiap SKU, hitung rata-rata penjualan per hari (Senin–Minggu) selama 8 pekan. Simpan semua nilai dalam desimal, jangan dibulatkan.

### 2. Tentukan Deret Hari Proyeksi + Buffer
- Rentang Proyeksi: Semua tanggal dari {start_date} hingga {end_date} (inklusif).
- Buffer: 2 hari setelah End Date, yaitu 1 hari dan 2 hari setelah {end_date}.
- Total Hari yang Digunakan: (jumlah hari proyeksi) + 2 buffer.
- Untuk setiap tanggal di atas, tentukan hari dalam seminggu (Senin, Selasa, ..., Minggu).
- Gunakan referensi: 27 Juli 2026 adalah hari Senin.

### 3. Hitung Total Kebutuhan per SKU
Untuk setiap SKU, total kebutuhan = jumlah rata-rata harian yang sesuai dengan hari dari setiap tanggal yang digunakan.

### 4. Hitung New Qty per SKU
- Selisih = Total Kebutuhan – Stok Saat Ini
- Jika Selisih <= 0 -> New Qty = 0
- Jika Selisih > 0 -> New Qty = ceil(selisih) (bulatkan ke atas).

### 5. Output JSON
Kembalikan JSON valid dengan struktur persis seperti ini:
{{"days_used": ["28 Jul 2026 (Sel)", "29 Jul 2026 (Rab)", ...], "total_hari": 6, "forecast": [{{"sku": "S5", "stok": 8200, "total_kebutuhan": 8216.25, "selisih": 16.25, "new_qty": 17}}]}}

JANGAN tambahkan teks, markdown, atau penjelasan apapun di luar JSON. RESPON HANYA DENGAN JSON.

---
## Input 1: Tabel Stok
{stock_table}

## Input 2: Tabel Historis
{hist_table}

## Input 3: Start Date
{start_date}

## Input 4: End Date
{end_date}
---"""


class ForecastRequest(BaseModel):
    start_date: str
    end_date: str


@router.get("/stock")
def get_stock(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return {"data": STOCK_DATA}


@router.get("/historical")
def get_historical(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return {"data": HISTORICAL_DATA}


@router.post("/forecast")
async def get_forecast(
    req: ForecastRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="DEEPSEEK_API_KEY is not configured")

    logger.info(f"Forecast request: start_date={req.start_date}, end_date={req.end_date}")

    prompt = _build_prompt(
        _fmt_stock_table(STOCK_DATA),
        _fmt_hist_table(HISTORICAL_DATA),
        req.start_date,
        req.end_date,
    )
    logger.info(f"Prompt built ({len(prompt)} chars), sending to DeepSeek")

    async with httpx.AsyncClient() as client:
        ai_resp = await client.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-v4-flash",
                "messages": [
                    {"role": "system", "content": "You are a data analyst. Respond only with valid JSON, no markdown, no explanation."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0,
                "max_tokens": 16384,
            },
            timeout=120,
        )
        ai_resp.raise_for_status()
        result = ai_resp.json()

    usage = result.get("usage", {})
    logger.info(
        f"DeepSeek response: prompt_tokens={usage.get('prompt_tokens')}, "
        f"completion_tokens={usage.get('completion_tokens')}, "
        f"reasoning_tokens={usage.get('completion_tokens_details', {}).get('reasoning_tokens')}"
    )

    content = result["choices"][0]["message"]["content"].strip()
    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        parsed = json.loads(content)
        logger.info(f"Forecast returned with {len(parsed.get('forecast', []))} rows")
        return parsed
    except json.JSONDecodeError:
        logger.error(f"AI returned invalid JSON: {content[:200]}")
        raise HTTPException(status_code=500, detail=f"AI returned invalid JSON: {content[:500]}")
