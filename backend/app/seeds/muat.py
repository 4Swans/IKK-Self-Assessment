import argparse
import asyncio
import json
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.instrumen import AmbangKualifikasi, Dimensi, Instrumen, OpsiJawaban, Pertanyaan


async def muat_instrumen(tahun: int) -> None:
    seed_path = Path(__file__).parent / f"instrumen_{tahun}.json"
    if not seed_path.exists():
        raise FileNotFoundError(
            f"File seed instrumen untuk tahun {tahun} tidak ditemukan di {seed_path}"
        )

    with open(seed_path, encoding="utf-8") as f:
        data = json.load(f)

    # Validasi instrumen sesuai AGENTS.md 6.3:
    # Bobot profil + seluruh bobot dimensi = 100%, dan bobot relatif > 0
    bobot_profil = Decimal(str(data["bobot_profil"]))
    total_bobot = bobot_profil

    for dim in data["dimensi"]:
        bobot_dim = Decimal(str(dim["bobot"]))
        total_bobot += bobot_dim

        for pert in dim["pertanyaan"]:
            bobot_rel = Decimal(str(pert.get("bobot_relatif", "1")))
            if bobot_rel <= Decimal("0"):
                raise ValueError(
                    f"Bobot relatif pertanyaan {pert['kode']} harus > 0 (ditemukan: {bobot_rel})"
                )

    if total_bobot != Decimal("100.00"):
        raise ValueError(
            f"Total bobot profil ({bobot_profil}%) + dimensi harus 100%, ditemukan: {total_bobot}%"
        )

    async with AsyncSessionLocal() as session:
        # Periksa apakah instrumen untuk tahun & versi ini sudah ada
        stmt = select(Instrumen).where(
            Instrumen.tahun == data["tahun"], Instrumen.versi == data["versi"]
        )
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing:
            print(
                f"Instrumen tahun {data['tahun']} versi {data['versi']} sudah ada. "
                "Memperbarui in-place..."
            )
            existing.bobot_profil = bobot_profil
            existing.skor_profil_ya = Decimal(str(data["skor_profil_ya"]))
            existing.skor_profil_tidak = (
                Decimal(str(data["skor_profil_tidak"]))
                if data.get("skor_profil_tidak") is not None
                else None
            )
            existing.profil_pertanyaan = data["profil_pertanyaan"]
            existing.profil_bukti_dukung = data["profil_bukti_dukung"]
            await session.flush()

            # Update dimensi & pertanyaan
            res_dim = await session.execute(
                select(Dimensi).where(Dimensi.instrumen_id == existing.id)
            )
            dim_map = {d.kode: d for d in res_dim.scalars().all()}

            for dim_data in data["dimensi"]:
                if dim_data["kode"] in dim_map:
                    dimensi = dim_map[dim_data["kode"]]
                    dimensi.nama = dim_data["nama"]
                    dimensi.bobot = Decimal(str(dim_data["bobot"]))
                else:
                    dimensi = Dimensi(
                        instrumen_id=existing.id,
                        kode=dim_data["kode"],
                        nama=dim_data["nama"],
                        bobot=Decimal(str(dim_data["bobot"])),
                    )
                    session.add(dimensi)
                await session.flush()

                res_pert = await session.execute(
                    select(Pertanyaan).where(Pertanyaan.dimensi_id == dimensi.id)
                )
                pert_map = {p.kode: p for p in res_pert.scalars().all()}

                for pert_data in dim_data["pertanyaan"]:
                    if pert_data["kode"] in pert_map:
                        pertanyaan = pert_map[pert_data["kode"]]
                        pertanyaan.teks = pert_data["teks"]
                        pertanyaan.bobot_relatif = Decimal(
                            str(pert_data.get("bobot_relatif", "1.00"))
                        )
                        pertanyaan.bukti_dukung = pert_data["bukti_dukung"]
                        pertanyaan.keterangan = pert_data["keterangan"]
                    else:
                        pertanyaan = Pertanyaan(
                            dimensi_id=dimensi.id,
                            kode=pert_data["kode"],
                            teks=pert_data["teks"],
                            bobot_relatif=Decimal(str(pert_data.get("bobot_relatif", "1.00"))),
                            bukti_dukung=pert_data["bukti_dukung"],
                            keterangan=pert_data["keterangan"],
                        )
                        session.add(pertanyaan)
                    await session.flush()

                    res_opsi = await session.execute(
                        select(OpsiJawaban).where(OpsiJawaban.pertanyaan_id == pertanyaan.id)
                    )
                    opsi_map = {o.huruf: o for o in res_opsi.scalars().all()}

                    for opsi_data in pert_data["opsi"]:
                        if opsi_data["huruf"] in opsi_map:
                            opsi = opsi_map[opsi_data["huruf"]]
                            opsi.teks = opsi_data["teks"]
                            opsi.skor = Decimal(str(opsi_data["skor"]))
                        else:
                            opsi = OpsiJawaban(
                                pertanyaan_id=pertanyaan.id,
                                huruf=opsi_data["huruf"],
                                teks=opsi_data["teks"],
                                skor=Decimal(str(opsi_data["skor"])),
                            )
                            session.add(opsi)

            await session.commit()
            print("Pembaruan instrumen, dimensi, pertanyaan, dan opsi selesai!")
            return

        instrumen = Instrumen(
            tahun=data["tahun"],
            versi=data["versi"],
            aktif=data.get("aktif", True),
            bobot_profil=bobot_profil,
            skor_profil_ya=Decimal(str(data["skor_profil_ya"])),
            skor_profil_tidak=(
                Decimal(str(data["skor_profil_tidak"]))
                if data.get("skor_profil_tidak") is not None
                else None
            ),
            profil_pertanyaan=data["profil_pertanyaan"],
            profil_bukti_dukung=data["profil_bukti_dukung"],
        )
        session.add(instrumen)
        await session.flush()

        # Tambah dimensi, pertanyaan, opsi
        for dim_data in data["dimensi"]:
            dimensi = Dimensi(
                instrumen_id=instrumen.id,
                kode=dim_data["kode"],
                nama=dim_data["nama"],
                bobot=Decimal(str(dim_data["bobot"])),
            )
            session.add(dimensi)
            await session.flush()

            for pert_data in dim_data["pertanyaan"]:
                pertanyaan = Pertanyaan(
                    dimensi_id=dimensi.id,
                    kode=pert_data["kode"],
                    teks=pert_data["teks"],
                    bobot_relatif=Decimal(str(pert_data.get("bobot_relatif", "1.00"))),
                    bukti_dukung=pert_data["bukti_dukung"],
                    keterangan=pert_data["keterangan"],
                )
                session.add(pertanyaan)
                await session.flush()

                for opsi_data in pert_data["opsi"]:
                    opsi = OpsiJawaban(
                        pertanyaan_id=pertanyaan.id,
                        huruf=opsi_data["huruf"],
                        teks=opsi_data["teks"],
                        skor=Decimal(str(opsi_data["skor"])),
                    )
                    session.add(opsi)

        # Ambang kualifikasi
        for ambang_data in data.get("ambang_kualifikasi", []):
            ambang = AmbangKualifikasi(
                instrumen_id=instrumen.id,
                min_nilai=Decimal(str(ambang_data["min_nilai"])),
                kualifikasi=ambang_data["kualifikasi"],
            )
            session.add(ambang)

        await session.commit()
        print(f"Sukses memuat instrumen IKK tahun {tahun} (versi {data['versi']}) ke basis data.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pemuat instrumen IKK ke database")
    parser.add_argument("--tahun", type=int, default=2026, help="Tahun instrumen yang akan dimuat")
    args = parser.parse_args()

    asyncio.run(muat_instrumen(args.tahun))


if __name__ == "__main__":
    main()
