import datetime
import re
import uuid
from collections import defaultdict

from sqlalchemy.orm import Session, joinedload

from app.models.models import ExpectedFile, FileReceipt, ImportBatch, ReconPair


INITIAL_RECON_PAIRS = [
    ("PTR-BMD-DANA", "BMD ↔ DANA", "Partner", "pulsa", "BMD", "DANA", True, "RECEIVABLE"),
    ("PTR-BAS-DANA", "BAS ↔ DANA", "Partner", "pulsa", "BAS", "DANA", True, "RECEIVABLE"),
    ("PTR-BMD-GPICBL", "BMD ↔ GPI/CBL", "Partner", "pulsa", "BMD", "GPI/CBL", False, "RECEIVABLE"),
    ("PTR-BMD-GAS", "BMD ↔ GAS", "Partner", "pulsa", "BMD", "GAS", False, "RECEIVABLE"),
    ("PTR-BHT-IDS", "BHT ↔ IDS", "Partner", "pulsa", "BHT", "IDS", False, "RECEIVABLE"),
    ("PTR-BHT-MCD", "BHT ↔ MCD", "Partner", "pulsa", "BHT", "MCD", False, "RECEIVABLE"),
    ("PTR-BMD-JATIS", "BMD ↔ JATIS", "Partner", "pulsa", "BMD", "JATIS", False, "RECEIVABLE"),
    ("PTR-NCB-GPICBL", "NCB ↔ GPI/CBL", "Partner", "pln", "NCB", "GPI/CBL", False, "RECEIVABLE"),
    ("PTR-NCB-TOKPED", "NCB ↔ TOKPED", "Partner", "pln", "NCB", "TOKPED", False, "RECEIVABLE"),
    ("INT-NTSNCB-BAS", "NTS+NCB ↔ BAS", "Internal", "pulsa", "NTS+NCB", "BAS", True, "RECEIVABLE"),
    ("INT-NTSNCB-BMDDANA", "NTS+NCB ↔ BMD-DANA", "Internal", "pulsa", "NTS+NCB", "BMD-DANA", True, "RECEIVABLE"),
    ("INT-NTSNCB-BMD", "NTS+NCB ↔ BMD", "Internal", "pulsa", "NTS+NCB", "BMD", True, "RECEIVABLE"),
    ("VDR-BHT-TSEL", "BHT ↔ TSEL", "Vendor", "pulsa", "BHT", "TSEL", True, "PAYABLE"),
    ("VDR-NTS-AWD", "NTS ↔ AWD", "Vendor", "pulsa", "NTS", "AWD", False, "PAYABLE"),
    ("VDR-NCB-PCU", "NCB ↔ PCU", "Vendor", "pulsa", "NCB", "PCU", False, "PAYABLE"),
]

INITIAL_EXPECTED_FILES = [
    ("PTR-BAS-DANA", "INTERNAL_RECON_FILE", "BAS", "bas_dana_DDMMYYYY.xlsx", True, True),
    ("PTR-BAS-DANA", "EXTERNAL_PARTNER_FILE", "DANA", "MERCHANT_SETTLEMENT_{MID}_{YYYYMMDD}.csv", True, True),
    ("PTR-BMD-DANA", "INTERNAL_RECON_FILE", "BMD", "bmd_dana_DDMMYYYY.xlsx", True, True),
    ("PTR-BMD-DANA", "EXTERNAL_PARTNER_FILE", "DANA", "MERCHANT_SETTLEMENT_{MID}_{YYYYMMDD}.csv", True, True),
    ("VDR-BHT-TSEL", "INTERNAL_RECON_FILE", "BHT", "bht_tsel_DDMMYYYY.xlsx", True, True),
    ("VDR-BHT-TSEL", "VENDOR_SETTLEMENT_FILE", "TSEL", "TSEL_DDMMYYYY.xlsx", True, True),
    ("VDR-NTS-AWD", "INTERNAL_RECON_FILE", "NTS", "nts_awd_DDMMYYYY.xlsx", True, True),
    ("VDR-NTS-AWD", "VENDOR_SETTLEMENT_FILE", "AWD", "AWD_DDMMYYYY.xlsx", True, True),
]

MONTHS = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "MEI": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "AGS": 8,
    "SEP": 9,
    "OCT": 10,
    "OKT": 10,
    "NOV": 11,
    "DEC": 12,
    "DES": 12,
}


