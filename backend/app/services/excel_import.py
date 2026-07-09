import base64
import datetime
import io
import logging
import os
import re
import uuid
from typing import Optional

import pandas as pd
from openai import OpenAI
from sqlalchemy.orm import Session

from app.models.models import (
    ImportBatch, SummaryRow, DailySummary, ReconResult, ExceptionDetail, Route,
    Provider, Aggregator, SwitchPlatform, Agent, Channel, Product
)

logger = logging.getLogger("excel_import")


def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required for image import.")
    return OpenAI(api_key=api_key)

SHEET_MAPPING = {
    "summary": {"trx_date_col": "trx_date", "route_id_col": "route_id"},
    "from_db": {},
    "from_dana": {},
    "harga_berbeda": {},
    "ada_di_dana_tidak_di_db": {},
    "ada_di_db_tidak_di_dana": {},
    "force_failed": {},
    "db_only_ext_check": {},
    "dana_only_ext_check": {},
}


def parse_number(value) -> float:
    if pd.isna(value) or value == "":
        return 0
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    text = text.replace("Rp", "").replace("rp", "").replace(" ", "")
    text = re.sub(r"[^0-9,.-]", "", text)
    if text.count(",") == 1 and text.count(".") > 0:
        text = text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(".", "").replace(",", ".")

    try:
        return float(text)
    except ValueError:
        return 0


def parse_optional_number(value) -> float | None:
    if pd.isna(value) or value == "":
        return None
    return parse_number(value)


def stringify_cell(value) -> str:
    if pd.isna(value) or value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def is_empty_value(value) -> bool:
    if isinstance(value, pd.Series):
        return all(is_empty_value(v) for v in value.tolist())
    return pd.isna(value) or value == ""


def get_row_value(row, *keys: str, default=None):
    for key in keys:
        value = row.get(key, None)
        if isinstance(value, pd.Series):
            for item in value.tolist():
                if not is_empty_value(item):
                    return item
            continue
        if value is not None and not is_empty_value(value):
            return value
    return default


def parse_date(value) -> datetime.date:
    if pd.isna(value) or value == "":
        return datetime.date.today()
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    if isinstance(value, pd.Timestamp):
        return value.date()

    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return datetime.date.today()


def ensure_default_route(db: Session) -> int:
    route = db.query(Route).first()
    if route:
        return route.id

    provider = db.query(Provider).filter(Provider.code == "DEFAULT").first()
    if not provider:
        provider = Provider(code="DEFAULT", name="Default Provider", active=True)
        db.add(provider)

    aggregator = db.query(Aggregator).filter(Aggregator.code == "DEFAULT").first()
    if not aggregator:
        aggregator = Aggregator(code="DEFAULT", name="Default Aggregator", active=True)
        db.add(aggregator)

    switch = db.query(SwitchPlatform).filter(SwitchPlatform.code == "DEFAULT").first()
    if not switch:
        switch = SwitchPlatform(code="DEFAULT", name="Default Switch", location="Default", active=True)
        db.add(switch)

    agent = db.query(Agent).filter(Agent.code == "DEFAULT").first()
    if not agent:
        agent = Agent(code="DEFAULT", name="Default Agent", active=True)
        db.add(agent)

    db.flush()

    channel = db.query(Channel).filter(Channel.code == "DEFAULT").first()
    if not channel:
        channel = Channel(agent_id=agent.id, code="DEFAULT", name="Default Channel", active=True)
        db.add(channel)

    product = db.query(Product).filter(Product.code == "DEFAULT").first()
    if not product:
        product = Product(
            provider_id=provider.id,
            category="PULSA",
            code="DEFAULT",
            name="Default Product",
            nominal=0,
            active=True,
        )
        db.add(product)

    db.flush()

    route = Route(
        provider_id=provider.id,
        aggregator_id=aggregator.id,
        switch_platform_id=switch.id,
        agent_id=agent.id,
        channel_id=channel.id,
        product_id=product.id,
        priority=1,
        active=True,
    )
    db.add(route)
    db.flush()
    return route.id


