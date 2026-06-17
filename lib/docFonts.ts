/**
 * Document fonts — 30+ professional Google Fonts for the document maker.
 * Loaded on demand via a single Google Fonts <link>.
 */

export type DocFont = {
  id: string;
  name: string;
  /** CSS font-family stack. */
  family: string;
  /** Google Fonts family name (for the css2 API). */
  google: string;
  category: "sans" | "serif" | "slab" | "mono";
};

export const DOC_FONTS: DocFont[] = [
  // Sans
  { id: "inter", name: "Inter", family: `"Inter", system-ui, sans-serif`, google: "Inter", category: "sans" },
  { id: "roboto", name: "Roboto", family: `"Roboto", sans-serif`, google: "Roboto", category: "sans" },
  { id: "open-sans", name: "Open Sans", family: `"Open Sans", sans-serif`, google: "Open Sans", category: "sans" },
  { id: "lato", name: "Lato", family: `"Lato", sans-serif`, google: "Lato", category: "sans" },
  { id: "montserrat", name: "Montserrat", family: `"Montserrat", sans-serif`, google: "Montserrat", category: "sans" },
  { id: "poppins", name: "Poppins", family: `"Poppins", sans-serif`, google: "Poppins", category: "sans" },
  { id: "source-sans", name: "Source Sans 3", family: `"Source Sans 3", sans-serif`, google: "Source Sans 3", category: "sans" },
  { id: "nunito", name: "Nunito", family: `"Nunito", sans-serif`, google: "Nunito", category: "sans" },
  { id: "work-sans", name: "Work Sans", family: `"Work Sans", sans-serif`, google: "Work Sans", category: "sans" },
  { id: "raleway", name: "Raleway", family: `"Raleway", sans-serif`, google: "Raleway", category: "sans" },
  { id: "dm-sans", name: "DM Sans", family: `"DM Sans", sans-serif`, google: "DM Sans", category: "sans" },
  { id: "manrope", name: "Manrope", family: `"Manrope", sans-serif`, google: "Manrope", category: "sans" },
  { id: "karla", name: "Karla", family: `"Karla", sans-serif`, google: "Karla", category: "sans" },
  { id: "mulish", name: "Mulish", family: `"Mulish", sans-serif`, google: "Mulish", category: "sans" },
  { id: "rubik", name: "Rubik", family: `"Rubik", sans-serif`, google: "Rubik", category: "sans" },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", family: `"IBM Plex Sans", sans-serif`, google: "IBM Plex Sans", category: "sans" },
  // Serif
  { id: "merriweather", name: "Merriweather", family: `"Merriweather", serif`, google: "Merriweather", category: "serif" },
  { id: "lora", name: "Lora", family: `"Lora", serif`, google: "Lora", category: "serif" },
  { id: "playfair", name: "Playfair Display", family: `"Playfair Display", serif`, google: "Playfair Display", category: "serif" },
  { id: "pt-serif", name: "PT Serif", family: `"PT Serif", serif`, google: "PT Serif", category: "serif" },
  { id: "source-serif", name: "Source Serif 4", family: `"Source Serif 4", serif`, google: "Source Serif 4", category: "serif" },
  { id: "libre-baskerville", name: "Libre Baskerville", family: `"Libre Baskerville", serif`, google: "Libre Baskerville", category: "serif" },
  { id: "eb-garamond", name: "EB Garamond", family: `"EB Garamond", serif`, google: "EB Garamond", category: "serif" },
  { id: "crimson", name: "Crimson Text", family: `"Crimson Text", serif`, google: "Crimson Text", category: "serif" },
  { id: "cormorant", name: "Cormorant Garamond", family: `"Cormorant Garamond", serif`, google: "Cormorant Garamond", category: "serif" },
  { id: "spectral", name: "Spectral", family: `"Spectral", serif`, google: "Spectral", category: "serif" },
  { id: "ibm-plex-serif", name: "IBM Plex Serif", family: `"IBM Plex Serif", serif`, google: "IBM Plex Serif", category: "serif" },
  // Slab
  { id: "roboto-slab", name: "Roboto Slab", family: `"Roboto Slab", serif`, google: "Roboto Slab", category: "slab" },
  { id: "bitter", name: "Bitter", family: `"Bitter", serif`, google: "Bitter", category: "slab" },
  { id: "arvo", name: "Arvo", family: `"Arvo", serif`, google: "Arvo", category: "slab" },
  { id: "domine", name: "Domine", family: `"Domine", serif`, google: "Domine", category: "slab" },
  { id: "zilla", name: "Zilla Slab", family: `"Zilla Slab", serif`, google: "Zilla Slab", category: "slab" },
  // Mono
  { id: "ibm-plex-mono", name: "IBM Plex Mono", family: `"IBM Plex Mono", monospace`, google: "IBM Plex Mono", category: "mono" },
  { id: "jetbrains", name: "JetBrains Mono", family: `"JetBrains Mono", monospace`, google: "JetBrains Mono", category: "mono" },
];

export function getDocFont(id?: string): DocFont {
  return DOC_FONTS.find((f) => f.id === id) || DOC_FONTS[0];
}

/** Inject (once) a Google Fonts stylesheet for the given font ids. */
export function loadDocFonts(ids: string[]) {
  if (typeof document === "undefined") return;
  const fams = Array.from(new Set(ids.filter(Boolean).map((id) => getDocFont(id).google)));
  for (const fam of fams) {
    const key = `docfont-${fam.replace(/\s+/g, "-")}`;
    if (document.getElementById(key)) continue;
    const link = document.createElement("link");
    link.id = key;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam)}:ital,wght@0,400;0,600;0,700;1,400&display=swap`;
    document.head.appendChild(link);
  }
}
