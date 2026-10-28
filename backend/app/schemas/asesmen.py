import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.jawaban import JawabanBaca


class AsesmenAksiPayload(BaseModel):
    catatan: str | None = Field(
        default=None, description="Wajib diisi untuk aksi pengembalian atau pembukaan kembali"
    )


class NilaiDimensiBaca(BaseModel):
    kode: str
    nama: str
    bobot_persen: Decimal
    nilai_murni: Decimal
    kontribusi_total: Decimal
    nilai_tampilan: Decimal


class HasilSkorBaca(BaseModel):
    nilai_profil: Decimal
    kontribusi_profil: Decimal
    dimensi: dict[str, NilaiDimensiBaca]
    nilai_total: Decimal
    nilai_total_tampilan: Decimal
    kualifikasi: str


class AsesmenJfakUpdate(BaseModel):
    melibatkan_jfak: bool
    penjelasan_jfak: str | None = None
    surat_penunjukan_jfak: str | None = None


class AsesmenBaca(BaseModel):
    id: uuid.UUID
    kebijakan_id: uuid.UUID
    status: str
    analis_id: uuid.UUID
    melibatkan_jfak: bool | None = True
    penjelasan_jfak: str | None = None
    surat_penunjukan_jfak: str | None = None
    catatan_koordinator: str | None = None
    jawaban_list: list[JawabanBaca] = []
    skor_terkini: HasilSkorBaca | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RiwayatBaca(BaseModel):
    id: uuid.UUID
    entitas: str
    entitas_id: uuid.UUID
    aksi: str
    pelaku_id: uuid.UUID
    pelaku_nama: str | None = None
    waktu: datetime
    catatan: str | None

    model_config = {"from_attributes": True}
