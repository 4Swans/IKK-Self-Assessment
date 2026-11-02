"""tambah_catatan_penolakan_pengguna

Revision ID: b12e45f9c001
Revises: a8c4e12f9b01
Create Date: 2026-11-02 11:35:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b12e45f9c001"
down_revision: str | Sequence[str] | None = "a8c4e12f9b01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema: tambah kolom catatan_penolakan pada tabel pengguna."""
    op.add_column("pengguna", sa.Column("catatan_penolakan", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("pengguna", "catatan_penolakan")
