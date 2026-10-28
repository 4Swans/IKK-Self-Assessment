import hashlib
import os
import uuid
from io import BytesIO
from pathlib import Path

import pypdf
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.asesmen import Asesmen, StatusAsesmen
from app.models.bukti_dukung import BuktiDukung
from app.models.jawaban import Jawaban
from app.models.pengguna import Pengguna
from app.schemas.jawaban import BuktiDukungBaca, JawabanBaca, JawabanSimpan

router = APIRouter(prefix="/jawaban", tags=["Jawaban & Bukti Dukung"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".txt"}


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

    # Analis hanya boleh mengubah jawaban untuk kebijakan satkernya sendiri
    if (
        current_user.peran == "ANALIS"
        and asesmen.kebijakan
        and asesmen.kebijakan.satuan_kerja
        and asesmen.kebijakan.satuan_kerja != current_user.satuan_kerja
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki hak akses mengubah asesmen dari satuan kerja lain.",
        )

    # Aturan AGENTS.md 6.7: Analis hanya dapat mengubah jawaban saat
    # status DRAF atau PERLU_PERBAIKAN
    if asesmen.status not in [StatusAsesmen.DRAF, StatusAsesmen.PERLU_PERBAIKAN]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Jawaban tidak dapat diubah pada asesmen dengan status {asesmen.status}.",
        )

    # Ambil atau buat jawaban
    stmt_j = (
        select(Jawaban)
        .where(Jawaban.asesmen_id == asesmen_id, Jawaban.pertanyaan_id == pertanyaan_id)
        .options(selectinload(Jawaban.bukti_dukung_list))
    )
    res_j = await db.execute(stmt_j)
    jawaban = res_j.scalar_one_or_none()

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

    if (
        current_user.peran == "ANALIS"
        and jawaban.asesmen
        and jawaban.asesmen.kebijakan
        and jawaban.asesmen.kebijakan.satuan_kerja
        and jawaban.asesmen.kebijakan.satuan_kerja != current_user.satuan_kerja
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Anda tidak memiliki hak akses mengunggah bukti pada kebijakan "
                "dari satuan kerja lain."
            ),
        )

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Format file tidak didukung ({ext}). Harap gunakan berkas dokumen "
                "PDF, Word, Excel, atau Teks (.pdf, .docx, .doc, .xlsx, .txt)."
            ),
        )

    contents = await file.read()
    ukuran = len(contents)
    if ukuran > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ukuran file melebihi batas maksimum {settings.MAX_UPLOAD_MB} MB.",
        )

    # Validasi isi berkas (magic bytes) sesuai AGENTS.md Bagian 9
    if ext == ".pdf" and not contents.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Isi berkas bukan merupakan dokumen PDF yang valid.",
        )
    if ext in {".docx", ".xlsx"} and not contents.startswith(b"PK\x03\x04"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Isi berkas bukan merupakan dokumen {ext.upper()} yang valid.",
        )
    if ext == ".doc" and not contents.startswith(b"\xd0\xcf\x11\xe0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Isi berkas bukan merupakan dokumen Word (.doc) yang valid.",
        )

    sha256_hash = hashlib.sha256(contents).hexdigest()

    # Cek lapisan teks jika file PDF (pypdf)
    ada_lapisan_teks = True
    if ext == ".pdf":
        try:
            reader = pypdf.PdfReader(BytesIO(contents))
            teks_gabungan = "".join([p.extract_text() or "" for p in reader.pages]).strip()
            ada_lapisan_teks = len(teks_gabungan) > 20
        except Exception:
            ada_lapisan_teks = False

    # Simpan berkas ke disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    nama_simpan = f"{uuid.uuid4()}{ext}"
    target_path = Path(settings.UPLOAD_DIR) / nama_simpan
    with open(target_path, "wb") as f:
        f.write(contents)

    bukti = BuktiDukung(
        jawaban_id=jawaban_id,
        nama_file=file.filename or "dokumen",
        path=str(target_path),
        mime=file.content_type or "application/octet-stream",
        ukuran=ukuran,
        sha256=sha256_hash,
        ada_lapisan_teks=ada_lapisan_teks,
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
    stmt_b = select(BuktiDukung).where(BuktiDukung.jawaban_id == jawaban_id)
    res_b = await db.execute(stmt_b)
    daftar_bukti = res_b.scalars().all()

    pdf_files = [
        b for b in daftar_bukti if b.nama_file.lower().endswith(".pdf") and os.path.exists(b.path)
    ]
    if len(pdf_files) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimal diperlukan 2 file PDF untuk digabungkan.",
        )

    writer = pypdf.PdfWriter()
    for b in pdf_files:
        writer.append(b.path)

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    nama_gabungan = f"gabungan_{uuid.uuid4()}.pdf"
    target_path = Path(settings.UPLOAD_DIR) / nama_gabungan
    with open(target_path, "wb") as f_out:
        writer.write(f_out)
    writer.close()

    stat = target_path.stat()
    with open(target_path, "rb") as f:
        data = f.read()
    sha256_hash = hashlib.sha256(data).hexdigest()

    bukti_gabungan = BuktiDukung(
        jawaban_id=jawaban_id,
        nama_file=f"Gabungan_Bukti_{len(pdf_files)}_File.pdf",
        path=str(target_path),
        mime="application/pdf",
        ukuran=stat.st_size,
        sha256=sha256_hash,
        ada_lapisan_teks=True,
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
            .selectinload(Asesmen.kebijakan)
        )
    )
    res = await db.execute(stmt)
    bukti = res.scalar_one_or_none()
    if not bukti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bukti dukung tidak ditemukan."
        )

    if (
        current_user.peran == "ANALIS"
        and bukti.jawaban
        and bukti.jawaban.asesmen
        and bukti.jawaban.asesmen.kebijakan
        and bukti.jawaban.asesmen.kebijakan.satuan_kerja
        and bukti.jawaban.asesmen.kebijakan.satuan_kerja != current_user.satuan_kerja
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki hak akses menghapus bukti dari satuan kerja lain.",
        )

    if os.path.exists(bukti.path):
        try:
            os.remove(bukti.path)
        except OSError:
            pass

    await db.delete(bukti)
    await db.commit()
    return {"pesan": "Bukti dukung berhasil dihapus."}


@router.get("/bukti/{bukti_id}/unduh")
async def unduh_bukti(
    bukti_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Mengunduh atau menampilkan berkas fisik bukti dukung di tab peramban."""
    stmt = (
        select(BuktiDukung)
        .where(BuktiDukung.id == bukti_id)
        .options(
            selectinload(BuktiDukung.jawaban)
            .selectinload(Jawaban.asesmen)
            .selectinload(Asesmen.kebijakan)
        )
    )
    res = await db.execute(stmt)
    bukti = res.scalar_one_or_none()
    if not bukti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bukti dukung tidak ditemukan."
        )

    if (
        current_user.peran == "ANALIS"
        and bukti.jawaban
        and bukti.jawaban.asesmen
        and bukti.jawaban.asesmen.kebijakan
        and bukti.jawaban.asesmen.kebijakan.satuan_kerja
        and bukti.jawaban.asesmen.kebijakan.satuan_kerja != current_user.satuan_kerja
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki hak akses mengunduh bukti dari satuan kerja lain.",
        )

    if not os.path.exists(bukti.path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File fisik berkas tidak ditemukan di server.",
        )

    return FileResponse(
        path=bukti.path,
        filename=bukti.nama_file,
        media_type=bukti.mime,
        content_disposition_type="inline" if bukti.mime == "application/pdf" else "attachment",
    )
