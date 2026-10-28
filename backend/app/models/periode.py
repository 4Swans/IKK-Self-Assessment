import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.instrumen import Instrumen
    from app.models.kebijakan import Kebijakan


class Periode(Base):
    __tablename__ = "periode"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    instansi: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tahun: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    instrumen_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("instrumen.id"), nullable=False, index=True
    )
    melibatkan_jfak: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tautan_surat_penunjukan: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    instrumen: Mapped["Instrumen"] = relationship("Instrumen")
    kebijakan_list: Mapped[list["Kebijakan"]] = relationship(
        "Kebijakan", back_populates="periode", cascade="all, delete-orphan"
    )
