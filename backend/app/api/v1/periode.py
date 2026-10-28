import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.pengguna import Pengguna
from app.models.periode import Periode
from app.schemas.periode import PeriodeBaca, PeriodeBuat, PeriodeUbah

router = APIRouter(prefix="/periode", tags=["Periode"])


@router.post(
    "",
    response_model=PeriodeBaca,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["KOORDINATOR", "ADMIN"]))],
)
async def buat_periode(
    payload: PeriodeBuat,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PeriodeBaca:
    # Periksa apakah periode untuk instansi & tahun ini sudah ada
    stmt = select(Periode).where(
        Periode.instansi == payload.instansi, Periode.tahun == payload.tahun
    )
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Periode {payload.tahun} untuk instansi '{payload.instansi}' sudah terdaftar.",
        )

    periode = Periode(
        instansi=payload.instansi,
        tahun=payload.tahun,
        instrumen_id=payload.instrumen_id,
        melibatkan_jfak=payload.melibatkan_jfak,
        tautan_surat_penunjukan=payload.tautan_surat_penunjukan,
    )
    db.add(periode)
    await db.commit()
    await db.refresh(periode)

    return PeriodeBaca.model_validate(periode)


@router.get("", response_model=list[PeriodeBaca])
async def daftar_periode(
    tahun: int | None = None,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PeriodeBaca]:
    stmt = select(Periode)
    if current_user.peran != "ADMIN":
        stmt = stmt.where(
            or_(
                Periode.instansi == current_user.instansi,
                Periode.instansi.in_(["Kementerian Komunikasi dan Digital", "Kementerian Xaka"]),
            )
        )
    if tahun:
        stmt = stmt.where(Periode.tahun == tahun)

    stmt = stmt.order_by(Periode.tahun.desc())
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [PeriodeBaca.model_validate(item) for item in items]


@router.get("/{periode_id}", response_model=PeriodeBaca)
async def detail_periode(
    periode_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PeriodeBaca:
    stmt = select(Periode).where(Periode.id == periode_id)
    res = await db.execute(stmt)
    periode = res.scalar_one_or_none()

    if not periode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Periode tidak ditemukan.",
        )

    if current_user.peran != "ADMIN" and periode.instansi != current_user.instansi:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki akses ke periode instansi lain.",
        )

    return PeriodeBaca.model_validate(periode)


@router.put(
    "/{periode_id}",
    response_model=PeriodeBaca,
    dependencies=[Depends(require_roles(["KOORDINATOR", "ADMIN"]))],
)
async def ubah_periode(
    periode_id: uuid.UUID,
    payload: PeriodeUbah,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PeriodeBaca:
    stmt = select(Periode).where(Periode.id == periode_id)
    res = await db.execute(stmt)
    periode = res.scalar_one_or_none()

    if not periode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Periode tidak ditemukan.",
        )

    if current_user.peran != "ADMIN" and periode.instansi != current_user.instansi:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki akses ke periode instansi lain.",
        )

    if payload.melibatkan_jfak is not None:
        periode.melibatkan_jfak = payload.melibatkan_jfak
    if payload.tautan_surat_penunjukan is not None:
        periode.tautan_surat_penunjukan = payload.tautan_surat_penunjukan

    await db.commit()
    await db.refresh(periode)
    return PeriodeBaca.model_validate(periode)
