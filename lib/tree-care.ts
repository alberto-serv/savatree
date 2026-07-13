/**
 * SavATree — Tree Care Estimator
 * ------------------------------------------------------------------
 * Tree work is SavATree's core revenue and is NOT quotable online today.
 * Not because it's unquotable — because of two things:
 *
 *   1. Coverage — 74 branches carry different service sets. A config problem,
 *      not a pricing problem.
 *   2. The arborist visit IS the cross-sell engine. They quote a removal and
 *      leave having sold a Plant Health Care program.
 *
 * So the rule this module encodes:
 *
 *   ⚠️ A RANGE IS QUOTABLE. A FIRM PRICE IS NOT.
 *
 * We never try to eliminate the arborist visit. We make it instant to book and
 * better prepared. Inputs split into two buckets:
 *
 *   Customer can supply  → height, diameter, count, what they want done.
 *   Only an arborist can → internal decay, true drop zone, equipment access,
 *                          power-line proximity, haul distance.
 *
 * The second bucket does NOT block an estimate. It WIDENS THE BAND. An honest
 * wide range ("$4,500–$11,600 — an arborist needs to narrow this") beats a
 * fake-precise number, and it protects against underquote liability on
 * hazardous removals.
 *
 * Pure functions only. No UI, no fetch, no dependencies.
 * ------------------------------------------------------------------
 */

import {
  assessProtection,
  protectionUpsell,
  CA_ORDINANCE_DISCLAIMER,
  type TreeSpecies,
  type PermitAssessment,
  type PermitPolicy,
} from "./california-trees";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type TreeJob = "removal" | "pruning" | "cabling";
export type Confidence = "high" | "medium" | "low";
export type NextStep = "book_job" | "book_assessment" | "dispatch";

export interface PriceBand {
  low: number;
  high: number;
}

export interface TreeInputs {
  job: TreeJob;
  heightFt: number;
  diameterInches?: number; // DBH
  count?: number; // default 1
  access?: "open" | "moderate" | "tight"; // default "moderate"
  proximity?: "open_yard" | "near_structure" | "over_structure_or_lines"; // default "near_structure"
  condition?: "healthy" | "declining" | "dead_or_decayed"; // default "healthy"
  lean?: "none" | "moderate" | "severe"; // default "none"
  addStumpGrinding?: boolean;
  /**
   * California only. Omit it and the model behaves exactly as it always has —
   * no permits, no ordinance logic. Supply it and protected-tree rules apply
   * (see california-trees.ts), because in California the city is frequently the
   * single largest cost and delay in a removal.
   */
  species?: TreeSpecies;
}

export interface TreeEstimate {
  job: TreeJob;
  estimate: PriceBand; // total, all trees, incl. stump grinding and permits
  perTree: PriceBand;
  count: number;
  confidence: Confidence;
  spreadPct: number; // ACTUAL band width, derived — not an input assumption
  nextStep: NextStep;
  factors: string[]; // plain-language reasons the band is this wide
  needsArboristBecause: string[]; // what must be seen in person
  upsell: string | null;
  lines: { label: string; band: PriceBand }[];
  disclaimer: string;
  /** True when the branch's truck-roll minimum lifted the price. */
  minimumApplied: boolean;
  /** Present only when a species was supplied. See california-trees.ts. */
  permit?: PermitAssessment;
}

