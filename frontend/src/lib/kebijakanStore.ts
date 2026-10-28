export interface KebijakanItem {
  id: string;
  nama: string;
  jenis_dasar_hukum: string;
  nomor_dasar_hukum: string;
  tanggal_penetapan: string;
  dipilih_untuk_si_ikk: boolean;
  rekomendasi: string;
  satuan_kerja?: string;
  pembuat_id?: string;
  status_asesmen?: string;
  skor_total?: number;
  kualifikasi?: string;
  jumlah_jawaban?: number;
}

export const INITIAL_KEBIJAKAN_LIST: KebijakanItem[] = [];

const STORAGE_KEY = "ikk_kebijakan_list";

export function getStoredKebijakanList(): KebijakanItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Gagal membaca kebijakan dari localStorage:", e);
  }
  return INITIAL_KEBIJAKAN_LIST;
}

export function saveStoredKebijakanList(list: KebijakanItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("ikk_kebijakan_updated"));
  } catch (e) {
    console.error("Gagal menyimpan kebijakan ke localStorage:", e);
  }
}
