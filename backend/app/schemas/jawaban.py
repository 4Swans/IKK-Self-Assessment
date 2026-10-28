import uuid
from datetime import datetime

from pydantic import BaseModel


class BuktiDukungBaca(BaseModel):
    id: uuid.UUID
    jawaban_id: uuid.UUID
    nama_file: str
    path: str
    mime: str
    ukuran: int
    sha256: str
    ada_lapisan_teks: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class JawabanSimpan(BaseModel):
    opsi_id: uuid.UUID | None = None
    penjelasan: str | None = None
    tautan_bukti: str | None = None
    akses_publik_dicek: bool = False


class JawabanBaca(BaseModel):
    id: uuid.UUID
    asesmen_id: uuid.UUID
    pertanyaan_id: uuid.UUID
    opsi_id: uuid.UUID | None
    penjelasan: str | None
    tautan_bukti: str | None
    akses_publik_dicek: bool
    bukti_dukung_list: list[BuktiDukungBaca] = []

    model_config = {"from_attributes": True}
