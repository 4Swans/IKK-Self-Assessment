import os
import re
from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import pypdf
from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from pypdf.errors import PdfReadError

from app.core.config import settings

CANONICAL_MIME_BY_EXT: dict[str, str] = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".txt": "text/plain; charset=utf-8",
}


def bersihkan_nama_berkas(nama_asli: str | None, fallback: str = "dokumen") -> str:
    """Ambil nama file dasar tanpa path dan bersihkan karakter berbahaya."""
    base = Path(nama_asli or fallback).name.strip()
    cleaned = re.sub(r'[\x00-\x1f\x7f"\\/;<>|?*]+', "_", base)
    return cleaned[:200] or fallback


def periksa_lapisan_teks_pdf(contents: bytes) -> bool:
    """Periksa apakah PDF memiliki lapisan teks yang dapat dibaca mesin (bukan scan murni)."""
    try:
        reader = pypdf.PdfReader(BytesIO(contents))
    except PdfReadError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Berkas PDF rusak atau format PDF tidak valid.",
        ) from None
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Berkas PDF tidak dapat diproses. Pastikan berkas tidak rusak.",
        ) from None

    if reader.is_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Berkas PDF dilindungi kata sandi. Harap hapus proteksi kata sandi terlebih dahulu."
            ),
        )

    for page in reader.pages:
        try:
            teks = page.extract_text() or ""
        except Exception:
            teks = ""
        if teks.strip():
            return True
    return False


async def validasi_dan_baca_berkas(
    file: UploadFile,
    allowed_exts: set[str],
    max_mb: int,
    pesan_format_salah: str | None = None,
) -> tuple[bytes, str, str, str, bool]:
    """
    Validasi ekstensi, ukuran, magic bytes, dan lapisan teks PDF.
    Mengembalikan tuple: (contents, safe_display_name, ext, canonical_mime, ada_lapisan_teks).
    """
    raw_name = file.filename or "dokumen"
    ext = Path(raw_name).suffix.lower()
    if ext not in allowed_exts:
        daftar = ", ".join(sorted(allowed_exts))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=pesan_format_salah
            or f"Format berkas tidak didukung ({ext}). Gunakan format: {daftar}.",
        )

    contents = await file.read()
    ukuran = len(contents)
    if ukuran == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Berkas yang diunggah kosong (0 byte).",
        )
    if ukuran > max_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ukuran berkas melebihi batas maksimum {max_mb} MB.",
        )

    # Validasi magic bytes (isi biner sebenarnya)
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
    if ext in {".doc", ".xls"} and not contents.startswith(b"\xd0\xcf\x11\xe0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Isi berkas bukan merupakan dokumen {ext.upper()} yang valid.",
        )
    if ext == ".txt":
        if b"\x00" in contents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Berkas teks tidak boleh berisi data biner.",
            )
        try:
            contents.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Berkas teks (.txt) harus menggunakan encoding UTF-8 yang valid.",
            ) from None

    ada_lapisan_teks = True
    if ext == ".pdf":
        ada_lapisan_teks = periksa_lapisan_teks_pdf(contents)

    safe_name = bersihkan_nama_berkas(raw_name, fallback=f"dokumen{ext}")
    canonical_mime = CANONICAL_MIME_BY_EXT.get(ext, "application/octet-stream")
    return contents, safe_name, ext, canonical_mime, ada_lapisan_teks


def header_content_disposition(disp_type: str, nama_file: str) -> str:
    """Bangun nilai header Content-Disposition yang aman dari header injection."""
    clean_name = bersihkan_nama_berkas(nama_file, fallback="dokumen")
    ascii_fallback = clean_name.encode("ascii", "ignore").decode("ascii") or "dokumen"
    encoded = quote(clean_name, safe="")
    return f"{disp_type}; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


def path_aman_di_upload_dir(disk_path: str) -> Path | None:
    """Pastikan path berada di dalam UPLOAD_DIR untuk mencegah path traversal."""
    if not disk_path:
        return None
    upload_root = Path(settings.UPLOAD_DIR).resolve()
    candidate = Path(disk_path)

    # Jika path relatif (misal "uploads/abc.pdf" saat UPLOAD_DIR="./uploads"),
    # periksa relatif terhadap CWD terlebih dahulu sebelum digabung dengan upload_root.
    candidates = (
        [candidate]
        if candidate.is_absolute()
        else [Path.cwd() / candidate, upload_root / candidate]
    )

    for cand in candidates:
        try:
            resolved = cand.resolve()
        except OSError:
            continue
        if resolved.is_relative_to(upload_root) and resolved.exists() and resolved.is_file():
            return resolved

    for cand in candidates:
        try:
            resolved = cand.resolve()
        except OSError:
            continue
        if resolved.is_relative_to(upload_root):
            return resolved

    return None


def hapus_berkas_disk_aman(disk_path: str | None) -> None:
    """Hapus berkas lama di disk secara aman jika berada di dalam UPLOAD_DIR."""
    if not disk_path:
        return
    resolved = path_aman_di_upload_dir(disk_path)
    if resolved and resolved.exists() and resolved.is_file():
        try:
            os.remove(resolved)
        except OSError:
            pass


def bangun_response_berkas(
    disk_path: str | None,
    konten: bytes | None,
    nama_file: str,
    mime: str | None,
    not_found_detail: str,
) -> Response:
    """Sajikan berkas unduhan/pratinjau dengan header keamanan MIME dan Content-Disposition."""
    ext = Path(nama_file).suffix.lower()
    effective_mime = CANONICAL_MIME_BY_EXT.get(ext) or "application/octet-stream"
    if mime == "application/pdf" and ext == ".pdf":
        effective_mime = "application/pdf"

    disp_type = "inline" if effective_mime == "application/pdf" else "attachment"
    headers = {
        "Content-Disposition": header_content_disposition(disp_type, nama_file),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    }

    safe_path = path_aman_di_upload_dir(disk_path) if disk_path else None
    if safe_path and safe_path.exists() and safe_path.is_file():
        return FileResponse(
            path=str(safe_path),
            media_type=effective_mime,
            headers=headers,
        )

    if konten is not None:
        return Response(
            content=konten,
            media_type=effective_mime,
            headers=headers,
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=not_found_detail,
    )
