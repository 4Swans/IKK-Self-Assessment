import asyncio
import os

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.instrumen import Instrumen
from app.models.pengguna import Pengguna, PeranPengguna
from app.models.periode import Periode


async def seed_production_initial_data() -> None:
    """Inisialisasi akun utama & Periode aktif 2026 untuk lingkungan prototipe/produksi."""
    admin_password = os.getenv("ADMIN_INITIAL_PASSWORD", "admin@#!")
    default_password = os.getenv("DEMO_INITIAL_PASSWORD", "Password123!")
    async with AsyncSessionLocal() as session:
        # 1. Pastikan akun Admin, Koordinator PUSAKA, dan Analis Satker tersedia
        initial_accounts: list[dict[str, object]] = [
            {
                "nama": "Administrator Sistem",
                "username": "admin",
                "email": "admin@komdigi.go.id",
                "nip": "198507012009121004",
                "satuan_kerja": "Pusat Kebijakan Strategis (PUSAKA)",
                "password": admin_password,
                "peran": PeranPengguna.ADMIN,
            },
            {
                "nama": "Siti Rahmawati",
                "username": "koordinator",
                "email": "koordinator@komdigi.go.id",
                "nip": "197805122003122001",
                "satuan_kerja": "Pusat Kebijakan Strategis (PUSAKA)",
                "password": default_password,
                "peran": PeranPengguna.KOORDINATOR,
            },
            {
                "nama": "Ahmad Fauzi",
                "username": "analis",
                "email": "analis@komdigi.go.id",
                "nip": "198801152011011002",
                "satuan_kerja": "Direktorat Aplikasi Pemerintah Digital",
                "password": default_password,
                "peran": PeranPengguna.ANALIS,
            },
        ]

        for acc in initial_accounts:
            stmt_u = select(Pengguna).where(
                (Pengguna.username == str(acc["username"])) | (Pengguna.email == str(acc["email"]))
            )
            res_u = await session.execute(stmt_u)
            existing_u = res_u.scalar_one_or_none()

            if not existing_u:
                peran_val = acc["peran"]
                assert isinstance(peran_val, PeranPengguna)
                new_u = Pengguna(
                    nama=str(acc["nama"]),
                    username=str(acc["username"]),
                    email=str(acc["email"]),
                    nip=str(acc["nip"]),
                    satuan_kerja=str(acc["satuan_kerja"]),
                    status_verifikasi="AKTIF",
                    email_terverifikasi=True,
                    password_hash=hash_password(str(acc["password"])),
                    peran=peran_val,
                    instansi="Kementerian Komunikasi dan Digital",
                )
                session.add(new_u)
                await session.flush()
                print(f"Akun {acc['username']} berhasil diinisialisasi.")
            else:
                existing_u.email_terverifikasi = True
                existing_u.status_verifikasi = "AKTIF"
                print(f"Akun {acc['username']} sudah tersedia.")

        # 2. Pastikan Periode Aktif 2026 tersedia untuk Instrumen 2026
        stmt_inst = select(Instrumen).where(Instrumen.tahun == 2026, Instrumen.aktif.is_(True))
        res_inst = await session.execute(stmt_inst)
        instrumen = res_inst.scalars().first()

        if instrumen:
            stmt_per = select(Periode).where(Periode.tahun == 2026)
            res_per = await session.execute(stmt_per)
            periode = res_per.scalars().first()

            if not periode:
                periode = Periode(
                    instansi="Kementerian Komunikasi dan Digital",
                    tahun=2026,
                    instrumen_id=instrumen.id,
                    melibatkan_jfak=True,
                    tautan_surat_penunjukan=None,
                )
                session.add(periode)
                await session.flush()
                print("Periode Pengukuran 2026 berhasil diinisialisasi.")

        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_production_initial_data())
