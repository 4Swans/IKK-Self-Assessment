import uuid
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.asesmen import Asesmen
    from app.models.kesiapan_bukti import KesiapanBukti
    from app.models.pengguna import Pengguna
    from app.models.periode import Periode


class Kebijakan(Base):
    __tablename__ = "kebijakan"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    periode_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("periode.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nama: Mapped[str] = mapped_column(String(500), nullable=False)
    jenis_dasar_hukum: Mapped[str] = mapped_column(String(100), nullable=False)
    nomor_dasar_hukum: Mapped[str] = mapped_column(String(255), nullable=False)
    tanggal_penetapan: Mapped[date] = mapped_column(Date, nullable=False)
    dipilih_untuk_si_ikk: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rekomendasi: Mapped[str | None] = mapped_column(Text, nullable=True)
    satuan_kerja: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    pembuat_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pengguna.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    periode: Mapped["Periode"] = relationship("Periode", back_populates="kebijakan_list")
    pembuat: Mapped["Pengguna | None"] = relationship("Pengguna")
    kesiapan_bukti_list: Mapped[list["KesiapanBukti"]] = relationship(
        "KesiapanBukti", back_populates="kebijakan", cascade="all, delete-orphan"
    )
    asesmen: Mapped["Asesmen | None"] = relationship(
        "Asesmen", back_populates="kebijakan", uselist=False, cascade="all, delete-orphan"
    )
