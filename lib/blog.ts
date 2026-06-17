/**
 * Blog posts — informational, long-tail content that builds topical
 * authority and links back to the landing pages and home. Each post is
 * unique long-form copy written around real questions people search.
 */
import type { BlogPost } from "@/lib/content";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-make-a-powerpoint-presentation-from-text",
    title: "How to Make a PowerPoint Presentation from Text (Step by Step)",
    description:
      "A simple, step-by-step guide to turning a topic or outline into a finished PowerPoint — using AI to draft, then editing and exporting a real .pptx.",
    h1: "How to Make a PowerPoint Presentation from Text",
    datePublished: "2026-05-20",
    readMins: 6,
    lede:
      "Staring at a blank title slide is the slowest part of any presentation. Here's a reliable way to go from a sentence of text to a finished, exported PowerPoint in minutes — without wrestling templates.",
    sections: [
      {
        h: "1. Start with a clear one-line brief",
        p: [
          "The quality of an AI-built deck depends almost entirely on the brief. Be specific about three things: the topic, the audience, and the tone. \"A 10-slide pitch for a budgeting app aimed at college students, confident but friendly\" produces a far better deck than \"budgeting app.\"",
        ],
      },
      {
        h: "2. Answer the clarifying questions",
        p: [
          "A good AI presentation maker asks before it builds — how many slides, how much detail, what angle. Spending fifteen seconds on these questions saves you from regenerating later, because the first draft lands much closer to what you pictured.",
        ],
      },
      {
        h: "3. Let the AI draft the structure",
        p: [
          "The model plans a narrative: an opening that frames the problem, body sections grouped logically, and a close with a clear takeaway. When your topic has real numbers, it adds charts. You end up with a complete draft instead of a blank file.",
        ],
      },
      {
        h: "4. Edit for your voice",
        p: [
          "AI gets you 80% there; the last 20% is yours. Tighten headlines so each reads at a glance, cut any slide that doesn't earn its place, and adjust the theme to match your brand. A real inline editor makes this fast.",
        ],
      },
      {
        h: "5. Export to .pptx or PDF",
        p: [
          "Finish by exporting a real PowerPoint file you can present from or keep editing, or a PDF for clean handouts. Avoid tools that only give you a flat image or a locked file — you want something you actually own.",
        ],
      },
    ],
    howTo: {
      name: "How to make a PowerPoint presentation from text",
      description:
        "Turn a topic or outline into a finished, editable PowerPoint using AI, then export a real .pptx or PDF.",
      steps: [
        { name: "Write a one-line brief", text: "Describe your topic, audience, and tone in a single sentence." },
        { name: "Answer clarifying questions", text: "Set slide count, depth, and angle so the draft matches your intent." },
        { name: "Generate the draft", text: "Let the AI write the content, structure the slides, and add charts." },
        { name: "Edit for your voice", text: "Tighten headlines, cut weak slides, and adjust the theme." },
        { name: "Export", text: "Download a real PowerPoint (.pptx) or a PDF." },
      ],
    },
    faq: [
      {
        q: "Can I make a PowerPoint from just one line of text?",
        a: "Yes. With an AI PPT maker like EXdeck, a single descriptive line is enough to generate a full first draft, which you then edit and export.",
      },
      {
        q: "Will the exported file be a real PowerPoint?",
        a: "With EXdeck, yes — it exports a genuine .pptx that opens and edits in PowerPoint, Keynote, and Google Slides, plus a PDF.",
      },
    ],
    related: ["ai-ppt-maker", "text-to-ppt", "free-ppt-maker"],
  },
  {
    slug: "best-free-ai-presentation-makers",
    title: "What to Look for in a Free AI Presentation Maker",
    description:
      "Not all free AI presentation makers are equal. Here are the features that actually matter — real export, an editor, honest free limits — and what to avoid.",
    h1: "What to Look for in a Free AI Presentation Maker",
    datePublished: "2026-05-24",
    readMins: 7,
    lede:
      "\"Free\" means very different things across AI presentation tools. Some watermark everything, some lock export behind a paywall, and some give you a locked output you can't really edit. Here's how to tell a genuinely useful free maker from a demo.",
    sections: [
      {
        h: "Real export, not a locked file",
        p: [
          "The single most important feature: can you download a real, editable PowerPoint (.pptx) and PDF? Many tools only export a flat image or a file you can't open elsewhere. If you can't take your work with you, it isn't really yours.",
        ],
      },
      {
        h: "A true editor",
        p: [
          "One-shot generators hand you a deck and walk away. You want inline editing — rewrite text, move elements, swap themes, reorder slides — because the AI draft is a starting point, not the finish.",
        ],
      },
      {
        h: "Honest free limits",
        p: [
          "Look for a free plan that actually lets you finish and export a deck, even if it's capped per month or carries a small watermark. That's fair. Be wary of tools where every export demands payment with no way to evaluate quality first.",
        ],
      },
      {
        h: "Charts from real data",
        p: [
          "Good tools chart your real numbers and stay text-only when there's no data to chart. Tools that invent statistics to fill a graph are a liability for anything you'll present.",
        ],
      },
      {
        h: "Where EXdeck fits",
        p: [
          "EXdeck was built around exactly these points: a free plan you can finish a deck on, real .pptx and PDF export with no lock-in, a full inline editor, and charts only when your topic has real data. It's open source, too, so you can see how it works.",
        ],
      },
    ],
    faq: [
      {
        q: "Are free AI presentation makers any good?",
        a: "The good ones are genuinely useful — the key is whether you can edit freely and export a real file. EXdeck offers both on its free plan within a monthly limit.",
      },
      {
        q: "What's the catch with free plans?",
        a: "Usually a monthly cap and a small watermark on free exports, which is reasonable. Avoid tools that lock all export behind payment before you can judge quality.",
      },
    ],
    related: ["free-ppt-maker", "ai-presentation-maker", "presentation-maker-online"],
  },
];

