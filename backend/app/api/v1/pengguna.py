import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password
from app.models.pengguna import Pengguna, StatusVerifikasi
from app.schemas.pengguna import (
    PenggunaBaca,
    PenggunaBuat,
    PenggunaUbah,
    VerifikasiPenggunaPayload,
)

router = APIRouter(prefix="/pengguna", tags=["Manajemen Pengguna"])


@router.get(
    "",
    response_model=list[PenggunaBaca],
    dependencies=[Depends(require_roles(["ADMIN", "KOORDINATOR"]))],
)
async def daftar_pengguna(
    db: AsyncSession = Depends(get_db),
) -> list[PenggunaBaca]:
    """Mengambil daftar seluruh pengguna sistem (Koordinator & Administrator)."""
    stmt = select(Pengguna).order_by(Pengguna.created_at.desc())
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [PenggunaBaca.model_validate(p) for p in items]


@router.get(
    "/menunggu-verifikasi",
    response_model=list[PenggunaBaca],
    dependencies=[Depends(require_roles(["ADMIN", "KOORDINATOR"]))],
)
async def daftar_pengguna_menunggu_verifikasi(
    db: AsyncSession = Depends(get_db),
) -> list[PenggunaBaca]:
    """Mengambil daftar pengguna baru yang menunggu verifikasi dari Koordinator Pusaka."""
    stmt = (
        select(Pengguna)
        .where(Pengguna.status_verifikasi == StatusVerifikasi.MENUNGGU_VERIFIKASI)
        .order_by(Pengguna.created_at.desc())
    )
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [PenggunaBaca.model_validate(p) for p in items]


@router.post(
    "/{pengguna_id}/verifikasi",
    response_model=PenggunaBaca,
    dependencies=[Depends(require_roles(["ADMIN", "KOORDINATOR"]))],
)
async def verifikasi_pengguna(
    pengguna_id: uuid.UUID,
    payload: VerifikasiPenggunaPayload,
    db: AsyncSession = Depends(get_db),
) -> PenggunaBaca:
    """Verifikasi pengguna (menyetujui 'AKTIF' atau menolak 'DITOLAK' pendaftaran satker)."""
    stmt = select(Pengguna).where(Pengguna.id == pengguna_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pengguna tidak ditemukan.",
        )

    user.status_verifikasi = payload.status
    await db.commit()
    await db.refresh(user)
    return PenggunaBaca.model_validate(user)


@router.post(
    "",
    response_model=PenggunaBaca,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def buat_pengguna(
    payload: PenggunaBuat,
    db: AsyncSession = Depends(get_db),
) -> PenggunaBaca:
    """Membuat pengguna baru oleh Administrator."""
    # Cek username duplikat
    stmt_u = select(Pengguna).where(Pengguna.username == payload.username)
    res_u = await db.execute(stmt_u)
    if res_u.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nama pengguna (username) sudah terdaftar dalam sistem.",
        )

    # Cek email duplikat jika ada
    if payload.email:
        stmt_e = select(Pengguna).where(Pengguna.email == payload.email)
        res_e = await db.execute(stmt_e)
        if res_e.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Alamat email sudah terdaftar dalam sistem.",
            )

    user = Pengguna(
        nama=payload.nama,
        username=payload.username,
        email=payload.email,
        nip=payload.nip,
        satuan_kerja=payload.satuan_kerja,
        status_verifikasi=payload.status_verifikasi,
        email_terverifikasi=True,
        password_hash=hash_password(payload.password),
        peran=payload.peran,
        instansi=payload.instansi,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return PenggunaBaca.model_validate(user)


@router.get(
    "/{pengguna_id}",
    response_model=PenggunaBaca,
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def detail_pengguna(
    pengguna_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> PenggunaBaca:
    """Mengambil detail profil pengguna."""
    stmt = select(Pengguna).where(Pengguna.id == pengguna_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pengguna tidak ditemukan.",
        )
    return PenggunaBaca.model_validate(user)


@router.put(
    "/{pengguna_id}",
    response_model=PenggunaBaca,
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def ubah_pengguna(
    pengguna_id: uuid.UUID,
    payload: PenggunaUbah,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PenggunaBaca:
    """Mengubah data pengguna atau menyetel ulang kata sandi (Khusus Administrator)."""
    stmt = select(Pengguna).where(Pengguna.id == pengguna_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pengguna tidak ditemukan.",
        )

    # Proteksi Sesama Admin: Admin tidak boleh mengedit akun Admin lainnya
    if user.peran == "ADMIN" and user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Akses ditolak. Sesama Administrator tidak diizinkan mengubah data "
                "atau kata sandi akun Administrator lainnya."
            ),
        )

    # Proteksi Self-Lockout: Admin tidak boleh menurunkan perannya sendiri
    if user.id == current_user.id and payload.peran is not None and payload.peran != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Anda tidak dapat mengubah atau menurunkan peran Administrator akun Anda sendiri."
            ),
        )

    # Validasi username unik jika diubah
    if payload.username and payload.username != user.username:
        stmt_u = select(Pengguna).where(Pengguna.username == payload.username)
        res_u = await db.execute(stmt_u)
        if res_u.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nama pengguna (username) sudah digunakan oleh akun lain.",
            )
        user.username = payload.username

    # Validasi email unik jika diubah
    if payload.email and payload.email != user.email:
        stmt_e = select(Pengguna).where(Pengguna.email == payload.email)
        res_e = await db.execute(stmt_e)
        if res_e.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Alamat email sudah digunakan oleh akun lain.",
            )
        user.email = payload.email

    if payload.nama is not None:
        user.nama = payload.nama
    if payload.nip is not None:
        user.nip = payload.nip
    if payload.satuan_kerja is not None:
        user.satuan_kerja = payload.satuan_kerja
    if payload.status_verifikasi is not None:
        user.status_verifikasi = payload.status_verifikasi
    if payload.peran is not None:
        user.peran = payload.peran
    if payload.instansi is not None:
        user.instansi = payload.instansi
    if payload.password is not None and payload.password.strip():
        user.password_hash = hash_password(payload.password)

    await db.commit()
    await db.refresh(user)
    return PenggunaBaca.model_validate(user)


@router.delete(
    "/{pengguna_id}",
    response_model=dict[str, str],
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def hapus_pengguna(
    pengguna_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Menghapus akun pengguna (Admin tidak dapat menghapus akun sendiri atau sesama Admin)."""
    if current_user.id == pengguna_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anda tidak dapat menghapus akun Anda sendiri.",
        )

    stmt = select(Pengguna).where(Pengguna.id == pengguna_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pengguna tidak ditemukan.",
        )

    if user.peran == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Akses ditolak. Sesama Administrator tidak dapat menghapus "
                "akun Administrator lainnya."
            ),
        )

    try:
        await db.delete(user)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Akun '{user.nama}' tidak dapat dihapus karena masih terhubung dengan "
                "data asesmen kebijakan atau log riwayat penilaian aktif. "
                "Silakan ubah status akun menjadi DITOLAK melalui menu Edit."
            ),
        ) from None
    return {"pesan": f"Akun pengguna '{user.nama}' ({user.username}) berhasil dihapus."}
