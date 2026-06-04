"""
Seed script — populates the database with 6 months of realistic sample data.

Usage:
    python seed.py
    python seed.py --reset   # drops all data first
"""

import asyncio
import sys
import random
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

from sqlalchemy import delete
from database import init_db, AsyncSessionLocal
from models import User, Document, Transaction, Category
from utils.security import hash_password


# ── Configuration ────────────────────────────────────────────────────────────

DEMO_USER = {
    "email": "demo@accountingsuite.com",
    "full_name": "Demo User",
    "password": "demo1234",
}

# 6-month window ending today
END_DATE   = date(2026, 6, 4)
START_DATE = END_DATE - relativedelta(months=6)

INSTITUTION = "First National Business Bank"
STARTING_BALANCE = 48_250.00


# ── Category definitions ──────────────────────────────────────────────────────

CATEGORIES = [
    {"name": "payroll",         "color": "#10b981"},
    {"name": "sales_revenue",   "color": "#3b82f6"},
    {"name": "rent",            "color": "#ef4444"},
    {"name": "utilities",       "color": "#f59e0b"},
    {"name": "groceries",       "color": "#84cc16"},
    {"name": "fuel",            "color": "#f97316"},
    {"name": "insurance",       "color": "#8b5cf6"},
    {"name": "taxes",           "color": "#ec4899"},
    {"name": "loan_payment",    "color": "#06b6d4"},
    {"name": "bank_fee",        "color": "#6b7280"},
    {"name": "interest_income", "color": "#14b8a6"},
    {"name": "vendor_payment",  "color": "#a855f7"},
    {"name": "office_supplies", "color": "#eab308"},
    {"name": "travel",          "color": "#0ea5e9"},
    {"name": "entertainment",   "color": "#f43f5e"},
    {"name": "medical",         "color": "#64748b"},
    {"name": "transfer",        "color": "#94a3b8"},
    {"name": "other",           "color": "#d1d5db"},
]


# ── Transaction templates per category ───────────────────────────────────────

DEPOSIT_TEMPLATES = [
    # (description, payee, category, amount_range, day_offsets)
    ("CLIENT PAYMENT - ACME CORP INVOICE #{}",        "Acme Corp",              "sales_revenue",   (4200, 8500),  [3, 4]),
    ("WIRE TRANSFER - GLOBEX INDUSTRIES INV {}",      "Globex Industries",      "sales_revenue",   (6000, 12000), [7, 8]),
    ("ACH DEPOSIT - PINNACLE SOLUTIONS {}",           "Pinnacle Solutions",     "sales_revenue",   (3500, 7000),  [10, 11]),
    ("ONLINE PAYMENT RECEIVED - INITECH LLC",         "Initech LLC",            "sales_revenue",   (1800, 4500),  [14, 15]),
    ("INTEREST CREDIT",                               "First National Bank",    "interest_income", (12, 45),      [28]),
    ("REFUND - VENDOR OVERPAYMENT",                   "Staples Business",       "other",           (80, 350),     [20]),
    ("TRANSFER FROM SAVINGS ACCOUNT",                 "First National Bank",    "transfer",        (5000, 10000), [1]),
]

