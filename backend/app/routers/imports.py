import datetime
import logging
import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.models import ImportBatch, SummaryRow, DailySummary, ReconResult, ExceptionDetail, FileReceipt, ReconPair
from app.schemas.schemas import ImportBatchOut, ExceptionDetailOut
from app.services.excel_import import process_excel_file, process_image_file
from app.services.file_monitoring import match_expected_file, process_source_file, record_recon_upload, detect_recon_pair_from_name

logger = logging.getLogger("import")

router = APIRouter(tags=["import"])

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".tiff"}
EXCEL_EXTENSIONS = {".xlsx", ".xls", ".xlsm"}
SOURCE_EXTENSIONS = {".csv", ".txt"}


def _parse_date_from_filename(filename: str) -> datetime.date | None:
    digits = re.findall(r"\d{8}", filename)
    for d in digits:
        for fmt in ("%d%m%Y", "%Y%m%d"):
            try:
                return datetime.datetime.strptime(d, fmt).date()
            except ValueError:
                pass
    return None


@router.post("/import/excel")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    file_bytes = await file.read()
    file_size = len(file_bytes)
    trx_date = _parse_date_from_filename(file.filename)
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""

    try:
        if ext in IMAGE_EXTENSIONS:
            batch = process_image_file(file_bytes, file.filename, db, file_size, trx_date)
        elif ext in EXCEL_EXTENSIONS:
            expected_file, _ = match_expected_file(db, file.filename)
            is_recon_file = file.filename.lower().startswith("recon_")
            if expected_file and not is_recon_file:
                batch = process_source_file(file.filename, db, file_bytes, file_size, trx_date)
            else:
                recon_pair_id: int | None = None
                if expected_file and expected_file.recon_pair_id:
                    recon_pair_id = expected_file.recon_pair_id
                else:
                    pair = detect_recon_pair_from_name(db, file.filename)
                    if pair:
                        recon_pair_id = pair.id
                batch = process_excel_file(file_bytes, file.filename, db, recon_pair_id, file_size, trx_date)
                record_recon_upload(db, batch, file.filename)
        elif ext in SOURCE_EXTENSIONS:
            batch = process_source_file(file.filename, db, file_bytes, file_size, trx_date)
        else:
            raise HTTPException(400, f"Unsupported file type: {ext}. Use Excel (.xlsx/.xls), CSV, text, or image files.")
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(500, str(e))

    return {
        "batch_no": batch.batch_no,
        "file_name": batch.file_name,
        "records": batch.records,
        "status": batch.status,
    }


@router.get("/import/history", response_model=list[ImportBatchOut])
def import_history(db: Session = Depends(get_db)):
    batches = (
        db.query(ImportBatch)
        .options(joinedload(ImportBatch.file_receipts).joinedload(FileReceipt.recon_pair))
        .order_by(ImportBatch.created_at.desc())
        .all()
    )
    result = []
    for batch in batches:
        pair_name = None
        if batch.file_receipts:
            for receipt in batch.file_receipts:
                if receipt.recon_pair:
                    pair_name = receipt.recon_pair.pair_name
                    break
        out = ImportBatchOut(
            id=batch.id,
            batch_no=batch.batch_no,
            upload_date=batch.upload_date,
            trx_date=batch.trx_date,
            file_name=batch.file_name,
            file_size=batch.file_size,
            sheet_name=batch.sheet_name,
            records=batch.records,
            status=batch.status,
            created_at=batch.created_at,
            pair_name=pair_name,
            source_settlement_total=batch.source_settlement_total,
        )
        result.append(out)
    return result


@router.get("/import/{import_id}", response_model=ImportBatchOut)
def import_detail(import_id: int, db: Session = Depends(get_db)):
    batch = db.query(ImportBatch).filter(ImportBatch.id == import_id).first()
    if not batch:
        raise HTTPException(404, "Import batch not found")
    return batch


@router.delete("/import/{import_id}")
def delete_import(import_id: int, db: Session = Depends(get_db)):
    batch = db.query(ImportBatch).filter(ImportBatch.id == import_id).first()
    if not batch:
        raise HTTPException(404, "Import batch not found")

    trx_date = batch.trx_date
    recon_pair_id = None
    if batch.file_receipts:
        for receipt in batch.file_receipts:
            if receipt.recon_pair_id:
                recon_pair_id = receipt.recon_pair_id
                break

    daily_summary_ids = [
        row.id for row in db.query(DailySummary.id).filter(DailySummary.trx_date == trx_date).all()
    ] if trx_date else []
    if daily_summary_ids:
        db.query(ExceptionDetail).filter(ExceptionDetail.daily_summary_id.in_(daily_summary_ids)).delete(synchronize_session=False)
        db.query(ReconResult).filter(ReconResult.daily_summary_id.in_(daily_summary_ids)).delete(synchronize_session=False)
        db.query(DailySummary).filter(DailySummary.id.in_(daily_summary_ids)).delete(synchronize_session=False)

    if trx_date:
        q = db.query(SummaryRow).filter(SummaryRow.trx_date == trx_date)
        if recon_pair_id is not None:
            q = q.filter(SummaryRow.recon_pair_id == recon_pair_id)
        q.delete(synchronize_session=False)

    db.query(FileReceipt).filter(FileReceipt.import_batch_id == import_id).delete(synchronize_session=False)
    db.delete(batch)
    db.commit()
    return {"ok": True}


@router.get("/exceptions", response_model=list[ExceptionDetailOut])
def get_exceptions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(ExceptionDetail).offset(skip).limit(limit).all()


@router.get("/exceptions/{exception_id}", response_model=ExceptionDetailOut)
def get_exception_detail(exception_id: int, db: Session = Depends(get_db)):
    exc = db.query(ExceptionDetail).filter(ExceptionDetail.id == exception_id).first()
    if not exc:
        raise HTTPException(404, "Exception not found")
    return exc
