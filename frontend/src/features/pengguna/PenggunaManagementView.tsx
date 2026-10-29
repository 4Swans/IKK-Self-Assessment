import React, { useState } from "react";
import {
  Users,
  Shield,
  ShieldAlert,
  UserCheck,
  Briefcase,
  Pencil,
  Plus,
  Key,
  X,
  CheckCircle2,
  AlertCircle,
  Building,
  Loader2,
  Trash2,
  Clock,
  Check,
  UserX,
  CreditCard,
  Mail,
} from "lucide-react";
import { useAuth, Peran } from "../auth/AuthContext";
import {
  DAFTAR_SATKER_KOMDIGI,
  DAFTAR_SATKER_GROUPED,
} from "../auth/satkerList";
import {
  useDaftarPenggunaApiV1PenggunaGet,
  useUbahPenggunaApiV1PenggunaPenggunaIdPut,
  useBuatPenggunaApiV1PenggunaPost,
  useHapusPenggunaApiV1PenggunaPenggunaIdDelete,
  useDaftarPenggunaMenungguVerifikasiApiV1PenggunaMenungguVerifikasiGet,
  useVerifikasiPenggunaApiV1PenggunaPenggunaIdVerifikasiPost,
} from "../../api/endpoints/manajemen-pengguna/manajemen-pengguna";
import type { PenggunaBaca } from "../../api/model";
import { useQueryClient } from "@tanstack/react-query";
import { ToastNotification } from "../../components/ui/ToastNotification";

