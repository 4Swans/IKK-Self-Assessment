import { useState, useMemo, useRef, useEffect, type DragEvent, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Upload,
  HelpCircle,
  Save,
  Send,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
  Eye,
  Gauge,
  PieChart,
  Target,
  TrendingUp,
  Award,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RotateCcw,
  FileCheck,
  Lock,
  ShieldCheck,
  Sparkles,
  FileStack,
  AlertTriangle,
  Building,
  Info,
} from "lucide-react";
import { RadarDimensiIKK } from "../../components/ui/RadarDimensiIKK";
import { ToastNotification } from "../../components/ui/ToastNotification";
import {
  getStoredKebijakanList,
  saveStoredKebijakanList,
  type KebijakanItem,
} from "../../lib/kebijakanStore";
import {
  useAjukanAsesmenApiV1AsesmenAsesmenIdAjukanPost,
  useSetujuiAsesmenApiV1AsesmenAsesmenIdSetujuiPost,
  useKembalikanAsesmenApiV1AsesmenAsesmenIdKembalikanPost,
  useBukaKembaliAsesmenApiV1AsesmenAsesmenIdBukaKembaliPost,
  useAmbilAsesmenPerKebijakanApiV1AsesmenKebijakanKebijakanIdGet,
  usePerbaruiJfakAsesmenApiV1AsesmenAsesmenIdJfakPut,
} from "../../api/endpoints/asesmen/asesmen";
import {
  useSimpanJawabanApiV1JawabanAsesmenIdPertanyaanIdPut,
  useUnggahBuktiDukungApiV1JawabanJawabanIdUnggahBuktiPost,
  useGabungPdfBuktiApiV1JawabanJawabanIdGabungPdfPost,
  useHapusBuktiApiV1JawabanBuktiBuktiIdDelete,
} from "../../api/endpoints/jawaban-bukti-dukung/jawaban-bukti-dukung";
import { useAmbilInstrumenAktifApiV1InstrumenAktifGet } from "../../api/endpoints/instrumen-ikk/instrumen-ikk";
import { useDaftarKebijakanApiV1KebijakanGet } from "../../api/endpoints/kebijakan-strategis/kebijakan-strategis";
import { useDaftarPeriodeApiV1PeriodeGet } from "../../api/endpoints/periode/periode";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";

interface OpsiItem {
  huruf: string;
  teks: string;
  skor: number;
}

interface PertanyaanItem {
  kode: string;
  teks: string;
  dimensiKode: string;
  bobotRelatif: number;
  bobotDimensi: string;
  bobotEfektif: string;
  buktiDukungWajib: string;
  keterangan: string;
  opsi: OpsiItem[];
}

const INSTRUMEN_DATA: PertanyaanItem[] = [
  // Dimensi Profil Instansi: 10%
  {
    kode: "PROFIL",
    dimensiKode: "PROFIL",
    teks: "Apakah dalam penilaian indeks kualitas kebijakan ini, Anda melibatkan jabatan fungsional analis kebijakan?",
    bobotRelatif: 100,
    bobotDimensi: "100%",
    bobotEfektif: "10,00%",
    buktiDukungWajib: "Tidak memerlukan unggahan berkas bukti fisik",
    keterangan: "Standar Baku & Petunjuk Resmi LAN RI:\n(1) Keterlibatan JFAK bernilai 10 poin penuh (10% dari total indeks kualitas kebijakan).\n(2) Instansi mengonfirmasi keterlibatan Tim Penilai Internal JFAK dalam penilaian mandiri kebijakan.\n(3) Jika melibatkan JFAK, skor profil bernilai 100 (kontribusi 10 poin penuh). Jika tidak melibatkan JFAK, skor bernilai 0.",
    opsi: [
      { huruf: "A", teks: "Tidak melibatkan Jabatan Fungsional Analis Kebijakan (JFAK)", skor: 0 },
      { huruf: "B", teks: "Ya, melibatkan Jabatan Fungsional Analis Kebijakan (JFAK)", skor: 100 },
    ],
  },

  // Dimensi A: 20%
  {
    kode: "A1",
    dimensiKode: "A",
    teks: "Apakah kebijakan disusun berdasarkan data dan informasi yang valid (kajian/telaahan/penelitian/analisis kebijakan)?",
    bobotRelatif: 40,
    bobotDimensi: "40%",
    bobotEfektif: "8,00%",
    buktiDukungWajib: "Laporan kajian, data statistik",
    keterangan: "• Standar Baku:\n  1. Format kajian memuat kejelasan tujuan, target, dan urgensi kebijakan.\n  2. Hierarki UU/Perda memenuhi teknik penyusunan perUUan (UU 12/2011 & perubahannya).\n• Relevan: Sesuai periode perencanaan dan substansi isu kebijakan.\n• Kredibel: Diketahui dan disahkan oleh pejabat yang berwenang.",
    opsi: [
      { huruf: "A", teks: "Kebijakan tidak disusun berdasarkan data dan informasi valid", skor: 0 },
      { huruf: "B", teks: "Data tidak relevan, tidak kredibel, dan tidak memenuhi standar baku", skor: 25 },
      { huruf: "C", teks: "Data relevan, tetapi tidak kredibel dan tidak memenuhi standar baku", skor: 50 },
      { huruf: "D", teks: "Data relevan, kredibel, tetapi tidak memenuhi standar baku", skor: 75 },
      { huruf: "E", teks: "Data relevan, kredibel, dan memenuhi kaidah/standar baku", skor: 100 },
    ],
  },
  {
    kode: "A2",
    dimensiKode: "A",
    teks: "Apakah pemangku kepentingan terlibat dalam perumusan kebijakan?",
    bobotRelatif: 40,
    bobotDimensi: "40%",
    bobotEfektif: "8,00%",
    buktiDukungWajib: "Dokumen konsultasi publik, risalah diskusi",
    keterangan: "• Aktif: Terlibat proaktif, dinamis, dan berkelanjutan memberikan masukan.\n• Berkala: Pelibatan dilakukan lebih dari satu kali pertemuan/forum.\n• Administratif: Sekadar formalitas prosedural tanpa partisipasi bermakna atau umpan balik nyata.\n• Stakeholder Eksternal: Pihak luar instansi yang berkepentingan atau terdampak kebijakan.\n• Kelompok Sasaran: Masyarakat, asosiasi/pelaku usaha, atau LSM terdampak langsung (Permenpan RB 16/2017).",
    opsi: [
      { huruf: "A", teks: "Pemangku kepentingan tidak terlibat dalam perumusan kebijakan", skor: 0 },
      { huruf: "B", teks: "Keterlibatan pemangku kepentingan hanya bersifat administratif", skor: 25 },
      { huruf: "C", teks: "Hanya stakeholder eksternal pemerintah tanpa kelompok sasaran", skor: 50 },
      { huruf: "D", teks: "Mencakup stakeholder eksternal dan kelompok sasaran, tetapi tidak aktif & berkala", skor: 75 },
      { huruf: "E", teks: "Mencakup stakeholder eksternal dan sasaran, dilakukan secara aktif dan berkala", skor: 100 },
    ],
  },
  {
    kode: "A3",
    dimensiKode: "A",
    teks: "Apakah analisis dampak kebijakan dilakukan sebelum implementasi?",
    bobotRelatif: 20,
    bobotDimensi: "20%",
    bobotEfektif: "4,00%",
    buktiDukungWajib: "Laporan RIA / ROCCIPI atau bentuk laporan relevan lainnya",
    keterangan: "• Analisis Dampak: Penilaian sistematis potensi dampak positif/negatif sebelum implementasi (metode RIA, ROCCIPI, atau CBA).\n• Standar Baku: Metodologi ilmiah yang diakui dan sesuai format UU 12/2011.\n• Kredibel: Diketahui dan disahkan oleh pejabat yang berwenang.\n• Hasil Digunakan: Rekomendasi analisis dampak benar-benar diadopsi dalam perumusan kebijakan.",
    opsi: [
      { huruf: "A", teks: "Kebijakan tidak didahului dengan analisis dampak kebijakan", skor: 0 },
      { huruf: "B", teks: "Analisis dampak tidak relevan terhadap rumusan kebijakan", skor: 25 },
      { huruf: "C", teks: "Analisis dampak tidak memenuhi kaidah/standar baku", skor: 50 },
      { huruf: "D", teks: "Analisis dampak baku dan kredibel, tetapi tidak digunakan dalam perumusan", skor: 75 },
      { huruf: "E", teks: "Analisis dampak baku, kredibel, dan digunakan dalam perumusan kebijakan", skor: 100 },
    ],
  },

  // Dimensi B: 25%
  {
    kode: "B1",
    dimensiKode: "B",
    teks: "Apakah kebijakan memiliki kejelasan koordinasi dan komunikasi dalam pelaksanaannya?",
    bobotRelatif: 35,
    bobotDimensi: "35%",
    bobotEfektif: "8,75%",
    buktiDukungWajib: "Dokumen Bispro/SOP, pedoman teknis implementasi",
    keterangan: "• Standar Baku: Prosedur koordinasi dan komunikasi mengacu regulasi resmi (Permenpan RB 15/2014 & Permenpan RB 35/2012 tentang SOP AP).\n• Kredibel: Ditetapkan dan diketahui oleh pejabat yang berwenang.\n• Monitoring & Evaluasi: Terdapat evaluasi rutin untuk memastikan prosedur berjalan efektif dan perbaikan kendala.",
    opsi: [
      { huruf: "A", teks: "Tidak memiliki prosedur koordinasi dan komunikasi dalam pelaksanaan", skor: 0 },
      { huruf: "B", teks: "Prosedur koordinasi dan komunikasi tidak jelas dalam pelaksanaannya", skor: 25 },
      { huruf: "C", teks: "Prosedur koordinasi dan komunikasi tidak sesuai standar baku", skor: 50 },
      { huruf: "D", teks: "Sesuai standar baku dan kredibel, tetapi tidak dilakukan monev", skor: 75 },
      { huruf: "E", teks: "Sesuai standar baku, kredibel, dan dilakukan monitoring dan evaluasi rutin", skor: 100 },
    ],
  },
  {
    kode: "B2",
    dimensiKode: "B",
    teks: "Apakah kebijakan dapat diimplementasikan secara efektif di lapangan?",
    bobotRelatif: 35,
    bobotDimensi: "35%",
    bobotEfektif: "8,75%",
    buktiDukungWajib: "Laporan monitoring dan evaluasi",
    keterangan: "• Indikator Kinerja: Mengacu sistem monev elektronik, Laporan Kinerja Triwulanan, dan Tahunan.\n• Target Sumber Daya: Pemenuhan kecukupan alokasi anggaran dan aparatur pelaksana (SDM).\n• Target Capaian Kinerja: Realisasi target kinerja pada sistem evaluasi kinerja elektronik.",
    opsi: [
      { huruf: "A", teks: "Kebijakan tidak dapat diimplementasikan secara efektif di lapangan", skor: 0 },
      { huruf: "B", teks: "Diimplementasikan tapi tidak sesuai indikator, target SDM/anggaran dan capaian", skor: 25 },
      { huruf: "C", teks: "Sesuai indikator kinerja, tetapi target sumber daya dan kinerja tidak tercapai", skor: 50 },
      { huruf: "D", teks: "Sesuai indikator kinerja dan target sumber daya, tetapi target kinerja tidak tercapai", skor: 75 },
      { huruf: "E", teks: "Sesuai indikator kinerja, target sumber daya (SDM & anggaran), dan target kinerja", skor: 100 },
    ],
  },
  {
    kode: "B3",
    dimensiKode: "B",
    teks: "Apakah ada mekanisme pengawasan dan akuntabilitas dalam pelaksanaan kebijakan?",
    bobotRelatif: 30,
    bobotDimensi: "30%",
    bobotEfektif: "7,50%",
    buktiDukungWajib: "Laporan pengawasan, hasil audit kebijakan",
    keterangan: "• Standar Baku: Mekanisme pengawasan dan akuntabilitas mengacu sistem SAKIP dan SOP pengawasan resmi.\n• Kredibel: Dilaksanakan atau diketahui oleh pejabat yang berwenang / APIP.",
    opsi: [
      { huruf: "A", teks: "Tidak ada mekanisme pengawasan dan akuntabilitas dalam pelaksanaan", skor: 0 },
      { huruf: "B", teks: "Mekanisme pengawasan dan akuntabilitas tidak tersedia", skor: 25 },
      { huruf: "C", teks: "Mekanisme tersedia, tetapi tidak sesuai standar baku dan tidak kredibel", skor: 50 },
      { huruf: "D", teks: "Mekanisme tersedia dan sesuai standar baku, tetapi tidak kredibel", skor: 75 },
      { huruf: "E", teks: "Mekanisme tersedia, sesuai standar baku (SAKIP), dan kredibel", skor: 100 },
    ],
  },

  // Dimensi C: 30%
  {
    kode: "C1",
    dimensiKode: "C",
    teks: "Apakah kebijakan dievaluasi untuk perbaikan berkelanjutan?",
    bobotRelatif: 35,
    bobotDimensi: "35%",
    bobotEfektif: "10,50%",
    buktiDukungWajib: "Laporan evaluasi tahunan, dokumen perubahan kebijakan",
    keterangan: "• Rutin: Dilakukan berkala sesuai periode pelaporan resmi (Laporan Kinerja / LPPD).\n• Terstruktur: Memenuhi sistematika baku pelaporan evaluasi kinerja.\n• Perbaikan Kebijakan: Hasil evaluasi ditindaklanjuti dengan dokumen perubahan kebijakan (revisi regulasi, RKAKL, dll.).",
    opsi: [
      { huruf: "A", teks: "Tidak pernah dilakukan evaluasi kebijakan untuk perbaikan berkelanjutan", skor: 0 },
      { huruf: "B", teks: "Evaluasi kebijakan untuk perbaikan berkelanjutan tidak relevan", skor: 25 },
      { huruf: "C", teks: "Evaluasi rutin, tetapi tidak terstruktur dan tidak digunakan untuk perbaikan", skor: 50 },
      { huruf: "D", teks: "Evaluasi rutin dan terstruktur, tetapi tidak digunakan untuk perbaikan", skor: 75 },
      { huruf: "E", teks: "Evaluasi rutin, terstruktur, dan digunakan untuk perbaikan kebijakan", skor: 100 },
    ],
  },
  {
    kode: "C2",
    dimensiKode: "C",
    teks: "Apakah kebijakan memiliki dampak yang terukur bagi masyarakat?",
    bobotRelatif: 35,
    bobotDimensi: "35%",
    bobotEfektif: "10,50%",
    buktiDukungWajib: "Data capaian indikator, survei kepuasan masyarakat / survei independen",
    keterangan: "• Signifikan & Terukur: Dampak riil memenuhi target dan dibuktikan dengan data capaian yang valid.\n• Diakui Pemangku Kepentingan: Manfaat diakui oleh kelompok sasaran (survei kepuasan / testimoni narasi atau audio visual).\n• Diakui Lembaga Independen: Adanya riset, survei, atau testimoni dari lembaga independen (NGO, LSM, akademisi).",
    opsi: [
      { huruf: "A", teks: "Kebijakan tidak memiliki dampak yang terukur bagi masyarakat", skor: 0 },
      { huruf: "B", teks: "Tidak memiliki data capaian indikator atau survei kepuasan masyarakat", skor: 25 },
      { huruf: "C", teks: "Berdampak signifikan & terukur, tetapi tanpa pengakuan stakeholder & lembaga independen", skor: 50 },
      { huruf: "D", teks: "Berdampak terukur dan diakui pemangku kepentingan, tetapi belum ada survei independen", skor: 75 },
      { huruf: "E", teks: "Berdampak terukur, diakui pemangku kepentingan, dan diakui lembaga independen", skor: 100 },
    ],
  },
  {
    kode: "C3",
    dimensiKode: "C",
    teks: "Berkaitan dengan keberlanjutan kebijakan, apakah kebijakan selaras dengan kebijakan lain yang relevan?",
    bobotRelatif: 30,
    bobotDimensi: "30%",
    bobotEfektif: "9,00%",
    buktiDukungWajib: "Dokumen analisis/koordinasi keselarasan regulasi",
    keterangan: "• Keberlanjutan: Kebijakan bersifat visioner dan berjangka panjang (tidak sesaat).\n• Selaras & Sinkron: Tidak bertentangan dengan peraturan di atasnya maupun regulasi yang setara.\n• Dokumen Analisis Keberlanjutan:\n  1. Perda/Pergub: Mengikuti prosedur klarifikasi (Perpres 87/2014).\n  2. UU/PP/Perpres/Permen: Kajian internal atau Pedoman Evaluasi Peraturan BPHN (2019).",
    opsi: [
      { huruf: "A", teks: "Kebijakan tidak selaras dengan kebijakan lain yang relevan", skor: 0 },
      { huruf: "B", teks: "Tidak selaras & tidak sinkron tetapi memiliki dokumen analisis keberlanjutan", skor: 25 },
      { huruf: "C", teks: "Selaras, tetapi tidak sinkron dan tidak memiliki dokumen analisis", skor: 50 },
      { huruf: "D", teks: "Selaras dan sinkron, tetapi tidak memiliki dokumen analisis keberlanjutan", skor: 75 },
      { huruf: "E", teks: "Selaras, sinkron, dan memiliki dokumen analisis yang menunjukkan keberlanjutan", skor: 100 },
    ],
  },

  // Dimensi D: 15%
  {
    kode: "D1",
    dimensiKode: "D",
    teks: "Apakah informasi kebijakan dapat diakses oleh publik?",
    bobotRelatif: 50,
    bobotDimensi: "50%",
    bobotEfektif: "7,50%",
    buktiDukungWajib: "Publikasi situs/media sosial resmi, media massa (advertorial)",
    keterangan: "• Transparan: Informasi substansi dan pelaksanaan kebijakan terbuka bagi publik tanpa pembatasan yang tidak perlu.\n• Mudah Diakses: Dapat diperoleh dengan cepat via website resmi/portal publik tanpa hambatan teknis.\n• Beragam Format: Disajikan dalam bentuk dokumen (PDF), teks, infografis, video, atau media digital resmi.",
    opsi: [
      { huruf: "A", teks: "Informasi tidak tersedia untuk publik", skor: 0 },
      { huruf: "B", teks: "Informasi kebijakan tidak dapat diakses oleh publik", skor: 25 },
      { huruf: "C", teks: "Informasi transparan, namun sulit diakses dan formatnya terbatas", skor: 50 },
      { huruf: "D", teks: "Informasi transparan, mudah diakses, namun dalam format terbatas", skor: 75 },
      { huruf: "E", teks: "Informasi kebijakan transparan, mudah diakses, dan tersedia berbagai format", skor: 100 },
    ],
  },
  {
    kode: "D2",
    dimensiKode: "D",
    teks: "Apakah ada mekanisme bagi masyarakat untuk memberikan masukan atau mengajukan keberatan?",
    bobotRelatif: 50,
    bobotDimensi: "50%",
    bobotEfektif: "7,50%",
    buktiDukungWajib: "Kanal aduan masyarakat, dokumentasi tanggapan atas masukan publik",
    keterangan: "• Jelas: Alur pengaduan, masukan, dan keberatan masyarakat memiliki SOP yang transparan dan tidak ambigu.\n• Mudah Diakses: Saluran aduan (online/offline/SP4N-LAPOR) dapat dijangkau masyarakat dengan mudah.\n• Riwayat Tanggapan: Tersedia catatan/dokumentasi terbuka atas masukan yang diterima beserta respons resmi instansi.",
    opsi: [
      { huruf: "A", teks: "Tidak ada mekanisme masukan atau pengajuan keberatan bagi masyarakat", skor: 0 },
      { huruf: "B", teks: "Mekanisme tersedia tetapi tidak jelas dan sulit diakses", skor: 25 },
      { huruf: "C", teks: "Mekanisme jelas, tetapi sulit diakses oleh masyarakat", skor: 50 },
      { huruf: "D", teks: "Mekanisme jelas, mudah diakses, tetapi tanpa dokumentasi riwayat tanggapan", skor: 75 },
      { huruf: "E", teks: "Mekanisme jelas, mudah diakses, dan memiliki dokumentasi riwayat tanggapan publik", skor: 100 },
    ],
  },
];

