import httpx
from datetime import datetime, timedelta
from urllib.parse import urlencode
from config import get_settings

settings = get_settings()

QB_BASE_URLS = {
    "sandbox": "https://sandbox-quickbooks.api.intuit.com",
    "production": "https://quickbooks.api.intuit.com",
}
QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2"
QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
QB_DISCOVERY_URL = "https://developer.api.intuit.com/.well-known/openid_sandbox_configuration"

SCOPES = "com.intuit.quickbooks.accounting openid profile email"


def get_auth_url(state: str) -> str:
    params = {
        "client_id": settings.qb_client_id,
        "response_type": "code",
        "scope": SCOPES,
        "redirect_uri": settings.qb_redirect_uri,
        "state": state,
    }
    return f"{QB_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str, realm_id: str) -> dict:
    async with httpx.AsyncClient() as client:
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


async def refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
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

    async def get_company_info(self) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v3/company/{self.realm_id}/companyinfo/{self.realm_id}",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()["CompanyInfo"]

    async def get_accounts(self) -> list[dict]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v3/company/{self.realm_id}/query",
                params={"query": "SELECT * FROM Account WHERE Active = true MAXRESULTS 200"},
                headers=self.headers,
            )
            response.raise_for_status()
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
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v3/company/{self.realm_id}/deposit",
                json=payload,
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()["Deposit"]

    async def create_expense(self, transaction: dict, account_id: str | None = None) -> dict:
        line = {
            "Amount": abs(transaction["amount"]),
            "DetailType": "AccountBasedExpenseLineDetail",
            "AccountBasedExpenseLineDetail": {
                "AccountRef": {"value": account_id or "1"},
                "BillableStatus": "NotBillable",
            },
        }
        payload = {
            "TxnDate": transaction["date"],
            "TotalAmt": abs(transaction["amount"]),
            "Line": [line],
            "PrivateNote": f"Imported by AccountingSuite | {transaction.get('description', '')}",
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v3/company/{self.realm_id}/purchase",
                json=payload,
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()["Purchase"]

    async def query(self, sql: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v3/company/{self.realm_id}/query",
                params={"query": sql},
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json().get("QueryResponse", {})
