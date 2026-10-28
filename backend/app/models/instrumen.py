import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Instrumen(Base):
    __tablename__ = "instrumen"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tahun: Mapped[int] = mapped_column(index=True, nullable=False)
    versi: Mapped[str] = mapped_column(String(50), nullable=False)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    bobot_profil: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    skor_profil_ya: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    skor_profil_tidak: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    profil_pertanyaan: Mapped[str] = mapped_column(Text, nullable=False)
    profil_bukti_dukung: Mapped[str] = mapped_column(Text, nullable=False)

    dimensi_list: Mapped[list["Dimensi"]] = relationship(
        "Dimensi", back_populates="instrumen", cascade="all, delete-orphan", order_by="Dimensi.kode"
    )
    ambang_kualifikasi_list: Mapped[list["AmbangKualifikasi"]] = relationship(
        "AmbangKualifikasi",
        back_populates="instrumen",
        cascade="all, delete-orphan",
        order_by="AmbangKualifikasi.min_nilai.desc()",
    )


class Dimensi(Base):
    __tablename__ = "dimensi"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    instrumen_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("instrumen.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kode: Mapped[str] = mapped_column(String(10), nullable=False)  # A, B, C, D
    nama: Mapped[str] = mapped_column(String(255), nullable=False)
    bobot: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)

    instrumen: Mapped["Instrumen"] = relationship("Instrumen", back_populates="dimensi_list")
    pertanyaan_list: Mapped[list["Pertanyaan"]] = relationship(
        "Pertanyaan",
        back_populates="dimensi",
        cascade="all, delete-orphan",
        order_by="Pertanyaan.kode",
    )


class Pertanyaan(Base):
    __tablename__ = "pertanyaan"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    dimensi_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dimensi.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kode: Mapped[str] = mapped_column(String(10), nullable=False)  # A1, A2, dst.
    teks: Mapped[str] = mapped_column(Text, nullable=False)
    bobot_relatif: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=1.00)
    bukti_dukung: Mapped[str] = mapped_column(Text, nullable=False)
    keterangan: Mapped[str] = mapped_column(Text, nullable=False)

    dimensi: Mapped["Dimensi"] = relationship("Dimensi", back_populates="pertanyaan_list")
    opsi_list: Mapped[list["OpsiJawaban"]] = relationship(
        "OpsiJawaban",
        back_populates="pertanyaan",
        cascade="all, delete-orphan",
        order_by="OpsiJawaban.huruf",
    )


class OpsiJawaban(Base):
    __tablename__ = "opsi_jawaban"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    pertanyaan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pertanyaan.id", ondelete="CASCADE"), nullable=False, index=True
    )
    huruf: Mapped[str] = mapped_column(String(2), nullable=False)  # A, B, C, D, E
    teks: Mapped[str] = mapped_column(Text, nullable=False)
    skor: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)

    pertanyaan: Mapped["Pertanyaan"] = relationship("Pertanyaan", back_populates="opsi_list")


class AmbangKualifikasi(Base):
    __tablename__ = "ambang_kualifikasi"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    instrumen_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("instrumen.id", ondelete="CASCADE"), nullable=False, index=True
    )
    min_nilai: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    kualifikasi: Mapped[str] = mapped_column(String(50), nullable=False)

    instrumen: Mapped["Instrumen"] = relationship(
        "Instrumen", back_populates="ambang_kualifikasi_list"
    )
