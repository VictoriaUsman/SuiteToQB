import os
import uuid
import asyncio
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database import get_db
from models import User, Document, Transaction, Category
from utils.security import get_current_user
from services.ocr import extract_raw_text
from services.ai_extractor import extract_from_text, extract_from_image_file
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {"pdf", "xlsx", "xls", "csv", "png", "jpg", "jpeg", "tiff", "bmp"}


class DocumentOut(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    institution_name: str | None
    statement_period_start: str | None
    statement_period_end: str | None
    total_deposits: float | None
    total_withdrawals: float | None
    ending_balance: float | None
    ai_summary: str | None
    transaction_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


async def process_document(document_id: int):
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Document).where(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc:
            return

        try:
            doc.status = "processing"
            await db.commit()

            file_type = doc.file_type.lower()
            image_types = {"png", "jpg", "jpeg", "tiff", "bmp"}

            if file_type in image_types:
                extracted = await extract_from_image_file(doc.file_path)
            else:
                raw_text = extract_raw_text(doc.file_path, file_type)
                doc.extracted_text = raw_text[:50000]
                extracted = await extract_from_text(raw_text)

            meta = extracted.get("metadata", {})
            doc.institution_name = meta.get("institution_name")
            doc.statement_period_start = meta.get("statement_period_start")
            doc.statement_period_end = meta.get("statement_period_end")
            doc.total_deposits = meta.get("total_deposits")
            doc.total_withdrawals = meta.get("total_withdrawals")
            doc.ending_balance = meta.get("ending_balance")
            doc.ai_summary = meta.get("summary")
            doc.processed_at = datetime.utcnow()

            # Fetch existing category names
            cat_result = await db.execute(select(Category))
            categories = {c.name: c for c in cat_result.scalars().all()}

            for txn_data in extracted.get("transactions", []):
                cat_name = txn_data.get("ai_category", "other")
                if cat_name not in categories:
                    new_cat = Category(name=cat_name, is_system=True)
                    db.add(new_cat)
                    await db.flush()
                    categories[cat_name] = new_cat

                txn = Transaction(
                    document_id=doc.id,
                    category_id=categories.get(cat_name, {}).id if cat_name in categories else None,
                    date=txn_data.get("date", ""),
                    description=txn_data.get("description", ""),
                    amount=abs(float(txn_data.get("amount", 0))),
                    transaction_type=txn_data.get("transaction_type", "other"),
                    balance_after=txn_data.get("balance_after"),
                    reference_number=txn_data.get("reference_number"),
                    payee=txn_data.get("payee"),
                    ai_category=cat_name,
                    ai_confidence=txn_data.get("ai_confidence"),
                )
                db.add(txn)

            doc.status = "done"
            await db.commit()

        except Exception as e:
            doc.status = "error"
            doc.error_message = str(e)
            await db.commit()


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not supported")

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.max_upload_mb:
        raise HTTPException(status_code=413, detail=f"File too large (max {settings.max_upload_mb}MB)")

    upload_dir = Path(settings.upload_dir) / str(current_user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = upload_dir / unique_filename
    with open(file_path, "wb") as f:
        f.write(content)

    doc = Document(
        owner_id=current_user.id,
        filename=unique_filename,
        original_filename=file.filename,
        file_type=ext,
        file_size=len(content),
        file_path=str(file_path),
        status="pending",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    background_tasks.add_task(process_document, doc.id)
    return doc


@router.get("/", response_model=list[DocumentOut])
async def list_documents(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .where(Document.owner_id == current_user.id)
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Document).where(Document.id == doc_id, Document.owner_id == current_user.id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Document).where(Document.id == doc_id, Document.owner_id == current_user.id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    await db.delete(doc)
    await db.commit()
