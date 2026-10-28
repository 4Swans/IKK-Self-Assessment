import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class PenggunaBaca(BaseModel):
    id: uuid.UUID
    nama: str
    username: str
    email: str | None = None
    nip: str | None = None
    satuan_kerja: str
    status_verifikasi: str
    email_terverifikasi: bool = False
    peran: str
    instansi: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PenggunaBuat(BaseModel):
    nama: str = Field(..., min_length=2, max_length=255)
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr | None = None
    nip: str | None = Field(default=None, max_length=50)
    satuan_kerja: str = Field(default="Pusat Kebijakan Strategis (PUSAKA)", max_length=255)
    status_verifikasi: str = Field(
        default="AKTIF", pattern="^(MENUNGGU_OTP_EMAIL|MENUNGGU_VERIFIKASI|AKTIF|DITOLAK)$"
    )
    password: str = Field(..., min_length=6, max_length=100)
    peran: str = Field(default="ANALIS", pattern="^(ANALIS|KOORDINATOR|ADMIN)$")
    instansi: str = Field(default="Kementerian Komunikasi dan Digital", max_length=255)


class PenggunaUbah(BaseModel):
    nama: str | None = Field(default=None, min_length=2, max_length=255)
    username: str | None = Field(default=None, min_length=3, max_length=100)
    email: EmailStr | None = None
    nip: str | None = Field(default=None, max_length=50)
    satuan_kerja: str | None = Field(default=None, max_length=255)
    status_verifikasi: str | None = Field(
        default=None, pattern="^(MENUNGGU_OTP_EMAIL|MENUNGGU_VERIFIKASI|AKTIF|DITOLAK)$"
    )
    peran: str | None = Field(default=None, pattern="^(ANALIS|KOORDINATOR|ADMIN)$")
    instansi: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=6, max_length=100)


class VerifikasiPenggunaPayload(BaseModel):
    status: str = Field(..., pattern="^(AKTIF|DITOLAK)$")
    catatan: str | None = None
