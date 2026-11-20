import type { Config } from "tailwindcss";

// DESIGN.md §1.1 light tokens (mirrored from mobile tokens when present)
const intell = {
  bg: "#F6F2EA",
  surface: "#FFFFFF",
  text: "#1F2419",
  textMuted: "#5B6152",
  primary: "#3F5B3A",
  onPrimary: "#FFFFFF",
  root: "#6B4A2B",
  branch: "#3F5B3A",
  leaf: "#7A9A3A",
  accent: "#B4632E",
  seed: "#A07D2E",
  water: "#3D6E7A",
  border: "#DDD6C7",
  warning: "#8A5A00",
  danger: "#9B2C2C",
} as const;

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: intell.bg,
        surface: intell.surface,
        text: intell.text,
        textMuted: intell.textMuted,
        root: intell.root,
        branch: intell.branch,
        leaf: intell.leaf,
        seed: intell.seed,
        water: intell.water,
        warning: intell.warning,
        danger: intell.danger,
        background: intell.bg,
        foreground: intell.text,
        card: {
          DEFAULT: intell.surface,
          foreground: intell.text,
        },
        popover: {
          DEFAULT: intell.surface,
          foreground: intell.text,
        },
        primary: {
          DEFAULT: intell.primary,
          foreground: intell.onPrimary,
        },
        secondary: {
          DEFAULT: intell.surface,
          foreground: intell.text,
        },
        muted: {
          DEFAULT: intell.bg,
          foreground: intell.textMuted,
        },
        accent: {
          DEFAULT: intell.accent,
          foreground: intell.onPrimary,
        },
        destructive: {
          DEFAULT: intell.danger,
          foreground: intell.onPrimary,
        },
        border: intell.border,
        input: intell.border,
        ring: intell.primary,
        chart: {
          "1": intell.primary,
          "2": intell.water,
          "3": intell.accent,
          "4": intell.seed,
          "5": intell.leaf,
        },
        sidebar: {
          DEFAULT: intell.surface,
          foreground: intell.text,
          primary: intell.primary,
          "primary-foreground": intell.onPrimary,
          accent: intell.bg,
          "accent-foreground": intell.text,
          border: intell.border,
          ring: intell.primary,
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
