/**
 * Model benchmark for Deckflow's structured-edit routes.
 *
 * Compares three Groq models on the JSON-emitting tasks that power
 * /api/edit-slide and /api/edit-deck:
 *
 *   - openai/gpt-oss-120b                     (current edit-slide model)
 *   - meta-llama/llama-4-scout-17b-16e-instruct
 *   - openai/gpt-oss-20b
 *
 * For each task we send the same system + user message, force JSON output,
 * measure latency, and run a deterministic validator that scores how
 * correct the structured response is (right op type, right target index,
 * right field, etc). Each task runs N times so we get median latency and
 * an averaged accuracy score that isn't a fluke of one lucky sample.
 *
 * Run:  node --env-file=.env.local scripts/model-bench.mjs
 */

import Groq from "groq-sdk";

const KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_FALLBACK,
  process.env.GROQ_API_KEY_FALLBACK_2,
].filter(Boolean);

if (KEYS.length === 0) {
  console.error("No GROQ_API_KEY found. Run with: node --env-file=.env.local scripts/model-bench.mjs");
  process.exit(1);
}

const MODELS = [
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-20b",
];

const RUNS_PER_TASK = 3;

/* ----------------------------- helpers ----------------------------- */

function extractJson(raw) {
  let s = (raw || "").trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return s;
}

function isHex(s) {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s.trim());
}

function median(nums) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/* ----------------------------- shared prompts ----------------------------- */

const SLIDE_SYSTEM = `You are a slide editor. Output ONLY a JSON patch object. No prose, no markdown.
Available fields (all optional):
{
  "title": string, "subtitle": string, "body": string,
  "bullets": string[], "addBullets": string[], "removeBullets": number[],
  "addAnnotations": [{ "text": string, "anchor": "top-left|top-right|bottom-left|bottom-right|...", "fontSize": number, "color": string }],
  "updateAnnotations": [{ "index": number, "match": { "text": string }, "patch": { "fontSize": number, "fontSizeDelta": number, "color": string, "anchor": string } }],
  "removeAnnotations": number[], "clearAnnotations": boolean,
  "addElements": [{ "kind": "decoration"|"icon", "decorationId": string, "iconQuery": string, "position": "top-left|top-right|bottom-left|bottom-right|center|left|right|top|bottom", "size": "small|medium|large", "color": string, "opacity": number }],
  "updateElements": [{ "id": string, "match": { "iconContains": string }, "patch": { "position": string, "size": string, "sizeDelta": number, "color": string, "opacity": number } }],
  "removeElements": string[],
  "explanation": string
}
Rules:
- "add a X icon" -> addElements with kind "icon" and a short iconQuery.
- "increase size of <text>" / "make <text> bigger" where <text> is an existing annotation -> updateAnnotations matching by text with fontSizeDelta (+6 typical).
- "make it N% transparent" on an existing element -> updateElements with opacity.
- "remove X" where X is NOT present -> return ONLY an explanation saying it's not there. Never add it.
- Always include "explanation". Colors are 6-char hex with leading #.`;

const DECK_SYSTEM = `You are a deck-level editor. Output ONLY JSON: { "ops": [...], "explanation": string }. No prose, no markdown.
Ops:
- { "type": "patchSlide", "index": number, "patch": { "title"?, "subtitle"?, "bullets"?: string[], "addBullets"?: string[] } }
- { "type": "addSlide", "afterIndex": number, "slide": { "layout": string, "title": string, "bullets"?: string[] } }
- { "type": "removeSlide", "index": number }
- { "type": "reorderSlides", "newOrder": number[] }
Index rules: "first slide" = 0, "last slide" = slides.length-1, "slide N" = N-1.
When the instruction targets multiple slides (e.g. "first and last"), emit ONE op per target. Do not skip any.
For "make every bullet shorter", emit one patchSlide per content slide (not the hero, not the closing).`;

/* ----------------------------- tasks ----------------------------- */