BLOG_POSTS.push(
  {
    slug: "how-to-create-a-pitch-deck-with-ai",
    title: "How to Create a Pitch Deck with AI (Founder's Guide)",
    description:
      "Build a clear, investor-ready pitch deck with AI in minutes. The slides that matter, what to say on each, and how to draft and export the whole thing fast.",
    h1: "How to Create a Pitch Deck with AI",
    datePublished: "2026-05-28",
    readMins: 8,
    lede:
      "A pitch deck is a story, not a document. AI can draft that story in seconds so you spend your energy on the narrative and the numbers instead of formatting. Here's the structure investors expect and how to build it fast.",
    sections: [
      {
        h: "The slides that actually matter",
        list: [
          "Problem — the pain, made concrete",
          "Solution — your product in one clear line",
          "Market — how big the opportunity really is",
          "Product — what it does, shown not told",
          "Traction — proof something is working",
          "Business model — how you make money",
          "Team — why you can pull this off",
          "Ask — what you want and what it buys",
        ],
      },
      {
        h: "Let AI draft, then sharpen",
        p: [
          "Describe your company and round in one line, and an AI PPT maker will lay out these slides with a coherent flow and a clean theme. Then do the part only you can: replace generic claims with your real numbers, your real traction, and your specific ask.",
        ],
      },
      {
        h: "Keep every slide to one idea",
        p: [
          "Investors skim. One message per slide, a headline that states the takeaway, and a chart or a single visual to back it up. If a slide needs a paragraph, it's two slides.",
        ],
      },
      {
        h: "Export and rehearse",
        p: [
          "Export a real .pptx so you can present from anywhere and tweak on the fly, and a PDF for sending ahead. Then rehearse against the clock — a tight ten-slide deck beats a sprawling twenty every time.",
        ],
      },
    ],
    faq: [
      {
        q: "Can AI really build a usable pitch deck?",
        a: "AI builds a strong structural draft — flow, headlines, layout, and charts — in seconds. The founder still supplies the real numbers and story, but you skip the blank-page and formatting work entirely.",
      },
      {
        q: "How many slides should a pitch deck be?",
        a: "Around ten is the sweet spot for an initial pitch: problem, solution, market, product, traction, model, team, and ask, plus a title and a closing slide.",
      },
    ],
    related: ["ai-presentation-maker", "powerpoint-generator", "free-ppt-maker"],
  },
  {
    slug: "ai-ppt-maker-vs-templates",
    title: "AI PPT Maker vs Templates: Which Is Faster?",
    description:
      "Templates or an AI PPT maker? A practical comparison of speed, quality, and control — and when each one is the right call for your next presentation.",
    h1: "AI PPT Maker vs Templates: Which Is Faster?",
    datePublished: "2026-06-02",
    readMins: 5,
    lede:
      "Templates promised to make presentations fast. They help with looks, but they leave the hard part — the words and the structure — entirely to you. Here's how a template workflow compares to an AI PPT maker.",
    sections: [
      {
        h: "Where templates stop",
        p: [
          "A template gives you a color scheme and placeholder boxes. You still have to decide what every slide says, write it, and arrange it. For most people that's 90% of the effort, and a pretty template doesn't touch it.",
        ],
      },
      {
        h: "Where an AI maker starts",
        p: [
          "An AI PPT maker drafts the content and the structure first — the narrative, the headlines, the supporting points — and applies a design on top. You begin editing a real deck instead of filling in blanks.",
        ],
      },
      {
        h: "Speed, head to head",
        list: [
          "Template: pick template, write every slide, format, repeat — 30–60 minutes",
          "AI maker: brief, generate, edit, export — under 10 minutes",
        ],
      },
      {
        h: "When a template still wins",
        p: [
          "If you have a strict brand template you must reuse verbatim, start there. For everything else — a new topic, a fast turnaround, a first draft — an AI maker that exports to real PowerPoint gets you there faster and you can still apply your styling afterward.",
        ],
      },
    ],
    faq: [
      {
        q: "Is an AI PPT maker faster than templates?",
        a: "For most presentations, yes — because it drafts the content and structure, not just the design. Templates leave the writing and arranging to you, which is the slow part.",
      },
      {
        q: "Can I still use my brand styling with an AI maker?",
        a: "Yes. With EXdeck you can switch themes and fonts across the whole deck and edit every element, then export a real .pptx to apply any final brand styling.",
      },
    ],
    related: ["ai-ppt-maker", "free-ppt-maker", "text-to-ppt"],
  },
);

