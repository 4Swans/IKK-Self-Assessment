import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.asesmen import Asesmen
from app.models.bukti_dukung import BuktiDukung
from app.models.instrumen import Dimensi, Instrumen, Pertanyaan
from app.models.jawaban import Jawaban
from app.models.kebijakan import Kebijakan
from app.models.pengguna import Pengguna
from app.models.periode import Periode
from app.schemas.asesmen import HasilSkorBaca, NilaiDimensiBaca
from app.schemas.rekap import (
    DimensiNilaiRekap,
    IndikatorKesiapanBaca,
    KebijakanRekapBaca,
    MatriksKesiapanBuktiItem,
    PeriodeRekapBaca,
    RekapPeriodeBaca,
)
from app.services.ekspor import buat_ekspor_excel_rekap
from app.services.satker import bangun_filter_satker
from app.services.skoring import (
    HasilSkoring,
    hitung_skor_kebijakan,
)

router = APIRouter(prefix="/rekap", tags=["Rekapitulasi"])


@router.get("", response_model=RekapPeriodeBaca)
async def ambil_rekap_periode(
    periode_id: uuid.UUID | None = Query(default=None),
    satuan_kerja: str | None = Query(default=None),
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RekapPeriodeBaca:
    # 1. Dapatkan periode (aktif jika tidak dispesifikasikan)
    if periode_id:
        stmt_p = select(Periode).where(Periode.id == periode_id)
    else:
        stmt_p = select(Periode).order_by(Periode.tahun.desc(), Periode.created_at.desc())

    res_p = await db.execute(stmt_p)
    periode = res_p.scalars().first()
    if not periode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Periode aktif tidak ditemukan. Silakan registrasi periode terlebih dahulu.",
        )

    # 2. Dapatkan instrumen beserta dimensi, pertanyaan, opsi, dan ambang
    stmt_inst = (
        select(Instrumen)
        .where(Instrumen.id == periode.instrumen_id)
        .options(
            selectinload(Instrumen.dimensi_list)
            .selectinload(Dimensi.pertanyaan_list)
            .selectinload(Pertanyaan.opsi_list),
            selectinload(Instrumen.ambang_kualifikasi_list),
        )
    )
    res_inst = await db.execute(stmt_inst)
    instrumen = res_inst.scalars().first()
    if not instrumen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instrumen untuk periode ini tidak ditemukan.",
        )

    # Bentuk dimensi_config untuk perhitungan skor
    dimensi_config = []
    total_pertanyaan = 0
    peta_pertanyaan_kode: dict[uuid.UUID, str] = {}
    peta_pertanyaan_obj: dict[str, Pertanyaan] = {}

    for dim in sorted(instrumen.dimensi_list, key=lambda d: d.kode):
        pert_list = []
        for p in sorted(dim.pertanyaan_list, key=lambda q: q.kode):
            total_pertanyaan += 1
            peta_pertanyaan_kode[p.id] = p.kode
            peta_pertanyaan_obj[p.kode] = p
            pert_list.append(
                {
                    "kode": p.kode,
                    "bobot_relatif": p.bobot_relatif,
                }
            )
        dimensi_config.append(
            {
                "kode": dim.kode,
                "nama": dim.nama,
                "bobot": dim.bobot,
                "pertanyaan": pert_list,
            }
        )

    ambang_list = [(a.min_nilai, a.kualifikasi) for a in instrumen.ambang_kualifikasi_list]

    # 3. Ambil seluruh kebijakan pada periode ini (terisolasi menurut satker)
    stmt_keb = select(Kebijakan).where(Kebijakan.periode_id == periode.id)

    if current_user and current_user.peran == "ANALIS":
        if current_user.satuan_kerja:
            stmt_keb = stmt_keb.where(
                bangun_filter_satker(Kebijakan.satuan_kerja, current_user.satuan_kerja)
            )
    elif satuan_kerja:
        stmt_keb = stmt_keb.where(bangun_filter_satker(Kebijakan.satuan_kerja, satuan_kerja))

    stmt_keb = stmt_keb.order_by(Kebijakan.created_at).options(
        selectinload(Kebijakan.asesmen)
        .selectinload(Asesmen.jawaban_list)
        .selectinload(Jawaban.opsi),
        selectinload(Kebijakan.asesmen)
        .selectinload(Asesmen.jawaban_list)
        .selectinload(Jawaban.bukti_dukung_list),
    )
    res_keb = await db.execute(stmt_keb)
    kebijakan_list_raw = res_keb.scalars().all()

    # Struktur data penampung matriks kesiapan
    # ketersediaan_map: { kode_pertanyaan: { str(kebijakan_id): bool } }
    ketersediaan_map: dict[str, dict[str, bool]] = {p_kode: {} for p_kode in peta_pertanyaan_obj}
    ringkasan_bukti_map: dict[str, dict[str, str]] = {p_kode: {} for p_kode in peta_pertanyaan_obj}

    kebijakan_rekap_list: list[KebijakanRekapBaca] = []

    for keb in kebijakan_list_raw:
        asesmen = keb.asesmen
        if asesmen:
            status_asesmen = (
                asesmen.status.value if hasattr(asesmen.status, "value") else str(asesmen.status)
            )
        else:
            status_asesmen = "DRAF"

        jawaban_skor: dict[str, Decimal] = {}
        indikator_dict: dict[str, IndikatorKesiapanBaca] = {}

        # Default empty maps for all questions for this policy
        for p_kode in peta_pertanyaan_obj:
            ketersediaan_map[p_kode][str(keb.id)] = False
            ringkasan_bukti_map[p_kode][str(keb.id)] = "Belum diunggah"

        if asesmen:
            for j in asesmen.jawaban_list:
                kode_p = peta_pertanyaan_kode.get(j.pertanyaan_id)
                if not kode_p:
                    continue

                skor_val = j.opsi.skor if j.opsi else Decimal("0")
                huruf_opsi_val = j.opsi.huruf if j.opsi else None
                if j.opsi:
                    jawaban_skor[kode_p] = skor_val

                # Bukti dukung info
                berkas_list: list[BuktiDukung] = j.bukti_dukung_list
                ada_berkas = len(berkas_list) > 0
                ada_tautan = bool(j.tautan_bukti and j.tautan_bukti.strip())
                ada_bukti = ada_berkas or ada_tautan

                nama_berkas = berkas_list[0].nama_file if ada_berkas else None
                ringkasan = ""
                if ada_berkas and ada_tautan:
                    ringkasan = f"{berkas_list[0].nama_file} (+ tautan)"
                elif ada_berkas:
                    ringkasan = (
                        berkas_list[0].nama_file
                        if len(berkas_list) == 1
                        else f"{berkas_list[0].nama_file} (+{len(berkas_list) - 1} file)"
                    )
                elif ada_tautan:
                    t_str = j.tautan_bukti or ""
                    ringkasan = (
                        f"Tautan: {t_str[:30]}..." if len(t_str) > 30 else f"Tautan: {t_str}"
                    )
                else:
                    ringkasan = "Belum diunggah"

                ketersediaan_map[kode_p][str(keb.id)] = ada_bukti
                ringkasan_bukti_map[kode_p][str(keb.id)] = ringkasan

                indikator_dict[kode_p.lower()] = IndikatorKesiapanBaca(
                    kode=kode_p.lower(),
                    skor=skor_val,
                    huruf_opsi=huruf_opsi_val,
                    ada_jawaban=j.opsi is not None,
                    ada_bukti=ada_bukti,
                    jumlah_berkas=len(berkas_list),
                    ada_tautan=ada_tautan,
                    tautan_dicek=j.akses_publik_dicek,
                    nama_berkas_pertama=nama_berkas,
                )

        # Isi indikator kosong jika ada pertanyaan yang belum dijawab
        for p_kode in peta_pertanyaan_obj:
            k_low = p_kode.lower()
            if k_low not in indikator_dict:
                indikator_dict[k_low] = IndikatorKesiapanBaca(
                    kode=k_low,
                    skor=Decimal("0"),
                    huruf_opsi=None,
                    ada_jawaban=False,
                    ada_bukti=False,
                    jumlah_berkas=0,
                    ada_tautan=False,
                    tautan_dicek=False,
                    nama_berkas_pertama=None,
                )

        # Hitung skor: eksak jika lengkap, parsial jika belum lengkap
        lengkap = len(jawaban_skor) == total_pertanyaan
        hasil_skoring: HasilSkoring = hitung_skor_kebijakan(
            melibatkan_jfak=periode.melibatkan_jfak,
            bobot_profil=instrumen.bobot_profil,
            skor_profil_ya=instrumen.skor_profil_ya,
            skor_profil_tidak=instrumen.skor_profil_tidak,
            dimensi_config=dimensi_config,
            jawaban_skor=jawaban_skor,
            ambang_kualifikasi=ambang_list,
            izinkan_parsial=True,
        )

        dimensi_rekap_dict: dict[str, DimensiNilaiRekap] = {}
        dimensi_baca_dict: dict[str, NilaiDimensiBaca] = {}

        for k, v in hasil_skoring.dimensi.items():
            dim_item = DimensiNilaiRekap(
                kode=v.kode,
                nama=v.nama,
                bobot_persen=v.bobot_persen,
                nilai_murni=v.nilai_murni,
                kontribusi_total=v.kontribusi_total,
                nilai_tampilan=v.nilai_tampilan,
            )
            dimensi_rekap_dict[k.lower()] = dim_item
            dimensi_rekap_dict[k.upper()] = dim_item
            dimensi_baca_dict[k] = NilaiDimensiBaca(
                kode=v.kode,
                nama=v.nama,
                bobot_persen=v.bobot_persen,
                nilai_murni=v.nilai_murni,
                kontribusi_total=v.kontribusi_total,
                nilai_tampilan=v.nilai_tampilan,
            )

        skor_terkini = None
        if lengkap:
            skor_terkini = HasilSkorBaca(
                nilai_profil=hasil_skoring.nilai_profil,
                kontribusi_profil=hasil_skoring.kontribusi_profil,
                dimensi=dimensi_baca_dict,
                nilai_total=hasil_skoring.nilai_total,
                nilai_total_tampilan=hasil_skoring.nilai_total_tampilan,
                kualifikasi=hasil_skoring.kualifikasi,
            )

        kebijakan_rekap_list.append(
            KebijakanRekapBaca(
                id=keb.id,
                nama=keb.nama,
                jenis_dasar_hukum=keb.jenis_dasar_hukum,
                nomor_dasar_hukum=keb.nomor_dasar_hukum,
                tanggal_penetapan=keb.tanggal_penetapan,
                dipilih_untuk_si_ikk=keb.dipilih_untuk_si_ikk,
                rekomendasi=keb.rekomendasi,
                satuan_kerja=keb.satuan_kerja,
                status_asesmen=status_asesmen,
                lengkap=lengkap,
                profil_skor=hasil_skoring.kontribusi_profil,
                dimensi=dimensi_rekap_dict,
                nilai_total=hasil_skoring.nilai_total,
                nilai_total_tampilan=hasil_skoring.nilai_total_tampilan,
                kualifikasi=hasil_skoring.kualifikasi,
                skor_terkini=skor_terkini,
                indikator=indikator_dict,
            )
        )

    # 4. Susun matriks kesiapan bukti dukung
    matriks_kesiapan: list[MatriksKesiapanBuktiItem] = []
    for dim in sorted(instrumen.dimensi_list, key=lambda d: d.kode):
        for p in sorted(dim.pertanyaan_list, key=lambda q: q.kode):
            matriks_kesiapan.append(
                MatriksKesiapanBuktiItem(
                    kode_pertanyaan=p.kode,
                    teks_pertanyaan=p.teks,
                    dimensi_kode=dim.kode,
                    dimensi_nama=dim.nama,
                    bukti_dukung_wajib=p.bukti_dukung,
                    ketersediaan=ketersediaan_map[p.kode],
                    ringkasan_bukti=ringkasan_bukti_map[p.kode],
                )
            )

    # 5. Cek kondisi 3 kebijakan terpilih & kelayakan SI IKK
    kebijakan_terpilih = [k for k in kebijakan_rekap_list if k.dipilih_untuk_si_ikk]
    lengkap_tiga_kebijakan = len(kebijakan_terpilih) == 3
    semua_disetujui = lengkap_tiga_kebijakan and all(
        k.status_asesmen in ["DISETUJUI", "TERKIRIM_SI_IKK"] for k in kebijakan_terpilih
    )
    siap_kirim_si_ikk = semua_disetujui and periode.melibatkan_jfak

    periode_baca = PeriodeRekapBaca(
        id=periode.id,
        tahun=periode.tahun,
        instansi=periode.instansi,
        melibatkan_jfak=periode.melibatkan_jfak,
        tautan_surat_penunjukan=periode.tautan_surat_penunjukan,
        lengkap_tiga_kebijakan=lengkap_tiga_kebijakan,
        jumlah_kebijakan=len(kebijakan_rekap_list),
        jumlah_terpilih=len(kebijakan_terpilih),
    )

    return RekapPeriodeBaca(
        periode=periode_baca,
        kebijakan_list=kebijakan_rekap_list,
        kebijakan_terpilih_list=kebijakan_terpilih,
        matriks_kesiapan=matriks_kesiapan,
        semua_disetujui=semua_disetujui,
        siap_kirim_si_ikk=siap_kirim_si_ikk,
    )


@router.get("/ekspor-excel")
async def unduh_ekspor_excel(
    periode_id: uuid.UUID | None = Query(default=None),
    satuan_kerja: str | None = Query(default=None),
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Mengunduh berkas Excel rekapitulasi penilaian mandiri sesuai template resmi LAN RI."""
    # Hak akses: Satuan kerja di luar PUSAKA (ANALIS) hanya memiliki hak baca (read-only)
    if current_user.peran == "ANALIS":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Akses ditolak. Satuan kerja di luar PUSAKA hanya memiliki hak akses baca "
                "(read-only) dan tidak diizinkan mengekspor berkas Excel."
            ),
        )

    rekap_data = await ambil_rekap_periode(
        periode_id=periode_id,
        satuan_kerja=satuan_kerja,
        current_user=current_user,
        db=db,
    )
    excel_stream = buat_ekspor_excel_rekap(rekap_data)

    instansi_clean = rekap_data.periode.instansi.replace(" ", "_")
    nama_file = f"Rekap_Self_Assessment_IKK_{rekap_data.periode.tahun}_{instansi_clean}.xlsx"

    return Response(
        content=excel_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nama_file}"'},
    )
