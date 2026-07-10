import datetime
import json
from sqlalchemy import func, extract
from sqlalchemy.orm import Session
from app.models.models import DailySummary, ReconResult, ExceptionDetail, SummaryRow


def get_overview(db: Session, start_date=None, end_date=None, provider_id=None, aggregator_id=None,
                 switch_id=None, agent_id=None, channel_id=None, product_id=None):
    date_q = db.query(SummaryRow.trx_date)
    if start_date:
        date_q = date_q.filter(SummaryRow.trx_date >= start_date)
    if end_date:
        date_q = date_q.filter(SummaryRow.trx_date <= end_date)

    latest_date = date_q.order_by(SummaryRow.trx_date.desc()).limit(1).scalar()
    if latest_date:
        rows = (
            db.query(SummaryRow)
            .filter(SummaryRow.trx_date == latest_date)
            .order_by(SummaryRow.row_order)
            .all()
        )
        return {
            "trx_date": latest_date,
            "title": "REKONSILIASI BAS x DANA",
            "columns": ["No.", "DESKRIPSI", "Unit", "BAS (DANABAS)", "DANA (DASHBOARD DANA)", "CHKSUM (E-D)"],
            "rows": [
                {
                    "id": row.id,
                    "row_order": row.row_order,
                    "no": row.no,
                    "description": row.description,
                    "unit": row.unit,
                    "bas_value": row.bas_value,
                    "dana_value": row.dana_value,
                    "chksum_value": row.chksum_value,
                    "is_section": row.is_section,
                }
                for row in rows
            ],
        }

    return {
        "trx_date": None,
        "title": "REKONSILIASI BAS x DANA",
        "columns": ["No.", "DESKRIPSI", "Unit", "BAS (DANABAS)", "DANA (DASHBOARD DANA)", "CHKSUM (E-D)"],
        "rows": [],
    }


def get_daily(db: Session, start_date=None, end_date=None):
    q = db.query(
        DailySummary.trx_date,
        func.sum(DailySummary.total_transaction).label("total_transaction"),
        func.sum(DailySummary.success_transaction).label("success_transaction"),
        func.sum(DailySummary.pending_transaction).label("pending_transaction"),
        func.sum(DailySummary.failed_transaction).label("failed_transaction"),
        func.sum(DailySummary.gross_amount).label("gross_amount"),
        func.sum(DailySummary.settlement_amount).label("settlement_amount"),
        func.sum(DailySummary.difference_amount).label("difference_amount"),
    ).group_by(DailySummary.trx_date)

    if start_date:
        q = q.filter(DailySummary.trx_date >= start_date)
    if end_date:
        q = q.filter(DailySummary.trx_date <= end_date)
    q = q.order_by(DailySummary.trx_date)

    return [dict(r._mapping) for r in q.all()]


def get_weekly(db: Session, start_date=None, end_date=None):
    q = db.query(
        func.strftime("%Y-%W", DailySummary.trx_date).label("week"),
        func.sum(DailySummary.total_transaction).label("total_transaction"),
        func.sum(DailySummary.success_transaction).label("success_transaction"),
        func.sum(DailySummary.pending_transaction).label("pending_transaction"),
        func.sum(DailySummary.failed_transaction).label("failed_transaction"),
        func.sum(DailySummary.gross_amount).label("gross_amount"),
        func.sum(DailySummary.settlement_amount).label("settlement_amount"),
        func.sum(DailySummary.difference_amount).label("difference_amount"),
    ).group_by("week")

    if start_date:
        q = q.filter(DailySummary.trx_date >= start_date)
    if end_date:
        q = q.filter(DailySummary.trx_date <= end_date)
    q = q.order_by("week")

    return [dict(r._mapping) for r in q.all()]


def get_monthly(db: Session, start_date=None, end_date=None):
    q = db.query(
        func.strftime("%Y-%m", DailySummary.trx_date).label("month"),
        func.sum(DailySummary.total_transaction).label("total_transaction"),
        func.sum(DailySummary.success_transaction).label("success_transaction"),
        func.sum(DailySummary.pending_transaction).label("pending_transaction"),
        func.sum(DailySummary.failed_transaction).label("failed_transaction"),
        func.sum(DailySummary.gross_amount).label("gross_amount"),
        func.sum(DailySummary.settlement_amount).label("settlement_amount"),
        func.sum(DailySummary.difference_amount).label("difference_amount"),
    ).group_by("month")

    if start_date:
        q = q.filter(DailySummary.trx_date >= start_date)
    if end_date:
        q = q.filter(DailySummary.trx_date <= end_date)
    q = q.order_by("month")

    return [dict(r._mapping) for r in q.all()]


