import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.dashboard import get_overview, get_daily, get_weekly, get_monthly, get_trend, get_recon, get_drilldown
from app.schemas.schemas import ReconResultOut

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/overview")
def dashboard_overview(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    pair_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    sd = datetime.date.fromisoformat(start_date) if start_date else None
    ed = datetime.date.fromisoformat(end_date) if end_date else None
    return get_overview(db, sd, ed, pair_id)


@router.get("/dashboard/daily")
def dashboard_daily(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    sd = datetime.date.fromisoformat(start_date) if start_date else None
    ed = datetime.date.fromisoformat(end_date) if end_date else None
    return get_daily(db, sd, ed)


@router.get("/dashboard/weekly")
def dashboard_weekly(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    sd = datetime.date.fromisoformat(start_date) if start_date else None
    ed = datetime.date.fromisoformat(end_date) if end_date else None
    return get_weekly(db, sd, ed)


@router.get("/dashboard/monthly")
def dashboard_monthly(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    sd = datetime.date.fromisoformat(start_date) if start_date else None
    ed = datetime.date.fromisoformat(end_date) if end_date else None
    return get_monthly(db, sd, ed)


@router.get("/dashboard/trend")
def dashboard_trend(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    sd = datetime.date.fromisoformat(start_date) if start_date else None
    ed = datetime.date.fromisoformat(end_date) if end_date else None
    return get_trend(db, sd, ed)


@router.get("/dashboard/drilldown")
def dashboard_drilldown(
    trx_date: str = Query(...),
    exception_type: str | None = Query(None),
    q: str | None = Query(None),
    limit: int = Query(500),
    offset: int = Query(0),
    source_a: str | None = Query(None),
    source_b: str | None = Query(None),
    pair_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    td = datetime.date.fromisoformat(trx_date)
    return get_drilldown(db, td, exception_type, q, limit, offset, source_a, source_b, pair_id)


@router.get("/dashboard/recon", response_model=list[ReconResultOut])
def dashboard_recon(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    sd = datetime.date.fromisoformat(start_date) if start_date else None
    ed = datetime.date.fromisoformat(end_date) if end_date else None
    return get_recon(db, sd, ed)
