import re
from typing import Any

from sqlalchemy import or_

# Peta Hierarki Resmi Komdigi: Induk (Eselon I) -> Daftar Unit Direktorat / Pusat (Eselon II)
HIERARKI_SATKER_KOMDIGI: dict[str, list[str]] = {
    "Direktorat Jenderal Infrastruktur Digital": [
        "Direktorat Strategi dan Kebijakan Infrastruktur Digital",
        (
            "Direktorat Penataan Spektrum Frekuensi Radio, Orbit Satelit "
            "dan Standardisasi Infrastruktur Digital"
        ),
        "Direktorat Layanan Infrastruktur Digital",
        "Direktorat Akselerasi Infrastruktur Digital",
        "Direktorat Pengendalian Infrastruktur Digital",
    ],
    "Direktorat Jenderal Teknologi Pemerintah Digital": [
        "Direktorat Strategi dan Kebijakan Teknologi Pemerintah Digital",
        "Direktorat Infrastruktur Pemerintah Digital",
        "Direktorat Aplikasi Pemerintah Digital",
        "Direktorat Akselerasi Teknologi Pemerintah Digital Daerah",
    ],
    "Direktorat Jenderal Ekosistem Digital": [
        "Direktorat Pengembangan Ekosistem Digital",
        "Direktorat Kecerdasan Artifisial dan Ekosistem Teknologi Baru",
        "Direktorat Pos dan Penyiaran",
        "Direktorat Layanan Ekosistem Digital",
        "Direktorat Pengendalian Ekosistem Digital",
    ],
    "Direktorat Jenderal Pengawasan Ruang Digital": [
        "Direktorat Strategi dan Kebijakan Pengawasan Ruang Digital",
        "Direktorat Pengawasan Sertifikasi dan Transaksi Elektronik",
        "Direktorat Penyidikan Digital",
        "Direktorat Pengendalian Ruang Digital",
    ],
    "Direktorat Jenderal Komunikasi Publik dan Media": [
        "Direktorat Informasi Publik",
        "Direktorat Komunikasi Publik",
        "Direktorat Kemitraan Komunikasi Lembaga dan Kehumasan",
        "Direktorat Ekosistem Media",
    ],
    "Badan Pengembangan Sumber Daya Manusia Komunikasi dan Digital": [
        "Pusat Pengembangan Ekosistem Sumber Daya Manusia Komunikasi dan Digital",
        "Pusat Pengembangan Talenta Digital",
        "Pusat Pengembangan Literasi Digital",
        "Pusat Pengembangan Aparatur Komunikasi dan Digital",
    ],
}

# Alias kesetaraan nama satker (misal perubahan nomenklatur PUSAKA & Ditjen era Kominfo ke Komdigi)
ALIAS_SATKER: list[set[str]] = [
    {
        "pusat kebijakan strategis",
        "pusat kebijakan strategis (pusaka)",
        "pusat kebijakan dan inovasi",
        "pusat kebijakan dan inovasi (pusaka)",
        "pusaka",
    },
    {
        "direktorat jenderal teknologi pemerintah digital",
        "direktorat jenderal aplikasi informatika",
        "direktorat aplikasi pemerintah digital",
    },
    {
        "direktorat jenderal ekosistem digital",
        "direktorat jenderal penyelenggaraan pos dan informatika",
        "direktorat pos dan penyiaran",
    },
    {
        "direktorat jenderal komunikasi publik dan media",
        "direktorat jenderal informasi dan komunikasi publik",
        "direktorat komunikasi publik",
    },
    {
        "direktorat jenderal infrastruktur digital",
        "direktorat jenderal sumber daya dan perangkat pos dan informatika",
    },
    {
        "badan pengembangan sumber daya manusia komunikasi dan digital",
        "badan pengembangan sdm komdigi",
        "badan litbang sdm",
    },
]


def bersihkan_nama_satker(nama: str | None) -> str:
    """Hapus tanda kurung, nomor urut di depan, dan spasi berlebih untuk standarisasi."""
    if not nama:
        return ""
    tanpa_nomor = re.sub(r"^\d+\.\s*", "", nama.strip())
    tanpa_kurung = re.sub(r"\s*\([^)]*\)", "", tanpa_nomor).strip().lower()
    return " ".join(tanpa_kurung.split())


def dapatkan_anggota_hierarki(nama_satker: str | None) -> list[str]:
    """
    Jika nama_satker adalah nama Induk (Ditjen / BPSDM), kembalikan seluruh Direktorat/Pusat
    di bawahnya beserta nama induknya. Jika nama_satker adalah PUSAKA, kembalikan aliasnya.
    """
    if not nama_satker:
        return []
    clean = bersihkan_nama_satker(nama_satker)
    hasil = [nama_satker.strip()]

    # Cek apakah cocok dengan salah satu grup alias (misal PUSAKA)
    for grup_alias in ALIAS_SATKER:
        if clean in grup_alias or nama_satker.strip().lower() in grup_alias:
            for item in grup_alias:
                if item not in hasil:
                    hasil.append(item)

    # Cek apakah nama_satker (atau aliasnya) merupakan Induk Eselon I (Ditjen / BPSDM)
    clean_candidates = {bersihkan_nama_satker(h) for h in hasil}
    for induk, daftar_anak in HIERARKI_SATKER_KOMDIGI.items():
        if bersihkan_nama_satker(induk) in clean_candidates:
            if induk not in hasil:
                hasil.append(induk)
            for anak in daftar_anak:
                if anak not in hasil:
                    hasil.append(anak)

    return hasil


def satker_cocok(satker_a: str | None, satker_b: str | None) -> bool:
    """
    Periksa apakah dua nama satker merujuk pada satuan kerja yang sama atau berada
    dalam hierarki Induk -> Direktorat yang sama.
    """
    if not satker_a or not satker_b:
        return satker_a == satker_b

    ca = bersihkan_nama_satker(satker_a)
    cb = bersihkan_nama_satker(satker_b)
    if ca == cb:
        return True

    # Cek alias (misal PUSAKA lama vs baru)
    for grup_alias in ALIAS_SATKER:
        if ca in grup_alias and cb in grup_alias:
            return True

    # Cek apakah salah satu adalah Induk Eselon I dari yang lain
    for induk, daftar_anak in HIERARKI_SATKER_KOMDIGI.items():
        c_induk = bersihkan_nama_satker(induk)
        c_anak_set = {bersihkan_nama_satker(a) for a in daftar_anak}
        if (ca == c_induk and cb in c_anak_set) or (cb == c_induk and ca in c_anak_set):
            return True

    return False


def bangun_filter_satker(model_column: Any, satker_target: str) -> Any:
    """
    Buat ekspresi SQLAlchemy OR yang mencocokkan nama satker secara presisi
    serta mendukung filter tingkat Induk (Ditjen / BPSDM) ke seluruh Direktorat di bawahnya.
    """
    anggota = dapatkan_anggota_hierarki(satker_target)
    klausul = [model_column.ilike(satker_target.strip())]

    clean_target = bersihkan_nama_satker(satker_target)
    if clean_target:
        klausul.append(model_column.ilike(f"%{clean_target}%"))

    for item in anggota:
        klausul.append(model_column.ilike(item))
        c_item = bersihkan_nama_satker(item)
        if c_item:
            klausul.append(model_column.ilike(f"%{c_item}%"))

    return or_(*klausul)
