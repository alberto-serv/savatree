/**
 * SavATree — California protected trees.
 * ------------------------------------------------------------------
 * In California, the biggest variable in a tree removal is often not the tree.
 * It's the city.
 *
 * Native oaks and coast redwoods are protected by ordinance in most California
 * municipalities. Above a size threshold, removing one requires a permit, and
 * the permit requires an arborist report, a public review period measured in
 * WEEKS, and usually replacement planting or an in-lieu fee. A healthy protected
 * oak may simply be denied — the city's answer is "prune it, treat it, keep it."
 *
 * Which means a quote that says "$2,400, we'll be out Tuesday" is not merely
 * wrong, it's a promise that can end with the customer holding a fine. Fines for
 * unpermitted removal of a protected tree run into thousands of dollars and are
 * commonly assessed per tree.
 *
 * ⚠️ WHAT THIS MODULE IS, AND IS NOT
 *
 * There is no single statewide rule. Protection is set city by city and county
 * by county — thresholds, fees, and review times all differ, and a parcel can
 * sit under both a city ordinance and a county one. This module encodes the
 * COMMON PATTERN across California jurisdictions so the estimator can warn,
 * budget, and set expectations. It is NOT a legal determination for any specific
 * address, and nothing here should be presented to a customer as one.
 *
 * The design rule follows tree-care.ts: an unknown WIDENS the band and routes to
 * an arborist. It never silently resolves in the customer's favor. When we can't
 * tell whether a tree is protected, we say so — over-warning costs a phone call,
 * under-warning costs a fine.
 * ------------------------------------------------------------------
 */

import type { PriceBand, TreeJob } from "./tree-care";

export const CA_ORDINANCE_DISCLAIMER =
  "Tree protection in California is set by your city or county, not the state. Thresholds, fees, and review times vary by jurisdiction, and some parcels fall under both a city and a county ordinance. This is an estimate of what the permit process typically involves, not a legal determination. Your ISA Certified Arborist confirms the rules for your address and files on your behalf.";

// ─────────────────────────────────────────────────────────────────
// Species
// ─────────────────────────────────────────────────────────────────

export type TreeSpecies =
  | "native_oak"       // coast live, valley, blue, black — the most-protected genus in CA
  | "coast_redwood"
  | "other_native"     // sycamore, bay laurel, buckeye, madrone
  | "eucalyptus"
  | "palm"
  | "fruit_ornamental"
  | "other"
  | "unknown";

export interface SpeciesMeta {
  id: TreeSpecies;
  label: string;
  detail: string;
}

export const CA_SPECIES: SpeciesMeta[] = [
  { id: "native_oak", label: "Oak", detail: "Coast live, valley, blue, black" },
  { id: "coast_redwood", label: "Redwood", detail: "Coast redwood" },
  { id: "other_native", label: "Other CA native", detail: "Sycamore, bay, buckeye, madrone" },
  { id: "eucalyptus", label: "Eucalyptus", detail: "Blue gum and relatives" },
  { id: "palm", label: "Palm", detail: "Any palm" },
  { id: "fruit_ornamental", label: "Fruit or ornamental", detail: "Citrus, plum, maple, birch" },
  { id: "other", label: "Something else", detail: "Pine, fir, elm, ash…" },
  { id: "unknown", label: "Not sure", detail: "An arborist will identify it" },
];

/**
 * ⚠️ THE POLICY IS A PARAMETER, NOT A CONSTANT.
 *
 * Every number below is set by a city council, and SavATree's branches don't
 * each serve one city. The San Jose branch alone covers San Jose, Santa Clara,
 * Los Gatos, Saratoga, Cupertino — and their ordinances do not agree with each
 * other about what size oak needs a permit or what the filing fee is.
 *
 * So the module ships DEFAULT_PERMIT_POLICY (the conservative common pattern
 * across California) and every function takes a policy argument. A branch
 * manager who knows their city's actual code enters it in /config and the whole
 * estimator — thresholds, fees, review weeks — moves with them. Nobody has to
 * edit this file to open a branch.
 *
 * Thresholds stay at the CONSERVATIVE end by default: a false "you may need a
 * permit" costs a conversation, a false "you don't" costs a fine.
 */
