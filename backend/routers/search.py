from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from database import get_db
from models import User, Transaction, Document
from utils.security import get_current_user
from services.ai_extractor import answer_financial_question

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/transactions")
async def search_transactions(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pattern = f"%{q}%"
    result = await db.execute(
        select(Transaction)
        .join(Document)
        .where(
            Document.owner_id == current_user.id,
            or_(
                Transaction.description.ilike(pattern),
                Transaction.payee.ilike(pattern),
                Transaction.ai_category.ilike(pattern),
                Transaction.reference_number.ilike(pattern),
                Transaction.memo.ilike(pattern),
            ),
        )
        .order_by(Transaction.date.desc())
        .limit(50)
    )
    transactions = result.scalars().all()
    return [
        {
            "id": t.id,
            "date": t.date,
            "description": t.description,
            "payee": t.payee,
            "amount": t.amount,
            "transaction_type": t.transaction_type,
            "ai_category": t.ai_category,
            "document_id": t.document_id,
        }
        for t in transactions
    ]


@router.post("/ask")
async def ask_ai(
    question: str = Query(..., min_length=3),
    document_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Transaction).join(Document).where(Document.owner_id == current_user.id)
    if document_id:
        query = query.where(Transaction.document_id == document_id)
    query = query.order_by(Transaction.date.desc()).limit(200)

    result = await db.execute(query)
    transactions = result.scalars().all()
    context = [
        {
            "date": t.date,
            "description": t.description,
            "payee": t.payee,
            "amount": t.amount,
            "type": t.transaction_type,
            "category": t.ai_category,
        }
        for t in transactions
    ]

    answer = await answer_financial_question(question, context)
    return {"question": question, "answer": answer, "transactions_analyzed": len(context)}