export function PenggunaManagementView() {
  const queryClient = useQueryClient();
  const { user: currentUser, isAdmin, isKoordinator, refreshProfil } = useAuth();
  const canAccess = isAdmin || isKoordinator;

  // Active Tab: "VERIFIKASI" atau "SEMUA"
  const [activeTab, setActiveTab] = useState<"VERIFIKASI" | "SEMUA">("VERIFIKASI");

  // Query Seluruh Pengguna
  const {
    data: penggunaResp,
    isLoading: isLoadingSemua,
    refetch: refetchSemua,
  } = useDaftarPenggunaApiV1PenggunaGet({
    query: { enabled: canAccess },
  });
  const penggunaList = penggunaResp?.data || [];

  // Query Pengguna Menunggu Verifikasi
  const {
    data: menungguResp,
    isLoading: isLoadingMenunggu,
    refetch: refetchMenunggu,
  } = useDaftarPenggunaMenungguVerifikasiApiV1PenggunaMenungguVerifikasiGet({
    query: { enabled: canAccess },
  });
  const menungguList = menungguResp?.data || [];

  // Mutations
  const ubahMutation = useUbahPenggunaApiV1PenggunaPenggunaIdPut();
  const buatMutation = useBuatPenggunaApiV1PenggunaPost();
  const hapusMutation = useHapusPenggunaApiV1PenggunaPenggunaIdDelete();
  const verifikasiMutation = useVerifikasiPenggunaApiV1PenggunaPenggunaIdVerifikasiPost();

  // State Modal Edit
  const [editingUser, setEditingUser] = useState<PenggunaBaca | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNip, setEditNip] = useState("");
  const [editSatker, setEditSatker] = useState("");
  const [editPeran, setEditPeran] = useState<Peran>("ANALIS");
  const [editInstansi, setEditInstansi] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // State Modal Tambah
  const [showAddModal, setShowAddModal] = useState(false);
  const [addNama, setAddNama] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addNip, setAddNip] = useState("");
  const [addSatker, setAddSatker] = useState(DAFTAR_SATKER_KOMDIGI[0]);
  const [addPassword, setAddPassword] = useState("");
  const [addPeran, setAddPeran] = useState<Peran>("ANALIS");
  const [addInstansi, setAddInstansi] = useState("Kementerian Komunikasi dan Digital");

  // State Modal Tolak Verifikasi
  const [rejectingUser, setRejectingUser] = useState<PenggunaBaca | null>(null);
  const [rejectCatatan, setRejectCatatan] = useState("");

  // State Modal Konfirmasi Hapus Pengguna
  const [deletingUser, setDeletingUser] = useState<PenggunaBaca | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{
    show: boolean;
    type: "success" | "error" | "warning";
    title: string;
    message: string;
    id?: number;
  }>({
    show: false,
    type: "success",
    title: "",
    message: "",
  });

  const showToast = (toastData: {
    type: "success" | "error" | "warning";
    title: string;
    message: string;
  }) => {
    setToast((prev) => ({
      ...toastData,
      show: true,
      id: (prev.id ?? 0) + 1,
    }));
  };

  // Jika bukan Admin atau Koordinator, tolak akses
  if (!canAccess) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 max-w-md shadow-palette-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Akses Dibatasi
          </h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Halaman Manajemen &amp; Verifikasi Pengguna hanya dapat diakses oleh peran <strong>Koordinator PUSAKA</strong> dan <strong>Administrator Sistem</strong>.
          </p>
        </div>
      </div>
    );
  }

  // Handler Verifikasi: Setujui (Aktifkan)
  const handleApprove = async (target: PenggunaBaca) => {
    try {
      await verifikasiMutation.mutateAsync({
        penggunaId: target.id,
        data: {
          status: "AKTIF",
        },
      });

      await Promise.all([refetchMenunggu(), refetchSemua()]);
      queryClient.invalidateQueries();

      showToast({
        type: "success",
        title: "Akun Pengguna Disetujui",
        message: `Akun atas nama "${target.nama}" (${target.satuan_kerja || "Satker"}) telah diaktifkan dan sekarang dapat login.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Gagal Memverifikasi",
        message: err?.response?.data?.detail || "Terjadi kesalahan saat memverifikasi pengguna.",
      });
    }
  };

  // Handler Verifikasi: Konfirmasi Tolak
  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingUser) return;
    setModalLoading(true);

    try {
      await verifikasiMutation.mutateAsync({
        penggunaId: rejectingUser.id,
        data: {
          status: "DITOLAK",
          catatan: rejectCatatan.trim() || undefined,
        },
      });

      await Promise.all([refetchMenunggu(), refetchSemua()]);
      queryClient.invalidateQueries();
      setRejectingUser(null);
      setRejectCatatan("");

      showToast({
        type: "warning",
        title: "Pendaftaran Akun Ditolak",
        message: `Pengajuan akun untuk "${rejectingUser.nama}" telah ditolak.`,
      });
    } catch (err: any) {
      setModalError(err?.response?.data?.detail || "Gagal menolak akun pengguna.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenEdit = (target: PenggunaBaca) => {
    setEditingUser(target);
    setEditNama(target.nama);
    setEditUsername(target.username);
    setEditEmail(target.email || "");
    setEditNip(target.nip || "");
    setEditSatker(target.satuan_kerja || "");
    setEditPeran(target.peran as Peran);
    setEditInstansi(target.instansi);
    setEditPassword("");
    setModalError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setModalLoading(true);
    setModalError(null);

    try {
      await ubahMutation.mutateAsync({
        penggunaId: editingUser.id,
        data: {
          nama: editNama.trim(),
          username: editUsername.trim(),
          email: editEmail.trim() || undefined,
          nip: editNip.trim() || undefined,
          satuan_kerja: editSatker.trim() || undefined,
          peran: editPeran,
          instansi: editInstansi.trim(),
          password: editPassword.trim() || undefined,
        },
      });

      await Promise.all([
        refetchSemua(),
        refetchMenunggu(),
        editingUser.id === currentUser.id ? refreshProfil() : Promise.resolve(),
      ]);
      queryClient.invalidateQueries();
      setEditingUser(null);
      showToast({
        type: "success",
        title: "Perubahan Berhasil Disimpan",
        message: `Data pengguna "${editNama}" telah berhasil diperbarui di basis data PostgreSQL.`,
      });
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || "Gagal memperbarui data pengguna.";
      setModalError(detail);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      await buatMutation.mutateAsync({
        data: {
          nama: addNama.trim(),
          username: addUsername.trim(),
          email: addEmail.trim() || undefined,
          nip: addNip.trim() || undefined,
          satuan_kerja: addSatker.trim() || undefined,
          password: addPassword.trim(),
          peran: addPeran,
          instansi: addInstansi.trim(),
        },
      });

      await Promise.all([refetchSemua(), refetchMenunggu()]);
      queryClient.invalidateQueries();
      setShowAddModal(false);
      setAddNama("");
      setAddUsername("");
      setAddEmail("");
      setAddNip("");
      setAddPassword("");
      showToast({
        type: "success",
        title: "Pengguna Baru Berhasil Ditambahkan",
        message: `Akun "${addNama}" (${addUsername}) telah berhasil dibuat dan aktif.`,
      });
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || "Gagal membuat akun pengguna baru.";
      setModalError(detail);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteUser = (target: PenggunaBaca) => {
    if (target.id === currentUser?.id) {
      showToast({
        type: "warning",
        title: "Aksi Ditolak",
        message: "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.",
      });
      return;
    }

    setDeletingUser(target);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;

    setDeleteLoading(true);
    try {
      await hapusMutation.mutateAsync({ penggunaId: deletingUser.id });
      await Promise.all([refetchSemua(), refetchMenunggu()]);
      queryClient.invalidateQueries();
      showToast({
        type: "success",
        title: "Pengguna Dihapus",
        message: `Akun "${deletingUser.nama}" telah berhasil dihapus dari sistem.`,
      });
      setDeletingUser(null);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Gagal Menghapus",
        message: err?.response?.data?.detail || "Terjadi kesalahan saat menghapus pengguna.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const getPeranBadge = (peran: string) => {
    switch (peran) {
      case "ADMIN":
        return {
          label: "Administrator",
          icon: Shield,
          className: "bg-[#395886] text-white border-[#243957]",
        };
      case "KOORDINATOR":
        return {
          label: "Koordinator Pusaka",
          icon: UserCheck,
          className: "bg-[#D5DEEF] text-[#243957] border-[#8AAEE0]",
        };
      default:
        return {
          label: "Analis Satker",
          icon: Briefcase,
          className: "bg-[#F0F3FA] text-[#395886] border-[#B1C9EF]",
        };
    }
  };

  const getStatusVerifikasiBadge = (status?: string | null) => {
    switch (status) {
      case "MENUNGGU_OTP_EMAIL":
        return {
          label: "Belum Verifikasi OTP",
          icon: Mail,
          className: "bg-slate-100 text-slate-700 border-slate-300",
        };
      case "MENUNGGU_VERIFIKASI":
        return {
          label: "Menunggu Persetujuan Admin",
          icon: Clock,
          className: "bg-amber-50 text-amber-800 border-amber-200",
        };
      case "DITOLAK":
        return {
          label: "Ditolak",
          icon: UserX,
          className: "bg-rose-50 text-rose-800 border-rose-200",
        };
      default:
        return {
          label: "Aktif",
          icon: CheckCircle2,
          className: "bg-emerald-50 text-emerald-800 border-emerald-200",
        };
    }
  };

  return (
    <div className="space-y-6">
      <ToastNotification
        key={toast.id}
        show={toast.show}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F3FA] px-3 py-1 text-[11px] font-bold text-[#395886] border border-[#B1C9EF] mb-2">
            <Shield className="h-3.5 w-3.5 text-[#395886]" />
            <span>Hak Akses Verifikasi &bull; Koordinator Pusaka &amp; Admin</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#1E304B] sm:text-2xl">
            Verifikasi &amp; Manajemen Pengguna
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Pusaka memverifikasi kebenaran pegawai Satuan Kerja Komdigi dan mengelola penugasan akun penilaian mandiri IKK.
          </p>
        </div>

        {isAdmin && (
          <div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2F4A72] hover:to-[#395886] px-4 py-2 text-xs font-bold text-white shadow-palette-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Pengguna Manual</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigasi */}
      <div className="flex border-b border-[#D5DEEF] space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("VERIFIKASI")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "VERIFIKASI"
              ? "border-[#395886] text-[#1E304B]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Pengajuan Menunggu Verifikasi</span>
          {menungguList.length > 0 && (
            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold">
              {menungguList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SEMUA")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "SEMUA"
              ? "border-[#395886] text-[#1E304B]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Seluruh Pengguna Terdaftar ({penggunaList.length})</span>
        </button>
      </div>

      {/* ===================== TAB 1: MENUNGGU VERIFIKASI ===================== */}
      {activeTab === "VERIFIKASI" && (
        <div className="overflow-hidden rounded-2xl border border-[#D5DEEF] bg-white shadow-palette-sm">
          <div className="px-5 py-4 border-b border-[#D5DEEF]/70 flex items-center justify-between bg-amber-50/50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Daftar Registrasi Satker Baru yang Membutuhkan Validasi Pusaka ({menungguList.length})
              </h2>
            </div>
            <span className="text-[11px] text-amber-700 font-medium">
              Wajib validasi kesesuaian NIP &amp; Satuan Kerja
            </span>
          </div>

          {isLoadingMenunggu ? (
            <div className="flex items-center justify-center p-12 text-slate-500 gap-2 text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-[#395886]" />
              <span>Memuat data pengajuan...</span>
            </div>
          ) : menungguList.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-800">
                Semua Registrasi Telah Ditinjau
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Tidak ada akun pengguna Satker yang sedang menunggu verifikasi saat ini. Seluruh pengajuan telah disetujui atau diproses.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#D5DEEF] text-left text-xs">
                <thead className="bg-[#F0F3FA] text-[#395886] font-bold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Nama &amp; NIP</th>
                    <th scope="col" className="px-5 py-3.5">Satuan Kerja (Satker)</th>
                    <th scope="col" className="px-5 py-3.5">Username</th>
                    <th scope="col" className="px-5 py-3.5">Waktu Registrasi</th>
                    <th scope="col" className="px-5 py-3.5 text-center">Tindakan Pusaka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5DEEF]/60">
                  {menungguList.map((p) => (
                    <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[#1E304B]">{p.nama}</div>
                        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                          <CreditCard className="h-3 w-3 text-slate-400" />
                          <span>NIP: {p.nip || "-"}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#395886] border border-blue-200">
                          <Building className="h-3 w-3" />
                          <span>{p.satuan_kerja || "Satker Belum Tercatat"}</span>
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-bold text-[#1E304B] bg-[#F0F3FA] px-2.5 py-1 rounded-lg border border-[#D5DEEF]">
                          @{p.username}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(p)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-palette-xs transition-colors cursor-pointer"
                            title="Setujui dan aktifkan akun satker ini"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Setujui</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectingUser(p);
                              setRejectCatatan("");
                              setModalError(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 transition-colors cursor-pointer"
                            title="Tolak pendaftaran akun satker ini"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>Tolak</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: SELURUH PENGGUNA ===================== */}
      {activeTab === "SEMUA" && (
        <div className="overflow-hidden rounded-2xl border border-[#D5DEEF] bg-white shadow-palette-sm">
          <div className="px-5 py-4 border-b border-[#D5DEEF]/70 flex items-center justify-between bg-[#F0F3FA]/40">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#395886]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#395886]">
                Daftar Seluruh Akun Sistem ({penggunaList.length} Pengguna)
              </h2>
            </div>
          </div>

          {isLoadingSemua ? (
            <div className="flex items-center justify-center p-12 text-slate-500 gap-2 text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-[#395886]" />
              <span>Memuat data pengguna...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#D5DEEF] text-left text-xs">
                <thead className="bg-[#F0F3FA] text-[#395886] font-bold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Nama &amp; Satuan Kerja</th>
                    <th scope="col" className="px-5 py-3.5">NIP &amp; Username</th>
                    <th scope="col" className="px-5 py-3.5 text-center">Peran</th>
                    <th scope="col" className="px-5 py-3.5 text-center">Status Verifikasi</th>
                    <th scope="col" className="px-5 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5DEEF]/60">
                  {penggunaList.map((p) => {
                    const roleBadge = getPeranBadge(p.peran);
                    const RoleIcon = roleBadge.icon;
                    const verifBadge = getStatusVerifikasiBadge(p.status_verifikasi);
                    const VerifIcon = verifBadge.icon;
                    const isSelf = p.id === currentUser.id;
                    const isOtherAdmin = p.peran === "ADMIN" && !isSelf;

                    return (
                      <tr key={p.id} className="hover:bg-[#F0F3FA]/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#395886] to-[#4E73A9] text-white font-bold text-xs flex-shrink-0 shadow-xs">
                              {p.nama.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-[#1E304B] flex items-center gap-2">
                                <span>{p.nama}</span>
                                {isSelf && (
                                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.2 text-[9px] font-bold border border-emerald-300">
                                    Akun Anda
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
                                <Building className="h-3 w-3 text-slate-400" />
                                <span>{p.satuan_kerja || p.instansi}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="font-mono text-slate-800 font-semibold">{p.nip || "-"}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">@{p.username}</div>
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold border ${roleBadge.className}`}
                          >
                            <RoleIcon className="h-3 w-3" />
                            <span>{roleBadge.label}</span>
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${verifBadge.className}`}
                          >
                            <VerifIcon className="h-3 w-3" />
                            <span>{verifBadge.label}</span>
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          {isAdmin ? (
                            isOtherAdmin ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500"
                                title="Sesama Administrator tidak dapat diedit atau dihapus"
                              >
                                <Shield className="h-3 w-3 text-slate-400" />
                                <span>Terkunci (Sesama Admin)</span>
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(p)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#B1C9EF] bg-[#F0F3FA] hover:bg-[#D5DEEF] px-2.5 py-1 text-[11px] font-bold text-[#395886] transition-colors cursor-pointer"
                                  title={
                                    isSelf
                                      ? "Edit profil dan kata sandi akun Anda"
                                      : "Edit data dan kata sandi pengguna"
                                  }
                                >
                                  <Pencil className="h-3 w-3" />
                                  <span>{isSelf ? "Edit Profil" : "Edit"}</span>
                                </button>

                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(p)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 transition-colors cursor-pointer"
                                    title="Hapus akun pengguna"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              Khusus Admin
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Pengguna */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-palette-xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E304B]">Hapus Akun Pengguna</h3>
                  <p className="text-[11px] text-slate-500 font-normal">Konfirmasi penghapusan akses sistem</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun pengguna berikut dari sistem penilaian mandiri IKK?
            </p>

            {/* Detail Akun yang Dihapus */}
            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-rose-100/70 pb-2">
                <span className="text-slate-500">Nama Pegawai:</span>
                <span className="font-bold text-[#1E304B]">{deletingUser.nama}</span>
              </div>
              <div className="flex justify-between items-center border-b border-rose-100/70 pb-2">
                <span className="text-slate-500">Username:</span>
                <span className="font-mono font-semibold text-slate-700">{deletingUser.username}</span>
              </div>
              {deletingUser.nip && (
                <div className="flex justify-between items-center border-b border-rose-100/70 pb-2">
                  <span className="text-slate-500">NIP:</span>
                  <span className="font-mono text-slate-700">{deletingUser.nip}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Satuan Kerja:</span>
                <span className="font-medium text-slate-800 text-right max-w-[220px] truncate" title={deletingUser.satuan_kerja}>
                  {deletingUser.satuan_kerja}
                </span>
              </div>
            </div>

            {/* Catatan Peringatan */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-[11px] text-amber-900 leading-relaxed">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Peringatan:</strong> Tindakan ini bersifat permanen. Pengguna tidak akan dapat masuk kembali dan seluruh hak akses akun ini akan dicabut.
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={deleteLoading}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-palette-sm disabled:opacity-60 transition-all cursor-pointer"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Ya, Hapus Pengguna</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak Pengguna */}
      {rejectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-palette-xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700">
                <UserX className="h-5 w-5" />
                <h3 className="text-base font-bold text-[#1E304B]">Tolak Pendaftaran Akun</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingUser(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Anda akan menolak pengajuan akun dari <strong>{rejectingUser.nama}</strong> (NIP: {rejectingUser.nip}) untuk Satuan Kerja <strong>{rejectingUser.satuan_kerja}</strong>.
            </p>

            <form onSubmit={handleRejectConfirm} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Penolakan (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={rejectCatatan}
                  onChange={(e) => setRejectCatatan(e.target.value)}
                  placeholder="Contoh: NIP tidak sesuai data kepegawaian Komdigi atau bukan perwakilan resmi satker."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingUser(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-palette-sm disabled:opacity-60"
                >
                  {modalLoading ? "Memproses..." : "Tolak Pendaftaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Pengguna */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-[#D5DEEF] bg-white p-6 sm:p-7 shadow-palette-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D5DEEF]/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#F0F3FA] text-[#395886] border border-[#B1C9EF]">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E304B]">Edit Akun Pengguna</h3>
                  <p className="text-[11px] text-slate-500">Perbarui profil dan akses pengguna</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-[#F0F3FA] hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIP (18 Digit)</label>
                  <input
                    type="text"
                    maxLength={18}
                    value={editNip}
                    onChange={(e) => setEditNip(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 font-mono focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan Kerja</label>
                  <select
                    value={editSatker}
                    onChange={(e) => setEditSatker(e.target.value)}
                    className="w-full rounded-xl border border-[#D5DEEF] bg-white px-3 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                  >
                    {!DAFTAR_SATKER_KOMDIGI.includes(editSatker) && editSatker && (
                      <option value={editSatker}>{editSatker}</option>
                    )}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Pengguna (Username)</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Peran (Role)
                  </label>
                  <select
                    value={editPeran}
                    disabled={editingUser.id === currentUser.id}
                    onChange={(e) => setEditPeran(e.target.value as Peran)}
                    className="w-full rounded-xl border border-[#D5DEEF] bg-white px-3 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF] disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  >
                    <option value="ANALIS">Analis Satker</option>
                    <option value="KOORDINATOR">Koordinator Pusaka</option>
                    <option value="ADMIN">Administrator Sistem</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Instansi</label>
                <input
                  type="text"
                  required
                  value={editInstansi}
                  onChange={(e) => setEditInstansi(e.target.value)}
                  className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                />
              </div>

              {/* Setel Ulang Password */}
              <div className="border-t border-[#D5DEEF]/70 pt-3">
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-amber-600" />
                  <span>Setel Ulang Kata Sandi Baru (Opsional)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin mengubah kata sandi"
                  className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 placeholder:text-slate-400 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5DEEF]/70">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl border border-[#D5DEEF] px-4 py-2 font-bold text-slate-700 hover:bg-[#F0F3FA] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2F4A72] hover:to-[#395886] px-4 py-2 font-bold text-white shadow-palette-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {modalLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Pengguna */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-[#D5DEEF] bg-white p-6 sm:p-7 shadow-palette-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D5DEEF]/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#F0F3FA] text-[#395886] border border-[#B1C9EF]">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E304B]">Tambah Pengguna Manual</h3>
                  <p className="text-[11px] text-slate-500">Daftarkan akun pengguna langsung aktif</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-[#F0F3FA] hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdd} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap (Tanpa Gelar)</label>
                <input
                  type="text"
                  required
                  value={addNama}
                  onChange={(e) => setAddNama(e.target.value)}
                  placeholder="Contoh: Hendra Pratama"
                  className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIP (18 Digit)</label>
                  <input
                    type="text"
                    maxLength={18}
                    value={addNip}
                    onChange={(e) => setAddNip(e.target.value.replace(/\D/g, ""))}
                    placeholder="199208152018011002"
                    className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 font-mono focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan Kerja</label>
                  <select
                    value={addSatker}
                    onChange={(e) => setAddSatker(e.target.value)}
                    className="w-full rounded-xl border border-[#D5DEEF] bg-white px-3 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    placeholder="analis2"
                    className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Peran (Role)</label>
                  <select
                    value={addPeran}
                    onChange={(e) => setAddPeran(e.target.value as Peran)}
                    className="w-full rounded-xl border border-[#D5DEEF] bg-white px-3 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                  >
                    <option value="ANALIS">Analis Satker</option>
                    <option value="KOORDINATOR">Koordinator Pusaka</option>
                    <option value="ADMIN">Administrator Sistem</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kata Sandi Awal</label>
                  <input
                    type="password"
                    required
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Instansi</label>
                  <input
                    type="text"
                    required
                    value={addInstansi}
                    onChange={(e) => setAddInstansi(e.target.value)}
                    className="w-full rounded-xl border border-[#D5DEEF] px-3.5 py-2 text-slate-900 focus:border-[#628ECB] focus:outline-hidden focus:ring-2 focus:ring-[#B1C9EF]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5DEEF]/70">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-[#D5DEEF] px-4 py-2 font-bold text-slate-700 hover:bg-[#F0F3FA] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#395886] to-[#4E73A9] hover:from-[#2F4A72] hover:to-[#395886] px-4 py-2 font-bold text-white shadow-palette-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {modalLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Membuat...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>Buat Pengguna</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