export interface PermitPolicy {
  /** Whose rules these are. Shown to the customer, so it must be a real place. */
  cityLabel: string;
  /** DBH (trunk diameter at chest height) at which each species is protected. null = not protected by species. */
  speciesDbh: Record<TreeSpecies, number | null>;
  /** Any species this big is typically a protected "heritage" or "landmark" tree. */
  heritageDbh: number;
  /** Filed once per application, however many trees are on it. */
  filing: PriceBand;
  /** Nearly every California protected-removal permit requires one. */
  report: PriceBand;
  /** Replacement planting or in-lieu fee — assessed PER TREE removed. */
  mitigationPerTree: PriceBand;
  /** A dead or hazardous tree is usually expedited or exempt — but still documented. */
  hazardDocumentation: PriceBand;
  /** Heavy pruning of a protected tree is itself permitted in many cities. */
  pruningPermit: PriceBand;
  /** Typical city review window, in weeks. */
  reviewWeeks: [number, number];
  /** Longer, because a contested application goes to a hearing. */
  contestedReviewWeeks: [number, number];
}

export const DEFAULT_PERMIT_POLICY: PermitPolicy = {
  cityLabel: "most California cities",
  speciesDbh: {
    native_oak: 6,        // many cities protect natives from 6–12"; some protect at any size
    coast_redwood: 10,
    other_native: 12,
    eucalyptus: null,
    palm: null,
    fruit_ornamental: null,
    other: null,
    unknown: 6,           // treated as the worst plausible case until identified
  },
  heritageDbh: 24,
  filing: { low: 100, high: 500 },
  report: { low: 300, high: 800 },
  mitigationPerTree: { low: 250, high: 1500 },
  hazardDocumentation: { low: 0, high: 500 },
  pruningPermit: { low: 0, high: 350 },
  reviewWeeks: [3, 8],
  contestedReviewWeeks: [4, 12],
};

const SPECIES_LABEL: Record<TreeSpecies, string> = CA_SPECIES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s.label }),
  {} as Record<TreeSpecies, string>,
);

/**
 * A tile label is a noun on a button; it is not a word you can drop into a
 * sentence. "Removing a Oak" and "Other CA natives are protected" are what you
 * get when you try. Protected species carry their own grammar.
 */
const SPECIES_COPY: Partial<Record<TreeSpecies, { one: string; noun: string; plural: string }>> = {
  native_oak: { one: "an oak", noun: "oak", plural: "Oaks" },
  coast_redwood: { one: "a redwood", noun: "redwood", plural: "Redwoods" },
  other_native: {
    one: "a native sycamore, bay, or buckeye",
    noun: "native",
    plural: "Native sycamores, bays, and buckeyes",
  },
};

// ─────────────────────────────────────────────────────────────────
// Assessment
// ─────────────────────────────────────────────────────────────────

export type ProtectionBasis =
  | "species"        // protected because of what it is
  | "heritage_size"  // protected because of how big it is
  | "unidentified"   // might be protected; nobody has looked at it yet
  | "none";

export interface PermitAssessment {
  isProtected: boolean;
  basis: ProtectionBasis;
  species: TreeSpecies;
  /** Plain-language reasons, surfaced to the customer. */
  reasons: string[];
  /** Permit, report, and mitigation. null when no permit is implicated. */
  cost: PriceBand | null;
  /** Itemized, so the customer sees they're paying the city, not us. */
  lines: { label: string; band: PriceBand }[];
  /** Typical review window, in weeks. null when no permit is implicated. */
  weeks: [number, number] | null;
  /**
   * The one that changes the conversation: a city can refuse to let you remove a
   * healthy protected tree at all.
   */
  mayBeDenied: boolean;
}

const NONE: PermitAssessment = {
  isProtected: false, basis: "none", species: "other",
  reasons: [], cost: null, lines: [], weeks: null, mayBeDenied: false,
};

export interface ProtectionInputs {
  species: TreeSpecies;
  dbhInches: number;
  job: TreeJob;
  count: number;
  /** A dead or hazardous tree is treated differently by nearly every ordinance. */
  condition?: "healthy" | "declining" | "dead_or_decayed";
}

