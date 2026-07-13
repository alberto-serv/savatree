/**
 * SavATree — Program Catalog & Pricing Config
 * ------------------------------------------------------------------
 * Single source of truth for a SERV Express prototype.
 *
 * ⚠️ THE CORE MODEL — read this before editing.
 *
 * SavATree does NOT sell an à-la-carte menu of services. Their website
 * has one page per service (SEO architecture), but they SELL PROGRAMS:
 * recurring, auto-renewing annual agreements designed by an arborist.
 *
 * Three distinct object types, and they are not interchangeable:
 *
 *   1. PROGRAM  — the unit of sale. Recurring annual agreement, tiered
 *                 Good/Better/Best. Auto-renews. This is the revenue engine.
 *   2. ADDON    — attaches to a program. Never sold standalone.
 *   3. PROJECT  — discrete one-off arborist job (removal, pruning, storm).
 *                 Mostly consultation-gated.
 *
 *   TREATMENT   — NOT a purchasable object. Treatments (fertilization,
 *                 dormant oil, grub control) are COMPONENTS listed inside
 *                 a program to justify its price. They render as an
 *                 included-visits timeline, never as a buy button.
 *
 * ⚠️ PRICING
 * SavATree publishes no pricing. Numbers are 2026 benchmark estimates,
 * premium-biased, calibrated against real reported quotes (REPORTED_QUOTES).
 * Seed values to tune per-branch — not published rates.
 * ------------------------------------------------------------------
 */

export const PRICING_DISCLAIMER =
  "Estimate only. Your final plan is designed by an ISA Certified Arborist after a property assessment. Pricing may vary with property remeasurement, tree size, species, and local branch rates.";

/** Real reported SavATree quotes — calibration anchors. Sanity-check rate edits here. */
export const REPORTED_QUOTES = [
  { desc: "Fertilization, 2 trees, 3 annual treatments", total: 2058 },
  { desc: "Pruning + 3 support cables", total: 2228 },
  { desc: "Multi-treatment disease plan + pruning", total: 5880 },
  { desc: "Large tree pruning (single)", total: 3890 },
] as const;

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type Vertical =
  | "plant_health"   // Plant Health Care — biggest revenue category
  | "lawn"
  | "pest"           // tick & mosquito
  | "deer"
  | "tree_work"      // projects: pruning, removal, storm
  | "landscape"
  | "commercial";

export type TierLevel = "good" | "better" | "best";

/** What drives the price of a program. */
export type PriceBasis =
  | "turf_sqft"      // lawn
  | "property_sqft"  // pest barrier / mosquito / tick
  | "plant_count"    // plant health care (trees + shrubs)
  | "bed_count";     // deer

export interface PriceBand {
  low: number;
  high: number;
}

/** A treatment inside a program. Display-only — NEVER purchasable. */
export interface Treatment {
  name: string;
  season: "early_spring" | "spring" | "summer" | "late_summer" | "fall" | "dormant";
  note?: string;
}

export interface ProgramTier {
  level: TierLevel;
  name: string;
  tagline: string;
  visitsPerYear: number;
  /** Rate applied to the program's priceBasis unit. */
  rate: PriceBand;
  annualFloor: number;
  /** Components shown to justify price. Not buyable. */
  treatments: Treatment[];
  /** Add-on ids bundled in free at this tier. */
  includedAddons?: string[];
  popular?: boolean;
}

export interface Program {
  id: string;
  name: string;
  vertical: Vertical;
  priceBasis: PriceBasis;
  /** instant = enroll online. consultation = soft estimate, arborist confirms. */
  path: "instant_quote" | "consultation";
  blurb: string;
  tiers: ProgramTier[];
  /** Add-on ids offerable against this program. */
  eligibleAddons: string[];
  /** Organic/traditional style choice — NOT a quality tier. */
  organicModifier?: number;
  autoRenews: boolean;
  notes?: string;
}

