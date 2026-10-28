import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.instrumen import Pertanyaan
    from app.models.kebijakan import Kebijakan


class KesiapanBukti(Base):
    __tablename__ = "kesiapan_bukti"
    __table_args__ = (
        UniqueConstraint("kebijakan_id", "pertanyaan_id", name="uq_kesiapan_kebijakan_pertanyaan"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    kebijakan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("kebijakan.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pertanyaan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pertanyaan.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tersedia: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    kebijakan: Mapped["Kebijakan"] = relationship("Kebijakan", back_populates="kesiapan_bukti_list")
    pertanyaan: Mapped["Pertanyaan"] = relationship("Pertanyaan")
