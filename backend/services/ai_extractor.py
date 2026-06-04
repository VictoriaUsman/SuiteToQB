import json
import base64
import logging
from pathlib import Path
from openai import AsyncOpenAI, RateLimitError, APITimeoutError, APIConnectionError, InternalServerError
from config import get_settings
from utils.retry import async_retry

logger = logging.getLogger(__name__)
settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key)

# Transient OpenAI errors worth retrying
_OPENAI_RETRYABLE = (RateLimitError, APITimeoutError, APIConnectionError, InternalServerError)

EXTRACTION_SYSTEM_PROMPT = """You are a financial document analysis expert. Extract structured data from bank statements and financial documents.
Always return valid JSON matching the requested schema. Be precise with numbers and dates."""

EXTRACTION_USER_PROMPT = """Analyze this financial document text and extract:

1. Document metadata:
   - institution_name: bank or institution name
   - statement_period_start: start date (YYYY-MM-DD)
   - statement_period_end: end date (YYYY-MM-DD)
   - account_number_last4: last 4 digits only (for security)
   - ending_balance: final balance as float
   - total_deposits: sum of all deposits as float
   - total_withdrawals: sum of all withdrawals as float
   - summary: 2-3 sentence plain English summary

2. Transactions list, each with:
   - date: YYYY-MM-DD
   - description: cleaned transaction description
   - amount: absolute value as float
   - transaction_type: one of [deposit, withdrawal, transfer, fee, interest]
   - balance_after: running balance after this transaction if available
   - reference_number: check number, ref ID, or null
   - payee: merchant or payee name extracted from description, or null
   - ai_category: one of [payroll, rent, utilities, groceries, fuel, insurance, taxes, loan_payment, transfer, bank_fee, interest_income, sales_revenue, vendor_payment, office_supplies, travel, entertainment, medical, other]
   - ai_confidence: float 0.0-1.0 for category confidence

Return ONLY a JSON object with keys: metadata, transactions

Document text:
{text}"""


@async_retry(
    max_attempts=4,
    base_delay=2.0,
    max_delay=60.0,
    exponential_base=2.0,
    jitter=True,
    retryable_exceptions=_OPENAI_RETRYABLE,
)
async def extract_from_text(raw_text: str) -> dict:
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": EXTRACTION_USER_PROMPT.format(text=raw_text[:15000])},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        timeout=120,
    )
    return json.loads(response.choices[0].message.content)


@async_retry(
    max_attempts=4,
    base_delay=2.0,
    max_delay=60.0,
    exponential_base=2.0,
    jitter=True,
    retryable_exceptions=_OPENAI_RETRYABLE,
)
async def extract_from_image_file(file_path: str) -> dict:
    with open(file_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")
    ext = Path(file_path).suffix.lower().lstrip(".")
    media_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"

    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{media_type};base64,{image_data}", "detail": "high"},
                    },
                    {
                        "type": "text",
                        "text": EXTRACTION_USER_PROMPT.replace("{text}", "[See attached image]"),
                    },
                ],
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        timeout=120,
    )
    return json.loads(response.choices[0].message.content)


@async_retry(
    max_attempts=3,
    base_delay=1.0,
    max_delay=30.0,
    exponential_base=2.0,
    jitter=True,
    retryable_exceptions=_OPENAI_RETRYABLE,
)
async def answer_financial_question(question: str, context_transactions: list[dict]) -> str:
    context_json = json.dumps(context_transactions[:100], indent=2)
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {
                "role": "system",
                "content": "You are a financial analyst assistant. Answer questions about financial data concisely and accurately.",
            },
            {
                "role": "user",
                "content": f"Financial transactions data:\n{context_json}\n\nQuestion: {question}",
            },
        ],
        temperature=0.2,
        timeout=60,
    )
    return response.choices[0].message.content
