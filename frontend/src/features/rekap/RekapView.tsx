import { useState } from "react";
import {
  FileSpreadsheet,
  Printer,
  BarChart3,
  Layers,
  Award,
  FileText,
  Sparkles,
  ShieldCheck,
  Lightbulb,
  Check,
  Target,
  FileCheck,
  AlertCircle,
  Clock,
  RefreshCw,
  Building,
  Filter,
  Lock,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { RadarDimensiIKK } from "../../components/ui/RadarDimensiIKK";
import { useAmbilRekapPeriodeApiV1RekapGet } from "../../api/endpoints/rekapitulasi/rekapitulasi";
import { usePilihTigaKebijakanSiIkkApiV1KebijakanPilihSiIkkPost } from "../../api/endpoints/kebijakan-strategis/kebijakan-strategis";
import { useQueryClient } from "@tanstack/react-query";
import { ToastNotification } from "../../components/ui/ToastNotification";
import { useAuth } from "../auth/AuthContext";
import { DAFTAR_SATKER_GROUPED } from "../auth/satkerList";

interface KebijakanRekap {
  id: string;
  nama: string;
  dasarHukum: string;
  satuan_kerja?: string;
  profil: number;
  skorIndikator: Record<string, number>;
  dimensi: {
    a: number; // maks 25
    b: number; // maks 30
    c: number; // maks 15
    d: number; // maks 20
  };
  nilaiTotal: number;
  kualifikasi: "Unggul" | "Sangat Baik" | "Baik" | "Cukup" | "Kurang";
  rekomendasi: string;
  dipilih_untuk_si_ikk: boolean;
  status_asesmen: string;
  lengkap: boolean;
}

export function RekapView() {
  const queryClient = useQueryClient();
  const pilihTigaMutation = usePilihTigaKebijakanSiIkkApiV1KebijakanPilihSiIkkPost();
  const { isKoordinator, isAdmin, user: currentUser } = useAuth();
  const canExportExcel = isKoordinator || isAdmin;
  const canManageSelection = isKoordinator || isAdmin;

  const [selectedSatkerFilter, setSelectedSatkerFilter] = useState<string>("");
  const [activeTabVisual, setActiveTabVisual] = useState<"radar" | "skor" | "dimensi" | "indikator" | "resume">("radar");
  const [selectedRadarPolicyId, setSelectedRadarPolicyId] = useState<string>("all");

  const [showPenetapanModal, setShowPenetapanModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSavingPenetapan, setIsSavingPenetapan] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    type: "warning" | "error" | "info" | "success";
    title: string;
    message: string;
  }>({
    show: false,
    type: "info",
    title: "",
    message: "",
  });

  const { data: rekapRes, isLoading, isError, refetch } = useAmbilRekapPeriodeApiV1RekapGet(
    {
      satuan_kerja: selectedSatkerFilter || undefined,
    },
    {
      query: {
        refetchOnMount: "always",
        refetchInterval: 5000,
      },
    }
  );
  const rekapDataRaw = rekapRes?.data;

  const periode = rekapDataRaw?.periode;
  const rawKebijakanList = (rekapDataRaw?.kebijakan_list || []).filter((k) =>
    currentUser.peran !== "ANALIS" ? k.status_asesmen && k.status_asesmen !== "DRAF" : true
  );
  const matriksKesiapan = rekapDataRaw?.matriks_kesiapan || [];

  // Konversi data backend ke struktur komponen visual
  const rekapData: KebijakanRekap[] = rawKebijakanList.map((k) => {
    const skorInd: Record<string, number> = {};
    if (k.indikator) {
      Object.entries(k.indikator).forEach(([kode, ind]) => {
        skorInd[kode] = Number(ind.skor || 0);
      });
    }

    return {
      id: k.id,
      nama: k.nama,
      dasarHukum: `${k.jenis_dasar_hukum} No. ${k.nomor_dasar_hukum}`,
      satuan_kerja: k.satuan_kerja || undefined,
      profil: Number(k.profil_skor || 0),
      skorIndikator: skorInd,
      dimensi: {
        a: Number(k.dimensi?.a?.kontribusi_total || 0),
        b: Number(k.dimensi?.b?.kontribusi_total || 0),
        c: Number(k.dimensi?.c?.kontribusi_total || 0),
        d: Number(k.dimensi?.d?.kontribusi_total || 0),
      },
      nilaiTotal: Number(k.nilai_total_tampilan || 0),
      kualifikasi: (k.kualifikasi || "Kurang") as KebijakanRekap["kualifikasi"],
      rekomendasi: k.rekomendasi || "Belum ada catatan rekomendasi khusus.",
      dipilih_untuk_si_ikk: k.dipilih_untuk_si_ikk,
      status_asesmen: k.status_asesmen,
      lengkap: k.lengkap,
    };
  });

  // Kebijakan terpilih untuk SI IKK (tepat 3 kebijakan berstatus DISETUJUI)
  const kebijakanTerpilih = rekapData.filter((k) => k.dipilih_untuk_si_ikk);
  const displayExecutive = kebijakanTerpilih;

  const dimensiConfig = [
    { key: "a" as const, label: "A. Perencanaan", bobotMaks: 20, warna: "bg-blue-600", lightBg: "bg-blue-50", textCol: "text-blue-700" },
    { key: "b" as const, label: "B. Implementasi", bobotMaks: 25, warna: "bg-emerald-600", lightBg: "bg-emerald-50", textCol: "text-emerald-700" },
    { key: "c" as const, label: "C. Evaluasi", bobotMaks: 30, warna: "bg-amber-500", lightBg: "bg-amber-50", textCol: "text-amber-700" },
    { key: "d" as const, label: "D. Transparansi", bobotMaks: 15, warna: "bg-cyan-600", lightBg: "bg-cyan-50", textCol: "text-cyan-700" },
  ];

  const indikatorList = [
    { kode: "a1", label: "A1: Validitas Data & Kajian" },
    { kode: "a2", label: "A2: Keterlibatan Publik" },
    { kode: "a3", label: "A3: Analisis Dampak (RIA)" },
    { kode: "b1", label: "B1: Koordinasi & SOP" },
    { kode: "b2", label: "B2: Efektivitas Lapangan" },
    { kode: "b3", label: "B3: Pengawasan & Akuntabilitas" },
    { kode: "c1", label: "C1: Evaluasi Berkelanjutan" },
    { kode: "c2", label: "C2: Dampak Terukur Masyarakat" },
    { kode: "c3", label: "C3: Keselarasan Regulasi" },
    { kode: "d1", label: "D1: Akses Informasi Publik" },
    { kode: "d2", label: "D2: Mekanisme Keberatan/Aduan" },
  ] as const;

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (!canExportExcel) {
      setToast({
        show: true,
        type: "error",
        title: "Akses Ditolak",
        message:
          "Satuan kerja di luar PUSAKA hanya memiliki akses baca (read-only) dan tidak diizinkan mengekspor berkas Excel.",
      });
      return;
    }
    try {
      setIsExporting(true);
      const queryParams = new URLSearchParams();
      if (selectedSatkerFilter) queryParams.set("satuan_kerja", selectedSatkerFilter);
      const urlStr = queryParams.toString() ? `/api/v1/rekap/ekspor-excel?${queryParams.toString()}` : "/api/v1/rekap/ekspor-excel";
      const token = localStorage.getItem("ikk_token");
      const res = await fetch(urlStr, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        throw new Error("Gagal mengunduh berkas template rekap Excel.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rekap_Self_Assessment_IKK_${periode?.tahun ?? 2026}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setToast({
        show: true,
        type: "error",
        title: "Gagal Mengunduh Excel",
        message: "Terjadi kendala saat mengunduh berkas Excel. Pastikan sesi login dan layanan server aktif.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const togglePolicySelect = (id: string, statusAsesmen: string) => {
    if (statusAsesmen !== "DISETUJUI" && statusAsesmen !== "TERKIRIM_SI_IKK") {
      setToast({
        show: true,
        type: "warning",
        title: "Kebijakan Belum Disetujui",
        message:
          "Hanya kebijakan yang telah dinilai dan berstatus DISETUJUI oleh Koordinator yang dapat dipilih untuk SI IKK LAN.",
      });
      return;
    }

    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 3) {
        setToast({
          show: true,
          type: "warning",
          title: "Batas Maksimal 3 Kebijakan",
          message:
            "Sesuai regulasi LAN RI, instansi hanya dapat memilih tepat 3 kebijakan. Hapus centang salah satu kebijakan terlebih dahulu.",
        });
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSimpanPenetapan = async () => {
    if (selectedIds.length !== 3) {
      setToast({
        show: true,
        type: "warning",
        title: "Jumlah Pilihan Belum Tepat",
        message: `Sesuai pedoman resmi LAN RI, tepat 3 kebijakan wajib dipilih (saat ini terpilih ${selectedIds.length}).`,
      });
      return;
    }
    if (!periode?.id) return;
    try {
      setIsSavingPenetapan(true);
      await pilihTigaMutation.mutateAsync({
        data: {
          periode_id: periode.id,
          kebijakan_ids: selectedIds,
        },
      });
      await refetch();
      queryClient.invalidateQueries();
      setShowPenetapanModal(false);
      setToast({
        show: true,
        type: "success",
        title: "Penetapan 3 Kebijakan Berhasil",
        message:
          "Tepat 3 kebijakan tervalidasi berhasil ditetapkan untuk pelaporan resmi SI IKK LAN RI.",
      });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      const detail = errorObj?.response?.data?.detail || "Gagal menyimpan penetapan kebijakan.";
      setToast({
        show: true,
        type: "error",
        title: "Gagal Menetapkan Kebijakan",
        message: detail,
      });
    } finally {
      setIsSavingPenetapan(false);
    }
  };

  const getKualifikasiConfig = (kualifikasi: string) => {
    switch (kualifikasi) {
      case "Unggul":
        return {
          badge: "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500/20",
          topStripe: "from-emerald-500 via-teal-500 to-emerald-600",
          scoreColor: "text-emerald-700",
          bgLight: "bg-emerald-50/40",
          dotColor: "bg-emerald-500",
        };
      case "Sangat Baik":
        return {
          badge: "bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-500/20",
          topStripe: "from-blue-500 via-indigo-500 to-blue-600",
          scoreColor: "text-blue-700",
          bgLight: "bg-blue-50/40",
          dotColor: "bg-blue-500",
        };
      case "Baik":
        return {
          badge: "bg-cyan-50 text-cyan-800 border-cyan-300 ring-1 ring-cyan-500/20",
          topStripe: "from-cyan-500 via-blue-500 to-cyan-600",
          scoreColor: "text-cyan-800",
          bgLight: "bg-cyan-50/40",
          dotColor: "bg-cyan-500",
        };
      case "Cukup":
        return {
          badge: "bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-500/20",
          topStripe: "from-amber-400 via-amber-500 to-yellow-500",
          scoreColor: "text-amber-700",
          bgLight: "bg-amber-50/40",
          dotColor: "bg-amber-500",
        };
      default:
        return {
          badge: "bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-500/20",
          topStripe: "from-rose-500 via-red-500 to-rose-600",
          scoreColor: "text-rose-700",
          bgLight: "bg-rose-50/40",
          dotColor: "bg-rose-500",
        };
    }
  };

  const getHeatmapColor = (skor: number) => {
    if (skor === 100) return "bg-emerald-600 text-white font-bold shadow-xs";
    if (skor === 75) return "bg-emerald-400 text-emerald-950 font-bold";
    if (skor === 50) return "bg-amber-300 text-amber-950 font-semibold";
    if (skor === 25) return "bg-amber-500 text-white font-semibold";
    return "bg-rose-100 text-rose-800 font-medium";
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
        <RefreshCw className="h-8 w-8 text-[#395886] animate-spin" />
        <div>
          <h3 className="font-bold text-slate-800 text-base">Memuat Data Rekapitulasi IKK...</h3>
          <p className="text-xs text-slate-500 mt-1">Menghubungkan ke PostgreSQL dan menghitung skor real instrumen LAN 2026</p>
        </div>
      </div>
    );
  }

  if (isError || !periode) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-8 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-600 mx-auto" />
        <h3 className="font-bold text-slate-900 text-base">Periode Asesmen Belum Ditemukan</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Silakan lakukan registrasi periode dan tambahkan kebijakan pembangunan strategis terlebih dahulu pada menu Periode.
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#395886] text-white px-4 py-2 text-xs font-bold shadow-xs hover:bg-[#2E486F] transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Muat Ulang</span>
        </button>
      </div>
    );
  }

  const siapKirim = rekapDataRaw?.siap_kirim_si_ikk ?? false;
  const jumlahTerpilih = periode?.jumlah_terpilih ?? 0;

  return (
    <div className="space-y-8 pb-16">
      <ToastNotification
        show={toast.show}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
      {/* Header and Actions */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F0F3FA] border border-[#B1C9EF] px-3.5 py-1 text-xs font-bold text-[#395886] mb-2.5 shadow-2xs">
            <Award className="h-3.5 w-3.5 text-[#395886]" />
            <span>Instrumen Pengukuran Mandiri IKK {periode.tahun}</span>
            <span className="h-1 w-1 rounded-full bg-[#628ECB]" />
            <span className="text-[11px] font-semibold text-[#4E73A9]">{periode.instansi}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E304B] sm:text-3xl">
            Tabel Rekapitulasi &amp; Ekspor Mandiri
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl leading-relaxed">
            Kalkulasi komprehensif seluruh kebijakan pembangunan strategis terdaftar. Perhitungan otomatis menggabungkan keterlibatan JFAK (Profil 10%) dan 4 Dimensi Kebijakan (Perencanaan, Implementasi, Evaluasi, Transparansi).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canExportExcel ? (
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="group inline-flex items-center gap-2 rounded-xl border border-[#D5DEEF] bg-white px-4 py-2.5 text-xs font-bold text-[#1E304B] hover:bg-[#F0F3FA] hover:border-[#8AAEE0] shadow-palette-sm hover:shadow-palette-md transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#D5DEEF] text-[#395886] group-hover:bg-[#B1C9EF] transition-colors">
                {isExporting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
              </div>
              <span>{isExporting ? "Mengunduh Excel..." : "Ekspor Excel (.xlsx)"}</span>
            </button>
          ) : (
            <div
              title="Akses Dibatasi: Satuan kerja di luar PUSAKA hanya memiliki hak baca (read-only) dan tidak diizinkan mengekspor Excel. Ekspor berkas resmi hanya dilakukan oleh Koordinator PUSAKA."
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/90 px-4 py-2.5 text-xs font-semibold text-slate-400 cursor-not-allowed select-none"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Ekspor Excel (Khusus Koordinator PUSAKA)</span>
            </div>
          )}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2E486F] hover:to-[#395886] px-4 py-2.5 text-xs font-bold text-white shadow-palette-sm hover:shadow-palette-md transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Rekap PDF</span>
          </button>
        </div>
      </div>

      {/* Satker Filter Toolbar & Banner */}
      {currentUser.peran !== "ANALIS" ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-[#D5DEEF] bg-[#F0F3FA]/70 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#395886]" />
            <span className="text-xs font-bold text-[#1E304B]">Saring Kebijakan Berdasarkan Satuan Kerja:</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedSatkerFilter}
              onChange={(e) => setSelectedSatkerFilter(e.target.value)}
              className="w-full sm:w-80 rounded-xl border border-[#D5DEEF] bg-white px-3 py-1.5 text-xs text-slate-800 shadow-2xs focus:border-[#628ECB] focus:outline-hidden focus:ring-1 focus:ring-[#628ECB]"
            >
              <option value="">Semua Satuan Kerja (Seluruh Komdigi)</option>
              {DAFTAR_SATKER_GROUPED.map((group) => (
                <optgroup key={group.induk} label={group.induk}>
                  {group.induk !== "Pusat & Unit Kerja Lainnya" && (
                    <option value={group.namaIndukBersih}>
                      [Semua Unit] {group.namaIndukBersih}
                    </option>
                  )}
                  {group.satker.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedSatkerFilter && (
              <button
                type="button"
                onClick={() => setSelectedSatkerFilter("")}
                className="text-xs text-[#395886] hover:underline font-semibold whitespace-nowrap cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-blue-50/80 border border-blue-200/80 p-4 text-xs text-[#395886]">
          <div className="flex items-center gap-2.5">
            <Building className="h-4 w-4 text-[#628ECB] flex-shrink-0" />
            <div>
              <span className="font-bold block text-slate-800">
                Ruang Tabulasi Terisolasi: {currentUser.satuan_kerja || "Satuan Kerja Anda"}
              </span>
              <span className="text-[11px] text-slate-600">
                Hanya menampilkan hasil penilaian kebijakan milik satuan kerja Anda. Kebijakan dari satuan kerja lain tidak dapat dilihat.
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 text-slate-700 px-3 py-1 font-bold text-[11px] border border-slate-200 shadow-2xs self-start sm:self-center">
            <Lock className="h-3.5 w-3.5 text-slate-500" />
            Akses Baca Saja (Read-Only)
          </span>
        </div>
      )}

      {/* Status Banner Kelayakan Pengiriman ke SI IKK */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 text-xs shadow-xs transition-all ${
          siapKirim
            ? "border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white text-emerald-950"
            : "border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-slate-50/50 to-white text-slate-900"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`rounded-xl p-2.5 shadow-xs flex-shrink-0 text-white ${
                siapKirim ? "bg-emerald-600" : "bg-[#395886]"
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  {siapKirim
                    ? "Tepat 3 Kebijakan Terpilih Siap Disinkronkan ke SI IKK LAN RI"
                    : `Status Seleksi Kebijakan: ${jumlahTerpilih} / 3 Kebijakan Ditandai untuk SI IKK`}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    siapKirim ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {siapKirim ? "Lengkap & Disetujui" : "Dalam Proses"}
                </span>
              </div>
              <p className="mt-1 leading-relaxed max-w-3xl text-slate-600">
                {siapKirim
                  ? "Seluruh 3 kebijakan telah diverifikasi dan disetujui Koordinator Instansi. Nilai akhir di bawah ini siap disalin ke Sistem Informasi IKK LAN RI."
                  : "Sesuai pedoman LAN RI, tepat 3 kebijakan strategis wajib ditandai 'Dipilih untuk SI IKK' dan disetujui sebelum pengisian resmi."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 self-end md:self-center flex-wrap">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3.5 py-1.5 shadow-xs">
              {siapKirim ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clock className="h-4 w-4 text-blue-600" />
              )}
              <span className="font-mono text-xs font-bold text-slate-800">
                {jumlahTerpilih} / 3 Terpilih
              </span>
            </div>
            {canManageSelection && (
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(rekapData.filter((k) => k.dipilih_untuk_si_ikk).map((k) => k.id));
                  setShowPenetapanModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2E486F] hover:to-[#395886] px-4 py-2 text-xs font-bold text-white shadow-palette-xs transition-all cursor-pointer"
              >
                <Target className="h-4 w-4" />
                <span>Tetapkan 3 Kebijakan SI IKK</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#395886]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Ringkasan Eksekutif Kebijakan Terpilih
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total {rekapData.length} Kebijakan Terdaftar
          </span>
        </div>

        {displayExecutive.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#B1C9EF] bg-white p-7 text-center text-slate-500 text-xs space-y-2 shadow-xs">
            <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-[#395886]">
              <Target className="h-5 w-5" />
            </div>
            <p className="font-bold text-slate-700 text-sm">Belum Ada Kebijakan Terpilih untuk SI IKK LAN</p>
            <p className="max-w-md mx-auto text-slate-500 text-xs leading-relaxed">
              Sesuai ketentuan, tepat 3 kebijakan berstatus <span className="font-bold text-emerald-700">DISETUJUI</span> wajib ditetapkan oleh Koordinator Instansi melalui tombol <em>"Tetapkan 3 Kebijakan SI IKK"</em> di atas sebelum penyalinan resmi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {displayExecutive.map((k, idx) => {
              const config = getKualifikasiConfig(k.kualifikasi);
              return (
                <div
                  key={k.id}
                  className="relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden"
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${config.topStripe}`} />

                  <div className="p-5 sm:p-6 flex flex-col flex-1 justify-between gap-5">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-mono text-slate-400 uppercase tracking-widest">
                          <span>KEBIJAKAN 0{idx + 1}</span>
                          {k.dipilih_untuk_si_ikk && (
                            <span className="rounded bg-blue-100 text-[#395886] px-1.5 py-0.2 text-[9px]">SI IKK</span>
                          )}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${config.badge}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
                          <span>{k.kualifikasi}</span>
                        </span>
                      </div>

                      <h3
                        className="font-bold text-slate-900 text-base leading-snug tracking-tight text-balance line-clamp-2"
                        title={k.nama}
                      >
                        {k.nama}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                        <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{k.dasarHukum}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-[#395886] font-semibold mt-1.5">
                        <Building className="h-3.5 w-3.5 text-[#628ECB] flex-shrink-0" />
                        <span className="truncate">{k.satuan_kerja || selectedSatkerFilter || "Satuan Kerja Komdigi"}</span>
                      </div>
                    </div>

                    <div className={`rounded-xl border border-slate-100 p-4 ${config.bgLight}`}>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Nilai Akhir IKK
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Kombinasi 4 Dimensi + Profil
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className={`font-mono text-3xl sm:text-4xl font-black tracking-tight ${config.scoreColor} tabular-nums`}>
                            {k.nilaiTotal.toFixed(2)}
                          </span>
                          <span className="text-xs font-bold text-slate-400">/ 100</span>
                        </div>
                      </div>

                      <div className="mt-3.5 space-y-1.5">
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
                          <div
                            style={{ width: `${(k.profil / 100) * 100}%` }}
                            className="bg-slate-400 transition-all duration-500"
                            title={`Profil JFAK: ${k.profil.toFixed(2)} Poin`}
                          />
                          <div
                            style={{ width: `${(k.dimensi.a / 100) * 100}%` }}
                            className="bg-blue-600 transition-all duration-500"
                            title={`A. Perencanaan: ${k.dimensi.a.toFixed(2)} Poin`}
                          />
                          <div
                            style={{ width: `${(k.dimensi.b / 100) * 100}%` }}
                            className="bg-emerald-600 transition-all duration-500"
                            title={`B. Implementasi: ${k.dimensi.b.toFixed(2)} Poin`}
                          />
                          <div
                            style={{ width: `${(k.dimensi.c / 100) * 100}%` }}
                            className="bg-amber-500 transition-all duration-500"
                            title={`C. Evaluasi: ${k.dimensi.c.toFixed(2)} Poin`}
                          />
                          <div
                            style={{ width: `${(k.dimensi.d / 100) * 100}%` }}
                            className="bg-cyan-600 transition-all duration-500"
                            title={`D. Transparansi: ${k.dimensi.d.toFixed(2)} Poin`}
                          />
                        </div>

                        <div className="grid grid-cols-5 gap-1 text-[10px] pt-1 text-center font-mono">
                          <div className="rounded bg-slate-100/80 py-1 text-slate-600" title="Profil (Maks. 10)">
                            <span className="block text-[9px] text-slate-400 font-sans">Prof</span>
                            <span className="font-bold">{k.profil.toFixed(1)}</span>
                          </div>
                          <div className="rounded bg-blue-50 py-1 text-blue-700" title="A. Perencanaan (Maks. 25)">
                            <span className="block text-[9px] text-blue-400 font-sans">Dim A</span>
                            <span className="font-bold">{k.dimensi.a.toFixed(1)}</span>
                          </div>
                          <div className="rounded bg-emerald-50 py-1 text-emerald-700" title="B. Implementasi (Maks. 30)">
                            <span className="block text-[9px] text-emerald-400 font-sans">Dim B</span>
                            <span className="font-bold">{k.dimensi.b.toFixed(1)}</span>
                          </div>
                          <div className="rounded bg-amber-50 py-1 text-amber-700" title="C. Evaluasi (Maks. 15)">
                            <span className="block text-[9px] text-amber-400 font-sans">Dim C</span>
                            <span className="font-bold">{k.dimensi.c.toFixed(1)}</span>
                          </div>
                          <div className="rounded bg-cyan-50 py-1 text-cyan-700" title="D. Transparansi (Maks. 20)">
                            <span className="block text-[9px] text-cyan-500 font-sans">Dim D</span>
                            <span className="font-bold">{k.dimensi.d.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        <span>Rekomendasi Tindak Lanjut:</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px] line-clamp-3">
                        {k.rekomendasi}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visualisasi Data Section (Tabbed Interactive View) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4.5 w-4.5 text-[#395886]" />
              <span>Visualisasi Analitik Capaian Kebijakan</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Grafik komparatif nilai, kontribusi dimensi, heatmap 11 indikator, dan matriks kesiapan bukti dukung real LAN RI.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="inline-flex flex-wrap rounded-2xl border border-[#D5DEEF] bg-[#F0F3FA] p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTabVisual("radar")}
              className={`rounded-xl px-3.5 py-1.5 font-bold transition-all ${
                activeTabVisual === "radar"
                  ? "bg-white text-[#395886] shadow-palette-sm border border-[#D5DEEF]"
                  : "text-slate-600 hover:text-[#395886]"
              }`}
            >
              Komparasi Radar Dimensi
            </button>
            <button
              type="button"
              onClick={() => setActiveTabVisual("skor")}
              className={`rounded-xl px-3.5 py-1.5 font-bold transition-all ${
                activeTabVisual === "skor"
                  ? "bg-white text-[#395886] shadow-palette-sm border border-[#D5DEEF]"
                  : "text-slate-600 hover:text-[#395886]"
              }`}
            >
              Komparasi Nilai &amp; Ambang
            </button>
            <button
              type="button"
              onClick={() => setActiveTabVisual("dimensi")}
              className={`rounded-xl px-3.5 py-1.5 font-bold transition-all ${
                activeTabVisual === "dimensi"
                  ? "bg-white text-[#395886] shadow-palette-sm border border-[#D5DEEF]"
                  : "text-slate-600 hover:text-[#395886]"
              }`}
            >
              Komparasi Dimensi
            </button>
            <button
              type="button"
              onClick={() => setActiveTabVisual("indikator")}
              className={`rounded-xl px-3.5 py-1.5 font-bold transition-all ${
                activeTabVisual === "indikator"
                  ? "bg-white text-[#395886] shadow-palette-sm border border-[#D5DEEF]"
                  : "text-slate-600 hover:text-[#395886]"
              }`}
            >
              Heatmap 11 Indikator
            </button>
            <button
              type="button"
              onClick={() => setActiveTabVisual("resume")}
              className={`rounded-xl px-3.5 py-1.5 font-bold transition-all ${
                activeTabVisual === "resume"
                  ? "bg-white text-[#395886] shadow-palette-sm border border-[#D5DEEF]"
                  : "text-slate-600 hover:text-[#395886]"
              }`}
            >
              Resume Bukti Dukung
            </button>
          </div>
        </div>

        {/* Visual Content Based on Active Tab */}
        <div className="pt-6">
          {activeTabVisual === "skor" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800">Rentang Kualifikasi Resmi LAN RI:</span>
                <div className="flex flex-wrap items-center gap-3.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span>Kurang (&lt;50)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span>Cukup (50–64,99)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                    <span>Baik (65–79,99)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span>Sangat Baik (80–90,99)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    <span>Unggul (91–100)</span>
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                {rekapData.map((k) => {
                  const config = getKualifikasiConfig(k.kualifikasi);
                  return (
                    <div key={k.id} className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {k.nama}
                        </span>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-sm font-black text-slate-800">
                            {k.nilaiTotal.toFixed(2)}
                          </span>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${config.badge}`}>
                            {k.kualifikasi}
                          </span>
                        </div>
                      </div>

                      <div className="relative h-4 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, k.nilaiTotal)}%` }}
                          className={`h-full rounded-full bg-gradient-to-r ${config.topStripe} transition-all duration-700`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTabVisual === "dimensi" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {dimensiConfig.map((dim) => (
                  <div key={dim.key} className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{dim.label}</span>
                      <span className="font-mono text-[11px] text-slate-500">Maks {dim.bobotMaks}%</span>
                    </div>

                    <div className="space-y-3 pt-1">
                      {rekapData.map((k) => {
                        const nilai = k.dimensi[dim.key];
                        const persen = (nilai / dim.bobotMaks) * 100;
                        return (
                          <div key={k.id} className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-800 font-medium truncate max-w-[180px]" title={k.nama}>
                                {k.nama}
                              </span>
                              <span className="font-mono font-bold text-slate-900">
                                {nilai.toFixed(2)} / {dim.bobotMaks}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, persen)}%` }}
                                className={`h-full rounded-full ${dim.warna} transition-all duration-500`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTabVisual === "indikator" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pb-1">
                <span className="font-bold text-slate-800">Matriks Skor Indikator A1–D2 (Data Asli PostgreSQL):</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded bg-emerald-600 text-[9px] text-white flex items-center justify-center font-bold">100</span>
                    <span className="font-medium text-slate-700">Optimal (E)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded bg-emerald-400 text-[9px] text-emerald-950 flex items-center justify-center font-bold">75</span>
                    <span className="font-medium text-slate-700">Memadai (D)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded bg-amber-300 text-[9px] text-amber-950 flex items-center justify-center font-bold">50</span>
                    <span className="font-medium text-slate-700">Cukup (C)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded bg-amber-500 text-[9px] text-white flex items-center justify-center font-bold">25</span>
                    <span className="font-medium text-slate-700">Minimal (B)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded bg-rose-100 text-[9px] text-rose-800 flex items-center justify-center font-bold">0</span>
                    <span className="font-medium text-slate-700">Belum Ada (A)</span>
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-700">
                    <tr>
                      <th className="px-4 py-3 max-w-xs">Indikator Penilaian IKK</th>
                      {rekapData.map((k, i) => (
                        <th key={k.id} className="px-4 py-3 text-center">
                          {k.nama.slice(0, 24)}... (Kebijakan #{i + 1})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {indikatorList.map((ind) => (
                      <tr key={ind.kode} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-900 font-medium">
                          {ind.label}
                        </td>
                        {rekapData.map((k) => {
                          const skor = k.skorIndikator[ind.kode] ?? 0;
                          return (
                            <td key={k.id} className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-flex h-7 w-12 items-center justify-center rounded-lg text-xs font-mono ${getHeatmapColor(
                                  skor
                                )}`}
                              >
                                {skor}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTabVisual === "radar" && (() => {
            const currentPolicy = rekapData.find((p) => p.id === selectedRadarPolicyId);
            const totalPolicies = rekapData.length;

            const avgPerencanaan = totalPolicies > 0
              ? (rekapData.reduce((acc, curr) => acc + (curr.dimensi.a / 20), 0) / totalPolicies) * 100
              : 0;
            const avgImplementasi = totalPolicies > 0
              ? (rekapData.reduce((acc, curr) => acc + (curr.dimensi.b / 25), 0) / totalPolicies) * 100
              : 0;
            const avgEvaluasi = totalPolicies > 0
              ? (rekapData.reduce((acc, curr) => acc + (curr.dimensi.c / 30), 0) / totalPolicies) * 100
              : 0;
            const avgTransparansi = totalPolicies > 0
              ? (rekapData.reduce((acc, curr) => acc + (curr.dimensi.d / 15), 0) / totalPolicies) * 100
              : 0;
            const avgTotal = totalPolicies > 0
              ? rekapData.reduce((acc, curr) => acc + curr.nilaiTotal, 0) / totalPolicies
              : 0;

            const radarScores = currentPolicy
              ? {
                  title: currentPolicy.nama,
                  perencanaan: (currentPolicy.dimensi.a / 20) * 100,
                  implementasi: (currentPolicy.dimensi.b / 25) * 100,
                  evaluasi: (currentPolicy.dimensi.c / 30) * 100,
                  transparansi: (currentPolicy.dimensi.d / 15) * 100,
                  jfak: currentPolicy.profil === 10 ? 100 : 0,
                  total: currentPolicy.nilaiTotal,
                }
              : {
                  title: `Rata-rata ${totalPolicies} Kebijakan Terdaftar`,
                  perencanaan: avgPerencanaan,
                  implementasi: avgImplementasi,
                  evaluasi: avgEvaluasi,
                  transparansi: avgTransparansi,
                  jfak: periode.melibatkan_jfak ? 100 : 0,
                  total: avgTotal,
                };

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-4">
                  <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Pilih Obyek Analisis Radar:
                    </label>
                    <select
                      value={selectedRadarPolicyId}
                      onChange={(e) => setSelectedRadarPolicyId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-[#395886] focus:ring-1 focus:ring-[#395886] shadow-2xs"
                    >
                      <option value="all">★ Rata-rata Seluruh Kebijakan ({totalPolicies} Kebijakan)</option>
                      {rekapData.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nama.slice(0, 40)}... ({k.nilaiTotal.toFixed(2)} - {k.kualifikasi})
                        </option>
                      ))}
                    </select>

                    <div className="text-xs text-slate-600 space-y-2 pt-1 border-t border-slate-200/70">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Obyek Terpilih:</span>
                        <span className="font-bold text-slate-800 text-right truncate max-w-[200px]" title={radarScores.title}>
                          {radarScores.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Nilai Akhir:</span>
                        <span className="font-mono font-black text-slate-900">
                          {radarScores.total.toFixed(2)} / 100
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Kualifikasi:</span>
                        <span className="font-bold text-slate-900">
                          {currentPolicy ? currentPolicy.kualifikasi : (radarScores.total >= 91 ? "Unggul" : radarScores.total >= 80 ? "Sangat Baik" : radarScores.total >= 65 ? "Baik" : radarScores.total >= 50 ? "Cukup" : "Kurang")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-blue-950">
                      <Target className="h-4 w-4 text-[#395886]" />
                      <span>Interpretasi Radar Dimensi IKK</span>
                    </div>
                    <p className="leading-relaxed text-blue-800 text-[11px]">
                      Grafik pentagon memetakan capaian di 5 poros utama: <strong>A. Perencanaan (25%)</strong>, <strong>B. Implementasi (30%)</strong>, <strong>C. Evaluasi (15%)</strong>, <strong>D. Transparansi (20%)</strong>, dan <strong>JFAK (10%)</strong>.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <RadarDimensiIKK
                    instansiName={periode.instansi}
                    perencanaanScore={radarScores.perencanaan}
                    implementasiScore={radarScores.implementasi}
                    evaluasiScore={radarScores.evaluasi}
                    transparansiScore={radarScores.transparansi}
                    jfakScore={radarScores.jfak}
                    totalScore={radarScores.total}
                    showCardWrapper={true}
                  />
                </div>
              </div>
            );
          })()}

          {/* TAB BARU: Resume Bukti Dukung (Matriks Kesiapan Sesuai Panduan LAN) */}
          {activeTabVisual === "resume" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-slate-900">
                    Matriks Resume Bukti Dukung Mandiri IKK 2026
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Wajib lengkap untuk seluruh kebijakan sebelum disalin ke SI IKK
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-[#F0F3FA] text-[#395886] font-bold">
                    <tr>
                      <th className="px-3.5 py-3 w-16 text-center">Kode</th>
                      <th className="px-4 py-3 min-w-[240px]">Pertanyaan &amp; Indikator</th>
                      <th className="px-4 py-3 min-w-[200px]">Bentuk Bukti Standar</th>
                      {rekapData.map((k, i) => (
                        <th key={k.id} className="px-3 py-3 text-center min-w-[140px]">
                          <div className="font-bold text-slate-900 truncate max-w-[140px]" title={k.nama}>
                            Kebijakan #{i + 1}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal truncate max-w-[140px]">
                            {k.nama}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {matriksKesiapan.map((item) => (
                      <tr key={item.kode_pertanyaan} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3.5 py-3 text-center font-mono font-bold text-slate-800">
                          <span className="inline-flex rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-blue-700">
                            {item.kode_pertanyaan}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 text-[11px]">
                            {item.teks_pertanyaan}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Dimensi {item.dimensi_kode}: {item.dimensi_nama}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-[11px]">
                          {item.bukti_dukung_wajib}
                        </td>
                        {rekapData.map((k) => {
                          const tersedia = item.ketersediaan[k.id] ?? false;
                          const ringkasan = item.ringkasan_bukti[k.id] ?? "Belum diunggah";

                          return (
                            <td key={k.id} className="px-3 py-3 text-center">
                              {tersedia ? (
                                <div className="inline-flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span>Tersedia</span>
                                  </span>
                                  <span className="text-[10px] text-slate-500 truncate max-w-[120px]" title={ringkasan}>
                                    {ringkasan}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                  <span>Belum Diunggah</span>
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Official Rekap Data Table (PostgreSQL Data) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-[#395886]" />
            <span>Tabel Tabulasi Rekapitulasi IKK (Database Resmi)</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Format Standar LAN RI</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#D5DEEF] bg-white/95 shadow-palette-sm">
          <table className="min-w-full divide-y divide-[#D5DEEF] text-left text-xs">
            <thead className="bg-[#F0F3FA] font-bold uppercase tracking-wider text-[#395886] border-b border-[#D5DEEF]">
              <tr>
                <th scope="col" className="px-5 py-4">
                  Kebijakan Pembangunan Strategis
                </th>
                <th scope="col" className="px-3.5 py-4 text-center">
                  Profil (10%)
                </th>
                <th scope="col" className="px-3.5 py-4 text-center">
                  A. Perencanaan (20%)
                </th>
                <th scope="col" className="px-3.5 py-4 text-center">
                  B. Implementasi (25%)
                </th>
                <th scope="col" className="px-3.5 py-4 text-center">
                  C. Evaluasi (30%)
                </th>
                <th scope="col" className="px-3.5 py-4 text-center">
                  D. Transparansi (15%)
                </th>
                <th scope="col" className="px-4 py-4 text-right font-black text-[#395886] bg-[#F0F3FA]">
                  Nilai Total
                </th>
                <th scope="col" className="px-4 py-4 text-center">
                  Kualifikasi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5DEEF]">
              {rekapData.map((row) => {
                const config = getKualifikasiConfig(row.kualifikasi);
                return (
                  <tr key={row.id} className="hover:bg-[#F0F3FA]/60 transition-colors">
                    <td className="px-5 py-4 max-w-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1E304B] leading-snug">
                          {row.nama}
                        </span>
                        {row.dipilih_untuk_si_ikk && (
                          <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 text-[9px] font-bold flex-shrink-0 inline-flex items-center gap-1 shadow-2xs">
                            <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                            <span>Pilihan SI IKK</span>
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold flex-shrink-0 ${
                            row.status_asesmen === "DISETUJUI" || row.status_asesmen === "TERKIRIM_SI_IKK"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                              : row.status_asesmen === "DIAJUKAN"
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {row.status_asesmen === "DISETUJUI" ? "DISETUJUI KOORDINATOR" : row.status_asesmen}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                        <FileText className="h-3 w-3 text-[#628ECB]" />
                        <span>Dasar Hukum: {row.dasarHukum}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-[#395886] font-semibold flex items-center gap-1">
                        <Building className="h-3 w-3 text-[#628ECB]" />
                        <span>Satker: {row.satuan_kerja || selectedSatkerFilter || "Satuan Kerja Komdigi"}</span>
                      </div>
                      <div className="mt-2 text-[11px] text-[#395886] bg-[#F0F3FA] rounded-xl px-2.5 py-1.5 border border-[#B1C9EF]">
                        <span className="font-bold">Rekomendasi:</span> {row.rekomendasi}
                      </div>
                    </td>
                    <td className="px-3.5 py-4 text-center font-mono tabular-nums text-slate-700 font-semibold">
                      {row.profil.toFixed(2)}
                    </td>
                    <td className="px-3.5 py-4 text-center font-mono tabular-nums text-slate-700 font-semibold">
                      {row.dimensi.a.toFixed(2)}
                    </td>
                    <td className="px-3.5 py-4 text-center font-mono tabular-nums text-slate-700 font-semibold">
                      {row.dimensi.b.toFixed(2)}
                    </td>
                    <td className="px-3.5 py-4 text-center font-mono tabular-nums text-slate-700 font-semibold">
                      {row.dimensi.c.toFixed(2)}
                    </td>
                    <td className="px-3.5 py-4 text-center font-mono tabular-nums text-slate-700 font-semibold">
                      {row.dimensi.d.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-black text-base text-blue-700 tabular-nums bg-blue-50/40">
                      {row.nilaiTotal.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${config.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
                        <span>{row.kualifikasi}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Penetapan 3 Kebijakan Resmi SI IKK LAN */}
      {showPenetapanModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-[#F0F3FA]/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#395886] text-white shadow-xs">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Penetapan 3 Kebijakan Resmi SI IKK LAN
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hanya kebijakan yang telah dinilai dan berstatus <strong>DISETUJUI</strong> yang berhak dipilih.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPenetapanModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-[#395886] flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 flex-shrink-0 text-[#395886] mt-0.5" />
                <div className="leading-relaxed">
                  Berdasarkan pedoman pengukuran kualitas kebijakan LAN RI, instansi wajib menetapkan tepat <strong>3 kebijakan pembangunan strategis</strong> untuk dilaporkan ke Sistem Informasi IKK. Sistem memproteksi agar hanya kebijakan yang telah <strong>selesai dinilai dan divalidasi/disetujui (Status: DISETUJUI)</strong> oleh Koordinator yang dapat dipilih.
                </div>
              </div>

              {/* Status Validasi Kebijakan Banner */}
              {(() => {
                const approvedCount = rekapData.filter(
                  (k) => k.status_asesmen === "DISETUJUI" || k.status_asesmen === "TERKIRIM_SI_IKK"
                ).length;
                if (approvedCount < 3) {
                  return (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <span>
                        Saat ini baru terdapat <strong>{approvedCount} kebijakan</strong> yang berstatus disetujui (DISETUJUI). Silakan lakukan verifikasi dan persetujuan asesmen di menu <strong>Form Asesmen</strong> atau <strong>Verifikasi</strong> hingga minimal 3 kebijakan disetujui untuk memenuhi kuota.
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Daftar Kebijakan Kandidat dalam Periode {periode.tahun}:</span>
                  <span className="font-mono text-slate-500 font-normal">
                    Pilihan: <strong className="text-[#395886]">{selectedIds.length}</strong> / 3
                  </span>
                </div>

                {rekapData.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                    Belum ada kebijakan yang terdaftar dalam periode ini.
                  </div>
                ) : (
                  rekapData.map((k) => {
                    const isApproved =
                      k.status_asesmen === "DISETUJUI" || k.status_asesmen === "TERKIRIM_SI_IKK";
                    const isSelected = selectedIds.includes(k.id);

                    return (
                      <div
                        key={k.id}
                        onClick={() => {
                          if (isApproved) togglePolicySelect(k.id, k.status_asesmen);
                        }}
                        className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                          !isApproved
                            ? "border-slate-200 bg-slate-50/60 opacity-70 cursor-not-allowed"
                            : isSelected
                            ? "border-[#395886] bg-blue-50/50 shadow-palette-xs cursor-pointer ring-1 ring-[#395886]/30"
                            : "border-slate-200 bg-white hover:border-[#8AAEE0] hover:bg-[#F0F3FA]/40 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                              !isApproved
                                ? "border-slate-300 bg-slate-100 text-slate-400"
                                : isSelected
                                ? "border-[#395886] bg-[#395886] text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </div>

                          <div>
                            <div className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                              {k.nama}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                              <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-[#395886] flex items-center gap-1">
                                <Building className="h-3 w-3 text-[#628ECB]" />
                                <span>{k.satuan_kerja || "Satuan Kerja"}</span>
                              </span>
                              <span className="text-[11px] font-mono text-slate-600">{k.dasarHukum}</span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-xs">
                              <span className="font-bold text-slate-700">
                                Nilai: <span className="font-mono text-[#395886]">{k.nilaiTotal.toFixed(2)}</span>
                              </span>
                              <span className="text-slate-400">&bull;</span>
                              <span className="font-semibold text-slate-600">Kualifikasi: {k.kualifikasi}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Disetujui</span>
                            </span>
                          ) : (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                                <span>{k.status_asesmen || "Belum Selesai"}</span>
                              </span>
                              <span className="block text-[10px] text-amber-700 font-semibold mt-0.5">
                                Belum divalidasi
                              </span>
                            </div>
                          )}
                          {isSelected && (
                            <span className="text-[10px] font-bold text-[#395886] flex items-center gap-0.5 mt-1">
                              <Sparkles className="h-3 w-3" />
                              <span>Terpilih</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 p-4 bg-slate-50/80">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600">Status Seleksi:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    selectedIds.length === 3
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  {selectedIds.length === 3 ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                  )}
                  <span>{selectedIds.length} dari 3 Kebijakan Terpilih</span>
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowPenetapanModal(false)}
                  disabled={isSavingPenetapan}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSimpanPenetapan}
                  disabled={selectedIds.length !== 3 || isSavingPenetapan}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2E486F] hover:to-[#395886] px-5 py-2 text-xs font-bold text-white shadow-palette-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSavingPenetapan ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Simpan Penetapan 3 Kebijakan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
