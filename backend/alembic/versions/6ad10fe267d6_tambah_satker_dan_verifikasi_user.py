"""tambah_satker_dan_verifikasi_user

Revision ID: 6ad10fe267d6
Revises: f084b4ca42eb
Create Date: 2026-10-26 11:12:08.827999

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6ad10fe267d6"
down_revision: str | Sequence[str] | None = "f084b4ca42eb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("kebijakan", sa.Column("satuan_kerja", sa.String(length=255), nullable=True))
    op.add_column("kebijakan", sa.Column("pembuat_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_kebijakan_pembuat_id"), "kebijakan", ["pembuat_id"], unique=False)
    op.create_index(op.f("ix_kebijakan_satuan_kerja"), "kebijakan", ["satuan_kerja"], unique=False)
    op.create_foreign_key(
        "fk_kebijakan_pembuat_id_pengguna",
        "kebijakan",
        "pengguna",
        ["pembuat_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("pengguna", sa.Column("nip", sa.String(length=50), nullable=True))
    op.add_column(
        "pengguna",
        sa.Column(
            "satuan_kerja",
            sa.String(length=255),
            nullable=False,
            server_default="Pusat Kebijakan dan Inovasi (PUSAKA)",
        ),
    )
    op.add_column(
        "pengguna",
        sa.Column(
            "status_verifikasi",
            sa.String(length=50),
            nullable=False,
            server_default="AKTIF",
        ),
    )
    op.create_index(op.f("ix_pengguna_nip"), "pengguna", ["nip"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_pengguna_nip"), table_name="pengguna")
    op.drop_column("pengguna", "status_verifikasi")
    op.drop_column("pengguna", "satuan_kerja")
    op.drop_column("pengguna", "nip")
    op.drop_constraint("fk_kebijakan_pembuat_id_pengguna", "kebijakan", type_="foreignkey")
    op.drop_index(op.f("ix_kebijakan_satuan_kerja"), table_name="kebijakan")
    op.drop_index(op.f("ix_kebijakan_pembuat_id"), table_name="kebijakan")
    op.drop_column("kebijakan", "pembuat_id")
    op.drop_column("kebijakan", "satuan_kerja")
