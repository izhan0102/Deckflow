/**
 * Programmatically-generated keyword universe for the /keywords topic hub.
 *
 * NOTE on SEO ethics: these are rendered as a VISIBLE, browsable tag index
 * (a legitimate topic/keyword hub with real internal links) — not hidden
 * cloaked text. Hidden keyword stuffing violates Google's guidelines and can
 * get a site penalized, which would work against ranking. A large, genuinely
 * navigable index of the topics the product serves is the safe, effective
 * version of "lots of tags".
 */

const TOOLS = [
  "AI PPT maker", "PowerPoint generator", "presentation maker", "slide maker", "AI slides generator",
  "pitch deck maker", "deck maker", "text to PPT", "PPTX generator", "AI spreadsheet", "Excel generator",
  "AI document generator", "report maker", "essay writer", "AI resume builder", "CV maker",
  "PDF to PPT converter", "PDF to PowerPoint", "file converter", "chart maker",
  "AI document analyser", "document analyzer", "PDF analyzer", "AI file analyzer",
];

const MODS = ["free", "online", "AI", "fast", "instant", "no sign up", "best", "2026", "easy", "for free"];

const USES = [
  "for students", "for teachers", "for business", "for startups", "for college", "for school",
  "for marketing", "for sales", "for pitch decks", "for reports", "for interviews", "for projects",
  "for class", "for work", "for clients", "for professors", "for managers", "for freelancers",
];

const TOPICS = [
  "business plan", "marketing strategy", "science project", "history lesson", "biology", "chemistry",
  "startup pitch", "sales deck", "financial report", "quarterly review", "book report", "case study",
  "product launch", "annual report", "thesis defense", "training session", "company profile",
  "research paper", "lecture", "seminar", "workshop", "onboarding", "investor update", "go to market",
  "competitor analysis", "SWOT analysis", "project proposal", "budget plan", "expense report",
];

const FORMATS = ["presentation", "ppt", "slides", "powerpoint", "deck", "report", "document", "slideshow"];

const BRAND = ["EXdeck", "EXdeck AI", "EXdeck PPT maker", "Xdeck", "Xdeck AI", "exdeck.xyz"];

/** Build the full deduped keyword list. */
export function buildKeywords(): string[] {
  const out = new Set<string>();
  for (const t of TOOLS) {
    out.add(t);
    for (const m of MODS) { out.add(`${m} ${t}`); out.add(`${t} ${m}`); }
    for (const u of USES) out.add(`${t} ${u}`);
    for (const tp of TOPICS) out.add(`${t} for ${tp}`);
  }
  for (const tp of TOPICS) {
    for (const f of FORMATS) {
      out.add(`${tp} ${f}`);
      out.add(`how to make a ${tp} ${f}`);
      out.add(`${tp} ${f} template`);
      out.add(`AI ${tp} ${f}`);
      out.add(`free ${tp} ${f}`);
    }
  }
  for (const b of BRAND) {
    out.add(b);
    for (const m of MODS.slice(0, 5)) out.add(`${b} ${m}`);
  }
  return Array.from(out);
}

/** Best internal link target for a keyword (deep links beat homepage). */
export function targetFor(kw: string): string {
  const k = kw.toLowerCase();
  if (/analy[sz]e|analy[sz]er/.test(k)) return "/analyse";
  if (/spreadsheet|excel/.test(k)) return "/spreadsheet";
  if (/resume|cv/.test(k)) return "/resumes";
  if (/document|essay|report\b|research paper/.test(k)) return "/documents";
  if (/pdf to (ppt|powerpoint)/.test(k)) return "/pdf-to-ppt";
  if (/convert|converter/.test(k)) return "/converter";
  if (/presentation|ppt|slides|powerpoint|deck|pitch/.test(k)) return "/presentations";
  return "/app";
}
