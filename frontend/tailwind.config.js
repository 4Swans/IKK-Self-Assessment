// Palet identitas: #F0F3FA, #D5DEEF, #B1C9EF, #8AAEE0, #638ECB, #395886.
// Langkah 400, 600, dan 800–950 diinterpolasi agar kelas blue-* yang ada tetap kontras.
const brand = {
  50: "#F0F3FA",
  100: "#D5DEEF",
  200: "#B1C9EF",
  300: "#8AAEE0",
  400: "#779ED6",
  500: "#628ECB",
  600: "#4E73A9",
  700: "#395886",
  800: "#2E486F",
  900: "#223652",
  950: "#152234",
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand,
        blue: brand,
        indigo: brand,
        slate: {
          50: "#F0F3FA",
          100: "#E6EDF8",
          200: "#D5DEEF",
          300: "#B9CBE7",
          400: "#8AAEE0",
          500: "#628ECB",
          600: "#4E73A9",
          700: "#395886",
          800: "#2E486F",
          900: "#1E304B",
          950: "#121D2E",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      boxShadow: {
        'palette-sm': '0 2px 8px -1px rgba(57, 88, 134, 0.08), 0 1px 3px -1px rgba(57, 88, 134, 0.05)',
        'palette-md': '0 8px 24px -4px rgba(57, 88, 134, 0.12), 0 2px 6px -2px rgba(57, 88, 134, 0.06)',
        'palette-lg': '0 16px 36px -6px rgba(57, 88, 134, 0.18), 0 4px 12px -2px rgba(57, 88, 134, 0.08)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
