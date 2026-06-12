/**
 * Content hub: SEO landing pages + blog posts.
 *
 * Each landing page targets a specific high-intent search term with its
 * own unique, substantial copy (no thin/duplicate pages), exact-match
 * title/H1/meta, an FAQ block, and internal links to related pages. The
 * blog targets informational long-tail queries to build topical
 * authority and feed internal links back to the landing pages and home.
 *
 * Everything here is plain data; the routes in app/[slug] and app/blog
 * render it and emit the matching JSON-LD.
 */

export type Section = { h: string; p?: string[]; list?: string[] };
export type QA = { q: string; a: string };

export type LandingPage = {
  slug: string;
  keyword: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  sections: Section[];
  faq: QA[];
  related: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  datePublished: string;
  dateModified?: string;
  readMins: number;
  lede: string;
  sections: Section[];
  faq?: QA[];
  /** When set, a HowTo schema is emitted from these steps. */
  howTo?: { name: string; description: string; steps: { name: string; text: string }[] };
  related: string[];
};

const CTA_NOTE =
  "Open the editor, type a one-line brief, and EXdeck builds a full, editable deck in about ten seconds — then export to real PowerPoint or PDF.";

/* -------------------------------------------------------------------------- */
/*  Landing pages                                                             */
/* -------------------------------------------------------------------------- */

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: "free-ppt-maker",
    keyword: "free PPT maker",
    title: "Free PPT Maker — Make a PowerPoint Online in Seconds",
    description:
      "Free PPT maker that turns a one-line topic into a full, editable PowerPoint. Real .pptx and PDF download, AI charts, 32 themes. Start free, no card needed.",
    h1: "Free PPT Maker",
    lede:
      "EXdeck is a free PPT maker that writes and designs a complete PowerPoint for you from a single line of text. No template hunting, no blank-slide paralysis — describe your topic and get an editable deck you can download as a real .pptx or PDF.",
    sections: [
      {
        h: "Make a PPT for free in three steps",
        list: [
          "Type a one-line brief — your topic, audience, and tone.",
          "Answer a couple of quick questions so the AI builds what you actually want.",
          "Edit any slide inline, then download a real PowerPoint (.pptx) or PDF.",
        ],
      },
      {
        h: "What you get on the free plan",
        p: [
          "The free plan is genuinely usable, not a teaser. You can generate decks, edit every element, present in full screen, and export to PowerPoint and PDF within a monthly limit. Free exports carry a small watermark you can remove by upgrading.",
        ],
        list: [
          "Real .pptx export that opens in PowerPoint, Keynote, and Google Slides",
          "High-resolution PDF download",
          "AI-built bar, line, pie, and donut charts when your topic has real data",
          "32 themes and 18 fonts to match your brand or mood",
          "A full inline editor — move, rewrite, restyle anything",
        ],
      },
      {
        h: "Why a generator beats starting from a template",
        p: [
          "Templates still leave you with the hardest part: writing the words and arranging them. A PPT maker that drafts the structure, headlines, and supporting points gets you to a real first draft in seconds, so your time goes into refining instead of staring at an empty title slide.",
        ],
      },
      {
        h: "Built for students, founders, and teams",
        p: [
          "Class presentations, project reviews, pitch decks, sales one-pagers, internal updates — anything that would normally mean an hour in PowerPoint. EXdeck handles the first draft so you can focus on the message.",
        ],
      },
    ],
    faq: [
      {
        q: "Is this PPT maker really free?",
        a: "Yes. You can generate, edit, present, and export to PowerPoint and PDF on the free plan within a monthly deck limit. Free exports include a small watermark; paid plans remove it and raise the limits.",
      },
      {
        q: "Can I download a real PowerPoint file?",
        a: "Yes — EXdeck exports a genuine Microsoft PowerPoint (.pptx) file plus a high-resolution PDF. The .pptx opens and edits normally in PowerPoint, Keynote, and Google Slides.",
      },
      {
        q: "Do I need to install anything?",
        a: "No. EXdeck runs entirely in your browser. There is nothing to download or install to make a presentation.",
      },
      {
        q: "How long does it take?",
        a: "The first draft generates in about ten seconds. Most people go from a blank brief to a finished, exported deck in under a minute.",
      },
    ],
    related: ["ai-ppt-maker", "text-to-ppt", "powerpoint-generator"],
  },
  {
    slug: "ai-presentation-maker",
    keyword: "AI presentation maker",
    title: "AI Presentation Maker — Create Slides from Text, Free",
    description:
      "AI presentation maker that builds a full, editable slide deck from a text prompt in seconds. Real charts, 32 themes, PPTX & PDF export. Free to start.",
    h1: "AI Presentation Maker",
    lede:
      "EXdeck is an AI presentation maker that turns a short brief into a structured, designed slide deck — complete with headlines, supporting points, charts, and a matching theme. Edit everything inline and export to PowerPoint or PDF.",
    sections: [
      {
        h: "From prompt to presentation in seconds",
        p: [
          "Describe what you need — \"a 10-slide investor pitch for a meal-kit startup,\" \"a class presentation on the water cycle,\" \"a quarterly sales review.\" The AI plans the flow, writes each slide, picks a theme, and lays it all out. You get a real draft, not a wall of bullet points.",
        ],
      },
      {
        h: "It asks before it builds",
        p: [
          "Most AI tools fire once and hope. EXdeck asks a few quick clarifying questions — audience, tone, depth — so the deck matches your intent on the first try instead of the fifth.",
        ],
      },
      {
        h: "A real editor, not a locked output",
        p: [
          "Generated slides are fully editable. Rewrite a headline, drag an element, swap a chart, change the theme, add an icon from a library of 200,000+. The AI gives you a starting point; you stay in control of the finish.",
        ],
      },
      {
        h: "Export with no lock-in",
        p: [
          "Download a real .pptx and PDF. Your text, charts, themes, and images come with you — present from PowerPoint, hand in a PDF, or keep editing in Google Slides.",
        ],
      },
    ],
    faq: [
      {
        q: "How does the AI presentation maker work?",
        a: "You type a one-line brief and answer a few quick questions. The AI then writes the content, structures the slides, applies a theme, and generates any relevant charts — producing an editable deck in about ten seconds.",
      },
      {
        q: "Can I edit what the AI creates?",
        a: "Yes. Every slide is fully editable in an inline editor — text, layout, charts, themes, fonts, and icons. Nothing is locked.",
      },
      {
        q: "Is the AI presentation maker free?",
        a: "There's a free plan that lets you generate, edit, present, and export within a monthly limit. Paid plans raise the limits and unlock extra finishing features.",
      },
      {
        q: "Does it make charts automatically?",
        a: "Yes, when your topic contains real numbers. EXdeck renders clean bar, line, pie, and donut charts colored to your theme, and stays text-only when a topic has no real data to chart.",
      },
    ],
    related: ["ai-ppt-maker", "free-ppt-maker", "presentation-maker-online"],
  },
];

