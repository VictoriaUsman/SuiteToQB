from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, Document, Transaction
from utils.security import get_current_user
from services.report_generator import generate_pdf_report, generate_excel_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


async def build_report_data(doc_id: int, db: AsyncSession, current_user: User):
    doc_result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.owner_id == current_user.id)
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    txn_result = await db.execute(
        select(Transaction).where(Transaction.document_id == doc_id).order_by(Transaction.date)
    )
    transactions = txn_result.scalars().all()
    txn_dicts = [
        {
            "date": t.date,
            "description": t.description,
            "payee": t.payee,
            "transaction_type": t.transaction_type,
            "ai_category": t.ai_category,
            "amount": t.amount,
            "balance_after": t.balance_after,
            "reference_number": t.reference_number,
            "qb_synced": t.qb_synced,
        }
        for t in transactions
    ]

    summary = {
        "institution_name": doc.institution_name,
        "statement_period_start": doc.statement_period_start,
        "statement_period_end": doc.statement_period_end,
        "total_deposits": doc.total_deposits,
        "total_withdrawals": doc.total_withdrawals,
        "ending_balance": doc.ending_balance,
        "ai_summary": doc.ai_summary,
    }
    return txn_dicts, summary, doc.original_filename


@router.get("/{doc_id}/pdf")
async def export_pdf(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns, summary, filename = await build_report_data(doc_id, db, current_user)
    title = f"Financial Report — {filename}"
    pdf_bytes = generate_pdf_report(txns, summary, title)
    safe_name = filename.rsplit(".", 1)[0] + "_report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/{doc_id}/excel")
async def export_excel(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns, summary, filename = await build_report_data(doc_id, db, current_user)
    title = f"Financial Report — {filename}"
    xlsx_bytes = generate_excel_report(txns, summary, title)
    safe_name = filename.rsplit(".", 1)[0] + "_report.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )
