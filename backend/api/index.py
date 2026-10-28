import sys
from pathlib import Path

# Pastikan direktori backend terdaftar di sys.path saat dijalankan oleh Vercel Serverless
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app  # noqa: E402

__all__ = ["app"]
