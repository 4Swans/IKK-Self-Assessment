import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PeriodeBuat(BaseModel):
    instansi: str = Field(default="Xaka", min_length=2, max_length=255)
    tahun: int = Field(default=2026, ge=2020, le=2050)
    instrumen_id: uuid.UUID
    melibatkan_jfak: bool = Field(default=True)
    tautan_surat_penunjukan: str | None = Field(default=None)


class PeriodeUbah(BaseModel):
    melibatkan_jfak: bool | None = None
    tautan_surat_penunjukan: str | None = None


class PeriodeBaca(BaseModel):
    id: uuid.UUID
    instansi: str
    tahun: int
    instrumen_id: uuid.UUID
    melibatkan_jfak: bool
    tautan_surat_penunjukan: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