def extract_table_from_image(image_bytes: bytes, filename: str) -> pd.DataFrame:
    """Use OpenAI Vision to extract table data from an image."""
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    prompt = """You are a data extraction assistant. This image contains a table with reconciliation data for a pulse/telco transaction system.

Extract ALL rows from the table into a JSON array of objects. Use these column mappings where applicable:
- trx_date: transaction date (YYYY-MM-DD)
- total_transaction: total transactions
- success_transaction: successful transactions
- pending_transaction: pending transactions
- failed_transaction: failed transactions
- gross_amount: gross amount
- settlement_amount: settlement amount
- difference_amount: difference amount
- provider_code: provider code
- product_code: product code
- exception_type: type of exception
- reference_number: reference number
- amount: amount
- reason: reason/description
- recon_type: reconciliation type
- description: description
- system_value: system value
- external_value: external value
- difference: difference
- status: status

Return the data as a JSON array. Do not include any explanation, just the JSON array.
Example response: [{"trx_date": "2024-01-01", "total_transaction": 100, ...}]"""

    try:
        response = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{base64_image}", "detail": "high"},
                        },
                    ],
                }
            ],
            max_tokens=4096,
            temperature=0.1,
        )

        content = response.choices[0].message.content
        import json
        import re

        json_match = re.search(r"\[.*\]", content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            df = pd.DataFrame(data)
            return df
        else:
            logger.warning(f"No JSON array found in OpenAI response for {filename}")
            return pd.DataFrame()
    except Exception as e:
        logger.error(f"Error extracting table from image {filename}: {e}")
        raise ValueError(f"Failed to extract table from image: {str(e)}")


def detect_and_normalize_columns(df: pd.DataFrame, sheet_name: str) -> pd.DataFrame:
    """Normalize column names based on common patterns."""
    col_map = {}
    for col in df.columns:
        col_lower = str(col).lower().strip().replace(" ", "_").replace("-", "_")
        for target in [
            "trx_date", "transaction_date", "tanggal", "date",
            "total_transaction", "total_trx", "total",
            "success_transaction", "success_trx", "sukses", "success",
            "pending_transaction", "pending_trx", "pending",
            "failed_transaction", "failed_trx", "gagal", "failed",
            "gross_amount", "gross", "total_amount", "amount",
            "settlement_amount", "settlement", "settle",
            "difference_amount", "difference", "selisih", "diff",
            "route_id", "route",
            "reference_number", "ref_no", "reference",
            "product_code", "product", "produk",
            "exception_type", "exception",
            "reason", "keterangan", "description",
            "recon_type", "recon",
            "system_value", "system",
            "external_value", "external", "dana",
            "status",
            "category",
            "nominal",
            "provider_code", "provider",
            "aggregator_code", "aggregator",
            "switch_code", "switch",
            "agent_code", "agent",
            "channel_code", "channel",
        ]:
            if target in col_lower or col_lower == target:
                normalized = target.replace("transaction_date", "trx_date").replace("tanggal", "trx_date")
                col_map[col] = normalized
                break
    if col_map:
        df = df.rename(columns=col_map)
    return df


def normalize_label(value) -> str:
    if pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value).strip().upper())


def find_summary_report_columns(df: pd.DataFrame) -> tuple[int, int, int, int, int] | None:
    for row_idx in range(len(df)):
        labels = [normalize_label(v) for v in df.iloc[row_idx].tolist()]
        if "DESKRIPSI" not in labels or "BAS (DANABAS)" not in labels:
            continue

        desc_col = labels.index("DESKRIPSI")
        unit_col = labels.index("UNIT") if "UNIT" in labels else desc_col + 1
        bas_col = labels.index("BAS (DANABAS)")
        dana_col = labels.index("DANA (DASHBOARD DANA)") if "DANA (DASHBOARD DANA)" in labels else bas_col + 1
        diff_col = labels.index("CHKSUM (E-D)") if "CHKSUM (E-D)" in labels else dana_col + 1
        return desc_col, unit_col, bas_col, dana_col, diff_col
    return None