def seed_recon_configuration(db: Session):
    if db.query(ReconPair).count() == 0:
        for pair_code, pair_name, category, product, source_a, source_b, active, direction in INITIAL_RECON_PAIRS:
            db.add(ReconPair(
                pair_code=pair_code,
                pair_name=pair_name,
                category=category,
                product=product,
                source_a=source_a,
                source_b=source_b,
                active=active,
                settlement_direction=direction,
            ))
        db.flush()

    if db.query(ExpectedFile).count() == 0:
        pairs = {pair.pair_code: pair for pair in db.query(ReconPair).all()}
        for pair_code, file_type, source, pattern, required, active in INITIAL_EXPECTED_FILES:
            pair = pairs.get(pair_code)
            if not pair:
                continue
            db.add(ExpectedFile(
                recon_pair_id=pair.id,
                file_type=file_type,
                source=source,
                expected_filename_pattern=pattern,
                required=required,
                active=active,
            ))
    db.commit()


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _pattern_to_regex(pattern: str) -> re.Pattern:
    escaped = re.escape(pattern)
    replacements = {
        r"\{DDMMYYYY\}": r"(?P<ddmmyyyy>\d{8})",
        r"\{YYYYMMDD\}": r"(?P<yyyymmdd>\d{8})",
        r"\{DD_MON_YYYY\}": r"(?P<ddmonyyyy>\d{2}_[A-Za-z]{3}_\d{4})",
        r"DDMMYYYY": r"(?P<ddmmyyyy>\d{8})",
        r"YYYYMMDD": r"(?P<yyyymmdd>\d{8})",
        r"DD_MON_YYYY": r"(?P<ddmonyyyy>\d{2}_[A-Za-z]{3}_\d{4})",
        r"\{MID\}": r"(?P<mid>[A-Za-z0-9_-]+)",
        r"\*": r".*",
    }
    for token, replacement in replacements.items():
        escaped = escaped.replace(token, replacement)
    return re.compile(f"^{escaped}$", re.IGNORECASE)


def _date_from_match(match: re.Match) -> datetime.date:
    groups = match.groupdict()
    today = datetime.date.today()
    if groups.get("ddmmyyyy"):
        try:
            return datetime.datetime.strptime(groups["ddmmyyyy"], "%d%m%Y").date()
        except ValueError:
            return today
    if groups.get("yyyymmdd"):
        try:
            return datetime.datetime.strptime(groups["yyyymmdd"], "%Y%m%d").date()
        except ValueError:
            return today
    if groups.get("ddmonyyyy"):
        day, mon, year = groups["ddmonyyyy"].split("_")
        month = MONTHS.get(mon.upper())
        if month:
            try:
                return datetime.date(int(year), month, int(day))
            except ValueError:
                return today
    return today


def match_expected_file(db: Session, file_name: str) -> tuple[ExpectedFile | None, datetime.date]:
    for expected in (
        db.query(ExpectedFile)
        .options(joinedload(ExpectedFile.recon_pair))
        .join(ReconPair)
        .filter(ExpectedFile.active.is_(True), ReconPair.active.is_(True))
        .all()
    ):
        match = _pattern_to_regex(expected.expected_filename_pattern).match(file_name)
        if match:
            return expected, _date_from_match(match)
    return None, datetime.date.today()


def detect_recon_pair_from_name(db: Session, file_name: str) -> ReconPair | None:
    normalized = _normalize(file_name.replace("recon", ""))
    is_recon_file = file_name.lower().startswith("recon_")
    pairs = list(db.query(ReconPair).filter(ReconPair.active.is_(True)).all())

    for pair in pairs:
        candidates = {
            _normalize(pair.pair_code),
            _normalize(pair.pair_name),
            _normalize(f"{pair.source_a}{pair.source_b}"),
            _normalize(f"{pair.source_b}{pair.source_a}"),
        }
        if any(candidate and candidate in normalized for candidate in candidates):
            return pair

    if is_recon_file:
        for pair in pairs:
            sb = _normalize(pair.source_b)
            if sb and sb in normalized and len(pair.source_b) >= 3:
                return pair

    return None


def create_file_receipt(
    db: Session,
    file_name: str,
    file_kind: str,
    import_batch: ImportBatch | None = None,
    expected_file: ExpectedFile | None = None,
    recon_pair: ReconPair | None = None,
    file_date: datetime.date | None = None,
    status: str = "RECEIVED",
) -> FileReceipt:
    receipt = FileReceipt(
        expected_file_id=expected_file.id if expected_file else None,
        recon_pair_id=(expected_file.recon_pair_id if expected_file else recon_pair.id if recon_pair else None),
        import_batch_id=import_batch.id if import_batch else None,
        file_name=file_name,
        file_kind=file_kind,
        source=expected_file.source if expected_file else None,
        file_date=file_date or datetime.date.today(),
        status=status,
        matched_pattern=expected_file.expected_filename_pattern if expected_file else None,
    )
    db.add(receipt)
    db.flush()
    return receipt


