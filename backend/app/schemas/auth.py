import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PenggunaDaftar(BaseModel):
    nama: str = Field(..., min_length=2, max_length=255, description="Nama Lengkap Pegawai")
    username: str | None = Field(default=None, max_length=100, description="Username login")
    nip: str = Field(..., min_length=9, max_length=50, description="Nomor Induk Pegawai (NIP)")
    email: str | None = Field(default=None, description="Alamat email (opsional)")
    satuan_kerja: str = Field(..., min_length=2, max_length=255, description="Satuan Kerja asal")
    password: str = Field(..., min_length=6, max_length=100)
    instansi: str = Field(default="Kementerian Komunikasi dan Digital", max_length=255)


class PenggunaMasuk(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=150,
        description="Email kedinasan (@komdigi.go.id) atau username",
    )
    password: str


class PenggunaBaca(BaseModel):
    id: uuid.UUID
    nama: str
    username: str
    email: str | None = None
    nip: str | None = None
    satuan_kerja: str
    status_verifikasi: str
    catatan_penolakan: str | None = None
    email_terverifikasi: bool = False
    peran: str
    instansi: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenRespon(BaseModel):
    access_token: str
    token_type: str = "bearer"
    pengguna: PenggunaBaca


class RegistrasiRespon(BaseModel):
    pesan: str
    pengguna: PenggunaBaca
    status_verifikasi: str


class StatusPendaftaranRespon(BaseModel):
    username: str
    status: str
    pesan: str
    nama: str | None = None
    satuan_kerja: str | None = None
    alasan_penolakan: str | None = None
