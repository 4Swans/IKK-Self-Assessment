import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.asesmen import Asesmen, StatusAsesmen
from app.models.instrumen import Dimensi, Instrumen, Pertanyaan
from app.models.jawaban import Jawaban
from app.models.kebijakan import Kebijakan
from app.models.pengguna import Pengguna
from app.models.periode import Periode
from app.schemas.kebijakan import (
    KebijakanBaca,
    KebijakanBuat,
    KebijakanUbah,
    PilihTigaKebijakanPayload,
)
from app.services.satker import bangun_filter_satker, satker_cocok
from app.services.skoring import hitung_skor_kebijakan

router = APIRouter(prefix="/kebijakan", tags=["Kebijakan Strategis"])


def cek_peringatan_rentang_tahun(tanggal_penetapan_tahun: int, tahun_periode: int) -> bool:
    """Beri peringatan jika kebijakan ditetapkan > 3 tahun sebelum tahun periode."""
    return (tahun_periode - tanggal_penetapan_tahun) > 3 or (
        tahun_periode < tanggal_penetapan_tahun
    )


@router.post(
    "",
    response_model=KebijakanBaca,
    status_code=status.HTTP_201_CREATED,
)
async def tambah_kebijakan(
    payload: KebijakanBuat,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KebijakanBaca:
    # Hanya Analis Satker yang dapat menambahkan kebijakan kandidat baru
    if current_user.peran != "ANALIS":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Analis Satuan Kerja yang dapat menambahkan kebijakan kandidat.",
        )

    # Verifikasi periode
    stmt_p = select(Periode).where(Periode.id == payload.periode_id)
    res_p = await db.execute(stmt_p)
    periode = res_p.scalar_one_or_none()
    if not periode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Periode tidak ditemukan."
        )

    # Tentukan satuan kerja asal kebijakan
    satuan_kerja = (
        payload.satuan_kerja
        if (current_user.peran in ["KOORDINATOR", "ADMIN"] and payload.satuan_kerja)
        else current_user.satuan_kerja
    )

    kebijakan = Kebijakan(
        periode_id=payload.periode_id,
        nama=payload.nama,
        jenis_dasar_hukum=payload.jenis_dasar_hukum,
        nomor_dasar_hukum=payload.nomor_dasar_hukum,
        tanggal_penetapan=payload.tanggal_penetapan,
        rekomendasi=payload.rekomendasi,
        satuan_kerja=satuan_kerja,
        pembuat_id=current_user.id,
    )
    db.add(kebijakan)
    await db.flush()

    # Buat entitas Asesmen otomatis untuk kebijakan ini
    analis_id = payload.analis_id or current_user.id
    asesmen = Asesmen(
        kebijakan_id=kebijakan.id,
        status=StatusAsesmen.DRAF,
        analis_id=analis_id,
    )
    db.add(asesmen)

    await db.commit()
    await db.refresh(kebijakan)

    baca = KebijakanBaca.model_validate(kebijakan)
    baca.peringatan_rentang_tahun = cek_peringatan_rentang_tahun(
        kebijakan.tanggal_penetapan.year, periode.tahun
    )
    return baca


