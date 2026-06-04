from sqlalchemy import String, Integer, ForeignKey, Text, DateTime, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)

    date: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)  # deposit, withdrawal, transfer, fee
    balance_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    reference_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payee: Mapped[str | None] = mapped_column(String(500), nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)

    # QuickBooks sync
    qb_transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    qb_synced: Mapped[bool] = mapped_column(Boolean, default=False)
    qb_synced_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    document: Mapped["Document"] = relationship("Document", back_populates="transactions")
    category: Mapped["Category | None"] = relationship("Category", back_populates="transactions")
