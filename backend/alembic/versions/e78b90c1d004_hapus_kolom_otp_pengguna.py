"""hapus_kolom_otp_pengguna

Revision ID: e78b90c1d004
Revises: d56a78b9e003
Create Date: 2026-11-17 10:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e78b90c1d004"
down_revision: str | Sequence[str] | None = "d56a78b9e003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Hapus kolom OTP usang dari tabel pengguna."""
    op.execute("ALTER TABLE pengguna DROP COLUMN IF EXISTS otp_kadaluarsa_pada;")
    op.execute("ALTER TABLE pengguna DROP COLUMN IF EXISTS kode_otp;")


def downgrade() -> None:
    """Kembalikan kolom OTP pada tabel pengguna."""
    op.add_column("pengguna", sa.Column("kode_otp", sa.String(length=20), nullable=True))
    op.add_column(
        "pengguna",
        sa.Column("otp_kadaluarsa_pada", sa.DateTime(timezone=True), nullable=True),
    )