export function assessProtection(
  i: ProtectionInputs,
  policy: PermitPolicy = DEFAULT_PERMIT_POLICY,
): PermitAssessment {
  const { species, dbhInches, job, count } = i;
  const condition = i.condition ?? "healthy";
  const where = policy.cityLabel;

  const speciesThreshold = policy.speciesDbh[species];
  const bySpecies = speciesThreshold !== null && dbhInches >= speciesThreshold;
  const byHeritage = dbhInches >= policy.heritageDbh;

  if (!bySpecies && !byHeritage) return { ...NONE, species };

  const basis: ProtectionBasis =
    species === "unknown" && !byHeritage ? "unidentified" : bySpecies ? "species" : "heritage_size";

  const copy = SPECIES_COPY[species];
  const reasons: string[] = [];

  if (basis === "unidentified") {
    reasons.push(
      `We don't know what this tree is yet. If it's a native oak or a redwood, it's almost certainly protected. Your arborist identifies it on the first visit.`,
    );
  } else if (bySpecies && copy) {
    reasons.push(
      `${copy.plural} of this size (${dbhInches}" trunk) are protected by ordinance in ${where}.`,
    );
  }
  if (byHeritage && !bySpecies) {
    reasons.push(
      `At ${dbhInches}" across, this is heritage-tree size, and ${where} protect any species once it gets this big.`,
    );
  }

  // Cabling and bracing PRESERVE a tree. No city requires a permit to keep a
  // tree alive, and it's frequently what they'd rather you did.
  if (job === "cabling") {
    return {
      isProtected: true,
      basis,
      species,
      reasons: [
        ...reasons,
        "Cabling preserves the tree, so no removal permit is involved, and on a protected tree it's often exactly what the city would rather you did.",
      ],
      cost: null,
      lines: [],
      weeks: null,
      mayBeDenied: false,
    };
  }

  if (job === "pruning") {
    return {
      isProtected: true,
      basis,
      species,
      reasons: [
        ...reasons,
        "Routine pruning is usually fine, but many ordinances cap how much canopy you may take off a protected tree, and heavy pruning can itself need a permit.",
      ],
      cost: { ...policy.pruningPermit },
      lines: [{ label: "Pruning permit, if your city requires one", band: { ...policy.pruningPermit } }],
      weeks: [1, 3],
      mayBeDenied: false,
    };
  }

  // ── Removal ──
  const lines: { label: string; band: PriceBand }[] = [];

  // A dead or hazardous tree is the exception nearly every ordinance carves out.
  // It still has to be documented — you don't get to decide it was dead.
  if (condition === "dead_or_decayed") {
    lines.push({
      label: "Hazard documentation for an expedited or exempt removal",
      band: { ...policy.hazardDocumentation },
    });
    return {
      isProtected: true,
      basis,
      species,
      reasons: [
        ...reasons,
        "Because it's dead or hazardous, most cities allow an expedited (sometimes exempt) removal. Your arborist documents the condition; the city won't take your word for it.",
      ],
      cost: { ...policy.hazardDocumentation },
      lines,
      weeks: [0, 2],
      mayBeDenied: false,
    };
  }

  lines.push(
    { label: "City removal permit (filing fee)", band: { ...policy.filing } },
    { label: "Arborist report required by the permit", band: { ...policy.report } },
    {
      label:
        count > 1
          ? `Replacement planting or in-lieu fee × ${count} trees`
          : "Replacement planting or in-lieu fee",
      band: {
        low: policy.mitigationPerTree.low * count,
        high: policy.mitigationPerTree.high * count,
      },
    },
  );

  const cost = lines.reduce<PriceBand>(
    (sum, l) => ({ low: sum.low + l.band.low, high: sum.high + l.band.high }),
    { low: 0, high: 0 },
  );

  // The hard truth, said out loud. A city that protects a species does not
  // generally let you remove a living one because you'd rather it were gone.
  // (Dead and hazardous trees returned above — they're the exception.)
  const mayBeDenied = bySpecies;

  return {
    isProtected: true,
    basis,
    species,
    reasons: [
      ...reasons,
      "Removal needs a city permit, which means an arborist report and a review period. Plan on weeks, not days.",
      ...(mayBeDenied
        ? [
            `A healthy protected ${copy?.noun ?? "tree"} is often DENIED. Cities want it pruned or treated, not removed. Your arborist will tell you honestly whether this application has a chance before you pay for one.`,
          ]
        : []),
    ],
    cost,
    lines,
    weeks: mayBeDenied ? policy.contestedReviewWeeks : policy.reviewWeeks,
    mayBeDenied,
  };
}

