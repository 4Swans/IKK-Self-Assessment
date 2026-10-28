import uuid

from fastapi.testclient import TestClient


def test_registrasi_dan_verifikasi_satker(client: TestClient) -> None:
    test_nip = f"1995{uuid.uuid4().int % 10000000000000:014d}"
    test_username = f"budi_{uuid.uuid4().hex[:6]}"
    test_email = f"{test_username}@komdigi.go.id"

    # 1. Registrasi dengan domain selain @komdigi.go.id wajib ditolak (422)
    res_bukan_komdigi = client.post(
        "/api/v1/auth/daftar",
        json={
            "nama": "Budi Santoso",
            "nip": test_nip,
            "username": test_username,
            "email": f"{test_username}@gmail.com",
            "satuan_kerja": "Direktorat Jenderal Informasi dan Komunikasi Publik",
            "password": "Password123!",
        },
    )
    assert res_bukan_komdigi.status_code == 422

    # 2. Registrasi sukses dengan email resmi @komdigi.go.id -> Tahap 1 (MENUNGGU_OTP_EMAIL)
    res_reg = client.post(
        "/api/v1/auth/daftar",
        json={
            "nama": "Budi Santoso",
            "nip": test_nip,
            "username": test_username,
            "email": test_email,
            "satuan_kerja": "Direktorat Jenderal Informasi dan Komunikasi Publik",
            "password": "Password123!",
        },
    )
    assert res_reg.status_code == 201
    data_reg = res_reg.json()
    assert data_reg["status_verifikasi"] == "MENUNGGU_OTP_EMAIL"
    assert data_reg["butuh_verifikasi_otp"] is True
    assert data_reg["pengguna"]["email"] == test_email
    assert data_reg["pengguna"]["email_terverifikasi"] is False
    kode_otp = data_reg["kode_otp_simulasi"]
    assert kode_otp is not None and len(kode_otp) == 6
    user_id = data_reg["pengguna"]["id"]

    # 3. Login gagal sebelum kode OTP diverifikasi
    res_login_sebelum_otp = client.post(
        "/api/v1/auth/masuk",
        json={"username": test_email, "password": "Password123!"},
    )
    assert res_login_sebelum_otp.status_code == 403
    assert "otp" in res_login_sebelum_otp.json()["detail"].lower()

    # 4. Verifikasi OTP 6 digit -> naik ke Tahap 2 (MENUNGGU_VERIFIKASI / Human-in-the-loop)
    res_otp = client.post(
        "/api/v1/auth/verifikasi-otp",
        json={"email": test_email, "kode_otp": kode_otp},
    )
    assert res_otp.status_code == 200
    data_otp = res_otp.json()
    assert data_otp["status_verifikasi"] == "MENUNGGU_VERIFIKASI"
    assert data_otp["pengguna"]["email_terverifikasi"] is True

    # 5. Login masih ditolak sebelum disetujui Admin/Koordinator
    res_login_pending = client.post(
        "/api/v1/auth/masuk",
        json={"username": test_email, "password": "Password123!"},
    )
    assert res_login_pending.status_code == 403
    assert "persetujuan" in res_login_pending.json()["detail"].lower()

    # 6. Koordinator Pusaka login dan memverifikasi user (Human-in-the-loop)
    login_koor = client.post(
        "/api/v1/auth/masuk",
        json={"username": "koordinator", "password": "Password123!"},
    )
    assert login_koor.status_code == 200

    # Ambil daftar menunggu verifikasi
    res_waiting = client.get("/api/v1/pengguna/menunggu-verifikasi")
    assert res_waiting.status_code == 200
    waiting_users = res_waiting.json()
    assert any(u["id"] == user_id for u in waiting_users)

    # Setujui user
    res_verif = client.post(
        f"/api/v1/pengguna/{user_id}/verifikasi",
        json={"status": "AKTIF"},
    )
    assert res_verif.status_code == 200
    assert res_verif.json()["status_verifikasi"] == "AKTIF"

    # 7. User sekarang berhasil login menggunakan Email @komdigi.go.id maupun Username
    res_login_email = client.post(
        "/api/v1/auth/masuk",
        json={"username": test_email, "password": "Password123!"},
    )
    assert res_login_email.status_code == 200
    assert res_login_email.json()["pengguna"]["satuan_kerja"] == (
        "Direktorat Jenderal Informasi dan Komunikasi Publik"
    )

    res_login_username = client.post(
        "/api/v1/auth/masuk",
        json={"username": test_username, "password": "Password123!"},
    )
    assert res_login_username.status_code == 200


