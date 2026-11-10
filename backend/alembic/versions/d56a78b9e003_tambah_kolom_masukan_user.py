"""tambah_kolom_masukan_user

Revision ID: d56a78b9e003
Revises: c34f56a7d002
Create Date: 2026-11-10 08:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d56a78b9e003"
down_revision: str | Sequence[str] | None = "c34f56a7d002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema untuk fitur masukan user (kebijakan, asesmen JFAK, jawaban)."""
    # Kebijakan
    op.add_column("kebijakan", sa.Column("deskripsi", sa.Text(), nullable=True))
    op.add_column(
        "kebijakan",
        sa.Column("tahun_pengukuran", sa.Integer(), nullable=True, server_default="2025"),
    )
    op.add_column(
        "kebijakan", sa.Column("berkas_dasar_hukum_nama", sa.String(length=500), nullable=True)
    )
    op.add_column(
        "kebijakan", sa.Column("berkas_dasar_hukum_path", sa.String(length=1000), nullable=True)
    )
    op.add_column(
        "kebijakan", sa.Column("berkas_dasar_hukum_mime", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "kebijakan", sa.Column("berkas_dasar_hukum_konten", sa.LargeBinary(), nullable=True)
    )
    op.add_column("kebijakan", sa.Column("berkas_rkakl_nama", sa.String(length=500), nullable=True))
    op.add_column(
        "kebijakan", sa.Column("berkas_rkakl_path", sa.String(length=1000), nullable=True)
    )
    op.add_column("kebijakan", sa.Column("berkas_rkakl_mime", sa.String(length=100), nullable=True))
    op.add_column("kebijakan", sa.Column("berkas_rkakl_konten", sa.LargeBinary(), nullable=True))

    # Asesmen
    op.add_column("asesmen", sa.Column("sk_jfak_nama", sa.String(length=500), nullable=True))
    op.add_column("asesmen", sa.Column("sk_jfak_mime", sa.String(length=100), nullable=True))
    op.add_column("asesmen", sa.Column("sk_jfak_ukuran", sa.Integer(), nullable=True))
    op.add_column("asesmen", sa.Column("sk_jfak_konten", sa.LargeBinary(), nullable=True))
    op.add_column("asesmen", sa.Column("catatan_koordinator_jfak", sa.Text(), nullable=True))

    # Jawaban
    op.add_column("jawaban", sa.Column("catatan_koordinator", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("jawaban", "catatan_koordinator")

    op.drop_column("asesmen", "catatan_koordinator_jfak")
    op.drop_column("asesmen", "sk_jfak_konten")
    op.drop_column("asesmen", "sk_jfak_ukuran")
    op.drop_column("asesmen", "sk_jfak_mime")
    op.drop_column("asesmen", "sk_jfak_nama")

    op.drop_column("kebijakan", "berkas_rkakl_konten")
    op.drop_column("kebijakan", "berkas_rkakl_mime")
    op.drop_column("kebijakan", "berkas_rkakl_path")
    op.drop_column("kebijakan", "berkas_rkakl_nama")
    op.drop_column("kebijakan", "berkas_dasar_hukum_konten")
    op.drop_column("kebijakan", "berkas_dasar_hukum_mime")
    op.drop_column("kebijakan", "berkas_dasar_hukum_path")
    op.drop_column("kebijakan", "berkas_dasar_hukum_nama")
    op.drop_column("kebijakan", "tahun_pengukuran")
    op.drop_column("kebijakan", "deskripsi")
