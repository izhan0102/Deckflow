/**
 * "How to" guide content — one entry per feature. Powers the /how-to hub
 * and /how-to/[slug] pages, each with HowTo + FAQ structured data so the
 * steps are eligible for Google's rich "how-to" results.
 *
 * Written around the exact phrasings people search ("how to make a ppt with
 * ai", "how to make a spreadsheet with ai", "how to convert pdf to ppt").
 */

export type HowToStep = { name: string; text: string };
export type HowToFaq = { q: string; a: string };

export type HowToGuide = {
  slug: string;
  /** Eyebrow label shown above the H1. */
  kicker: string;
  /** SEO <title>. */
  title: string;
  /** Meta description. */
  description: string;
  /** On-page H1. */
  h1: string;
  /** One-paragraph intro under the H1. */
  lede: string;
  keywords: string[];
  steps: HowToStep[];
  faq: HowToFaq[];
  /** Where the primary button goes, and its label. */
  ctaHref: string;
  ctaLabel: string;
  /** Slugs of related guides. */
  related: string[];
};

export const HOWTO_GUIDES: HowToGuide[] = [
  {
    slug: "make-a-presentation-with-ai",
    kicker: "Presentations",
    title: "How to Make a PowerPoint Presentation with AI (Free) — EXdeck",
    description:
      "Step-by-step: turn a one-line topic into a fully designed, editable PowerPoint with AI. Add charts, edit slides, present, and export to PPTX & PDF — free.",
    h1: "How to make a presentation with AI",
    lede:
      "Go from a single sentence to a polished, editable slide deck in about ten seconds. Here's exactly how to make a PowerPoint with EXdeck's AI — then edit it, present it, and export a real .pptx or .pdf.",
    keywords: [
      "how to make a presentation with ai", "how to make a ppt with ai", "ai ppt maker",
      "make powerpoint from text", "how to create a presentation online", "ai presentation tutorial",
    ],
    steps: [
      { name: "Describe your deck", text: "On the create screen, type a one-line brief — your topic, audience, and tone. You can also paste or upload your own content (PDF, text, or notes) to turn into slides." },
      { name: "Pick a template", text: "Choose a template — it sets the theme, fonts, background texture, and layout style. The catalog leads with premium, Canva/Gamma-grade designs." },
      { name: "Answer a few quick questions", text: "EXdeck asks a short set of tap-to-answer questions (how visual, how detailed, what to emphasize) so the deck matches what you actually want." },
      { name: "Generate and edit", text: "The AI writes and designs every slide — picking bullets, tables, or real data charts per slide. Then edit anything inline: drag text, recolor charts, add icons, or rewrite a slide with chat." },
      { name: "Present or export", text: "Use full-screen present mode, or export a real PowerPoint .pptx (opens in PowerPoint, Keynote, Slides) and a high-res PDF — yours to keep, no lock-in." },
    ],
    faq: [
      { q: "Is it free to make a presentation?", a: "Yes. The free plan gives you monthly AI credits to generate and edit decks and export to PPTX and PDF (free exports carry a small watermark). Pro removes the watermark and gives far more credits." },
      { q: "Can I edit the slides after generating?", a: "Yes — EXdeck is a full inline editor, not a one-shot generator. Drag text boxes, recolor charts, swap themes, add 200,000+ icons, and rewrite slides with AI chat." },
      { q: "Does it export to real PowerPoint?", a: "Yes, a genuine .pptx with your text, charts, themes, and images preserved — plus a high-resolution PDF." },
    ],
    ctaHref: "/app",
    ctaLabel: "Make a presentation free",
    related: ["make-a-spreadsheet-with-ai", "write-a-document-with-ai", "convert-pdf-to-ppt"],
  },
  {
    slug: "make-a-spreadsheet-with-ai",
    kicker: "Spreadsheet",
    title: "How to Make a Spreadsheet with AI (Free Excel Maker) — EXdeck",
    description:
      "Step-by-step: build and edit Excel-style spreadsheets by just asking. Create tables, totals, and live formulas in plain English, then export to .xlsx or PDF — free.",
    h1: "How to make a spreadsheet with AI",
    lede:
      "Tell the AI what you need — 'make a table of sales by quarter', 'add a total column', 'change C4 to 99' — and it builds and edits the sheet with live formulas. Here's how, step by step.",
    keywords: [
      "how to make a spreadsheet with ai", "ai spreadsheet", "ai excel generator",
      "make excel with ai", "natural language spreadsheet", "how to use ai in excel",
    ],
    steps: [
      { name: "Open the grid", text: "Go to the AI Spreadsheet — you get columns A, B, C and rows 1, 2, 3 just like Excel. Type values or formulas directly into any cell." },
      { name: "Ask the AI", text: "In the assistant box, describe what you want: 'make a budget table', 'add a SUM total row', 'highlight negatives in red', or 'change C4 to 99'. The AI applies the edits." },
      { name: "Use live formulas", text: "Type formulas like =SUM(B2:B10), =AVERAGE(A1:A9), or =IF(A1>10,\"high\",\"low\") — they recalculate instantly. The AI writes formulas too, so totals stay correct." },
      { name: "Export to Excel or PDF", text: "Download a real .xlsx with formulas intact (opens in Excel, Google Sheets, Numbers) or a clean PDF. Everything runs in your browser." },
    ],
    faq: [
      { q: "What can the AI do in a spreadsheet?", a: "Build tables, add or edit cells, create total rows and columns, write formulas, insert or delete rows and columns, apply conditional formatting, and make charts — all from plain-English instructions." },
      { q: "Is my data private?", a: "Yes. The spreadsheet and exports run entirely in your browser; your data isn't stored on a server. The AI assistant requires a free sign-in." },
      { q: "Can I export to real Excel?", a: "Yes — a real .xlsx that opens in Excel, Google Sheets, and Numbers with formulas preserved, or a PDF." },
    ],
    ctaHref: "/spreadsheet",
    ctaLabel: "Open the AI spreadsheet",
    related: ["make-a-presentation-with-ai", "write-a-document-with-ai", "convert-files-online"],
  },
  {
    slug: "write-a-document-with-ai",
    kicker: "Documents",
    title: "How to Write a Document with AI (Free Doc Generator) — EXdeck",
    description:
      "Step-by-step: generate a structured, Word-style document with AI — headings, tables, charts, and callouts — then edit inline and export a clean multi-page PDF.",
    h1: "How to write a document with AI",
    lede:
      "Turn a topic into a complete, well-structured document — headings, paragraphs, tables, charts, and callouts — in seconds. Here's how to write and export one with EXdeck.",
    keywords: [
      "how to write a document with ai", "ai document generator", "ai essay writer",
      "ai report generator", "write a document online", "ai word document",
    ],
    steps: [
      { name: "Enter your topic", text: "On the documents screen, type what the document is about, choose roughly how many pages, and pick a density (concise to comprehensive)." },
      { name: "Generate the draft", text: "The AI writes a structured document — headings, body text, multi-column tables, charts, and callout boxes — laid out cleanly across pages." },
      { name: "Edit inline", text: "Click to edit any block, reorder sections, add images, or ask the AI to rewrite, expand, or tighten a section in plain English." },
      { name: "Export to PDF", text: "Download a clean, multi-page PDF with your chosen template, fonts, and optional watermark — ready to share or print." },
    ],
    faq: [
      { q: "What kinds of documents can it write?", a: "Reports, briefs, essays, study notes, proposals, and more — anything that benefits from headings, tables, charts, and structured sections." },
      { q: "Can I edit the document after generating?", a: "Yes. Every block is editable inline, you can reorder sections and add images, and the AI can rewrite or expand any part on request." },
      { q: "Is the document generator free?", a: "Document generation uses your AI credits; the free plan includes monthly credits, and Pro gives far more plus removes the export watermark." },
    ],
    ctaHref: "/docs",
    ctaLabel: "Write a document",
    related: ["make-a-presentation-with-ai", "build-a-resume-with-ai", "make-a-spreadsheet-with-ai"],
  },
  {
    slug: "build-a-resume-with-ai",
    kicker: "Resume",
    title: "How to Build a Resume with AI (Free Resume Maker) — EXdeck",
    description:
      "Step-by-step: build a clean, professional resume with AI. Fill in your details, let AI refine the wording, pick a template, and export a polished PDF — free.",
    h1: "How to build a resume with AI",
    lede:
      "Create a sharp, recruiter-ready resume in minutes. Enter your experience, let the AI tighten the wording, choose a template, and export a clean PDF. Here's how.",
    keywords: [
      "how to build a resume with ai", "ai resume builder", "ai resume maker",
      "free resume builder", "make a cv with ai", "ai cv builder",
    ],
    steps: [
      { name: "Add your details", text: "Open the resume builder and fill in your sections — contact info, summary, experience, education, skills, and projects." },
      { name: "Refine with AI", text: "Let the AI sharpen your bullet points and summary into concise, achievement-focused wording that reads well to recruiters and ATS systems." },
      { name: "Pick a template", text: "Choose a clean, professional layout and adjust fonts and spacing so it looks polished at a glance." },
      { name: "Export a PDF", text: "Download a print-ready PDF resume that's ready to attach to applications or upload to job boards." },
    ],
    faq: [
      { q: "Is the resume builder free?", a: "Yes, you can build and export a resume on the free plan. AI refinement is a Pro feature that rewrites your wording into stronger, concise lines." },
      { q: "Is it ATS-friendly?", a: "The templates use clean, parseable layouts, and the AI keeps wording concise and keyword-relevant so applicant tracking systems can read it." },
      { q: "Can I edit everything?", a: "Yes — every field is editable, you can reorder sections, and you control the template, fonts, and spacing before exporting." },
    ],
    ctaHref: "/resume",
    ctaLabel: "Build a resume",
    related: ["write-a-document-with-ai", "make-a-presentation-with-ai", "convert-files-online"],
  },
  {
    slug: "convert-pdf-to-ppt",
    kicker: "PDF to PPT",
    title: "How to Convert a PDF to PowerPoint (PPT) — Free — EXdeck",
    description:
      "Step-by-step: turn a PDF into an editable PowerPoint presentation. Upload your PDF, let EXdeck rebuild it into slides, edit, and export a real .pptx — free.",
    h1: "How to convert a PDF to PowerPoint",
    lede:
      "Have a PDF you want as slides? EXdeck turns it into an editable presentation you can refine and export as a real .pptx. Here's how to convert PDF to PPT for free.",
    keywords: [
      "how to convert pdf to ppt", "pdf to ppt", "pdf to powerpoint",
      "convert pdf to powerpoint free", "pdf to pptx", "pdf to slides",
    ],
    steps: [
      { name: "Open PDF to PPT", text: "Go to the PDF-to-PPT tool and upload the PDF you want to turn into a presentation." },
      { name: "Let EXdeck rebuild it", text: "EXdeck reads the content and organizes it into clean, themed slides — titles, bullets, and tables — rather than flat image dumps." },
      { name: "Edit the slides", text: "Refine anything in the inline editor: fix titles, tighten bullets, recolor, add charts or icons, and switch the template." },
      { name: "Export to PowerPoint", text: "Download a real .pptx that opens in PowerPoint, Keynote, or Google Slides, plus a high-res PDF if you need one." },
    ],
    faq: [
      { q: "Is converting PDF to PPT free?", a: "Yes. You can convert and edit on the free plan and export to PPTX and PDF (free exports carry a small watermark)." },
      { q: "Will the slides be editable?", a: "Yes — the result is a fully editable deck, not flat images, so you can rewrite text, recolor, and restructure before exporting." },
      { q: "What file do I get back?", a: "A genuine Microsoft PowerPoint .pptx file, plus an optional high-resolution PDF." },
    ],
    ctaHref: "/pdf-to-ppt",
    ctaLabel: "Convert PDF to PPT",
    related: ["make-a-presentation-with-ai", "convert-files-online", "write-a-document-with-ai"],
  },
  {
    slug: "convert-files-online",
    kicker: "Converters",
    title: "How to Convert Files Online (Free, Private) — EXdeck",
    description:
      "Step-by-step: convert PDFs, images, and more for free in your browser. Image to PDF, PDF to JPG, merge PDF, PNG to JPG and more — private, no upload to a server.",
    h1: "How to convert files online for free",
    lede:
      "Need to convert an image to PDF, split a PDF, or merge files? EXdeck's free converters run entirely in your browser — nothing is uploaded. Here's how.",
    keywords: [
      "how to convert files online", "free file converter", "image to pdf",
      "pdf to jpg", "merge pdf", "png to jpg converter", "online converter free",
    ],
    steps: [
      { name: "Pick a converter", text: "Open the Converters hub and choose what you need — Image to PDF, PDF to JPG, Merge PDF, PNG to JPG, and more." },
      { name: "Add your files", text: "Drag and drop your files (or click to browse). For merges and multi-page outputs, reorder them as needed." },
      { name: "Convert in your browser", text: "The conversion runs locally on your device — your files are never uploaded to a server, so it's fast and private." },
      { name: "Download the result", text: "Save the converted file instantly. No watermark, no sign-up required for the converters." },
    ],
    faq: [
      { q: "Are the converters really free?", a: "Yes — the file converters are free with no sign-up and no watermark." },
      { q: "Are my files private?", a: "Yes. Conversions happen entirely in your browser; your files are never uploaded to a server." },
      { q: "What conversions are supported?", a: "Image to PDF, PDF to JPG, merge PDF, PNG to JPG, and a growing set of common document and image conversions — see the Converters hub for the full list." },
    ],
    ctaHref: "/converter",
    ctaLabel: "Open the converters",
    related: ["convert-pdf-to-ppt", "make-a-spreadsheet-with-ai", "make-a-presentation-with-ai"],
  },
  {
    slug: "analyse-documents-with-ai",
    kicker: "Document Analyser",
    title: "How to Analyse Documents with AI (Word, Excel, PDF, Code) — EXdeck",
    description:
      "Step-by-step: upload Word, Excel, PowerPoint, PDF, code or images, choose how deep to analyse, and get a clear breakdown per file plus a cross-document synthesis — free, private, with follow-up questions.",
    h1: "How to analyse documents with AI",
    lede:
      "Drop in one file or many — reports, spreadsheets, slides, PDFs, code — pick your depth, and EXdeck returns a sharp analysis of each, connects them, and answers your follow-up questions. Here's how.",
    keywords: [
      "how to analyse documents with ai", "ai document analyzer", "analyse pdf with ai",
      "ai excel analyzer", "compare documents with ai", "summarize documents ai", "ai code analyzer",
    ],
    steps: [
      { name: "Upload your files", text: "Drop one or more documents — Word, Excel, PowerPoint, PDF, txt, CSV, JSON, source code, or images. They're read privately on your device, never uploaded as files." },
      { name: "Choose depth & focus", text: "Pick the analysis strength — Overview, Moderate, or Deep — and a focus like key insights, risks, action items, data, or code review." },
      { name: "Read the analysis", text: "Get a clear breakdown per document, plus a cross-document synthesis that finds overlaps, connections, and contradictions when you upload several." },
      { name: "Ask follow-ups", text: "Use the built-in chat to ask questions about your documents — it remembers the conversation, so you can dig deeper." },
    ],
    faq: [
      { q: "What files can it analyse?", a: "Word, Excel, PowerPoint, PDF, plain text, Markdown, CSV, JSON, source code in any language, and images via OCR." },
      { q: "Can it analyse several at once?", a: "Yes — up to 8 files. You get a per-document analysis plus a cross-document synthesis that connects them and flags contradictions." },
      { q: "Can I ask questions afterwards?", a: "Yes. A chat with conversation memory lets you ask follow-up questions grounded in your uploaded documents." },
    ],
    ctaHref: "/analyse",
    ctaLabel: "Open the analyser",
    related: ["write-a-document-with-ai", "make-a-spreadsheet-with-ai", "make-a-presentation-with-ai"],
  },
];

export function getHowToGuide(slug: string): HowToGuide | undefined {
  return HOWTO_GUIDES.find((g) => g.slug === slug);
}
