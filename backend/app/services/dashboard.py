import datetime
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
            "columns": ["No.", "DESKRIPSI", "Unit", "BAS (DANABAS)", "DANA (DASHBOARD DANA)"],
            "rows": [
                {
                    "id": row.id,
                    "row_order": row.row_order,
                    "no": row.no,
                    "description": row.description,
                    "unit": row.unit,
                    "bas_value": row.bas_value,
                    "dana_value": row.dana_value,
                    "is_section": row.is_section,
                }
                for row in rows
            ],
        }

    return {
        "trx_date": None,
        "title": "REKONSILIASI BAS x DANA",
        "columns": ["No.", "DESKRIPSI", "Unit", "BAS (DANABAS)", "DANA (DASHBOARD DANA)"],
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
