"""tambah_konten_pada_bukti_dukung

Revision ID: c34f56a7d002
Revises: b12e45f9c001
Create Date: 2026-11-02 11:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c34f56a7d002"
down_revision: str | Sequence[str] | None = "b12e45f9c001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema: tambah kolom konten BYTEA pada tabel bukti_dukung."""
    op.add_column("bukti_dukung", sa.Column("konten", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("bukti_dukung", "konten")
