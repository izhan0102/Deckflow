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
  | "handout"        // export a notes-page handout PDF
  | "density"        // rewrite the whole deck at a new content density
  | "template";      // switch the whole deck to a different template

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
      density: false,
      template: false,
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
      density: true,
      template: true,
    },
    highlights: [
      "10 decks per month",
      "AI speaker notes + teleprompter",
      "Q&A prep",
      "Change deck density & template anytime",
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
      density: true,
      template: true,
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

/**
 * Contributor free-Pro-Plus promo deadline. New activations are accepted
 * only up to this moment; the granted pass itself still lasts a month from
 * whenever it's activated. (June 25, 2026, end of day UTC.)
 */
export const PROMO_OFFER_END = Date.UTC(2026, 5, 25, 23, 59, 59, 999);

/** Whether the contributor promo is still accepting activations. */
export function isPromoOpen(now: number = Date.now()): boolean {
  return now <= PROMO_OFFER_END;
}

/** Coerce any value into a valid PlanId, defaulting to free. */
export function normalizePlan(value: unknown): PlanId {
  return value === "pro" || value === "proplus" ? value : "free";
}

/**
 * Resolve the effective plan from a `plans/{uid}` node, honoring an
 * optional expiry. The node may be a bare tier string (legacy shape) or
 * an object like `{ tier, expiresAt }`. A paid tier whose `expiresAt`
 * has passed falls back to free, so time-limited grants auto-expire
 * everywhere the plan is read (client and server) without a cron job.
 */
export function resolvePlanFromNode(node: unknown, now: number = Date.now()): PlanId {
  if (!node) return DEFAULT_PLAN;
  if (typeof node === "string") return normalizePlan(node);
  if (typeof node === "object") {
    const obj = node as { tier?: unknown; expiresAt?: unknown };
    const tier = normalizePlan(obj.tier);
    if (tier !== "free" && typeof obj.expiresAt === "number" && now > obj.expiresAt) {
      return DEFAULT_PLAN;
    }
    return tier;
  }
  return DEFAULT_PLAN;
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
