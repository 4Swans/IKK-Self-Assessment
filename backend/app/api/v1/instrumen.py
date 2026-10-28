from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.instrumen import Dimensi, Instrumen, Pertanyaan
from app.schemas.instrumen import InstrumenBaca

router = APIRouter(prefix="/instrumen", tags=["Instrumen IKK"])


@router.get("/aktif", response_model=InstrumenBaca)
async def ambil_instrumen_aktif(db: AsyncSession = Depends(get_db)) -> InstrumenBaca:
    stmt = (
        select(Instrumen)
        .where(Instrumen.aktif.is_(True))
        .options(
            selectinload(Instrumen.dimensi_list)
            .selectinload(Dimensi.pertanyaan_list)
            .selectinload(Pertanyaan.opsi_list),
            selectinload(Instrumen.ambang_kualifikasi_list),
        )
        .order_by(Instrumen.tahun.desc())
    )
    res = await db.execute(stmt)
    instrumen = res.scalars().first()

    if not instrumen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instrumen IKK aktif belum tersedia di sistem. Silakan muat seed instrumen.",
        )

    return InstrumenBaca.model_validate(instrumen)


@router.get("/tahun/{tahun}", response_model=InstrumenBaca)
async def ambil_instrumen_per_tahun(
    tahun: int, db: AsyncSession = Depends(get_db)
) -> InstrumenBaca:
    stmt = (
        select(Instrumen)
        .where(Instrumen.tahun == tahun)
        .options(
            selectinload(Instrumen.dimensi_list)
            .selectinload(Dimensi.pertanyaan_list)
            .selectinload(Pertanyaan.opsi_list),
            selectinload(Instrumen.ambang_kualifikasi_list),
        )
    )
    res = await db.execute(stmt)
    instrumen = res.scalars().first()

    if not instrumen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrumen IKK tahun {tahun} tidak ditemukan.",
        )

    return InstrumenBaca.model_validate(instrumen)
