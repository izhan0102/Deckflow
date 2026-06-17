/**
 * Resume TEMPLATES — distinct visual layouts (not just color themes).
 * Each maps to a renderer in ResumeCanvas. `hasPhoto` decides whether the
 * form asks the user to upload a photo.
 */
export type ResumeLayout = "compact" | "classic" | "sidebar" | "modern" | "minimal" | "professional";

export type ResumeTemplate = {
  id: string;
  name: string;
  blurb: string;
  layout: ResumeLayout;
  hasPhoto: boolean;
  accent: string;
  fontId: string;
  headingFontId: string;
};

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: "compact", name: "Compact (Default)", blurb: "Dense one-pager — auto-fits everything tight & small",
    layout: "compact", hasPhoto: false, accent: "#111827", fontId: "inter", headingFontId: "inter",
  },
  {
    id: "classic", name: "Classic", blurb: "Centered name, clean single column",
    layout: "classic", hasPhoto: false, accent: "#0f766e", fontId: "source-serif", headingFontId: "playfair",
  },
  {
    id: "sidebar", name: "Sidebar", blurb: "Colored sidebar with photo, contact & skills",
    layout: "sidebar", hasPhoto: true, accent: "#1f6f63", fontId: "dm-sans", headingFontId: "poppins",
  },
  {
    id: "modern", name: "Modern", blurb: "Bold accent header, two-column body",
    layout: "modern", hasPhoto: true, accent: "#dc2626", fontId: "work-sans", headingFontId: "montserrat",
  },
  {
    id: "professional", name: "Professional", blurb: "Photo header, corporate blue, structured",
    layout: "professional", hasPhoto: true, accent: "#1d4ed8", fontId: "inter", headingFontId: "poppins",
  },
  {
    id: "minimal", name: "Minimal", blurb: "Black & white, lots of whitespace",
    layout: "minimal", hasPhoto: false, accent: "#111111", fontId: "inter", headingFontId: "inter",
  },
];

export function getResumeTemplate(id: string): ResumeTemplate {
  return RESUME_TEMPLATES.find((t) => t.id === id) || RESUME_TEMPLATES[0];
}
