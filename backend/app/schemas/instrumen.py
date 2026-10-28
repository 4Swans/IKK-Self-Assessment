import uuid
from decimal import Decimal

from pydantic import BaseModel


class OpsiJawabanBaca(BaseModel):
    id: uuid.UUID
    huruf: str
    teks: str
    skor: Decimal

    model_config = {"from_attributes": True}


class PertanyaanBaca(BaseModel):
    id: uuid.UUID
    kode: str
    teks: str
    bobot_relatif: Decimal
    bukti_dukung: str
    keterangan: str
    opsi_list: list[OpsiJawabanBaca]

    model_config = {"from_attributes": True}


class DimensiBaca(BaseModel):
    id: uuid.UUID
    kode: str
    nama: str
    bobot: Decimal
    pertanyaan_list: list[PertanyaanBaca]

    model_config = {"from_attributes": True}


class AmbangKualifikasiBaca(BaseModel):
    id: uuid.UUID
    min_nilai: Decimal
    kualifikasi: str

    model_config = {"from_attributes": True}


class InstrumenBaca(BaseModel):
    id: uuid.UUID
    tahun: int
    versi: str
    aktif: bool
    bobot_profil: Decimal
    skor_profil_ya: Decimal
    skor_profil_tidak: Decimal | None
    profil_pertanyaan: str
    profil_bukti_dukung: str
    dimensi_list: list[DimensiBaca]
    ambang_kualifikasi_list: list[AmbangKualifikasiBaca]

    model_config = {"from_attributes": True}
