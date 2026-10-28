import { useMemo } from "react";

export interface RadarDimensiProps {
  instansiName?: string;
  perencanaanScore: number; // 0 - 100
  implementasiScore: number; // 0 - 100
  evaluasiScore: number; // 0 - 100
  transparansiScore: number; // 0 - 100
  jfakScore?: number; // 0 - 100 (default 90 atau 100)
  totalScore?: number; // 0 - 100
  className?: string;
  showCardWrapper?: boolean;
}

export function RadarDimensiIKK({
  instansiName = "Xaka",
  perencanaanScore,
  implementasiScore,
  evaluasiScore,
  transparansiScore,
  jfakScore = 90.0,
  totalScore,
  className = "",
  showCardWrapper = true,
}: RadarDimensiProps) {
  // If totalScore is not provided, calculate using standard IKK weights:
  // JFAK (10%), Perencanaan (20%), Implementasi (25%), Evaluasi (30%), Transparansi (15%)
  const calculatedTotal = useMemo(() => {
    if (typeof totalScore === "number") return totalScore;
    return (
      (jfakScore * 0.10) +
      (perencanaanScore * 0.20) +
      (implementasiScore * 0.25) +
      (evaluasiScore * 0.30) +
      (transparansiScore * 0.15)
    );
  }, [totalScore, jfakScore, perencanaanScore, implementasiScore, evaluasiScore, transparansiScore]);

  // Determine qualification badge
  const kualifikasi = useMemo(() => {
    if (calculatedTotal >= 91.0) return { label: "Unggul", bg: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    if (calculatedTotal >= 80.0) return { label: "Sangat Baik", bg: "bg-blue-100 text-blue-800 border-blue-300" };
    if (calculatedTotal >= 65.0) return { label: "Baik", bg: "bg-cyan-100 text-cyan-800 border-cyan-300" };
    if (calculatedTotal >= 50.0) return { label: "Cukup", bg: "bg-amber-100 text-amber-800 border-amber-300" };
    return { label: "Kurang", bg: "bg-rose-100 text-rose-800 border-rose-300" };
  }, [calculatedTotal]);

  // Pentagon Geometry Setup
  const cx = 175;
  const cy = 135;
  const R = 85;

  // 5 Axes in Clockwise order:
  // 0: Top -> A. Perencanaan
  // 1: Top-Right -> B. Implementasi
  // 2: Bottom-Right -> C. Evaluasi
  // 3: Bottom-Left -> D. Transparansi
  // 4: Top-Left -> JFAK
  const axes = useMemo(() => [
    { label: "A. Perencanaan", score: Math.min(Math.max(perencanaanScore, 0), 100), key: "a" },
    { label: "B. Implementasi", score: Math.min(Math.max(implementasiScore, 0), 100), key: "b" },
    { label: "C. Evaluasi", score: Math.min(Math.max(evaluasiScore, 0), 100), key: "c" },
    { label: "D. Transparansi", score: Math.min(Math.max(transparansiScore, 0), 100), key: "d" },
    { label: "JFAK", score: Math.min(Math.max(jfakScore, 0), 100), key: "jfak" },
  ], [perencanaanScore, implementasiScore, evaluasiScore, transparansiScore, jfakScore]);

  // Helper to compute coordinates
  const getCoordinates = (index: number, radius: number) => {
    const angle = -Math.PI / 2 + index * ((2 * Math.PI) / 5);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return { x, y, angle };
  };

  // Concentric pentagons levels (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Coordinates for the Main Policy (Instansi) polygon
  const instansiPoints = useMemo(() => {
    return axes
      .map((item, i) => {
        const radius = (item.score / 100) * R;
        const { x, y } = getCoordinates(i, radius);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [axes]);

  const content = (
    <div className={`space-y-4 ${className}`}>
      {/* Card Header with Icon and Policy/Institution Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Target / Radar Icon */}
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F3FA] text-[#395886] border border-[#B1C9EF]">
            <svg
              className="h-4.5 w-4.5 stroke-[2]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" strokeDasharray="2 2" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-[#1E304B] leading-tight">
            Radar Dimensi Kebijakan IKK
          </h3>
        </div>

        {/* Institution Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#B1C9EF] bg-[#F0F3FA] px-2.5 py-0.5 text-xs font-bold text-[#395886] shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-[#628ECB]" />
          <span>{instansiName}</span>
        </div>
      </div>

      {/* Pentagon Radar Chart SVG */}
      <div className="relative mx-auto flex items-center justify-center overflow-visible">
        <svg
          viewBox="0 0 350 270"
          className="w-full max-w-[340px] overflow-visible select-none"
        >
          {/* 1. Background Grid Concentric Pentagons */}
          {gridLevels.map((lvl) => {
            const points = [0, 1, 2, 3, 4]
              .map((i) => {
                const { x, y } = getCoordinates(i, R * lvl);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ");
            return (
              <polygon
                key={lvl}
                points={points}
                fill="none"
                stroke={lvl === 1.0 ? "#8AAEE0" : "#D5DEEF"}
                strokeWidth={lvl === 1.0 ? "1.5" : "1"}
              />
            );
          })}

          {/* 2. Dotted Radial Spokes from Center to Vertices */}
          {[0, 1, 2, 3, 4].map((i) => {
            const { x, y } = getCoordinates(i, R);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="#B1C9EF"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* 3. Main Policy (Instansi) Area & Perimeter */}
          <polygon
            points={instansiPoints}
            fill="#628ECB"
            fillOpacity="0.22"
            stroke="#395886"
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="transition-all duration-700 ease-out"
          />

          {/* 4. Vertex Points in #395886 with #F0F3FA ring */}
          {axes.map((item, i) => {
            const radius = (item.score / 100) * R;
            const { x, y } = getCoordinates(i, radius);
            return (
              <g key={item.key} className="transition-all duration-700 ease-out">
                <circle
                  cx={x}
                  cy={y}
                  r="4.5"
                  fill="#395886"
                  stroke="#F0F3FA"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* 5. Text Labels around the 5 Vertices */}
          {axes.map((item, i) => {
            const { x, y } = getCoordinates(i, R);
            let textAnchor: "middle" | "start" | "end" = "middle";
            let dx = 0;
            let dy = 0;

            if (i === 0) {
              textAnchor = "middle";
              dy = -12;
            } else if (i === 1) {
              textAnchor = "start";
              dx = 10;
              dy = 2;
            } else if (i === 2) {
              textAnchor = "start";
              dx = 8;
              dy = 14;
            } else if (i === 3) {
              textAnchor = "end";
              dx = -8;
              dy = 14;
            } else if (i === 4) {
              textAnchor = "end";
              dx = -10;
              dy = 2;
            }

            return (
              <text
                key={item.key}
                x={x + dx}
                y={y + dy}
                textAnchor={textAnchor}
                className="fill-[#1E304B] text-[11px] font-bold tracking-tight"
              >
                {item.label} ({item.score.toFixed(1)})
              </text>
            );
          })}
        </svg>
      </div>

      {/* Clean Score Card at Bottom */}
      <div className="rounded-xl border border-[#D5DEEF] bg-[#F0F3FA]/70 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-[#1E304B]">Nilai Akhir IKK Kebijakan:</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              Skala 0 – 100 Poin
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-extrabold text-[#395886] tabular-nums">
              {calculatedTotal.toFixed(2)}
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${kualifikasi.bg}`}
            >
              {kualifikasi.label}
            </span>
          </div>
        </div>

        {/* Progress Bar Nilai Instansi with Brand Gradient */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#D5DEEF]">
          <div
            style={{ width: `${Math.min(calculatedTotal, 100)}%` }}
            className="h-full rounded-full bg-gradient-to-r from-[#628ECB] to-[#395886] transition-all duration-500"
          />
        </div>
      </div>
    </div>
  );

  if (showCardWrapper) {
    return (
      <div className="rounded-2xl border border-[#D5DEEF] bg-white/95 p-5 shadow-palette-sm backdrop-blur-xs">
        {content}
      </div>
    );
  }

  return content;
}
