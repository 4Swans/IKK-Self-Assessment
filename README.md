# IKK Self-Assessment (Instrumen 2026)

![Python FastAPI](https://img.shields.io/badge/Python-3.12%20%7C%20FastAPI-blue.svg)
![React TypeScript](https://img.shields.io/badge/React-19%20%7C%20TypeScript%20%7C%20Vite-green.svg)
![Standard IKK](https://img.shields.io/badge/Instrumen-IKK%202026-orange.svg)

Aplikasi web internal Kementerian Komunikasi dan Digital untuk penyiapan, pengecekan keterbacaan berkas, dan penilaian mandiri (*self-assessment*) **Indeks Kualitas Kebijakan (IKK)** sebelum disalin secara resmi ke Sistem Informasi IKK (SI IKK).

---

## Fitur Utama

1. **Verifikasi Akun Dua Tahap (`@komdigi.go.id`)**:
   - Tahap 1: Pendaftaran menggunakan email kedinasan `@komdigi.go.id` dengan verifikasi kode OTP 6 digit.
   - Tahap 2: Persetujuan (*Human-in-the-Loop*) oleh Koordinator PUSAKA / Admin untuk memvalidasi penugasan Satuan Kerja.
2. **Hierarki Satuan Kerja Resmi Komdigi**:
   - Mendukung 6 kelompok unit Eselon I (5 Direktorat Jenderal + BPSDM Komdigi) beserta 26 Direktorat/Pusat dan Pusat Kebijakan Strategis (PUSAKA).
3. **Alur Kerja Terpisah Analis Satker & Koordinator**:
   - **Analis Satker**: Mendaftarkan kebijakan kandidat, mengisi 11 indikator di 4 dimensi + Profil JFAK, mengunggah/menggabungkan bukti dukung PDF, lalu mengajukan ke Koordinator.
   - **Koordinator PUSAKA**: Menerima notifikasi pengajuan masuk (`DIAJUKAN`), meninjau bukti dukung, menyetujui atau mengembalikan dengan catatan perbaikan, serta menetapkan 3 kebijakan terbaik di Tabel Rekap & Ekspor.
4. **Form Asesmen 4 Dimensi & Kalkulasi Presisi (`Decimal`)**:
   - **Profil Instansi (10%)**: Keterlibatan Jabatan Fungsional Analis Kebijakan (JFAK)
   - **Dimensi A (20%)**: Perencanaan Kebijakan (A1: 40%, A2: 40%, A3: 20%)
   - **Dimensi B (25%)**: Implementasi Kebijakan (B1: 35%, B2: 35%, B3: 30%)
   - **Dimensi C (30%)**: Evaluasi & Keberlanjutan Kebijakan (C1: 35%, C2: 35%, C3: 30%)
   - **Dimensi D (15%)**: Transparansi & Partisipasi Publik (D1: 50%, D2: 50%)
5. **Ekspor & Rekapitulasi**: Pengisian otomatis template Excel (`.xlsx`) dan cetak rekap laporan PDF.

---

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| **Frontend** | React 19, TypeScript (`strict`), Vite 6, React Router v7, Tailwind CSS |
| **Data Fetching** | TanStack Query v5 (OpenAPI client via Orval) |
| **Backend** | Python 3.12, FastAPI, Pydantic v2 |
| **Database** | PostgreSQL 16, SQLAlchemy 2 (`Mapped[]`), Alembic |
| **Keamanan** | Argon2 password hashing, JWT Cookie `httpOnly` + Bearer Token |
| **Pemrosesan Dokumen**| `pypdf` (ekstraksi lapisan teks & penggabungan PDF), `openpyxl` (ekspor Excel) |

---

## Panduan Menjalankan Proyek Secara Lokal

### 1. Menjalankan Backend
```bash
cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.seeds.muat --tahun 2026
uv run python -m app.seeds.seed_prod
uv run uvicorn app.main:app --reload --port 8000
```

### 2. Menjalankan Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Menjalankan via Docker Compose
```bash
docker compose up --build
```
