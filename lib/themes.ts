export type Theme = {
  id: string;
  name: string;
  bg: string;        // slide background
  fg: string;        // primary text
  accent: string;    // accent / titles
  muted: string;     // secondary text
  font: "sans" | "serif" | "mono";
};

export const PRESET_THEMES: Theme[] = [
  { id: "midnight",  name: "Midnight",         bg: "#0B0B0F", fg: "#FAFAFA", accent: "#7C5CFF", muted: "#A1A1AA", font: "sans"  },
  { id: "ivory",     name: "Ivory & Black",    bg: "#FAFAF7", fg: "#0A0A0A", accent: "#0A0A0A", muted: "#525252", font: "serif" },
  { id: "crimson",   name: "Crimson & White",  bg: "#FFFFFF", fg: "#1A1A1A", accent: "#DC2626", muted: "#6B7280", font: "sans"  },
  { id: "forest",    name: "Red & Forest",     bg: "#0F1F17", fg: "#F5F5F4", accent: "#EF4444", muted: "#A8B5AE", font: "sans"  },
  { id: "ocean",     name: "Ocean Deep",       bg: "#06283D", fg: "#EAF6FF", accent: "#47B5FF", muted: "#9DB7CC", font: "sans"  },
  { id: "sand",      name: "Sand & Ink",       bg: "#F4ECD8", fg: "#1B1B1B", accent: "#A0522D", muted: "#5C4A3A", font: "serif" },
  { id: "neon",      name: "Neon Mono",        bg: "#000000", fg: "#FFFFFF", accent: "#00FF94", muted: "#888888", font: "mono"  },
  { id: "rose",      name: "Rose Quartz",      bg: "#FFF1F2", fg: "#1F1F1F", accent: "#E11D48", muted: "#737373", font: "sans"  },
];

export function getTheme(id: string): Theme | undefined {
  return PRESET_THEMES.find((t) => t.id === id);
}
