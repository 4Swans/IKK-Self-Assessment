export interface KelompokSatker {
  induk: string;
  namaIndukBersih: string;
  satker: string[];
}

export const DAFTAR_SATKER_GROUPED: KelompokSatker[] = [
  {
    induk: "1. Direktorat Jenderal Infrastruktur Digital",
    namaIndukBersih: "Direktorat Jenderal Infrastruktur Digital",
    satker: [
      "Direktorat Strategi dan Kebijakan Infrastruktur Digital",
      "Direktorat Penataan Spektrum Frekuensi Radio, Orbit Satelit dan Standardisasi Infrastruktur Digital",
      "Direktorat Layanan Infrastruktur Digital",
      "Direktorat Akselerasi Infrastruktur Digital",
      "Direktorat Pengendalian Infrastruktur Digital",
    ],
  },
  {
    induk: "2. Direktorat Jenderal Teknologi Pemerintah Digital",
    namaIndukBersih: "Direktorat Jenderal Teknologi Pemerintah Digital",
    satker: [
      "Direktorat Strategi dan Kebijakan Teknologi Pemerintah Digital",
      "Direktorat Infrastruktur Pemerintah Digital",
      "Direktorat Aplikasi Pemerintah Digital",
      "Direktorat Akselerasi Teknologi Pemerintah Digital Daerah",
    ],
  },
  {
    induk: "3. Direktorat Jenderal Ekosistem Digital",
    namaIndukBersih: "Direktorat Jenderal Ekosistem Digital",
    satker: [
      "Direktorat Pengembangan Ekosistem Digital",
      "Direktorat Kecerdasan Artifisial dan Ekosistem Teknologi Baru",
      "Direktorat Pos dan Penyiaran",
      "Direktorat Layanan Ekosistem Digital",
      "Direktorat Pengendalian Ekosistem Digital",
    ],
  },
  {
    induk: "4. Direktorat Jenderal Pengawasan Ruang Digital",
    namaIndukBersih: "Direktorat Jenderal Pengawasan Ruang Digital",
    satker: [
      "Direktorat Strategi dan Kebijakan Pengawasan Ruang Digital",
      "Direktorat Pengawasan Sertifikasi dan Transaksi Elektronik",
      "Direktorat Penyidikan Digital",
      "Direktorat Pengendalian Ruang Digital",
    ],
  },
  {
    induk: "5. Direktorat Jenderal Komunikasi Publik dan Media",
    namaIndukBersih: "Direktorat Jenderal Komunikasi Publik dan Media",
    satker: [
      "Direktorat Informasi Publik",
      "Direktorat Komunikasi Publik",
      "Direktorat Kemitraan Komunikasi Lembaga dan Kehumasan",
      "Direktorat Ekosistem Media",
    ],
  },
  {
    induk: "6. Badan Pengembangan Sumber Daya Manusia Komunikasi dan Digital",
    namaIndukBersih:
      "Badan Pengembangan Sumber Daya Manusia Komunikasi dan Digital",
    satker: [
      "Pusat Pengembangan Ekosistem Sumber Daya Manusia Komunikasi dan Digital",
      "Pusat Pengembangan Talenta Digital",
      "Pusat Pengembangan Literasi Digital",
      "Pusat Pengembangan Aparatur Komunikasi dan Digital",
    ],
  },
  {
    induk: "Pusat & Unit Kerja Lainnya",
    namaIndukBersih: "Pusat Kebijakan Strategis (PUSAKA)",
    satker: [
      "Pusat Kebijakan Strategis (PUSAKA)",
      "Lainnya (Satker / Balai / UPT Lainnya)",
    ],
  },
];

export const DAFTAR_SATKER_KOMDIGI: string[] = DAFTAR_SATKER_GROUPED.flatMap(
  (group) => group.satker
);

const ALIAS_SATKER_GROUPS: Set<string>[] = [
  new Set([
    "pusat kebijakan strategis",
    "pusat kebijakan strategis (pusaka)",
    "pusat kebijakan dan inovasi",
    "pusat kebijakan dan inovasi (pusaka)",
    "pusaka",
  ]),
  new Set([
    "direktorat jenderal teknologi pemerintah digital",
    "direktorat jenderal aplikasi informatika",
    "direktorat aplikasi pemerintah digital",
  ]),
  new Set([
    "direktorat jenderal ekosistem digital",
    "direktorat jenderal penyelenggaraan pos dan informatika",
    "direktorat pos dan penyiaran",
  ]),
  new Set([
    "direktorat jenderal komunikasi publik dan media",
    "direktorat jenderal informasi dan komunikasi publik",
    "direktorat komunikasi publik",
  ]),
  new Set([
    "direktorat jenderal infrastruktur digital",
    "direktorat jenderal sumber daya dan perangkat pos dan informatika",
  ]),
  new Set([
    "badan pengembangan sumber daya manusia komunikasi dan digital",
    "badan pengembangan sdm komdigi",
    "badan litbang sdm",
  ]),
];

export function cleanSatkerName(name?: string): string {
  if (!name) return "";
  return name
    .replace(/^\d+\.\s*/, "")
    .replace(/\s*\([^)]*\)/g, "")
    .trim()
    .toLowerCase();
}

export function matchSatkerClient(satkerA?: string, satkerB?: string): boolean {
  if (!satkerA || !satkerB) return true;
  const cleanA = cleanSatkerName(satkerA);
  const cleanB = cleanSatkerName(satkerB);
  if (cleanA === cleanB) return true;

  for (const groupAlias of ALIAS_SATKER_GROUPS) {
    if (groupAlias.has(cleanA) && groupAlias.has(cleanB)) {
      return true;
    }
  }

  // Perluas kandidat dengan alias sebelum mengecek hierarki Induk -> Anak
  const expandAliases = (c: string): Set<string> => {
    const res = new Set<string>([c]);
    for (const groupAlias of ALIAS_SATKER_GROUPS) {
      if (groupAlias.has(c)) {
        groupAlias.forEach((item) => res.add(item));
      }
    }
    return res;
  };

  const setA = expandAliases(cleanA);
  const setB = expandAliases(cleanB);

  // Cek apakah salah satu adalah Induk Eselon I (Ditjen / BPSDM) dan yang lain adalah Direktorat/Pusat di bawahnya
  for (const group of DAFTAR_SATKER_GROUPED) {
    const cleanInduk = cleanSatkerName(group.namaIndukBersih);
    const cleanAnakSet = new Set(group.satker.map((s) => cleanSatkerName(s)));
    const aIsInduk = setA.has(cleanInduk);
    const bIsInduk = setB.has(cleanInduk);
    const aIsAnak = Array.from(setA).some((x) => cleanAnakSet.has(x));
    const bIsAnak = Array.from(setB).some((x) => cleanAnakSet.has(x));
    if ((aIsInduk && bIsAnak) || (bIsInduk && aIsAnak)) {
      return true;
    }
  }

  return false;
}
