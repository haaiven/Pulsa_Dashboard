import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import ImportBatch, ExceptionDetail
from app.schemas.schemas import ImportBatchOut, ExceptionDetailOut
from app.services.excel_import import process_excel_file, process_image_file
from app.services.file_monitoring import match_expected_file, process_source_file, record_recon_upload

logger = logging.getLogger("import")

router = APIRouter(tags=["import"])

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".tiff"}
EXCEL_EXTENSIONS = {".xlsx", ".xls", ".xlsm"}
SOURCE_EXTENSIONS = {".csv", ".txt"}


@router.post("/import/excel")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    file_bytes = await file.read()
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""

    try:
        if ext in IMAGE_EXTENSIONS:
            batch = process_image_file(file_bytes, file.filename, db)
        elif ext in EXCEL_EXTENSIONS:
            expected_file, _ = match_expected_file(db, file.filename)
            is_recon_file = file.filename.lower().startswith("recon_")
            if expected_file and not is_recon_file:
                batch = process_source_file(file.filename, db)
            else:
                batch = process_excel_file(file_bytes, file.filename, db)
                record_recon_upload(db, batch, file.filename)
        elif ext in SOURCE_EXTENSIONS:
            batch = process_source_file(file.filename, db)
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
    return db.query(ImportBatch).order_by(ImportBatch.created_at.desc()).all()


@router.get("/import/{import_id}", response_model=ImportBatchOut)
def import_detail(import_id: int, db: Session = Depends(get_db)):
    batch = db.query(ImportBatch).filter(ImportBatch.id == import_id).first()
    if not batch:
        raise HTTPException(404, "Import batch not found")
    return batch


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
