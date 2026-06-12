/**
 * Subscription plans — the single source of truth for pricing, monthly
 * deck limits, and which features each tier unlocks.
 *
 * This is used everywhere: the pricing section, the dashboard upgrade
 * modal, client-side feature locks, and server-side enforcement on the
 * API routes. Keeping it in one place means a plan change only happens
 * here.
 *
 * NOTE: nobody can actually subscribe yet — every user is "free" and the
 * upgrade buttons say "coming soon". The gating logic below is still
 * enforced so the experience (and the locks) are real today.
 */

export type PlanId = "free" | "pro" | "proplus";

/** Feature flags a plan can unlock. Keep these stable — both the client
 *  and the server reference them by string. */
export type PlanFeature =
  | "speakerNotes"   // AI speaker notes + teleprompter
  | "qaPrep"         // Q&A prep
  | "translate"      // one-click deck translation
  | "icons"          // add icons from the editor
  | "reorder"        // reorder / move slides in the rail
  | "handout";       // export a notes-page handout PDF

export type Plan = {
  id: PlanId;
  name: string;
  /** Monthly price in USD. */
  price: number;
  /** Decks a user may generate per calendar month. Infinity = unlimited. */
  decksPerMonth: number;
  /** One-line positioning used on cards. */
  tagline: string;
  /** Features unlocked by this plan. */
  features: Record<PlanFeature, boolean>;
  /** Human-readable bullets for the pricing card. */
  highlights: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    decksPerMonth: 3,
    tagline: "Try it out, no card needed.",
    features: {
      speakerNotes: false,
      qaPrep: false,
      translate: false,
      icons: false,
      reorder: false,
      handout: false,
    },
    highlights: [
      "3 decks per month",
      "Full AI deck generation",
      "All themes, fonts, and layouts",
      "PDF and PPTX export",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 5,
    decksPerMonth: 10,
    tagline: "For people who present often.",
    features: {
      speakerNotes: true,
      qaPrep: true,
      translate: false,
      icons: true,
      reorder: true,
      handout: true,
    },
    highlights: [
      "10 decks per month",
      "AI speaker notes + teleprompter",
      "Q&A prep",
      "Notes handout PDF export",
      "Add icons from the editor",
      "Reorder slides freely",
    ],
  },
  proplus: {
    id: "proplus",
    name: "Pro Plus",
    price: 10,
    decksPerMonth: Infinity,
    tagline: "Everything, no limits.",
    features: {
      speakerNotes: true,
      qaPrep: true,
      translate: true,
      icons: true,
      reorder: true,
      handout: true,
    },
    highlights: [
      "Unlimited decks",
      "Everything in Pro",
      "One-click deck translation",
      "Priority access to new features",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "proplus"];
export const DEFAULT_PLAN: PlanId = "free";

/** Coerce any value into a valid PlanId, defaulting to free. */
export function normalizePlan(value: unknown): PlanId {
  return value === "pro" || value === "proplus" ? value : "free";
}

export function getPlan(id: PlanId): Plan {
  return PLANS[normalizePlan(id)];
}

/** Whether a plan unlocks a given feature. */
export function planHasFeature(id: PlanId, feature: PlanFeature): boolean {
  return !!PLANS[normalizePlan(id)].features[feature];
}

/** Monthly deck allowance for a plan (Infinity = unlimited). */
export function planDeckLimit(id: PlanId): number {
  return PLANS[normalizePlan(id)].decksPerMonth;
}

/** A short label for the deck allowance, e.g. "3", "10", or "Unlimited". */
export function deckLimitLabel(id: PlanId): string {
  const n = planDeckLimit(id);
  return n === Infinity ? "Unlimited" : String(n);
}

/** Free plans carry the "Made with EXdeck" watermark on slides/exports. */
export function planShowsWatermark(id: PlanId): boolean {
  return normalizePlan(id) === "free";
}
