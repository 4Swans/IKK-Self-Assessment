import uuid
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, undefer

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.asesmen import Asesmen, StatusAsesmen
from app.models.instrumen import Dimensi, Instrumen, Pertanyaan
from app.models.jawaban import Jawaban
from app.models.kebijakan import Kebijakan
from app.models.pengguna import Pengguna
from app.models.periode import Periode
from app.models.riwayat import Riwayat
from app.schemas.asesmen import (
    AsesmenAksiPayload,
    AsesmenBaca,
    AsesmenCatatanJfakPayload,
    AsesmenJfakUpdate,
    HasilSkorBaca,
    NilaiDimensiBaca,
)
from app.services.berkas import (
    bangun_response_berkas,
    hapus_berkas_disk_aman,
    validasi_dan_baca_berkas,
)
from app.services.satker import satker_cocok
from app.services.skoring import (
    HasilSkoring,
    SkorBelumDikonfigurasi,
    hitung_skor_kebijakan,
)

router = APIRouter(prefix="/asesmen", tags=["Asesmen"])


def _cek_akses_asesmen(
    asesmen: Asesmen,
    current_user: Pengguna,
    perlu_edit: bool = False,
    aksi_label: str = "mengakses",
) -> None:
    """Validasi isolasi Satuan Kerja dan kunci status asesmen saat Analis mengedit."""
    if (
        current_user.peran == "ANALIS"
        and asesmen.kebijakan
        and asesmen.kebijakan.satuan_kerja
        and not satker_cocok(asesmen.kebijakan.satuan_kerja, current_user.satuan_kerja)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Anda tidak memiliki hak akses {aksi_label} asesmen dari satuan kerja lain.",
        )

    if perlu_edit and current_user.peran == "ANALIS":
        if asesmen.status not in [StatusAsesmen.DRAF, StatusAsesmen.PERLU_PERBAIKAN]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Asesmen berstatus {asesmen.status} tidak dapat diubah.",
            )