interface BerkasItem {
  id?: string;
  nama: string;
  ukuran: string;
  tipe: "pdf" | "word";
  ada_lapisan_teks?: boolean;
}

interface AnswerState {
  jawabanId?: string;
  opsiHuruf: string;
  penjelasan: string;
  tautan: string;
  berkas: BerkasItem[];
}

export function AsesmenView() {
  const queryClient = useQueryClient();
  const { peran, canEditJawaban, user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const queryKebijakan = searchParams.get("kebijakan");

  // Query Periode Aktif & Instrumen Aktif dari PostgreSQL
  const { data: periodeResp } = useDaftarPeriodeApiV1PeriodeGet({ tahun: 2026 });
  const activePeriodeId = periodeResp?.data?.[0]?.id;

  const { data: instrumenResp } = useAmbilInstrumenAktifApiV1InstrumenAktifGet();
  const instrumenAktif = instrumenResp?.data;

  // Query Kebijakan dari PostgreSQL
  const { data: kebijakanBackendResp } = useDaftarKebijakanApiV1KebijakanGet(
    { periode_id: activePeriodeId! },
    { query: { enabled: !!activePeriodeId, refetchInterval: 5000 } }
  );
  const kebijakanDbList = useMemo(() => {
    const all = kebijakanBackendResp?.data || [];
    if (peran !== "ANALIS") {
      return all.filter((k) => k.status_asesmen && k.status_asesmen !== "DRAF");
    }
    return all;
  }, [kebijakanBackendResp, peran]);

  const [localKebijakanList] = useState<KebijakanItem[]>(getStoredKebijakanList);
  const combinedKebijakanList = useMemo(() => {
    if (kebijakanBackendResp?.data !== undefined) {
      return kebijakanDbList.map((k) => {
        const stored = localKebijakanList.find(
          (loc) => loc.nama.toLowerCase() === k.nama.toLowerCase() || loc.id === k.id
        );
        return {
          id: k.id,
          nama: k.nama,
          jenis_dasar_hukum: k.jenis_dasar_hukum,
          nomor_dasar_hukum: k.nomor_dasar_hukum,
          tanggal_penetapan: k.tanggal_penetapan,
          dipilih_untuk_si_ikk: k.dipilih_untuk_si_ikk,
          rekomendasi: k.rekomendasi || "",
          satuan_kerja: k.satuan_kerja || undefined,
          status_asesmen: k.status_asesmen || "DRAF",
          skor_total: k.skor_total ?? stored?.skor_total,
          kualifikasi: k.kualifikasi ?? stored?.kualifikasi,
        };
      });
    }
    if (peran !== "ANALIS") {
      return localKebijakanList.filter((k) => k.status_asesmen && k.status_asesmen !== "DRAF");
    }
    return localKebijakanList;
  }, [kebijakanBackendResp, kebijakanDbList, localKebijakanList, peran]);

  const kebijakanList = combinedKebijakanList;

  const [selectedKebijakan, setSelectedKebijakan] = useState<string>(() => {
    if (queryKebijakan) return queryKebijakan;
    const stored = getStoredKebijakanList();
    return stored[0]?.nama || "PM 5/2020 PSE Privat";
  });

  const [prevQuery, setPrevQuery] = useState(queryKebijakan);
  if (queryKebijakan !== prevQuery) {
    setPrevQuery(queryKebijakan);
    if (queryKebijakan) {
      setSelectedKebijakan(queryKebijakan);
    }
  }

  // Cari objek kebijakan aktif dari backend
  const currentKebijakanObj = useMemo(() => {
    if (kebijakanDbList.length === 0) return null;
    return (
      kebijakanDbList.find(
        (k) =>
          k.nama.toLowerCase() === selectedKebijakan.toLowerCase() ||
          selectedKebijakan.toLowerCase().includes(k.nama.toLowerCase())
      ) || kebijakanDbList[0]
    );
  }, [kebijakanDbList, selectedKebijakan]);

  const currentKebijakanId = currentKebijakanObj?.id;

  // Query Asesmen Asli untuk Kebijakan Ini dari PostgreSQL
  const { data: asesmenResp, refetch: refetchAsesmen } =
    useAmbilAsesmenPerKebijakanApiV1AsesmenKebijakanKebijakanIdGet(
      currentKebijakanId!,
      {
        query: {
          enabled: !!currentKebijakanId,
          refetchOnMount: "always",
          refetchInterval: 5000,
        },
      }
    );
  const currentAsesmen = asesmenResp?.data;
  const currentAsesmenId = currentAsesmen?.id;

  // Pemetaan Pertanyaan ID <-> Kode dan Opsi ID <-> Huruf
  const petaPertanyaan = useMemo(() => {
    const map: Record<string, { id: string; kode: string; opsiMap: Record<string, string> }> = {};
    if (instrumenAktif?.dimensi_list) {
      for (const d of instrumenAktif.dimensi_list) {
        for (const p of d.pertanyaan_list) {
          const oMap: Record<string, string> = {};
          for (const o of p.opsi_list) {
            oMap[o.huruf] = o.id;
          }
          map[p.kode] = { id: p.id, kode: p.kode, opsiMap: oMap };
        }
      }
    }
    return map;
  }, [instrumenAktif]);

  const petaReverse = useMemo(() => {
    const pMap: Record<string, string> = {};
    const oMap: Record<string, string> = {};
    if (instrumenAktif?.dimensi_list) {
      for (const d of instrumenAktif.dimensi_list) {
        for (const p of d.pertanyaan_list) {
          pMap[p.id] = p.kode;
          for (const o of p.opsi_list) {
            oMap[o.id] = o.huruf;
          }
        }
      }
    }
    return { pMap, oMap };
  }, [instrumenAktif]);

  const [activeKode, setActiveKode] = useState("PROFIL");
  const [isDragging, setIsDragging] = useState(false);
  const [visualMode, setVisualMode] = useState<"radar" | "speedometer" | "donut">("radar");
  const [syncStatus, setSyncStatus] = useState<"tersimpan" | "menyimpan" | "draf">("tersimpan");
  const [isUploading, setIsUploading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [showPetunjuk, setShowPetunjuk] = useState(false);

  // Modern Toast Notification State
  const [toast, setToast] = useState<{
    show: boolean;
    type: "warning" | "error" | "info" | "success";
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  }>({
    show: false,
    type: "info",
    title: "",
    message: "",
  });

  const showToast = (
    title: string,
    message: string,
    type: "warning" | "error" | "info" | "success" = "info",
    actionLabel?: string,
    onAction?: () => void
  ) => {
    setToast({
      show: true,
      type,
      title,
      message,
      actionLabel,
      onAction,
    });
  };

  const questionWorkbenchRef = useRef<HTMLDivElement>(null);

  const scrollToQuestionTop = () => {
    if (questionWorkbenchRef.current) {
      questionWorkbenchRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      window.scrollTo({ top: 120, behavior: "smooth" });
    }
  };

  const handleNextIndicator = () => {
    if (currentIndex < INSTRUMEN_DATA.length - 1) {
      setActiveKode(INSTRUMEN_DATA[currentIndex + 1].kode);
      setTimeout(scrollToQuestionTop, 60);
    }
  };

  const handlePrevIndicator = () => {
    if (currentIndex > 0) {
      setActiveKode(INSTRUMEN_DATA[currentIndex - 1].kode);
      setTimeout(scrollToQuestionTop, 60);
    }
  };

  const handleSelectIndicator = (kode: string) => {
    setActiveKode(kode);
    setTimeout(scrollToQuestionTop, 60);
  };

  // Status asesmen riil dari backend PostgreSQL (atau fallback lokal)
  const [statusKebijakan, setStatusKebijakan] = useState<
    Record<string, "DRAF" | "DIAJUKAN" | "PERLU_PERBAIKAN" | "DISETUJUI" | "TERKIRIM_SI_IKK">
  >({});

  const [catatanPerbaikan, setCatatanPerbaikan] = useState<Record<string, string>>({});

  // Modal dialog states
  const [isAjukanModalOpen, setIsAjukanModalOpen] = useState(false);
  const [isKembalikanModalOpen, setIsKembalikanModalOpen] = useState(false);
  const [inputCatatanKembalikan, setInputCatatanKembalikan] = useState("");
  const [isSetujuiModalOpen, setIsSetujuiModalOpen] = useState(false);
  const [isBukaKembaliModalOpen, setIsBukaKembaliModalOpen] = useState(false);
  const [inputCatatanBukaKembali, setInputCatatanBukaKembali] = useState("");

  const statusAsesmen = (currentAsesmen?.status as any) || statusKebijakan[selectedKebijakan] || "DRAF";
  const currentCatatan =
    currentAsesmen?.catatan_koordinator || catatanPerbaikan[selectedKebijakan] || "";
  const canEdit = canEditJawaban(statusAsesmen);

  const updateStatus = (
    nextStatus: "DRAF" | "DIAJUKAN" | "PERLU_PERBAIKAN" | "DISETUJUI" | "TERKIRIM_SI_IKK"
  ) => {
    setStatusKebijakan((prev) => ({ ...prev, [selectedKebijakan]: nextStatus }));
  };

  // TanStack Query Mutations
  const ajukanMutation = useAjukanAsesmenApiV1AsesmenAsesmenIdAjukanPost();
  const setujuiMutation = useSetujuiAsesmenApiV1AsesmenAsesmenIdSetujuiPost();
  const kembalikanMutation = useKembalikanAsesmenApiV1AsesmenAsesmenIdKembalikanPost();
  const bukaKembaliMutation = useBukaKembaliAsesmenApiV1AsesmenAsesmenIdBukaKembaliPost();
  const simpanJawabanMutation = useSimpanJawabanApiV1JawabanAsesmenIdPertanyaanIdPut();
  const unggahMutation = useUnggahBuktiDukungApiV1JawabanJawabanIdUnggahBuktiPost();
  const gabungMutation = useGabungPdfBuktiApiV1JawabanJawabanIdGabungPdfPost();
  const hapusBuktiMutation = useHapusBuktiApiV1JawabanBuktiBuktiIdDelete();
  const perbaruiJfakMutation = usePerbaruiJfakAsesmenApiV1AsesmenAsesmenIdJfakPut();

  const [policyAnswers, setPolicyAnswers] = useState<Record<string, Record<string, AnswerState>>>({});

  // Menggabungkan data jawaban dari PostgreSQL dengan state lokal formulir
  const answers = useMemo(() => {
    const fromBackend: Record<string, AnswerState> = {};

    // Inisialisasi PROFIL dari backend asesmen
    let jfakOpsi = "";
    if (currentAsesmen?.melibatkan_jfak === true) {
      jfakOpsi = "B";
    } else if (currentAsesmen?.melibatkan_jfak === false) {
      jfakOpsi = "A";
    } else if (periodeResp?.data?.[0]?.melibatkan_jfak === false) {
      jfakOpsi = "A";
    } else {
      jfakOpsi = "B"; // default melibatkan JFAK
    }

    fromBackend["PROFIL"] = {
      jawabanId: "jfak",
      opsiHuruf: jfakOpsi,
      penjelasan: currentAsesmen?.penjelasan_jfak || "",
      tautan: "",
      berkas: [],
    };

    if (currentAsesmen?.jawaban_list && petaReverse.pMap) {
      for (const j of currentAsesmen.jawaban_list) {
        const kode = petaReverse.pMap[j.pertanyaan_id];
        if (kode) {
          const opsiHuruf = j.opsi_id ? (petaReverse.oMap[j.opsi_id] || "") : "";
          const berkas: BerkasItem[] = (j.bukti_dukung_list || []).map((b) => ({
            id: b.id,
            nama: b.nama_file,
            ukuran: `${(b.ukuran / (1024 * 1024)).toFixed(1)} MB`,
            tipe: b.nama_file.toLowerCase().endsWith(".pdf") ? "pdf" : "word",
            ada_lapisan_teks: b.ada_lapisan_teks,
          }));
          fromBackend[kode] = {
            jawabanId: j.id,
            opsiHuruf,
            penjelasan: j.penjelasan || "",
            tautan: j.tautan_bukti || "",
            berkas,
          };
        }
      }
    }

    const localAnswers = policyAnswers[selectedKebijakan] || {};
    return { ...fromBackend, ...localAnswers };
  }, [currentAsesmen, periodeResp, petaReverse, policyAnswers, selectedKebijakan]);

  const setAnswers = (
    updater:
      | Record<string, AnswerState>
      | ((prev: Record<string, AnswerState>) => Record<string, AnswerState>)
  ) => {
    setPolicyAnswers((prev) => {
      const current = prev[selectedKebijakan] || {};
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [selectedKebijakan]: next };
    });
  };

  const currentQ = INSTRUMEN_DATA.find((q) => q.kode === activeKode) || INSTRUMEN_DATA[0];
  const currentIndex = INSTRUMEN_DATA.findIndex((q) => q.kode === activeKode);
  const currentAns = answers[activeKode] || { opsiHuruf: "", penjelasan: "", tautan: "", berkas: [] };

  // Mesin Skoring Realtime Presisi Decimal (Tahap 3): Menggunakan kalkulasi resmi PostgreSQL atau fallback formula LAN 2026
  const scores = useMemo(() => {
    const isJfakYes = answers["PROFIL"]?.opsiHuruf === "B";
    const isJfakNo = answers["PROFIL"]?.opsiHuruf === "A";

    if (currentAsesmen?.skor_terkini) {
      const sk = currentAsesmen.skor_terkini;
      const profilVal = isJfakNo ? 0.0 : isJfakYes ? 10.0 : Number(sk.kontribusi_profil ?? 10.0);
      const totalVal =
        profilVal +
        Number(sk.dimensi?.A?.kontribusi_total ?? 0) +
        Number(sk.dimensi?.B?.kontribusi_total ?? 0) +
        Number(sk.dimensi?.C?.kontribusi_total ?? 0) +
        Number(sk.dimensi?.D?.kontribusi_total ?? 0);

      let kualifikasi = "Kurang";
      if (totalVal >= 91.0) kualifikasi = "Unggul";
      else if (totalVal >= 80.0) kualifikasi = "Sangat Baik";
      else if (totalVal >= 65.0) kualifikasi = "Baik";
      else if (totalVal >= 50.0) kualifikasi = "Cukup";

      return {
        nilaiA: Number(sk.dimensi?.A?.kontribusi_total ?? 0),
        nilaiB: Number(sk.dimensi?.B?.kontribusi_total ?? 0),
        nilaiC: Number(sk.dimensi?.C?.kontribusi_total ?? 0),
        nilaiD: Number(sk.dimensi?.D?.kontribusi_total ?? 0),
        profil: profilVal,
        total: totalVal,
        kualifikasi,
        isBackend: true,
      };
    }

    const getScore = (kode: string) => {
      const q = INSTRUMEN_DATA.find((item) => item.kode === kode);
      const ans = answers[kode];
      if (!q || !ans || !ans.opsiHuruf) return 0;
      const op = q.opsi.find((o) => o.huruf === ans.opsiHuruf);
      return op ? op.skor : 0;
    };

    const nilaiA = ((getScore("A1") * 40 + getScore("A2") * 40 + getScore("A3") * 20) / 100) * 0.20;
    const nilaiB = ((getScore("B1") * 35 + getScore("B2") * 35 + getScore("B3") * 30) / 100) * 0.25;
    const nilaiC = ((getScore("C1") * 35 + getScore("C2") * 35 + getScore("C3") * 30) / 100) * 0.30;
    const nilaiD = ((getScore("D1") * 50 + getScore("D2") * 50) / 100) * 0.15;
    const profil = isJfakYes ? 10.0 : 0.0;
    const total = profil + nilaiA + nilaiB + nilaiC + nilaiD;

    let kualifikasi = "Kurang";
    if (total >= 91.0) kualifikasi = "Unggul";
    else if (total >= 80.0) kualifikasi = "Sangat Baik";
    else if (total >= 65.0) kualifikasi = "Baik";
    else if (total >= 50.0) kualifikasi = "Cukup";

    return { nilaiA, nilaiB, nilaiC, nilaiD, profil, total, kualifikasi, isBackend: false };
  }, [currentAsesmen, answers]);

  // Sync assessment score to stored kebijakan list
  useEffect(() => {
    const hasAnyAnswer = Object.values(answers).some((a) => Boolean(a.opsiHuruf));
    if (hasAnyAnswer && scores) {
      const list = getStoredKebijakanList();
      const idx = list.findIndex(
        (k) =>
          k.nama.toLowerCase().includes(selectedKebijakan.toLowerCase()) ||
          selectedKebijakan.toLowerCase().includes(k.nama.toLowerCase())
      );
      if (idx !== -1) {
        const current = list[idx];
        if (current.skor_total !== scores.total || current.kualifikasi !== scores.kualifikasi) {
          list[idx] = {
            ...current,
            skor_total: scores.total,
            kualifikasi: scores.kualifikasi,
          };
          saveStoredKebijakanList(list);
        }
      }
    }
  }, [answers, scores, selectedKebijakan]);

  // Handler Pilihan Opsi A–E (Tersinkron PostgreSQL)
  const handleOpsiSelect = (huruf: string) => {
    setAnswers((prev) => ({
      ...prev,
      [activeKode]: { ...currentAns, opsiHuruf: huruf },
    }));

    if (activeKode === "PROFIL") {
      if (currentAsesmenId) {
        setSyncStatus("menyimpan");
        perbaruiJfakMutation.mutate(
          {
            asesmenId: currentAsesmenId,
            data: {
              melibatkan_jfak: huruf === "B",
              penjelasan_jfak: currentAns.penjelasan || null,
            },
          },
          {
            onSuccess: () => {
              setSyncStatus("tersimpan");
              refetchAsesmen();
              queryClient.invalidateQueries();
            },
            onError: () => {
              setSyncStatus("draf");
            },
          }
        );
      }
      return;
    }

    const qMeta = petaPertanyaan[activeKode];
    const targetOpsiId = qMeta?.opsiMap?.[huruf];
    if (currentAsesmenId && qMeta?.id && targetOpsiId) {
      setSyncStatus("menyimpan");
      simpanJawabanMutation.mutate(
        {
          asesmenId: currentAsesmenId,
          pertanyaanId: qMeta.id,
          data: {
            opsi_id: targetOpsiId,
            penjelasan: currentAns.penjelasan || null,
            tautan_bukti: currentAns.tautan || null,
            akses_publik_dicek: Boolean(currentAns.tautan),
          },
        },
        {
          onSuccess: () => {
            setSyncStatus("tersimpan");
            refetchAsesmen();
          },
          onError: () => {
            setSyncStatus("draf");
          },
        }
      );
    }
  };

  // Handler Simpan Draf
  const handleSimpanDraf = () => {
    if (activeKode === "PROFIL") {
      if (!currentAsesmenId) {
        setSyncStatus("tersimpan");
        return;
      }
      setSyncStatus("menyimpan");
      perbaruiJfakMutation.mutate(
        {
          asesmenId: currentAsesmenId,
          data: {
            melibatkan_jfak: currentAns.opsiHuruf === "B",
            penjelasan_jfak: currentAns.penjelasan || null,
          },
        },
        {
          onSuccess: () => {
            setSyncStatus("tersimpan");
            refetchAsesmen();
          },
          onError: () => {
            setSyncStatus("draf");
          },
        }
      );
      return;
    }

    const qMeta = petaPertanyaan[activeKode];
    const targetOpsiId = currentAns.opsiHuruf ? qMeta?.opsiMap?.[currentAns.opsiHuruf] : null;
    if (!currentAsesmenId || !qMeta?.id) {
      setSyncStatus("tersimpan");
      return;
    }
    setSyncStatus("menyimpan");
    simpanJawabanMutation.mutate(
      {
        asesmenId: currentAsesmenId,
        pertanyaanId: qMeta.id,
        data: {
          opsi_id: targetOpsiId || null,
          penjelasan: currentAns.penjelasan || null,
          tautan_bukti: currentAns.tautan || null,
          akses_publik_dicek: Boolean(currentAns.tautan),
        },
      },
      {
        onSuccess: () => {
          setSyncStatus("tersimpan");
          refetchAsesmen();
        },
        onError: () => {
          setSyncStatus("draf");
        },
      }
    );
  };

  // Handler Pengajuan ke Koordinator (Buka Dialog Konfirmasi)
  const handleAjukan = () => {
    for (const q of INSTRUMEN_DATA) {
      const ans = answers[q.kode];
      if (!ans || !ans.opsiHuruf) {
        showToast(
          "Opsi Jawaban Belum Lengkap",
          `Indikator ${q.kode === "PROFIL" ? "PROFIL (Keterlibatan JFAK)" : q.kode} belum memiliki opsi jawaban yang dipilih. Silakan lengkapi seluruh ${INSTRUMEN_DATA.length} indikator sebelum mengajukan.`,
          "warning"
        );
        return;
      }
      // PROFIL (Keterlibatan JFAK) tidak memerlukan unggahan berkas bukti dukung
      if (q.kode === "PROFIL") {
        continue;
      }
      const hasEvidence = Boolean(ans.berkas && ans.berkas.length > 0);
      if (!hasEvidence) {
        showToast(
          "Bukti Dukung Dokumen Wajib Ada",
          `Indikator ${q.kode} wajib melampirkan minimal 1 berkas bukti dukung dokumen (PDF/Word) sebelum diajukan ke Koordinator.`,
          "warning"
        );
        return;
      }
    }

    if (!currentAsesmenId) {
      showToast("Data Asesmen Belum Siap", "Asesmen kebijakan belum terdaftar di basis data server.", "error");
      return;
    }

    // Tampilkan modal konfirmasi sebelum pengajuan resmi
    setIsAjukanModalOpen(true);
  };

  // Handler Konfirmasi Resmi Pengajuan ke Koordinator
  const handleConfirmAjukan = () => {
    if (!currentAsesmenId) return;

    ajukanMutation.mutate(
      {
        asesmenId: currentAsesmenId,
        data: {},
      },
      {
        onSuccess: () => {
          updateStatus("DIAJUKAN");
          setIsAjukanModalOpen(false);
          refetchAsesmen();
          queryClient.invalidateQueries();
          showToast(
            "Asesmen Berhasil Diajukan!",
            `Asesmen kebijakan "${selectedKebijakan}" telah resmi diajukan ke Koordinator Instansi untuk proses telaah dan persetujuan.`,
            "success"
          );
        },
        onError: (err: any) => {
          showToast("Gagal Mengajukan Asesmen", err?.response?.data?.detail || "Gagal mengajukan asesmen.", "error");
        },
      }
    );
  };

  // Handler Kembalikan untuk Perbaikan (Koordinator)
  const handleConfirmKembalikan = () => {
    if (!inputCatatanKembalikan.trim()) {
      showToast(
        "Catatan Perbaikan Wajib Diisi",
        "Mohon berikan catatan catatan perbaikan yang jelas untuk dipelajari oleh Analis Instansi.",
        "warning"
      );
      return;
    }
    if (!currentAsesmenId) return;

    kembalikanMutation.mutate(
      {
        asesmenId: currentAsesmenId,
        data: { catatan: inputCatatanKembalikan.trim() },
      },
      {
        onSuccess: () => {
          updateStatus("PERLU_PERBAIKAN");
          setCatatanPerbaikan((prev) => ({
            ...prev,
            [selectedKebijakan]: inputCatatanKembalikan.trim(),
          }));
          setIsKembalikanModalOpen(false);
          setInputCatatanKembalikan("");
          refetchAsesmen();
          queryClient.invalidateQueries();
          showToast(
            "Asesmen Dikembalikan",
            `Asesmen "${selectedKebijakan}" dikembalikan ke Analis untuk perbaikan dengan status Perlu Perbaikan.`,
            "info"
          );
        },
        onError: (err: any) => {
          showToast("Gagal Mengembalikan Asesmen", err?.response?.data?.detail || "Gagal mengembalikan asesmen.", "error");
        },
      }
    );
  };

  // Handler Setujui Asesmen (Koordinator)
  const handleConfirmSetujui = () => {
    if (!currentAsesmenId) return;
    setujuiMutation.mutate(
      {
        asesmenId: currentAsesmenId,
        data: {},
      },
      {
        onSuccess: () => {
          updateStatus("DISETUJUI");
          setIsSetujuiModalOpen(false);
          refetchAsesmen();
          queryClient.invalidateQueries();
          showToast(
            "Asesmen Disetujui!",
            `Asesmen kebijakan "${selectedKebijakan}" telah resmi disetujui oleh Koordinator Instansi.`,
            "success"
          );
        },
        onError: (err: any) => {
          showToast("Gagal Menyetujui Asesmen", err?.response?.data?.detail || "Gagal menyetujui asesmen.", "error");
        },
      }
    );
  };

  // Handler Tarik Status Persetujuan (Koordinator)
  const handleConfirmBukaKembali = () => {
    if (!currentAsesmenId) return;

    const catatanAksi =
      inputCatatanBukaKembali.trim() ||
      "Persetujuan ditarik oleh Koordinator agar dapat dilakukan asesmen dan perbaikan kembali.";

    bukaKembaliMutation.mutate(
      {
        asesmenId: currentAsesmenId,
        data: { catatan: catatanAksi },
      },
      {
        onSuccess: () => {
          updateStatus("PERLU_PERBAIKAN");
          setCatatanPerbaikan((prev) => ({
            ...prev,
            [selectedKebijakan]: catatanAksi,
          }));
          setIsBukaKembaliModalOpen(false);
          setInputCatatanBukaKembali("");
          refetchAsesmen();
          queryClient.invalidateQueries();
          showToast(
            "Status Persetujuan Ditarik",
            `Status persetujuan "${selectedKebijakan}" berhasil ditarik. Asesmen dibuka kembali untuk diperbaiki dan dinilai ulang oleh Analis.`,
            "info"
          );
        },
        onError: (err: any) => {
          showToast("Gagal Menarik Persetujuan", err?.response?.data?.detail || "Gagal menarik status persetujuan.", "error");
        },
      }
    );
  };

  // Handler Tambah & Unggah Berkas Bukti Dukung (Tahap 2)
  const addFiles = async (files: File[]) => {
    if (!canEdit) {
      showToast(
        "Formulir Dikunci",
        "Formulir sedang dalam mode baca (Read-Only) dan tidak dapat menambah berkas bukti.",
        "warning"
      );
      return;
    }
    if (!currentAsesmenId) {
      showToast(
        "Sesi Asesmen Belum Siap",
        "Data asesmen di server sedang disiapkan. Mohon tunggu beberapa detik.",
        "info"
      );
      return;
    }

    setIsUploading(true);
    try {
      if (activeKode === "PROFIL") {
        setIsUploading(false);
        return;
      }

      const qMeta = petaPertanyaan[activeKode];
      if (!qMeta?.id) {
        showToast(
          "Sesi Asesmen Belum Siap",
          "Data indikator di server sedang disiapkan. Mohon tunggu beberapa detik.",
          "info"
        );
        return;
      }

      // 1. Dapatkan atau buat record Jawaban di DB jika belum ada
      let targetJawabanId = currentAns.jawabanId;
      if (!targetJawabanId) {
        const targetOpsiId = currentAns.opsiHuruf ? qMeta.opsiMap?.[currentAns.opsiHuruf] : null;
        const jRes = await simpanJawabanMutation.mutateAsync({
          asesmenId: currentAsesmenId,
          pertanyaanId: qMeta.id,
          data: {
            opsi_id: targetOpsiId || null,
            penjelasan: currentAns.penjelasan || null,
            tautan_bukti: currentAns.tautan || null,
            akses_publik_dicek: Boolean(currentAns.tautan),
          },
        });
        targetJawabanId = jRes.data.id;
        setAnswers((prev) => ({
          ...prev,
          [activeKode]: { ...currentAns, jawabanId: targetJawabanId },
        }));
      }

      // 2. Unggah setiap file ke server via endpoint unggah-bukti
      let uploadCount = 0;
      for (const file of files) {
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (![".pdf", ".docx", ".doc"].includes(ext)) {
          showToast(
            "Format Berkas Tidak Didukung",
            `Berkas "${file.name}" tidak didukung. Harap gunakan berkas dokumen PDF atau Word (.pdf, .docx, .doc).`,
            "warning"
          );
          continue;
        }
        if (file.size > 25 * 1024 * 1024) {
          showToast(
            "Ukuran Melebihi Batas",
            `Ukuran berkas "${file.name}" melebihi batas maksimum 25 MB.`,
            "warning"
          );
          continue;
        }

        await unggahMutation.mutateAsync({
          jawabanId: targetJawabanId,
          data: { file: file as any },
        });
        uploadCount++;
      }

      await refetchAsesmen();
      queryClient.invalidateQueries({ queryKey: [`/api/v1/asesmen`] });
      queryClient.invalidateQueries({ queryKey: [`/api/v1/rekap`] });
      setSyncStatus("tersimpan");
      if (uploadCount > 0) {
        showToast(
          "Unggah Berkas Berhasil",
          `${uploadCount} berkas bukti dukung berhasil diunggah dan diperiksa lapisan teksnya oleh AI OCR.`,
          "success"
        );
      }
    } catch (err: any) {
      console.error("Gagal mengunggah berkas:", err);
      showToast(
        "Gagal Mengunggah Berkas",
        err?.response?.data?.detail || "Terjadi kendala saat mengunggah berkas bukti dukung.",
        "error"
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Handler Gabungkan PDF Jadi 1 Dokumen Tunggal (Tahap 2)
  const handleGabungPdf = async () => {
    if (!canEdit) return;
    const targetJawabanId = currentAns.jawabanId;
    if (!targetJawabanId) {
      showToast(
        "Belum Ada Jawaban",
        "Belum ada draf jawaban tersimpan untuk indikator ini.",
        "warning"
      );
      return;
    }
    const pdfCount = currentAns.berkas.filter((b) => b.nama.toLowerCase().endsWith(".pdf")).length;
    if (pdfCount < 2) {
      showToast(
        "Jumlah Berkas Belum Cukup",
        "Minimal diperlukan 2 file PDF untuk digabungkan menjadi satu dokumen utuh.",
        "warning"
      );
      return;
    }

    setIsMerging(true);
    try {
      await gabungMutation.mutateAsync({
        jawabanId: targetJawabanId,
      });
      await refetchAsesmen();
      queryClient.invalidateQueries({ queryKey: [`/api/v1/asesmen`] });
      queryClient.invalidateQueries({ queryKey: [`/api/v1/rekap`] });
      showToast(
        "Penggabungan PDF Berhasil!",
        `Sebanyak ${pdfCount} berkas PDF berhasil disatukan menjadi 1 dokumen tunggal utuh sesuai ketentuan SI IKK LAN.`,
        "success"
      );
    } catch (err: any) {
      console.error("Gagal menggabungkan PDF:", err);
      showToast(
        "Gagal Menggabungkan PDF",
        err?.response?.data?.detail || "Terjadi kesalahan saat memproses penggabungan berkas PDF.",
        "error"
      );
    } finally {
      setIsMerging(false);
    }
  };

  // Handler Hapus Berkas Bukti (Tahap 2)
  const handleHapusBerkas = async (idx: number) => {
    if (!canEdit) return;
    const item = currentAns.berkas[idx];
    if (!item) return;

    if (activeKode === "PROFIL") {
      return;
    }

    if (item.id) {
      try {
        await hapusBuktiMutation.mutateAsync({ buktiId: item.id });
        await refetchAsesmen();
        queryClient.invalidateQueries({ queryKey: [`/api/v1/asesmen`] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/rekap`] });
        showToast(
          "Berkas Bukti Dihapus",
          `Berkas "${item.nama}" telah berhasil dihapus dari server dan basis data.`,
          "info"
        );
      } catch (err: any) {
        console.error("Gagal menghapus bukti:", err);
        showToast(
          "Gagal Menghapus Berkas",
          err?.response?.data?.detail || "Gagal menghapus berkas bukti dari server.",
          "error"
        );
      }
    } else {
      setAnswers((prev) => ({
        ...prev,
        [activeKode]: {
          ...currentAns,
          berkas: currentAns.berkas.filter((_, i) => i !== idx),
        },
      }));
      showToast("Berkas Dihapus", `Berkas "${item.nama}" dihapus dari draf antarmuka.`, "info");
    }
  };

  // Handler Auto-Simpan Penjelasan onBlur
  const handleBlurPenjelasan = async () => {
    if (activeKode === "PROFIL") {
      if (!currentAsesmenId) return;
      try {
        setSyncStatus("menyimpan");
        await perbaruiJfakMutation.mutateAsync({
          asesmenId: currentAsesmenId,
          data: {
            melibatkan_jfak: currentAns.opsiHuruf === "B",
            penjelasan_jfak: currentAns.penjelasan || null,
          },
        });
        setSyncStatus("tersimpan");
      } catch {
        setSyncStatus("draf");
      }
      return;
    }

    const qMeta = petaPertanyaan[activeKode];
    if (!currentAsesmenId || !qMeta?.id) return;
    const targetOpsiId = currentAns.opsiHuruf ? qMeta.opsiMap?.[currentAns.opsiHuruf] : null;
    try {
      setSyncStatus("menyimpan");
      await simpanJawabanMutation.mutateAsync({
        asesmenId: currentAsesmenId,
        pertanyaanId: qMeta.id,
        data: {
          opsi_id: targetOpsiId || null,
          penjelasan: currentAns.penjelasan || null,
          tautan_bukti: currentAns.tautan || null,
          akses_publik_dicek: Boolean(currentAns.tautan),
        },
      });
      setSyncStatus("tersimpan");
    } catch {
      setSyncStatus("draf");
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      e.target.value = "";
      addFiles(selected);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Elegan & Proper */}
      <ToastNotification
        show={toast.show}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        actionLabel={toast.actionLabel}
        onAction={toast.onAction}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* Header & Policy Selector */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Formulir Asesmen Mandiri IKK 2026
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Penyiapan indikator, pengumpulan berkas bukti dukung (PDF/Word), dan pemantauan skor seketika.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedKebijakan}
            onChange={(e) => setSelectedKebijakan(e.target.value)}
            className="rounded-lg border border-[#D5DEEF] bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs focus:border-[#395886] focus:ring-1 focus:ring-[#395886] max-w-xs sm:max-w-md truncate"
          >
            {kebijakanList.map((k, idx) => (
              <option key={k.id} value={k.nama}>
                Kebijakan {idx + 1}: {k.nama} {k.skor_total === undefined ? "(Belum Diases)" : `(${k.skor_total.toFixed(2)})`}
              </option>
            ))}
            {!kebijakanList.some((k) => k.nama === selectedKebijakan) && (
              <option value={selectedKebijakan}>
                Kebijakan: {selectedKebijakan} (Belum Diases)
              </option>
            )}
          </select>

          <span className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-[#395886] inline-flex items-center gap-1.5 shadow-2xs">
            <Building className="h-3.5 w-3.5 text-[#628ECB]" />
            <span>{currentKebijakanObj?.satuan_kerja || currentUser.satuan_kerja || "Satuan Kerja"}</span>
          </span>

          <span
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
              statusAsesmen === "DIAJUKAN"
                ? "bg-blue-100 text-blue-800"
                : statusAsesmen === "DISETUJUI"
                ? "bg-emerald-100 text-emerald-800"
                : statusAsesmen === "TERKIRIM_SI_IKK"
                ? "bg-purple-100 text-purple-800"
                : statusAsesmen === "PERLU_PERBAIKAN"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-800"
            }`}
          >
            Status: {statusAsesmen}
          </span>

          {/* Sync status indicator */}
          <div className="hidden sm:flex items-center text-xs">
            {syncStatus === "menyimpan" ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                Menyimpan...
              </span>
            ) : syncStatus === "tersimpan" ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Tersinkron
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                <Save className="h-3.5 w-3.5 text-slate-400" />
                Draf Lokal
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banner Notifikasi Jika Kebijakan Belum Dinilai */}
      {(Object.keys(answers).length === 0 || Object.values(answers).every((a) => !a.opsiHuruf)) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-950 flex items-start gap-3 shadow-palette-xs animate-in fade-in duration-200">
          <div className="p-2 rounded-xl bg-amber-500 text-white flex-shrink-0">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-amber-950">
              Asesmen Mandiri Baru: {selectedKebijakan}
            </div>
            <p className="mt-0.5 text-slate-700 leading-relaxed">
              Kebijakan ini belum memiliki riwayat penilaian mandiri. Silakan tentukan opsi jawaban (A–E) pada setiap indikator di bawah, cantumkan penjelasan ringkas, dan lampirkan berkas bukti dukung (PDF/Word) untuk memperkuat akuntabilitas penilaian mandiri.
            </p>
          </div>
        </div>
      )}

      {/* Contextual Status & Review Mode Banner */}
      {statusAsesmen === "PERLU_PERBAIKAN" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 mt-0.5">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-bold text-amber-950 flex items-center gap-2">
                <span>Perlu Perbaikan dari Koordinator Instansi</span>
                <span className="rounded-sm bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                  Status: PERLU PERBAIKAN
                </span>
              </div>
              <p className="text-amber-900 leading-relaxed font-medium">
                Catatan Koordinator: &ldquo;{currentCatatan || "Mohon lengkapi berkas bukti dukung dan telaah kembali opsi indikator yang dipilih."}&rdquo;
              </p>
              <p className="text-amber-800 text-[11px]">
                {peran === "ANALIS"
                  ? "Silakan perbaiki isian dan unggah bukti tambahan di bawah, kemudian klik 'Ajukan ke Koordinator'."
                  : "Asesmen ini sedang dalam tahap perbaikan oleh Analis Instansi."}
              </p>
            </div>
          </div>
        </div>
      )}

      {statusAsesmen === "DIAJUKAN" && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white p-5 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 mt-0.5">
                <FileCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">
                    {peran === "KOORDINATOR"
                      ? "Mode Telaah & Verifikasi Koordinator (Review Mode)"
                      : "Asesmen Telah Resmi Diajukan ke Koordinator"}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-900 border border-blue-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                    Status: DIAJUKAN
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                  {peran === "KOORDINATOR"
                    ? "Anda sedang menelaah kelayakan asesmen kebijakan ini. Periksa kesesuaian bukti dukung pada setiap indikator di bawah. Jika sesuai standar, klik 'Setujui Asesmen'; jika belum memadai, klik 'Kembalikan untuk Perbaikan'."
                    : `Asesmen kebijakan "${selectedKebijakan}" telah dikirim ke Koordinator Instansi. Seluruh isian indikator, dokumen bukti, dan penjelasan saat ini dalam mode terkunci (Read-Only) menunggu hasil verifikasi.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xs rounded-xl p-3 border border-blue-100/80 shadow-2xs shrink-0 self-start md:self-center">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Skor Diajukan</div>
                <div className="text-base font-black text-blue-950">
                  {scores.total.toFixed(2)}
                  <span className="text-[11px] font-semibold text-slate-400 ml-1">/ 100</span>
                </div>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Predikat</div>
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block">
                  {scores.kualifikasi}
                </div>
              </div>
            </div>
          </div>

          {peran === "ANALIS" && (
            <div className="mt-3.5 pt-3 border-t border-blue-100/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <Lock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Formulir terkunci untuk menjamin integritas data selama ditelaah. Anda dapat mengubah kembali jika Koordinator memberikan catatan perbaikan.</span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-800 bg-blue-100/70 px-2.5 py-1 rounded-lg">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                11 dari 11 Indikator Lengkap
              </div>
            </div>
          )}
        </div>
      )}

      {(statusAsesmen === "DISETUJUI" || statusAsesmen === "TERKIRIM_SI_IKK") && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white mt-0.5 shadow-xs">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-emerald-950 flex items-center gap-2">
                  <span>Asesmen Resmi Disetujui oleh Koordinator</span>
                  <span className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900">
                    Status: DISETUJUI
                  </span>
                </div>
                <p className="text-emerald-900 text-[11px] leading-relaxed max-w-2xl">
                  {peran === "KOORDINATOR"
                    ? "Seluruh isian indikator dan berkas bukti dukung kebijakan ini telah disetujui. Apabila memerlukan peninjauan atau asesmen ulang oleh Analis, Anda dapat menarik status persetujuan ini."
                    : "Asesmen untuk kebijakan ini telah disetujui oleh Koordinator Instansi. Seluruh isian indikator dan dokumen bukti berada dalam status terkunci (Read-Only)."}
                </p>
              </div>
            </div>

            {peran === "KOORDINATOR" && (
              <button
                type="button"
                onClick={() => setIsBukaKembaliModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 shadow-2xs shrink-0 self-start sm:self-center transition"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                Tarik Status Persetujuan
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3-Column Layout: Left (Palette), Center (Questions & Evidence), Right (Kalkulasi Nilai & Visualisasi) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Nomor Indikator (lg:col-span-4 xl:col-span-3) - Diperlebar agar tidak memanjang kebawah */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="rounded-2xl border border-[#D5DEEF] bg-white/95 p-4 shadow-palette-sm space-y-3.5 backdrop-blur-xs">
            <div className="flex items-center justify-between border-b border-[#D5DEEF]/60 pb-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#395886]">
                  Nomor Indikator
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Klik kotak untuk pindah pertanyaan
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-[#395886] tabular-nums bg-[#F0F3FA] border border-[#B1C9EF] rounded-lg px-2 py-0.5 shadow-2xs">
                {currentIndex + 1} / {INSTRUMEN_DATA.length}
              </span>
            </div>

            {/* Profil Instansi (10%) - Card Khusus Keterlibatan JFAK */}
            {(() => {
              const ans = answers["PROFIL"];
              const isSelected = activeKode === "PROFIL";
              const hasAnswer = ans && Boolean(ans.opsiHuruf);

              let boxStyle =
                "bg-white border-[#D5DEEF] text-slate-700 hover:border-[#8AAEE0] hover:bg-[#F0F3FA]";
              if (hasAnswer) {
                boxStyle =
                  "bg-[#D5DEEF]/70 border-[#B1C9EF] text-[#395886] font-bold hover:bg-[#B1C9EF]";
              }
              if (isSelected) {
                boxStyle =
                  "bg-[#395886] border-[#395886] text-white font-bold ring-2 ring-[#8AAEE0] shadow-palette-sm";
              }

              return (
                <div className="rounded-xl border border-[#B1C9EF]/80 bg-gradient-to-r from-[#F0F3FA] to-[#E3EBF7] p-2.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#1E304B]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#395886]" />
                      <span>Profil Instansi (Keterlibatan JFAK)</span>
                    </div>
                    <span className="text-[10px] text-[#395886] font-mono font-bold bg-white/80 px-1.5 py-0.5 rounded border border-[#B1C9EF]">
                      10%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectIndicator("PROFIL")}
                      className={`relative flex h-8.5 px-3 items-center gap-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${boxStyle}`}
                      title={`PROFIL: ${
                        hasAnswer
                          ? ans.opsiHuruf === "B"
                            ? "Ya, Melibatkan JFAK (+10 Poin Penuh)"
                            : "Tidak Melibatkan JFAK (0 Poin)"
                          : "Belum Dijawab"
                      }`}
                    >
                      <span>PROFIL</span>
                      {hasAnswer && (
                        <span className="text-[10px] font-sans font-normal opacity-90">
                          ({ans.opsiHuruf === "B" ? "Ya" : "Tidak"})
                        </span>
                      )}
                    </button>
                    <span className="text-[10px] text-slate-500 italic truncate">
                      {hasAnswer
                        ? ans.opsiHuruf === "B"
                          ? "Melibatkan JFAK"
                          : "Tidak Melibatkan"
                        : "Wajib dijawab"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Dimension Groups: Grid 2 Kolom Sejajar agar Compact & Melebar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { kode: "A", nama: "A. Perencanaan", bobot: "20%", items: ["A1", "A2", "A3"] },
                { kode: "B", nama: "B. Implementasi", bobot: "25%", items: ["B1", "B2", "B3"] },
                { kode: "C", nama: "C. Evaluasi", bobot: "30%", items: ["C1", "C2", "C3"] },
                { kode: "D", nama: "D. Transparansi", bobot: "15%", items: ["D1", "D2"] },
              ].map((dim) => (
                <div key={dim.kode} className="rounded-xl border border-[#D5DEEF]/70 bg-[#F0F3FA]/50 p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#1E304B]">
                    <span className="truncate">{dim.nama}</span>
                    <span className="text-[10px] text-[#395886] font-mono font-bold">{dim.bobot}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {dim.items.map((kode) => {
                      const ans = answers[kode];
                      const isSelected = kode === activeKode;
                      const hasAnswer = ans && Boolean(ans.opsiHuruf);
                      const hasFile = Boolean(ans && ans.berkas.length > 0);
                      const missingEvidence = hasAnswer && !hasFile;

                      let boxStyle =
                        "bg-white border-[#D5DEEF] text-slate-700 hover:border-[#8AAEE0] hover:bg-[#F0F3FA]";
                      if (hasAnswer) {
                        boxStyle =
                          "bg-[#D5DEEF]/70 border-[#B1C9EF] text-[#395886] font-bold hover:bg-[#B1C9EF]";
                      }

                      if (isSelected) {
                        boxStyle = "bg-[#395886] border-[#395886] text-white font-bold ring-2 ring-[#8AAEE0] shadow-palette-sm";
                      }

                      return (
                        <button
                          key={kode}
                          type="button"
                          onClick={() => handleSelectIndicator(kode)}
                          className={`relative flex h-9 flex-1 min-w-[32px] max-w-[44px] items-center justify-center rounded-lg border text-xs font-mono font-bold transition-all ${boxStyle}`}
                          title={`${kode}: ${
                            hasAnswer
                              ? hasFile
                                ? "Terisi (Lengkap Berbukti)"
                                : "Terisi (Belum Upload Bukti)"
                              : "Belum Terisi"
                          }`}
                        >
                          <span>{kode}</span>
                          {missingEvidence && (
                            <span
                              className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white"
                              title="Belum upload bukti dukung"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Compact Horizontal Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D5DEEF]/60 pt-2.5 text-[10px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded border border-[#B1C9EF] bg-[#D5DEEF] inline-block flex-shrink-0" />
                <span>Terisi (Biru Muda)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center rounded border border-[#D5DEEF] bg-white flex-shrink-0">
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                </span>
                <span>Belum Ada Bukti</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded border border-[#D5DEEF] bg-white inline-block flex-shrink-0" />
                <span>Belum Terisi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Question & Evidence Workbench (lg:col-span-4 xl:col-span-5) */}
        <div ref={questionWorkbenchRef} className="lg:col-span-4 xl:col-span-5 space-y-6 scroll-mt-28">
          <div className="rounded-2xl border border-[#D5DEEF] bg-white/95 p-5 sm:p-6 shadow-palette-sm space-y-6 backdrop-blur-xs">
            {/* Question Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className="rounded-lg bg-gradient-to-r from-[#395886] to-[#4E73A9] px-2.5 py-1 font-mono text-xs font-bold text-white shadow-2xs">
                  {currentQ.kode === "PROFIL" ? "Indikator Profil JFAK" : `Indikator ${currentQ.kode}`}
                </span>
                <span className="rounded-lg bg-[#F0F3FA] border border-[#B1C9EF] px-2.5 py-0.5 text-xs font-bold text-[#395886]">
                  {currentQ.kode === "PROFIL"
                    ? "Bobot Profil: 10% • Bobot Total: 10,00%"
                    : `Bobot Dimensi: ${currentQ.bobotDimensi} • Bobot Total: ${currentQ.bobotEfektif}`}
                </span>
              </div>

              <h2 className="text-base font-bold text-[#1E304B] leading-snug">
                {currentQ.teks}
              </h2>

              {/* Petunjuk Standar Baku (Di bawah pertanyaan, tanpa badge) */}
              {currentQ.keterangan && (
                <div className="mt-2.5">
                  <div
                    className="relative group inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#395886] transition-colors cursor-help select-none"
                    onMouseEnter={() => setShowPetunjuk(true)}
                    onMouseLeave={() => setShowPetunjuk(false)}
                  >
                    <HelpCircle className="h-4 w-4 text-[#395886] flex-shrink-0" />
                    <button
                      type="button"
                      id="btn-petunjuk-standar-baku"
                      data-testid="btn-petunjuk-standar-baku"
                      onClick={() => setShowPetunjuk((prev) => !prev)}
                      className="text-xs font-medium text-slate-600 hover:text-[#395886] underline decoration-dotted decoration-slate-400 underline-offset-4 hover:decoration-[#395886] transition-colors cursor-pointer text-left"
                    >
                      Petunjuk Standar Baku &amp; Keterangan Resmi LAN RI
                    </button>

                    {/* Popover Content on Hover & Click */}
                    <div
                      id="popover-petunjuk-standar-baku"
                      onMouseEnter={() => setShowPetunjuk(true)}
                      onMouseLeave={() => setShowPetunjuk(false)}
                      className={`absolute left-0 top-full z-50 mt-2 w-[440px] max-w-[88vw] rounded-2xl border border-[#B1C9EF] bg-white p-4 text-xs text-[#1E304B] shadow-palette-lg backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-150 text-left pointer-events-auto ${
                        showPetunjuk ? "block" : "hidden group-hover:block"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-[#D5DEEF]/70 pb-2 mb-2.5">
                        <div className="flex items-center gap-1.5 font-bold text-[#395886]">
                          <HelpCircle className="h-4 w-4 text-[#395886] flex-shrink-0" />
                          <span>Petunjuk Standar Baku &amp; Keterangan Resmi LAN RI</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPetunjuk(false);
                          }}
                          className="text-slate-400 hover:text-slate-600 rounded-md p-0.5 text-base leading-none font-bold cursor-pointer"
                          title="Tutup"
                        >
                          &times;
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 leading-relaxed max-h-[300px] overflow-y-auto pr-1">
                        {currentQ.keterangan}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Answer Choices */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#395886]">
                  Pilihan Jawaban (Sesuai Kondisi Riil Kebijakan)
                </label>
                {!canEdit && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#F0F3FA] border border-[#B1C9EF] px-2 py-0.5 text-[10px] font-bold text-[#395886]">
                    <Lock className="h-3 w-3" />
                    Terkunci
                  </span>
                )}
              </div>
              {currentQ.opsi.map((op) => {
                const isChecked = currentAns.opsiHuruf === op.huruf;
                return (
                  <label
                    key={op.huruf}
                    onClick={() => {
                      if (canEdit) {
                        handleOpsiSelect(op.huruf);
                      }
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                      !canEdit
                        ? isChecked
                          ? "border-[#B1C9EF] bg-[#F0F3FA]/80 cursor-default"
                          : "border-[#D5DEEF] bg-slate-50/40 cursor-not-allowed opacity-75"
                        : isChecked
                        ? "border-[#395886] bg-[#F0F3FA] ring-1 ring-[#395886] shadow-palette-sm cursor-pointer"
                        : "border-[#D5DEEF] bg-white hover:bg-[#F0F3FA]/60 hover:border-[#B1C9EF] cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      disabled={!canEdit}
                      name={`opsi-${currentQ.kode}`}
                      checked={isChecked}
                      onChange={() => {
                        if (canEdit) handleOpsiSelect(op.huruf);
                      }}
                      className="mt-1 h-4 w-4 border-[#8AAEE0] text-[#395886] focus:ring-[#628ECB] flex-shrink-0 disabled:opacity-50"
                    />
                    <div className="flex flex-1 items-start justify-between gap-3">
                      <p className="text-xs leading-relaxed text-slate-800 font-normal">
                        {op.teks}
                      </p>
                      <span className={`font-mono text-xs font-bold tabular-nums whitespace-nowrap rounded-lg px-2.5 py-0.5 flex-shrink-0 border ${
                        isChecked
                          ? "bg-[#395886] text-white border-[#395886]"
                          : "bg-[#F0F3FA] text-[#395886] border border-[#B1C9EF]"
                      }`}>
                        Skor: {op.skor}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Notifikasi Khusus Indikator PROFIL */}
            {currentQ.kode === "PROFIL" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-blue-950">
                    Konfirmasi Keterlibatan JFAK (Profil Instansi - Bobot 10%)
                  </div>
                  <p className="text-blue-800 leading-relaxed">
                    Pengukuran kualitas kebijakan pada profil ini cukup memilih opsi konfirmasi keterlibatan Tim JFAK (Ya / Tidak). Tidak diperlukan berkas bukti dukung fisik untuk diunggah.
                  </p>
                </div>
              </div>
            )}

            {/* Evidence: Drag and Drop PDF / Word + Link Attachment - KHUSUS INDIKATOR A1-D2 */}
            {currentQ.kode !== "PROFIL" && (
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Bukti Dukung Kebijakan
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ketentuan Dokumen: {currentQ.buktiDukungWajib}
                  </p>
                </div>

                {/* Drag and Drop Zone with Integrated Link Attachment / Lock State */}
                {canEdit ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 sm:p-5 text-center transition-all ${
                      isDragging
                        ? "border-blue-600 bg-blue-50/80"
                        : "border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 mb-2">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-800">
                      Tarik &amp; lepas berkas PDF atau Word (.pdf, .docx, .doc) di sini
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hanya menerima berkas dokumen resmi PDF (.pdf) atau Word (.docx, .doc)
                    </p>

                    {/* Action Button: Pilih Berkas Dokumen */}
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors">
                        <Upload className="h-3.5 w-3.5 text-slate-500" />
                        <span>Pilih Dokumen PDF / Word</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc"
                          multiple
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      *Maksimal ukuran 25 MB per berkas. Sistem akan otomatis memvalidasi lapisan teks dokumen (OCR) untuk kelayakan SI IKK.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-600">
                      <Lock className="h-4 w-4 text-slate-400" />
                      <span>
                        Unggahan berkas bukti dikunci (Status: {statusAsesmen}). Pengisian bukti dilakukan oleh akun <strong>Analis Satker</strong> pada status DRAF / PERLU PERBAIKAN. Koordinator meninjau bukti dalam mode baca.
                      </span>
                    </div>
                  </div>
                )}

                {/* Uploaded Files Holding List for Review & Merging */}
                {currentAns.berkas.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">
                        Berkas Bukti Terlampir ({currentAns.berkas.length})
                      </div>
                      {isUploading && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Mengunggah &amp; Cek AI OCR...
                        </span>
                      )}
                    </div>

                    {/* Ketentuan SI IKK LAN: Gabungkan Jadi 1 PDF */}
                    {currentAns.berkas.filter((b) => b.nama.toLowerCase().endsWith(".pdf")).length >= 2 && canEdit && (
                      <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/70 p-2.5 shadow-2xs">
                        <div className="text-[11px] text-indigo-950 pr-2">
                          <span className="font-bold">Ketentuan SI IKK:</span> Tersedia {currentAns.berkas.filter((b) => b.nama.toLowerCase().endsWith(".pdf")).length} berkas PDF. SI IKK LAN mewajibkan satu dokumen bukti per pertanyaan.
                        </div>
                        <button
                          type="button"
                          disabled={isMerging}
                          onClick={handleGabungPdf}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 shadow-2xs transition disabled:opacity-50 flex-shrink-0"
                        >
                          {isMerging ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileStack className="h-3.5 w-3.5" />
                          )}
                          <span>{isMerging ? "Menggabungkan..." : "Gabungkan Jadi 1 PDF"}</span>
                        </button>
                      </div>
                    )}

                    {currentAns.berkas.map((f, idx) => (
                      <div
                        key={f.id || idx}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate max-w-[280px]">
                          <FileText className={`h-4 w-4 flex-shrink-0 ${f.tipe === "word" ? "text-blue-600" : "text-rose-600"}`} />
                          <div className="truncate">
                            <div className="font-medium text-slate-900 truncate" title={f.nama}>
                              {f.nama}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                              <span>{f.ukuran} &bull; {f.tipe.toUpperCase()}</span>
                              {f.tipe === "pdf" && (
                                f.ada_lapisan_teks === true ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-700 border border-emerald-200" title="Dokumen memiliki lapisan teks digital (Terbaca AI SI IKK LAN)">
                                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                                    Teks Terbaca AI
                                  </span>
                                ) : f.ada_lapisan_teks === false ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.2 text-[9px] font-semibold text-amber-800 border border-amber-300" title="Peringatan: Dokumen merupakan hasil scan tanpa lapisan teks OCR (AI SI IKK mungkin gagal membaca)">
                                    <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                                    Pindaian / Scan
                                  </span>
                                ) : null
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (f.id) {
                                const token = localStorage.getItem("ikk_token");
                                const url = token
                                  ? `/api/v1/jawaban/bukti/${f.id}/unduh?token=${encodeURIComponent(token)}`
                                  : `/api/v1/jawaban/bukti/${f.id}/unduh`;
                                window.open(url, "_blank");
                              } else {
                                setToast({
                                  show: true,
                                  type: "warning",
                                  title: "Berkas Belum Tersinkron",
                                  message: `Berkas "${f.nama}" belum tersinkronkan ke server.`,
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors"
                            title="Buka atau unduh berkas bukti dukung asli"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                            Reviu
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleHapusBerkas(idx)}
                              className="inline-flex items-center rounded border border-transparent p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-100 transition-colors"
                              title="Hapus berkas"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Clarification Notes */}
            <div className="border-t border-slate-200 pt-5 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {currentQ.kode === "PROFIL"
                    ? "Uraian & Catatan Keterlibatan JFAK"
                    : "Uraian & Catatan Klarifikasi Analis"}
                </label>
                {!canEdit && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Mode Hanya-Baca
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                readOnly={!canEdit}
                value={currentAns.penjelasan}
                onBlur={handleBlurPenjelasan}
                onChange={(e) => {
                  if (canEdit) {
                    setAnswers((prev) => ({
                      ...prev,
                      [activeKode]: { ...currentAns, penjelasan: e.target.value },
                    }));
                  }
                }}
                placeholder={
                  canEdit
                    ? currentQ.kode === "PROFIL"
                      ? "Berikan catatan atau penjelasan mengenai tim/analis kebijakan yang terlibat (opsional)..."
                      : "Berikan penjelasan ringkas mengenai substansi bukti..."
                    : "Tidak ada uraian tambahan."
                }
                className={`w-full rounded-lg border p-2.5 text-xs ${
                  !canEdit
                    ? "border-slate-200 bg-slate-50/70 text-slate-700 cursor-not-allowed"
                    : "border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                }`}
              />
            </div>

            {/* Prev / Next Indicator Navigation */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={currentIndex <= 0}
                onClick={handlePrevIndicator}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-2xs"
              >
                <ChevronLeft className="h-4 w-4" />
                Indikator Sebelumnya
              </button>

              <span className="text-xs font-mono text-slate-500 tabular-nums">
                Indikator {currentIndex + 1} dari {INSTRUMEN_DATA.length}
              </span>

              <button
                type="button"
                disabled={currentIndex >= INSTRUMEN_DATA.length - 1}
                onClick={handleNextIndicator}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-40 disabled:pointer-events-none transition shadow-xs"
              >
                <span>Indikator Selanjutnya</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Kalkulasi Nilai Kebijakan & Visualisasi Interaktif (lg:col-span-4) */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-4">
          <div className="rounded-2xl border border-[#D5DEEF] bg-white/95 p-5 shadow-palette-sm space-y-5 sticky top-4 backdrop-blur-xs">
            {/* Header Kalkulasi */}
            <div className="flex items-start justify-between border-b border-[#D5DEEF]/60 pb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#395886] flex items-center gap-1.5">
                  <Gauge className="h-4 w-4 text-[#395886]" />
                  Kalkulasi Nilai Kebijakan
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Formula resmi spreadsheet IKK 2026
                </p>
              </div>

              {/* Mode Switcher Toggle */}
              <div className="inline-flex rounded-xl border border-[#D5DEEF] bg-[#F0F3FA] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setVisualMode("radar")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all ${
                    visualMode === "radar"
                      ? "bg-white text-[#395886] shadow-palette-sm border border-[#D5DEEF]"
                      : "text-slate-600 hover:text-[#395886]"
                  }`}
                  title="Tampilan Komparasi Radar Dimensi IKK"
                >
                  <Target className="h-3 w-3" />
                  Radar
                </button>
                <button
                  type="button"
                  onClick={() => setVisualMode("speedometer")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all ${
                    visualMode === "speedometer"
                      ? "bg-white text-[#395886] shadow-palette-sm border border-[#D5DEEF]"
                      : "text-slate-600 hover:text-[#395886]"
                  }`}
                  title="Tampilan Speedometer Radial Ambang LAN"
                >
                  <Gauge className="h-3 w-3" />
                  Meter
                </button>
                <button
                  type="button"
                  onClick={() => setVisualMode("donut")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all ${
                    visualMode === "donut"
                      ? "bg-white text-[#395886] shadow-palette-sm border border-[#D5DEEF]"
                      : "text-slate-600 hover:text-[#395886]"
                  }`}
                  title="Tampilan Donut Komposisi Skor Dimensi"
                >
                  <PieChart className="h-3 w-3" />
                  Donut
                </button>
              </div>
            </div>

            {/* Visualisasi Nilai Utama (Radar, Speedometer, atau Donut) */}
            <div className="rounded-2xl border border-[#D5DEEF] bg-gradient-to-b from-[#F0F3FA]/70 to-white p-4 shadow-palette-sm">
              {visualMode === "radar" ? (
                /* Mode 1: Komparasi Radar Dimensi IKK (Pentagon Visual) */
                <RadarDimensiIKK
                  instansiName="Xaka"
                  perencanaanScore={scores.nilaiA > 0 ? (scores.nilaiA / 0.20) : 0}
                  implementasiScore={scores.nilaiB > 0 ? (scores.nilaiB / 0.25) : 0}
                  evaluasiScore={scores.nilaiC > 0 ? (scores.nilaiC / 0.30) : 0}
                  transparansiScore={scores.nilaiD > 0 ? (scores.nilaiD / 0.15) : 0}
                  jfakScore={scores.profil === 10 ? 90.0 : 0}
                  totalScore={scores.total}
                  showCardWrapper={false}
                />
              ) : visualMode === "speedometer" ? (
                /* Mode 1: Semi-Circular Radial Speedometer Gauge */
                <div className="space-y-3">
                  <div className="relative mx-auto flex flex-col items-center justify-center">
                    <svg viewBox="0 0 200 128" className="w-full max-w-[240px] overflow-visible">
                      <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f43f5e" />
                          <stop offset="50%" stopColor="#f59e0b" />
                          <stop offset="65%" stopColor="#06b6d4" />
                          <stop offset="80%" stopColor="#395886" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                      </defs>

                      {/* Background Colored Zones Track */}
                      {/* Arc perimeter for r=72 is ~226.19 */}
                      {/* 0-50 (Kurang) */}
                      <path
                        d="M 28 102 A 72 72 0 0 1 172 102"
                        fill="none"
                        stroke="#D5DEEF"
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                      {/* Active Progress Arc */}
                      <path
                        d="M 28 102 A 72 72 0 0 1 172 102"
                        fill="none"
                        stroke="url(#gaugeGradient)"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray="226.19"
                        strokeDashoffset={226.19 - (Math.min(Math.max(scores.total, 0), 100) / 100) * 226.19}
                        className="transition-all duration-700 ease-out"
                      />

                      {/* Tick Marks & Labels at 0, 50, 65, 80, 91, 100 */}
                      {[
                        { val: 0, label: "0" },
                        { val: 50, label: "50" },
                        { val: 65, label: "65" },
                        { val: 80, label: "80" },
                        { val: 91, label: "91" },
                        { val: 100, label: "100" },
                      ].map((t) => {
                        const rad = Math.PI * (1 - t.val / 100);
                        const x1 = 100 + 78 * Math.cos(rad);
                        const y1 = 102 - 78 * Math.sin(rad);
                        const x2 = 100 + 84 * Math.cos(rad);
                        const y2 = 102 - 84 * Math.sin(rad);
                        const tx = 100 + 94 * Math.cos(rad);
                        const ty = 102 - 94 * Math.sin(rad);
                        return (
                          <g key={t.val} className="select-none">
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8AAEE0" strokeWidth="1.5" />
                            <text
                              x={tx}
                              y={ty}
                              fill="#64748b"
                              fontSize="8"
                              fontWeight="600"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontFamily="monospace"
                            >
                              {t.label}
                            </text>
                          </g>
                        );
                      })}

                      {/* Needle Indicator */}
                      {(() => {
                        const pct = Math.min(Math.max(scores.total, 0), 100) / 100;
                        const needleRad = Math.PI * (1 - pct);
                        const nx = 100 + 56 * Math.cos(needleRad);
                        const ny = 102 - 56 * Math.sin(needleRad);
                        return (
                          <g className="transition-all duration-500 ease-out">
                            {/* Needle Body */}
                            <line
                              x1="100"
                              y1="102"
                              x2={nx}
                              y2={ny}
                              stroke="#0f172a"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                            {/* Needle Hub */}
                            <circle cx="100" cy="102" r="7" fill="#0f172a" />
                            <circle cx="100" cy="102" r="3" fill="#ffffff" />
                            {/* Needle Tip Accent */}
                            <circle cx={nx} cy={ny} r="2.5" fill="#395886" />
                          </g>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Centered Score & Qualification Badge */}
                  <div className="text-center pt-1">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-mono text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                        {scores.total.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">/ 100</span>
                    </div>

                    <div className="mt-1 flex items-center justify-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          scores.kualifikasi === "Unggul"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : scores.kualifikasi === "Sangat Baik"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : scores.kualifikasi === "Baik"
                            ? "bg-cyan-100 text-cyan-800 border-cyan-300"
                            : scores.kualifikasi === "Cukup"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                      >
                        {scores.kualifikasi}
                      </span>
                    </div>

                    {/* Actionable Gap Indicator */}
                    <p className="mt-2 text-[11px] text-slate-500 font-medium">
                      {scores.total >= 91.0 ? (
                        <span className="text-emerald-700 font-semibold">
                          ★ Capaian Kualifikasi Tertinggi (Unggul)
                        </span>
                      ) : scores.total >= 80.0 ? (
                        <span>
                          Butuh <span className="font-bold text-blue-700 font-mono">+{(91.0 - scores.total).toFixed(2)}</span> poin untuk mencapai Unggul (91,00)
                        </span>
                      ) : scores.total >= 65.0 ? (
                        <span>
                          Butuh <span className="font-bold text-cyan-700 font-mono">+{(80.0 - scores.total).toFixed(2)}</span> poin untuk naik ke Sangat Baik (80,00)
                        </span>
                      ) : scores.total >= 50.0 ? (
                        <span>
                          Butuh <span className="font-bold text-amber-700 font-mono">+{(65.0 - scores.total).toFixed(2)}</span> poin untuk naik ke Baik (65,00)
                        </span>
                      ) : (
                        <span>
                          Butuh <span className="font-bold text-rose-700 font-mono">+{(50.0 - scores.total).toFixed(2)}</span> poin untuk mencapai batas Cukup (50,00)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                /* Mode 2: Donut Komposisi Skor Dimensi */
                <div className="space-y-3">
                  <div className="relative mx-auto flex flex-col items-center justify-center">
                    <svg viewBox="0 0 200 160" className="w-full max-w-[210px] overflow-visible">
                      {/* Circumference for r=52 is ~326.72 */}
                      {(() => {
                        const C = 326.72;
                        const sProfil = (scores.profil / 100) * C;
                        const sA = (scores.nilaiA / 100) * C;
                        const sB = (scores.nilaiB / 100) * C;
                        const sC = (scores.nilaiC / 100) * C;
                        const sD = (scores.nilaiD / 100) * C;
                        const sGap = Math.max(0, (1 - scores.total / 100) * C);

                        let offset = 0;
                        const segs = [
                          { val: sProfil, color: "#64748b", label: "Profil" },
                          { val: sA, color: "#395886", label: "A. Perencanaan" },
                          { val: sB, color: "#10b981", label: "B. Implementasi" },
                          { val: sC, color: "#f59e0b", label: "C. Evaluasi" },
                          { val: sD, color: "#06b6d4", label: "D. Transparansi" },
                          { val: sGap, color: "#D5DEEF", label: "Belum Terpenuhi" },
                        ];

                        return (
                          <g transform="rotate(-90 100 80)">
                            {segs.map((seg, idx) => {
                              const currentDashoffset = -offset;
                              offset += seg.val;
                              return (
                                <circle
                                  key={idx}
                                  cx="100"
                                  cy="80"
                                  r="52"
                                  fill="none"
                                  stroke={seg.color}
                                  strokeWidth="15"
                                  strokeDasharray={`${seg.val} ${C - seg.val}`}
                                  strokeDashoffset={currentDashoffset}
                                  className="transition-all duration-500 ease-out"
                                />
                              );
                            })}
                          </g>
                        );
                      })()}

                      {/* Center Content */}
                      <text
                        x="100"
                        y="75"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="font-mono text-2xl font-black fill-slate-900 tracking-tight"
                      >
                        {scores.total.toFixed(2)}
                      </text>
                      <text
                        x="100"
                        y="94"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[10px] font-semibold fill-slate-400 uppercase tracking-wider"
                      >
                        Poin Terpenuhi
                      </text>
                    </svg>
                  </div>

                  {/* Compact Donut Swatches */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-500 flex-shrink-0" />
                      <span className="truncate">Profil: {scores.profil.toFixed(1)}/10</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                      <span className="truncate">A: {scores.nilaiA.toFixed(1)}/20</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="truncate">B: {scores.nilaiB.toFixed(1)}/25</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="truncate">C: {scores.nilaiC.toFixed(1)}/30</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-500 flex-shrink-0" />
                      <span className="truncate">D: {scores.nilaiD.toFixed(1)}/15</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dimension Breakdown - Micro-Ring Cards */}
            <div className="space-y-2.5 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Capaian per Dimensi IKK
                </h3>
                <span className="text-[10px] font-semibold text-slate-400">Total 100 Poin</span>
              </div>

              <div className="space-y-2">
                {[
                  {
                    kode: "Profil",
                    nama: "Profil Keterlibatan JFAK",
                    bobotMaks: 10,
                    nilai: scores.profil,
                    icon: Award,
                    color: "text-slate-700",
                    ringColor: "#475569",
                  },
                  {
                    kode: "A",
                    nama: "Perencanaan Kebijakan",
                    bobotMaks: 20,
                    nilai: scores.nilaiA,
                    icon: Target,
                    color: "text-blue-700",
                    ringColor: "#395886",
                  },
                  {
                    kode: "B",
                    nama: "Implementasi Kebijakan",
                    bobotMaks: 25,
                    nilai: scores.nilaiB,
                    icon: TrendingUp,
                    color: "text-emerald-700",
                    ringColor: "#10b981",
                  },
                  {
                    kode: "C",
                    nama: "Evaluasi & Keberlanjutan",
                    bobotMaks: 30,
                    nilai: scores.nilaiC,
                    icon: CheckCircle2,
                    color: "text-amber-700",
                    ringColor: "#f59e0b",
                  },
                  {
                    kode: "D",
                    nama: "Transparansi & Partisipasi",
                    bobotMaks: 15,
                    nilai: scores.nilaiD,
                    icon: Eye,
                    color: "text-cyan-700",
                    ringColor: "#06b6d4",
                  },
                ].map((dim) => {
                  const Icon = dim.icon;
                  const persen = Math.round((dim.nilai / dim.bobotMaks) * 100);
                  const circ = 75.4; // 2 * PI * 12
                  const offset = circ - (persen / 100) * circ;

                  return (
                    <div
                      key={dim.kode}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md bg-white border border-slate-200 ${dim.color} shadow-2xs`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 line-clamp-1 text-[11px]">
                            {dim.nama}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {dim.nilai.toFixed(2)} / {dim.bobotMaks}.00 poin
                          </div>
                        </div>
                      </div>

                      {/* Micro Progress Ring */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono text-[11px] font-bold text-slate-700">
                          {persen}%
                        </span>
                        <svg className="h-7 w-7 transform -rotate-90" viewBox="0 0 32 32">
                          <circle
                            cx="16"
                            cy="16"
                            r="12"
                            stroke="#D5DEEF"
                            strokeWidth="3"
                            fill="none"
                          />
                          <circle
                            cx="16"
                            cy="16"
                            r="12"
                            stroke={dim.ringColor}
                            strokeWidth="3"
                            fill="none"
                            strokeDasharray={circ}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            className="transition-all duration-500 ease-out"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Evidence Readiness Summary */}
            <div className="border-t border-slate-100 pt-3 text-xs space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Kesiapan Dokumen Bukti
              </div>
              <div className="flex items-center justify-between text-slate-600 text-[11px]">
                <span>Lengkap Berbukti:</span>
                <span className="font-mono font-bold text-emerald-700 tabular-nums">
                  {INSTRUMEN_DATA.filter((q) => {
                    const ans = answers[q.kode];
                    return ans && ans.opsiHuruf && ans.berkas.length > 0;
                  }).length} / {INSTRUMEN_DATA.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 text-[11px]">
                <span>Perlu Bukti Dokumen:</span>
                <span className="font-mono font-bold text-rose-600 tabular-nums">
                  {INSTRUMEN_DATA.filter((q) => {
                    const ans = answers[q.kode];
                    return ans && ans.opsiHuruf && ans.berkas.length === 0;
                  }).length}
                </span>
              </div>
            </div>

            {/* Actions with TanStack Query Integration & RBAC State Machine */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              {/* JIKA PERAN ANALIS */}
              {peran === "ANALIS" && (
                <>
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        disabled={simpanJawabanMutation.isPending}
                        onClick={handleSimpanDraf}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
                      >
                        {simpanJawabanMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        {simpanJawabanMutation.isPending ? "Menyimpan ke Server..." : "Simpan Draf"}
                      </button>

                      <button
                        type="button"
                        disabled={ajukanMutation.isPending}
                        onClick={handleAjukan}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-700 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 transition shadow-xs disabled:opacity-50"
                      >
                        {ajukanMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {ajukanMutation.isPending
                          ? "Memproses Pengajuan..."
                          : statusAsesmen === "PERLU_PERBAIKAN"
                          ? "Ajukan Ulang ke Koordinator"
                          : "Ajukan ke Koordinator"}
                      </button>
                    </>
                  ) : (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-center space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-900">
                        {statusAsesmen === "DIAJUKAN" ? (
                          <>
                            <FileCheck className="h-4 w-4 text-blue-700" />
                            <span>Telah Diajukan ke Koordinator</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4 text-slate-500" />
                            <span>Formulir Terkunci (Read-Only)</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        {statusAsesmen === "DIAJUKAN"
                          ? "Asesmen sedang dalam antrean telaah oleh Koordinator Instansi."
                          : statusAsesmen === "DISETUJUI"
                          ? "Asesmen telah disetujui oleh Koordinator Instansi."
                          : "Asesmen telah ditandai terkirim ke SI IKK LAN."}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* JIKA PERAN KOORDINATOR */}
              {peran === "KOORDINATOR" && (
                <>
                  {statusAsesmen === "DIAJUKAN" && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setIsSetujuiModalOpen(true)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition shadow-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Setujui Asesmen Ini
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsKembalikanModalOpen(true)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition shadow-xs"
                      >
                        <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                        Kembalikan untuk Perbaikan
                      </button>
                    </div>
                  )}

                  {(statusAsesmen === "DISETUJUI" || statusAsesmen === "TERKIRIM_SI_IKK") && (
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-900">
                          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                          <span>Asesmen Telah Disetujui</span>
                        </div>
                        <p className="mt-1 text-[11px] text-emerald-800 leading-relaxed">
                          Kebijakan ini telah selesai disetujui oleh Koordinator Instansi.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsBukaKembaliModalOpen(true)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50/90 py-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition shadow-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                        Tarik Status Persetujuan
                      </button>
                    </div>
                  )}

                  {statusAsesmen === "PERLU_PERBAIKAN" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-900">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                        <span>Menunggu Perbaikan Analis</span>
                      </div>
                      <p className="mt-1 text-[11px] text-amber-800">
                        Asesmen telah dikembalikan ke Analis untuk melengkapi bukti dukung.
                      </p>
                    </div>
                  )}

                  {statusAsesmen === "DRAF" && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Loader2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>Menunggu Pengajuan Analis</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Analis belum mengajukan asesmen ini ke tahap telaah Koordinator.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* JIKA PERAN ADMIN (Superuser Controls) */}
              {peran === "ADMIN" && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 text-center">
                    Kontrol Administrator (Akses Penuh)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={handleSimpanDraf}
                      className="rounded border border-slate-300 bg-white py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Simpan Draf
                    </button>
                    <button
                      type="button"
                      onClick={handleAjukan}
                      className="rounded bg-blue-700 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800"
                    >
                      Ajukan
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSetujuiModalOpen(true)}
                      className="rounded bg-emerald-700 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-800"
                    >
                      Setujui
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsKembalikanModalOpen(true)}
                      className="rounded border border-amber-300 bg-amber-50 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Kembalikan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 0: Konfirmasi Pengajuan ke Koordinator (Analis) */}
      {isAjukanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-xs">
                <Send className="h-6 w-6 ml-0.5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Konfirmasi Pengajuan ke Koordinator
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin mengajukan asesmen kebijakan ini ke Koordinator Instansi untuk ditelaah dan diverifikasi?
                </p>
              </div>
            </div>

            {/* Ringkasan Kebijakan yang diajukan */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 font-medium">Kebijakan:</span>
                <span className="font-bold text-slate-900 text-right">{selectedKebijakan}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">Estimasi Skor Mandiri:</span>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-blue-900">{scores.total.toFixed(2)}</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                    {scores.kualifikasi}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">Kelengkapan Indikator:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 11 dari 11 Indikator Siap & Berbukti
                </span>
              </div>
            </div>

            {/* Catatan / Peringatan Penguncian Formulir */}
            <div className="mt-3.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 flex items-start gap-2.5 text-xs text-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
              <div className="text-[11px] text-amber-900 leading-relaxed">
                <strong>Perhatian:</strong> Setelah diajukan, seluruh formulir isian (pilihan opsi, dokumen bukti dukung, dan penjelasan) akan <strong>dikunci sementara (Read-Only)</strong> selama proses telaah oleh Koordinator Instansi.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAjukanModalOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={ajukanMutation.isPending}
                onClick={handleConfirmAjukan}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition shadow-sm"
              >
                {ajukanMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {ajukanMutation.isPending ? "Mengajukan..." : "Ya, Ajukan Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Kembalikan untuk Perbaikan (Wajib Catatan) */}
      {isKembalikanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Kembalikan Asesmen untuk Perbaikan
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Koordinator wajib memberikan catatan telaah agar Analis Instansi mengetahui indikator mana yang perlu disempurnakan.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Perbaikan / Arahan Telaah <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={4}
                value={inputCatatanKembalikan}
                onChange={(e) => setInputCatatanKembalikan(e.target.value)}
                placeholder="Contoh: Indikator A2 berkas risalah konsultasi publik belum lengkap..."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsKembalikanModalOpen(false);
                  setInputCatatanKembalikan("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!inputCatatanKembalikan.trim() || kembalikanMutation.isPending}
                onClick={handleConfirmKembalikan}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
              >
                {kembalikanMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {kembalikanMutation.isPending ? "Mengembalikan..." : "Kembalikan ke Analis"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Setujui Asesmen */}
      {isSetujuiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Setujui Asesmen Kebijakan
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Apakah Anda yakin seluruh isian 11 indikator dan bukti dukung kebijakan <strong>{selectedKebijakan}</strong> telah memenuhi standar baku IKK dan siap disalin ke SI IKK LAN?
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsSetujuiModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={setujuiMutation.isPending}
                onClick={handleConfirmSetujui}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition"
              >
                {setujuiMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {setujuiMutation.isPending ? "Menyetujui..." : "Ya, Setujui Asesmen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Tarik Status Persetujuan Asesmen (Koordinator) */}
      {isBukaKembaliModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Tarik Status Persetujuan Asesmen
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin menarik status persetujuan untuk kebijakan <strong>{selectedKebijakan}</strong>? Status akan dikembalikan ke <strong>Perlu Perbaikan</strong> agar Analis Instansi dapat melakukan pengisian atau penyempurnaan kembali.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Arahan untuk Analis (Opsional)
              </label>
              <textarea
                rows={3}
                value={inputCatatanBukaKembali}
                onChange={(e) => setInputCatatanBukaKembali(e.target.value)}
                placeholder="Tuliskan arahan perbaikan jika ada (misal: Mohon cek kembali indikator C2...)"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 placeholder:text-slate-400"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsBukaKembaliModalOpen(false);
                  setInputCatatanBukaKembali("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={bukaKembaliMutation.isPending}
                onClick={handleConfirmBukaKembali}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4.5 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition shadow-sm"
              >
                {bukaKembaliMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                {bukaKembaliMutation.isPending ? "Menarik Persetujuan..." : "Ya, Tarik Persetujuan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
