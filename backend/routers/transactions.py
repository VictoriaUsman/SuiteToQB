from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from database import get_db
from models import User, Transaction, Document
from utils.security import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


class TransactionUpdate(BaseModel):
    category_id: int | None = None
    ai_category: str | None = None
    is_reviewed: bool | None = None
    payee: str | None = None
    memo: str | None = None


class TransactionOut(BaseModel):
    id: int
    document_id: int
    date: str
    description: str
    amount: float
    transaction_type: str
    balance_after: float | None
    reference_number: str | None
    payee: str | None
    ai_category: str | None
    ai_confidence: float | None
    is_reviewed: bool
    qb_synced: bool
    category_id: int | None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[TransactionOut])
async def list_transactions(
    document_id: int | None = None,
    transaction_type: str | None = None,
    ai_category: str | None = None,
    is_reviewed: bool | None = None,
    qb_synced: bool | None = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Transaction)
        .join(Document, Transaction.document_id == Document.id)
        .where(Document.owner_id == current_user.id)
    )
    if document_id:
        query = query.where(Transaction.document_id == document_id)
    if transaction_type:
        query = query.where(Transaction.transaction_type == transaction_type)
    if ai_category:
        query = query.where(Transaction.ai_category == ai_category)
    if is_reviewed is not None:
        query = query.where(Transaction.is_reviewed == is_reviewed)
    if qb_synced is not None:
        query = query.where(Transaction.qb_synced == qb_synced)

    query = query.order_by(Transaction.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/stats")
async def transaction_stats(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    base = select(Transaction).join(Document).where(Document.owner_id == current_user.id)

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar()

    type_result = await db.execute(
        select(Transaction.transaction_type, func.count(), func.sum(Transaction.amount))
        .join(Document)
        .where(Document.owner_id == current_user.id)
        .group_by(Transaction.transaction_type)
    )
    by_type = {row[0]: {"count": row[1], "total": row[2]} for row in type_result.all()}

    cat_result = await db.execute(
        select(Transaction.ai_category, func.count(), func.sum(Transaction.amount))
        .join(Document)
        .where(Document.owner_id == current_user.id)
        .group_by(Transaction.ai_category)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(10)
    )
    by_category = [{"category": row[0], "count": row[1], "total": row[2]} for row in cat_result.all()]

    unsynced_result = await db.execute(
        select(func.count())
        .select_from(Transaction)
        .join(Document)
        .where(Document.owner_id == current_user.id, Transaction.qb_synced == False)
    )
    unsynced = unsynced_result.scalar()

    return {"total": total, "by_type": by_type, "by_category": by_category, "unsynced_count": unsynced}


@router.patch("/{txn_id}", response_model=TransactionOut)
async def update_transaction(
    txn_id: int,
    payload: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction)
        .join(Document)
        .where(Transaction.id == txn_id, Document.owner_id == current_user.id)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(txn, field, value)
    await db.commit()
    await db.refresh(txn)
    return txn