/** A cost multiplier plus how much its unknowns force the band open. */
interface Factor {
  /** Cost multiplier. */
  m: number;
  /** Uncertainty weight — how much this factor's unknowns widen the band. */
  u: number;
  /** Plain-language reason, surfaced to the customer. Null when it adds nothing. */
  note: string | null;
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

/**
 * ⚠️ THE RATE CARD IS A PARAMETER, NOT A CONSTANT.
 *
 * Everything below is what a tree job costs, and what a tree job costs is a
 * branch's business. A branch with a crane and a chipper truck does not price a
 * 70-foot removal like a branch that subs the crane in; a branch whose climbers
 * are booked six weeks out does not price pruning like one that isn't.
 *
 * So these ship as DEFAULT_TREE_RATES — the national benchmark figures the
 * calibration anchors in tree-care.test.ts are built on — and the branch manager
 * overrides them in /config. Pass nothing and you get corporate, unchanged.
 *
 * NOTE: no Infinity in here. This round-trips through JSON.stringify into a
 * branch's localStorage, and JSON turns Infinity into null — which would silently
 * delete the tallest price band. The top band is bounded by a number no tree will
 * ever reach instead.
 */
export interface TreeRateCard {
  /** Base $/tree by height. Removal is the reference job; every other job is a fraction of it. */
  heightBands: { maxFt: number; band: PriceBand }[];
  /** Each job as a fraction of the removal base. */
  jobFactor: Record<TreeJob, number>;
  stump: {
    perInch: PriceBand;
    minCharge: number;
    additionalStump: PriceBand;
  };
  /**
   * The truck-roll floor. A crew, a chipper, and a two-hour round trip cost the
   * same whether the tree is 12 feet or 30, and a branch that quotes below this
   * is paying for the privilege of doing the work. 0 = no floor.
   */
  minimumJobCharge: number;
  /** Above this height, nothing books a crew directly — it books an arborist. */
  directBookMaxHeightFt: number;
}

export const DEFAULT_TREE_RATES: TreeRateCard = {
  heightBands: [
    { maxFt: 30, band: { low: 400, high: 850 } },
    { maxFt: 60, band: { low: 850, high: 1900 } },
    { maxFt: 80, band: { low: 1900, high: 3300 } },
    { maxFt: 999, band: { low: 3000, high: 5500 } },
  ],
  jobFactor: {
    removal: 1.0,
    pruning: 0.42,
    cabling: 0.35,
  },
  stump: {
    perInch: { low: 4, high: 7 },
    minCharge: 160,
    additionalStump: { low: 40, high: 70 },
  },
  minimumJobCharge: 0,
  directBookMaxHeightFt: 30,
};

const ACCESS: Record<NonNullable<TreeInputs["access"]>, Factor> = {
  open: { m: 1.0, u: 0.0, note: null },
  moderate: { m: 1.25, u: 0.08, note: "Limited equipment access" },
  tight: { m: 1.8, u: 0.22, note: "Crane or full climb likely — biggest single cost driver" },
};

const PROXIMITY: Record<NonNullable<TreeInputs["proximity"]>, Factor> = {
  open_yard: { m: 1.0, u: 0.0, note: null },
  near_structure: { m: 1.35, u: 0.12, note: "Rigging required near structures" },
  over_structure_or_lines: {
    m: 1.75,
    u: 0.25,
    note: "Sectional rigging over a target; utility coordination may be needed",
  },
};

const CONDITION: Record<NonNullable<TreeInputs["condition"]>, Factor> = {
  healthy: { m: 1.0, u: 0.0, note: null },
  declining: { m: 1.15, u: 0.1, note: "Declining wood is less predictable to rig" },
  dead_or_decayed: {
    m: 1.4,
    u: 0.28,
    note: "Internal decay can't be assessed from the ground — arborist required",
  },
};

const LEAN: Record<NonNullable<TreeInputs["lean"]>, Factor> = {
  none: { m: 1.0, u: 0.0, note: null },
  moderate: { m: 1.15, u: 0.06, note: null },
  severe: { m: 1.35, u: 0.18, note: "Severe lean changes the drop zone" },
};

/**
 * ⚠️ LOAD-BEARING. The raw product of the worst case compounds to ~6×
 * (1.8 × 1.75 × 1.4 × 1.35), which prices a residential removal at ~$40,000.
 * Real-world worst case — crane removal of a decayed leaner over a house —
 * tops out around 2.4× base. Do not remove this ceiling.
 */
const MULT_CEILING = 2.4;

/** A range so wide it's meaningless is just a refusal with extra steps. */
const UNCERTAINTY_CAP = 0.5;

/** How hard uncertainty pushes each endpoint outward. */
const SPREAD_WEIGHT = 0.4;

/** Any factor at or above this must be seen in person. */
const ARBORIST_THRESHOLD = 0.2;

/**
 * Direct booking skips the arborist visit — and the visit is the cross-sell
 * engine. SavATree may want this off entirely, so it's a flag, not a constant
 * buried in a branch.
 */
export const ALLOW_DIRECT_BOOKING = true;

export const DISCLAIMER_BOOKABLE =
  "Estimate only. Final pricing is confirmed by your crew on site and may vary with access, species, and local branch rates.";

export const DISCLAIMER_ASSESSMENT =
  "This is an estimated range, not a firm price. Internal decay, true drop zone, and equipment access can only be judged on site — your arborist will confirm the final number before any work begins.";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const round = (n: number): number => Math.round(n);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function baseForHeight(heightFt: number, bands: TreeRateCard["heightBands"]): PriceBand {
  return (bands.find((b) => heightFt <= b.maxFt) ?? bands[bands.length - 1]).band;
}

/** Rule of thumb: a tree's DBH in inches runs about a third of its height in feet. */
function expectedDbh(heightFt: number): number {
  return heightFt / 3;
}

const JOB_LABEL: Record<TreeJob, string> = {
  removal: "Tree removal",
  pruning: "Tree pruning",
  cabling: "Cabling & bracing",
};

/**
 * Stump grinding, at the branch's own rates. Exported because the stump-grinding
 * PROJECT is the same work as the stump-grinding ADD-ON to a removal — pricing
 * them from two different tables is how the same customer gets two different
 * numbers for the same stump.
 */
export function priceStumpGrinding(
  diameterInches: number,
  count: number,
  stump: TreeRateCard["stump"] = DEFAULT_TREE_RATES.stump,
): PriceBand {
  const first: PriceBand = {
    low: Math.max(stump.minCharge, diameterInches * stump.perInch.low),
    high: Math.max(stump.minCharge, diameterInches * stump.perInch.high),
  };
  const extra = Math.max(0, count - 1);
  return {
    low: first.low + extra * stump.additionalStump.low,
    high: first.high + extra * stump.additionalStump.high,
  };
}

// ─────────────────────────────────────────────────────────────────
// The estimator
// ─────────────────────────────────────────────────────────────────

export interface EstimateOptions {
  /** Override the module default. Off → everything routes to an arborist. */
  allowDirectBooking?: boolean;
  /**
   * Branch labor index. The HEIGHT_BANDS above are national benchmark figures;
   * a crew-hour in San Jose does not cost what a crew-hour costs in Ohio. The
   * branch manager sets this in /config, and it scales the tree-work bands —
   * NOT the permit costs, which are set by a city and don't care what we pay
   * our climbers.
   *
   * 1.0 = the national anchors, unchanged.
   */
  rateIndex?: number;
  /** The city's tree ordinance. Defaults to the conservative California pattern. */
  permitPolicy?: PermitPolicy;
  /** The branch's tree rate card. Defaults to the corporate benchmark figures. */
  rates?: TreeRateCard;
}

export function estimateTreeWork(i: TreeInputs, opts: EstimateOptions = {}): TreeEstimate {
  if (!(i.heightFt > 0)) throw new Error("heightFt must be a positive number");
  const rateIndex = opts.rateIndex ?? 1;
  const rates = opts.rates ?? DEFAULT_TREE_RATES;

  const count = Math.max(1, Math.floor(i.count ?? 1));
  const access = ACCESS[i.access ?? "moderate"];
  const proximity = PROXIMITY[i.proximity ?? "near_structure"];
  const condition = CONDITION[i.condition ?? "healthy"];
  const lean = LEAN[i.lean ?? "none"];

  // 1. Base for the height band, at the branch's rates.
  const base = baseForHeight(i.heightFt, rates.heightBands);

  // 2. Diameter refinement — a thick-for-height tree is simply more wood.
  //    Clamped, because DBH is a correction, not a second pricing axis.
  const dbhAdj =
    i.diameterInches !== undefined
      ? clamp(i.diameterInches / expectedDbh(i.heightFt), 0.8, 1.2)
      : 1.0;

  // 3. Stack the multipliers — under a ceiling. See MULT_CEILING.
  const mult = Math.min(access.m * proximity.m * condition.m * lean.m, MULT_CEILING);

  // 4. Accumulate uncertainty, capped.
  const uncertainty = Math.min(access.u + proximity.u + condition.u + lean.u, UNCERTAINTY_CAP);

  // 5. Derive the band from the base's OWN endpoints. Widening a midpoint would
  //    double-count risk: the base band already encodes ordinary variation.
  const jobFactor = rates.jobFactor[i.job];
  const perTreeLow = base.low * dbhAdj * jobFactor * mult * rateIndex * (1 - uncertainty * SPREAD_WEIGHT);
  const perTreeHigh = base.high * dbhAdj * jobFactor * mult * rateIndex * (1 + uncertainty * SPREAD_WEIGHT);

  // 6. Report the spread we actually produced, not the one we assumed.
  const mid = (perTreeLow + perTreeHigh) / 2;
  const spreadPct = round(((perTreeHigh - mid) / mid) * 100);

  // 7. Scale by count, then apply the branch's truck-roll floor. The floor lifts
  //    the LINE, not just the total — an itemization that sums to less than the
  //    number above it is how a customer decides you're padding the bill.
  const lines: { label: string; band: PriceBand }[] = [];
  const raw: PriceBand = { low: perTreeLow * count, high: perTreeHigh * count };
  const floor = rates.minimumJobCharge;
  const minimumApplied = floor > raw.low + 1e-9;
  const treeWork: PriceBand = {
    low: Math.max(floor, raw.low),
    high: Math.max(floor, raw.high),
  };

  lines.push({
    label: `${JOB_LABEL[i.job]} — ${count} tree${count === 1 ? "" : "s"}, ${i.heightFt} ft`,
    band: { low: round(treeWork.low), high: round(treeWork.high) },
  });

  let total: PriceBand = { ...treeWork };

  const dbh = i.diameterInches ?? round(expectedDbh(i.heightFt));

  if (i.addStumpGrinding && i.job === "removal") {
    // Grinding is labor too — it moves with the branch's rate index.
    const rawStump = priceStumpGrinding(dbh, count, rates.stump);
    const stump = { low: rawStump.low * rateIndex, high: rawStump.high * rateIndex };
    total = { low: total.low + stump.low, high: total.high + stump.high };
    lines.push({
      label: `Stump grinding — ${dbh}" diameter${count > 1 ? ` × ${count}` : ""}`,
      band: { low: round(stump.low), high: round(stump.high) },
    });
  }

  // 8. California: the city is part of the price. A protected-tree permit, its
  //    arborist report, and its replacement planting are real money the customer
  //    will pay, so they belong in the estimate — itemized, so it's visible that
  //    they're paying the city and not us.
  // The permit is the CITY's price, not ours: it is deliberately not touched by
  // the branch rate index. A $400 filing fee doesn't rise because our climbers
  // cost more in San Jose.
  const permit = i.species
    ? assessProtection(
        { species: i.species, dbhInches: dbh, job: i.job, count, condition: i.condition },
        opts.permitPolicy,
      )
    : undefined;

  if (permit?.cost) {
    total = { low: total.low + permit.cost.low, high: total.high + permit.cost.high };
    permit.lines.forEach((l) =>
      lines.push({ label: l.label, band: { low: round(l.band.low), high: round(l.band.high) } }),
    );
  }

  // 9. Say out loud why the band is the width it is.
  const factors = [
    ...[access, proximity, condition, lean].map((f) => f.note).filter((n): n is string => n !== null),
    // Say it out loud rather than letting a suspiciously round number sit there
    // unexplained. A crew and a chipper cost the same for a small tree.
    ...(minimumApplied
      ? [`Our minimum for a tree job is $${round(floor)} — a crew and a truck cost the same for a small tree.`]
      : []),
    ...(permit?.reasons ?? []),
  ];

  const needsArboristBecause = [
    ...[access, proximity, condition, lean]
      .filter((f) => f.u >= ARBORIST_THRESHOLD && f.note !== null)
      .map((f) => f.note as string),
    // A permit is not something the customer can sort out from a web form.
    ...(permit?.isProtected
      ? [
          permit.basis === "unidentified"
            ? "Identifying the species — it decides whether this needs a city permit at all"
            : "Confirming your city's tree ordinance and filing the permit on your behalf",
        ]
      : []),
  ];

  // 10. Confidence follows uncertainty, not price.
  const confidence: Confidence =
    uncertainty >= 0.35 ? "low" : uncertainty >= 0.15 ? "medium" : "high";

  // 11. The key product decision. Small, clean, healthy, open-access work books
  //     outright. EVERYTHING ELSE BOOKS THE ARBORIST, NOT THE JOB.
  //
  //     A protected tree is never bookable, at any size. You cannot sell a
  //     removal that the city has not approved — and may never approve. Booking a
  //     crew against a permit that doesn't exist is how a customer ends up with a
  //     fine and SavATree ends up in it with them.
  const allowDirectBooking = opts.allowDirectBooking ?? ALLOW_DIRECT_BOOKING;
  const bookable =
    allowDirectBooking &&
    confidence === "high" &&
    i.heightFt <= rates.directBookMaxHeightFt &&
    (i.condition ?? "healthy") === "healthy" &&
    !(permit?.isProtected && permit.cost !== null);
  const nextStep: NextStep = bookable ? "book_job" : "book_assessment";

  // The permit dominates the conversation when there is one: "the city may say
  // no" outranks "your tree might be savable", and it leads to the same place.
  const protectionAdvice = permit ? protectionUpsell(permit) : null;

  return {
    job: i.job,
    estimate: { low: round(total.low), high: round(total.high) },
    perTree: { low: round(perTreeLow), high: round(perTreeHigh) },
    count,
    confidence,
    spreadPct,
    nextStep,
    factors,
    needsArboristBecause,
    upsell: protectionAdvice ?? upsellFor(i),
    lines,
    minimumApplied,
    disclaimer:
      (nextStep === "book_job" ? DISCLAIMER_BOOKABLE : DISCLAIMER_ASSESSMENT) +
      (permit?.isProtected ? ` ${CA_ORDINANCE_DISCLAIMER}` : ""),
    permit,
  };
}

/** SavATree's actual business model: the visit sells the program. Encode it. */
function upsellFor(i: TreeInputs): string | null {
  const condition = i.condition ?? "healthy";

  if (i.job === "removal" && condition !== "dead_or_decayed") {
    return "Trees this size are often savable. Your arborist will assess whether treatment is an option before removal — the assessment is free.";
  }
  if (i.job === "pruning" && condition === "declining") {
    return "Declining canopy is often a soil or pest issue. Ask your arborist about a Plant Health Care plan alongside the pruning.";
  }
  return null;
}

/**
 * Storm/emergency skips pricing entirely. Nobody with a tree on their roof
 * wants a pricing wizard.
 */
export function triageEmergency(): { nextStep: NextStep; message: string } {
  return {
    nextStep: "dispatch",
    message:
      "This is an emergency. Skip the estimate — we'll get a crew dispatched and price it on site.",
  };
}