WITHDRAWAL_TEMPLATES = [
    # (description, payee, category, amount_range, day_offsets)
    ("PAYROLL DIRECT DEPOSIT - EMPLOYEES",            "ADP Payroll Services",   "payroll",         (14000, 18000), [1, 2]),
    ("RENT PAYMENT - OFFICE SPACE",                   "Metro Commercial Realty","rent",             (3200, 3200),  [1]),
    ("XCEL ENERGY - UTILITIES",                       "Xcel Energy",            "utilities",       (280, 520),    [5]),
    ("AT&T BUSINESS - PHONE/INTERNET",                "AT&T Business",          "utilities",       (210, 310),    [8]),
    ("WASTE MANAGEMENT - SERVICES",                   "Waste Management",       "utilities",       (85, 110),     [12]),
    ("PROGRESSIVE COMMERCIAL INSURANCE",              "Progressive Insurance",  "insurance",       (640, 640),    [15]),
    ("SBA LOAN PAYMENT - REF {}",                     "First National Bank",    "loan_payment",    (1850, 1850),  [20]),
    ("COSTCO BUSINESS - SUPPLIES",                    "Costco Wholesale",       "office_supplies", (180, 480),    [6]),
    ("AMAZON BUSINESS - OFFICE SUPPLIES",             "Amazon Business",        "office_supplies", (95, 390),     [9]),
    ("SHELL OIL - FLEET FUEL",                        "Shell Fleet",            "fuel",            (320, 680),    [7, 21]),
    ("DELTA AIR LINES - BUSINESS TRAVEL",             "Delta Air Lines",        "travel",          (380, 1200),   [13]),
    ("MARRIOTT HOTELS - BUSINESS TRAVEL",             "Marriott Hotels",        "travel",          (220, 650),    [14]),
    ("QUICKBOOKS SUBSCRIPTION",                       "Intuit Inc",             "other",           (85, 85),      [10]),
    ("GOOGLE WORKSPACE - MONTHLY",                    "Google LLC",             "other",           (72, 72),      [10]),
    ("GUSTO PAYROLL SOFTWARE",                        "Gusto Inc",              "other",           (149, 149),    [10]),
    ("QUARTERLY ESTIMATED TAX - IRS",                 "IRS",                    "taxes",           (4200, 6800),  [15]),  # quarterly only
    ("BANK SERVICE FEE",                              "First National Bank",    "bank_fee",        (25, 25),      [28]),
    ("WIRE TRANSFER FEE",                             "First National Bank",    "bank_fee",        (20, 35),      [7, 14]),
    ("STAPLES - OFFICE SUPPLIES",                     "Staples",                "office_supplies", (55, 220),     [16]),
    ("TEAMWORK RESTAURANT - CLIENT LUNCH",            "Teamwork Restaurant",    "entertainment",   (85, 240),     [11, 22]),
    ("ADOBE CREATIVE CLOUD - BUSINESS",               "Adobe Inc",              "other",           (79, 79),      [3]),
    ("ZOOM BUSINESS - MONTHLY",                       "Zoom Video",             "other",           (149, 149),    [3]),
    ("FEDEX SHIPPING - BUSINESS",                     "FedEx",                  "other",           (45, 180),     [17]),
    ("CVS PHARMACY - FIRST AID SUPPLIES",             "CVS Health",             "medical",         (35, 90),      [19]),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

rng = random.Random(42)   # fixed seed for reproducibility


def rand_amount(lo, hi):
    return round(rng.uniform(lo, hi), 2)


def make_ref():
    return f"{rng.randint(100000, 999999)}"


def month_label(d: date) -> str:
    return d.strftime("%B %Y")


def month_range(year: int, month: int):
    first = date(year, month, 1)
    last  = (first + relativedelta(months=1)) - timedelta(days=1)
    return first, last


# ── Core seed logic ───────────────────────────────────────────────────────────

async def seed(reset: bool = False):
    await init_db()

    async with AsyncSessionLocal() as db:

        if reset:
            print("Resetting existing data...")
            await db.execute(delete(Transaction))
            await db.execute(delete(Document))
            await db.execute(delete(Category))
            await db.execute(delete(User))
            await db.commit()

        # ── User ──────────────────────────────────────────────────────────────
        from sqlalchemy import select
        existing = await db.execute(select(User).where(User.email == DEMO_USER["email"]))
        user = existing.scalar_one_or_none()
        if not user:
            user = User(
                email=DEMO_USER["email"],
                full_name=DEMO_USER["full_name"],
                hashed_password=hash_password(DEMO_USER["password"]),
            )
            db.add(user)
            await db.flush()
            print(f"Created user: {DEMO_USER['email']}  password: {DEMO_USER['password']}")
        else:
            print(f"User already exists: {DEMO_USER['email']}")

        # ── Categories ────────────────────────────────────────────────────────
        cat_map: dict[str, Category] = {}
        for cat_def in CATEGORIES:
            existing_cat = await db.execute(select(Category).where(Category.name == cat_def["name"]))
            cat = existing_cat.scalar_one_or_none()
            if not cat:
                cat = Category(name=cat_def["name"], color=cat_def["color"], is_system=True)
                db.add(cat)
                await db.flush()
            cat_map[cat_def["name"]] = cat

        # ── Build months ──────────────────────────────────────────────────────
        months = []
        cursor = date(START_DATE.year, START_DATE.month, 1)
        while cursor <= date(END_DATE.year, END_DATE.month, 1):
            months.append((cursor.year, cursor.month))
            cursor += relativedelta(months=1)

        balance = STARTING_BALANCE
        total_txns = 0

        for year, month in months:
            first_day, last_day = month_range(year, month)
            label = month_label(first_day)
            print(f"\nGenerating {label}...")

            month_deposits    = 0.0
            month_withdrawals = 0.0
            month_txns        = []

            # Deposits
            for desc_tpl, payee, cat_name, (lo, hi), day_offsets in DEPOSIT_TEMPLATES:
                # quarterly interest only in Jan/Apr/Jul/Oct
                if cat_name == "interest_income" and month not in (1, 4, 7, 10):
                    continue
                # savings transfer once every 2 months
                if "SAVINGS" in desc_tpl and month % 2 != 0:
                    continue

                for day_off in day_offsets:
                    txn_date = first_day + timedelta(days=day_off - 1)
                    if txn_date > last_day or txn_date > END_DATE:
                        continue
                    amount = rand_amount(lo, hi)
                    desc   = desc_tpl.format(make_ref()) if "{}" in desc_tpl else desc_tpl
                    balance = round(balance + amount, 2)
                    month_deposits += amount
                    month_txns.append({
                        "date": txn_date.isoformat(),
                        "description": desc,
                        "payee": payee,
                        "amount": amount,
                        "transaction_type": "deposit",
                        "balance_after": balance,
                        "reference_number": make_ref(),
                        "ai_category": cat_name,
                        "ai_confidence": round(rng.uniform(0.82, 0.99), 2),
                        "category": cat_map.get(cat_name),
                    })

            # Withdrawals
            for desc_tpl, payee, cat_name, (lo, hi), day_offsets in WITHDRAWAL_TEMPLATES:
                # quarterly taxes only in Jan/Apr/Jul/Oct, 15th
                if cat_name == "taxes" and month not in (1, 4, 7, 10):
                    continue
                # skip some optional items randomly for realism
                if cat_name in ("travel", "entertainment") and rng.random() < 0.35:
                    continue

                for day_off in day_offsets:
                    txn_date = first_day + timedelta(days=day_off - 1)
                    if txn_date > last_day or txn_date > END_DATE:
                        continue
                    amount = rand_amount(lo, hi)
                    desc   = desc_tpl.format(make_ref()) if "{}" in desc_tpl else desc_tpl
                    balance = round(balance - amount, 2)
                    month_withdrawals += amount
                    month_txns.append({
                        "date": txn_date.isoformat(),
                        "description": desc,
                        "payee": payee,
                        "amount": amount,
                        "transaction_type": "withdrawal",
                        "balance_after": balance,
                        "reference_number": make_ref(),
                        "ai_category": cat_name,
                        "ai_confidence": round(rng.uniform(0.78, 0.99), 2),
                        "category": cat_map.get(cat_name),
                    })

            # Sort by date
            month_txns.sort(key=lambda t: t["date"])

            # Document (bank statement)
            doc = Document(
                owner_id=user.id,
                filename=f"statement_{year}_{month:02d}.pdf",
                original_filename=f"Bank_Statement_{label.replace(' ', '_')}.pdf",
                file_type="pdf",
                file_size=rng.randint(85_000, 320_000),
                file_path=f"./uploads/sample/statement_{year}_{month:02d}.pdf",
                status="done",
                institution_name=INSTITUTION,
                statement_period_start=first_day.isoformat(),
                statement_period_end=min(last_day, END_DATE).isoformat(),
                total_deposits=round(month_deposits, 2),
                total_withdrawals=round(month_withdrawals, 2),
                ending_balance=balance,
                ai_summary=(
                    f"{label} summary for {INSTITUTION}. "
                    f"Total deposits: ${month_deposits:,.2f}. "
                    f"Total withdrawals: ${month_withdrawals:,.2f}. "
                    f"Ending balance: ${balance:,.2f}. "
                    f"{len(month_txns)} transactions processed."
                ),
            )
            db.add(doc)
            await db.flush()

            # Transactions
            for t in month_txns:
                txn = Transaction(
                    document_id=doc.id,
                    category_id=t["category"].id if t["category"] else None,
                    date=t["date"],
                    description=t["description"],
                    amount=t["amount"],
                    transaction_type=t["transaction_type"],
                    balance_after=t["balance_after"],
                    reference_number=t["reference_number"],
                    payee=t["payee"],
                    ai_category=t["ai_category"],
                    ai_confidence=t["ai_confidence"],
                    is_reviewed=rng.random() < 0.4,
                )
                db.add(txn)

            total_txns += len(month_txns)
            print(f"  {label}: {len(month_txns)} transactions | "
                  f"deposits ${month_deposits:,.2f} | "
                  f"withdrawals ${month_withdrawals:,.2f} | "
                  f"balance ${balance:,.2f}")

        await db.commit()
        print(f"\nDone! {len(months)} monthly statements, {total_txns} transactions seeded.")
        print(f"\nLogin at http://localhost:5173")
        print(f"  Email:    {DEMO_USER['email']}")
        print(f"  Password: {DEMO_USER['password']}")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    try:
        from dateutil.relativedelta import relativedelta
    except ImportError:
        print("Installing python-dateutil...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "python-dateutil"], check=True)
        from dateutil.relativedelta import relativedelta

    asyncio.run(seed(reset=reset))
