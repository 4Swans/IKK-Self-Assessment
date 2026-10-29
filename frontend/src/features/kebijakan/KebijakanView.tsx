import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  X,
  Info,
  Sparkles,
  ClipboardCheck,
  FileEdit,
  Building,
  Filter,
  Search,
  RotateCcw,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  DAFTAR_SATKER_KOMDIGI,
  DAFTAR_SATKER_GROUPED,
  matchSatkerClient,
} from "../auth/satkerList";
import { ToastNotification } from "../../components/ui/ToastNotification";
import {
  getStoredKebijakanList,
  saveStoredKebijakanList,
  type KebijakanItem,
} from "../../lib/kebijakanStore";
import { useQueryClient } from "@tanstack/react-query";
import { useDaftarPeriodeApiV1PeriodeGet } from "../../api/endpoints/periode/periode";
import {
  useDaftarKebijakanApiV1KebijakanGet,
  useTambahKebijakanApiV1KebijakanPost,
  useHapusKebijakanApiV1KebijakanKebijakanIdDelete,
} from "../../api/endpoints/kebijakan-strategis/kebijakan-strategis";

export function KebijakanView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAddKebijakan, isKoordinator, isAdmin, user: currentUser } = useAuth();
  const canAdd = canAddKebijakan();

  // Filter Satuan Kerja untuk Koordinator Pusaka & Admin
  const [selectedSatkerFilter, setSelectedSatkerFilter] = useState<string>("");
  // Pencarian kata kunci kebijakan
  const [searchQuery, setSearchQuery] = useState<string>("");
  // Filter status kebijakan
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "DIAJUKAN" | "DISETUJUI" | "TERPILIH" | "KANDIDAT"
  >("ALL");

  // Query Periode Aktif dari PostgreSQL
  const { data: periodeResp } = useDaftarPeriodeApiV1PeriodeGet({ tahun: 2026 });
  const activePeriode = periodeResp?.data?.[0];
  const activePeriodeId = activePeriode?.id;

  // Query Daftar Kebijakan dari PostgreSQL (auto-refresh setiap 5 detik agar status ajukan langsung terupdate)
  const {
    data: kebijakanBackendResp,
    refetch: refetchKebijakan,
  } = useDaftarKebijakanApiV1KebijakanGet(
    {
      periode_id: activePeriodeId!,
      satuan_kerja: selectedSatkerFilter || undefined,
    },
    {
      query: {
        enabled: !!activePeriodeId,
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
      },
    }
  );

  const tambahMutation = useTambahKebijakanApiV1KebijakanPost();
  const hapusMutation = useHapusKebijakanApiV1KebijakanKebijakanIdDelete();

  const [deletingKebijakan, setDeletingKebijakan] = useState<KebijakanItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deletingKebijakan) return;
    setIsDeleting(true);
    try {
      await hapusMutation.mutateAsync({ kebijakanId: deletingKebijakan.id });
      const remaining = getStoredKebijakanList().filter((k) => k.id !== deletingKebijakan.id);
      setLocalKebijakanList(remaining);
      saveStoredKebijakanList(remaining);
      if (newlyAddedPolicy?.id === deletingKebijakan.id) {
        setNewlyAddedPolicy(null);
      }
      await refetchKebijakan();
      queryClient.invalidateQueries();
      setToast({
        show: true,
        type: "success",
        title: "Kebijakan Telah Dihapus",
        message: `Kebijakan "${deletingKebijakan.nama}" beserta data asesmennya telah berhasil dihapus dari sistem.`,
      });
      setDeletingKebijakan(null);
    } catch (err: any) {
      setToast({
        show: true,
        type: "error",
        title: "Gagal Menghapus Kebijakan",
        message:
          err?.response?.data?.detail ||
          "Terjadi kesalahan saat menghapus data kebijakan.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const [localKebijakanList, setLocalKebijakanList] = useState<KebijakanItem[]>(getStoredKebijakanList);
  const [newlyAddedPolicy, setNewlyAddedPolicy] = useState<KebijakanItem | null>(null);

  // Turunkan kebijakanList langsung dari data backend PostgreSQL
  // Khusus Koordinator & Admin: hanya tampilkan kebijakan yang sudah diajukan (sembunyikan DRAF yang belum diases)
  const kebijakanList: KebijakanItem[] = React.useMemo(() => {
    const rawItems: KebijakanItem[] = (kebijakanBackendResp?.data || []).map(
      (k): KebijakanItem => {
        const matched = localKebijakanList.find((loc) => loc.id === k.id || loc.nama === k.nama);
        return {
          id: k.id,
          nama: k.nama,
          jenis_dasar_hukum: k.jenis_dasar_hukum,
          nomor_dasar_hukum: k.nomor_dasar_hukum,
          tanggal_penetapan: k.tanggal_penetapan,
          dipilih_untuk_si_ikk: k.dipilih_untuk_si_ikk,
          rekomendasi: k.rekomendasi || "",
          satuan_kerja: k.satuan_kerja || undefined,
          pembuat_id: k.pembuat_id || undefined,
          status_asesmen: k.status_asesmen || "DRAF",
          skor_total: k.skor_total ?? matched?.skor_total ?? undefined,
          kualifikasi: k.kualifikasi ?? matched?.kualifikasi ?? undefined,
          jumlah_jawaban: k.jumlah_jawaban ?? 0,
        };
      }
    );

    if (currentUser.peran !== "ANALIS") {
      return rawItems.filter((item) => item.status_asesmen && item.status_asesmen !== "DRAF");
    }
    return rawItems;
  }, [kebijakanBackendResp, localKebijakanList, currentUser.peran]);

  const jumlahDiajukan = React.useMemo(
    () => kebijakanList.filter((item) => item.status_asesmen === "DIAJUKAN").length,
    [kebijakanList]
  );

  // Filter client-side berdasarkan pencarian kata kunci, status, dan satker (toleran)
  const filteredKebijakanList = React.useMemo(() => {
    return kebijakanList.filter((item) => {
      // 1. Filter Satuan Kerja jika dipilih
      if (selectedSatkerFilter) {
        if (!item.satuan_kerja || !matchSatkerClient(item.satuan_kerja, selectedSatkerFilter)) {
          return false;
        }
      }

      // 2. Filter Status Asesmen & Pilihan SI IKK
      if (statusFilter === "DIAJUKAN" && item.status_asesmen !== "DIAJUKAN") {
        return false;
      }
      if (
        statusFilter === "DISETUJUI" &&
        item.status_asesmen !== "DISETUJUI" &&
        item.status_asesmen !== "TERKIRIM_SI_IKK"
      ) {
        return false;
      }
      if (statusFilter === "TERPILIH" && !item.dipilih_untuk_si_ikk) {
        return false;
      }
      if (statusFilter === "KANDIDAT" && item.dipilih_untuk_si_ikk) {
        return false;
      }

      // 3. Pencarian Kata Kunci
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNama = item.nama.toLowerCase().includes(q);
        const matchNomor = item.nomor_dasar_hukum.toLowerCase().includes(q);
        const matchJenis = item.jenis_dasar_hukum.toLowerCase().includes(q);
        const matchRekomendasi = (item.rekomendasi || "").toLowerCase().includes(q);
        const matchSatker = (item.satuan_kerja || "").toLowerCase().includes(q);
        if (!matchNama && !matchNomor && !matchJenis && !matchRekomendasi && !matchSatker) {
          return false;
        }
      }

      return true;
    });
  }, [kebijakanList, selectedSatkerFilter, statusFilter, searchQuery]);

  // Sinkronisasi data ke localStorage tanpa memicu render ulang internal (hanya jika tanpa filter)
  useEffect(() => {
    if (kebijakanBackendResp?.data !== undefined && !selectedSatkerFilter) {
      const mapped: KebijakanItem[] = kebijakanBackendResp.data.map((k) => {
        const matched = getStoredKebijakanList().find((loc) => loc.id === k.id || loc.nama === k.nama);
        return {
          id: k.id,
          nama: k.nama,
          jenis_dasar_hukum: k.jenis_dasar_hukum,
          nomor_dasar_hukum: k.nomor_dasar_hukum,
          tanggal_penetapan: k.tanggal_penetapan,
          dipilih_untuk_si_ikk: k.dipilih_untuk_si_ikk,
          rekomendasi: k.rekomendasi || "",
          satuan_kerja: k.satuan_kerja || undefined,
          pembuat_id: k.pembuat_id || undefined,
          skor_total: matched?.skor_total,
          kualifikasi: matched?.kualifikasi,
        };
      });
      saveStoredKebijakanList(mapped);
    }
  }, [kebijakanBackendResp, selectedSatkerFilter]);

  useEffect(() => {
    const handleStorageUpdate = () => {
      setLocalKebijakanList(getStoredKebijakanList());
    };
    window.addEventListener("ikk_kebijakan_updated", handleStorageUpdate);
    return () => window.removeEventListener("ikk_kebijakan_updated", handleStorageUpdate);
  }, []);

  const navigateToAsesmen = (item: KebijakanItem) => {
    navigate(`/asesmen?kebijakan=${encodeURIComponent(item.nama)}`);
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [formNama, setFormNama] = useState("");
  const [formJenis, setFormJenis] = useState("Permen");
  const [formNomor, setFormNomor] = useState("");
  const [formTanggal, setFormTanggal] = useState("2024-06-01");
  const [formRekomendasi, setFormRekomendasi] = useState("");
  const [customFormSatker, setFormSatker] = useState("");
  const formSatker = customFormSatker || currentUser.satuan_kerja || DAFTAR_SATKER_KOMDIGI[0];

  // Daftar satker kustom/lainnya yang ada pada data kebijakan tetapi di luar daftar statis
  const satkerDinamisLainnya = React.useMemo<string[]>(() => {
    const statisSet = new Set(DAFTAR_SATKER_KOMDIGI.map((s) => s.toLowerCase()));
    DAFTAR_SATKER_GROUPED.forEach((g) => statisSet.add(g.namaIndukBersih.toLowerCase()));
    const ekstra = new Set<string>();
    kebijakanList.forEach((k) => {
      if (k.satuan_kerja && !statisSet.has(k.satuan_kerja.trim().toLowerCase())) {
        ekstra.add(k.satuan_kerja.trim());
      }
    });
    return Array.from(ekstra);
  }, [kebijakanList]);

  // In-app Notification state (Replaces browser alert)
  const [toast, setToast] = useState<{
    show: boolean;
    type: "warning" | "error" | "info" | "success";
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  }>({
    show: false,
    type: "warning",
    title: "",
    message: "",
  });



  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) return;

    // Simpan ke PostgreSQL Backend via TanStack Query Mutation jika periode aktif tersedia
    if (activePeriodeId) {
      try {
        const finalSatker =
          currentUser.peran === "ANALIS"
            ? (currentUser.satuan_kerja || "Satuan Kerja")
            : (formSatker || currentUser.satuan_kerja || "Pusat Kebijakan Strategis (PUSAKA)");

        const res = await tambahMutation.mutateAsync({
          data: {
            periode_id: activePeriodeId,
            nama: formNama.trim(),
            jenis_dasar_hukum: formJenis,
            nomor_dasar_hukum: formNomor.trim() || "-",
            tanggal_penetapan: formTanggal,
            rekomendasi: formRekomendasi.trim() || undefined,
            satuan_kerja: finalSatker,
          },
        });

        await refetchKebijakan();
        queryClient.invalidateQueries();

        const createdItem: KebijakanItem = {
          id: res.data.id,
          nama: res.data.nama,
          jenis_dasar_hukum: res.data.jenis_dasar_hukum,
          nomor_dasar_hukum: res.data.nomor_dasar_hukum,
          tanggal_penetapan: res.data.tanggal_penetapan,
          dipilih_untuk_si_ikk: res.data.dipilih_untuk_si_ikk,
          rekomendasi: res.data.rekomendasi || "",
          satuan_kerja: res.data.satuan_kerja || undefined,
        };

        setNewlyAddedPolicy(createdItem);
        setShowAddForm(false);
        setFormNama("");
        setFormNomor("");
        setFormRekomendasi("");

        setToast({
          show: true,
          type: "success",
          title: "Kebijakan Telah Ditambahkan",
          message: `Kebijakan "${createdItem.nama}" telah ditambahkan. Silakan lakukan asesmen mandiri untuk melengkapi indikator dan berkas bukti dukung.`,
          actionLabel: "Lakukan Asesmen",
          onAction: () => navigateToAsesmen(createdItem),
        });
        return;
      } catch (err) {
        console.warn("Koneksi backend gagal, menyimpan secara lokal:", err);
      }
    }

    // Fallback lokal
    const newItem: KebijakanItem = {
      id: Date.now().toString(),
      nama: formNama.trim(),
      jenis_dasar_hukum: formJenis,
      nomor_dasar_hukum: formNomor.trim(),
      tanggal_penetapan: formTanggal,
      dipilih_untuk_si_ikk: false,
      rekomendasi: formRekomendasi.trim(),
      skor_total: undefined,
      kualifikasi: undefined,
    };
    const updated = [...kebijakanList, newItem];
    setLocalKebijakanList(updated);
    saveStoredKebijakanList(updated);
    setNewlyAddedPolicy(newItem);
    setShowAddForm(false);
    setFormNama("");
    setFormNomor("");
    setFormRekomendasi("");

    setToast({
      show: true,
      type: "success",
      title: "Kebijakan Telah Ditambahkan",
      message: `Kebijakan "${newItem.nama}" telah ditambahkan. Silakan lakukan asesmen mandiri untuk melengkapi indikator dan berkas bukti dukung.`,
      actionLabel: "Lakukan Asesmen",
      onAction: () => navigateToAsesmen(newItem),
    });
  };

  return (
    <div className="space-y-6">
      {/* Non-browser Interactive Toast Notification */}
      <ToastNotification
        show={toast.show}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        actionLabel={toast.actionLabel}
        onAction={toast.onAction}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* Header & Status Indicator */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1E304B] sm:text-2xl">
            Kebijakan Pembangunan Strategis
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Daftar kebijakan kandidat. Tepat 3 kebijakan wajib ditandai untuk disalin ke Sistem Informasi IKK LAN.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {(isKoordinator || isAdmin) && jumlahDiajukan > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "DIAJUKAN" ? "ALL" : "DIAJUKAN")}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 px-3.5 py-2 text-xs font-bold text-red-700 shadow-2xs transition-all cursor-pointer"
              title="Klik untuk memfilter kebijakan yang baru diajukan oleh Analis Satker"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
              </span>
              <span>{jumlahDiajukan} Pengajuan Menunggu Tinjauan</span>
            </button>
          )}

          <div className="inline-flex items-center gap-2 rounded-xl border border-[#B1C9EF] bg-[#F0F3FA] px-3.5 py-2 text-xs font-bold text-[#395886] shadow-palette-sm">
            <FileText className="h-4 w-4 text-[#395886]" />
            <span>
              {currentUser.peran === "ANALIS"
                ? `Total ${kebijakanList.length} Kebijakan Terdaftar`
                : `Total ${kebijakanList.length} Kebijakan Diajukan`}
            </span>
          </div>

          {canAdd && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2E486F] hover:to-[#395886] px-4 py-2 text-xs font-bold text-white shadow-palette-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Kebijakan</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner Khusus Analis Satker */}
      {currentUser.peran === "ANALIS" && (
        <div className="rounded-2xl bg-[#F0F3FA]/80 border-l-4 border-l-[#395886] px-5 py-4 text-xs text-[#1E304B]">
          <div className="flex items-center gap-2 font-bold text-sm text-[#395886]">
            <Building className="h-4 w-4" />
            <span>Ruang Kerja Satuan Kerja: {currentUser.satuan_kerja || "Satuan Kerja Anda"}</span>
          </div>
          <p className="mt-1.5 text-slate-600 leading-relaxed">
            Anda dapat menginput kebijakan pembangunan strategis dan mengisi bukti dukung penilaian mandiri IKK khusus untuk satuan kerja ini. Kebijakan dari satuan kerja lain tidak dapat diakses demi menjaga integritas data masing-masing satker.
          </p>
        </div>
      )}

      {/* Bar Pencarian & Filter Terpadu */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#D5DEEF] bg-white p-4 shadow-palette-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Kolom Pencarian Kata Kunci */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kebijakan berdasarkan nama, nomor dasar hukum, rekomendasi..."
              className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA] pl-10 pr-9 py-2 text-xs font-medium text-[#1E304B] placeholder:text-slate-400 focus:border-[#395886] focus:bg-white focus:outline-hidden transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Hapus kata kunci pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Satuan Kerja untuk Koordinator Pusaka & Admin */}
            {(isKoordinator || isAdmin) && (
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <select
                  value={selectedSatkerFilter}
                  onChange={(e) => setSelectedSatkerFilter(e.target.value)}
                  className="rounded-xl border border-[#D5DEEF] bg-[#F0F3FA] px-3 py-2 text-xs font-semibold text-[#1E304B] focus:border-[#628ECB] focus:outline-hidden cursor-pointer max-w-[260px] truncate"
                >
                  <option value="">Semua Satuan Kerja Komdigi</option>
                  {DAFTAR_SATKER_GROUPED.map((group) => (
                    <optgroup key={group.induk} label={group.induk}>
                      {group.induk !== "Pusat & Unit Kerja Lainnya" && (
                        <option value={group.namaIndukBersih}>
                          [Semua Unit] {group.namaIndukBersih}
                        </option>
                      )}
                      {group.satker.map((satker) => (
                        <option key={satker} value={satker}>
                          {satker}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {satkerDinamisLainnya.length > 0 && (
                    <optgroup label="Satuan Kerja Terdaftar Lainnya">
                      {satkerDinamisLainnya.map((satker) => (
                        <option key={satker} value={satker}>
                          {satker}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {/* Filter Status Asesmen & Pilihan SI IKK */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "ALL"
                    | "DIAJUKAN"
                    | "DISETUJUI"
                    | "TERPILIH"
                    | "KANDIDAT"
                )
              }
              className="rounded-xl border border-[#D5DEEF] bg-[#F0F3FA] px-3 py-2 text-xs font-semibold text-[#1E304B] focus:border-[#628ECB] focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="DIAJUKAN">Menunggu Tinjauan (Diajukan)</option>
              <option value="DISETUJUI">Telah Disetujui Koordinator</option>
              <option value="TERPILIH">Terpilih SI IKK (3 Kebijakan)</option>
              <option value="KANDIDAT">Kandidat Belum Terpilih</option>
            </select>

            {/* Tombol Reset Filter jika ada filter aktif */}
            {(searchQuery || selectedSatkerFilter || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSatkerFilter("");
                  setStatusFilter("ALL");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 text-xs font-bold transition-colors cursor-pointer"
                title="Reset semua filter pencarian"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Ringkasan Filter & Jumlah Hasil */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Menampilkan <strong>{filteredKebijakanList.length}</strong> dari <strong>{kebijakanList.length}</strong> kebijakan
            </span>
            {selectedSatkerFilter && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-[#395886]">
                <Building className="h-3 w-3" />
                <span className="max-w-[200px] truncate">{selectedSatkerFilter}</span>
                <button
                  type="button"
                  onClick={() => setSelectedSatkerFilter("")}
                  className="hover:text-red-600 ml-0.5 cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                <span>Kata kunci: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="hover:text-red-600 ml-0.5 cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {statusFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                <span>Status: {statusFilter === "TERPILIH" ? "Terpilih SI IKK" : "Kandidat Belum Terpilih"}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className="hover:text-red-600 ml-0.5 cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banner Informasi Pemisahan Penetapan SI IKK */}
      <div className="rounded-2xl bg-[#F0F3FA]/85 border-l-4 border-l-[#395886] px-5 py-4 text-xs">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-[#395886]/10 text-[#395886] flex-shrink-0">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-[#1E304B] text-sm">
              Ruang Input Kebijakan Satker &amp; Alur Penetapan SI IKK
            </div>
            <p className="leading-relaxed text-slate-600">
              Halaman ini digunakan oleh seluruh satuan kerja untuk mendaftarkan kebijakan strategis kandidat dan mengisi asesmen mandiri. <strong className="text-[#1E304B]">Penetapan 3 kebijakan resmi untuk SI IKK LAN dipisahkan</strong> ke menu <strong className="text-[#395886]">Tabel Rekap &amp; Ekspor</strong>, di mana Koordinator hanya dapat memilih dari kebijakan yang telah <strong className="text-[#1E304B]">selesai dinilai dan disetujui (Status: DISETUJUI)</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Add Kebijakan Form Modal / Inline Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">
              Formulir Tambah Kebijakan Kandidat
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Kebijakan Strategis
              </label>
              <input
                type="text"
                required
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                placeholder="Contoh: Peraturan Menteri tentang Standar Layanan Informasi Publik"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jenis Dasar Hukum
              </label>
              <select
                value={formJenis}
                onChange={(e) => setFormJenis(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                <option value="UU">Undang-Undang (UU)</option>
                <option value="PP">Peraturan Pemerintah (PP)</option>
                <option value="Perpres">Peraturan Presiden (Perpres)</option>
                <option value="Permen">Peraturan Menteri (Permen)</option>
                <option value="Kepmen">Keputusan Menteri (Kepmen)</option>
                <option value="Perda">Peraturan Daerah (Perda)</option>
                <option value="Pergub">Peraturan Gubernur (Pergub)</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Dasar Hukum
              </label>
              <input
                type="text"
                required
                value={formNomor}
                onChange={(e) => setFormNomor(e.target.value)}
                placeholder="Contoh: Permenkominfo No. 12 Tahun 2023"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Penetapan
              </label>
              <input
                type="date"
                required
                value={formTanggal}
                onChange={(e) => setFormTanggal(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rekomendasi / Catatan Kebijakan
              </label>
              <input
                type="text"
                value={formRekomendasi}
                onChange={(e) => setFormRekomendasi(e.target.value)}
                placeholder="Catatan perbaikan atau usulan masa depan"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            {currentUser.peran !== "ANALIS" ? (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Satuan Kerja Pengusul Kebijakan
                </label>
                <select
                  value={formSatker}
                  onChange={(e) => setFormSatker(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer"
                >
                  {DAFTAR_SATKER_GROUPED.map((group) => (
                    <optgroup key={group.induk} label={group.induk}>
                      {group.satker.map((satker) => (
                        <option key={satker} value={satker}>
                          {satker}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ) : (
              <div className="sm:col-span-2 rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-xs text-[#395886] flex items-center gap-2">
                <Building className="h-4 w-4 flex-shrink-0" />
                <span>
                  Kebijakan akan otomatis tercatat diajukan oleh satuan kerja Anda: <strong>{currentUser.satuan_kerja || "Satuan Kerja Anda"}</strong>
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 shadow-xs transition-colors"
            >
              Simpan Kebijakan
            </button>
          </div>
        </form>
      )}

      {/* Banner Rekomendasi Asesmen Setelah Input Kebijakan Baru */}
      {newlyAddedPolicy && (
        <div className="rounded-2xl border border-[#8AAEE0] bg-[#F0F3FA] p-5 shadow-palette-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="rounded-xl p-2.5 bg-[#395886] text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#395886] uppercase tracking-wider">Kebijakan Baru Ditambahkan</span>
                <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold">
                  Belum Dilakukan Asesmen
                </span>
              </div>
              <h3 className="font-bold text-[#1E304B] text-base mt-0.5">{newlyAddedPolicy.nama}</h3>
              <p className="text-xs text-slate-600 mt-1">
                Kebijakan ini belum memiliki nilai asesmen. Silakan lakukan asesmen mandiri untuk mengisi 11 indikator pada 4 dimensi (Perencanaan, Implementasi, Evaluasi, Transparansi) dan melampirkan berkas bukti dukung.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
            <button
              type="button"
              onClick={() => setNewlyAddedPolicy(null)}
              className="rounded-xl border border-[#D5DEEF] bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Nanti Saja
            </button>
            <button
              type="button"
              onClick={() => navigateToAsesmen(newlyAddedPolicy)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2E486F] hover:to-[#395886] px-4 py-2 text-xs font-bold text-white shadow-palette-sm transition-all hover:scale-[1.02]"
            >
              <ClipboardCheck className="h-4 w-4" />
              Lakukan Asesmen Sekarang
            </button>
          </div>
        </div>
      )}

      {/* Table of Policies */}
      <div className="overflow-hidden rounded-2xl border border-[#D5DEEF] bg-white/95 shadow-palette-sm">
        <table className="min-w-full divide-y divide-[#D5DEEF] text-left text-sm">
          <thead className="bg-[#F0F3FA] text-xs font-bold uppercase tracking-wider text-[#395886] border-b border-[#D5DEEF]">
            <tr>
              <th scope="col" className="w-12 px-3 py-3.5 text-center">
                No.
              </th>
              <th scope="col" className="px-4 py-3.5">
                Nama Kebijakan &amp; Dasar Hukum
              </th>
              <th scope="col" className="px-4 py-3.5">
                Penetapan
              </th>
              <th scope="col" className="px-4 py-3.5 text-center">
                Skor Asesmen
              </th>
              <th scope="col" className="px-4 py-3.5">
                Rekomendasi
              </th>
              <th scope="col" className="px-4 py-3.5 text-center">
                Aksi Asesmen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D5DEEF]">
            {filteredKebijakanList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-[#F0F3FA] flex items-center justify-center text-[#628ECB] border border-[#B1C9EF]/50">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1E304B]">
                        {kebijakanList.length === 0
                          ? currentUser.peran === "ANALIS"
                            ? "Belum Ada Kebijakan Terdaftar"
                            : "Belum Ada Kebijakan yang Diajukan oleh Analis Satker"
                          : "Tidak Ada Kebijakan yang Cocok dengan Filter"}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                        {kebijakanList.length === 0
                          ? currentUser.peran === "ANALIS"
                            ? "Satuan kerja Anda belum mendaftarkan kebijakan pembangunan strategis untuk periode aktif ini."
                            : "Kebijakan yang masih berstatus Draf (belum selesai diases) hanya tampil di ruang kerja Analis Satker masing-masing dan baru akan muncul di sini setelah diajukan ke Koordinator."
                          : "Coba sesuaikan kata kunci pencarian atau reset filter satuan kerja dan status."}
                      </p>
                    </div>
                    {(searchQuery || selectedSatkerFilter || statusFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedSatkerFilter("");
                          setStatusFilter("ALL");
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[#395886] bg-white px-4 py-2 text-xs font-bold text-[#395886] hover:bg-[#F0F3FA] transition-all shadow-palette-xs cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Hapus Filter &amp; Tampilkan Semua</span>
                      </button>
                    )}
                    {canAdd && kebijakanList.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] text-white px-4 py-2 text-xs font-bold transition-all shadow-palette-sm hover:from-[#2F4A72] hover:to-[#395886] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Tambah Kebijakan Satker</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredKebijakanList.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-[#F0F3FA]/60 ${
                    item.dipilih_untuk_si_ikk ? "bg-[#F0F3FA]/70" : ""
                  }`}
                >
                <td className="px-3 py-4 text-center font-mono text-xs font-bold text-slate-500">
                  {idx + 1}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-start gap-2.5">
                    <FileText className="h-4.5 w-4.5 flex-shrink-0 text-[#628ECB] mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1E304B] leading-snug">
                          {item.nama}
                        </span>
                        {item.status_asesmen === "DIAJUKAN" && (isKoordinator || isAdmin) && (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700"
                            title="Kebijakan baru diajukan oleh Analis Satker dan menunggu verifikasi Anda"
                          >
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                            </span>
                            <span>Baru Diajukan</span>
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-[#395886] text-[11px] inline-flex items-center gap-1 shadow-2xs">
                          <Building className="h-3 w-3 text-[#628ECB]" />
                          <span>{item.satuan_kerja || selectedSatkerFilter || currentUser.satuan_kerja || "Satuan Kerja"}</span>
                        </span>
                        <span className="rounded-md bg-[#F0F3FA] border border-[#B1C9EF] px-2 py-0.5 font-bold text-[#395886] text-[11px]">
                          {item.jenis_dasar_hukum}
                        </span>
                        <span className="font-mono text-slate-600">{item.nomor_dasar_hukum}</span>
                        {item.dipilih_untuk_si_ikk && (
                          <span className="rounded-md bg-emerald-50 border border-emerald-300 px-2 py-0.5 font-bold text-emerald-800 text-[11px] inline-flex items-center gap-1 shadow-2xs">
                            <Sparkles className="h-3 w-3 text-emerald-600" />
                            <span>Terpilih SI IKK</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-xs tabular-nums text-slate-600 whitespace-nowrap">
                  {item.tanggal_penetapan}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Status Asesmen Badge */}
                    {item.status_asesmen === "DIAJUKAN" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-300 px-2.5 py-0.5 text-[11px] font-bold text-[#1E304B]">
                        <span>Diajukan ke Koordinator</span>
                      </span>
                    ) : item.status_asesmen === "DISETUJUI" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                        <span>Disetujui Koordinator</span>
                      </span>
                    ) : item.status_asesmen === "TERKIRIM_SI_IKK" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 border border-indigo-300 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                        <span>Terkirim SI IKK</span>
                      </span>
                    ) : item.status_asesmen === "PERLU_PERBAIKAN" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                        <span>Perlu Perbaikan</span>
                      </span>
                    ) : item.skor_total !== undefined && (item.jumlah_jawaban ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        <span>Draf ({item.jumlah_jawaban}/11 Indikator)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        Belum diases
                      </span>
                    )}

                    {/* Skor & Kualifikasi jika sudah ada isian */}
                    {item.skor_total !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono tabular-nums text-xs text-slate-900">
                          {item.skor_total.toFixed(2)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.kualifikasi === "Unggul" || item.kualifikasi === "Sangat Baik"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.kualifikasi === "Baik"
                              ? "bg-blue-100 text-blue-800"
                              : item.kualifikasi === "Cukup"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {item.kualifikasi}
                        </span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-slate-600 max-w-xs">
                  {item.rekomendasi || "-"}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap">
                  <div className="inline-flex items-center justify-center gap-2">
                    {item.status_asesmen === "DIAJUKAN" && (isKoordinator || isAdmin) ? (
                      <button
                        type="button"
                        onClick={() => navigateToAsesmen(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2E486F] hover:to-[#395886] px-3.5 py-1.5 text-xs font-bold text-white shadow-palette-xs transition-all hover:scale-[1.02] cursor-pointer"
                        title={`Tinjau dan verifikasi pengajuan asesmen ${item.nama}`}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        <span>Tinjau Pengajuan</span>
                      </button>
                    ) : item.skor_total === undefined && item.status_asesmen === "DRAF" ? (
                      <button
                        type="button"
                        onClick={() => navigateToAsesmen(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2E486F] hover:to-[#395886] px-3.5 py-1.5 text-xs font-bold text-white shadow-palette-xs transition-all hover:scale-[1.02] cursor-pointer"
                        title={`Lakukan penilaian mandiri untuk ${item.nama}`}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        <span>Lakukan Asesmen</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigateToAsesmen(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5DEEF] bg-[#F0F3FA] hover:bg-[#D5DEEF] px-3 py-1.5 text-xs font-semibold text-[#395886] transition-all cursor-pointer"
                        title={`Buka atau perbarui penilaian mandiri untuk ${item.nama}`}
                      >
                        <FileEdit className="h-3.5 w-3.5 text-[#395886]" />
                        <span>
                          {item.status_asesmen === "DIAJUKAN"
                            ? "Lihat Pengajuan"
                            : item.status_asesmen === "PERLU_PERBAIKAN"
                            ? "Perbaiki Asesmen"
                            : item.status_asesmen === "DISETUJUI" ||
                              item.status_asesmen === "TERKIRIM_SI_IKK"
                            ? "Lihat Hasil"
                            : "Lanjutkan Asesmen"}
                        </span>
                      </button>
                    )}

                    {/* Tombol Hapus Kebijakan */}
                    <button
                      type="button"
                      onClick={() => setDeletingKebijakan(item)}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 p-1.5 text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                      title={`Hapus kebijakan ${item.nama}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      {/* Modal Konfirmasi Hapus Kebijakan */}
      {deletingKebijakan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-palette-xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E304B]">Hapus Data Kebijakan</h3>
                  <p className="text-[11px] text-slate-500 font-normal">Konfirmasi penghapusan kebijakan &amp; asesmen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingKebijakan(null)}
                disabled={isDeleting}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus kebijakan berikut beserta seluruh jawaban dan bukti dukung asesmennya?
            </p>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-start gap-2 border-b border-rose-100/70 pb-2">
                <span className="text-slate-500 flex-shrink-0">Nama Kebijakan:</span>
                <span className="font-bold text-[#1E304B] text-right">{deletingKebijakan.nama}</span>
              </div>
              <div className="flex justify-between items-center border-b border-rose-100/70 pb-2">
                <span className="text-slate-500">Dasar Hukum:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {deletingKebijakan.jenis_dasar_hukum} {deletingKebijakan.nomor_dasar_hukum}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Satuan Kerja:</span>
                <span className="font-medium text-slate-800 text-right max-w-[220px] truncate" title={deletingKebijakan.satuan_kerja}>
                  {deletingKebijakan.satuan_kerja || currentUser.satuan_kerja || "-"}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-[11px] text-amber-900 leading-relaxed">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Peringatan:</strong> Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingKebijakan(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-palette-sm disabled:opacity-60 transition-all cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Ya, Hapus Kebijakan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