@router.get("", response_model=list[KebijakanBaca])
async def daftar_kebijakan(
    periode_id: uuid.UUID,
    satuan_kerja: str | None = None,
    q: str | None = None,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[KebijakanBaca]:
    # Ambil periode untuk tahun
    stmt_p = select(Periode).where(Periode.id == periode_id)
    res_p = await db.execute(stmt_p)
    periode = res_p.scalar_one_or_none()
    if not periode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Periode tidak ditemukan."
        )

    # Ambil instrumen untuk menghitung skor & kualifikasi real-time
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

    dimensi_config = []
    peta_pertanyaan_kode: dict[uuid.UUID, str] = {}
    ambang_list: list[tuple[Decimal, str]] = []

    if instrumen:
        for dim in sorted(instrumen.dimensi_list, key=lambda d: d.kode):
            pert_list = []
            for p in sorted(dim.pertanyaan_list, key=lambda pq: pq.kode):
                peta_pertanyaan_kode[p.id] = p.kode
                pert_list.append({"kode": p.kode, "bobot_relatif": p.bobot_relatif})
            dimensi_config.append(
                {
                    "kode": dim.kode,
                    "nama": dim.nama,
                    "bobot": dim.bobot,
                    "pertanyaan": pert_list,
                }
            )
        ambang_list = [(a.min_nilai, a.kualifikasi) for a in instrumen.ambang_kualifikasi_list]

    stmt = (
        select(Kebijakan)
        .where(Kebijakan.periode_id == periode_id)
        .options(
            selectinload(Kebijakan.asesmen)
            .selectinload(Asesmen.jawaban_list)
            .selectinload(Jawaban.opsi)
        )
    )

    # Isolasi data satker: Analis hanya dapat melihat kebijakan dari satkernya sendiri
    if current_user.peran == "ANALIS":
        if current_user.satuan_kerja:
            stmt = stmt.where(
                bangun_filter_satker(Kebijakan.satuan_kerja, current_user.satuan_kerja)
            )
    elif satuan_kerja:
        stmt = stmt.where(bangun_filter_satker(Kebijakan.satuan_kerja, satuan_kerja))

    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Kebijakan.nama.ilike(term),
                Kebijakan.nomor_dasar_hukum.ilike(term),
                Kebijakan.rekomendasi.ilike(term),
            )
        )

    stmt = stmt.order_by(Kebijakan.updated_at.desc(), Kebijakan.created_at.desc())
    res = await db.execute(stmt)
    items = res.scalars().all()

    urutan_prioritas_status = {
        "DIAJUKAN": 0,
        "PERLU_PERBAIKAN": 1,
        "DISETUJUI": 2,
        "TERKIRIM_SI_IKK": 3,
        "DRAF": 4,
    }

    hasil: list[KebijakanBaca] = []
    for item in items:
        kb = KebijakanBaca.model_validate(item)
        kb.peringatan_rentang_tahun = cek_peringatan_rentang_tahun(
            item.tanggal_penetapan.year, periode.tahun
        )
        asesmen = item.asesmen
        if asesmen:
            kb.status_asesmen = (
                asesmen.status.value if hasattr(asesmen.status, "value") else str(asesmen.status)
            )
            jawaban_skor: dict[str, Decimal] = {}
            for j in asesmen.jawaban_list:
                kode_p = peta_pertanyaan_kode.get(j.pertanyaan_id)
                if kode_p and j.opsi is not None:
                    jawaban_skor[kode_p] = j.opsi.skor

            kb.jumlah_jawaban = len(jawaban_skor)
            if instrumen and (kb.jumlah_jawaban > 0 or kb.status_asesmen != "DRAF"):
                melibatkan_jfak = (
                    asesmen.melibatkan_jfak
                    if asesmen.melibatkan_jfak is not None
                    else periode.melibatkan_jfak
                )
                skor_profil_tidak = instrumen.skor_profil_tidak or Decimal("0")
                hasil_skoring = hitung_skor_kebijakan(
                    melibatkan_jfak=melibatkan_jfak,
                    bobot_profil=instrumen.bobot_profil,
                    skor_profil_ya=instrumen.skor_profil_ya,
                    skor_profil_tidak=skor_profil_tidak,
                    dimensi_config=dimensi_config,
                    jawaban_skor=jawaban_skor,
                    ambang_kualifikasi=ambang_list,
                    izinkan_parsial=True,
                )
                kb.skor_total = float(hasil_skoring.nilai_total_tampilan)
                kb.kualifikasi = hasil_skoring.kualifikasi

        hasil.append(kb)

    hasil.sort(
        key=lambda x: (
            urutan_prioritas_status.get(x.status_asesmen, 9),
            -x.updated_at.timestamp(),
        )
    )
    return hasil


@router.get("/{kebijakan_id}", response_model=KebijakanBaca)
async def detail_kebijakan(
    kebijakan_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KebijakanBaca:
    stmt = select(Kebijakan).where(Kebijakan.id == kebijakan_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Kebijakan tidak ditemukan."
        )

    # Analis tidak boleh mengakses kebijakan satker lain
    if (
        current_user.peran == "ANALIS"
        and item.satuan_kerja
        and not satker_cocok(item.satuan_kerja, current_user.satuan_kerja)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki hak akses melihat kebijakan dari satuan kerja lain.",
        )

    stmt_p = select(Periode).where(Periode.id == item.periode_id)
    res_p = await db.execute(stmt_p)
    periode = res_p.scalar_one_or_none()
    tahun_periode = periode.tahun if periode else 2026

    kb = KebijakanBaca.model_validate(item)
    kb.peringatan_rentang_tahun = cek_peringatan_rentang_tahun(
        item.tanggal_penetapan.year, tahun_periode
    )
    return kb


@router.put(
    "/{kebijakan_id}",
    response_model=KebijakanBaca,
)
async def ubah_kebijakan(
    kebijakan_id: uuid.UUID,
    payload: KebijakanUbah,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KebijakanBaca:
    stmt = select(Kebijakan).where(Kebijakan.id == kebijakan_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Kebijakan tidak ditemukan."
        )

    # Analis hanya boleh mengedit kebijakan dari satkernya sendiri
    if (
        current_user.peran == "ANALIS"
        and item.satuan_kerja
        and item.satuan_kerja != current_user.satuan_kerja
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki hak akses mengubah kebijakan dari satuan kerja lain.",
        )

    if payload.nama is not None:
        item.nama = payload.nama
    if payload.jenis_dasar_hukum is not None:
        item.jenis_dasar_hukum = payload.jenis_dasar_hukum
    if payload.nomor_dasar_hukum is not None:
        item.nomor_dasar_hukum = payload.nomor_dasar_hukum
    if payload.tanggal_penetapan is not None:
        item.tanggal_penetapan = payload.tanggal_penetapan
    if payload.rekomendasi is not None:
        item.rekomendasi = payload.rekomendasi

    if payload.satuan_kerja is not None and current_user.peran in ["KOORDINATOR", "ADMIN"]:
        item.satuan_kerja = payload.satuan_kerja

    if payload.dipilih_untuk_si_ikk is not None:
        if current_user.peran not in ["KOORDINATOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Hanya Koordinator Pusaka yang dapat menandai kebijakan untuk SI IKK LAN.",
            )
        if payload.dipilih_untuk_si_ikk:
            stmt_as = select(Asesmen).where(Asesmen.kebijakan_id == item.id)
            res_as = await db.execute(stmt_as)
            asesmen = res_as.scalar_one_or_none()
            if not asesmen or asesmen.status not in [
                StatusAsesmen.DISETUJUI,
                StatusAsesmen.TERKIRIM_SI_IKK,
            ]:
                st = asesmen.status if asesmen else "BELUM ADA ASESMEN"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Hanya kebijakan yang telah dinilai dan disetujui (status DISETUJUI) "
                        "oleh Koordinator yang dapat dipilih untuk SI IKK LAN. "
                        f"Status saat ini: {st}."
                    ),
                )
        item.dipilih_untuk_si_ikk = payload.dipilih_untuk_si_ikk

    await db.commit()
    await db.refresh(item)

    stmt_p = select(Periode).where(Periode.id == item.periode_id)
    res_p = await db.execute(stmt_p)
    periode = res_p.scalar_one_or_none()
    tahun_periode = periode.tahun if periode else 2026

    kb = KebijakanBaca.model_validate(item)
    kb.peringatan_rentang_tahun = cek_peringatan_rentang_tahun(
        item.tanggal_penetapan.year, tahun_periode
    )
    return kb


