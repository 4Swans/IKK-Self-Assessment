import asyncio
from datetime import date

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.asesmen import Asesmen, StatusAsesmen
from app.models.instrumen import Instrumen
from app.models.kebijakan import Kebijakan
from app.models.pengguna import Pengguna, PeranPengguna
from app.models.periode import Periode


async def seed_users_and_initial_data() -> None:
    async with AsyncSessionLocal() as session:
        # 1. Seed Pengguna dengan Username, Satker, NIP, dan Status Verifikasi
        users_data = [
            {
                "nama": "Siti Rahmawati",
                "username": "koordinator",
                "email": "koordinator@komdigi.go.id",
                "nip": "197805122003122001",
                "password": "Password123!",
                "peran": PeranPengguna.KOORDINATOR,
                "instansi": "Kementerian Komunikasi dan Digital",
                "satuan_kerja": "Pusat Kebijakan Strategis (PUSAKA)",
                "status_verifikasi": "AKTIF",
            },
            {
                "nama": "Ahmad Fauzi",
                "username": "analis",
                "email": "analis@komdigi.go.id",
                "nip": "198801152011011002",
                "password": "Password123!",
                "peran": PeranPengguna.ANALIS,
                "instansi": "Kementerian Komunikasi dan Digital",
                "satuan_kerja": "Direktorat Jenderal Aplikasi Informatika",
                "status_verifikasi": "AKTIF",
            },
            {
                "nama": "Dewi Lestari",
                "username": "analis2",
                "email": "analis2@komdigi.go.id",
                "nip": "199203202015022003",
                "password": "Password123!",
                "peran": PeranPengguna.ANALIS,
                "instansi": "Kementerian Komunikasi dan Digital",
                "satuan_kerja": "Direktorat Jenderal Penyelenggaraan Pos dan Informatika",
                "status_verifikasi": "AKTIF",
            },
            {
                "nama": "Administrator Sistem",
                "username": "admin",
                "email": "admin@komdigi.go.id",
                "nip": "198507012009121004",
                "password": "admin@#!",
                "peran": PeranPengguna.ADMIN,
                "instansi": "Kementerian Komunikasi dan Digital",
                "satuan_kerja": "Pusat Kebijakan Strategis (PUSAKA)",
                "status_verifikasi": "AKTIF",
            },
        ]
        created_users: dict[str, Pengguna] = {}
        for u in users_data:
            stmt = select(Pengguna).where(
                (Pengguna.username == u["username"]) | (Pengguna.email == u["email"])
            )
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                new_user = Pengguna(
                    nama=u["nama"],
                    username=u["username"],
                    email=u["email"],
                    nip=u["nip"],
                    satuan_kerja=u["satuan_kerja"],
                    status_verifikasi=u["status_verifikasi"],
                    password_hash=hash_password(u["password"]),
                    peran=u["peran"],
                    instansi=u["instansi"],
                )
                session.add(new_user)
                await session.flush()
                created_users[u["username"]] = new_user
                print(f"User created: {u['username']} ({u['email']})")
            else:
                existing.nama = u["nama"]
                existing.username = u["username"]
                existing.email = u["email"]
                existing.nip = u["nip"]
                existing.satuan_kerja = u["satuan_kerja"]
                existing.status_verifikasi = u["status_verifikasi"]
                existing.password_hash = hash_password(u["password"])
                created_users[u["username"]] = existing
                print(f"User updated: {u['username']} ({u['satuan_kerja']})")

        # 2. Seed Periode Aktif 2026
        stmt_inst = select(Instrumen).where(Instrumen.tahun == 2026, Instrumen.aktif.is_(True))
        res_inst = await session.execute(stmt_inst)
        instrumen = res_inst.scalars().first()

        if instrumen:
            stmt_per = select(Periode).where(
                Periode.instansi == "Kementerian Xaka", Periode.tahun == 2026
            )
            res_per = await session.execute(stmt_per)
            periode = res_per.scalar_one_or_none()

            if not periode:
                periode = Periode(
                    instansi="Kementerian Xaka",
                    tahun=2026,
                    instrumen_id=instrumen.id,
                    melibatkan_jfak=True,
                    tautan_surat_penunjukan="https://jdih.xaka.go.id/sk-tim-jfak-ikk-2026.pdf",
                )
                session.add(periode)
                await session.flush()
                print("Periode 2026 untuk 'Kementerian Xaka' berhasil dibuat.")
            else:
                print("Periode 2026 sudah ada.")

            # 3. Seed 3 Kebijakan Strategis Awal (Sesuai AGENTS.md 6.3)
            stmt_keb = select(Kebijakan).where(Kebijakan.periode_id == periode.id)
            res_keb = await session.execute(stmt_keb)
            existing_keb = res_keb.scalars().all()

            if not existing_keb:
                analis_user = created_users.get("analis")
                analis_id = analis_user.id if analis_user else None

                kebijakan_list = [
                    {
                        "nama": "PM 5/2020 PSE Privat",
                        "jenis_dasar_hukum": "Permen",
                        "nomor_dasar_hukum": "Nomor 5 Tahun 2020",
                        "tanggal_penetapan": date(2023, 5, 12),
                        "dipilih_untuk_si_ikk": False,
                        "rekomendasi": (
                            "Diusulkan untuk percontohan instrumen IKK dengan tata kelola digital."
                        ),
                    },
                    {
                        "nama": "Pengawasan PDP 2024",
                        "jenis_dasar_hukum": "Perpres",
                        "nomor_dasar_hukum": "Nomor 22 Tahun 2024",
                        "tanggal_penetapan": date(2024, 2, 10),
                        "dipilih_untuk_si_ikk": False,
                        "rekomendasi": (
                            "Regulasi perlindungan data pribadi prioritas strategis nasional."
                        ),
                    },
                    {
                        "nama": "UU 1/2024 Revisi ITE",
                        "jenis_dasar_hukum": "UU",
                        "nomor_dasar_hukum": "Nomor 1 Tahun 2024",
                        "tanggal_penetapan": date(2024, 1, 2),
                        "dipilih_untuk_si_ikk": False,
                        "rekomendasi": (
                            "Penyelarasan norma hukum siber dan perlindungan ruang digital publik."
                        ),
                    },
                ]

                for kb in kebijakan_list:
                    k_obj = Kebijakan(
                        periode_id=periode.id,
                        nama=kb["nama"],
                        jenis_dasar_hukum=kb["jenis_dasar_hukum"],
                        nomor_dasar_hukum=kb["nomor_dasar_hukum"],
                        tanggal_penetapan=kb["tanggal_penetapan"],
                        dipilih_untuk_si_ikk=kb["dipilih_untuk_si_ikk"],
                        rekomendasi=kb["rekomendasi"],
                    )
                    session.add(k_obj)
                    await session.flush()

                    # Buat entitas asesmen
                    asesmen = Asesmen(
                        kebijakan_id=k_obj.id,
                        status=StatusAsesmen.DRAF,
                        analis_id=analis_id,
                    )
                    session.add(asesmen)

                print("3 Kebijakan strategis awal berhasil dibuat beserta entitas asesmen.")

        await session.commit()
    print("Seed users & initial data completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_users_and_initial_data())