def get_trend(db: Session, start_date=None, end_date=None):
    daily = get_daily(db, start_date, end_date)
    return [
        {
            "label": str(d["trx_date"]),
            "total": d["total_transaction"],
            "success": d["success_transaction"],
            "pending": d["pending_transaction"],
            "failed": d["failed_transaction"],
        }
        for d in daily
    ]


def get_recon(db: Session, start_date=None, end_date=None):
    q = db.query(ReconResult)
    if start_date:
        q = q.join(DailySummary).filter(DailySummary.trx_date >= start_date)
    if end_date:
        q = q.join(DailySummary).filter(DailySummary.trx_date <= end_date)
    return q.all()


def get_drilldown(
    db: Session,
    trx_date: datetime.date,
    exception_type: str | None = None,
    q: str | None = None,
    limit: int = 500,
    offset: int = 0,
):
    ds_ids = [
        row.id for row in db.query(DailySummary.id).filter(DailySummary.trx_date == trx_date).all()
    ]
    if not ds_ids:
        return {"trx_date": trx_date, "exceptions": [], "total": 0, "limit": limit, "offset": offset}

    query = db.query(ExceptionDetail).filter(ExceptionDetail.daily_summary_id.in_(ds_ids))
    if exception_type:
        query = query.filter(ExceptionDetail.exception_type == exception_type)
    if q:
        like = f"%{q}%"
        query = query.filter(
            ExceptionDetail.reference_number.ilike(like)
            | ExceptionDetail.product_code.ilike(like)
            | ExceptionDetail.raw_data.ilike(like)
        )

    total = query.count()
    exceptions = (
        query.order_by(ExceptionDetail.exception_type, ExceptionDetail.reference_number)
        .offset(offset)
        .limit(limit)
        .all()
    )

    columns = _extract_raw_columns(exceptions)

    return {
        "trx_date": trx_date,
        "columns": columns,
        "exceptions": [
            {
                "id": e.id,
                "exception_type": e.exception_type,
                "reference_number": e.reference_number,
                "product_code": e.product_code,
                "amount": e.amount,
                "reason": e.reason,
                    "created_at": e.created_at,
                "raw_data": json.loads(e.raw_data) if e.raw_data else None,
                "bas_value": _extract_bas(e, json.loads(e.raw_data)) if e.raw_data else 0,
                "dana_value": _extract_dana(e, json.loads(e.raw_data)) if e.raw_data else 0,
                "diff_value": _extract_diff(e, json.loads(e.raw_data)) if e.raw_data else 0,
            }
            for e in exceptions
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def _parse_float(v: object) -> float:
    if v is None:
        return 0.0
    try:
        return float(str(v).replace(",", ""))
    except (ValueError, TypeError):
        return 0.0


def _extract_bas(exc: ExceptionDetail, raw: dict) -> float:
    t = exc.exception_type
    if t in ("ONLY_IN_DANA", "DANA_ONLY_EXT_CHECK", "FORCE_FAILED"):
        return 0.0
    for key in ("price", "hpp_partner", "bas"):
        val = raw.get(key)
        if val:
            return _parse_float(val)
    return 0.0


def _extract_dana(exc: ExceptionDetail, raw: dict) -> float:
    t = exc.exception_type
    if t in ("ONLY_IN_DB", "DB_ONLY_EXT_CHECK", "FORCE_FAILED"):
        return 0.0
    selisih = _parse_float(raw.get("selisih"))
    bas = _extract_bas(exc, raw)
    if bas != 0:
        return bas + selisih
    for key in ("settle", "amount", "dana"):
        val = raw.get(key)
        if val:
            return _parse_float(val)
    return 0.0


def _extract_diff(exc: ExceptionDetail, raw: dict) -> float:
    for key in ("selisih", "difference", "diff"):
        val = raw.get(key)
        if val:
            return _parse_float(val)
    bas = _extract_bas(exc, raw)
    dana = _extract_dana(exc, raw)
    return dana - bas


def _extract_raw_columns(exceptions: list) -> list[str]:
    seen: set[str] = set()
    for e in exceptions:
        if e.raw_data:
            try:
                d = json.loads(e.raw_data)
                seen.update(d.keys())
            except (json.JSONDecodeError, TypeError):
                pass
    return sorted(seen)