BLOG_POSTS.push(
  {
    slug: "how-we-built-exdeck-architecture",
    title: "How We Built EXdeck: Architecture, Groq, and a Single Deck Object",
    description:
      "An engineering deep-dive into EXdeck — why one typed Deck object holds the whole app, why we render with pure functions, why we chose Groq for generation, and how we treat the LLM as untrusted input.",
    h1: "How We Built EXdeck: The Architecture Behind the AI Deck Builder",
    datePublished: "2026-06-17",
    readMins: 9,
    lede:
      "EXdeck turns a sentence into an editable presentation in about ten seconds, then lets you edit, present, and export it to real PowerPoint and PDF. Under the hood it leans on a few deliberate decisions: one typed Deck object as the single source of truth, pure-function rendering, a fast inference engine, and a healthy distrust of model output. Here's the why behind each.",
    sections: [
      {
        h: "One idea holds the whole app: a single typed Deck object",
        p: [
          "The entire presentation — every slide, its layout, bullets, charts, theme, images, and speaker notes — lives in one TypeScript shape called Deck. Generation produces a Deck. The editor reads and mutates a Deck. Export consumes a Deck. Share links store a Deck. There is no separate \"editor model\" that drifts from a \"render model.\"",
          "This sounds obvious, but it's the decision that keeps the codebase small. Because the shape is typed in one place, the compiler catches the moment a feature forgets a field. New capabilities — a new slide layout, a chart type, a per-slide variant — are added to the type once, and every surface that touches a deck is forced to acknowledge them. No hidden state, no sync bugs between views.",
        ],
      },
      {
        h: "Pure-function rendering: one SlideCanvas, everywhere",
        p: [
          "A slide is rendered by a single component, SlideCanvas, which is a pure function of (slide, theme). That same component draws the slide in the editor, in the thumbnail rail, in full-screen present mode, and in the off-screen capture used to build the PDF.",
          "The payoff is consistency you don't have to maintain. What you edit is exactly what you present and exactly what exports — because it's literally the same render path. There's one source of visual truth, so a styling fix shows up everywhere at once and the PDF can never quietly disagree with the screen.",
        ],
      },
      {
        h: "Why Groq",
        p: [
          "Generation quality matters, but for an interactive tool latency matters just as much. A deck builder that takes 60 seconds to respond feels broken; one that responds in ten feels like magic. We chose Groq because its inference is fast enough to keep the whole flow interactive — a complete multi-slide deck comes back in a single pass in seconds, not minutes.",
          "We run an open Llama model through Groq with a multi-key fallback client: if one key is rate-limited or errors, the request retries on the next automatically. That keeps generation resilient without building a queue. The model is asked for strict JSON, not prose, so the output drops straight into our pipeline.",
        ],
      },
      {
        h: "Treat the model as untrusted input",
        p: [
          "The most important generation decision isn't the prompt — it's what happens after. We never trust raw model output. Every generated slide passes through a validation and cleaning pass: the layout is checked against a whitelist, variant names are validated, text is sanitized and length-capped, tables reject empty columns, and charts are dropped unless they contain real numeric data.",
          "Anything the model under-fills gets caught by a second \"fill\" pass that regenerates only the thin slides with full deck context, so the reader learns something new on every slide. The result is that a flaky or over-eager model can't produce a broken deck — the worst case is a slightly plainer one.",
        ],
        list: [
          "Whitelist layouts and variants — unknown values are discarded, not rendered",
          "Strip placeholder text the model sometimes emits when unsure",
          "Charts only from real figures; otherwise the point is made in words",
          "A fill pass tops up any slide that came back too thin",
        ],
      },
      {
        h: "The server is a thin proxy",
        p: [
          "Almost everything runs in the browser: editing, drag-and-drop, recoloring, theme switching, and even the PDF render. The Next.js API routes only do the things the browser can't or shouldn't: hold the inference key, enforce plan limits server-side so they can't be bypassed, proxy the icon search, and run the library that builds the binary .pptx file.",
          "Keeping the server thin means the editor stays snappy and offline-tolerant, and the security-sensitive logic (who can generate, what's gated, what gets charged) lives in exactly one trustworthy place.",
        ],
      },
      {
        h: "State, persistence, and collaboration",
        p: [
          "Because the deck is one object, persistence is simple: a debounced autosave writes the whole Deck to the database after each change, and an undo stack keeps recent snapshots so an accidental edit or an AI rewrite is one click away from reverting.",
          "Real-time collaboration falls out of the same model. A shared deck is the same Deck object living at a shared location; editors subscribe to it and write the whole object back, with a last-write-wins guard to avoid echo loops. It isn't a custom CRDT — it's the single-object design extended to two people.",
        ],
      },
      {
        h: "Export parity without a second renderer",
        p: [
          "PDF export reuses SlideCanvas: the deck is rendered off-screen and captured, so the PDF is pixel-identical to the editor by construction. PowerPoint export is the one place we maintain a parallel renderer — a server route rebuilds each slide with a .pptx library so the file is genuinely editable in PowerPoint, Keynote, and Google Slides, not a flat image. That's a deliberate cost we pay so users actually own their output.",
        ],
      },
      {
        h: "The throughline",
        p: [
          "None of these choices are exotic. The discipline is in keeping them consistent: one typed object, one render path, a fast model treated as untrusted, and a server that does only what it must. That's what lets a solo-built tool stay coherent while it grows — and it's the part worth understanding, more than any single feature.",
        ],
      },
    ],
    faq: [
      {
        q: "Why Groq instead of a general-purpose API?",
        a: "Speed. For an interactive editor, low latency is a feature — a full deck returning in seconds keeps the flow feeling instant. Groq's inference is fast enough to make that the norm, and a multi-key fallback keeps it resilient under rate limits.",
      },
      {
        q: "How does EXdeck avoid hallucinated data on slides?",
        a: "It treats model output as untrusted. Charts are only created from real, known figures; if a topic has no genuine numbers, the idea is expressed in words instead. Tables reject empty or placeholder cells, and a validation pass discards anything that doesn't fit the schema.",
      },
      {
        q: "What is the 'single Deck object' and why does it matter?",
        a: "The whole presentation lives in one typed shape that every part of the app reads and writes — generation, editor, present mode, export, and sharing. It removes drift between views, makes new features type-safe, and is what keeps the codebase small.",
      },
      {
        q: "Why is the PDF identical to the editor?",
        a: "Both use the same SlideCanvas component to render slides. The PDF is built by capturing that exact render off-screen, so there's no separate PDF layout that could disagree with what you edited.",
      },
    ],
    related: ["best-ai-presentation-maker", "ai-ppt-maker", "how-to-make-a-powerpoint-presentation-from-text"],
  },
);

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
