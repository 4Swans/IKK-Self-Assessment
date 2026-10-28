import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.asesmen import Asesmen
    from app.models.bukti_dukung import BuktiDukung
    from app.models.instrumen import OpsiJawaban, Pertanyaan


class Jawaban(Base):
    __tablename__ = "jawaban"
    __table_args__ = (
        UniqueConstraint("asesmen_id", "pertanyaan_id", name="uq_jawaban_asesmen_pertanyaan"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    asesmen_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("asesmen.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pertanyaan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pertanyaan.id", ondelete="CASCADE"), nullable=False, index=True
    )
    opsi_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("opsi_jawaban.id", ondelete="SET NULL"), nullable=True, index=True
    )
    penjelasan: Mapped[str | None] = mapped_column(Text, nullable=True)
    tautan_bukti: Mapped[str | None] = mapped_column(Text, nullable=True)
    akses_publik_dicek: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    asesmen: Mapped["Asesmen"] = relationship("Asesmen", back_populates="jawaban_list")
    pertanyaan: Mapped["Pertanyaan"] = relationship("Pertanyaan")
    opsi: Mapped["OpsiJawaban | None"] = relationship("OpsiJawaban")
    bukti_dukung_list: Mapped[list["BuktiDukung"]] = relationship(
        "BuktiDukung", back_populates="jawaban", cascade="all, delete-orphan"
    )
