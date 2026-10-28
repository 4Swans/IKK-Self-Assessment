import json
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.services.skoring import (
    HasilSkoring,
    SkorBelumDikonfigurasi,
    hitung_skor_kebijakan,
    tentukan_kualifikasi,
)


@pytest.fixture
def instrumen_2026_data() -> dict[str, Any]:
    seed_file = Path(__file__).parent.parent / "app" / "seeds" / "instrumen_2026.json"
    with open(seed_file, encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
        return data


def test_regresi_kebijakan_pm_5_2020(instrumen_2026_data: dict[str, Any]) -> None:
    """
    PM 5/2020 PSE Privat:
    Skor a1..d2: 100, 75, 100, 100, 100, 100, 100, 100, 100, 100, 100
    Bobot baru: A (20%: 40/40/20), B (25%: 35/35/30), C (30%: 35/35/30), D (15%: 50/50) + Profil 10%
    Nilai total harus 98,00 dan Kualifikasi Unggul
    """
    jawaban = {
        "A1": Decimal("100"),
        "A2": Decimal("75"),
        "A3": Decimal("100"),
        "B1": Decimal("100"),
        "B2": Decimal("100"),
        "B3": Decimal("100"),
        "C1": Decimal("100"),
        "C2": Decimal("100"),
        "C3": Decimal("100"),
        "D1": Decimal("100"),
        "D2": Decimal("100"),
    }

    hasil: HasilSkoring = hitung_skor_kebijakan(
        melibatkan_jfak=True,
        bobot_profil=Decimal(instrumen_2026_data["bobot_profil"]),
        skor_profil_ya=Decimal(instrumen_2026_data["skor_profil_ya"]),
        skor_profil_tidak=None,
        dimensi_config=instrumen_2026_data["dimensi"],
        jawaban_skor=jawaban,
    )

    assert hasil.nilai_total_tampilan == Decimal("98.00")
    assert hasil.kualifikasi == "Unggul"


def test_regresi_kebijakan_pengawasan_pdp_2024(instrumen_2026_data: dict[str, Any]) -> None:
    """
    Pengawasan PDP 2024:
    Skor a1..d2: 0, 0, 0, 100, 100, 100, 100, 100, 0, 100, 100
    Nilai total harus 71,00 dan Kualifikasi Baik
    """
    jawaban = {
        "A1": Decimal("0"),
        "A2": Decimal("0"),
        "A3": Decimal("0"),
        "B1": Decimal("100"),
        "B2": Decimal("100"),
        "B3": Decimal("100"),
        "C1": Decimal("100"),
        "C2": Decimal("100"),
        "C3": Decimal("0"),
        "D1": Decimal("100"),
        "D2": Decimal("100"),
    }

    hasil: HasilSkoring = hitung_skor_kebijakan(
        melibatkan_jfak=True,
        bobot_profil=Decimal(instrumen_2026_data["bobot_profil"]),
        skor_profil_ya=Decimal(instrumen_2026_data["skor_profil_ya"]),
        skor_profil_tidak=None,
        dimensi_config=instrumen_2026_data["dimensi"],
        jawaban_skor=jawaban,
    )

    assert hasil.nilai_total_tampilan == Decimal("71.00")
    assert hasil.kualifikasi == "Baik"


def test_regresi_kebijakan_uu_1_2024_revisi_ite(instrumen_2026_data: dict[str, Any]) -> None:
    """
    UU 1/2024 Revisi ITE:
    Skor a1..d2: 75, 0, 0, 0, 100, 0, 100, 0, 0, 75, 100
    Nilai total harus 48,38 dan Kualifikasi Kurang
    """
    jawaban = {
        "A1": Decimal("75"),
        "A2": Decimal("0"),
        "A3": Decimal("0"),
        "B1": Decimal("0"),
        "B2": Decimal("100"),
        "B3": Decimal("0"),
        "C1": Decimal("100"),
        "C2": Decimal("0"),
        "C3": Decimal("0"),
        "D1": Decimal("75"),
        "D2": Decimal("100"),
    }

    hasil: HasilSkoring = hitung_skor_kebijakan(
        melibatkan_jfak=True,
        bobot_profil=Decimal(instrumen_2026_data["bobot_profil"]),
        skor_profil_ya=Decimal(instrumen_2026_data["skor_profil_ya"]),
        skor_profil_tidak=None,
        dimensi_config=instrumen_2026_data["dimensi"],
        jawaban_skor=jawaban,
    )

    assert hasil.nilai_total_tampilan == Decimal("48.38")
    assert hasil.kualifikasi == "Kurang"


def test_skor_profil_tidak_menolak_perhitungan(instrumen_2026_data: dict[str, Any]) -> None:
    """Jika profil 'Tidak' dan skor belum dikonfigurasi, harus raise SkorBelumDikonfigurasi."""
    jawaban = {
        "A1": Decimal("0"),
        "A2": Decimal("0"),
        "A3": Decimal("0"),
        "B1": Decimal("0"),
        "B2": Decimal("0"),
        "B3": Decimal("0"),
        "C1": Decimal("0"),
        "C2": Decimal("0"),
        "C3": Decimal("0"),
        "D1": Decimal("0"),
        "D2": Decimal("0"),
    }

    with pytest.raises(SkorBelumDikonfigurasi):
        hitung_skor_kebijakan(
            melibatkan_jfak=False,
            bobot_profil=Decimal(instrumen_2026_data["bobot_profil"]),
            skor_profil_ya=Decimal(instrumen_2026_data["skor_profil_ya"]),
            skor_profil_tidak=None,
            dimensi_config=instrumen_2026_data["dimensi"],
            jawaban_skor=jawaban,
        )


def test_ambang_batas_kualifikasi() -> None:
    """Uji nilai batas kualifikasi tanpa pembulatan."""
    # Batas Kurang vs Cukup (50.00)
    assert tentukan_kualifikasi(Decimal("49.99")) == "Kurang"
    assert tentukan_kualifikasi(Decimal("50.00")) == "Cukup"

    # Batas Cukup vs Baik (65.00)
    assert tentukan_kualifikasi(Decimal("64.99")) == "Cukup"
    assert tentukan_kualifikasi(Decimal("65.00")) == "Baik"

    # Batas Baik vs Sangat Baik (80.00)
    assert tentukan_kualifikasi(Decimal("79.99")) == "Baik"
    assert tentukan_kualifikasi(Decimal("80.00")) == "Sangat Baik"

    # Batas Sangat Baik vs Unggul (91.00)
    assert tentukan_kualifikasi(Decimal("90.99")) == "Sangat Baik"
    assert tentukan_kualifikasi(Decimal("91.00")) == "Unggul"
    assert tentukan_kualifikasi(Decimal("100.00")) == "Unggul"
