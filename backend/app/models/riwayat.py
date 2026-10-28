import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.pengguna import Pengguna


class Riwayat(Base):
    __tablename__ = "riwayat"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entitas: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entitas_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    aksi: Mapped[str] = mapped_column(String(50), nullable=False)
    pelaku_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pengguna.id"), nullable=False, index=True
    )
    waktu: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    catatan: Mapped[str | None] = mapped_column(Text, nullable=True)

    pelaku: Mapped["Pengguna"] = relationship("Pengguna")
