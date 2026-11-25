import hashlib
import os
import uuid
from io import BytesIO
from pathlib import Path

import pypdf
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, undefer

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.asesmen import Asesmen, StatusAsesmen
from app.models.bukti_dukung import BuktiDukung
from app.models.jawaban import Jawaban
from app.models.pengguna import Pengguna
from app.schemas.jawaban import (
    BuktiDukungBaca,
    CatatanKoordinatorSimpan,
    JawabanBaca,
    JawabanSimpan,
)
from app.services.berkas import (
    bangun_response_berkas,
    hapus_berkas_disk_aman,
    path_aman_di_upload_dir,
    periksa_lapisan_teks_pdf,
    validasi_dan_baca_berkas,
)
from app.services.satker import satker_cocok

router = APIRouter(prefix="/jawaban", tags=["Jawaban & Bukti Dukung"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".txt"}


def _cek_akses_asesmen_jawaban(
    asesmen: Asesmen | None,
    current_user: Pengguna,
    perlu_edit: bool = False,
    aksi_label: str = "mengakses",
) -> None:
    """Validasi isolasi Satuan Kerja dan status asesmen yang dapat diedit."""
    if (
        current_user.peran == "ANALIS"
        and asesmen
        and asesmen.kebijakan
        and asesmen.kebijakan.satuan_kerja
        and not satker_cocok(asesmen.kebijakan.satuan_kerja, current_user.satuan_kerja)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Anda tidak memiliki hak akses {aksi_label} kebijakan dari satuan kerja lain."
            ),
        )

    if (
        perlu_edit
        and asesmen
        and asesmen.status
        not in [
            StatusAsesmen.DRAF,
            StatusAsesmen.PERLU_PERBAIKAN,
        ]
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Jawaban tidak dapat diubah pada asesmen dengan status {asesmen.status}.",
        )