def extract_summary_report_date(df: pd.DataFrame) -> datetime.date:
    for value in df.to_numpy().flatten():
        if pd.isna(value):
            continue
        text = str(value)
        match = re.search(r"Tanggal\s+Transaksi\s*:\s*(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}|\d{2}-\d{2}-\d{4})", text, re.I)
        if match:
            return parse_date(match.group(1))
    return datetime.date.today()


def find_summary_metric(
    df: pd.DataFrame,
    desc_col: int,
    unit_col: int,
    value_col: int,
    label: str,
    unit: str | None = None,
) -> float:
    wanted_label = normalize_label(label)
    wanted_unit = normalize_label(unit) if unit else None

    for _, row in df.iterrows():
        description = normalize_label(row.iloc[desc_col])
        row_unit = normalize_label(row.iloc[unit_col])
        if description != wanted_label:
            continue
        if wanted_unit and row_unit != wanted_unit:
            continue
        return parse_number(row.iloc[value_col])
    return 0


def replace_summary_data_for_date(db: Session, trx_date: datetime.date):
    daily_summary_ids = [
        row.id for row in db.query(DailySummary.id).filter(DailySummary.trx_date == trx_date).all()
    ]
    if daily_summary_ids:
        db.query(ExceptionDetail).filter(ExceptionDetail.daily_summary_id.in_(daily_summary_ids)).delete(synchronize_session=False)
        db.query(ReconResult).filter(ReconResult.daily_summary_id.in_(daily_summary_ids)).delete(synchronize_session=False)
        db.query(DailySummary).filter(DailySummary.id.in_(daily_summary_ids)).delete(synchronize_session=False)

    db.query(SummaryRow).filter(SummaryRow.trx_date == trx_date).delete(synchronize_session=False)
    db.flush()


def store_report_summary_rows(
    raw_df: pd.DataFrame,
    db: Session,
    trx_date: datetime.date,
    desc_col: int,
    unit_col: int,
    bas_col: int,
    dana_col: int,
):
    row_order = 1
    for _, row in raw_df.iterrows():
        no = stringify_cell(row.iloc[0]) if len(row) > 0 else ""
        description = stringify_cell(row.iloc[desc_col]) if desc_col < len(row) else ""
        unit = stringify_cell(row.iloc[unit_col]) if unit_col < len(row) else ""
        bas_value = parse_optional_number(row.iloc[bas_col]) if bas_col < len(row) else None
        dana_value = parse_optional_number(row.iloc[dana_col]) if dana_col < len(row) else None

        if not any([no, description, unit, bas_value is not None, dana_value is not None]):
            continue
        if normalize_label(description) in {"DESKRIPSI", ""}:
            continue

        db.add(SummaryRow(
            trx_date=trx_date,
            row_order=row_order,
            no=no,
            description=description,
            unit=unit,
            bas_value=bas_value,
            dana_value=dana_value,
            is_section=bas_value is None and dana_value is None,
        ))
        row_order += 1


