"""tambah_otp_email_pengguna

Revision ID: a8c4e12f9b01
Revises: 964f8e7fe3f3
Create Date: 2026-10-28 10:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a8c4e12f9b01"
down_revision: str | Sequence[str] | None = "964f8e7fe3f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "pengguna",
        sa.Column(
            "email_terverifikasi",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column("pengguna", sa.Column("kode_otp", sa.String(length=20), nullable=True))
    op.add_column(
        "pengguna",
        sa.Column("otp_kadaluarsa_pada", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE pengguna SET email_terverifikasi = true "
        "WHERE status_verifikasi IN ('AKTIF', 'MENUNGGU_VERIFIKASI')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("pengguna", "otp_kadaluarsa_pada")
    op.drop_column("pengguna", "kode_otp")
    op.drop_column("pengguna", "email_terverifikasi")