const TASKS = [
  {
    name: "slide: add red rocket icon top-right",
    system: SLIDE_SYSTEM,
    user: `Current slide: { "layout": "title-hero", "title": "Project Apollo", "elements": [] }
Instruction: "add a rocket icon at top-right in red"
Return ONLY the JSON patch.`,
    validate(j) {
      let score = 0; const notes = [];
      const add = Array.isArray(j.addElements) ? j.addElements[0] : null;
      if (add) { score += 0.3; } else { notes.push("no addElements"); }
      if (add?.kind === "icon") score += 0.2; else notes.push("kind not icon");
      if (add && /rocket/i.test(add.iconQuery || "")) score += 0.2; else notes.push("iconQuery not rocket");
      if (add?.position === "top-right") score += 0.15; else notes.push("position not top-right");
      if (isHex(add?.color)) score += 0.15; else notes.push("color not hex");
      return { score, notes };
    },
  },
  {
    name: "slide: increase size of existing annotation",
    system: SLIDE_SYSTEM,
    user: `Current slide: { "layout": "title-hero", "title": "Project Apollo",
  "annotations": [ { "index": 0, "text": "Hilfmunters", "anchor": "bottom-right", "fontSize": 12 } ] }
Instruction: "increase size of team name"
Return ONLY the JSON patch.`,
    validate(j) {
      let score = 0; const notes = [];
      const upd = Array.isArray(j.updateAnnotations) ? j.updateAnnotations[0] : null;
      if (upd) score += 0.4; else notes.push("no updateAnnotations (likely failed to find existing label)");
      const matchesByText = upd && (/(hilfmunters|team)/i.test(upd?.match?.text || "") || upd?.index === 0);
      if (matchesByText) score += 0.3; else notes.push("did not target the annotation");
      const bumps = upd && (typeof upd?.patch?.fontSizeDelta === "number" || typeof upd?.patch?.fontSize === "number");
      if (bumps) score += 0.3; else notes.push("no size change in patch");
      // Penalize if it wrongly added a NEW annotation instead of editing.
      if (Array.isArray(j.addAnnotations) && j.addAnnotations.length > 0) { score = Math.max(0, score - 0.3); notes.push("wrongly added a new annotation"); }
      return { score, notes };
    },
  },
  {
    name: "slide: remove element that does NOT exist",
    system: SLIDE_SYSTEM,
    user: `Current slide: { "layout": "bullets", "title": "Methodology",
  "bullets": ["Sample size n=240", "Mixed-methods design"], "annotations": [], "elements": [] }
Instruction: "remove the get in touch"
Return ONLY the JSON patch.`,
    validate(j) {
      let score = 0; const notes = [];
      const hasExplanation = typeof j.explanation === "string" && j.explanation.length > 0;
      if (hasExplanation) score += 0.4; else notes.push("no explanation");
      // Must NOT add anything, must NOT fabricate a removal of something absent.
      const addedSomething =
        (Array.isArray(j.addElements) && j.addElements.length) ||
        (Array.isArray(j.addAnnotations) && j.addAnnotations.length) ||
        (Array.isArray(j.bullets));
      if (!addedSomething) score += 0.3; else notes.push("fabricated an edit");
      const noBogusRemoval =
        !(Array.isArray(j.removeAnnotations) && j.removeAnnotations.length) &&
        !(Array.isArray(j.removeElements) && j.removeElements.length) &&
        j.clearAnnotations !== true;
      if (noBogusRemoval) score += 0.3; else notes.push("removed something that wasn't there");
      return { score, notes };
    },
  },
  {
    name: "deck: subtitle on first AND last slide",
    system: DECK_SYSTEM,
    user: `Current deck (slides.length = 6, last index = 5):
[ {"index":0,"layout":"title-hero","title":"Acme Pitch"},
  {"index":1,"layout":"bullets","title":"Problem"},
  {"index":2,"layout":"bullets","title":"Solution"},
  {"index":3,"layout":"table","title":"Traction"},
  {"index":4,"layout":"bullets","title":"Ask"},
  {"index":5,"layout":"closing","title":"Thank you"} ]
Instruction: "add 'Team Rocket' as the subtitle on the first and last slide"
Return ONLY the JSON ops object.`,
    validate(j) {
      let score = 0; const notes = [];
      const ops = Array.isArray(j.ops) ? j.ops : [];
      const patches = ops.filter((o) => o.type === "patchSlide");
      const hitFirst = patches.find((o) => o.index === 0 && /team rocket/i.test(o.patch?.subtitle || ""));
      const hitLast = patches.find((o) => o.index === 5 && /team rocket/i.test(o.patch?.subtitle || ""));
      if (hitFirst) score += 0.45; else notes.push("missed first slide (index 0)");
      if (hitLast) score += 0.45; else notes.push("missed last slide (index 5)");
      if (patches.length === 2) score += 0.1; else notes.push(`expected 2 patches, got ${patches.length}`);
      return { score, notes };
    },
  },
  {
    name: "deck: shorten every bullet (one op per content slide)",
    system: DECK_SYSTEM,
    user: `Current deck (slides.length = 5, last index = 4):
[ {"index":0,"layout":"title-hero","title":"Q3 Update"},
  {"index":1,"layout":"bullets","title":"Revenue","bullets":["Revenue grew 38 percent quarter over quarter driven by enterprise expansion","Net retention reached 124 percent across the install base"]},
  {"index":2,"layout":"bullets","title":"Product","bullets":["We shipped the new onboarding flow which cut activation time dramatically","Hiring closed two senior engineering roles after a long search"]},
  {"index":3,"layout":"bullets","title":"Risks","bullets":["Concentration risk remains because three customers drive most revenue","Infrastructure costs are climbing faster than headcount"]},
  {"index":4,"layout":"closing","title":"Thank you"} ]
Instruction: "make every bullet shorter, under 8 words each"
Return ONLY the JSON ops object.`,
    validate(j) {
      let score = 0; const notes = [];
      const ops = Array.isArray(j.ops) ? j.ops : [];
      const patched = new Set(ops.filter((o) => o.type === "patchSlide").map((o) => o.index));
      // Should patch slides 1, 2, 3 (the content slides), not 0 or 4.
      for (const idx of [1, 2, 3]) {
        if (patched.has(idx)) score += 0.25; else notes.push(`did not patch content slide ${idx}`);
      }
      if (!patched.has(0) && !patched.has(4)) score += 0.25; else notes.push("wrongly patched hero/closing");
      // Bonus check: bullets actually got shorter where provided.
      const anyShort = ops.some((o) =>
        o.type === "patchSlide" && Array.isArray(o.patch?.bullets) &&
        o.patch.bullets.every((b) => String(b).split(/\s+/).length <= 9),
      );
      if (!anyShort) notes.push("bullets not actually shortened");
      return { score: Math.min(1, score), notes };
    },
  },
];

