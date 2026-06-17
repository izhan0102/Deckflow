import { withGroqClient } from "./groqClient";
import type { ResumeData } from "./resumeTypes";

const SYSTEM = `You are an expert resume editor. You polish the wording of an existing
resume to make the candidate stand out — WITHOUT inventing anything.

HARD RULES:
- Never invent or change facts: no new employers, job titles, dates, numbers,
  metrics, schools, skills, or technologies that aren't already present.
- Only rephrase what's given. If a bullet has no number, do NOT add one.
- Make bullets impactful: strong action verbs, concise, results-oriented,
  ATS-friendly. Keep each bullet to one line where possible.
- Fix grammar, spelling, capitalization, and professionalism.
- Keep the SAME number of experience entries and the SAME number of bullets per
  entry, in the same order. Keep the same number of projects, in order.
- Output ONLY JSON, no prose.`;

function extractJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  return a !== -1 && b !== -1 ? s.slice(a, b + 1) : s;
}

/** Improve the text of a resume (headline, summary, experience bullets,
 *  project descriptions) without changing any facts. Returns a new ResumeData. */
export async function refineResume(resume: ResumeData): Promise<ResumeData> {
  const payload = {
    headline: resume.headline || "",
    summary: resume.summary || "",
    experience: resume.experience.map((e) => ({ role: e.role, company: e.company, bullets: e.bullets.filter(Boolean) })),
    projects: resume.projects.map((p) => ({ name: p.name, description: p.description || "" })),
  };

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Polish this resume's wording. Return JSON of the SAME shape:\n${JSON.stringify(payload)}\n\nReturn: { "headline": string, "summary": string, "experience": [ { "bullets": [string] } ], "projects": [ { "description": string } ] }`,
        },
      ],
    }),
  );

  let parsed: any = {};
  try { parsed = JSON.parse(extractJson(completion.choices[0]?.message?.content || "{}")); } catch { return resume; }

  const out: ResumeData = { ...resume };
  if (typeof parsed.headline === "string" && parsed.headline.trim()) out.headline = parsed.headline.trim();
  if (typeof parsed.summary === "string" && parsed.summary.trim()) out.summary = parsed.summary.trim();

  if (Array.isArray(parsed.experience)) {
    out.experience = resume.experience.map((e, i) => {
      const p = parsed.experience[i];
      const bullets = Array.isArray(p?.bullets) ? p.bullets.map((b: any) => String(b)).filter((b: string) => b.trim()) : null;
      return bullets && bullets.length ? { ...e, bullets } : e;
    });
  }
  if (Array.isArray(parsed.projects)) {
    out.projects = resume.projects.map((p, i) => {
      const np = parsed.projects[i];
      return typeof np?.description === "string" && np.description.trim() ? { ...p, description: np.description.trim() } : p;
    });
  }
  return out;
}
