FROM python:3.12-slim

# Install system dependencies (curl, build-essential, libpq-dev)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Buat pengguna non-root untuk keamanan kontainer
RUN groupadd --system appuser && useradd --system --gid appuser --create-home appuser

# Salin dependencies definition
COPY pyproject.toml uv.lock ./

# Install python dependencies menggunakan uv
RUN uv sync --frozen --no-dev

# Salin seluruh kode aplikasi dan siapkan direktori uploads
COPY . .
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app

USER appuser

# Port
EXPOSE 8000

# Jalankan migrasi, muat instrumen resmi, seed akun awal, lalu uvicorn (mendukung $PORT dinamis cloud)
CMD ["sh", "-c", "uv run alembic upgrade head && uv run python -m app.seeds.muat --tahun 2026 && uv run python -m app.seeds.seed_prod && uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