async def hitung_skor_asesmen_internal(
    asesmen_id: uuid.UUID, db: AsyncSession
) -> HasilSkorBaca | None:
    """Helper internal untuk mengambil data instrumen dan menghitung skor asesmen."""
    stmt = (
        select(Asesmen)
        .where(Asesmen.id == asesmen_id)
        .options(
            selectinload(Asesmen.kebijakan)
            .selectinload(Kebijakan.periode)
            .selectinload(Periode.instrumen),
            selectinload(Asesmen.jawaban_list).selectinload(Jawaban.opsi),
        )
    )
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        return None

    periode = asesmen.kebijakan.periode
    instrumen_id = periode.instrumen_id

    # Ambil konfigurasi instrumen lengkap
    stmt_inst = (
        select(Instrumen)
        .where(Instrumen.id == instrumen_id)
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
        return None

    # Bentuk dict dimensi_config dan jawaban_skor
    dimensi_config = []
    total_pertanyaan = 0
    for dim in instrumen.dimensi_list:
        pert_list = []
        for p in dim.pertanyaan_list:
            total_pertanyaan += 1
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

    # Peta jawaban pertanyaan_id -> kode & skor
    peta_pertanyaan = {p.id: p.kode for dim in instrumen.dimensi_list for p in dim.pertanyaan_list}
    jawaban_skor: dict[str, Decimal] = {}
    for j in asesmen.jawaban_list:
        kode_p = peta_pertanyaan.get(j.pertanyaan_id)
        if kode_p and j.opsi:
            jawaban_skor[kode_p] = j.opsi.skor

    # Jika belum semua pertanyaan dijawab, kembalikan None atau hitung parsial jika lengkap
    if len(jawaban_skor) < total_pertanyaan:
        return None

    ambang_list = [(a.min_nilai, a.kualifikasi) for a in instrumen.ambang_kualifikasi_list]

    melibatkan = (
        asesmen.melibatkan_jfak if asesmen.melibatkan_jfak is not None else periode.melibatkan_jfak
    )

    try:
        hasil: HasilSkoring = hitung_skor_kebijakan(
            melibatkan_jfak=melibatkan,
            bobot_profil=instrumen.bobot_profil,
            skor_profil_ya=instrumen.skor_profil_ya,
            skor_profil_tidak=instrumen.skor_profil_tidak,
            dimensi_config=dimensi_config,
            jawaban_skor=jawaban_skor,
            ambang_kualifikasi=ambang_list,
        )
        return HasilSkorBaca(
            nilai_profil=hasil.nilai_profil,
            kontribusi_profil=hasil.kontribusi_profil,
            dimensi={
                k: NilaiDimensiBaca(
                    kode=v.kode,
                    nama=v.nama,
                    bobot_persen=v.bobot_persen,
                    nilai_murni=v.nilai_murni,
                    kontribusi_total=v.kontribusi_total,
                    nilai_tampilan=v.nilai_tampilan,
                )
                for k, v in hasil.dimensi.items()
            },
            nilai_total=hasil.nilai_total,
            nilai_total_tampilan=hasil.nilai_total_tampilan,
            kualifikasi=hasil.kualifikasi,
        )
    except (SkorBelumDikonfigurasi, ValueError):
        return None


async def ambil_asesmen_lengkap(
    asesmen_id: uuid.UUID,
    db: AsyncSession,
    current_user: Pengguna | None = None,
) -> AsesmenBaca:
    stmt = (
        select(Asesmen)
        .where(Asesmen.id == asesmen_id)
        .options(
            selectinload(Asesmen.kebijakan),
            selectinload(Asesmen.jawaban_list).selectinload(Jawaban.bukti_dukung_list),
        )
    )
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    if (
        current_user
        and current_user.peran == "ANALIS"
        and asesmen.kebijakan
        and asesmen.kebijakan.satuan_kerja
        and not satker_cocok(asesmen.kebijakan.satuan_kerja, current_user.satuan_kerja)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki hak akses melihat asesmen dari satuan kerja lain.",
        )

    stmt_riwayat = (
        select(Riwayat)
        .where(
            Riwayat.entitas == "asesmen",
            Riwayat.entitas_id == asesmen.id,
            Riwayat.aksi.in_(["kembalikan", "buka_kembali"]),
        )
        .order_by(Riwayat.waktu.desc())
    )
    res_riwayat = await db.execute(stmt_riwayat)
    riwayat_terakhir = res_riwayat.scalars().first()

    baca = AsesmenBaca.model_validate(asesmen)
    baca.catatan_koordinator = riwayat_terakhir.catatan if riwayat_terakhir else None
    baca.skor_terkini = await hitung_skor_asesmen_internal(asesmen_id, db)
    return baca


@router.get("/{asesmen_id}", response_model=AsesmenBaca)
async def detail_asesmen(
    asesmen_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    return await ambil_asesmen_lengkap(asesmen_id, db, current_user=current_user)


@router.get("/kebijakan/{kebijakan_id}", response_model=AsesmenBaca)
async def ambil_asesmen_per_kebijakan(
    kebijakan_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    stmt = (
        select(Asesmen)
        .where(Asesmen.kebijakan_id == kebijakan_id)
        .options(
            selectinload(Asesmen.kebijakan),
            selectinload(Asesmen.jawaban_list).selectinload(Jawaban.bukti_dukung_list),
        )
    )
    res = await db.execute(stmt)
    asesmen = res.scalars().first()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen untuk kebijakan ini belum ada."
        )

    if (
        current_user.peran == "ANALIS"
        and asesmen.kebijakan
        and asesmen.kebijakan.satuan_kerja
        and not satker_cocok(asesmen.kebijakan.satuan_kerja, current_user.satuan_kerja)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki hak akses melihat asesmen dari satuan kerja lain.",
        )

    stmt_riwayat = (
        select(Riwayat)
        .where(
            Riwayat.entitas == "asesmen",
            Riwayat.entitas_id == asesmen.id,
            Riwayat.aksi.in_(["kembalikan", "buka_kembali"]),
        )
        .order_by(Riwayat.waktu.desc())
    )
    res_riwayat = await db.execute(stmt_riwayat)
    riwayat_terakhir = res_riwayat.scalars().first()

    baca = AsesmenBaca.model_validate(asesmen)
    baca.catatan_koordinator = riwayat_terakhir.catatan if riwayat_terakhir else None
    baca.skor_terkini = await hitung_skor_asesmen_internal(asesmen.id, db)
    return baca


@router.post(
    "/{asesmen_id}/ajukan",
    response_model=AsesmenBaca,
    dependencies=[Depends(require_roles(["ANALIS", "ADMIN"]))],
)
async def ajukan_asesmen(
    asesmen_id: uuid.UUID,
    payload: AsesmenAksiPayload | None = None,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    stmt = (
        select(Asesmen)
        .where(Asesmen.id == asesmen_id)
        .options(
            selectinload(Asesmen.kebijakan).selectinload(Kebijakan.periode),
            selectinload(Asesmen.jawaban_list).selectinload(Jawaban.bukti_dukung_list),
        )
    )
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    _cek_akses_asesmen(asesmen, current_user, perlu_edit=False, aksi_label="mengajukan")

    if asesmen.status not in [StatusAsesmen.DRAF, StatusAsesmen.PERLU_PERBAIKAN]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tidak dapat mengajukan asesmen dengan status {asesmen.status}.",
        )

    # Ambil seluruh pertanyaan pada instrumen aktif untuk validasi kelengkapan 11 indikator
    instrumen_id = asesmen.kebijakan.periode.instrumen_id
    stmt_inst = (
        select(Instrumen)
        .where(Instrumen.id == instrumen_id)
        .options(selectinload(Instrumen.dimensi_list).selectinload(Dimensi.pertanyaan_list))
    )
    res_inst = await db.execute(stmt_inst)
    instrumen = res_inst.scalars().first()
    if not instrumen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instrumen pengukuran periode ini tidak ditemukan.",
        )

    semua_pertanyaan = sorted(
        (p for d in instrumen.dimensi_list for p in d.pertanyaan_list),
        key=lambda q: q.kode,
    )
    peta_jawaban = {j.pertanyaan_id: j for j in asesmen.jawaban_list}

    belum_opsi: list[str] = []
    belum_bukti: list[str] = []
    for p in semua_pertanyaan:
        j = peta_jawaban.get(p.id)
        if not j or not j.opsi_id:
            belum_opsi.append(p.kode)
        elif not j.bukti_dukung_list and not (j.tautan_bukti and j.tautan_bukti.strip()):
            belum_bukti.append(p.kode)

    if belum_opsi:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Seluruh indikator wajib dipilih opsi jawabannya sebelum diajukan. "
                f"Indikator belum terjawab: {', '.join(belum_opsi)}."
            ),
        )
    if belum_bukti:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Setiap indikator wajib memiliki bukti dukung (unggah berkas atau tautan publik). "
                f"Indikator belum memiliki bukti: {', '.join(belum_bukti)}."
            ),
        )

    asesmen.status = StatusAsesmen.DIAJUKAN
    db.add(
        Riwayat(
            entitas="asesmen",
            entitas_id=asesmen.id,
            aksi="ajukan",
            pelaku_id=current_user.id,
            catatan=payload.catatan if payload else None,
        )
    )
    await db.commit()

    return await ambil_asesmen_lengkap(asesmen.id, db)