/* ----------------------------- runner ----------------------------- */

async function callModel(client, model, task) {
  const start = Date.now();
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.15,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: task.system },
      { role: "user", content: task.user },
    ],
  });
  const ms = Date.now() - start;
  const raw = completion.choices?.[0]?.message?.content || "";
  const usage = completion.usage || {};
  let parsed = null, parseOk = true;
  try { parsed = JSON.parse(extractJson(raw)); } catch { parseOk = false; }
  let score = 0, notes = ["parse failed"];
  if (parseOk && parsed) ({ score, notes } = task.validate(parsed));
  return { ms, score, parseOk, notes, completionTokens: usage.completion_tokens || 0 };
}

async function main() {
  const client = new Groq({ apiKey: KEYS[0] });
  const results = {}; // model -> { latencies:[], scores:[], parseFails, tokens:[] }
  for (const m of MODELS) results[m] = { latencies: [], scores: [], parseFails: 0, tokens: [] };

  console.log(`\nBenchmarking ${MODELS.length} models on ${TASKS.length} tasks x ${RUNS_PER_TASK} runs each.\n`);

  for (const task of TASKS) {
    console.log(`\n=== TASK: ${task.name} ===`);
    for (const model of MODELS) {
      const runScores = [];
      const runLat = [];
      let lastNotes = [];
      for (let r = 0; r < RUNS_PER_TASK; r++) {
        try {
          const out = await callModel(client, model, task);
          results[model].latencies.push(out.ms);
          results[model].scores.push(out.score);
          results[model].tokens.push(out.completionTokens);
          if (!out.parseOk) results[model].parseFails++;
          runScores.push(out.score);
          runLat.push(out.ms);
          lastNotes = out.notes;
        } catch (e) {
          results[model].parseFails++;
          results[model].scores.push(0);
          runScores.push(0);
          lastNotes = [String(e?.message || e).slice(0, 80)];
        }
        // Gentle spacing to avoid burst rate limits on the free tier.
        await new Promise((r2) => setTimeout(r2, 400));
      }
      const avgScore = runScores.reduce((a, b) => a + b, 0) / runScores.length;
      const medLat = median(runLat);
      console.log(
        `  ${model.padEnd(42)} score ${(avgScore * 100).toFixed(0).padStart(3)}%  med ${String(medLat).padStart(5)}ms` +
        (lastNotes.length && avgScore < 1 ? `   notes: ${lastNotes.join("; ")}` : ""),
      );
    }
  }

  /* ----------------------------- summary ----------------------------- */

  console.log(`\n\n================ SUMMARY ================\n`);
  const rows = MODELS.map((m) => {
    const r = results[m];
    const avgScore = r.scores.reduce((a, b) => a + b, 0) / (r.scores.length || 1);
    const medLat = median(r.latencies);
    const avgLat = r.latencies.reduce((a, b) => a + b, 0) / (r.latencies.length || 1);
    const avgTok = r.tokens.reduce((a, b) => a + b, 0) / (r.tokens.length || 1);
    return { model: m, accuracy: avgScore, medLat, avgLat, parseFails: r.parseFails, avgTok };
  });

  console.log(
    "MODEL".padEnd(42) + "ACCURACY".padStart(10) + "MED LAT".padStart(10) +
    "AVG LAT".padStart(10) + "PARSE FAIL".padStart(12) + "AVG TOK".padStart(10),
  );
  for (const row of rows) {
    console.log(
      row.model.padEnd(42) +
      `${(row.accuracy * 100).toFixed(0)}%`.padStart(10) +
      `${Math.round(row.medLat)}ms`.padStart(10) +
      `${Math.round(row.avgLat)}ms`.padStart(10) +
      `${row.parseFails}`.padStart(12) +
      `${Math.round(row.avgTok)}`.padStart(10),
    );
  }

  // Simple combined ranking: accuracy is king, latency is the tiebreaker.
  // Normalize latency to a 0..1 (faster = higher) and weight 70/30.
  const maxLat = Math.max(...rows.map((r) => r.medLat));
  const ranked = rows
    .map((r) => {
      const latScore = maxLat > 0 ? 1 - r.medLat / maxLat : 0;
      const combined = r.accuracy * 0.7 + latScore * 0.3;
      return { ...r, combined };
    })
    .sort((a, b) => b.combined - a.combined);

  console.log(`\nRanking (70% accuracy / 30% speed):`);
  ranked.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.model}  (combined ${(r.combined * 100).toFixed(0)})`);
  });
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
