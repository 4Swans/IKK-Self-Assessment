from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.pengguna import Pengguna, StatusVerifikasi
from app.schemas.auth import (
    KirimUlangOtpPayload,
    PenggunaBaca,
    PenggunaDaftar,
    PenggunaMasuk,
    RegistrasiRespon,
    TokenRespon,
    VerifikasiOtpPayload,
)
from app.services.email_otp import generate_kode_otp, kirim_email_otp

router = APIRouter(prefix="/auth", tags=["Autentikasi"])


@router.post(
    "/daftar",
    response_model=RegistrasiRespon,
    status_code=status.HTTP_201_CREATED,
)
async def daftar(
    payload: PenggunaDaftar,
    db: AsyncSession = Depends(get_db),
) -> RegistrasiRespon:
    """
    Registrasi mandiri pegawai Satker (langsung masuk antrean verifikasi
    Admin/Koordinator tanpa OTP email).
    """
    clean_nip = payload.nip.strip()
    clean_email = (
        payload.email.strip().lower() if payload.email and payload.email.strip() else None
    )

    username = (
        payload.username.strip().lower()
        if payload.username and payload.username.strip()
        else f"satker_{clean_nip[-6:]}"
    )

    # Periksa Username duplikat
    stmt_u = select(Pengguna).where(Pengguna.username == username)
    res_u = await db.execute(stmt_u)
    if res_u.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{username}' sudah digunakan. Silakan pilih username lain.",
        )

    # Periksa NIP duplikat
    stmt_nip = select(Pengguna).where(Pengguna.nip == clean_nip)
    res_nip = await db.execute(stmt_nip)
    if res_nip.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"NIP {clean_nip} sudah terdaftar dalam sistem.",
        )

    # Periksa Email duplikat jika diisi
    if clean_email:
        stmt_e = select(Pengguna).where(Pengguna.email == clean_email)
        res_e = await db.execute(stmt_e)
        if res_e.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Alamat email ini sudah terdaftar dalam sistem.",
            )

    user = Pengguna(
        nama=payload.nama.strip(),
        username=username,
        email=clean_email,
        nip=clean_nip,
        satuan_kerja=payload.satuan_kerja.strip(),
        status_verifikasi=StatusVerifikasi.MENUNGGU_VERIFIKASI,
        email_terverifikasi=True,
        kode_otp=None,
        otp_kadaluarsa_pada=None,
        password_hash=hash_password(payload.password),
        peran=payload.peran,
        instansi=payload.instansi,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return RegistrasiRespon(
        pesan=(
            "Pendaftaran akun berhasil dikirim! Akun Anda kini berada di antrean "
            "persetujuan Admin / Koordinator PUSAKA untuk validasi Satuan Kerja."
        ),
        pengguna=PenggunaBaca.model_validate(user),
        status_verifikasi=user.status_verifikasi,
        butuh_verifikasi_otp=False,
        email_terkirim_smtp=False,
        kode_otp_simulasi=None,
    )


@router.post("/verifikasi-otp", response_model=RegistrasiRespon)
async def verifikasi_otp(
    payload: VerifikasiOtpPayload,
    db: AsyncSession = Depends(get_db),
) -> RegistrasiRespon:
    """
    Memverifikasi 6 digit kode OTP email @komdigi.go.id, lalu meneruskan akun ke antrean
    persetujuan Admin/Koordinator (Human-in-the-Loop).
    """
    clean_email = payload.email.strip().lower()
    stmt = select(Pengguna).where(Pengguna.email == clean_email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Akun dengan alamat email kedinasan tersebut tidak ditemukan.",
        )

    if user.email_terverifikasi and user.status_verifikasi != StatusVerifikasi.MENUNGGU_OTP_EMAIL:
        return RegistrasiRespon(
            pesan="Email kedinasan Anda sudah terverifikasi sebelumnya.",
            pengguna=PenggunaBaca.model_validate(user),
            status_verifikasi=user.status_verifikasi,
            butuh_verifikasi_otp=False,
        )

    now = datetime.now(UTC)
    if (
        not user.kode_otp
        or user.kode_otp != payload.kode_otp.strip()
        or not user.otp_kadaluarsa_pada
        or user.otp_kadaluarsa_pada < now
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Kode OTP tidak sesuai atau telah kedaluwarsa (lebih dari 10 menit). "
                "Silakan periksa kembali atau klik Kirim Ulang Kode OTP."
            ),
        )

    user.email_terverifikasi = True
    user.status_verifikasi = StatusVerifikasi.MENUNGGU_VERIFIKASI
    user.kode_otp = None
    user.otp_kadaluarsa_pada = None

    await db.commit()
    await db.refresh(user)

    return RegistrasiRespon(
        pesan=(
            "Verifikasi email @komdigi.go.id berhasil! Akun Anda kini diteruskan ke "
            "Admin / Koordinator PUSAKA untuk validasi kesesuaian Satuan Kerja."
        ),
        pengguna=PenggunaBaca.model_validate(user),
        status_verifikasi=user.status_verifikasi,
        butuh_verifikasi_otp=False,
    )


