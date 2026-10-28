import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

KOMDIGI_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@komdigi\.go\.id$", re.IGNORECASE)


class PenggunaDaftar(BaseModel):
    nama: str = Field(..., min_length=2, max_length=255, description="Nama Lengkap Pegawai")
    username: str | None = Field(
        default=None, max_length=100, description="Opsional (otomatis dari email)"
    )
    nip: str = Field(..., min_length=9, max_length=50, description="Nomor Induk Pegawai (NIP)")
    email: str = Field(..., description="Alamat email kedinasan wajib @komdigi.go.id")
    satuan_kerja: str = Field(..., min_length=2, max_length=255, description="Satuan Kerja asal")
    password: str = Field(..., min_length=6, max_length=100)
    peran: str = Field(default="ANALIS", pattern="^(ANALIS|KOORDINATOR|ADMIN)$")
    instansi: str = Field(default="Kementerian Komunikasi dan Digital", max_length=255)

    @field_validator("email")
    @classmethod
    def validasi_email_komdigi(cls, v: str) -> str:
        clean = v.strip().lower()
        if not KOMDIGI_EMAIL_REGEX.match(clean):
            raise ValueError(
                "Wajib menggunakan alamat email kedinasan resmi berdomain @komdigi.go.id"
            )
        return clean


class VerifikasiOtpPayload(BaseModel):
    email: str = Field(..., description="Alamat email @komdigi.go.id yang didaftarkan")
    kode_otp: str = Field(
        ..., min_length=6, max_length=6, pattern=r"^\d{6}$", description="6 digit kode OTP"
    )


class KirimUlangOtpPayload(BaseModel):
    email: str = Field(..., description="Alamat email @komdigi.go.id yang didaftarkan")


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
    butuh_verifikasi_otp: bool = False
    email_terkirim_smtp: bool = False
    kode_otp_simulasi: str | None = None
