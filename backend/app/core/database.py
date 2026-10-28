import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

_engine_kwargs: dict[str, object] = {
    "echo": (settings.ENVIRONMENT == "development"),
    "future": True,
}
if os.getenv("VERCEL"):
    _engine_kwargs["poolclass"] = NullPool
if settings.needs_ssl:
    _engine_kwargs["connect_args"] = {"ssl": "require"}

engine = create_async_engine(
    settings.async_database_url,
    **_engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