def process_report_summary_sheet(raw_df: pd.DataFrame, db: Session) -> list[DailySummary]:
    columns = find_summary_report_columns(raw_df)
    if not columns:
        return []

    desc_col, unit_col, bas_col, _dana_col, diff_col = columns
    trx_date = extract_summary_report_date(raw_df)
    replace_summary_data_for_date(db, trx_date)
    store_report_summary_rows(raw_df, db, trx_date, desc_col, unit_col, bas_col, _dana_col)
    route_id = ensure_default_route(db)

    summary = DailySummary(
        trx_date=trx_date,
        route_id=route_id,
        total_transaction=int(find_summary_metric(raw_df, desc_col, unit_col, bas_col, "TOTAL TRANSAKSI (ALL STATUS)", "#")),
        success_transaction=int(find_summary_metric(raw_df, desc_col, unit_col, bas_col, "STATUS: SUCCESS", "#")),
        pending_transaction=int(find_summary_metric(raw_df, desc_col, unit_col, bas_col, "STATUS: PENDING", "#")),
        failed_transaction=int(find_summary_metric(raw_df, desc_col, unit_col, bas_col, "STATUS: FAILED", "#")),
        gross_amount=find_summary_metric(raw_df, desc_col, unit_col, bas_col, "TOTAL TRANSAKSI (ALL STATUS)", "RP."),
        settlement_amount=find_summary_metric(raw_df, desc_col, unit_col, bas_col, "TOTAL SETTLEMENT", "RP."),
        difference_amount=find_summary_metric(raw_df, desc_col, unit_col, diff_col, "TOTAL SETTLEMENT", "RP."),
    )
    db.add(summary)
    return [summary]


def process_summary_sheet(df: pd.DataFrame, db: Session, route_id_lookup: dict) -> list[DailySummary]:
    summaries = []
    for _, row in df.iterrows():
        route_id = row.get("route_id", ensure_default_route(db))
        if pd.isna(route_id) or route_id == 0:
            route_id = ensure_default_route(db)

        trx_date = parse_date(row.get("trx_date"))

        summary = DailySummary(
            trx_date=trx_date,
            route_id=int(route_id),
            total_transaction=int(parse_number(row.get("total_transaction", 0))),
            success_transaction=int(parse_number(row.get("success_transaction", 0))),
            pending_transaction=int(parse_number(row.get("pending_transaction", 0))),
            failed_transaction=int(parse_number(row.get("failed_transaction", 0))),
            gross_amount=parse_number(row.get("gross_amount", 0)),
            settlement_amount=parse_number(row.get("settlement_amount", 0)),
            difference_amount=parse_number(row.get("difference_amount", 0)),
        )
        db.add(summary)
        summaries.append(summary)
    return summaries


def process_exception_sheet(df: pd.DataFrame, db: Session, sheet_name: str, daily_summaries: list[DailySummary]):
    exception_type_map = {
        "harga_berbeda": "PRICE_MISMATCH",
        "ada_di_dana_tidak_di_db": "ONLY_IN_DANA",
        "ada_di_db_tidak_di_dana": "ONLY_IN_DB",
        "force_failed": "FORCE_FAILED",
        "db_only_ext_check": "DB_ONLY_EXT_CHECK",
        "dana_only_ext_check": "DANA_ONLY_EXT_CHECK",
    }

    exception_type = exception_type_map.get(sheet_name, sheet_name.upper())

    for idx, row in df.iterrows():
        summary = daily_summaries[0] if daily_summaries else None
        exc = ExceptionDetail(
            daily_summary_id=summary.id if summary else 1,
            exception_type=exception_type,
            reference_number=str(get_row_value(row, "reference_number", "ref_no", default="") or ""),
            product_code=str(get_row_value(row, "product_code", "product", default="") or ""),
            amount=parse_number(get_row_value(row, "amount", "difference", default=0)),
            reason=str(get_row_value(row, "reason", "description", "keterangan", default="") or ""),
        )
        db.add(exc)


def process_recon_sheet(df: pd.DataFrame, db: Session, sheet_name: str, daily_summaries: list[DailySummary]):
    recon_types = {
        "from_db": "DB_TO_DANA",
        "from_dana": "DANA_TO_DB",
    }
    recon_type = recon_types.get(sheet_name, "RECON")

    for idx, row in df.iterrows():
        summary = daily_summaries[0] if daily_summaries else None
        recon = ReconResult(
            daily_summary_id=summary.id if summary else 1,
            recon_type=recon_type,
            description=str(get_row_value(row, "description", "reason", default="") or ""),
            system_value=parse_number(get_row_value(row, "system_value", "system", default=0)),
            external_value=parse_number(get_row_value(row, "external_value", "external", default=0)),
            difference=parse_number(get_row_value(row, "difference", "diff", "selisih", default=0)),
            status=str(get_row_value(row, "status", default="OPEN") or "OPEN"),
        )
        db.add(recon)


