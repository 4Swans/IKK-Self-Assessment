from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.rate_limit import rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.models.pengguna import Pengguna, PeranPengguna, StatusVerifikasi
from app.schemas.auth import (
    PenggunaBaca,
    PenggunaDaftar,
    PenggunaMasuk,
    RegistrasiRespon,
    StatusPendaftaranRespon,
    TokenRespon,
)

router = APIRouter(prefix="/auth", tags=["Autentikasi"])


@router.post(
    "/daftar",
    response_model=RegistrasiRespon,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(15, 60, "auth_daftar"))],
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
    clean_email = payload.email.strip().lower() if payload.email and payload.email.strip() else None

    username = (
        payload.username.strip().lower()
        if payload.username and payload.username.strip()
        else f"satker_{clean_nip[-6:]}"
    )

    # Periksa Username duplikat
    stmt_u = select(Pengguna).where(Pengguna.username == username)
    res_u = await db.execute(stmt_u)
    existing_u = res_u.scalars().first()
    if existing_u:
        if existing_u.status_verifikasi == StatusVerifikasi.DITOLAK:
            # Akun lama ditolak: hapus akun lama agar pendaftaran baru dapat diproses
            await db.delete(existing_u)
            await db.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{username}' sudah digunakan. Silakan pilih username lain.",
            )

    # Periksa NIP duplikat
    stmt_nip = select(Pengguna).where(Pengguna.nip == clean_nip)
    res_nip = await db.execute(stmt_nip)
    existing_nip = res_nip.scalars().first()
    if existing_nip:
        if existing_nip.status_verifikasi == StatusVerifikasi.DITOLAK:
            # Akun lama ditolak: hapus akun lama agar pendaftaran baru dapat diproses
            await db.delete(existing_nip)
            await db.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"NIP {clean_nip} sudah terdaftar dalam sistem.",
            )

    # Periksa Email duplikat jika diisi
    if clean_email:
        stmt_e = select(Pengguna).where(Pengguna.email == clean_email)
        res_e = await db.execute(stmt_e)
        existing_e = res_e.scalars().first()
        if existing_e:
            if existing_e.status_verifikasi == StatusVerifikasi.DITOLAK:
                await db.delete(existing_e)
                await db.flush()
            else:
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
        password_hash=hash_password(payload.password),
        peran=PeranPengguna.ANALIS,
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
    )


@router.get(
    "/status-pendaftaran",
    response_model=StatusPendaftaranRespon,
    dependencies=[Depends(rate_limit(30, 60, "auth_status_pendaftaran"))],
)
async def cek_status_pendaftaran(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> StatusPendaftaranRespon:
    """Mengecek status verifikasi pendaftaran akun secara berkala tanpa membocorkan PII."""
    clean_username = username.strip().lower()
    stmt = select(Pengguna).where(Pengguna.username == clean_username)
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user:
        return StatusPendaftaranRespon(
            username=clean_username,
            status="DITOLAK",
            pesan="Pendaftaran akun tidak ditemukan atau telah ditolak oleh Admin / Koordinator.",
        )

    if user.status_verifikasi == StatusVerifikasi.AKTIF:
        return StatusPendaftaranRespon(
            username=clean_username,
            status="AKTIF",
            pesan="Akun Anda telah disetujui dan aktif.",
        )

    if user.status_verifikasi == StatusVerifikasi.DITOLAK:
        return StatusPendaftaranRespon(
            username=clean_username,
            status="DITOLAK",
            pesan="Pendaftaran akun ditolak oleh Admin / Koordinator.",
            alasan_penolakan=user.catatan_penolakan,
        )

    return StatusPendaftaranRespon(
        username=clean_username,
        status="MENUNGGU",
        pesan="Pendaftaran akun sedang menunggu persetujuan Admin / Koordinator PUSAKA.",
    )


@router.post(
    "/masuk",
    response_model=TokenRespon,
    dependencies=[Depends(rate_limit(30, 60, "auth_masuk"))],
)
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
    user = res.scalars().first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email kedinasan / nama pengguna atau kata sandi tidak cocok.",
        )

    if user.status_verifikasi == StatusVerifikasi.MENUNGGU_VERIFIKASI:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Pendaftaran akun Anda sedang menunggu persetujuan Admin / "
                "Koordinator PUSAKA untuk validasi Satuan Kerja."
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
