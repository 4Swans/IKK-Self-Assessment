import hashlib
import os
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app import models as _models  # noqa: F401
from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.database import Base, engine
from app.seeds.muat import muat_instrumen
from app.seeds.seed_prod import seed_production_initial_data

_vercel_db_initialized = False
_vercel_init_error: str | None = None

# Khusus Vercel: tabel kecil untuk menyimpan sidik jari seed terakhir yang sudah diterapkan,
# agar seeding penuh tidak diulang di setiap cold start. Tidak dipakai di deploy non-Vercel.
_TABEL_STATUS_SEED = "_vercel_seed_state"
_ID_KUNCI_SEED = 20261102  # ID pg_advisory_lock agar hanya satu instance yang menjalankan seeding
_BERKAS_SEED = ("instrumen_2026.json", "muat.py", "seed_prod.py")


def _hitung_sidik_jari_seed() -> str:
    """Hash isi berkas seed dan daftar tabel/kolom model. Berubah bila seed atau skema berubah."""
    folder_seed = Path(__file__).parent / "seeds"
    h = hashlib.sha256()
    for nama in _BERKAS_SEED:
        h.update(nama.encode())
        h.update((folder_seed / nama).read_bytes())
    for tabel in sorted(Base.metadata.tables.values(), key=lambda t: t.name):
        h.update(tabel.name.encode())
        for kolom in tabel.columns:
            h.update(kolom.name.encode())
    return h.hexdigest()


async def _baca_sidik_jari_tersimpan(conn: AsyncConnection) -> str | None:
    ada = await conn.execute(text(f"SELECT to_regclass('public.{_TABEL_STATUS_SEED}')"))
    if ada.scalar() is None:
        return None
    hasil = await conn.execute(text(f"SELECT nilai FROM {_TABEL_STATUS_SEED} WHERE kunci = 'seed'"))
    nilai = hasil.scalar()
    return str(nilai) if nilai is not None else None


async def _simpan_sidik_jari(sidik_jari: str) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                f"CREATE TABLE IF NOT EXISTS {_TABEL_STATUS_SEED} ("
                "kunci TEXT PRIMARY KEY, nilai TEXT NOT NULL, "
                "diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now())"
            )
        )
        await conn.execute(
            text(
                f"INSERT INTO {_TABEL_STATUS_SEED} (kunci, nilai) VALUES ('seed', :nilai) "
                "ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai, diperbarui_pada = now()"
            ),
            {"nilai": sidik_jari},
        )


async def ensure_vercel_db_initialized() -> None:
    """Inisialisasi skema tabel, instrumen 2026, dan akun awal otomatis saat berjalan di Vercel.

    Seeding penuh hanya dijalankan bila sidik jari seed berbeda dari yang tersimpan di database,
    sehingga cold start berikutnya cukup satu pengecekan ringan.
    """
    global _vercel_db_initialized, _vercel_init_error
    if _vercel_db_initialized:
        return
    try:
        sidik_jari = _hitung_sidik_jari_seed()

        # Jalur cepat: seed sudah diterapkan sebelumnya
        async with engine.connect() as conn:
            if await _baca_sidik_jari_tersimpan(conn) == sidik_jari:
                _vercel_db_initialized = True
                _vercel_init_error = None
                return

        # Jalur penuh: kunci agar instance serverless lain tidak seeding bersamaan
        async with engine.connect() as kunci_conn:
            await kunci_conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": _ID_KUNCI_SEED})
            try:
                await kunci_conn.commit()
                # Periksa ulang: mungkin instance lain baru saja menyelesaikan seeding
                if await _baca_sidik_jari_tersimpan(kunci_conn) != sidik_jari:
                    await kunci_conn.commit()
                    async with engine.begin() as conn:
                        await conn.run_sync(Base.metadata.create_all)
                    await muat_instrumen(2026)
                    await seed_production_initial_data()
                    await _simpan_sidik_jari(sidik_jari)
            finally:
                await kunci_conn.rollback()
                await kunci_conn.execute(
                    text("SELECT pg_advisory_unlock(:id)"), {"id": _ID_KUNCI_SEED}
                )
                await kunci_conn.commit()

        _vercel_db_initialized = True
        _vercel_init_error = None
    except Exception as exc:
        _vercel_init_error = f"{type(exc).__name__}: {exc}"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    if os.getenv("VERCEL"):
        await ensure_vercel_db_initialized()
    yield


app = FastAPI(
    title="API Self-Assessment Indeks Kualitas Kebijakan (IKK)",
    description=(
        "API backend untuk persiapan dan penilaian mandiri (self-assessment) "
        "Indeks Kualitas Kebijakan (IKK) LAN RI."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware (mendukung seluruh subdomain preview/production Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def vercel_auto_init_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    if os.getenv("VERCEL") and not _vercel_db_initialized:
        await ensure_vercel_db_initialized()
    return await call_next(request)


# Hubungkan router versi 1
app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/", tags=["Sistem"])
async def root_status() -> dict[str, object]:
    return {
        "status": "ok",
        "app": "IKK Self-Assessment API",
        "db_initialized": _vercel_db_initialized,
        "db_error": _vercel_init_error,
    }


@app.get("/healthz", tags=["Sistem"])
async def health_check() -> dict[str, object]:
    return {
        "status": "ok",
        "app": "IKK Self-Assessment",
        "db_initialized": _vercel_db_initialized,
        "db_error": _vercel_init_error,
    }