LANDING_PAGES.push(
  {
    slug: "ai-ppt-maker",
    keyword: "AI PPT maker",
    title: "AI PPT Maker — Generate PowerPoint Slides from Text",
    description:
      "AI PPT maker that generates a full PowerPoint from a text prompt in seconds. Editable slides, AI charts, real .pptx and PDF export. Free plan, no card needed.",
    h1: "AI PPT Maker",
    lede:
      "EXdeck is an AI PPT maker that writes and designs your PowerPoint for you. Give it a topic, get a complete editable deck with charts and a matching theme, and export a real .pptx or PDF — all in your browser.",
    sections: [
      {
        h: "What an AI PPT maker actually saves you",
        p: [
          "The slow part of any presentation isn't the design — it's deciding what each slide should say and in what order. EXdeck drafts that structure for you: a clear narrative, headlines that land, and tight supporting points, so you start from a real deck instead of a blank file.",
        ],
      },
      {
        h: "Charts and visuals, generated for you",
        p: [
          "When your topic has real data, the AI builds bar, line, pie, and donut charts directly on the slides and colors them to match your theme. Add icons from a 200,000+ library and decorative shapes without leaving the editor.",
        ],
      },
      {
        h: "Edit every slide, your way",
        list: [
          "Inline text editing with rich formatting",
          "Drag, resize, and restyle any element",
          "Swap themes and fonts instantly across the whole deck",
          "Reorder, duplicate, or delete slides",
          "Speaker notes and a built-in presenter view",
        ],
      },
      {
        h: "Real PowerPoint export",
        p: [
          "EXdeck produces a genuine .pptx file — not an image dump — plus a high-resolution PDF. Open it in PowerPoint, Keynote, or Google Slides and keep working with no lock-in.",
        ],
      },
    ],
    faq: [
      {
        q: "What is an AI PPT maker?",
        a: "An AI PPT maker turns a text prompt into a finished PowerPoint presentation — writing the content, structuring the slides, and applying a design automatically. EXdeck does this in about ten seconds and lets you edit everything afterward.",
      },
      {
        q: "Can the AI PPT maker export to .pptx?",
        a: "Yes. EXdeck exports a real Microsoft PowerPoint (.pptx) file plus a PDF, preserving your text, charts, themes, and images.",
      },
      {
        q: "Is there a free AI PPT maker plan?",
        a: "Yes. You can generate, edit, present, and export on the free plan within a monthly deck limit. Free exports carry a small watermark that paid plans remove.",
      },
    ],
    related: ["free-ppt-maker", "ai-presentation-maker", "text-to-ppt"],
  },
  {
    slug: "text-to-ppt",
    keyword: "text to PPT",
    title: "Text to PPT — Turn Text into a PowerPoint Automatically",
    description:
      "Convert text to a PPT automatically. Paste a topic or outline and get an editable PowerPoint with charts and a theme in seconds. Real .pptx & PDF export, free.",
    h1: "Text to PPT",
    lede:
      "EXdeck turns text into a PPT automatically. Start from a single line or paste a longer outline, and the AI converts it into a structured, designed PowerPoint you can edit and download as a real .pptx or PDF.",
    sections: [
      {
        h: "From a sentence — or a whole document",
        p: [
          "Type one line and let the AI expand it into a full narrative, or paste an existing outline, notes, or source text and have EXdeck shape it into clean slides. Either way you get a coherent deck, not a literal paragraph dump onto slides.",
        ],
      },
      {
        h: "Structure the AI gets right",
        p: [
          "Text-to-slide tools often produce one cramped slide per paragraph. EXdeck plans a real flow — a strong opening, logically grouped sections, and a close — then writes each slide to be read at a glance from across a room.",
        ],
      },
      {
        h: "Keep your meaning, add the polish",
        list: [
          "Auto-generated charts when your text contains real numbers",
          "A matching theme and typography applied across every slide",
          "Icons and visuals to break up dense text",
          "Full inline editing so the final words are always yours",
        ],
      },
    ],
    faq: [
      {
        q: "How do I convert text to a PPT?",
        a: "Open the editor, paste your topic, outline, or notes, and answer a couple of quick questions. EXdeck converts the text into a structured, designed PowerPoint in about ten seconds, ready to edit and export.",
      },
      {
        q: "Can I paste a long document?",
        a: "Yes. You can start from a single line or provide longer source text, and the AI will shape it into a clean, well-structured slide deck rather than copying paragraphs verbatim.",
      },
      {
        q: "Is text to PPT free?",
        a: "Yes, within the free plan's monthly limit. You can edit and export to PowerPoint and PDF; free exports include a small watermark that paid plans remove.",
      },
    ],
    related: ["ai-ppt-maker", "free-ppt-maker", "powerpoint-generator"],
  },
  {
    slug: "powerpoint-generator",
    keyword: "PowerPoint generator",
    title: "PowerPoint Generator — Auto-Create .pptx Decks with AI",
    description:
      "PowerPoint generator that auto-creates a complete .pptx deck from a prompt. AI writing, charts, themes, and one-click PowerPoint & PDF download. Free to start.",
    h1: "PowerPoint Generator",
    lede:
      "EXdeck is a PowerPoint generator that builds a complete, editable .pptx deck from a short prompt. The AI writes the content, designs the slides, and adds charts — then you download a real PowerPoint file you can open and edit anywhere.",
    sections: [
      {
        h: "Generate a real PowerPoint, not a screenshot",
        p: [
          "Some generators hand you a flat image or a locked PDF. EXdeck produces a true .pptx with editable text boxes, shapes, and charts, so the file behaves exactly like one you'd build by hand in PowerPoint — only it took ten seconds.",
        ],
      },
      {
        h: "Designed automatically, refined by you",
        p: [
          "Every generated deck arrives with a coherent theme, readable typography, and balanced layouts. From there the inline editor lets you adjust copy, swap themes, reorder slides, and drop in icons or charts.",
        ],
      },
      {
        h: "Great for fast turnarounds",
        list: [
          "Pitch decks and investor updates",
          "Class and conference presentations",
          "Sales and product one-pagers",
          "Internal reviews and status updates",
        ],
      },
    ],
    faq: [
      {
        q: "Does the PowerPoint generator create an editable file?",
        a: "Yes. EXdeck generates a genuine .pptx with editable text, shapes, and charts — plus a PDF — so you can keep refining it in PowerPoint, Keynote, or Google Slides.",
      },
      {
        q: "How fast is it?",
        a: "The first draft generates in about ten seconds. You can then edit and export immediately.",
      },
      {
        q: "Is the PowerPoint generator free?",
        a: "Yes, with a free plan that covers generating, editing, presenting, and exporting within a monthly limit. Paid plans raise limits and remove the export watermark.",
      },
    ],
    related: ["ai-ppt-maker", "text-to-ppt", "free-ppt-maker"],
  },
  {
    slug: "presentation-maker-online",
    keyword: "online presentation maker",
    title: "Online Presentation Maker — Make Slides in Your Browser, Free",
    description:
      "Online presentation maker — build, edit, present, and download slide decks in your browser. AI drafting, real PPTX & PDF export, 32 themes. Free, no install.",
    h1: "Online Presentation Maker",
    lede:
      "EXdeck is an online presentation maker that runs entirely in your browser. Draft a deck with AI, edit every slide, present in full screen, and download a real PowerPoint or PDF — nothing to install.",
    sections: [
      {
        h: "Everything in the browser",
        p: [
          "No downloads, no plugins, no setup. Open EXdeck, describe your topic, and you're editing a real deck in seconds. It works on any modern browser and saves your decks to your account.",
        ],
      },
      {
        h: "Draft, design, and present in one place",
        list: [
          "AI drafting from a one-line brief",
          "Inline editing with themes, fonts, charts, and icons",
          "Full-screen presenter view with speaker notes",
          "Real .pptx and PDF export with no lock-in",
        ],
      },
      {
        h: "Made to be fast",
        p: [
          "The whole point of an online maker is speed. EXdeck gets you from idea to a finished, downloadable presentation faster than opening desktop software and picking a template.",
        ],
      },
    ],
    faq: [
      {
        q: "Do I need to install anything?",
        a: "No. EXdeck is a fully online presentation maker — it runs in your browser with nothing to install.",
      },
      {
        q: "Can I present directly from the browser?",
        a: "Yes. There's a built-in full-screen presenter view with speaker notes, and you can also export to PowerPoint or PDF to present from another app.",
      },
      {
        q: "Is the online presentation maker free?",
        a: "Yes. The free plan lets you create, edit, present, and export within a monthly limit, with paid plans for higher limits and extra features.",
      },
    ],
    related: ["ai-presentation-maker", "free-ppt-maker", "powerpoint-generator"],
  },
);

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}

export { CTA_NOTE };
