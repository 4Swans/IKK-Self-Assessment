import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.jawaban import Jawaban


class BuktiDukung(Base):
    __tablename__ = "bukti_dukung"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    jawaban_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jawaban.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nama_file: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime: Mapped[str] = mapped_column(String(100), nullable=False)
    ukuran: Mapped[int] = mapped_column(Integer, nullable=False)  # ukuran dalam bytes
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    ada_lapisan_teks: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    jawaban: Mapped["Jawaban"] = relationship("Jawaban", back_populates="bukti_dukung_list")