@router.put("/{asesmen_id}/{pertanyaan_id}", response_model=JawabanBaca)
async def simpan_jawaban(
    asesmen_id: uuid.UUID,
    pertanyaan_id: uuid.UUID,
    payload: JawabanSimpan,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JawabanBaca:
    # Periksa status asesmen dan kepemilikan satker
    stmt_a = (
        select(Asesmen).where(Asesmen.id == asesmen_id).options(selectinload(Asesmen.kebijakan))
    )
    res_a = await db.execute(stmt_a)
    asesmen = res_a.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    _cek_akses_asesmen_jawaban(asesmen, current_user, perlu_edit=True, aksi_label="mengubah")

    # Ambil atau buat jawaban
    stmt_j = (
        select(Jawaban)
        .where(Jawaban.asesmen_id == asesmen_id, Jawaban.pertanyaan_id == pertanyaan_id)
        .options(selectinload(Jawaban.bukti_dukung_list))
    )
    res_j = await db.execute(stmt_j)
    jawaban = res_j.scalars().first()

    if not jawaban:
        jawaban = Jawaban(
            asesmen_id=asesmen_id,
            pertanyaan_id=pertanyaan_id,
            opsi_id=payload.opsi_id,
            penjelasan=payload.penjelasan,
            tautan_bukti=payload.tautan_bukti,
            akses_publik_dicek=payload.akses_publik_dicek,
        )
        db.add(jawaban)
    else:
        if "opsi_id" in payload.model_fields_set:
            jawaban.opsi_id = payload.opsi_id
        if "penjelasan" in payload.model_fields_set:
            jawaban.penjelasan = payload.penjelasan
        if "tautan_bukti" in payload.model_fields_set:
            jawaban.tautan_bukti = payload.tautan_bukti
        if "akses_publik_dicek" in payload.model_fields_set:
            jawaban.akses_publik_dicek = payload.akses_publik_dicek

    await db.commit()

    # Ambil ulang jawaban lengkap beserta relasi bukti_dukung_list
    # untuk menghindari MissingGreenlet di AsyncSession
    stmt_reload = (
        select(Jawaban)
        .where(Jawaban.id == jawaban.id)
        .options(selectinload(Jawaban.bukti_dukung_list))
    )
    res_reload = await db.execute(stmt_reload)
    jawaban_lengkap = res_reload.scalar_one()
    return JawabanBaca.model_validate(jawaban_lengkap)


@router.put(
    "/{asesmen_id}/{pertanyaan_id}/catatan-koordinator",
    response_model=JawabanBaca,
    dependencies=[Depends(require_roles(["KOORDINATOR", "ADMIN"]))],
)
async def simpan_catatan_koordinator(
    asesmen_id: uuid.UUID,
    pertanyaan_id: uuid.UUID,
    payload: CatatanKoordinatorSimpan,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JawabanBaca:
    """Menyimpan catatan verifikasi Koordinator per pertanyaan (indikator)."""
    stmt_a = select(Asesmen).where(Asesmen.id == asesmen_id)
    res_a = await db.execute(stmt_a)
    asesmen = res_a.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    stmt_j = (
        select(Jawaban)
        .where(Jawaban.asesmen_id == asesmen_id, Jawaban.pertanyaan_id == pertanyaan_id)
        .options(selectinload(Jawaban.bukti_dukung_list))
    )
    res_j = await db.execute(stmt_j)
    jawaban = res_j.scalars().first()

    if not jawaban:
        jawaban = Jawaban(
            asesmen_id=asesmen_id,
            pertanyaan_id=pertanyaan_id,
            catatan_koordinator=payload.catatan_koordinator,
        )
        db.add(jawaban)
    else:
        jawaban.catatan_koordinator = payload.catatan_koordinator

    await db.commit()

    stmt_reload = (
        select(Jawaban)
        .where(Jawaban.id == jawaban.id)
        .options(selectinload(Jawaban.bukti_dukung_list))
    )
    res_reload = await db.execute(stmt_reload)
    jawaban_lengkap = res_reload.scalar_one()
    return JawabanBaca.model_validate(jawaban_lengkap)


@router.post("/{jawaban_id}/unggah-bukti", response_model=BuktiDukungBaca)
async def unggah_bukti_dukung(
    jawaban_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BuktiDukungBaca:
    stmt_j = (
        select(Jawaban)
        .where(Jawaban.id == jawaban_id)
        .options(selectinload(Jawaban.asesmen).selectinload(Asesmen.kebijakan))
    )
    res_j = await db.execute(stmt_j)
    jawaban = res_j.scalar_one_or_none()
    if not jawaban:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Jawaban tidak ditemukan."
        )

    _cek_akses_asesmen_jawaban(
        jawaban.asesmen,
        current_user,
        perlu_edit=True,
        aksi_label="mengunggah bukti pada",
    )

    (
        contents,
        safe_display_name,
        ext,
        canonical_mime,
        ada_lapisan_teks,
    ) = await validasi_dan_baca_berkas(
        file,
        allowed_exts=ALLOWED_EXTENSIONS,
        max_mb=settings.MAX_UPLOAD_MB,
        pesan_format_salah=(
            f"Format file tidak didukung ({Path(file.filename or '').suffix.lower()}). "
            "Harap gunakan berkas dokumen PDF, Word, Excel, atau Teks "
            "(.pdf, .docx, .doc, .xlsx, .txt)."
        ),
    )

    sha256_hash = hashlib.sha256(contents).hexdigest()

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    nama_simpan = f"{uuid.uuid4()}{ext}"
    target_path = Path(settings.UPLOAD_DIR) / nama_simpan
    with open(target_path, "wb") as f:
        f.write(contents)

    bukti = BuktiDukung(
        jawaban_id=jawaban_id,
        nama_file=safe_display_name,
        path=str(target_path),
        mime=canonical_mime,
        ukuran=len(contents),
        sha256=sha256_hash,
        ada_lapisan_teks=ada_lapisan_teks,
        konten=contents if settings.SIMPAN_KONTEN_DB else None,
    )
    db.add(bukti)
    await db.commit()
    await db.refresh(bukti)

    return BuktiDukungBaca.model_validate(bukti)


@router.post("/{jawaban_id}/gabung-pdf", response_model=BuktiDukungBaca)
async def gabung_pdf_bukti(
    jawaban_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BuktiDukungBaca:
    """Menggabungkan seluruh bukti berformat PDF pada satu jawaban menjadi satu PDF utuh."""
    stmt_j = (
        select(Jawaban)
        .where(Jawaban.id == jawaban_id)
        .options(
            selectinload(Jawaban.asesmen).selectinload(Asesmen.kebijakan),
            selectinload(Jawaban.bukti_dukung_list).undefer(BuktiDukung.konten),
        )
    )
    res_j = await db.execute(stmt_j)
    jawaban = res_j.scalar_one_or_none()
    if not jawaban:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Jawaban tidak ditemukan."
        )

    _cek_akses_asesmen_jawaban(
        jawaban.asesmen,
        current_user,
        perlu_edit=True,
        aksi_label="menggabungkan bukti pada",
    )

    pdf_sources: list[str | BytesIO] = []
    for b in jawaban.bukti_dukung_list:
        if not b.nama_file.lower().endswith(".pdf"):
            continue
        safe_path = path_aman_di_upload_dir(b.path)
        if safe_path and safe_path.exists():
            pdf_sources.append(str(safe_path))
        elif b.konten:
            pdf_sources.append(BytesIO(b.konten))

    if len(pdf_sources) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimal diperlukan 2 file PDF yang tersedia untuk digabungkan.",
        )

    writer = pypdf.PdfWriter()
    try:
        for src in pdf_sources:
            writer.append(src)
        buf = BytesIO()
        writer.write(buf)
        data = buf.getvalue()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gagal menggabungkan PDF. Pastikan tidak ada berkas PDF yang rusak/terkunci.",
        ) from None
    finally:
        writer.close()

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    nama_gabungan = f"gabungan_{uuid.uuid4()}.pdf"
    target_path = Path(settings.UPLOAD_DIR) / nama_gabungan
    with open(target_path, "wb") as f_out:
        f_out.write(data)

    sha256_hash = hashlib.sha256(data).hexdigest()
    ada_lapisan_teks = periksa_lapisan_teks_pdf(data)

    bukti_gabungan = BuktiDukung(
        jawaban_id=jawaban_id,
        nama_file=f"Gabungan_Bukti_{len(pdf_sources)}_File.pdf",
        path=str(target_path),
        mime="application/pdf",
        ukuran=len(data),
        sha256=sha256_hash,
        ada_lapisan_teks=ada_lapisan_teks,
        konten=data if settings.SIMPAN_KONTEN_DB else None,
    )
    db.add(bukti_gabungan)
    await db.commit()
    await db.refresh(bukti_gabungan)

    return BuktiDukungBaca.model_validate(bukti_gabungan)


