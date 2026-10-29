import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BarChart3,
  CheckCircle2,
  FileText,
  Layers,
  ArrowRight,
  Calculator,
  FileCheck,
  Users,
} from "lucide-react";

import { KebijakanView } from "./features/kebijakan/KebijakanView";
import { AsesmenView } from "./features/asesmen/AsesmenView";
import { RekapView } from "./features/rekap/RekapView";
import { LoginView } from "./features/auth/LoginView";
import { PenggunaManagementView } from "./features/pengguna/PenggunaManagementView";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { RoleSwitcher } from "./features/auth/RoleSwitcher";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { useDaftarPeriodeApiV1PeriodeGet } from "./api/endpoints/periode/periode";
import { useDaftarKebijakanApiV1KebijakanGet } from "./api/endpoints/kebijakan-strategis/kebijakan-strategis";

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isAuthenticated, isAdmin, isKoordinator, user } = useAuth();

  // Auto-refresh seluruh query setiap kali berpindah halaman atau berganti akun pengguna
  useEffect(() => {
    queryClient.invalidateQueries();
  }, [location.pathname, user?.id, isAuthenticated, queryClient]);

  // Pantau jumlah kebijakan yang baru diajukan (DIAJUKAN) untuk indikator dot merah Koordinator
  const { data: periodeNavResp } = useDaftarPeriodeApiV1PeriodeGet(
    { tahun: 2026 },
    {
      query: {
        enabled: isAuthenticated && (isKoordinator || isAdmin),
      },
    }
  );
  const activePeriodeNavId = periodeNavResp?.data?.[0]?.id;

  const { data: kebijakanNavResp } = useDaftarKebijakanApiV1KebijakanGet(
    { periode_id: activePeriodeNavId! },
    {
      query: {
        enabled: isAuthenticated && (isKoordinator || isAdmin) && !!activePeriodeNavId,
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
      },
    }
  );

  const jumlahPengajuanDiajukan = (kebijakanNavResp?.data || []).filter(
    (k) => k.status_asesmen === "DIAJUKAN"
  ).length;

  // Jika belum login, HANYA DAPAT MEMBUKA BERANDA
  const navLinks = !isAuthenticated
    ? [{ to: "/", label: "Beranda", icon: Layers }]
    : [
        { to: "/", label: "Beranda", icon: Layers },
        { to: "/kebijakan", label: "Kebijakan Satker", icon: FileText },
        { to: "/asesmen", label: "Form Asesmen", icon: CheckCircle2 },
        { to: "/rekap", label: "Tabel Rekap & Ekspor", icon: BarChart3 },
        ...(isAdmin || isKoordinator
          ? [
              {
                to: "/pengguna",
                label: isKoordinator ? "Verifikasi & Akun" : "Manajemen Akun",
                icon: Users,
              },
            ]
          : []),
      ];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#F0F3FA] via-[#F5F8FD] to-[#E8EEF8] text-slate-900 font-sans relative selection:bg-brand-200 selection:text-brand-900">
      {/* Subtle Top Ambient Mesh Lighting */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-80 w-full max-w-7xl bg-gradient-to-b from-[#B1C9EF]/30 via-[#D5DEEF]/20 to-transparent blur-3xl -z-10" />

      {/* Top Executive Header */}
      <header className="sticky top-0 z-40 border-b border-[#D5DEEF] bg-white/90 backdrop-blur-md shadow-palette-sm">
        {/* Tier 1: Brand, Live Status Beacon & Role Switcher */}
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Brand Emblem & Single-line Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#395886] via-[#4E73A9] to-[#628ECB] text-white shadow-xs ring-1 ring-[#395886]/20 flex-shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base font-bold tracking-tight text-[#1E304B] whitespace-nowrap">
                Xaka IKK Self-Assessment
              </span>
              <span className="rounded-full bg-[#F0F3FA] px-2.5 py-0.5 text-[10px] font-bold text-[#395886] border border-[#B1C9EF] whitespace-nowrap flex-shrink-0 shadow-2xs">
                Instrumen 2026
              </span>
            </div>
          </div>

          {/* Right: Live Status Pill & Role Switcher / Login button */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            {isAuthenticated ? (
              <>
                <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#B1C9EF] bg-[#F0F3FA] px-3 py-1 text-[11px] font-semibold text-[#395886] shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#628ECB] opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#395886]"></span>
                  </span>
                  <span>Ruang Kerja Terotentikasi</span>
                </div>
                <RoleSwitcher />
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2F4A72] hover:to-[#395886] px-4 text-xs font-bold text-white shadow-palette-sm transition-all focus:outline-hidden"
              >
                <span>Masuk ke Sistem</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Tier 2: Dedicated Segmented Navigation Tabs */}
        <div className="border-t border-[#D5DEEF]/60 bg-[#F0F3FA]/70">
          <div className="mx-auto flex max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1.5 py-1.5 overflow-x-auto no-scrollbar">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-white text-[#395886] shadow-palette-sm border border-[#D5DEEF] font-bold"
                        : "text-slate-600 hover:text-[#395886] hover:bg-white/70"
                    }`}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-[#395886]" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                    {item.to === "/kebijakan" &&
                      (isKoordinator || isAdmin) &&
                      jumlahPengajuanDiajukan > 0 && (
                        <span
                          className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-2xs"
                          title={`${jumlahPengajuanDiajukan} kebijakan baru diajukan oleh Analis Satker dan menunggu tinjauan`}
                        >
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-200 opacity-90" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          <span>{jumlahPengajuanDiajukan}</span>
                        </span>
                      )}
                  </Link>
                );
              })}
              {!isAuthenticated && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 italic px-2 py-1.5">
                  &bull; Masuk untuk membuka modul penilaian mandiri
                </span>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<BerandaView />} />
          <Route path="/login" element={<LoginView />} />
          <Route path="/periode" element={<Navigate to="/kebijakan" replace />} />
          <Route
            path="/kebijakan"
            element={
              <ProtectedRoute allowedRoles={["ANALIS", "KOORDINATOR", "ADMIN"]}>
                <KebijakanView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/asesmen"
            element={
              <ProtectedRoute allowedRoles={["ANALIS", "KOORDINATOR", "ADMIN"]}>
                <AsesmenView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rekap"
            element={
              <ProtectedRoute allowedRoles={["ANALIS", "KOORDINATOR", "ADMIN"]}>
                <RekapView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pengguna"
            element={
              <ProtectedRoute allowedRoles={["ADMIN", "KOORDINATOR"]}>
                <PenggunaManagementView />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D5DEEF] bg-white/80 backdrop-blur-xs py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Xaka IKK Self-Assessment &bull; Ruang Kerja Penyiapan Penilaian Mandiri 2026.
          </span>
          <span className="font-medium text-slate-500">
            Xaka IKK Self-Assessment Workspace
          </span>
        </div>
      </footer>
    </div>
  );
}

function BerandaView() {
  const { isAuthenticated, peran, user, isAnalis, isKoordinator } = useAuth();

  const dimensiData = [
    {
      kode: "Profil",
      nama: "Keterlibatan JFAK",
      bobot: "10,00%",
      indikator: "1 Pertanyaan Profil",
      bukti: "Surat Penunjukan resmi yang dapat diakses publik",
      rujukan: "Panduan Pengukuran IKK LAN RI",
    },
    {
      kode: "Dimensi A",
      nama: "Perencanaan Kebijakan",
      bobot: "25,00%",
      indikator: "3 Indikator (A1, A2, A3)",
      bukti: "Laporan kajian valid, risalah konsultasi publik, analisis RIA / ROCCIPI",
      rujukan: "UU 12/2011, Permenpan 16/2017",
    },
    {
      kode: "Dimensi B",
      nama: "Implementasi Kebijakan",
      bobot: "30,00%",
      indikator: "3 Indikator (B1, B2, B3)",
      bukti: "Dokumen SOP/Bispro, laporan monev triwulan/tahunan, laporan audit SAKIP",
      rujukan: "Permenpan 35/2012, Permenpan 15/2014",
    },
    {
      kode: "Dimensi C",
      nama: "Evaluasi dan Keberlanjutan",
      bobot: "15,00%",
      indikator: "3 Indikator (C1, C2, C3)",
      bukti: "Laporan LPPD, survei kepuasan masyarakat independen, analisis keselarasan regulasi",
      rujukan: "Pedoman Evaluasi BPHN 2019",
    },
    {
      kode: "Dimensi D",
      nama: "Transparansi dan Partisipasi Publik",
      bobot: "20,00%",
      indikator: "2 Indikator (D1, D2)",
      bukti: "Portal resmi multi-format, dokumentasi riwayat tanggapan aduan publik",
      rujukan: "UU Keterbukaan Informasi Publik",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Hero Surface in Deep Slate Navy Gradient */}
      <div className="relative overflow-hidden rounded-2xl border border-[#4E73A9]/40 bg-gradient-to-br from-[#395886] via-[#2F4A72] to-[#223652] p-6 text-white shadow-palette-lg sm:p-8">
        {/* Ambient decorative glow inside hero */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#8AAEE0]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#628ECB]/15 blur-2xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#D5DEEF] backdrop-blur-sm border border-white/15">
              <span className="h-2 w-2 rounded-full bg-[#B1C9EF] animate-pulse" />
              <span>
                {isAuthenticated
                  ? `Sesi Aktif: ${user.nama} (${peran})`
                  : "Xaka IKK Self-Assessment &bull; Penyiapan IKK 2026"}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Penyiapan Penilaian Mandiri Indeks Kualitas Kebijakan
            </h1>
            <p className="text-sm leading-relaxed text-[#D5DEEF]">
              Ruang kerja internal instansi untuk mengisi indikator penilaian mandiri, menghimpun dan menata berkas bukti dukung (PDF/Word serta tautan awan), memantau kalkulasi skor seketika dengan formula resmi LAN RI, serta memverifikasi kesiapan bukti sebelum disalin ke SI IKK.
            </p>

            {/* Dynamic CTA based on Auth & Role */}
            <div className="flex flex-wrap gap-3 pt-2">
              {!isAuthenticated ? (
                <>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-[#395886] transition-all hover:bg-[#F0F3FA] hover:shadow-md cursor-pointer"
                  >
                    <span>Masuk ke Sistem untuk Mulai Penilaian</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#matriks-peran"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                  >
                    <span>Pelajari Wewenang Peran</span>
                  </a>
                </>
              ) : isAnalis ? (
                <>
                  <Link
                    to="/asesmen"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#395886] transition-all hover:bg-[#F0F3FA] hover:shadow-md"
                  >
                    <span>Isi Form Asesmen &amp; Bukti Dukung</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/kebijakan"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                  >
                    <span>Tinjau 3 Kebijakan Strategis</span>
                  </Link>
                </>
              ) : isKoordinator ? (
                <>
                  <Link
                    to="/kebijakan"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#395886] transition-all hover:bg-[#F0F3FA] hover:shadow-md"
                  >
                    <span>Tetapkan 3 Kebijakan Strategis SI-IKK</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/asesmen"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                  >
                    <span>Review &amp; Setujui Asesmen Analis</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/pengguna"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#395886] transition-all hover:bg-[#F0F3FA] hover:shadow-md"
                  >
                    <span>Buka Manajemen Akun Pengguna</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/kebijakan"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                  >
                    <span>Monitoring Penilaian Instansi</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Executive Overview Capsule */}
          <div className="grid grid-cols-2 gap-3 lg:w-72 flex-shrink-0">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
              <div className="text-[11px] font-medium text-[#D5DEEF]">Instrumen Aktif</div>
              <div className="mt-1 text-lg font-bold text-white">IKK 2026</div>
              <div className="text-[10px] text-[#B1C9EF] mt-0.5">Versi LAN RI Terkini</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
              <div className="text-[11px] font-medium text-[#D5DEEF]">Target Kebijakan</div>
              <div className="mt-1 text-lg font-bold text-white">3 Regulasi</div>
              <div className="text-[10px] text-[#B1C9EF] mt-0.5">Wajib SI IKK</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
              <div className="text-[11px] font-medium text-[#D5DEEF]">Cakupan Dimensi</div>
              <div className="mt-1 text-lg font-bold text-white">4 Dimensi</div>
              <div className="text-[10px] text-[#B1C9EF] mt-0.5">11 Indikator + Profil</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
              <div className="text-[11px] font-medium text-[#D5DEEF]">Status Integrasi</div>
              <div className="mt-1 text-lg font-bold text-emerald-300">Siap Salin</div>
              <div className="text-[10px] text-[#B1C9EF] mt-0.5">Format SI IKK</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#D5DEEF] bg-white/95 p-5 shadow-palette-sm transition-all hover:border-[#8AAEE0] hover:shadow-palette-md backdrop-blur-xs">
          <div className="flex items-center gap-2 text-[#395886] font-bold text-xs mb-1.5">
            <div className="p-1.5 rounded-lg bg-[#F0F3FA] text-[#395886] border border-[#B1C9EF]">
              <Calculator className="h-4 w-4" />
            </div>
            <span>Formula Resmi IKK 2026</span>
          </div>
          <div className="text-xl font-bold text-[#1E304B]">100% Terkalibrasi</div>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Menggunakan pembobotan 10% Profil + 25% A + 30% B + 15% C + 20% D dengan akurasi desimal presisi.
          </p>
        </div>

        <div className="rounded-2xl border border-[#D5DEEF] bg-white/95 p-5 shadow-palette-sm transition-all hover:border-[#8AAEE0] hover:shadow-palette-md backdrop-blur-xs">
          <div className="flex items-center gap-2 text-[#395886] font-bold text-xs mb-1.5">
            <div className="p-1.5 rounded-lg bg-[#F0F3FA] text-[#628ECB] border border-[#B1C9EF]">
              <FileCheck className="h-4 w-4" />
            </div>
            <span>Holding Area Bukti Digital</span>
          </div>
          <div className="text-xl font-bold text-[#1E304B]">Penataan Berkas &amp; Tautan</div>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Menampung dokumen bukti (PDF/Word drag &amp; drop serta tautan awan on-demand) untuk telaah internal instansi.
          </p>
        </div>

        <div className="rounded-2xl border border-[#D5DEEF] bg-white/95 p-5 shadow-palette-sm transition-all hover:border-[#8AAEE0] hover:shadow-palette-md backdrop-blur-xs">
          <div className="flex items-center gap-2 text-[#395886] font-bold text-xs mb-1.5">
            <div className="p-1.5 rounded-lg bg-[#F0F3FA] text-[#4E73A9] border border-[#B1C9EF]">
              <Layers className="h-4 w-4" />
            </div>
            <span>Struktur Kebijakan</span>
          </div>
          <div className="text-xl font-bold text-[#1E304B]">Tepat 3 Kebijakan</div>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Menyaring kandidat kebijakan publik strategis yang telah ditetapkan dan berdampak langsung ke masyarakat luas.
          </p>
        </div>
      </div>

      {/* Dimensi & Pembobotan Ledger Table */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#395886]">
          Struktur Dimensi &amp; Pembobotan Instrumen Pengukuran IKK 2026
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[#D5DEEF] bg-white/95 shadow-palette-sm">
          <table className="min-w-full divide-y divide-[#D5DEEF] text-left text-xs">
            <thead className="bg-[#F0F3FA] font-bold uppercase tracking-wider text-[#395886]">
              <tr>
                <th scope="col" className="px-4 py-3.5">
                  Kode &amp; Dimensi
                </th>
                <th scope="col" className="px-4 py-3.5 text-center">
                  Bobot Total
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Cakupan Indikator
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Persyaratan Bukti Dukung
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Rujukan Regulasi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5DEEF]">
              {dimensiData.map((d) => (
                <tr key={d.kode} className="hover:bg-[#F0F3FA]/60 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-[#1E304B]">{d.nama}</div>
                    <div className="text-[11px] font-mono text-[#395886]">{d.kode}</div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-block rounded-full bg-[#F0F3FA] border border-[#B1C9EF] px-2.5 py-0.5 font-mono font-bold text-[#395886] tabular-nums">
                      {d.bobot}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">{d.indikator}</td>
                  <td className="px-4 py-3.5 text-slate-600 max-w-xs leading-relaxed">
                    {d.bukti}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                    {d.rujukan}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matriks Wewenang & Hak Akses Peran */}
      <div id="matriks-peran" className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#395886]">
            Matriks Hak Akses &amp; Wewenang Setiap Peran (Sesuai Panduan LAN RI)
          </h2>
          <span className="text-[11px] text-slate-500 font-medium">
            Role-Based Access Control (RBAC)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Analis */}
          <div className="rounded-2xl border border-[#D5DEEF] bg-white/95 p-5 shadow-palette-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F0F3FA] text-[#395886] border border-[#B1C9EF] px-2.5 py-1 text-xs font-bold">
                <Users className="h-3.5 w-3.5" />
                <span>Analis Instansi</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Jabatan Fungsional Analis Kebijakan (JFAK) yang ditugaskan secara resmi oleh pimpinan instansi.
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-start gap-1.5 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Mengisi profil JFAK (10%) &amp; indikator 4 dimensi A1–D2 (90%)</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Mengunggah bukti dukung digital (PDF / Word) OCR-ready</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Simpan draf dan tombol <strong>Ajukan ke Koordinator</strong></span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-500 italic pt-1 border-t border-slate-100">
                <span>&bull; Khusus kebijakan milik satuan kerja analis terkait</span>
              </div>
            </div>
          </div>

          {/* Card Koordinator */}
          <div className="rounded-2xl border border-[#8AAEE0] bg-[#F0F3FA]/80 p-5 shadow-palette-sm ring-1 ring-[#395886]/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#395886] text-white border border-[#243957] px-2.5 py-1 text-xs font-bold shadow-2xs">
                <Award className="h-3.5 w-3.5" />
                <span>Koordinator Instansi</span>
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed mb-3">
              Pejabat penanggung jawab pelaksanaan pengukuran mandiri IKK di lingkungan instansi.
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Memvalidasi usulan kebijakan antarsatker &amp; verifikasi akun pengguna</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Menetapkan <strong>tepat 3 kebijakan strategis</strong> SI-IKK</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Menyetujui</strong> atau <strong>Kembalikan</strong> asesmen (wajib catatan)</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Ekspor resmi Excel Form 2026 &amp; Rekapitulasi PDF</span>
              </div>
            </div>
          </div>

          {/* Card Administrator */}
          <div className="rounded-2xl border border-[#D5DEEF] bg-white/95 p-5 shadow-palette-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 text-white border border-slate-900 px-2.5 py-1 text-xs font-bold">
                <Users className="h-3.5 w-3.5" />
                <span>Administrator Sistem</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Pengelola teknis portal penilaian mandiri internal instansi.
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-start gap-1.5 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Manajemen Akun Pengguna</strong> (Edit profil, peran, instansi)</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Reset kata sandi pengguna staf &amp; tambah akun</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Supervisi seluruh alur &amp; monitoring data instansi</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-500 italic pt-1 border-t border-slate-100">
                <span>&bull; Modul Manajemen Akun terisolasi khusus Admin</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