export interface Addon {
  id: string;
  name: string;
  blurb: string;
  /** Add-ons attach to a program. Never sold standalone. */
  attachesTo: string[];
  pricing:
    | { model: "flat"; band: PriceBand }
    | { model: "per_plant"; band: PriceBand; treatmentsPerYear: number }
    | { model: "per_sqft"; band: PriceBand; minCharge: number };
  cadence: "annual" | "seasonal" | "one_time";
  /**
   * A per_plant add-on that treats only SOME of the plants on the property
   * (e.g. ash trees for EAB). Without this it would price against the whole
   * plant count and wildly over-quote. Collect its own count instead.
   */
  plantSubset?: { label: string; unit: string; default: number; max: number };
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  vertical: Vertical;
  path: "instant_quote" | "consultation";
  requiresAssessment: boolean;
  blurb: string;
  pricing:
    | { model: "consultation"; band: PriceBand }
    | { model: "per_unit"; band: PriceBand; unitLabel: string; minCharge: number; additionalUnit: PriceBand }
    | { model: "hourly"; band: PriceBand };
  urgent?: boolean;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// PROGRAMS — the unit of sale
// ─────────────────────────────────────────────────────────────────

export const PROGRAMS: Program[] = [
  {
    id: "phc_program",
    name: "Plant Health Care Program",
    vertical: "plant_health",
    priceBasis: "plant_count",
    path: "instant_quote",
    blurb:
      "A year-round care plan for your trees and shrubs, designed by an ISA Certified Arborist and built on a professional soil analysis of your property.",
    autoRenews: true,
    organicModifier: 1.25,
    eligibleAddons: [
      "soil_testing", "recharge_watering", "eab_treatment",
      "spotted_lanternfly", "organic_soil_enhancer", "mycorrhizae",
    ],
    tiers: [
      {
        level: "good",
        name: "Essential Care",
        tagline: "Keep healthy trees healthy.",
        visitsPerYear: 3,
        rate: { low: 130, high: 240 }, // $/plant/yr
        annualFloor: 450,
        treatments: [
          { name: "Soil analysis & arborist property walk", season: "early_spring", note: "Baseline for the whole plan" },
          { name: "ArborHealth® deep root fertilization", season: "spring" },
          { name: "Seasonal health inspection", season: "fall" },
        ],
        includedAddons: ["soil_testing"],
      },
      {
        level: "better",
        name: "Complete Care",
        tagline: "Feed, protect, and monitor all season.",
        visitsPerYear: 5,
        rate: { low: 220, high: 400 },
        annualFloor: 780,
        popular: true,
        treatments: [
          { name: "Soil analysis & arborist property walk", season: "early_spring" },
          { name: "Dormant oil application", season: "dormant", note: "Overwintering insects & mites" },
          { name: "ArborHealth® deep root fertilization", season: "spring" },
          { name: "ArborKelp® biostimulant application", season: "spring", note: "Seaweed-based, drives root growth & stress tolerance" },
          { name: "Insect & mite monitoring + treatment", season: "summer" },
          { name: "Seasonal health inspection", season: "fall" },
        ],
        includedAddons: ["soil_testing", "recharge_watering"],
      },
      {
        level: "best",
        name: "Total Care",
        tagline: "Full-spectrum protection for a mature, high-value landscape.",
        visitsPerYear: 7,
        rate: { low: 330, high: 600 },
        annualFloor: 1200,
        treatments: [
          { name: "Soil analysis & arborist property walk", season: "early_spring" },
          { name: "Dormant oil application", season: "dormant" },
          { name: "ArborHealth® deep root fertilization", season: "spring" },
          { name: "ArborKelp® biostimulant application", season: "spring" },
          { name: "Organic soil enhancer (humic acids)", season: "spring", note: "Restores organic matter, improves drainage" },
          { name: "Disease prevention & fungicide treatment", season: "spring" },
          { name: "Insect & mite monitoring + treatment", season: "summer" },
          { name: "Deep root watering (Recharge)", season: "late_summer", note: "Drought resilience" },
          { name: "Fall fertilization & winter prep", season: "fall" },
        ],
        includedAddons: ["soil_testing", "recharge_watering", "organic_soil_enhancer", "mycorrhizae"],
      },
    ],
    notes:
      "Calibrated: 2 plants on Complete ≈ $880–$1,600/yr; real reported quote for 2 trees × 3 treatments = $2,058 (upper band / large specimens).",
  },

  {
    id: "lawn_program",
    name: "Lawn Care Program",
    vertical: "lawn",
    priceBasis: "turf_sqft",
    path: "instant_quote",
    blurb:
      "A multi-visit annual turf program targeted to your soil, grass type, and conditions — not a one-size-fits-all spray schedule.",
    autoRenews: true,
    organicModifier: 1.35, // organic/traditional/hybrid is a STYLE choice, not a tier
    eligibleAddons: ["core_aeration", "overseeding", "grub_control", "lawn_disease", "homeshield_barrier"],
    tiers: [
      {
        level: "good",
        name: "Essential Lawn",
        tagline: "Feed it and keep the weeds out.",
        visitsPerYear: 5,
        rate: { low: 0.1, high: 0.16 }, // $/sqft/yr
        annualFloor: 420,
        treatments: [
          { name: "Pre-emergent crabgrass control", season: "early_spring" },
          { name: "Slow-release fertilization", season: "spring" },
          { name: "Broadleaf weed control", season: "spring" },
          { name: "Summer fertilization", season: "summer" },
          { name: "Fall fertilization & winterizer", season: "fall" },
        ],
      },
      {
        level: "better",
        name: "Complete Lawn",
        tagline: "Nutrition, weeds, and pests handled.",
        visitsPerYear: 6,
        rate: { low: 0.15, high: 0.24 },
        annualFloor: 600,
        popular: true,
        treatments: [
          { name: "Pre-emergent crabgrass control", season: "early_spring" },
          { name: "Slow-release fertilization", season: "spring" },
          { name: "Broadleaf weed control", season: "spring" },
          { name: "Grub & surface insect control", season: "summer" },
          { name: "Summer fertilization", season: "summer" },
          { name: "Fall fertilization & winterizer", season: "fall" },
        ],
        includedAddons: ["grub_control"],
      },
      {
        level: "best",
        name: "All-Nutrient Lawn",
        tagline: "Premium nutrients, minerals, and biostimulants for peak turf.",
        visitsPerYear: 8,
        rate: { low: 0.21, high: 0.33 },
        annualFloor: 850,
        treatments: [
          { name: "Soil test & nutrient analysis", season: "early_spring" },
          { name: "Pre-emergent crabgrass control", season: "early_spring" },
          { name: "All-nutrient fertilization + biostimulant", season: "spring" },
          { name: "Broadleaf weed control", season: "spring" },
          { name: "Grub & surface insect control", season: "summer" },
          { name: "Turf disease prevention", season: "summer" },
          { name: "Core aeration", season: "fall" },
          { name: "Fall fertilization & winterizer", season: "fall" },
        ],
        includedAddons: ["grub_control", "core_aeration", "lawn_disease"],
      },
    ],
    notes: "Organic and hybrid available at every tier via organicModifier — a style choice, not a quality rung.",
  },

  {
    id: "pest_program",
    name: "Tick & Mosquito Program",
    vertical: "pest",
    priceBasis: "property_sqft",
    path: "instant_quote",
    blurb:
      "Seasonal barrier treatments that knock down tick and mosquito populations so the yard is usable again.",
    autoRenews: true,
    eligibleAddons: ["homeshield_barrier", "tick_tube_program"],
    tiers: [
      {
        level: "good",
        name: "Tick Defense",
        tagline: "Targeted tick suppression, spring through fall.",
        visitsPerYear: 6,
        rate: { low: 0.06, high: 0.1 },
        annualFloor: 340,
        treatments: [
          { name: "Perimeter & harborage tick treatment", season: "spring", note: "Woodline, leaf litter, stone walls" },
          { name: "Peak-season tick treatments (×3)", season: "summer" },
          { name: "Fall tick treatment", season: "fall", note: "Adult deer tick activity spikes in fall" },
        ],
      },
      {
        level: "better",
        name: "Tick & Mosquito Defense",
        tagline: "Both pests, all season.",
        visitsPerYear: 8,
        rate: { low: 0.1, high: 0.17 },
        annualFloor: 560,
        popular: true,
        treatments: [
          { name: "Perimeter & harborage tick treatment", season: "spring" },
          { name: "Mosquito barrier treatment (×4)", season: "summer", note: "Shrub undersides, standing-water harborage" },
          { name: "Peak-season tick treatments (×2)", season: "summer" },
          { name: "Fall tick treatment", season: "fall" },
        ],
      },
      {
        level: "best",
        name: "Total Yard Defense",
        tagline: "Tick, mosquito, and a perimeter barrier on the house.",
        visitsPerYear: 10,
        rate: { low: 0.15, high: 0.25 },
        annualFloor: 820,
        treatments: [
          { name: "Perimeter & harborage tick treatment", season: "spring" },
          { name: "HomeShield structure perimeter barrier (×3)", season: "spring" },
          { name: "Mosquito barrier treatment (×4)", season: "summer" },
          { name: "Peak-season tick treatments (×2)", season: "summer" },
          { name: "Fall tick + perimeter treatment", season: "fall" },
        ],
        includedAddons: ["homeshield_barrier"],
      },
    ],
  },

  {
    id: "deer_program",
    name: "Deer Protection Program",
    vertical: "deer",
    priceBasis: "bed_count",
    path: "consultation",
    blurb:
      "SavATree's patented layered deer deterrent system — protects plantings through browse season without visible residue.",
    autoRenews: true,
    eligibleAddons: [],
    tiers: [
      {
        level: "good",
        name: "Season Guard",
        tagline: "Clear repellent through the growing season.",
        visitsPerYear: 4,
        rate: { low: 90, high: 170 }, // $/bed/yr
        annualFloor: 400,
        treatments: [
          { name: "Clear repellent application (×4)", season: "spring", note: "Dries clear — no visible residue on ornamentals" },
        ],
      },
      {
        level: "better",
        name: "Three Circles",
        tagline: "The patented triple-layer deterrent system.",
        visitsPerYear: 6,
        rate: { low: 140, high: 260 },
        annualFloor: 650,
        popular: true,
        treatments: [
          { name: "Clear repellent application (×4)", season: "spring" },
          { name: "Patented layered deterrent treatment (×2)", season: "summer", note: "Proprietary 'Three Circles' method" },
        ],
      },
      {
        level: "best",
        name: "Year-Round Protection",
        tagline: "Growing season plus winter browse defense.",
        visitsPerYear: 8,
        rate: { low: 190, high: 340 },
        annualFloor: 900,
        treatments: [
          { name: "Clear repellent application (×4)", season: "spring" },
          { name: "Patented layered deterrent treatment (×2)", season: "summer" },
          { name: "Winter deterrent application (×2)", season: "dormant", note: "Winter browse pressure is highest-damage" },
        ],
      },
    ],
    notes: "Patented/proprietary — no public benchmark. Soft estimate only; arborist confirms bed count and pressure on site.",
  },
];

// ─────────────────────────────────────────────────────────────────
// ADD-ONS — attach to a program, never standalone
// ─────────────────────────────────────────────────────────────────

export const ADDONS: Addon[] = [
  {
    id: "soil_testing",
    name: "Soil Testing & Analysis",
    blurb: "Lab analysis of pH, nutrient content, organic matter, and cation exchange capacity to tune your plan.",
    attachesTo: ["phc_program", "lawn_program"],
    pricing: { model: "flat", band: { low: 75, high: 150 } },
    cadence: "one_time",
    notes: "Included free on PHC tiers. It's the gate INTO the program, not a menu item.",
  },
  {
    id: "recharge_watering",
    name: "Recharge — Deep Root Watering",
    blurb: "Supplemental deep-root watering with natural Yuccah extracts for drought resilience.",
    attachesTo: ["phc_program"],
    pricing: { model: "per_plant", band: { low: 40, high: 110 }, treatmentsPerYear: 2 },
    cadence: "seasonal",
  },
  {
    id: "eab_treatment",
    name: "Emerald Ash Borer Protection",
    blurb: "Preventive trunk-injection treatment protecting ash trees from Emerald Ash Borer.",
    attachesTo: ["phc_program"],
    pricing: { model: "per_plant", band: { low: 150, high: 400 }, treatmentsPerYear: 1 },
    cadence: "annual",
    plantSubset: { label: "How many ash trees?", unit: "ash trees", default: 2, max: 50 },
    notes: "Ash trees only. Known pest → productizable per-tree.",
  },
  {
    id: "spotted_lanternfly",
    name: "Spotted Lanternfly Treatment",
    blurb: "Targeted control of Spotted Lanternfly on host trees.",
    attachesTo: ["phc_program"],
    pricing: { model: "per_plant", band: { low: 100, high: 300 }, treatmentsPerYear: 2 },
    cadence: "seasonal",
  },
  {
    id: "organic_soil_enhancer",
    name: "Organic Soil Enhancer",
    blurb: "Carbon-rich humic acid treatment that restores organic matter, improves drainage, and feeds soil microbes.",
    attachesTo: ["phc_program"],
    pricing: { model: "per_plant", band: { low: 45, high: 120 }, treatmentsPerYear: 1 },
    cadence: "annual",
  },
  {
    id: "mycorrhizae",
    name: "Mycorrhizae & Biologic Soil Enhancer",
    blurb: "Beneficial bacteria and fungi that improve root nutrient absorption.",
    attachesTo: ["phc_program"],
    pricing: { model: "per_plant", band: { low: 40, high: 100 }, treatmentsPerYear: 1 },
    cadence: "annual",
  },
  {
    id: "core_aeration",
    name: "Core Aeration",
    blurb: "Pull soil cores to relieve compaction and open pathways for air, water, and nutrients.",
    attachesTo: ["lawn_program"],
    pricing: { model: "per_sqft", band: { low: 0.03, high: 0.06 }, minCharge: 95 },
    cadence: "seasonal",
  },
  {
    id: "overseeding",
    name: "Overseeding",
    blurb: "Thicken turf and fill bare spots with premium seed, best paired with aeration.",
    attachesTo: ["lawn_program"],
    pricing: { model: "per_sqft", band: { low: 0.09, high: 0.18 }, minCharge: 300 },
    cadence: "seasonal",
  },
  {
    id: "grub_control",
    name: "Grub & Surface Insect Control",
    blurb: "Preventive control for subsurface grubs and turf-damaging insects.",
    attachesTo: ["lawn_program"],
    pricing: { model: "per_sqft", band: { low: 0.02, high: 0.045 }, minCharge: 80 },
    cadence: "annual",
  },
  {
    id: "lawn_disease",
    name: "Turf Disease Prevention",
    blurb: "Preventive fungicide program for lawns with a history of disease pressure.",
    attachesTo: ["lawn_program"],
    pricing: { model: "per_sqft", band: { low: 0.03, high: 0.07 }, minCharge: 120 },
    cadence: "annual",
  },
  {
    id: "homeshield_barrier",
    name: "HomeShield Perimeter Barrier",
    blurb: "Structure-adjacent perimeter treatment blocking insects at the foundation line.",
    attachesTo: ["lawn_program", "pest_program"],
    pricing: { model: "per_sqft", band: { low: 0.04, high: 0.08 }, minCharge: 280 },
    cadence: "annual",
  },
  {
    id: "tick_tube_program",
    name: "Tick Tube Placement",
    blurb: "Permethrin tick tubes placed in rodent harborage to break the tick life cycle at the source.",
    attachesTo: ["pest_program"],
    pricing: { model: "flat", band: { low: 120, high: 280 } },
    cadence: "annual",
  },
];

// ─────────────────────────────────────────────────────────────────
// PROJECTS — one-off arborist jobs
// ─────────────────────────────────────────────────────────────────

export const PROJECTS: Project[] = [
  {
    id: "tree_pruning",
    name: "Tree Pruning",
    vertical: "tree_work",
    path: "consultation",
    requiresAssessment: true,
    blurb: "Precise structural and health pruning by ISA Certified Arborists, scoped per tree.",
    pricing: { model: "consultation", band: { low: 400, high: 3900 } },
    notes: "Real quote: single large-tree pruning ~$3,890. Often recurs on a multi-year rotation.",
  },
  {
    id: "tree_removal",
    name: "Tree Removal",
    vertical: "tree_work",
    path: "consultation",
    requiresAssessment: true,
    blurb: "Full takedown by trained climbers. Height, diameter, lean, and proximity to structures drive price.",
    pricing: { model: "consultation", band: { low: 800, high: 3500 } },
  },
  {
    id: "cabling_bracing",
    name: "Cabling & Bracing",
    vertical: "tree_work",
    path: "consultation",
    requiresAssessment: true,
    blurb: "Structural support hardware for weak crotches and heavy limbs to reduce failure risk.",
    pricing: { model: "consultation", band: { low: 500, high: 2200 } },
    notes: "Real quote: pruning + 3 cables ≈ $2,228.",
  },
  {
    id: "storm_emergency",
    name: "Emergency & Storm Damage",
    vertical: "tree_work",
    path: "consultation",
    requiresAssessment: true,
    urgent: true,
    blurb: "Rapid response for fallen or hazardous trees and limbs.",
    pricing: { model: "consultation", band: { low: 500, high: 6000 } },
    notes: "URGENT PATH — route to dispatch, not standard scheduling. Skip the quote flow.",
  },
  {
    id: "stump_grinding",
    name: "Stump Grinding",
    vertical: "tree_work",
    path: "instant_quote",
    requiresAssessment: false,
    blurb: "Grind the stump below grade. Priced by diameter — the one tree job that's cleanly quotable online.",
    pricing: {
      model: "per_unit",
      band: { low: 4, high: 7 },
      unitLabel: "inch of diameter",
      minCharge: 160,
      additionalUnit: { low: 40, high: 70 },
    },
  },
  {
    id: "landscape_design",
    name: "Landscape Design & Maintenance",
    vertical: "landscape",
    path: "consultation",
    requiresAssessment: true,
    blurb: "Design, installation, and ongoing maintenance of plantings and beds.",
    pricing: { model: "consultation", band: { low: 500, high: 10000 } },
  },
  {
    id: "holiday_lighting",
    name: "Holiday Lighting & Decor",
    vertical: "landscape",
    path: "consultation",
    requiresAssessment: true,
    blurb: "Custom holiday lighting design, install, takedown, and storage.",
    pricing: { model: "consultation", band: { low: 500, high: 5000 } },
  },
  {
    id: "commercial_program",
    name: "Commercial Landscape Solutions",
    vertical: "commercial",
    path: "consultation",
    requiresAssessment: true,
    blurb: "Tree, shrub, and landscape programs for HOAs, campuses, office parks, hospitals, and municipalities.",
    pricing: { model: "consultation", band: { low: 1000, high: 100000 } },
  },
  {
    id: "consulting_group",
    name: "Consulting Group",
    vertical: "commercial",
    path: "consultation",
    requiresAssessment: true,
    blurb: "Registered Consulting Arborists: risk assessment, appraisal, inventory, construction management, urban forest planning.",
    pricing: { model: "hourly", band: { low: 150, high: 350 } },
    notes: "ANSI A300 Part 9 risk assessment (Probability × Consequences = Risk).",
  },
];

// ─────────────────────────────────────────────────────────────────
// Quote engine
// ─────────────────────────────────────────────────────────────────

/**
 * Tree size is the dominant cost driver in plant health care — a 60-ft oak
 * takes far more material and labor than a 12-ft ornamental. Without this,
 * per-plant rates badly under-quote mature landscapes.
 * Calibration: 2 large trees on Complete Care ≈ $2,058 real reported quote.
 */
export type PlantSize = "small" | "medium" | "large" | "mature";

export const PLANT_SIZE_MULTIPLIER: Record<PlantSize, number> = {
  small: 0.6,   // ornamentals, young plantings, shrubs
  medium: 1.0,  // baseline: established 15–40 ft
  large: 1.9,   // 40–60 ft canopy
  mature: 2.8,  // 60 ft+ specimen / heritage trees
};

export interface PropertyInputs {
  turfSqft?: number;
  propertySqft?: number;
  plantCount?: number;   // trees + shrubs
  plantSize?: PlantSize; // PHC only — dominant cost driver
  bedCount?: number;
  organic?: boolean;
  /** Add-on ids the customer selected on top of the program. */
  addonIds?: string[];
  /** Counts for add-ons that treat a subset of plants (see Addon.plantSubset). */
  addonCounts?: Record<string, number>;
  /** Project-only */
  stumpDiameterInches?: number;
  stumpCount?: number;
  hours?: number;
}

export interface QuoteLine {
  label: string;
  band: PriceBand | null;
  included?: boolean;
}

export interface ProgramQuote {
  programId: string;
  programName: string;
  tier: TierLevel;
  tierName: string;
  visitsPerYear: number;
  path: "instant_quote" | "consultation";
  isEnrollable: boolean;
  autoRenews: boolean;
  annual: PriceBand;
  monthly: PriceBand;
  lines: QuoteLine[];
  treatments: Treatment[];
  disclaimer: string;
}

const round = (n: number) => Math.round(n);
const DEFAULTS = { turfSqft: 4500, propertySqft: 8000, plantCount: 6, bedCount: 4 };

export const getProgram = (id: string) => PROGRAMS.find((p) => p.id === id);
export const getAddon = (id: string) => ADDONS.find((a) => a.id === id);
export const getProject = (id: string) => PROJECTS.find((p) => p.id === id);

function basisValue(program: Program, i: PropertyInputs): number {
  switch (program.priceBasis) {
    case "turf_sqft": return i.turfSqft ?? DEFAULTS.turfSqft;
    case "property_sqft": return i.propertySqft ?? DEFAULTS.propertySqft;
    case "plant_count": return i.plantCount ?? DEFAULTS.plantCount;
    case "bed_count": return i.bedCount ?? DEFAULTS.bedCount;
  }
}

function priceAddon(addon: Addon, i: PropertyInputs): PriceBand {
  switch (addon.pricing.model) {
    case "flat":
      return { ...addon.pricing.band };
    case "per_plant": {
      // A subset add-on (EAB → ash trees) prices against its own count, never
      // the whole property's plant count.
      const n = addon.plantSubset
        ? i.addonCounts?.[addon.id] ?? addon.plantSubset.default
        : i.plantCount ?? DEFAULTS.plantCount;
      const tx = addon.pricing.treatmentsPerYear;
      const sz = PLANT_SIZE_MULTIPLIER[i.plantSize ?? "medium"];
      return {
        low: round(n * addon.pricing.band.low * tx * sz),
        high: round(n * addon.pricing.band.high * tx * sz),
      };
    }
    case "per_sqft": {
      const sqft = i.turfSqft ?? i.propertySqft ?? DEFAULTS.turfSqft;
      const { band, minCharge } = addon.pricing;
      return { low: round(Math.max(minCharge, sqft * band.low)), high: round(Math.max(minCharge, sqft * band.high)) };
    }
  }
}

export function quoteProgram(
  programId: string,
  tierLevel: TierLevel,
  inputs: PropertyInputs = {}
): ProgramQuote {
  const program = getProgram(programId);
  if (!program) throw new Error(`Unknown program: ${programId}`);
  const tier = program.tiers.find((t) => t.level === tierLevel);
  if (!tier) throw new Error(`Unknown tier ${tierLevel} on ${programId}`);

  const units = basisValue(program, inputs);
  const mod = inputs.organic && program.organicModifier ? program.organicModifier : 1;
  // Size only applies where the basis is plants — sqft already encodes scale.
  const sz =
    program.priceBasis === "plant_count"
      ? PLANT_SIZE_MULTIPLIER[inputs.plantSize ?? "medium"]
      : 1;

  let low = Math.max(tier.annualFloor, units * tier.rate.low * sz) * mod;
  let high = Math.max(tier.annualFloor, units * tier.rate.high * sz) * mod;

  const unitLabel =
    program.priceBasis === "plant_count"
      ? `${units} ${inputs.plantSize ?? "medium"} trees/shrubs`
    : program.priceBasis === "bed_count" ? `${units} planting beds`
    : `${units.toLocaleString()} sq ft`;

  const lines: QuoteLine[] = [
    { label: `${tier.name} — ${tier.visitsPerYear} visits/yr (${unitLabel})`, band: { low: round(low), high: round(high) } },
  ];
  if (mod !== 1) lines.push({ label: `Organic program (+${Math.round((mod - 1) * 100)}%)`, band: null });

  // Included add-ons — show value, charge nothing.
  (tier.includedAddons ?? []).forEach((id) => {
    const a = getAddon(id);
    if (a) lines.push({ label: `${a.name} — included`, band: null, included: true });
  });

  // Selected add-ons, minus anything already bundled at this tier.
  const included = new Set(tier.includedAddons ?? []);
  (inputs.addonIds ?? [])
    .filter((id) => !included.has(id))
    .forEach((id) => {
      const a = getAddon(id);
      if (!a || !a.attachesTo.includes(programId)) return; // add-ons can't float free
      const band = priceAddon(a, inputs);
      low += band.low;
      high += band.high;
      const count = a.plantSubset
        ? inputs.addonCounts?.[a.id] ?? a.plantSubset.default
        : null;
      const unit =
        count === 1 ? a.plantSubset!.unit.replace(/s$/, "") : a.plantSubset?.unit;
      lines.push({
        label: count !== null ? `${a.name} — ${count} ${unit}` : a.name,
        band,
      });
    });

  return {
    programId: program.id,
    programName: program.name,
    tier: tier.level,
    tierName: tier.name,
    visitsPerYear: tier.visitsPerYear,
    path: program.path,
    isEnrollable: program.path === "instant_quote",
    autoRenews: program.autoRenews,
    annual: { low: round(low), high: round(high) },
    monthly: { low: round(low / 12), high: round(high / 12) },
    lines,
    treatments: tier.treatments,
    disclaimer: PRICING_DISCLAIMER,
  };
}

export function quoteProject(projectId: string, inputs: PropertyInputs = {}) {
  const p = getProject(projectId);
  if (!p) throw new Error(`Unknown project: ${projectId}`);

  let band: PriceBand;
  const lines: string[] = [];

  switch (p.pricing.model) {
    case "consultation":
      band = { ...p.pricing.band };
      lines.push("Firm price provided after on-site arborist assessment.");
      break;
    case "hourly": {
      const hrs = inputs.hours ?? 2;
      band = { low: round(hrs * p.pricing.band.low), high: round(hrs * p.pricing.band.high) };
      lines.push(`${hrs} hr @ $${p.pricing.band.low}–$${p.pricing.band.high}/hr`);
      break;
    }
    case "per_unit": {
      const inches = inputs.stumpDiameterInches ?? 12;
      const count = inputs.stumpCount ?? 1;
      const { band: b, minCharge, additionalUnit } = p.pricing;
      const extra = Math.max(0, count - 1);
      band = {
        low: round(Math.max(minCharge, inches * b.low) + extra * additionalUnit.low),
        high: round(Math.max(minCharge, inches * b.high) + extra * additionalUnit.high),
      };
      lines.push(`${inches}" stump @ $${b.low}–$${b.high}/${p.pricing.unitLabel} (min $${minCharge})`);
      if (extra) lines.push(`${extra} additional stump(s)`);
      break;
    }
  }

  return {
    projectId: p.id,
    projectName: p.name,
    path: p.path,
    isBookable: p.path === "instant_quote",
    urgent: !!p.urgent,
    requiresAssessment: p.requiresAssessment,
    estimate: band,
    lines,
    disclaimer: PRICING_DISCLAIMER,
  };
}

// ─────────────────────────────────────────────────────────────────
// Agent grounding
// ─────────────────────────────────────────────────────────────────

export function toAgentContext(): string {
  const L: string[] = [
    "# SavATree — Program Catalog (agent grounding)",
    "",
    `> ${PRICING_DISCLAIMER}`,
    "",
    "## How SavATree sells",
    "SavATree sells PROGRAMS, not individual services. Never present a flat menu of treatments.",
    "- **Programs** are the unit of sale: recurring annual agreements, tiered Good/Better/Best, auto-renewing.",
    "- **Add-ons** attach to a program. Never offer one standalone.",
    "- **Treatments** are NOT purchasable. They are the visits INSIDE a program — cite them to justify price.",
    "- **Projects** are one-off arborist jobs. Mostly consultation-gated; give a range, then route to assessment.",
    "",
    "Always lead with the recommended tier (marked popular), show what's included, then offer add-ons.",
    "",
    "## Programs",
    "",
  ];

  PROGRAMS.forEach((p) => {
    L.push(`### ${p.name} — priced by ${p.priceBasis} [${p.path}]${p.autoRenews ? ", auto-renews" : ""}`);
    L.push(p.blurb, "");
    p.tiers.forEach((t) => {
      L.push(
        `- **${t.name}** (${t.level}${t.popular ? ", RECOMMENDED" : ""}) — ${t.tagline} ${t.visitsPerYear} visits/yr, from $${t.annualFloor}/yr.`
      );
      L.push(`  - Includes: ${t.treatments.map((x) => x.name).join("; ")}`);
    });
    if (p.organicModifier) {
      L.push(`- Organic/hybrid available at every tier (+${Math.round((p.organicModifier - 1) * 100)}%). This is a STYLE choice, not a better tier.`);
    }
    if (p.eligibleAddons.length) L.push(`- Eligible add-ons: ${p.eligibleAddons.join(", ")}`);
    L.push("");
  });

  L.push("## Add-ons (only sold attached to a program)", "");
  ADDONS.forEach((a) => L.push(`- **${a.name}** → attaches to ${a.attachesTo.join(", ")} — ${a.blurb}`));
  L.push("", "## Projects (one-off)", "");
  PROJECTS.forEach((p) =>
    L.push(
      `- **${p.name}** [${p.path}${p.urgent ? ", URGENT→dispatch" : ""}] — ${p.blurb} _($${p.pricing.band.low}–$${p.pricing.band.high})_`
    )
  );

  return L.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Self-check
// ─────────────────────────────────────────────────────────────────
declare const require: any;
declare const module: any;
if (typeof require !== "undefined" && require.main === module) {
  const show = (q: ProgramQuote) => {
    console.log(`\n${q.programName} → ${q.tierName} [${q.isEnrollable ? "ENROLLABLE" : "consultation"}]`);
    console.log(`  $${q.annual.low}–$${q.annual.high}/yr  (~$${q.monthly.low}–$${q.monthly.high}/mo) · ${q.visitsPerYear} visits`);
    q.lines.forEach((l) =>
      console.log(`   • ${l.label}${l.band ? ` — $${l.band.low}–$${l.band.high}` : l.included ? "" : ""}`)
    );
  };

  console.log("=== PROGRAMS ===");
  show(quoteProgram("phc_program", "better", { plantCount: 2, plantSize: "mature" })); // vs real $2,058
  show(quoteProgram("phc_program", "better", { plantCount: 8, plantSize: "small" }));
  show(quoteProgram("phc_program", "best", { plantCount: 12, plantSize: "medium", addonIds: ["eab_treatment"] }));
  show(quoteProgram("lawn_program", "better", { turfSqft: 5000 }));
  show(quoteProgram("lawn_program", "better", { turfSqft: 5000, organic: true }));
  show(quoteProgram("pest_program", "better", { propertySqft: 8000 }));
  show(quoteProgram("deer_program", "better", { bedCount: 5 }));

  console.log("\n=== PROJECTS ===");
  [quoteProject("tree_removal"), quoteProject("stump_grinding", { stumpDiameterInches: 18, stumpCount: 3 }), quoteProject("storm_emergency")].forEach((q) =>
    console.log(`\n${q.projectName} [${q.isBookable ? "bookable" : "consultation"}${q.urgent ? ", URGENT" : ""}] $${q.estimate.low}–$${q.estimate.high}`)
  );

  console.log("\n=== CALIBRATION vs real reported quotes ===");
  // "Fertilization, 2 trees, 3 annual treatments — $2,058" reads as 3 FERTILIZATION
  // applications (not a 3-visit program). Complete Care contains exactly that.
  // Two mature specimens is the reading that reproduces the number.
  const cal = quoteProgram("phc_program", "better", { plantCount: 2, plantSize: "mature" });
  const target = REPORTED_QUOTES[0].total; // $2,058
  const hit = target >= cal.annual.low && target <= cal.annual.high;
  console.log(
    `  2 mature trees, Complete Care → $${cal.annual.low}–$${cal.annual.high}/yr | real quote $${target} → ${hit ? "IN BAND ✓" : "OUT OF BAND ✗"}`
  );
  if (!hit) throw new Error("Calibration drift — PHC rates no longer reproduce the known real quote.");

  console.log(
    `\n=== ${PROGRAMS.length} programs (${PROGRAMS.reduce((n, p) => n + p.tiers.length, 0)} tiers), ${ADDONS.length} add-ons, ${PROJECTS.length} projects ===`
  );
}
