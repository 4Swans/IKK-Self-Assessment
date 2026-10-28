import os
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app import models as _models  # noqa: F401
from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.database import Base, engine
from app.seeds.muat import muat_instrumen
from app.seeds.seed_prod import seed_production_initial_data

_vercel_db_initialized = False
_vercel_init_error: str | None = None


async def ensure_vercel_db_initialized() -> None:
    """Inisialisasi skema tabel, instrumen 2026, dan akun awal otomatis saat berjalan di Vercel."""
    global _vercel_db_initialized, _vercel_init_error
    if _vercel_db_initialized:
        return
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await muat_instrumen(2026)
        await seed_production_initial_data()
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
