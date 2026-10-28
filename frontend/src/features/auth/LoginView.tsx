import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Building,
  UserPlus,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  Mail,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import {
  useDaftarApiV1AuthDaftarPost,
  useVerifikasiOtpApiV1AuthVerifikasiOtpPost,
  useKirimUlangOtpApiV1AuthKirimUlangOtpPost,
} from "../../api/endpoints/autentikasi/autentikasi";
import {
  DAFTAR_SATKER_KOMDIGI,
  DAFTAR_SATKER_GROUPED,
} from "./satkerList";

const KOMDIGI_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@komdigi\.go\.id$/i;

export function LoginView() {
  const navigate = useNavigate();
  const { loginDenganUsername, isAuthenticated } = useAuth();
  const daftarMutation = useDaftarApiV1AuthDaftarPost();
  const verifikasiOtpMutation = useVerifikasiOtpApiV1AuthVerifikasiOtpPost();
  const kirimUlangOtpMutation = useKirimUlangOtpApiV1AuthKirimUlangOtpPost();

  // Tab: "LOGIN" atau "REGISTER"
  const [activeTab, setActiveTab] = useState<"LOGIN" | "REGISTER">("LOGIN");

  // State Form Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State Form Registrasi Satker
  const [regNama, setRegNama] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regNip, setRegNip] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regUsernameEdited, setRegUsernameEdited] = useState(false);
  const [regSatker, setRegSatker] = useState(DAFTAR_SATKER_KOMDIGI[0]);
  const [regSatkerKustom, setRegSatkerKustom] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // State Tahap 1: Menunggu Verifikasi Kode OTP Email @komdigi.go.id
  const [otpPendingData, setOtpPendingData] = useState<{
    nama: string;
    email: string;
    nip: string;
    satuan_kerja: string;
    username: string;
    email_terkirim_smtp: boolean;
    kode_otp_simulasi?: string | null;
  } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfoMessage, setOtpInfoMessage] = useState<string | null>(null);

  // State Tahap 2: Selesai OTP, Menunggu Persetujuan Admin (Human-in-the-Loop)
  const [regSuccessData, setRegSuccessData] = useState<{
    nama: string;
    email: string;
    nip: string;
    satuan_kerja: string;
    username: string;
  } | null>(null);

  const regErrorRef = React.useRef<HTMLDivElement>(null);
  const cardTopRef = React.useRef<HTMLDivElement>(null);

  const scrollToRegError = () => {
    setTimeout(() => {
      if (regErrorRef.current) {
        regErrorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (cardTopRef.current) {
        cardTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 60);
  };

  const triggerRegError = (msg: string) => {
    setRegError(msg);
    scrollToRegError();
  };

  React.useEffect(() => {
    if (regError) {
      scrollToRegError();
    }
  }, [regError]);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate("/kebijakan");
    }
  }, [isAuthenticated, navigate]);

  const handleEmailChange = (val: string) => {
    const clean = val.trim().toLowerCase();
    setRegEmail(clean);
    if (!regUsernameEdited) {
      const prefix = clean.split("@")[0]?.replace(/[^a-z0-9._-]/g, "") || "";
      setRegUsername(prefix);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage("Email kedinasan / nama pengguna dan kata sandi wajib diisi.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await loginDenganUsername(username.trim(), password);
      navigate("/kebijakan");
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        "Gagal masuk. Periksa kembali email kedinasan / nama pengguna dan kata sandi Anda.";
      setErrorMessage(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regNama.trim()) {
      triggerRegError("Nama lengkap wajib diisi.");
      return;
    }

    if (/[.,]/.test(regNama)) {
      triggerRegError(
        "Tuliskan nama lengkap tanpa gelar akademik, tanda titik, atau koma (contoh: Budi Santoso)."
      );
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    if (!KOMDIGI_EMAIL_REGEX.test(cleanEmail)) {
      triggerRegError(
        "Wajib menggunakan alamat email kedinasan resmi berdomain @komdigi.go.id (contoh: nama.pegawai@komdigi.go.id)."
      );
      return;
    }

    const cleanNip = regNip.replace(/\s+/g, "");
    if (!/^\d{18}$/.test(cleanNip)) {
      triggerRegError("NIP harus terdiri dari 18 digit angka resmi ASN.");
      return;
    }

    const finalUsername =
      regUsername.trim().toLowerCase() || cleanEmail.split("@")[0].toLowerCase();
    if (finalUsername.length < 3) {
      triggerRegError("Nama pengguna minimal 3 karakter huruf/angka.");
      return;
    }

    const finalSatker =
      regSatker === "Lainnya (Satker / Balai / UPT Lainnya)"
        ? regSatkerKustom.trim()
        : regSatker;

    if (!finalSatker) {
      triggerRegError("Silakan tentukan nama Satuan Kerja Anda.");
      return;
    }

    if (regPassword.length < 6) {
      triggerRegError("Kata sandi minimal 6 karakter demi keamanan akun.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      triggerRegError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setIsLoading(true);
    try {
      const resp = await daftarMutation.mutateAsync({
        data: {
          nama: regNama.trim(),
          email: cleanEmail,
          nip: cleanNip,
          username: finalUsername,
          satuan_kerja: finalSatker,
          password: regPassword,
          instansi: "Kementerian Komunikasi dan Digital",
        },
      });

      const resData = resp.data;
      setOtpPendingData({
        nama: regNama.trim(),
        email: cleanEmail,
        nip: cleanNip,
        satuan_kerja: finalSatker,
        username: resData.pengguna.username,
        email_terkirim_smtp: Boolean(resData.email_terkirim_smtp),
        kode_otp_simulasi: resData.kode_otp_simulasi,
      });
      setOtpCode("");
      setOtpError(null);
      setOtpInfoMessage(resData.pesan);

      // Reset form input sensitif
      setRegPassword("");
      setRegConfirmPassword("");
    } catch (err: any) {
      const rawDetail = err?.response?.data?.detail;
      const detail =
        typeof rawDetail === "string"
          ? rawDetail
          : Array.isArray(rawDetail)
          ? rawDetail.map((d: any) => d?.msg || "").join(", ")
          : "Gagal mendaftarkan akun. Silakan periksa kembali data Anda.";
      triggerRegError(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpPendingData) return;

    const cleanOtp = otpCode.replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setOtpError("Masukkan 6 digit angka kode OTP yang dikirim ke email @komdigi.go.id Anda.");
      return;
    }

    setIsLoading(true);
    setOtpError(null);
    try {
      await verifikasiOtpMutation.mutateAsync({
        data: {
          email: otpPendingData.email,
          kode_otp: cleanOtp,
        },
      });

      setRegSuccessData({
        nama: otpPendingData.nama,
        email: otpPendingData.email,
        nip: otpPendingData.nip,
        satuan_kerja: otpPendingData.satuan_kerja,
        username: otpPendingData.username,
      });
      setOtpPendingData(null);
      setRegNama("");
      setRegEmail("");
      setRegNip("");
      setRegUsername("");
      setRegUsernameEdited(false);
      setRegSatkerKustom("");
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        "Kode OTP tidak sesuai atau sudah kedaluwarsa. Silakan coba lagi.";
      setOtpError(typeof detail === "string" ? detail : "Gagal memverifikasi kode OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpPendingData) return;
    setIsLoading(true);
    setOtpError(null);
    setOtpInfoMessage(null);
    try {
      const resp = await kirimUlangOtpMutation.mutateAsync({
        data: { email: otpPendingData.email },
      });
      const resData = resp.data;
      setOtpPendingData((prev) =>
        prev
          ? {
              ...prev,
              email_terkirim_smtp: Boolean(resData.email_terkirim_smtp),
              kode_otp_simulasi: resData.kode_otp_simulasi,
            }
          : null
      );
      setOtpInfoMessage(resData.pesan);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || "Gagal mengirim ulang kode OTP.";
      setOtpError(typeof detail === "string" ? detail : "Gagal mengirim ulang kode OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-8">
      {/* Background Decorative Ambient Glows */}
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-96 w-full max-w-4xl bg-gradient-to-b from-[#B1C9EF]/30 via-[#D5DEEF]/15 to-transparent blur-3xl -z-10" />

      <div className="w-full max-w-lg">
        {/* Main Card */}
        <div
          ref={cardTopRef}
          className="relative overflow-hidden rounded-3xl border border-[#D5DEEF] bg-white/95 p-6 shadow-palette-lg backdrop-blur-md transition-all sm:p-9"
        >
          {/* Top Brand & Emblem */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#395886] via-[#4E73A9] to-[#628ECB] text-white shadow-palette-md ring-4 ring-[#D5DEEF]/60">
              <Award className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F3FA] px-3 py-0.5 text-[11px] font-bold text-[#395886] border border-[#B1C9EF]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Portal Resmi Pra-SI IKK 2026 &bull; Komdigi</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1E304B]">
                {otpPendingData
                  ? "Verifikasi OTP Email Kedinasan"
                  : activeTab === "LOGIN"
                  ? "Masuk ke Sistem IKK"
                  : "Registrasi Akun Satker"}
              </h1>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                Penyiapan Penilaian Mandiri Indeks Kualitas Kebijakan (IKK) LAN RI
                bagi Satuan Kerja Kementerian Komunikasi dan Digital
              </p>
            </div>
          </div>

          {/* Tab Navigation Pill */}
          {!regSuccessData && !otpPendingData && (
            <div className="mt-6 flex rounded-xl bg-[#F0F3FA] p-1 border border-[#D5DEEF]/80">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("LOGIN");
                  setErrorMessage(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "LOGIN"
                    ? "bg-white text-[#1E304B] shadow-palette-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Masuk Akun</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("REGISTER");
                  setRegError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "REGISTER"
                    ? "bg-white text-[#1E304B] shadow-palette-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Daftar Akun Satker</span>
              </button>
            </div>
          )}

          {/* ===================== TAB LOGIN ===================== */}
          {activeTab === "LOGIN" && !regSuccessData && !otpPendingData && (
            <>
              {/* Error Alert Banner */}
              {errorMessage && (
                <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800 animate-in fade-in duration-200">
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">
                    {errorMessage}
                    {(errorMessage.includes("menunggu persetujuan") ||
                      errorMessage.includes("menunggu verifikasi")) && (
                      <div className="mt-2 text-[11px] text-amber-700 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          Email kedinasan Anda telah terverifikasi. Saat ini Admin / Koordinator PUSAKA sedang memvalidasi kesesuaian Satuan Kerja Anda.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
                {/* Field Email Kedinasan atau Username */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="username"
                    className="block text-xs font-bold text-[#1E304B]"
                  >
                    Email Kedinasan (@komdigi.go.id) atau Username
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="username"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="nama.pegawai@komdigi.go.id atau username"
                      className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/40 py-2.5 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all"
                    />
                  </div>
                </div>

                {/* Field Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold text-[#1E304B]"
                  >
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi akun"
                      className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/40 py-2.5 pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                      tabIndex={-1}
                      aria-label={
                        showPassword
                          ? "Sembunyikan kata sandi"
                          : "Tampilkan kata sandi"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#395886] via-[#4E73A9] to-[#395886] hover:from-[#2F4A72] hover:to-[#2F4A72] py-2.5 px-4 text-xs font-bold text-white shadow-palette-md transition-all focus:outline-hidden focus:ring-2 focus:ring-[#395886] disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memverifikasi Akun...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4" />
                        <span>Masuk ke Ruang Kerja</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Notice to Register */}
              <div className="mt-5 text-center">
                <p className="text-xs text-slate-500">
                  Belum memiliki akun satuan kerja?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("REGISTER");
                      setRegError(null);
                    }}
                    className="font-bold text-[#395886] hover:underline cursor-pointer"
                  >
                    Daftar dengan Email @komdigi.go.id
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ===================== TAB REGISTRASI ===================== */}
          {activeTab === "REGISTER" && !regSuccessData && !otpPendingData && (
            <>
              {/* Error Alert Banner */}
              {regError && (
                <div
                  ref={regErrorRef}
                  id="reg-error-banner"
                  tabIndex={-1}
                  className="mt-5 flex items-start gap-2.5 rounded-2xl border-2 border-rose-300 bg-rose-50/95 p-3.5 text-xs text-rose-900 shadow-sm ring-4 ring-rose-100/70 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 font-semibold leading-relaxed">
                    {regError}
                  </div>
                </div>
              )}

              {/* Informational Guidance 2-Stage Verification */}
              <div className="mt-4 rounded-xl border border-blue-100 bg-[#F0F3FA] p-3 text-[11px] text-[#395886] leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#1E304B]">
                  <ShieldCheck className="h-4 w-4 text-[#395886]" />
                  <span>Keamanan Verifikasi 2 Tahap:</span>
                </div>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                  <li>
                    <strong>Verifikasi OTP Email:</strong> Sistem mengirim 6 digit kode OTP ke email <code>@komdigi.go.id</code> Anda.
                  </li>
                  <li>
                    <strong>Persetujuan Admin:</strong> Admin/Koordinator PUSAKA memvalidasi kesesuaian identitas &amp; Satuan Kerja Anda.
                  </li>
                </ol>
              </div>

              {/* Register Form */}
              <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-3.5">
                {/* Nama Lengkap */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#1E304B]">
                      Nama Lengkap
                    </label>
                    <span className="text-[10px] font-medium text-slate-500">
                      Tanpa gelar akademik
                    </span>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={regNama}
                      onChange={(e) => setRegNama(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/40 py-2 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all"
                    />
                  </div>
                </div>

                {/* Email Kedinasan @komdigi.go.id */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#1E304B]">
                      Email
                    </label>
                    <span className="text-[10px] font-bold text-[#395886] bg-[#F0F3FA] px-2 py-0.5 rounded-md border border-[#B1C9EF]">
                      @komdigi.go.id
                    </span>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="nama.pegawai@komdigi.go.id"
                      className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/40 py-2 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all"
                    />
                  </div>
                </div>

                {/* Baris NIP & Username */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* NIP */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#1E304B]">
                      NIP (18 Digit)
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        maxLength={18}
                        required
                        value={regNip}
                        onChange={(e) => setRegNip(e.target.value.replace(/\D/g, ""))}
                        placeholder="199208152018011002"
                        className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/40 py-2 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#1E304B]">
                      Username Login
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => {
                          setRegUsernameEdited(true);
                          setRegUsername(
                            e.target.value.toLowerCase().replace(/\s+/g, "")
                          );
                        }}
                        placeholder="nama.pegawai"
                        className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/40 py-2 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Satuan Kerja Dropdown */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#1E304B]">
                    Satuan Kerja
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Building className="h-4 w-4" />
                    </div>
                    <select
                      value={regSatker}
                      onChange={(e) => setRegSatker(e.target.value)}
                      className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/40 py-2 pl-10 pr-3.5 text-xs text-slate-900 focus:border-[#628ECB] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all cursor-pointer"
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
                </div>

                {/* Input Satker Kustom jika pilih "Lainnya" */}
                {regSatker === "Lainnya (Satker / Balai / UPT Lainnya)" && (
                  <div className="space-y-1 animate-in fade-in duration-200">
                    <label className="block text-xs font-bold text-[#1E304B]">
                      Tuliskan Nama Satuan Kerja / Unit / Balai
                    </label>
                    <input
                      type="text"
                      required
                      value={regSatkerKustom}
                      onChange={(e) => setRegSatkerKustom(e.target.value)}
                      placeholder="Contoh: Balai Pengembangan SDM dan Penelitian Komunikasi"
                      className="w-full rounded-xl border border-[#D5DEEF] bg-white py-2 px-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all"
                    />
                  </div>
                )}

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#1E304B]">
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/40 py-2 pl-10 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#1E304B]">
                      Konfirmasi Sandi
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Ulangi kata sandi"
                        className="w-full rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/40 py-2 pl-10 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                        tabIndex={-1}
                      >
                        {showRegPassword ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit Register */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#395886] via-[#4E73A9] to-[#395886] hover:from-[#2F4A72] hover:to-[#2F4A72] py-2.5 px-4 text-xs font-bold text-white shadow-palette-md transition-all focus:outline-hidden focus:ring-2 focus:ring-[#395886] disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Mengirim Kode OTP ke Email...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        <span>Daftarkan &amp; Kirim Kode OTP ke Email</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Back to Login link */}
              <div className="mt-4 text-center">
                <p className="text-xs text-slate-500">
                  Sudah memiliki akun terverifikasi?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("LOGIN");
                      setErrorMessage(null);
                    }}
                    className="font-bold text-[#395886] hover:underline cursor-pointer"
                  >
                    Masuk di sini
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ===================== TAHAP 1: VERIFIKASI KODE OTP EMAIL ===================== */}
          {otpPendingData && (
            <div className="mt-6 rounded-2xl border border-[#B1C9EF] bg-[#F0F3FA]/70 p-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#395886] text-white flex-shrink-0 shadow-xs">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="text-xs space-y-1">
                  <span className="inline-block rounded-full bg-blue-100 text-[#395886] px-2.5 py-0.5 text-[10px] font-bold">
                    Tahap 1 dari 2 &bull; Verifikasi Email Kedinasan
                  </span>
                  <h2 className="text-sm font-bold text-[#1E304B]">
                    Masukkan 6 Digit Kode OTP
                  </h2>
                  <p className="text-slate-600 leading-relaxed">
                    Kode OTP telah dikirim ke email kedinasan{" "}
                    <strong className="text-[#1E304B]">{otpPendingData.email}</strong>.
                  </p>
                </div>
              </div>

              {/* Simulasi OTP Box jika SMTP belum disetel di mode development */}
              {otpPendingData.kode_otp_simulasi && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-[11px] uppercase tracking-wider text-amber-700">
                      Simulasi Kotak Masuk Email (Mode Lokal/Dev)
                    </div>
                    <div className="mt-0.5">
                      Kode OTP Anda:{" "}
                      <span className="font-mono text-sm font-extrabold tracking-widest text-[#1E304B] bg-white px-2 py-0.5 rounded border border-amber-300">
                        {otpPendingData.kode_otp_simulasi}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpCode(otpPendingData.kode_otp_simulasi || "")}
                    className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer flex-shrink-0"
                  >
                    Isi Otomatis
                  </button>
                </div>
              )}

              {otpInfoMessage && !otpError && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800 font-medium">
                  {otpInfoMessage}
                </div>
              )}

              {otpError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-semibold">
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{otpError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtpSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#1E304B] text-center">
                    Kode Verifikasi OTP (6 Digit Angka)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full rounded-xl border-2 border-[#8AAEE0] bg-white py-3 px-4 text-center font-mono text-xl font-bold tracking-[0.5em] text-[#1E304B] placeholder:text-slate-300 focus:border-[#395886] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2F4A72] hover:to-[#395886] py-2.5 px-4 text-xs font-bold text-white shadow-palette-md disabled:opacity-60 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memverifikasi Kode OTP...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Verifikasi OTP &amp; Lanjutkan ke Persetujuan Admin</span>
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between pt-2 border-t border-[#D5DEEF] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOtpPendingData(null);
                    setOtpError(null);
                  }}
                  className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  &larr; Ubah Data Pendaftaran
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleResendOtp}
                  className="inline-flex items-center gap-1 font-bold text-[#395886] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Kirim Ulang Kode OTP</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================== TAHAP 2: REGISTRATION SUCCESS CARD (MENUNGGU ADMIN) ===================== */}
          {regSuccessData && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-center animate-in zoom-in-95 duration-200">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-palette-md">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-900">
                Email Kedinasan Terverifikasi!
              </h2>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                Kepemilikan email <strong>{regSuccessData.email}</strong> telah berhasil diverifikasi.
              </p>

              {/* Data Detail Card */}
              <div className="mt-4 text-left rounded-xl bg-white p-3.5 border border-emerald-200/80 space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Nama Pegawai:</span>
                  <span className="font-bold text-[#1E304B]">{regSuccessData.nama}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Email Kedinasan:</span>
                  <span className="font-mono font-bold text-emerald-700">{regSuccessData.email}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">NIP:</span>
                  <span className="font-mono font-bold text-[#1E304B]">{regSuccessData.nip}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Satuan Kerja:</span>
                  <span className="font-semibold text-[#1E304B] text-right">{regSuccessData.satuan_kerja}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Tahap 1 (OTP Email):</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>TERVERIFIKASI</span>
                  </span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span className="text-slate-500">Tahap 2 (Validasi Admin):</span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px]">
                    <Clock className="h-3 w-3" />
                    <span>MENUNGGU PERSETUJUAN ADMIN</span>
                  </span>
                </div>
              </div>

              {/* Information Note */}
              <div className="mt-4 rounded-xl bg-amber-50/90 border border-amber-200/70 p-3 text-[11px] text-amber-800 text-left flex items-start gap-2">
                <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Validasi Human-in-the-Loop:</strong> Akun Anda kini berada di antrean persetujuan <strong>Admin / Koordinator PUSAKA Komdigi</strong> untuk memastikan kesesuaian penugasan Satuan Kerja Anda. Anda dapat login menggunakan <strong>{regSuccessData.email}</strong> setelah disetujui.
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => {
                  setRegSuccessData(null);
                  setActiveTab("LOGIN");
                  setErrorMessage(null);
                }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#395886] hover:bg-[#2F4A72] py-2.5 px-4 text-xs font-bold text-white shadow-palette-md transition-all cursor-pointer"
              >
                <span>Kembali ke Halaman Masuk</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Security & Official Notice Footnote */}
          <div className="mt-8 border-t border-[#D5DEEF]/70 pt-4 text-center">
            <p className="text-[11px] text-slate-400">
              Autentikasi aman terenkripsi &bull; Terhubung ke Basis Data Instansi Komdigi
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
