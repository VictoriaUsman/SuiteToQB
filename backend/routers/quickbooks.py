import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database import get_db
from models import User, Transaction, Document, QuickBooksToken
from utils.security import get_current_user
from services.quickbooks import (
    get_auth_url,
    exchange_code_for_tokens,
    refresh_access_token,
    QuickBooksClient,
)

router = APIRouter(prefix="/api/quickbooks", tags=["quickbooks"])

# In-memory state store (use Redis/DB in production for multi-instance)
_oauth_states: dict[str, int] = {}


@router.get("/connect")
async def connect_quickbooks(current_user: User = Depends(get_current_user)):
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = current_user.id
    auth_url = get_auth_url(state)
    return {"auth_url": auth_url}


@router.get("/callback")
async def quickbooks_callback(
    code: str = Query(...),
    state: str = Query(...),
    realmId: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    user_id = _oauth_states.pop(state, None)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    token_data = await exchange_code_for_tokens(code, realmId)

    # Get company info
    qb_client = QuickBooksClient(token_data["access_token"], realmId)
    try:
        company = await qb_client.get_company_info()
        company_name = company.get("CompanyName", "")
    except Exception:
        company_name = ""

    # Upsert token record
    existing = await db.execute(
        select(QuickBooksToken).where(QuickBooksToken.user_id == user_id, QuickBooksToken.realm_id == realmId)
    )
    token_record = existing.scalar_one_or_none()
    if token_record:
        token_record.access_token = token_data["access_token"]
        token_record.refresh_token = token_data["refresh_token"]
        token_record.access_token_expires_at = token_data["access_token_expires_at"]
        token_record.refresh_token_expires_at = token_data["refresh_token_expires_at"]
        token_record.company_name = company_name
        token_record.is_active = True
    else:
        token_record = QuickBooksToken(
            user_id=user_id,
            realm_id=realmId,
            company_name=company_name,
            **{k: v for k, v in token_data.items() if k != "realm_id"},
        )
        db.add(token_record)

    await db.commit()
    return RedirectResponse(url="http://localhost:5173/settings?qb=connected")


@router.get("/status")
async def qb_status(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(QuickBooksToken).where(QuickBooksToken.user_id == current_user.id, QuickBooksToken.is_active == True)
    )
    token = result.scalar_one_or_none()
    if not token:
        return {"connected": False}
    return {
        "connected": True,
        "company_name": token.company_name,
        "realm_id": token.realm_id,
        "access_token_expires_at": token.access_token_expires_at.isoformat(),
    }


async def get_active_qb_client(db: AsyncSession, user_id: int) -> QuickBooksClient:
    result = await db.execute(
        select(QuickBooksToken).where(QuickBooksToken.user_id == user_id, QuickBooksToken.is_active == True)
    )
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=400, detail="QuickBooks not connected. Please connect first.")

    if token.access_token_expires_at <= datetime.utcnow():
        refreshed = await refresh_access_token(token.refresh_token)
        token.access_token = refreshed["access_token"]
        token.access_token_expires_at = refreshed["access_token_expires_at"]
        if "refresh_token" in refreshed:
            token.refresh_token = refreshed["refresh_token"]
        await db.commit()

    return QuickBooksClient(token.access_token, token.realm_id)


@router.get("/accounts")
async def list_qb_accounts(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    qb = await get_active_qb_client(db, current_user.id)
    accounts = await qb.get_accounts()
    return accounts


class SyncRequest(BaseModel):
    transaction_ids: list[int]


@router.post("/sync")
async def sync_transactions(
    payload: SyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    qb = await get_active_qb_client(db, current_user.id)

    result = await db.execute(
        select(Transaction)
        .join(Document)
        .where(Transaction.id.in_(payload.transaction_ids), Document.owner_id == current_user.id)
    )
    transactions = result.scalars().all()

    synced, failed = [], []
    for txn in transactions:
        try:
            txn_dict = {
                "date": txn.date,
                "description": txn.description,
                "amount": txn.amount,
                "transaction_type": txn.transaction_type,
                "reference_number": txn.reference_number,
            }
            if txn.transaction_type == "deposit":
                qb_result = await qb.create_bank_deposit(txn_dict)
                txn.qb_transaction_id = qb_result.get("Id")
            else:
                qb_result = await qb.create_expense(txn_dict)
                txn.qb_transaction_id = qb_result.get("Id")
            txn.qb_synced = True
            txn.qb_synced_at = datetime.utcnow()
            synced.append(txn.id)
        except Exception as e:
            failed.append({"id": txn.id, "error": str(e)})

    await db.commit()
    return {"synced": synced, "failed": failed}


@router.delete("/disconnect")
async def disconnect_quickbooks(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(QuickBooksToken).where(QuickBooksToken.user_id == current_user.id, QuickBooksToken.is_active == True)
    )
    token = result.scalar_one_or_none()
    if token:
        token.is_active = False
        await db.commit()
    return {"disconnected": True}