def test_isolasi_data_kebijakan_satker(client: TestClient) -> None:
    # 1. Login sebagai Analis 1 (Ditjen Aptika)
    client.post(
        "/api/v1/auth/masuk",
        json={"username": "analis", "password": "Password123!"},
    )

    # Ambil periode 2026
    res_rekap = client.get("/api/v1/rekap")
    assert res_rekap.status_code == 200
    periode_id = res_rekap.json()["periode"]["id"]
    res_tambah_a = client.post(
        "/api/v1/kebijakan",
        json={
            "periode_id": periode_id,
            "nama": "Kebijakan Khusus Aptika 2026",
            "jenis_dasar_hukum": "Permen",
            "nomor_dasar_hukum": "No 10/2026",
            "tanggal_penetapan": "2024-06-01",
        },
    )
    assert res_tambah_a.status_code == 201
    keb_a_id = res_tambah_a.json()["id"]

    # Daftar kebijakan untuk Analis 1
    res_list_a = client.get(f"/api/v1/kebijakan?periode_id={periode_id}")
    assert res_list_a.status_code == 200
    list_a_names = [k["nama"] for k in res_list_a.json()]
    assert "Kebijakan Khusus Aptika 2026" in list_a_names

    # 2. Login sebagai Analis 2 (Ditjen PPI)
    client.post(
        "/api/v1/auth/masuk",
        json={"username": "analis2", "password": "Password123!"},
    )
    # Analis 2 TIDAK boleh melihat kebijakan Analis 1 (Aptika)
    res_list_b = client.get(f"/api/v1/kebijakan?periode_id={periode_id}")
    assert res_list_b.status_code == 200
    list_b_names = [k["nama"] for k in res_list_b.json()]
    assert "Kebijakan Khusus Aptika 2026" not in list_b_names

    # Analis 2 coba buka detail kebijakan Aptika -> 403 Forbidden
    res_detail_forbidden = client.get(f"/api/v1/kebijakan/{keb_a_id}")
    assert res_detail_forbidden.status_code == 403

    # Analis 2 buat kebijakan PPI
    res_tambah_b = client.post(
        "/api/v1/kebijakan",
        json={
            "periode_id": periode_id,
            "nama": "Kebijakan Khusus PPI 2026",
            "jenis_dasar_hukum": "Permen",
            "nomor_dasar_hukum": "No 15/2026",
            "tanggal_penetapan": "2024-07-01",
        },
    )
    assert res_tambah_b.status_code == 201

    # 3. Login sebagai Koordinator Pusaka
    client.post(
        "/api/v1/auth/masuk",
        json={"username": "koordinator", "password": "Password123!"},
    )
    # Koordinator Pusaka melihat SEMUA kebijakan lintas satker
    res_list_koor = client.get(f"/api/v1/kebijakan?periode_id={periode_id}")
    assert res_list_koor.status_code == 200
    list_koor_names = [k["nama"] for k in res_list_koor.json()]
    assert "Kebijakan Khusus Aptika 2026" in list_koor_names
    assert "Kebijakan Khusus PPI 2026" in list_koor_names

    # Koordinator Pusaka memfilter per Satuan Kerja
    satker_q = "Direktorat Jenderal Aplikasi Informatika"
    res_filter_aptika = client.get(
        f"/api/v1/kebijakan?periode_id={periode_id}&satuan_kerja={satker_q}"
    )
    assert res_filter_aptika.status_code == 200
    filter_names = [k["nama"] for k in res_filter_aptika.json()]
    assert "Kebijakan Khusus Aptika 2026" in filter_names
    assert "Kebijakan Khusus PPI 2026" not in filter_names

    # 4. Uji isolasi rekap: Analis 2 (Ditjen PPI) hanya melihat kebijakan PPI di rekap
    client.post(
        "/api/v1/auth/masuk",
        json={"username": "analis2", "password": "Password123!"},
    )
    res_rekap_analis2 = client.get("/api/v1/rekap")
    assert res_rekap_analis2.status_code == 200
    rekap_names_analis2 = [k["nama"] for k in res_rekap_analis2.json()["kebijakan_list"]]
    assert "Kebijakan Khusus PPI 2026" in rekap_names_analis2
    assert "Kebijakan Khusus Aptika 2026" not in rekap_names_analis2

    # 5. Uji hak ekspor excel: Analis (di luar Pusaka) ditolak dengan 403 Forbidden
    res_ekspor_analis = client.get("/api/v1/rekap/ekspor-excel")
    assert res_ekspor_analis.status_code == 403
    assert "Akses ditolak" in res_ekspor_analis.json()["detail"]

    # 6. Koordinator Pusaka diizinkan ekspor excel
    client.post(
        "/api/v1/auth/masuk",
        json={"username": "koordinator", "password": "Password123!"},
    )
    res_ekspor_koor = client.get("/api/v1/rekap/ekspor-excel")
    assert res_ekspor_koor.status_code == 200

    # 7. Uji pembaruan status keterlibatan JFAK pada form asesmen kebijakan
    client.post(
        "/api/v1/auth/masuk",
        json={"username": "analis", "password": "Password123!"},
    )
    res_keb_aptika = client.get(f"/api/v1/kebijakan?periode_id={periode_id}")
    k_aptika = next(k for k in res_keb_aptika.json() if k["nama"] == "Kebijakan Khusus Aptika 2026")
    res_asesmen = client.get(f"/api/v1/asesmen/kebijakan/{k_aptika['id']}")
    assert res_asesmen.status_code == 200
    asesmen_id = res_asesmen.json()["id"]

    # Analis memperbarui JFAK ke 'Ya'
    res_jfak_ya = client.put(
        f"/api/v1/asesmen/{asesmen_id}/jfak",
        json={"melibatkan_jfak": True, "penjelasan_jfak": "Tim Penilai Mandiri JFAK Aptika"},
    )
    assert res_jfak_ya.status_code == 200
    assert res_jfak_ya.json()["melibatkan_jfak"] is True
    assert res_jfak_ya.json()["penjelasan_jfak"] == "Tim Penilai Mandiri JFAK Aptika"

    # Analis memperbarui JFAK ke 'Tidak'
    res_jfak_tidak = client.put(
        f"/api/v1/asesmen/{asesmen_id}/jfak",
        json={"melibatkan_jfak": False, "penjelasan_jfak": "Tidak melibatkan tim JFAK"},
    )
    assert res_jfak_tidak.status_code == 200
    assert res_jfak_tidak.json()["melibatkan_jfak"] is False

    # Satker lain (Analis 2) dilarang mengubah JFAK asesmen Aptika (403)
    client.post(
        "/api/v1/auth/masuk",
        json={"username": "analis2", "password": "Password123!"},
    )
    res_jfak_forbid = client.put(
        f"/api/v1/asesmen/{asesmen_id}/jfak",
        json={"melibatkan_jfak": True},
    )
    assert res_jfak_forbid.status_code == 403

    # 8. Koordinator hanya dapat memilih kebijakan untuk SI IKK jika berstatus DISETUJUI
    client.post(
        "/api/v1/auth/masuk",
        json={"username": "koordinator", "password": "Password123!"},
    )
    # Kebijakan k_aptika masih berstatus DRAF -> wajib ditolak 400
    res_pilih_draf = client.put(
        f"/api/v1/kebijakan/{k_aptika['id']}",
        json={"dipilih_untuk_si_ikk": True},
    )
    assert res_pilih_draf.status_code == 400
    assert "DISETUJUI" in res_pilih_draf.json()["detail"]

    # Ambil 3 kebijakan berbeda dalam periode
    res_all_keb = client.get(f"/api/v1/kebijakan?periode_id={periode_id}")
    tiga_ids = [k["id"] for k in res_all_keb.json()[:3]]
    # Pastikan k_aptika (yang berstatus DRAF) termasuk dalam 3 kebijakan yang dicoba dipilih
    if k_aptika["id"] not in tiga_ids:
        tiga_ids[0] = k_aptika["id"]

    # Endpoint pilih-si-ikk juga menolak kebijakan jika belum DISETUJUI
    res_pilih_3_draf = client.post(
        "/api/v1/kebijakan/pilih-si-ikk",
        json={
            "periode_id": periode_id,
            "kebijakan_ids": tiga_ids,
        },
    )
    assert res_pilih_3_draf.status_code == 400
    assert "DISETUJUI" in res_pilih_3_draf.json()["detail"]
