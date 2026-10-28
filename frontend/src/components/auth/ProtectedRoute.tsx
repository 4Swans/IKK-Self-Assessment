import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth, Peran } from "../../features/auth/AuthContext";
import { ShieldAlert, LogIn, ArrowLeft, Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Peran[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, peran, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#395886]" />
        <span className="text-xs font-medium text-slate-500">Memeriksa hak akses sistem...</span>
      </div>
    );
  }

  // 1. Jika belum login: HANYA DAPAT MEMBUKA BERANDA
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg py-16 px-4 text-center animate-in fade-in duration-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-sm mb-5">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/70 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-200 mb-3">
          Akses Terbatas &bull; Wajib Masuk
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1E304B]">
          Otentikasi Pengguna Diperlukan
        </h2>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          Pengguna yang belum masuk hanya dapat mengakses halaman <strong>Beranda</strong>. Modul penyiapan asesmen, kelola kebijakan, dan ekspor instrumen IKK mewajibkan akun terverifikasi.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/login"
            state={{ from: location }}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2F4A72] hover:to-[#395886] px-5 py-2.5 text-sm font-bold text-white shadow-palette-sm transition-all cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            <span>Masuk ke Akun Anda</span>
          </Link>
          <Link
            to="/"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#D5DEEF] bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[#F0F3FA] transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </div>
    );
  }

  // 2. Jika sudah login tetapi peran tidak diizinkan (misal Analis/Koordinator mencoba buka Manajemen Akun)
  if (allowedRoles && !allowedRoles.includes(peran)) {
    return (
      <div className="mx-auto max-w-lg py-16 px-4 text-center animate-in fade-in duration-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 shadow-sm mb-5">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-100/70 px-3 py-1 text-xs font-bold text-rose-900 border border-rose-200 mb-3">
          403 Akses Ditolak
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1E304B]">
          Wewenang Tidak Memadai
        </h2>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          Akun Anda memiliki peran <strong>{peran}</strong>. Modul ini dibatasi dan hanya dapat dibuka oleh peran:{" "}
          <span className="font-semibold text-slate-800">{allowedRoles.join(", ")}</span>.
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-[#395886] hover:bg-[#2F4A72] px-5 py-2.5 text-sm font-bold text-white shadow-palette-sm transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
