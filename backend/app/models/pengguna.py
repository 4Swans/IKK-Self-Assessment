import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PeranPengguna(StrEnum):
    ANALIS = "ANALIS"
    KOORDINATOR = "KOORDINATOR"
    ADMIN = "ADMIN"


class StatusVerifikasi(StrEnum):
    MENUNGGU_OTP_EMAIL = "MENUNGGU_OTP_EMAIL"
    MENUNGGU_VERIFIKASI = "MENUNGGU_VERIFIKASI"
    AKTIF = "AKTIF"
    DITOLAK = "DITOLAK"


class Pengguna(Base):
    __tablename__ = "pengguna"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nama: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    nip: Mapped[str | None] = mapped_column(String(50), unique=False, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    peran: Mapped[str] = mapped_column(String(50), nullable=False, default=PeranPengguna.ANALIS)
    instansi: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Kementerian Komunikasi dan Digital"
    )
    satuan_kerja: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Pusat Kebijakan Strategis (PUSAKA)"
    )
    status_verifikasi: Mapped[str] = mapped_column(
        String(50), nullable=False, default=StatusVerifikasi.AKTIF
    )
    email_terverifikasi: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    kode_otp: Mapped[str | None] = mapped_column(String(20), nullable=True)
    otp_kadaluarsa_pada: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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