def process_source_file(file_name: str, db: Session, file_bytes: bytes | None = None, file_size: int | None = None, trx_date: datetime.date | None = None) -> ImportBatch:
    expected_file, file_date = match_expected_file(db, file_name)
    if not expected_file:
        raise ValueError(f"No active Expected File matches filename: {file_name}")

    batch_no = f"BATCH-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    batch = ImportBatch(
        batch_no=batch_no,
        upload_date=file_date,
        trx_date=trx_date or file_date,
        file_name=file_name,
        file_size=file_size,
        sheet_name="source_file",
        records=1,
        status="SUCCESS",
    )
    db.add(batch)
    db.flush()

    if file_bytes and file_name.lower().endswith(".csv"):
        import io
        import pandas as pd
        df = pd.read_csv(io.BytesIO(file_bytes))
        settle_col = None
        divisor = 1
        if "settle_amount_idr" in df.columns:
            settle_col = "settle_amount_idr"
        elif "SETTLE_AMOUNT" in df.columns:
            settle_col = "SETTLE_AMOUNT"
            divisor = 100
        if settle_col:
            total = int(df[settle_col].sum() / divisor)
            batch.source_settlement_total = total
            batch.records = len(df)

    create_file_receipt(db, file_name, "SOURCE", batch, expected_file, file_date=file_date)
    db.commit()
    db.refresh(batch)
    return batch


def record_recon_upload(db: Session, batch: ImportBatch, file_name: str):
    expected_file, file_date = match_expected_file(db, file_name)
    if expected_file:
        create_file_receipt(db, file_name, "RECON", batch, expected_file, file_date=file_date)
        db.commit()
        return

    pair = detect_recon_pair_from_name(db, file_name)
    if pair:
        file_date = batch.trx_date or batch.upload_date
        for ef in pair.expected_files:
            if ef.active and ef.required:
                create_file_receipt(db, file_name, "RECON", batch, expected_file=ef, file_date=file_date)
        db.commit()


def get_file_monitoring(
    db: Session,
    category: str | None = None,
    pair_id: int | None = None,
    status: str | None = None,
    file_date: datetime.date | None = None,
):
    pairs_q = db.query(ReconPair).options(joinedload(ReconPair.expected_files)).filter(ReconPair.active.is_(True))
    if category:
        pairs_q = pairs_q.filter(ReconPair.category == category)
    if pair_id:
        pairs_q = pairs_q.filter(ReconPair.id == pair_id)

    pairs = pairs_q.order_by(ReconPair.category, ReconPair.pair_name).all()
    receipts_q = db.query(FileReceipt).filter(FileReceipt.status == "RECEIVED")
    if file_date:
        receipts_q = receipts_q.filter(FileReceipt.file_date == file_date)
    receipts = receipts_q.order_by(FileReceipt.created_at.desc()).all()

    latest_by_expected: dict[int, FileReceipt] = {}
    for receipt in receipts:
        if receipt.expected_file_id and receipt.expected_file_id not in latest_by_expected:
            latest_by_expected[receipt.expected_file_id] = receipt

    groups: dict[str, list[dict]] = defaultdict(list)
    totals = {
        "total_expected_files": 0,
        "total_received": 0,
        "total_missing": 0,
        "total_failed": 0,
        "total_pairs": 0,
        "ready_pairs": 0,
    }

    for pair in pairs:
        expected_files = [item for item in pair.expected_files if item.active]
        files = []
        received_count = 0
        required_count = 0
        missing_count = 0
        for expected in sorted(expected_files, key=lambda item: (item.file_type, item.source)):
            receipt = latest_by_expected.get(expected.id)
            is_received = receipt is not None
            if expected.required:
                required_count += 1
                if is_received:
                    received_count += 1
                else:
                    missing_count += 1
            files.append({
                "id": expected.id,
                "file_type": expected.file_type,
                "source": expected.source,
                "expected_filename_pattern": expected.expected_filename_pattern,
                "required": expected.required,
                "active": expected.active,
                "status": "RECEIVED" if is_received else "MISSING",
                "received_file_name": receipt.file_name if receipt else None,
                "received_at": receipt.created_at if receipt else None,
            })

        progress = (received_count / required_count * 100) if required_count else 0
        pair_status = "COMPLETED" if required_count and missing_count == 0 else "MISSING" if received_count == 0 else "PARTIAL"
        pair_payload = {
            "pair_id": pair.id,
            "pair_code": pair.pair_code,
            "pair_name": pair.pair_name,
            "category": pair.category,
            "product": pair.product,
            "source_a": pair.source_a,
            "source_b": pair.source_b,
            "status": pair_status,
            "progress": round(progress, 2),
            "expected_count": required_count,
            "received_count": received_count,
            "missing_count": missing_count,
            "files": files,
        }
        if status and pair_status != status:
            continue

        groups[pair.category].append(pair_payload)
        totals["total_pairs"] += 1
        totals["total_expected_files"] += required_count
        totals["total_received"] += received_count
        totals["total_missing"] += missing_count
        if pair_status == "COMPLETED":
            totals["ready_pairs"] += 1

    response_groups = []
    for group_category, group_pairs in groups.items():
        response_groups.append({
            "category": group_category,
            "active_pairs": len(group_pairs),
            "ready_pairs": sum(1 for pair in group_pairs if pair["status"] == "COMPLETED"),
            "pairs": group_pairs,
        })

    totals["pair_readiness"] = round((totals["ready_pairs"] / totals["total_pairs"] * 100) if totals["total_pairs"] else 0, 2)
    return {"summary": totals, "groups": response_groups}
