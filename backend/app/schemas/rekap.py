import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.asesmen import HasilSkorBaca


class PeriodeRekapBaca(BaseModel):
    id: uuid.UUID
    tahun: int
    instansi: str
    melibatkan_jfak: bool
    tautan_surat_penunjukan: str | None
    lengkap_tiga_kebijakan: bool
    jumlah_kebijakan: int
    jumlah_terpilih: int


class IndikatorKesiapanBaca(BaseModel):
    kode: str
    skor: Decimal
    huruf_opsi: str | None
    ada_jawaban: bool
    ada_bukti: bool
    jumlah_berkas: int
    ada_tautan: bool
    tautan_dicek: bool
    nama_berkas_pertama: str | None = None


class DimensiNilaiRekap(BaseModel):
    kode: str
    nama: str
    bobot_persen: Decimal
    nilai_murni: Decimal
    kontribusi_total: Decimal
    nilai_tampilan: Decimal


class KebijakanRekapBaca(BaseModel):
    id: uuid.UUID
    nama: str
    jenis_dasar_hukum: str
    nomor_dasar_hukum: str
    tanggal_penetapan: date
    dipilih_untuk_si_ikk: bool
    rekomendasi: str | None
    satuan_kerja: str | None = None
    status_asesmen: str
    lengkap: bool
    profil_skor: Decimal
    dimensi: dict[str, DimensiNilaiRekap]
    nilai_total: Decimal
    nilai_total_tampilan: Decimal
    kualifikasi: str
    skor_terkini: HasilSkorBaca | None
    indikator: dict[str, IndikatorKesiapanBaca]


class MatriksKesiapanBuktiItem(BaseModel):
    kode_pertanyaan: str
    teks_pertanyaan: str
    dimensi_kode: str
    dimensi_nama: str
    bukti_dukung_wajib: str
    ketersediaan: dict[str, bool]  # str(kebijakan_id) -> bool
    ringkasan_bukti: dict[str, str]  # str(kebijakan_id) -> deskripsi berkas / tautan


class RekapPeriodeBaca(BaseModel):
    periode: PeriodeRekapBaca
    kebijakan_list: list[KebijakanRekapBaca]
    kebijakan_terpilih_list: list[KebijakanRekapBaca]
    matriks_kesiapan: list[MatriksKesiapanBuktiItem]
    semua_disetujui: bool
    siap_kirim_si_ikk: bool
