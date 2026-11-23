/**
 * Design tokens (MOBILE_HOME_STANDARDS). Components read these names.
 * Map style JSON repeats the §3A washes because Google styles are data files.
 */
export const tokens = {
  day: {
    bg: "#F7F0E5",
    surface: "#FFFDF9",
    text: "#1B2A33",
    textMuted: "#55636B",
    border: "#E2D8C8",
    primary: "#295E7C",
    onPrimary: "#FFFFFF",
    chip: "#FFFFFF",
    chipBorder: "#1B2A33",
    groveFill: "rgba(255,255,255,0.5)",
    outline: "#1B2A33",
    web: "#1B2A33",
    accent: "#4D654E",
    shadow: "#1B2A33",
  },
  night: {
    bg: "#10171C",
    surface: "#18222A",
    text: "#EDE6DA",
    textMuted: "#A7B0B5",
    border: "#2A3640",
    primary: "#7FB3CF",
    onPrimary: "#10171C",
    chip: "#163447",
    chipBorder: "rgba(255,255,255,0.85)",
    groveFill: "rgba(43,93,123,0.5)",
    outline: "#FFFFFF",
    web: "#FFFFFF",
    accent: "#8FAE91",
    shadow: "#000000",
  },
  marker: {
    day: {
      ring: "#1B2A33",
      center: "#FFFFFF",
      lockedRing: "#B0B4B8",
      /** Root brick — every unexplored pulse (§5.3). */
      pulse: "#763329",
      root: "#763329",
      branch: "#B06511",
      leaf: "#DBAA5A",
      changed: "#4D654E",
    },
    night: {
      ring: "#FFFFFF",
      center: "#163447",
      lockedRing: "#687B87",
      pulse: "#B9574A",
      root: "#B9574A",
      branch: "#E3953F",
      leaf: "#F6E0AE",
      changed: "#8FAE91",
    },
  },
} as const;

export type MapThemeName = "day" | "night";
