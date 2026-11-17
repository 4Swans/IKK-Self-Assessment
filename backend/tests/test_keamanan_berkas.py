from io import BytesIO
from pathlib import Path

import pypdf
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.rate_limit import SlidingWindowRateLimiter
from app.services.berkas import (
    bersihkan_nama_berkas,
    header_content_disposition,
    path_aman_di_upload_dir,
    periksa_lapisan_teks_pdf,
)


def test_sanitasi_nama_dan_content_disposition() -> None:
    nama = '../../evil"\r\nX-Injected: true.pdf'
    bersih = bersihkan_nama_berkas(nama)
    assert "/" not in bersih
    assert "\\" not in bersih
    assert "\r" not in bersih
    assert "\n" not in bersih
    assert '"' not in bersih

    hdr = header_content_disposition("attachment", nama)
    assert "\r" not in hdr
    assert "\n" not in hdr
    assert hdr.startswith("attachment; filename=")


def test_path_traversal_ditolak() -> None:
    assert path_aman_di_upload_dir("../../../etc/passwd") is None
    aman = path_aman_di_upload_dir(str(Path(settings.UPLOAD_DIR) / "contoh.pdf"))
    assert aman is not None


def test_deteksi_lapisan_teks_pdf() -> None:
    # PDF kosong tanpa teks (simulasi scan gambar)
    writer_kosong = pypdf.PdfWriter()
    writer_kosong.add_blank_page(width=200, height=200)
    buf_kosong = BytesIO()
    writer_kosong.write(buf_kosong)
    writer_kosong.close()
    assert periksa_lapisan_teks_pdf(buf_kosong.getvalue()) is False

    # PDF rusak harus ditolak HTTP 400
    with pytest.raises(HTTPException) as exc:
        periksa_lapisan_teks_pdf(b"%PDF-1.4\nrusak_total")
    assert exc.value.status_code == 400


def test_rate_limiter_memblokir_kelebihan_permintaan() -> None:
    limiter = SlidingWindowRateLimiter()
    limiter.check("login:1.2.3.4", max_requests=2, window_seconds=60)
    limiter.check("login:1.2.3.4", max_requests=2, window_seconds=60)
    with pytest.raises(HTTPException) as exc:
        limiter.check("login:1.2.3.4", max_requests=2, window_seconds=60)
    assert exc.value.status_code == 429
