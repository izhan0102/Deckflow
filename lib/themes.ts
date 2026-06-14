export type Theme = {
  id: string;
  name: string;
  bg: string;        // slide background
  fg: string;        // primary text
  accent: string;    // accent / titles / decoration
  muted: string;     // secondary text
  font: "sans" | "serif" | "mono";
};

/**
 * Palette catalog. Every theme uses a light background since presenters
 * project, print, and read on laptops in daylight. Accent colors are picked
 * for legible contrast on each background.
 *
 * Order matters: paginated 8 per page on the theme picker, so the first
 * page is the most universally useful set.
 */
export const PRESET_THEMES: Theme[] = [
  /* ---- Page 1: classic / corporate / safe picks ---- */
  { id: "ivory",       name: "Ivory & Black",      bg: "#FAFAF7", fg: "#0A0A0A", accent: "#0A0A0A", muted: "#525252", font: "serif" },
  { id: "blue-white",  name: "Blue & White",       bg: "#FFFFFF", fg: "#0F172A", accent: "#1D4ED8", muted: "#475569", font: "sans"  },
  { id: "corp-navy",   name: "Corporate Navy",     bg: "#FFFFFF", fg: "#0F172A", accent: "#1E3A8A", muted: "#475569", font: "sans"  },
  { id: "red-white",   name: "Red & White",        bg: "#FFFFFF", fg: "#1A1A1A", accent: "#DC2626", muted: "#52525B", font: "sans"  },
  { id: "green-white", name: "Green & White",      bg: "#FFFFFF", fg: "#0F1F17", accent: "#047857", muted: "#475569", font: "sans"  },
  { id: "teal-white",  name: "Teal & White",       bg: "#FFFFFF", fg: "#0F1F1F", accent: "#0E7490", muted: "#52525B", font: "sans"  },
  { id: "purple-white",name: "Purple & White",     bg: "#FFFFFF", fg: "#1E1B2E", accent: "#7C3AED", muted: "#52525B", font: "sans"  },
  { id: "charcoal",    name: "Charcoal & White",   bg: "#FFFFFF", fg: "#1F2937", accent: "#374151", muted: "#6B7280", font: "sans"  },

  /* ---- Page 2: soft / modern / startup ---- */
  { id: "soft-indigo", name: "Soft Indigo",        bg: "#EEF0FA", fg: "#1E1B4B", accent: "#4338CA", muted: "#6366F1", font: "sans"  },
  { id: "quiet-blue",  name: "Quiet Blue",         bg: "#F1F5F9", fg: "#0F172A", accent: "#334155", muted: "#64748B", font: "sans"  },
  { id: "mint-sage",   name: "Mint Sage",          bg: "#EEF4EF", fg: "#1F2937", accent: "#047857", muted: "#6B7280", font: "sans"  },
  { id: "olive",       name: "Olive",              bg: "#F4F1E8", fg: "#1F2419", accent: "#65754E", muted: "#6E7257", font: "serif" },
  { id: "lavender",    name: "Lavender",           bg: "#F5F3FF", fg: "#2E1065", accent: "#7C3AED", muted: "#6D28D9", font: "sans"  },
  { id: "powder-rose", name: "Powder Rose",        bg: "#FDF2F4", fg: "#3F1224", accent: "#BE123C", muted: "#9F1239", font: "sans"  },
  { id: "sky",         name: "Sky",                bg: "#F0F9FF", fg: "#0C4A6E", accent: "#0284C7", muted: "#0369A1", font: "sans"  },
  { id: "fog",         name: "Fog",                bg: "#F8FAFC", fg: "#0F172A", accent: "#0369A1", muted: "#475569", font: "sans"  },

  /* ---- Page 3: warm / editorial / creative ---- */
  { id: "sand",        name: "Sand & Ink",         bg: "#F4ECD8", fg: "#1B1B1B", accent: "#A0522D", muted: "#5C4A3A", font: "serif" },
  { id: "clay-cream",  name: "Clay & Cream",       bg: "#FAF3E7", fg: "#27201A", accent: "#B5572C", muted: "#7C6757", font: "sans"  },
  { id: "burgundy",    name: "Burgundy & Cream",   bg: "#FAF7F2", fg: "#26161B", accent: "#7F1D1D", muted: "#6B5454", font: "serif" },
  { id: "mustard",     name: "Mustard",            bg: "#FAF6E8", fg: "#1F1B0E", accent: "#B45309", muted: "#78716C", font: "serif" },
  { id: "slate-coral", name: "Slate & Coral",      bg: "#F4F4F5", fg: "#18181B", accent: "#E55A4D", muted: "#52525B", font: "sans"  },
  { id: "rose-gold",   name: "Rose Gold",          bg: "#FFF7F2", fg: "#1F1410", accent: "#C2410C", muted: "#9A3412", font: "serif" },
  { id: "forest-cream",name: "Forest & Cream",     bg: "#F5F1E6", fg: "#16241C", accent: "#14532D", muted: "#3F4B43", font: "serif" },
  { id: "ocean-deep",  name: "Ocean & Pearl",      bg: "#F0F4F7", fg: "#0B1F2A", accent: "#155E75", muted: "#475569", font: "sans"  },

  /* ---- Page 4: bold / saturated solids (the "actually colorful" set) ---- */
  // Saturated backgrounds with white text + a bright contrasting accent.
  // These are for decks where the brand IS the color: keynote-style hero decks.
  { id: "royal-indigo", name: "Royal Indigo",      bg: "#3F3DBD", fg: "#FFFFFF", accent: "#FBBF24", muted: "#C7D2FE", font: "sans"  },
  { id: "cobalt",       name: "Cobalt Solid",      bg: "#1E40AF", fg: "#FFFFFF", accent: "#FB923C", muted: "#BFDBFE", font: "sans"  },
  { id: "crimson",      name: "Crimson Solid",     bg: "#9F1239", fg: "#FFFFFF", accent: "#FCD34D", muted: "#FCA5A5", font: "sans"  },
  { id: "emerald",      name: "Emerald Solid",     bg: "#047857", fg: "#FFFFFF", accent: "#FCD34D", muted: "#A7F3D0", font: "sans"  },
  { id: "tangerine",    name: "Tangerine",         bg: "#C2410C", fg: "#FFFFFF", accent: "#FDE68A", muted: "#FDBA74", font: "sans"  },
  { id: "plum",         name: "Plum",              bg: "#6D28D9", fg: "#FFFFFF", accent: "#F472B6", muted: "#DDD6FE", font: "sans"  },
  { id: "slate-bold",   name: "Slate Bold",        bg: "#1F2937", fg: "#FFFFFF", accent: "#F59E0B", muted: "#9CA3AF", font: "sans"  },
  { id: "coral-solid",  name: "Coral Solid",       bg: "#E55A4D", fg: "#FFFFFF", accent: "#1F2937", muted: "#FECACA", font: "sans"  },
  // Pure obsidian — true black canvas with violet accent. Used by the
  // "Obsidian Edge" template; useful on its own for engineering /
  // security / deep-tech decks.
  { id: "obsidian",     name: "Obsidian",          bg: "#0A0A0F", fg: "#FAFAFA", accent: "#A78BFA", muted: "#A1A1AA", font: "sans"  },
  // New — soft sage greens with a deep-sage muted (so subtitles stay
  // readable on cream). The blush + gold notes only live inside the
  // "Soft sage blobs" graphic; they're not piped through theme.muted.
  // Backs the "Sage & Blush" template card on the gallery's first page.
  { id: "sage-blush",   name: "Sage & Blush",      bg: "#FAF7F2", fg: "#2F3A2A", accent: "#7B8C6F", muted: "#5C6B53", font: "serif" },

  /* ---- Page 5: premium template palettes (Canva/Gamma-grade) ---- */
  // Two deep, two soft, one luxe — each tuned so body text stays crisp on
  // the textured backgrounds the matching graphics paint at low opacity.
  { id: "aurora-night",  name: "Aurora Night",      bg: "#0E1124", fg: "#F4F6FF", accent: "#7DD3FC", muted: "#A6B0D6", font: "sans"  },
  { id: "peach-cream",   name: "Peach Cream",       bg: "#FFF3EA", fg: "#2A1A12", accent: "#E2674A", muted: "#8A6F60", font: "serif" },
  { id: "deep-teal",     name: "Deep Teal",         bg: "#0C2A2B", fg: "#EAF6F3", accent: "#5EEAD4", muted: "#8FBDB6", font: "sans"  },
  { id: "lilac-mist",    name: "Lilac Mist",        bg: "#F4F0FB", fg: "#2B2440", accent: "#8B5CF6", muted: "#6D5E94", font: "sans"  },
  { id: "graphite-gold", name: "Graphite Gold",     bg: "#15161C", fg: "#F7F4EC", accent: "#D8B26A", muted: "#A8A39A", font: "serif" },
  // Soft lavender canvas for the playful "Concept Map" template — the
  // rainbow numbered cards (concept-cards bullets variant) supply the color.
  { id: "bright-ideas",  name: "Bright Ideas",      bg: "#F3F1FB", fg: "#22252E", accent: "#8B5CF6", muted: "#6B7280", font: "sans"  },

  /* ---- Page 6: reference-built title palettes ---- */
  { id: "blush-grain",   name: "Blush Grain",       bg: "#FAF7F5", fg: "#121212", accent: "#E2503A", muted: "#6B6B6B", font: "sans"  },
  { id: "ink-paper",     name: "Ink & Paper",       bg: "#F1EFEA", fg: "#1A1A1A", accent: "#1A1A1A", muted: "#555555", font: "serif" },
  { id: "cream-noir",    name: "Cream Noir",        bg: "#F2EFE2", fg: "#14130F", accent: "#1A1814", muted: "#6B6655", font: "serif" },
  { id: "crimson-blocks",name: "Crimson Blocks",    bg: "#FFFFFF", fg: "#141414", accent: "#9E1B1B", muted: "#6B6B6B", font: "sans"  },
  { id: "navy-serif",    name: "Navy Serif",        bg: "#F4F5F3", fg: "#163A52", accent: "#1C496B", muted: "#5C7A8C", font: "serif" },
];

export function getTheme(id: string): Theme | undefined {
  return PRESET_THEMES.find((t) => t.id === id);
}
