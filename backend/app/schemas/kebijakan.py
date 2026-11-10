import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class KebijakanBuat(BaseModel):
    periode_id: uuid.UUID
    nama: str = Field(..., min_length=3, max_length=500)
    deskripsi: str | None = None
    jenis_dasar_hukum: str = Field(..., min_length=2, max_length=100)
    nomor_dasar_hukum: str = Field(..., min_length=1, max_length=255)
    tanggal_penetapan: date
    tahun_pengukuran: int | None = 2025
    rekomendasi: str | None = None
    satuan_kerja: str | None = None
    analis_id: uuid.UUID | None = None  # Penugasan analis langsung


class KebijakanUbah(BaseModel):
    nama: str | None = None
    deskripsi: str | None = None
    jenis_dasar_hukum: str | None = None
    nomor_dasar_hukum: str | None = None
    tanggal_penetapan: date | None = None
    tahun_pengukuran: int | None = None
    rekomendasi: str | None = None
    satuan_kerja: str | None = None
    dipilih_untuk_si_ikk: bool | None = None


class KebijakanBaca(BaseModel):
    id: uuid.UUID
    periode_id: uuid.UUID
    nama: str
    deskripsi: str | None = None
    jenis_dasar_hukum: str
    nomor_dasar_hukum: str
    tanggal_penetapan: date
    tahun_pengukuran: int | None = 2025
    berkas_dasar_hukum_nama: str | None = None
    berkas_rkakl_nama: str | None = None
    satuan_kerja: str | None = None
    pembuat_id: uuid.UUID | None = None
    dipilih_untuk_si_ikk: bool
    rekomendasi: str | None
    peringatan_rentang_tahun: bool = False  # True jika > 3 tahun sebelum tahun periode
    status_asesmen: str = "DRAF"
    skor_total: float | None = None
    kualifikasi: str | None = None
    jumlah_jawaban: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PilihTigaKebijakanPayload(BaseModel):
    periode_id: uuid.UUID
    kebijakan_ids: list[uuid.UUID] = Field(..., min_length=3, max_length=3)
