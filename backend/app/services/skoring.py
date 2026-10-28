from decimal import ROUND_HALF_UP, Decimal
from typing import Any, NamedTuple


class SkorBelumDikonfigurasi(Exception):
    """Dilempar ketika nilai profil atau skor opsi belum dikonfigurasi (None)."""

    pass


class NilaiDimensiHasil(NamedTuple):
    kode: str
    nama: str
    bobot_persen: Decimal
    nilai_murni: Decimal  # skala 0-100 (rata-rata terbobot pertanyaan dalam dimensi)
    kontribusi_total: Decimal  # nilai_murni * (bobot_persen / 100)
    nilai_tampilan: Decimal  # pembulatan 2 desimal


class HasilSkoring(NamedTuple):
    nilai_profil: Decimal
    kontribusi_profil: Decimal
    dimensi: dict[str, NilaiDimensiHasil]
    nilai_total: Decimal  # nilai eksak tanpa pembulatan
    nilai_total_tampilan: Decimal  # pembulatan 2 desimal
    kualifikasi: str


def bulatkan_2_desimal(nilai: Decimal) -> Decimal:
    """Membulatkan Decimal ke 2 angka di belakang koma (ROUND_HALF_UP)."""
    return nilai.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def tentukan_kualifikasi(
    nilai_total: Decimal,
    ambang_list: list[tuple[Decimal, str]] | None = None,
) -> str:
    """
    Menentukan predikat kualifikasi berdasarkan nilai_total (tanpa pembulatan).
    Default ambang:
      91.00 - 100: Unggul
      80.00 - 90.99: Sangat Baik
      65.00 - 79.99: Baik
      50.00 - 64.99: Cukup
      < 50.00: Kurang
    """
    if ambang_list is None:
        ambang_list = [
            (Decimal("91.00"), "Unggul"),
            (Decimal("80.00"), "Sangat Baik"),
            (Decimal("65.00"), "Baik"),
            (Decimal("50.00"), "Cukup"),
            (Decimal("0.00"), "Kurang"),
        ]

    for min_nilai, kualifikasi in ambang_list:
        if nilai_total >= min_nilai:
            return kualifikasi

    return "Kurang"


def hitung_skor_kebijakan(
    melibatkan_jfak: bool,
    bobot_profil: Decimal,
    skor_profil_ya: Decimal | None,
    skor_profil_tidak: Decimal | None,
    dimensi_config: list[dict[str, Any]],
    jawaban_skor: dict[str, Decimal],
    ambang_kualifikasi: list[tuple[Decimal, str]] | None = None,
    izinkan_parsial: bool = False,
) -> HasilSkoring:
    """
    Menghitung skor self-assessment IKK sesuai formula resmi:
    nilai_dimensi = Σ (bobot_relatif × skor_opsi_terpilih) / Σ bobot_relatif
    nilai_total   = (bobot_profil / 100) × skor_profil + Σ ((bobot_dimensi / 100) × nilai_dimensi)
    """
    # 1. Hitung skor profil
    if melibatkan_jfak:
        if skor_profil_ya is None:
            raise SkorBelumDikonfigurasi("Skor profil untuk jawaban 'Ya' belum dikonfigurasi")
        skor_profil = skor_profil_ya
    else:
        if skor_profil_tidak is None:
            raise SkorBelumDikonfigurasi("Skor profil untuk jawaban 'Tidak' belum dikonfigurasi")
        skor_profil = skor_profil_tidak

    kontribusi_profil = (bobot_profil / Decimal("100")) * skor_profil
    nilai_total = kontribusi_profil

    hasil_dimensi: dict[str, NilaiDimensiHasil] = {}

    # 2. Hitung per dimensi
    for dim in dimensi_config:
        kode_dimensi = str(dim["kode"])
        nama_dimensi = str(dim.get("nama", kode_dimensi))
        bobot_dimensi = Decimal(str(dim["bobot"]))

        pembilang = Decimal("0")
        penyebut = Decimal("0")

        for pert in dim["pertanyaan"]:
            kode_pert = str(pert["kode"])
            bobot_relatif = Decimal(str(pert.get("bobot_relatif", "1")))
            if kode_pert not in jawaban_skor:
                if izinkan_parsial:
                    skor_jawaban = Decimal("0")
                else:
                    raise ValueError(f"Pertanyaan {kode_pert} belum memiliki jawaban/skor terpilih")
            else:
                skor_jawaban = jawaban_skor[kode_pert]

            pembilang += bobot_relatif * skor_jawaban
            penyebut += bobot_relatif

        if penyebut == Decimal("0"):
            raise ValueError(f"Total bobot relatif dimensi {kode_dimensi} tidak boleh 0")

        nilai_murni_dimensi = pembilang / penyebut
        kontribusi_dimensi = (bobot_dimensi / Decimal("100")) * nilai_murni_dimensi
        nilai_total += kontribusi_dimensi

        hasil_dimensi[kode_dimensi] = NilaiDimensiHasil(
            kode=kode_dimensi,
            nama=nama_dimensi,
            bobot_persen=bobot_dimensi,
            nilai_murni=nilai_murni_dimensi,
            kontribusi_total=kontribusi_dimensi,
            nilai_tampilan=bulatkan_2_desimal(nilai_murni_dimensi),
        )

    kualifikasi = tentukan_kualifikasi(nilai_total, ambang_kualifikasi)

    return HasilSkoring(
        nilai_profil=skor_profil,
        kontribusi_profil=kontribusi_profil,
        dimensi=hasil_dimensi,
        nilai_total=nilai_total,
        nilai_total_tampilan=bulatkan_2_desimal(nilai_total),
        kualifikasi=kualifikasi,
    )
