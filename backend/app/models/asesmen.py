import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.jawaban import Jawaban
    from app.models.kebijakan import Kebijakan
    from app.models.pengguna import Pengguna


class StatusAsesmen(StrEnum):
    DRAF = "DRAF"
    DIAJUKAN = "DIAJUKAN"
    PERLU_PERBAIKAN = "PERLU_PERBAIKAN"
    DISETUJUI = "DISETUJUI"
    TERKIRIM_SI_IKK = "TERKIRIM_SI_IKK"


class Asesmen(Base):
    __tablename__ = "asesmen"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    kebijakan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("kebijakan.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(50), default=StatusAsesmen.DRAF, nullable=False)
    analis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pengguna.id"), nullable=False, index=True
    )
    melibatkan_jfak: Mapped[bool | None] = mapped_column(Boolean, default=True, nullable=True)
    penjelasan_jfak: Mapped[str | None] = mapped_column(Text, nullable=True)
    surat_penunjukan_jfak: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    kebijakan: Mapped["Kebijakan"] = relationship("Kebijakan", back_populates="asesmen")
    analis: Mapped["Pengguna"] = relationship("Pengguna")
    jawaban_list: Mapped[list["Jawaban"]] = relationship(
        "Jawaban", back_populates="asesmen", cascade="all, delete-orphan"
    )
