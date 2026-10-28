from fastapi import APIRouter

from app.api.v1.asesmen import router as asesmen_router
from app.api.v1.auth import router as auth_router
from app.api.v1.instrumen import router as instrumen_router
from app.api.v1.jawaban import router as jawaban_router
from app.api.v1.kebijakan import router as kebijakan_router
from app.api.v1.pengguna import router as pengguna_router
from app.api.v1.periode import router as periode_router
from app.api.v1.rekap import router as rekap_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(instrumen_router)
api_v1_router.include_router(periode_router)
api_v1_router.include_router(kebijakan_router)
api_v1_router.include_router(asesmen_router)
api_v1_router.include_router(jawaban_router)
api_v1_router.include_router(pengguna_router)
api_v1_router.include_router(rekap_router)


@api_v1_router.get("/status", tags=["Sistem"])
async def status_v1() -> dict[str, str]:
    return {"status": "aktif", "versi": "v1"}