@router.delete(
    "/{kebijakan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def hapus_kebijakan(
    kebijakan_id: uuid.UUID,
    current_user: Pengguna = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    stmt = select(Kebijakan).where(Kebijakan.id == kebijakan_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Kebijakan tidak ditemukan."
        )

    if (
        current_user.peran == "ANALIS"
        and item.satuan_kerja
        and item.satuan_kerja != current_user.satuan_kerja
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki hak akses menghapus kebijakan dari satuan kerja lain.",
        )

    await db.delete(item)
    await db.commit()


@router.post(
    "/pilih-si-ikk",
    response_model=dict[str, str],
    dependencies=[Depends(require_roles(["KOORDINATOR", "ADMIN"]))],
)
async def pilih_tiga_kebijakan_si_ikk(
    payload: PilihTigaKebijakanPayload,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Tandai tepat 3 kebijakan terpilih untuk SI IKK dalam periode tertentu.

    Hanya kebijakan yang telah dinilai dan disetujui (status DISETUJUI atau TERKIRIM_SI_IKK)
    oleh Koordinator yang dapat dipilih untuk SI IKK LAN.
    """
    stmt = (
        select(Kebijakan)
        .options(selectinload(Kebijakan.asesmen))
        .where(
            Kebijakan.periode_id == payload.periode_id,
            Kebijakan.id.in_(payload.kebijakan_ids),
        )
    )
    res = await db.execute(stmt)
    kebijakan_terpilih = res.scalars().all()

    if len(kebijakan_terpilih) != 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tepat 3 kebijakan valid dalam periode ini harus dipilih.",
        )

    kebijakan_tidak_valid = []
    for k in kebijakan_terpilih:
        if not k.asesmen or k.asesmen.status not in [
            StatusAsesmen.DISETUJUI,
            StatusAsesmen.TERKIRIM_SI_IKK,
        ]:
            st = k.asesmen.status if k.asesmen else "BELUM ADA ASESMEN"
            kebijakan_tidak_valid.append(f"'{k.nama}' (status: {st})")

    if kebijakan_tidak_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Hanya kebijakan yang telah dilakukan assessment dan disetujui "
                "oleh Koordinator (status DISETUJUI) yang dapat dipilih untuk SI IKK LAN. "
                f"Kebijakan berikut belum memenuhi syarat: {', '.join(kebijakan_tidak_valid)}."
            ),
        )

    # Reset semua kebijakan dalam periode ini
    await db.execute(
        update(Kebijakan)
        .where(Kebijakan.periode_id == payload.periode_id)
        .values(dipilih_untuk_si_ikk=False)
    )

    # Tandai 3 kebijakan terpilih
    await db.execute(
        update(Kebijakan)
        .where(
            Kebijakan.periode_id == payload.periode_id,
            Kebijakan.id.in_(payload.kebijakan_ids),
        )
        .values(dipilih_untuk_si_ikk=True)
    )
    await db.commit()
    return {"pesan": "Tepat 3 kebijakan tervalidasi berhasil ditandai terpilih untuk SI IKK LAN."}
