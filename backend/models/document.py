from sqlalchemy import String, Integer, ForeignKey, Text, DateTime, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pdf, xlsx, csv, image
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, processing, done, error
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    institution_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    statement_period_start: Mapped[str | None] = mapped_column(String(50), nullable=True)
    statement_period_end: Mapped[str | None] = mapped_column(String(50), nullable=True)
    total_deposits: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_withdrawals: Mapped[float | None] = mapped_column(Float, nullable=True)
    ending_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    processed_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)

    owner: Mapped["User"] = relationship("User", back_populates="documents")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="document", cascade="all, delete-orphan")
