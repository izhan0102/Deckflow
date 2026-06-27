import { NextRequest, NextResponse } from "next/server";
import { withGroqClient } from "@/lib/groqClient";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { PlanLimitError } from "@/lib/planServer";
import { requireCredits, deductCredits } from "@/lib/credits";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

/** A correct, minimal Mermaid example per type. The model mimics the exact
 *  grammar and just swaps in the user's content — far more reliable than
 *  free-form generation. */
const EXAMPLES: Record<string, { label: string; code: string }> = {
  flowchart: {
    label: "flowchart",
    code: `flowchart TD
  A(["Start"]) --> B["Do something"]
  B --> C{"Decision?"}
  C -->|Yes| D["Path A"]
  C -->|No| E["Path B"]
  D --> F(["End"])
  E --> F`,
  },
  architecture: {
    label: "system architecture flowchart",
    code: `flowchart TD
  UI["Browser / UI"] --> API["API Gateway"]
  API --> Svc["Service"]
  API --> DB[("Database")]
  Svc --> Cache[("Cache")]`,
  },
  network: {
    label: "network diagram",
    code: `flowchart TD
  Router["Router"] --> Switch["Switch"]
  Switch --> PC1["PC"]
  Switch --> Printer["Printer"]
  Switch --> AP["Wi-Fi AP"]`,
  },
  orgchart: {
    label: "org chart",
    code: `flowchart TD
  CEO["CEO"] --> CTO["CTO"]
  CEO --> CFO["CFO"]
  CEO --> COO["COO"]
  CTO --> Eng["Engineering"]`,
  },
  decision: {
    label: "decision tree",
    code: `flowchart TD
  Q{"Is it urgent?"} -->|Yes| A["Handle now"]
  Q -->|No| B{"Important?"}
  B -->|Yes| C["Schedule it"]
  B -->|No| D["Drop it"]`,
  },
  sequence: {
    label: "sequence diagram",
    code: `sequenceDiagram
  participant Client
  participant Server
  participant DB
  Client->>Server: Request
  Server->>DB: Query
  DB-->>Server: Result
  Server-->>Client: Response`,
  },
  mindmap: {
    label: "mind map",
    code: `mindmap
  root((Main Topic))
    Subtopic A
      Detail 1
    Subtopic B
      Detail 2`,
  },
  timeline: {
    label: "timeline",
    code: `timeline
  title Project Timeline
  2023 : Kickoff
  2024 : Beta launch
  2025 : GA release`,
  },
  er: {
    label: "entity-relationship diagram",
    code: `erDiagram
  USER ||--o{ ORDER : places
  USER {
    string id PK
    string name
  }
  ORDER {
    string id PK
    string user_id FK
  }`,
  },
};

/** Strip ```mermaid fences and any stray prose before the diagram keyword. */
function cleanMermaid(s: string): string {
  let t = (s || "").trim();
  const fence = t.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  else t = t.replace(/^```(?:mermaid)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Drop any leading prose lines before the first real Mermaid diagram keyword.
  const KW = /^(flowchart|graph|sequenceDiagram|mindmap|timeline|erDiagram|classDiagram|stateDiagram(?:-v2)?|gantt|journey|gitGraph|pie|quadrantChart)\b/;
  const lines = t.split("\n");
  const start = lines.findIndex((l) => KW.test(l.trim()));
  if (start > 0) t = lines.slice(start).join("\n").trim();
  return t;
}

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("visualize");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireCredits(uid);

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").trim().slice(0, 4000);
    const type = String(body?.type || "flowchart").trim();
    const fix = String(body?.fix || "").trim().slice(0, 4000);

    if (!fix && prompt.length < 3) {
      return NextResponse.json({ error: "Describe the diagram first (min 3 characters)." }, { status: 400 });
    }

    let system: string;
    let userMsg: string;
    if (fix) {
      system = "You fix Mermaid v11 diagram code. The code below failed to render with the given error. Return a corrected version that parses cleanly and preserves the original intent. Output ONLY the corrected Mermaid code — no prose, no markdown fences.";
      userMsg = `CODE:\n${fix}\n\nERROR:\n${String(body?.error || "").slice(0, 400)}`;
    } else {
      const ex = EXAMPLES[type] || EXAMPLES.flowchart;
      const firstLine = ex.code.split("\n")[0];
      system = `You are a diagramming assistant. Output ONLY valid Mermaid v11 code — no prose, no explanation, no markdown code fences.
Produce a ${ex.label} for the user's topic, using EXACTLY this Mermaid grammar and structure. Keep the same keywords, node shapes, and arrow styles — just replace the example's content with content for the user's topic:

${ex.code}

Strict rules:
- The first line MUST be exactly: ${firstLine}
- Wrap EVERY node label that contains a space or punctuation as a short id + quoted label, e.g. A["User signs in"]. Never put raw spaces inside a node id.
- Use only the syntax shown in the example above — do not invent new syntax. Keep it to 4-12 nodes.
- Output the diagram code only — nothing before it and nothing after it.`;
      userMsg = prompt;
    }

    const completion = await withGroqClient((client) =>
      client.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    );

    const mermaid = cleanMermaid(completion.choices[0]?.message?.content || "");
    if (!mermaid) {
      return NextResponse.json({ error: "Couldn't generate a diagram — try rephrasing." }, { status: 502 });
    }

    deductCredits(uid, "visualize").catch(() => {});
    return NextResponse.json({ mermaid, type });
  } catch (err: any) {
    if (err instanceof PlanLimitError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    const status = Number(err?.status || err?.statusCode || 0) || 500;
    const msg = String(err?.message || "Diagram generation failed.");
    // eslint-disable-next-line no-console
    console.error("[/api/diagram] error:", err);
    return NextResponse.json({ error: msg, code: /rate|quota/i.test(msg) ? "rate_limit" : "unknown" }, { status });
  }
}