def process_excel_file(file_bytes: bytes, file_name: str, db: Session) -> ImportBatch:
    batch_no = f"BATCH-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    batch = ImportBatch(
        batch_no=batch_no,
        file_name=file_name,
        sheet_name="all",
        status="PROCESSING",
    )
    db.add(batch)
    db.flush()

    total_records = 0
    daily_summaries: list[DailySummary] = []

    try:
        xl = pd.ExcelFile(io.BytesIO(file_bytes))
        sheets = [s.lower() for s in xl.sheet_names]

        if "summary" in sheets:
            actual_name = [s for s in xl.sheet_names if s.lower() == "summary"][0]
            raw_df = pd.read_excel(xl, sheet_name=actual_name, header=None)
            daily_summaries = process_report_summary_sheet(raw_df, db)

            if not daily_summaries:
                df = pd.read_excel(xl, sheet_name=actual_name)
                df = detect_and_normalize_columns(df, "summary")
                daily_summaries = process_summary_sheet(df, db, {})

            total_records += len(daily_summaries)
            db.flush()

        exception_sheets = [
            "harga_berbeda", "ada_di_dana_tidak_di_db", "ada_di_db_tidak_di_dana",
            "force_failed", "db_only_ext_check", "dana_only_ext_check"
        ]
        for sheet_name in sheets:
            if sheet_name in exception_sheets:
                try:
                    actual_name = [s for s in xl.sheet_names if s.lower() == sheet_name][0]
                    df = pd.read_excel(xl, sheet_name=actual_name)
                    df = detect_and_normalize_columns(df, sheet_name)
                    process_exception_sheet(df, db, sheet_name, daily_summaries)
                    total_records += len(df)
                except Exception as e:
                    logger.warning(f"Error processing sheet {sheet_name}: {e}")

        recon_sheets = ["from_db", "from_dana"]
        for sheet_name in sheets:
            if sheet_name in recon_sheets:
                try:
                    actual_name = [s for s in xl.sheet_names if s.lower() == sheet_name][0]
                    df = pd.read_excel(xl, sheet_name=actual_name)
                    df = detect_and_normalize_columns(df, sheet_name)
                    process_recon_sheet(df, db, sheet_name, daily_summaries)
                    total_records += len(df)
                except Exception as e:
                    logger.warning(f"Error processing sheet {sheet_name}: {e}")

        batch.status = "SUCCESS"
        batch.records = total_records
        db.commit()

    except Exception as e:
        logger.error(f"Import failed for {file_name}: {e}")
        batch.status = "FAILED"
        db.commit()
        raise

    return batch


def process_image_file(file_bytes: bytes, file_name: str, db: Session) -> ImportBatch:
    """Process an image file by extracting table data via OpenAI Vision first,
    then processing the resulting DataFrame."""
    batch_no = f"BATCH-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    batch = ImportBatch(
        batch_no=batch_no,
        file_name=file_name,
        sheet_name="image_extract",
        status="PROCESSING",
    )
    db.add(batch)
    db.flush()

    try:
        df = extract_table_from_image(file_bytes, file_name)

        if df.empty:
            raise ValueError("No data could be extracted from the image.")

        df = detect_and_normalize_columns(df, "summary")
        daily_summaries = process_summary_sheet(df, db, {})
        total_records = len(daily_summaries)

        batch.status = "SUCCESS"
        batch.records = total_records
        db.commit()

    except Exception as e:
        logger.error(f"Image import failed for {file_name}: {e}")
        batch.status = "FAILED"
        db.commit()
        raise

    return batch
