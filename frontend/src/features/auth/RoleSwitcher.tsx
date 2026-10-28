import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCheck,
  Shield,
  ChevronDown,
  Briefcase,
  LogOut,
  LogIn,
  Lock,
  Building,
  BadgeCheck,
} from "lucide-react";
import { useAuth, Peran } from "./AuthContext";

export function RoleSwitcher() {
  const navigate = useNavigate();
  const { peran, user, keluar, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const rolesConfig: Record<
    Peran,
    { label: string; badgeClass: string; icon: typeof UserCheck; deskripsi: string }
  > = {
    ANALIS: {
      label: "Analis Instansi",
      badgeClass: "bg-[#F0F3FA] text-[#395886] border-[#B1C9EF]",
      icon: Briefcase,
      deskripsi:
        "Wewenang: Mengisi instrumen asesmen A1–D2, mengunggah berkas bukti dukung, dan mengajukan penilaian mandiri ke Koordinator.",
    },
    KOORDINATOR: {
      label: "Koordinator Instansi",
      badgeClass: "bg-[#D5DEEF] text-[#243957] border-[#8AAEE0]",
      icon: UserCheck,
      deskripsi:
        "Wewenang: Mendaftarkan periode & profil JFAK, menentukan 3 kebijakan strategis, menelaah bukti dukung, menyetujui, atau mengembalikan asesmen dengan catatan perbaikan.",
    },
    ADMIN: {
      label: "Administrator Sistem",
      badgeClass: "bg-[#395886] text-white border-[#243957]",
      icon: Shield,
      deskripsi:
        "Wewenang: Hak akses penuh ke pengelolaan akun pengguna, instrumen IKK, dan audit riwayat sistem.",
    },
  };

  const currentConfig = rolesConfig[peran] || rolesConfig.ANALIS;
  const CurrentIcon = currentConfig.icon;

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => navigate("/login")}
        className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2F4A72] hover:to-[#395886] px-3.5 text-xs font-bold text-white shadow-palette-sm transition-all focus:outline-hidden cursor-pointer"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Masuk</span>
      </button>
    );
  }

  const initials = user.nama
    ? user.nama
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "US";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button: User Profile Card */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 items-center gap-2 rounded-xl border border-[#D5DEEF] bg-white px-2.5 text-xs text-slate-800 shadow-palette-sm hover:bg-[#F0F3FA] hover:border-[#B1C9EF] transition-all focus:outline-hidden focus:ring-2 focus:ring-[#628ECB] cursor-pointer"
        title="Klik untuk melihat informasi profil akun aktif"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#395886] to-[#4E73A9] text-white font-bold text-[10px] flex-shrink-0 shadow-2xs">
          {initials}
        </div>

        <div className="flex items-center gap-2 text-left">
          <span className="font-bold text-[#1E304B] text-xs max-w-[130px] sm:max-w-[150px] truncate">
            {user.nama}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${currentConfig.badgeClass}`}
          >
            <CurrentIcon className="h-2.5 w-2.5" />
            {currentConfig.label}
          </span>
        </div>

        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Account Info Modal / Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-84 rounded-2xl border border-[#D5DEEF] bg-white p-3 shadow-palette-md z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header Profil */}
          <div className="flex items-start justify-between border-b border-[#D5DEEF]/60 pb-2.5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#395886]">
                Akun Terotentikasi
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Sesi resmi login ke database PostgreSQL
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
              <BadgeCheck className="h-3 w-3 text-emerald-600" />
              Aktif
            </span>
          </div>

          {/* User Identity Details */}
          <div className="mt-3 rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/70 p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#395886] to-[#4E73A9] text-white font-bold text-xs shadow-xs flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#1E304B] truncate" title={user.nama}>
                  {user.nama}
                </div>
                <div className="text-[11px] font-mono text-slate-500">@{user.username}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#D5DEEF]/60 space-y-1 text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <Building className="h-3 w-3 text-slate-400" />
                  Instansi:
                </span>
                <span className="font-semibold text-slate-800 truncate max-w-[160px]" title={user.instansi}>
                  {user.instansi}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <Briefcase className="h-3 w-3 text-slate-400" />
                  Satker:
                </span>
                <span className="font-semibold text-[#395886] truncate max-w-[160px]" title={user.satuan_kerja || "Pusat Kebijakan Strategis (PUSAKA)"}>
                  {user.satuan_kerja || "Pusat Kebijakan Strategis (PUSAKA)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Peran:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border ${currentConfig.badgeClass}`}
                >
                  <CurrentIcon className="h-2.5 w-2.5" />
                  {currentConfig.label}
                </span>
              </div>
            </div>
          </div>

          {/* Role Authority Description */}
          <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-[11px] text-slate-700 leading-snug">
            <div className="font-semibold text-slate-800 flex items-center gap-1 mb-1">
              <CurrentIcon className="h-3 w-3 text-[#395886]" />
              <span>Lingkup Wewenang Peran:</span>
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              {currentConfig.deskripsi}
            </p>
          </div>

          {/* Security & Access Protection Notice */}
          <div className="mt-2 rounded-xl border border-amber-200/90 bg-amber-50/70 p-2.5 flex items-start gap-2 text-[10px] text-amber-900 leading-relaxed">
            <Lock className="h-3.5 w-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Keamanan Akun:</span> Peran dan hak akses terikat pada akun aktif ini. Untuk beralih ke akun atau peran lain, silakan keluar dari sistem terlebih dahulu.
            </div>
          </div>

          {/* Logout Action */}
          <div className="mt-3 border-t border-[#D5DEEF]/60 pt-2.5">
            <button
              type="button"
              onClick={async () => {
                setIsOpen(false);
                await keluar();
                navigate("/login");
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 hover:border-rose-300 transition-all cursor-pointer shadow-2xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar dari Akun Ini</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
