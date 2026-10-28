import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.pengguna import Pengguna

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Pengguna:
    token: str | None = None

    # Cek authorization header
    if creds:
        token = creds.credentials
    # Cek cookie
    elif "session_token" in request.cookies:
        token = request.cookies["session_token"]
    # Cek query param untuk unduhan tab baru
    elif "token" in request.query_params:
        token = request.query_params["token"]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autentikasi diperlukan. Silakan masuk terlebih dahulu.",
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau telah kedaluwarsa.",
        )

    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identitas token tidak valid.",
        )

    stmt = select(Pengguna).where(Pengguna.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pengguna tidak ditemukan.",
        )

    return user


async def get_optional_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Pengguna | None:
    token: str | None = None
    if creds:
        token = creds.credentials
    elif "session_token" in request.cookies:
        token = request.cookies["session_token"]

    if not token:
        return None

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError:
        return None

    stmt = select(Pengguna).where(Pengguna.id == user_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


def require_roles(allowed_roles: list[str]) -> Callable[[Pengguna], Pengguna]:
    def role_checker(current_user: Pengguna = Depends(get_current_user)) -> Pengguna:
        if current_user.peran not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Peran yang diizinkan: {', '.join(allowed_roles)}.",
            )
        return current_user

    return role_checker
