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

/* -------------------------------------------------------------------------- */
/*  Competitor "alternative" + comparison pages — capture high-intent          */
/*  brand searches from people ready to switch. Competitor descriptions are    */
/*  general and factual; the comparison leads with EXdeck's genuine strengths. */
/* -------------------------------------------------------------------------- */

const SWITCH_REASONS_NOTE =
  "People search for an alternative for all kinds of reasons — wanting a genuinely free option, real PowerPoint (.pptx) export with no lock-in, a faster path from idea to draft, or simply a tool that fits how they work. Here's how EXdeck compares.";

LANDING_PAGES.push(
  {
    slug: "gamma-alternative",
    keyword: "Gamma alternative",
    title: "Gamma Alternative — Free AI Presentation Maker with Real PPTX Export",
    description:
      "Looking for a Gamma alternative? EXdeck turns a one-line prompt into an editable deck in seconds, with real PowerPoint (.pptx) and PDF export and a free plan. No card needed.",
    h1: "A Gamma Alternative That Exports Real PowerPoint",
    lede:
      "Gamma is a popular AI tool for building decks and docs from a prompt. If you want a Gamma alternative that produces a genuine, editable PowerPoint (.pptx) file, runs entirely in your browser, and starts free, EXdeck is built for exactly that.",
    sections: [
      {
        h: "Why look for a Gamma alternative",
        p: [SWITCH_REASONS_NOTE],
      },
      {
        h: "What EXdeck does differently",
        list: [
          "Exports a real Microsoft PowerPoint (.pptx) and a high-resolution PDF that open and edit in PowerPoint, Keynote, and Google Slides — your work, no lock-in.",
          "Generates a full first draft in about ten seconds, then asks a few clarifying questions so the deck matches your intent on the first try.",
          "A true inline editor: rewrite text, drag elements, swap any of 32 themes, add icons from a 200,000+ library, and build charts from real data.",
          "A genuinely usable free plan — generate, edit, present, and export within a monthly limit.",
          "Live share links and collaborative editing so a teammate can open and edit the same deck with changes syncing in real time.",
        ],
      },
      {
        h: "Best for fast, presentation-first decks",
        p: [
          "If your goal is a polished slide deck you can present and hand off as a PowerPoint — pitches, class projects, sales one-pagers, internal reviews — EXdeck focuses on getting you there quickly without template wrestling.",
        ],
      },
    ],
    faq: [
      {
        q: "Is EXdeck a free Gamma alternative?",
        a: "Yes. EXdeck has a free plan that lets you generate, edit, present, and export decks to PowerPoint and PDF within a monthly limit. Paid plans raise the limits.",
      },
      {
        q: "Does EXdeck export to PowerPoint like I need?",
        a: "Yes. EXdeck exports a genuine .pptx file plus a PDF, preserving your text, charts, themes, and images, so you can keep editing anywhere.",
      },
      {
        q: "How is EXdeck different from Gamma?",
        a: "EXdeck is presentation-first with real .pptx/PDF export, a full inline editor, AI charts built only from real data, and a free plan — designed to get you from a one-line brief to a finished, downloadable deck in about a minute.",
      },
    ],
    related: ["beautiful-ai-alternative", "presentations-ai-alternative", "best-ai-presentation-maker"],
  },
  {
    slug: "beautiful-ai-alternative",
    keyword: "Beautiful.ai alternative",
    title: "Beautiful.ai Alternative — Free AI Deck Maker with PPTX Export",
    description:
      "A Beautiful.ai alternative that's free to start: type a topic, get an editable AI deck in seconds, and export a real PowerPoint (.pptx) and PDF. No install, no card.",
    h1: "A Beautiful.ai Alternative, Free to Start",
    lede:
      "Beautiful.ai is known for smart templates that auto-arrange your content. If you want a Beautiful.ai alternative that drafts the words for you too — and exports a real, editable PowerPoint — EXdeck combines AI writing, automatic layout, and true .pptx export in one browser tool.",
    sections: [
      { h: "Why look for a Beautiful.ai alternative", p: [SWITCH_REASONS_NOTE] },
      {
        h: "AI that writes the content, not just the layout",
        p: [
          "Templates solve arrangement, but you still have to write every word. EXdeck drafts the narrative, headlines, and supporting points from a one-line brief, then lays them out on a matching theme — so you start from a real, written deck and refine instead of composing from scratch.",
        ],
      },
      {
        h: "Real export and a real editor",
        list: [
          "Genuine .pptx and PDF download with no lock-in",
          "Inline editing of every element, plus 32 themes and 18 fonts",
          "AI charts generated from real numbers, colored to your theme",
          "Full-screen presenter view with speaker notes",
        ],
      },
    ],
    faq: [
      {
        q: "Is EXdeck free?",
        a: "Yes, there's a free plan covering generation, editing, presenting, and export to PowerPoint and PDF within a monthly limit.",
      },
      {
        q: "Does EXdeck write the content or just design it?",
        a: "Both. EXdeck's AI writes the slide content from your brief and lays it out automatically, then lets you edit everything inline.",
      },
      {
        q: "Can I export a real PowerPoint file?",
        a: "Yes — a genuine .pptx plus a PDF, editable in PowerPoint, Keynote, and Google Slides.",
      },
    ],
    related: ["gamma-alternative", "canva-presentation-alternative", "best-ai-presentation-maker"],
  },
  {
    slug: "canva-presentation-alternative",
    keyword: "Canva presentation alternative",
    title: "Canva Presentations Alternative — AI Maker with Real PPTX Export",
    description:
      "A focused Canva presentations alternative: skip template hunting and let AI draft an editable deck in seconds, then export a real PowerPoint (.pptx) and PDF. Free to start.",
    h1: "A Canva Presentations Alternative, Focused on Decks",
    lede:
      "Canva is a broad design suite with a presentations module. If you want a Canva presentation alternative that's focused purely on building slide decks fast — with AI writing the first draft and real PowerPoint export — EXdeck does exactly that, with nothing to install.",
    sections: [
      { h: "Why look for a Canva presentation alternative", p: [SWITCH_REASONS_NOTE] },
      {
        h: "Less template hunting, more finished deck",
        p: [
          "A general design tool gives you thousands of templates and a blank canvas. EXdeck gives you a complete first draft: the AI decides the structure, writes the slides, and applies a cohesive theme, so you spend your time refining a real deck rather than choosing between templates.",
        ],
      },
      {
        h: "Built for presentations specifically",
        list: [
          "One-line brief to a full, editable deck in about ten seconds",
          "Real .pptx and PDF export with no watermark on paid plans",
          "AI charts, 200,000+ icons, themes, and fonts",
          "Present in full screen or hand off a PowerPoint — your choice",
        ],
      },
    ],
    faq: [
      {
        q: "Is EXdeck a free Canva alternative for presentations?",
        a: "Yes. EXdeck's free plan covers generating, editing, presenting, and exporting decks to PowerPoint and PDF within a monthly limit.",
      },
      {
        q: "Does EXdeck export to PowerPoint?",
        a: "Yes — a real .pptx file and a PDF, both editable elsewhere with no lock-in.",
      },
      {
        q: "How is EXdeck different from Canva?",
        a: "EXdeck is presentation-first and AI-first: instead of browsing templates, you describe your topic and get a written, designed deck in seconds, then edit and export it.",
      },
    ],
    related: ["gamma-alternative", "beautiful-ai-alternative", "free-ppt-maker"],
  },
  {
    slug: "presentations-ai-alternative",
    keyword: "Presentations.ai alternative",
    title: "Presentations.ai Alternative — Free AI PPT Maker with PPTX Export",
    description:
      "A Presentations.ai alternative that's free to start and exports a real PowerPoint (.pptx) and PDF. Type a topic, get an editable AI deck in seconds, edit everything.",
    h1: "A Presentations.ai Alternative with Real PPTX Export",
    lede:
      "Presentations.ai is an AI-first deck generator. If you want a Presentations.ai alternative with a genuinely free plan, real PowerPoint (.pptx) and PDF export, and a full inline editor, EXdeck is built around exactly those things.",
    sections: [
      { h: "Why look for a Presentations.ai alternative", p: [SWITCH_REASONS_NOTE] },
      {
        h: "Generate, edit, and own the file",
        p: [
          "EXdeck writes and designs your deck from a one-line brief, asks a few clarifying questions first, and gives you a real editor afterward. When you're done, you export a genuine .pptx and PDF — files you fully own and can edit in any app.",
        ],
      },
      {
        h: "What you get free",
        list: [
          "AI deck generation from a text prompt",
          "Inline editing, 32 themes, 18 fonts, 200,000+ icons",
          "AI charts from real data only — no invented numbers",
          "Real PowerPoint and PDF export within the free monthly limit",
        ],
      },
    ],
    faq: [
      {
        q: "Is EXdeck free to start?",
        a: "Yes. The free plan covers generation, editing, presenting, and PowerPoint/PDF export within a monthly deck limit.",
      },
      {
        q: "Does it export real PowerPoint files?",
        a: "Yes — a genuine .pptx plus a PDF, editable in PowerPoint, Keynote, and Google Slides.",
      },
    ],
    related: ["gamma-alternative", "beautiful-ai-alternative", "best-ai-presentation-maker"],
  },
  {
    slug: "best-ai-presentation-maker",
    keyword: "best AI presentation maker",
    title: "The Best AI Presentation Maker: What Actually Matters in 2026",
    description:
      "What makes the best AI presentation maker? Real PPTX export, a true editor, AI that asks before it builds, and an honest free plan. See how EXdeck stacks up.",
    h1: "The Best AI Presentation Maker: What Actually Matters",
    lede:
      "\"Best\" depends on what you need, but a few things separate a genuinely useful AI presentation maker from a demo: real export you own, a true editor, AI that asks what you want, and an honest free plan. Here's the checklist — and how EXdeck measures up.",
    sections: [
      {
        h: "The checklist that matters",
        list: [
          "Real, editable export — a true .pptx and PDF, not a flat image or a locked file.",
          "A real editor — rewrite, drag, restyle, reorder; the AI draft is a start, not the end.",
          "AI that asks before it builds — clarifying questions beat one-shot guesses.",
          "Honest data — charts built only from real numbers, never invented to look impressive.",
          "A usable free plan — enough to actually finish a deck, not just preview one.",
          "Speed — a complete first draft in seconds, not minutes of setup.",
        ],
      },
      {
        h: "How EXdeck measures up",
        p: [
          "EXdeck ticks every box: genuine .pptx and PDF export with no lock-in, a full inline editor, a short clarifying step before generation, charts drawn only from real data, a free plan that takes you all the way to export, and a first draft in about ten seconds. It also adds live share links and real-time collaborative editing.",
        ],
      },
      {
        h: "Try it on your next deck",
        p: [
          "The fastest way to judge any presentation maker is to throw a real topic at it. Open EXdeck, type one line about your next presentation, and see a finished, editable draft in seconds.",
        ],
      },
    ],
    faq: [
      {
        q: "What is the best free AI presentation maker?",
        a: "The best free option is one that lets you finish and export a real deck, not just preview one. EXdeck's free plan covers generation, editing, presenting, and PowerPoint/PDF export within a monthly limit.",
      },
      {
        q: "Which AI presentation maker exports real PowerPoint?",
        a: "EXdeck exports a genuine .pptx file plus a PDF, preserving text, charts, themes, and images for editing in PowerPoint, Keynote, or Google Slides.",
      },
      {
        q: "How fast can AI make a presentation?",
        a: "With EXdeck, the first draft generates in about ten seconds; most people go from brief to exported deck in under a minute.",
      },
    ],
    related: ["gamma-alternative", "beautiful-ai-alternative", "ai-presentation-maker"],
  },
);

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}

export { CTA_NOTE };