@router.post(
    "/{asesmen_id}/kembalikan",
    response_model=AsesmenBaca,
    dependencies=[Depends(require_roles(["KOORDINATOR", "ADMIN"]))],
)
async def kembalikan_asesmen(
    asesmen_id: uuid.UUID,
    payload: AsesmenAksiPayload,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    if not payload.catatan or not payload.catatan.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Catatan perbaikan wajib diisi saat mengembalikan asesmen ke Analis.",
        )

    stmt = select(Asesmen).where(Asesmen.id == asesmen_id)
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    if asesmen.status != StatusAsesmen.DIAJUKAN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hanya asesmen berstatus DIAJUKAN yang dapat dikembalikan.",
        )

    asesmen.status = StatusAsesmen.PERLU_PERBAIKAN
    db.add(
        Riwayat(
            entitas="asesmen",
            entitas_id=asesmen.id,
            aksi="kembalikan",
            pelaku_id=current_user.id,
            catatan=payload.catatan,
        )
    )
    await db.commit()

    return await ambil_asesmen_lengkap(asesmen.id, db)


@router.post(
    "/{asesmen_id}/setujui",
    response_model=AsesmenBaca,
    dependencies=[Depends(require_roles(["KOORDINATOR", "ADMIN"]))],
)
async def setujui_asesmen(
    asesmen_id: uuid.UUID,
    payload: AsesmenAksiPayload | None = None,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    stmt = select(Asesmen).where(Asesmen.id == asesmen_id)
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    if asesmen.status != StatusAsesmen.DIAJUKAN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hanya asesmen berstatus DIAJUKAN yang dapat disetujui oleh Koordinator.",
        )

    asesmen.status = StatusAsesmen.DISETUJUI
    db.add(
        Riwayat(
            entitas="asesmen",
            entitas_id=asesmen.id,
            aksi="setujui",
            pelaku_id=current_user.id,
            catatan=payload.catatan if payload else None,
        )
    )
    await db.commit()

    return await ambil_asesmen_lengkap(asesmen.id, db)


