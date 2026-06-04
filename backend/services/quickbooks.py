import httpx
import logging
from datetime import datetime, timedelta
from urllib.parse import urlencode
from fastapi import HTTPException
from config import get_settings
from utils.retry import async_retry

logger = logging.getLogger(__name__)
settings = get_settings()

QB_BASE_URLS = {
    "sandbox": "https://sandbox-quickbooks.api.intuit.com",
    "production": "https://quickbooks.api.intuit.com",
}
QB_AUTH_URL  = "https://appcenter.intuit.com/connect/oauth2"
QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"

SCOPES = "com.intuit.quickbooks.accounting openid profile email"

# QB rate-limits return 429; 500/503 are transient server errors
_QB_RETRYABLE = (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError)


def _is_retryable_status(response: httpx.Response) -> bool:
    return response.status_code in (429, 500, 502, 503, 504)


def get_auth_url(state: str) -> str:
    params = {
        "client_id": settings.qb_client_id,
        "response_type": "code",
        "scope": SCOPES,
        "redirect_uri": settings.qb_redirect_uri,
        "state": state,
    }
    return f"{QB_AUTH_URL}?{urlencode(params)}"


@async_retry(
    max_attempts=3,
    base_delay=1.0,
    max_delay=30.0,
    exponential_base=2.0,
    jitter=True,
    retryable_exceptions=_QB_RETRYABLE,
)
async def exchange_code_for_tokens(code: str, realm_id: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            QB_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.qb_redirect_uri,
            },
            auth=(settings.qb_client_id, settings.qb_client_secret),
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        data = response.json()
        now = datetime.utcnow()
        return {
            "access_token": data["access_token"],
            "refresh_token": data["refresh_token"],
            "realm_id": realm_id,
            "access_token_expires_at": now + timedelta(seconds=data.get("expires_in", 3600)),
            "refresh_token_expires_at": now + timedelta(seconds=data.get("x_refresh_token_expires_in", 8726400)),
        }


@async_retry(
    max_attempts=3,
    base_delay=2.0,
    max_delay=30.0,
    exponential_base=2.0,
    jitter=True,
    retryable_exceptions=_QB_RETRYABLE,
)
async def refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            QB_TOKEN_URL,
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            auth=(settings.qb_client_id, settings.qb_client_secret),
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        data = response.json()
        now = datetime.utcnow()
        return {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", refresh_token),
            "access_token_expires_at": now + timedelta(seconds=data.get("expires_in", 3600)),
        }


class QuickBooksClient:
    def __init__(self, access_token: str, realm_id: str):
        self.access_token = access_token
        self.realm_id = realm_id
        self.base_url = QB_BASE_URLS[settings.qb_environment]
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _get(self, url: str, **kwargs) -> httpx.Response:
        return await self._request("GET", url, **kwargs)

    async def _post(self, url: str, **kwargs) -> httpx.Response:
        return await self._request("POST", url, **kwargs)

    @async_retry(
        max_attempts=4,
        base_delay=1.0,
        max_delay=60.0,
        exponential_base=2.0,
        jitter=True,
        retryable_exceptions=_QB_RETRYABLE,
    )
    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        async with httpx.AsyncClient(timeout=30) as http:
            response = await http.request(method, url, headers=self.headers, **kwargs)
            if _is_retryable_status(response):
                retry_after = int(response.headers.get("Retry-After", 5))
                logger.warning("QB API returned %d — will retry (Retry-After: %ds)", response.status_code, retry_after)
                import asyncio
                await asyncio.sleep(retry_after)
                raise httpx.RemoteProtocolError(
                    f"Retryable QB status {response.status_code}",
                    request=response.request,
                )
            response.raise_for_status()
            return response

    async def get_company_info(self) -> dict:
        response = await self._get(
            f"{self.base_url}/v3/company/{self.realm_id}/companyinfo/{self.realm_id}"
        )
        return response.json()["CompanyInfo"]

    async def get_accounts(self) -> list[dict]:
        response = await self._get(
            f"{self.base_url}/v3/company/{self.realm_id}/query",
            params={"query": "SELECT * FROM Account WHERE Active = true MAXRESULTS 200"},
        )
        return response.json().get("QueryResponse", {}).get("Account", [])

    async def create_bank_deposit(self, transaction: dict) -> dict:
        payload = {
            "TxnDate": transaction["date"],
            "TotalAmt": transaction["amount"],
            "Line": [
                {
                    "Amount": transaction["amount"],
                    "LinkedTxn": [],
                    "DetailType": "DepositLineDetail",
                    "DepositLineDetail": {"Memo": transaction.get("description", "")},
                }
            ],
            "PrivateNote": f"Imported by AccountingSuite | Ref: {transaction.get('reference_number', '')}",
        }
        response = await self._post(
            f"{self.base_url}/v3/company/{self.realm_id}/deposit",
            json=payload,
        )
        return response.json()["Deposit"]

    async def create_expense(self, transaction: dict, account_id: str | None = None) -> dict:
        payload = {
            "TxnDate": transaction["date"],
            "TotalAmt": abs(transaction["amount"]),
            "Line": [
                {
                    "Amount": abs(transaction["amount"]),
                    "DetailType": "AccountBasedExpenseLineDetail",
                    "AccountBasedExpenseLineDetail": {
                        "AccountRef": {"value": account_id or "1"},
                        "BillableStatus": "NotBillable",
                    },
                }
            ],
            "PrivateNote": f"Imported by AccountingSuite | {transaction.get('description', '')}",
        }
        response = await self._post(
            f"{self.base_url}/v3/company/{self.realm_id}/purchase",
            json=payload,
        )
        return response.json()["Purchase"]

    async def query(self, sql: str) -> dict:
        response = await self._get(
            f"{self.base_url}/v3/company/{self.realm_id}/query",
            params={"query": sql},
        )
        return response.json().get("QueryResponse", {})