// ─────────────────────────────────────────────────────────────────
// The heads-up, before we know the size
// ─────────────────────────────────────────────────────────────────

/**
 * What we can say the INSTANT someone tells us it's an oak — before they've told
 * us how big it is, and long before there's a price on screen.
 *
 * Protection depends on trunk diameter, which we don't have yet, so this cannot
 * claim the tree IS protected. It states the threshold and lets the customer do
 * the arithmetic on their own tree: "most oaks in a yard clear 6 inches" is a
 * conclusion they can reach faster than we can.
 *
 * Withholding this until the final estimate would be a small con: the permit,
 * the weeks of review, and the real chance of a flat refusal are the facts most
 * likely to change what the customer wants to do, and they should have them
 * before they answer four more questions.
 *
 * null for species that carry no ordinance risk of their own. Those can still be
 * protected by SIZE once the diameter is known — assessProtection() catches that.
 */
export interface SpeciesAdvisory {
  headline: string;
  body: string;
  /** True when a city can refuse the job outright. Changes the whole conversation. */
  mayBeDenied: boolean;
}

export function speciesAdvisory(
  species: TreeSpecies,
  job: TreeJob,
  policy: PermitPolicy = DEFAULT_PERMIT_POLICY,
): SpeciesAdvisory | null {
  const threshold = policy.speciesDbh[species];
  if (threshold === null) return null;

  const where = policy.cityLabel;

  if (species === "unknown") {
    return {
      headline: "Worth identifying before anything else",
      body:
        job === "removal"
          ? `If it turns out to be a native oak or a coast redwood, ${where} protect it — and removal would then need a permit, an arborist report, and weeks of city review, and can be refused outright. Your arborist identifies it on the first visit, free. Until then we assume it might be protected, so the estimate stays wide.`
          : `If it turns out to be a native oak or a coast redwood, ${where} protect it — which can cap how much canopy comes off in one go. Nothing here stops the work; it just changes how it's done. Your arborist identifies it on the first visit, free.`,
      mayBeDenied: job === "removal",
    };
  }

  const copy = SPECIES_COPY[species];
  if (!copy) return null;

  if (job === "cabling") {
    return {
      headline: `${copy.plural} are protected in ${where}`,
      body:
        "Good news for this job: cabling preserves the tree, so no removal permit is involved — and on a protected tree it's frequently what the city would rather you did anyway.",
      mayBeDenied: false,
    };
  }

  if (job === "pruning") {
    return {
      headline: `${copy.plural} are protected in ${where}`,
      body: `Once the trunk is about ${threshold}" across, ordinances typically cap how much canopy may be taken off in one go, and heavy pruning can need a permit of its own. Routine, correct pruning is almost always fine — and it's the work cities prefer to see on a protected tree.`,
      mayBeDenied: false,
    };
  }

  return {
    headline: `Removing ${copy.one} here usually needs the city's permission`,
    body: `Once the trunk is about ${threshold}" across — which most yard ${copy.noun}s are — ${where} require a removal permit, an arborist report, and a review period measured in weeks, not days. And a healthy protected ${copy.noun} is often DENIED: cities want it pruned or treated, not removed. We'll price the permit with the job, and your arborist will tell you honestly whether an application has a chance before you pay for one.`,
    mayBeDenied: true,
  };
}

/**
 * The cross-sell writes itself, and for once it's also the honest advice: if the
 * city won't let you remove the oak, the thing you actually need is a plan to
 * keep it alive.
 */
export function protectionUpsell(a: PermitAssessment): string | null {
  if (!a.isProtected) return null;
  if (a.mayBeDenied) {
    return "If the city denies the removal (and for a healthy protected tree that's common), the way forward is usually pruning plus a Plant Health Care plan. Your arborist will price both, so you're not stuck waiting on a permit to find out.";
  }
  if (a.basis === "unidentified") {
    return "Identifying the species is the first thing your arborist does, and it decides everything downstream: permit or no permit, weeks or days.";
  }
  return null;
}