@router.delete("/bukti/{bukti_id}")
async def hapus_bukti(
    bukti_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    stmt = (
        select(BuktiDukung)
        .where(BuktiDukung.id == bukti_id)
        .options(
            selectinload(BuktiDukung.jawaban)
            .selectinload(Jawaban.asesmen)
            .selectinload(Asesmen.kebijakan),
        )
    )
    res = await db.execute(stmt)
    bukti = res.scalar_one_or_none()
    if not bukti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bukti dukung tidak ditemukan."
        )

    asesmen = bukti.jawaban.asesmen if bukti.jawaban else None
    _cek_akses_asesmen_jawaban(
        asesmen,
        current_user,
        perlu_edit=True,
        aksi_label="menghapus bukti pada",
    )

    hapus_berkas_disk_aman(bukti.path)

    await db.delete(bukti)
    await db.commit()
    return {"pesan": "Bukti dukung berhasil dihapus."}


@router.get("/bukti/{bukti_id}/unduh")
async def unduh_bukti(
    bukti_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Mengunduh atau menampilkan berkas fisik bukti dukung di tab peramban."""
    stmt = (
        select(BuktiDukung)
        .where(BuktiDukung.id == bukti_id)
        .options(
            undefer(BuktiDukung.konten),
            selectinload(BuktiDukung.jawaban)
            .selectinload(Jawaban.asesmen)
            .selectinload(Asesmen.kebijakan),
        )
    )
    res = await db.execute(stmt)
    bukti = res.scalar_one_or_none()
    if not bukti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bukti dukung tidak ditemukan."
        )

    asesmen = bukti.jawaban.asesmen if bukti.jawaban else None
    _cek_akses_asesmen_jawaban(
        asesmen,
        current_user,
        perlu_edit=False,
        aksi_label="mengunduh bukti pada",
    )

    return bangun_response_berkas(
        disk_path=bukti.path,
        konten=bukti.konten,
        nama_file=bukti.nama_file,
        mime=bukti.mime,
        not_found_detail=(
            "File fisik berkas tidak ditemukan di server. "
            "Silakan unggah ulang dokumen bukti dukung."
        ),
    )