@router.post(
    "/{asesmen_id}/buka-kembali",
    response_model=AsesmenBaca,
    dependencies=[Depends(require_roles(["KOORDINATOR", "ADMIN"]))],
)
async def buka_kembali_asesmen(
    asesmen_id: uuid.UUID,
    payload: AsesmenAksiPayload | None = None,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    stmt = select(Asesmen).where(Asesmen.id == asesmen_id)
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    if asesmen.status not in [StatusAsesmen.DISETUJUI, StatusAsesmen.TERKIRIM_SI_IKK]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Hanya asesmen yang berstatus DISETUJUI yang dapat ditarik status persetujuannya."
            ),
        )

    catatan = (
        payload.catatan.strip()
        if (payload and payload.catatan and payload.catatan.strip())
        else "Persetujuan ditarik oleh Koordinator agar dapat diasesmen kembali."
    )

    asesmen.status = StatusAsesmen.PERLU_PERBAIKAN
    db.add(
        Riwayat(
            entitas="asesmen",
            entitas_id=asesmen.id,
            aksi="tarik_persetujuan",
            pelaku_id=current_user.id,
            catatan=catatan,
        )
    )
    await db.commit()

    return await ambil_asesmen_lengkap(asesmen.id, db)


@router.post(
    "/{asesmen_id}/tandai-terkirim",
    response_model=AsesmenBaca,
    dependencies=[Depends(require_roles(["KOORDINATOR", "ADMIN"]))],
)
async def tandai_terkirim_si_ikk(
    asesmen_id: uuid.UUID,
    payload: AsesmenAksiPayload | None = None,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    stmt = select(Asesmen).where(Asesmen.id == asesmen_id)
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    if asesmen.status != StatusAsesmen.DISETUJUI:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hanya asesmen yang sudah DISETUJUI yang dapat ditandai TERKIRIM_SI_IKK.",
        )

    asesmen.status = StatusAsesmen.TERKIRIM_SI_IKK
    db.add(
        Riwayat(
            entitas="asesmen",
            entitas_id=asesmen.id,
            aksi="tandai_terkirim",
            pelaku_id=current_user.id,
            catatan=payload.catatan if payload else None,
        )
    )
    await db.commit()

    return await ambil_asesmen_lengkap(asesmen.id, db)