@router.post("/kirim-ulang-otp", response_model=RegistrasiRespon)
async def kirim_ulang_otp(
    payload: KirimUlangOtpPayload,
    db: AsyncSession = Depends(get_db),
) -> RegistrasiRespon:
    """Mengirimkan ulang 6 digit kode OTP baru ke alamat email @komdigi.go.id."""
    clean_email = payload.email.strip().lower()
    stmt = select(Pengguna).where(Pengguna.email == clean_email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Akun dengan alamat email kedinasan tersebut tidak ditemukan.",
        )

    if user.status_verifikasi != StatusVerifikasi.MENUNGGU_OTP_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email akun ini sudah terverifikasi sebelumnya.",
        )

    otp = generate_kode_otp()
    user.kode_otp = otp
    user.otp_kadaluarsa_pada = datetime.now(UTC) + timedelta(minutes=10)
    await db.commit()
    await db.refresh(user)

    terkirim_smtp = await kirim_email_otp(
        email_tujuan=clean_email,
        nama=user.nama,
        satuan_kerja=user.satuan_kerja,
        kode_otp=otp,
    )
    kode_simulasi = otp if (not terkirim_smtp and settings.ENVIRONMENT != "production") else None

    return RegistrasiRespon(
        pesan=f"Kode OTP baru telah dikirimkan ulang ke {clean_email}.",
        pengguna=PenggunaBaca.model_validate(user),
        status_verifikasi=user.status_verifikasi,
        butuh_verifikasi_otp=True,
        email_terkirim_smtp=terkirim_smtp,
        kode_otp_simulasi=kode_simulasi,
    )


@router.post("/masuk", response_model=TokenRespon)
async def masuk(
    payload: PenggunaMasuk,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenRespon:
    kredensial = payload.username.strip().lower()
    stmt = select(Pengguna).where(
        (Pengguna.username == kredensial) | (Pengguna.email == kredensial)
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email kedinasan / nama pengguna atau kata sandi tidak cocok.",
        )

    if user.status_verifikasi == StatusVerifikasi.MENUNGGU_OTP_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Email kedinasan ({user.email}) belum diverifikasi dengan kode OTP. "
                "Silakan selesaikan verifikasi kode OTP terlebih dahulu."
            ),
        )

    if user.status_verifikasi == StatusVerifikasi.MENUNGGU_VERIFIKASI:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Email kedinasan Anda sudah terverifikasi, namun akun sedang menunggu "
                "persetujuan Admin / Koordinator PUSAKA untuk validasi Satuan Kerja."
            ),
        )

    if user.status_verifikasi == StatusVerifikasi.DITOLAK:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pendaftaran akun Anda ditolak oleh Admin / Koordinator PUSAKA.",
        )

    token = create_access_token(
        {
            "sub": str(user.id),
            "peran": user.peran,
            "instansi": user.instansi,
            "satuan_kerja": user.satuan_kerja,
        }
    )

    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=60 * 60 * 24,
    )

    return TokenRespon(access_token=token, pengguna=PenggunaBaca.model_validate(user))


@router.get("/saya", response_model=PenggunaBaca)
async def ambil_profil_saya(current_user: Pengguna = Depends(get_current_user)) -> PenggunaBaca:
    return PenggunaBaca.model_validate(current_user)


@router.post("/keluar")
async def keluar(response: Response) -> dict[str, str]:
    response.delete_cookie(key="session_token")
    return {"pesan": "Berhasil keluar dari sistem."}
