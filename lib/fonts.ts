/**
 * Curated typography choices for presentations. Each entry references a
 * Google Font (or system family) and the css `font-family` stack we use
 * when rendering. The themes' built-in `font` field stays as a fallback
 * for decks without an explicit choice.
 *
 * Fonts are loaded once via the root layout's <link> to fonts.googleapis.
 */

export type FontPreset = {
  id: string;
  name: string;
  /** css `font-family` value applied to all slide text. */
  family: string;
  /** "sans" | "serif" | "mono" — drives a few small renderer choices. */
  category: "sans" | "serif" | "mono" | "display";
  /** Short tagline shown in the picker. */
  tagline: string;
  /** Friendly weight name for the preview. */
  preview: string;
};

export const FONT_PRESETS: FontPreset[] = [
  /* sans */
  { id: "inter",         name: "Inter",         family: `"Inter", ui-sans-serif, system-ui, sans-serif`,         category: "sans",    tagline: "Modern · neutral · safe default",    preview: "The future is already here." },
  { id: "manrope",       name: "Manrope",       family: `"Manrope", ui-sans-serif, system-ui, sans-serif`,        category: "sans",    tagline: "Geometric · friendly",                preview: "Pitch decks that feel calm." },
  { id: "dm-sans",       name: "DM Sans",       family: `"DM Sans", ui-sans-serif, system-ui, sans-serif`,        category: "sans",    tagline: "Clean · low-contrast",                preview: "Numbers, narrative, results." },
  { id: "work-sans",     name: "Work Sans",     family: `"Work Sans", ui-sans-serif, system-ui, sans-serif`,      category: "sans",    tagline: "Workhorse · readable",                preview: "Clarity above cleverness." },
  { id: "plus-jakarta",  name: "Plus Jakarta",  family: `"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`, category: "sans", tagline: "Soft · startup",                      preview: "Make complex feel simple." },
  { id: "outfit",        name: "Outfit",        family: `"Outfit", ui-sans-serif, system-ui, sans-serif`,         category: "sans",    tagline: "Geometric · modern",                  preview: "Designed to be presented." },
  { id: "space-grotesk", name: "Space Grotesk", family: `"Space Grotesk", ui-sans-serif, system-ui, sans-serif`,  category: "sans",    tagline: "Tech · monospace-leaning",            preview: "Built for the next era." },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", family: `"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif`,  category: "sans",    tagline: "Engineered · corporate",              preview: "Boardrooms and beyond." },
  { id: "figtree",       name: "Figtree",       family: `"Figtree", ui-sans-serif, system-ui, sans-serif`,        category: "sans",    tagline: "Friendly · approachable",             preview: "Presentations made human." },

  /* serif */
  { id: "playfair",      name: "Playfair Display", family: `"Playfair Display", Georgia, serif`,                  category: "serif",   tagline: "Elegant · editorial",                 preview: "A magazine on every slide." },
  { id: "lora",          name: "Lora",             family: `"Lora", Georgia, serif`,                              category: "serif",   tagline: "Readable · contemporary serif",       preview: "Read it, remember it." },
  { id: "merriweather",  name: "Merriweather",     family: `"Merriweather", Georgia, serif`,                      category: "serif",   tagline: "Authoritative · publication",         preview: "The story behind the numbers." },
  { id: "fraunces",      name: "Fraunces",         family: `"Fraunces", Georgia, serif`,                          category: "serif",   tagline: "Expressive · bold serif",             preview: "Brand-forward by default." },
  { id: "source-serif",  name: "Source Serif",     family: `"Source Serif Pro", Georgia, serif`,                  category: "serif",   tagline: "Editorial · neutral",                 preview: "Quietly confident." },

  /* display / mono */
  { id: "bricolage",     name: "Bricolage Grotesque", family: `"Bricolage Grotesque", ui-sans-serif, sans-serif`, category: "display", tagline: "Eccentric · keynote",                 preview: "Unforgettable openings." },
  { id: "syne",          name: "Syne",                family: `"Syne", ui-sans-serif, sans-serif`,               category: "display", tagline: "Bold · distinctive",                  preview: "Make something memorable." },
  { id: "archivo",       name: "Archivo",             family: `"Archivo", ui-sans-serif, sans-serif`,            category: "sans",    tagline: "Wide · branded",                      preview: "Big idea, bigger letters." },
  { id: "jetbrains",     name: "JetBrains Mono",      family: `"JetBrains Mono", Consolas, monospace`,           category: "mono",    tagline: "Code · technical decks",              preview: "function present() { return wow; }" },

  /* most-used PowerPoint / Google staples */
  { id: "roboto",        name: "Roboto",              family: `"Roboto", ui-sans-serif, system-ui, sans-serif`,  category: "sans",    tagline: "Ubiquitous · neutral",                preview: "The default that just works." },
  { id: "open-sans",     name: "Open Sans",           family: `"Open Sans", ui-sans-serif, system-ui, sans-serif`, category: "sans",  tagline: "Humanist · highly readable",          preview: "Read easily from the back row." },
  { id: "lato",          name: "Lato",                family: `"Lato", ui-sans-serif, system-ui, sans-serif`,    category: "sans",    tagline: "Warm · corporate",                    preview: "Professional and approachable." },
  { id: "montserrat",    name: "Montserrat",          family: `"Montserrat", ui-sans-serif, system-ui, sans-serif`, category: "sans", tagline: "Geometric · popular",                 preview: "A poster on every slide." },
  { id: "poppins",       name: "Poppins",             family: `"Poppins", ui-sans-serif, system-ui, sans-serif`, category: "sans",    tagline: "Rounded · trendy",                    preview: "Friendly, bold, current." },
  { id: "raleway",       name: "Raleway",             family: `"Raleway", ui-sans-serif, system-ui, sans-serif`, category: "sans",    tagline: "Elegant · thin",                      preview: "Refined and minimal." },
  { id: "nunito",        name: "Nunito",              family: `"Nunito", ui-sans-serif, system-ui, sans-serif`,  category: "sans",    tagline: "Soft · rounded",                      preview: "Gentle on the eyes." },
  { id: "pt-sans",       name: "PT Sans",             family: `"PT Sans", ui-sans-serif, system-ui, sans-serif`, category: "sans",    tagline: "Neutral · classic",                   preview: "Clean and dependable." },
  { id: "oswald",        name: "Oswald",              family: `"Oswald", ui-sans-serif, system-ui, sans-serif`,  category: "display", tagline: "Condensed · impactful",               preview: "HEADLINES THAT HIT." },
  { id: "roboto-slab",   name: "Roboto Slab",         family: `"Roboto Slab", Georgia, serif`,                   category: "serif",   tagline: "Slab · sturdy",                       preview: "Solid, grounded, confident." },
];

export function getFont(id?: string): FontPreset | undefined {
  return FONT_PRESETS.find((f) => f.id === id);
}

/** Resolve the css font-family for a deck. */
export function resolveFontFamily(fontId?: string, fallback?: string): string {
  const f = getFont(fontId);
  if (f) return f.family;
  return fallback || `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
}