@router.put("/{asesmen_id}/jfak", response_model=AsesmenBaca)
async def perbarui_jfak_asesmen(
    asesmen_id: uuid.UUID,
    payload: AsesmenJfakUpdate,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    """Memperbarui status keterlibatan JFAK pada form asesmen kebijakan."""
    stmt = select(Asesmen).where(Asesmen.id == asesmen_id).options(selectinload(Asesmen.kebijakan))
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    _cek_akses_asesmen(asesmen, current_user, perlu_edit=True, aksi_label="mengubah")

    asesmen.melibatkan_jfak = payload.melibatkan_jfak
    if payload.penjelasan_jfak is not None:
        asesmen.penjelasan_jfak = payload.penjelasan_jfak
    if payload.surat_penunjukan_jfak is not None:
        asesmen.surat_penunjukan_jfak = payload.surat_penunjukan_jfak

    await db.commit()
    return await ambil_asesmen_lengkap(asesmen.id, db, current_user=current_user)


@router.put(
    "/{asesmen_id}/catatan-jfak",
    response_model=AsesmenBaca,
    dependencies=[Depends(require_roles(["KOORDINATOR", "ADMIN"]))],
)
async def simpan_catatan_koordinator_jfak(
    asesmen_id: uuid.UUID,
    payload: AsesmenCatatanJfakPayload,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    """Menyimpan catatan verifikasi Koordinator khusus untuk indikator Keterlibatan JFAK."""
    stmt = select(Asesmen).where(Asesmen.id == asesmen_id)
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    asesmen.catatan_koordinator_jfak = payload.catatan_koordinator_jfak
    await db.commit()
    return await ambil_asesmen_lengkap(asesmen.id, db, current_user=current_user)


@router.post("/{asesmen_id}/unggah-bukti-jfak", response_model=AsesmenBaca)
async def unggah_bukti_jfak(
    asesmen_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    """Mengunggah berkas SK / Surat Penunjukan Tim JFAK (PDF/Word) langsung pada asesmen."""
    stmt = select(Asesmen).where(Asesmen.id == asesmen_id).options(selectinload(Asesmen.kebijakan))
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    _cek_akses_asesmen(asesmen, current_user, perlu_edit=True, aksi_label="mengubah")

    contents, safe_display_name, ext, canonical_mime, _ = await validasi_dan_baca_berkas(
        file,
        allowed_exts={".pdf", ".docx", ".doc"},
        max_mb=settings.MAX_UPLOAD_MB,
        pesan_format_salah=(
            f"Format file tidak didukung ({Path(file.filename or '').suffix.lower()}). "
            "Harap gunakan dokumen PDF atau Word (.pdf, .docx, .doc)."
        ),
    )

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"jfak_{asesmen_id}_{uuid.uuid4().hex[:8]}{ext}"
    target_path = upload_dir / safe_name
    target_path.write_bytes(contents)

    hapus_berkas_disk_aman(asesmen.surat_penunjukan_jfak)

    asesmen.surat_penunjukan_jfak = str(target_path)
    asesmen.sk_jfak_nama = safe_display_name
    asesmen.sk_jfak_mime = canonical_mime
    asesmen.sk_jfak_ukuran = len(contents)
    asesmen.sk_jfak_konten = contents if settings.SIMPAN_KONTEN_DB else None
    await db.commit()
    return await ambil_asesmen_lengkap(asesmen.id, db, current_user=current_user)


@router.get("/{asesmen_id}/unduh-bukti-jfak")
async def unduh_bukti_jfak(
    asesmen_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Mengunduh atau menampilkan berkas SK JFAK yang diunggah pada asesmen."""
    stmt = (
        select(Asesmen)
        .where(Asesmen.id == asesmen_id)
        .options(selectinload(Asesmen.kebijakan), undefer(Asesmen.sk_jfak_konten))
    )
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    _cek_akses_asesmen(
        asesmen, current_user, perlu_edit=False, aksi_label="mengunduh berkas SK JFAK"
    )

    if not asesmen.surat_penunjukan_jfak and not asesmen.sk_jfak_konten:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Berkas SK JFAK belum diunggah atau tidak ditemukan.",
        )

    nama_file = asesmen.sk_jfak_nama or Path(asesmen.surat_penunjukan_jfak or "SK_JFAK.pdf").name
    return bangun_response_berkas(
        disk_path=asesmen.surat_penunjukan_jfak,
        konten=asesmen.sk_jfak_konten,
        nama_file=nama_file,
        mime=asesmen.sk_jfak_mime,
        not_found_detail="Berkas SK JFAK belum diunggah atau tidak ditemukan.",
    )


@router.delete("/{asesmen_id}/hapus-bukti-jfak", response_model=AsesmenBaca)
async def hapus_bukti_jfak(
    asesmen_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsesmenBaca:
    """Menghapus berkas SK / Surat Penunjukan Tim JFAK pada asesmen."""
    stmt = select(Asesmen).where(Asesmen.id == asesmen_id).options(selectinload(Asesmen.kebijakan))
    res = await db.execute(stmt)
    asesmen = res.scalar_one_or_none()
    if not asesmen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asesmen tidak ditemukan."
        )

    _cek_akses_asesmen(asesmen, current_user, perlu_edit=True, aksi_label="menghapus berkas")

    hapus_berkas_disk_aman(asesmen.surat_penunjukan_jfak)

    asesmen.surat_penunjukan_jfak = None
    asesmen.sk_jfak_nama = None
    asesmen.sk_jfak_mime = None
    asesmen.sk_jfak_ukuran = None
    asesmen.sk_jfak_konten = None
    await db.commit()
    return await ambil_asesmen_lengkap(asesmen.id, db, current_user=current_user)
