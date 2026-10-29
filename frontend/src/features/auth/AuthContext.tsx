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

const DEFAULT_JABATAN: Record<Peran, string> = {
  ANALIS: "Analis Kebijakan Satuan Kerja",
  KOORDINATOR: "Koordinator Tim Penilai Mandiri IKK",
  ADMIN: "Administrator Sistem",
};

const EMPTY_USER_PROFIL: PenggunaProfil = {
  id: "",
  nama: "Memuat Profil...",
  username: "",
  email: "",
  nip: "-",
  jabatan: "Fungsional Instansi",
  peran: "ANALIS",
  instansi: "Kementerian Komunikasi dan Digital",
  satuan_kerja: "",
  status_verifikasi: "AKTIF",
};

function loadSavedUserProfile(): PenggunaProfil {
  try {
    const raw = localStorage.getItem("ikk_user_profile");
    if (raw) {
      const parsed = JSON.parse(raw) as PenggunaProfil;
      if (parsed && parsed.id && parsed.nama) {
        return parsed;
      }
    }
  } catch {
    // Abaikan jika JSON di localStorage tidak valid
  }
  return EMPTY_USER_PROFIL;
}

interface AuthContextType {
  peran: Peran;
  user: PenggunaProfil;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  loginDenganUsername: (username: string, kataSandi: string) => Promise<void>;
  keluar: () => Promise<void>;
  refreshProfil: () => Promise<void>;
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
  const [currentUser, setCurrentUser] = useState<PenggunaProfil>(() =>
    loadSavedUserProfile()
  );

  const [peran, setPeranState] = useState<Peran>(() => {
    const savedProfile = loadSavedUserProfile();
    if (savedProfile.id && savedProfile.peran) {
      return savedProfile.peran;
    }
    const savedRole = localStorage.getItem("ikk_active_role");
    return (savedRole as Peran) || "ANALIS";
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem("ikk_token");
  });

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const simpanProfilKeState = (p: any, fallbackUsername = "") => {
    const role = (p.peran as Peran) || "ANALIS";
    const uname = p.username || fallbackUsername;
    const profilBaru: PenggunaProfil = {
      id: p.id,
      nama: p.nama,
      username: uname,
      email: p.email || (uname ? `${uname}@komdigi.go.id` : ""),
      nip: p.nip || "-",
      jabatan: DEFAULT_JABATAN[role] || "Fungsional Instansi",
      peran: role,
      instansi: p.instansi || "Kementerian Komunikasi dan Digital",
      satuan_kerja: p.satuan_kerja || "Pusat Kebijakan Strategis (PUSAKA)",
      status_verifikasi: p.status_verifikasi || "AKTIF",
    };
    setPeranState(role);
    setCurrentUser(profilBaru);
    localStorage.setItem("ikk_active_role", role);
    localStorage.setItem("ikk_user_profile", JSON.stringify(profilBaru));
  };

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
      simpanProfilKeState(resp.data.pengguna, username);
    }
  };

  const refreshProfil = async () => {
    const existingToken = localStorage.getItem("ikk_token");
    if (!existingToken) return;
    axios.defaults.headers.common["Authorization"] = `Bearer ${existingToken}`;
    const resp = await axios.get("/api/v1/auth/saya");
    if (resp.data) {
      simpanProfilKeState(resp.data);
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
      localStorage.removeItem("ikk_user_profile");
      delete axios.defaults.headers.common["Authorization"];
      setIsAuthenticated(false);
      setCurrentUser(EMPTY_USER_PROFIL);
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
          setIsAuthenticated(true);
          simpanProfilKeState(resp.data);
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem("ikk_token");
          localStorage.removeItem("ikk_active_role");
          localStorage.removeItem("ikk_user_profile");
          delete axios.defaults.headers.common["Authorization"];
          setIsAuthenticated(false);
          setCurrentUser(EMPTY_USER_PROFIL);
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
        refreshProfil,
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
