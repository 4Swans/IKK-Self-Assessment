import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import axios from "axios";

export type Peran = "ANALIS" | "KOORDINATOR" | "ADMIN";

export interface PenggunaProfil {
  id: string;
  nama: string;
  username: string;
  email: string;
  nip: string;
  jabatan: string;
  peran: Peran;
  instansi: string;
  satuan_kerja?: string;
  status_verifikasi?: string;
}

const DAFTAR_PENGGUNA: Record<Peran, PenggunaProfil> = {
  ANALIS: {
    id: "428abee6-116d-43a2-8bd3-1a95d3ad56f1",
    nama: "Ahmad Fauzi",
    username: "analis",
    email: "analis@komdigi.go.id",
    nip: "199208152018011002",
    jabatan: "Analis Kebijakan Ahli Pertama",
    peran: "ANALIS",
    instansi: "Kementerian Komunikasi dan Digital",
    satuan_kerja: "Direktorat Aplikasi Pemerintah Digital",
    status_verifikasi: "AKTIF",
  },
  KOORDINATOR: {
    id: "5dd4e555-29c8-4493-8ad2-f9e816826f60",
    nama: "Siti Rahmawati",
    username: "koordinator",
    email: "koordinator@komdigi.go.id",
    nip: "197609251999032001",
    jabatan: "Koordinator Tim Penilai Mandiri IKK",
    peran: "KOORDINATOR",
    instansi: "Kementerian Komunikasi dan Digital",
    satuan_kerja: "Pusat Kebijakan Strategis (PUSAKA)",
    status_verifikasi: "AKTIF",
  },
  ADMIN: {
    id: "e94ceeae-7446-4b41-a3de-d6511ab851ff",
    nama: "Administrator Sistem",
    username: "admin",
    email: "admin@komdigi.go.id",
    nip: "198501012010121002",
    jabatan: "Pengelola Sistem Informasi Penilaian",
    peran: "ADMIN",
    instansi: "Kementerian Komunikasi dan Digital",
    satuan_kerja: "Pusat Kebijakan Strategis (PUSAKA)",
    status_verifikasi: "AKTIF",
  },
};

interface AuthContextType {
  peran: Peran;
  user: PenggunaProfil;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  loginDenganUsername: (username: string, kataSandi: string) => Promise<void>;
  keluar: () => Promise<void>;
  isAnalis: boolean;
  isKoordinator: boolean;
  isAdmin: boolean;
  canEditJawaban: (statusAsesmen: string) => boolean;
  canAjukan: (statusAsesmen: string) => boolean;
  canReview: (statusAsesmen: string) => boolean;
  canManageKebijakan: () => boolean;
  canAddKebijakan: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [peran, setPeranState] = useState<Peran>(() => {
    const saved = localStorage.getItem("ikk_active_role");
    return (saved as Peran) || "ANALIS";
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem("ikk_token");
  });

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const [currentUser, setCurrentUser] = useState<PenggunaProfil>(() => {
    return DAFTAR_PENGGUNA[peran] || DAFTAR_PENGGUNA.ANALIS;
  });

  const loginDenganUsername = async (username: string, kataSandi: string) => {
    const resp = await axios.post("/api/v1/auth/masuk", {
      username,
      password: kataSandi,
    });
    if (resp.data?.access_token) {
      const token = resp.data.access_token;
      localStorage.setItem("ikk_token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setIsAuthenticated(true);
      const p = resp.data.pengguna;
      const role = (p.peran as Peran) || "ANALIS";
      setPeranState(role);
      localStorage.setItem("ikk_active_role", role);
      setCurrentUser({
        id: p.id,
        nama: p.nama,
        username: p.username || username,
        email: p.email || `${username}@komdigi.go.id`,
        nip: p.nip || DAFTAR_PENGGUNA[role]?.nip || "198801012015011001",
        jabatan: DAFTAR_PENGGUNA[role]?.jabatan || "Fungsional Instansi",
        peran: role,
        instansi: p.instansi || "Kementerian Komunikasi dan Digital",
        satuan_kerja: p.satuan_kerja || "Pusat Kebijakan Strategis (PUSAKA)",
        status_verifikasi: p.status_verifikasi || "AKTIF",
      });
    }
  };

  const keluar = async () => {
    try {
      await axios.post("/api/v1/auth/keluar");
    } catch {
      // Abaikan jika offline
    } finally {
      localStorage.removeItem("ikk_token");
      localStorage.removeItem("ikk_active_role");
      delete axios.defaults.headers.common["Authorization"];
      setIsAuthenticated(false);
    }
  };

  // Inisialisasi token saat pertama kali dimuat (tanpa auto-login jika belum ada token)
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      axios.defaults.withCredentials = true;
      const existingToken = localStorage.getItem("ikk_token");
      if (!existingToken) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsAuthLoading(false);
        }
        return;
      }

      axios.defaults.headers.common["Authorization"] = `Bearer ${existingToken}`;
      try {
        const resp = await axios.get("/api/v1/auth/saya");
        if (isMounted && resp.data) {
          const p = resp.data;
          const role = (p.peran as Peran) || "ANALIS";
          setIsAuthenticated(true);
          setPeranState(role);
          setCurrentUser({
            id: p.id,
            nama: p.nama,
            username: p.username,
            email: p.email,
            nip: p.nip || DAFTAR_PENGGUNA[role]?.nip || "198801012015011001",
            jabatan: DAFTAR_PENGGUNA[role]?.jabatan || "Fungsional Instansi",
            peran: role,
            instansi: p.instansi || "Kementerian Komunikasi dan Digital",
            satuan_kerja: p.satuan_kerja || "Pusat Kebijakan Strategis (PUSAKA)",
            status_verifikasi: p.status_verifikasi || "AKTIF",
          });
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem("ikk_token");
          delete axios.defaults.headers.common["Authorization"];
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const isAnalis = isAuthenticated && (peran === "ANALIS" || peran === "ADMIN");
  const isKoordinator = isAuthenticated && (peran === "KOORDINATOR" || peran === "ADMIN");
  const isAdmin = isAuthenticated && peran === "ADMIN";

  const canEditJawaban = (statusAsesmen: string) => {
    if (!isAuthenticated) return false;
    if (isAdmin) return true;
    if (peran === "ANALIS") {
      return statusAsesmen === "DRAF" || statusAsesmen === "PERLU_PERBAIKAN";
    }
    return false;
  };

  const canAjukan = (statusAsesmen: string) => {
    if (!isAuthenticated) return false;
    if (isAdmin) return true;
    if (peran === "ANALIS") {
      return statusAsesmen === "DRAF" || statusAsesmen === "PERLU_PERBAIKAN";
    }
    return false;
  };

  const canReview = (statusAsesmen: string) => {
    if (!isAuthenticated) return false;
    if (isAdmin) return true;
    if (peran === "KOORDINATOR") {
      return statusAsesmen === "DIAJUKAN" || statusAsesmen === "DISETUJUI";
    }
    return false;
  };

  const canManageKebijakan = () => {
    if (!isAuthenticated) return false;
    return isKoordinator;
  };

  const canAddKebijakan = () => {
    return isAuthenticated && peran === "ANALIS";
  };

  return (
    <AuthContext.Provider
      value={{
        peran,
        user: currentUser,
        isAuthenticated,
        isAuthLoading,
        loginDenganUsername,
        keluar,
        isAnalis,
        isKoordinator,
        isAdmin,
        canEditJawaban,
        canAjukan,
        canReview,
        canManageKebijakan,
        canAddKebijakan,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }
  return context;
}
