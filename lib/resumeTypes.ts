/**
 * EXdeck Resume — data model for the (free) AI-assisted resume maker.
 *
 * A resume is one typed object rendered onto an A4 page through a chosen
 * TEMPLATE (a distinct visual layout, not just a theme). Everything is
 * editable via the form; the canvas is a live preview.
 */
import { A4 } from "./docTypes";

export { A4 };

export type ResumeExperience = {
  id: string;
  role: string;
  company: string;
  location?: string;
  start?: string;
  end?: string;
  current?: boolean;
  bullets: string[];
};

export type ResumeEducation = {
  id: string;
  degree: string;
  school: string;
  location?: string;
  start?: string;
  end?: string;
  details?: string;
};

export type ResumeLanguage = { id: string; name: string; level?: string };
export type ResumeCertification = { id: string; name: string; issuer?: string; year?: string };
export type ResumeProject = { id: string; name: string; description?: string; link?: string };
export type ResumeLink = { id: string; label: string; url: string };
export type ResumeCustomSection = { id: string; title: string; items: string[] };

export type ResumeContact = {
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
};

export type ResumeData = {
  templateId: string;
  accent: string;
  fontId: string;
  headingFontId: string;
  /** Manual density multiplier (1 = normal). Auto-fit can shrink further. */
  density: number;
  /** When true, the canvas shrinks text/spacing to fit a single A4 page. */
  autoFit: boolean;
  /** Order of the main stacked sections (single-column layouts). */
  sectionOrder?: string[];

  photoUrl?: string;
  name: string;
  headline: string;        // e.g. "Marketing Manager"
  contact: ResumeContact;
  summary?: string;

  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
  languages: ResumeLanguage[];
  certifications: ResumeCertification[];
  projects: ResumeProject[];
  interests: string[];
  custom: ResumeCustomSection[];
};

export function rid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/** Reorderable main sections (single-column layouts). */
export const RESUME_SECTIONS = ["summary", "experience", "projects", "education", "skills", "certifications", "languages", "interests"] as const;
export const SECTION_LABELS: Record<string, string> = {
  summary: "Summary", experience: "Experience", projects: "Projects", education: "Education",
  skills: "Skills", certifications: "Certifications", languages: "Languages", interests: "Interests",
};
export const DEFAULT_SECTION_ORDER: string[] = [...RESUME_SECTIONS];

export const DEFAULT_RESUME: ResumeData = {
  templateId: "compact",
  accent: "#2563eb",
  fontId: "inter",
  headingFontId: "poppins",
  density: 1,
  autoFit: true,
  sectionOrder: [...RESUME_SECTIONS],
  name: "",
  headline: "",
  contact: {},
  summary: "",
  experience: [],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
  projects: [],
  interests: [],
  custom: [],
};

export function emptyExperience(): ResumeExperience {
  return { id: rid(), role: "", company: "", location: "", start: "", end: "", current: false, bullets: [""] };
}
export function emptyEducation(): ResumeEducation {
  return { id: rid(), degree: "", school: "", location: "", start: "", end: "", details: "" };
}
export function emptyLanguage(): ResumeLanguage { return { id: rid(), name: "", level: "" }; }
export function emptyCertification(): ResumeCertification { return { id: rid(), name: "", issuer: "", year: "" }; }
export function emptyProject(): ResumeProject { return { id: rid(), name: "", description: "", link: "" }; }
export function emptyLink(): ResumeLink { return { id: rid(), label: "", url: "" }; }
export function emptyCustom(): ResumeCustomSection { return { id: rid(), title: "", items: [""] }; }
export function customWithTitle(title: string): ResumeCustomSection { return { id: rid(), title, items: [""] }; }

/**
 * Sections a user can ADD on top of the built-in ones (contact, summary,
 * experience, education, projects, skills, certifications, languages,
 * interests, links). Each becomes a titled, bulleted custom section.
 */
export const SUGGESTED_SECTIONS: string[] = [
  "Internships",
  "Technical Skills",
  "Soft Skills",
  "Achievements",
  "Awards & Honors",
  "Leadership Experience",
  "Extracurricular Activities",
  "Volunteering Experience",
  "Research Experience",
  "Publications",
  "Patents",
  "Conferences & Workshops",
  "Hackathons",
  "Competitions",
  "Open Source Contributions",
  "Freelance Experience",
  "Entrepreneurship / Founder Experience",
  "Organizations & Memberships",
  "Positions of Responsibility",
  "Training Programs",
  "Relevant Coursework",
  "Academic Projects",
  "References",
  "Testimonials",
  "Military Service",
  "Professional Licenses",
  "Scholarships",
  "Fellowships",
  "Teaching Experience",
  "Mentoring Experience",
  "Speaking Engagements",
  "Community Involvement",
  "Certifications in Progress",
  "Technical Publications / Blogs",
  "Case Studies",
  "Product Launches",
  "Key Accomplishments",
  "Career Highlights",
  "Professional Affiliations",
  "Study Abroad Experience",
  "Exchange Programs",
  "Sports Achievements",
  "Artistic Achievements",
  "Volunteer Leadership",
  "Professional Development",
  "Security Clearances",
  "Additional Information",
];

/** Rough content "weight" used to auto-pick a starting density. */
export function resumeWeight(r: ResumeData): number {
  let n = 0;
  n += (r.summary || "").length / 90;
  for (const e of r.experience) { n += 2.2 + e.bullets.filter(Boolean).length; }
  for (const e of r.education) { n += 1.8 + (e.details ? 0.6 : 0); }
  n += r.skills.length * 0.25;
  n += r.languages.length * 0.5;
  n += r.certifications.length * 0.8;
  n += r.projects.length * 1.4;
  n += r.interests.length * 0.2;
  for (const c of r.custom) n += 1 + c.items.filter(Boolean).length * 0.5;
  return n;
}
