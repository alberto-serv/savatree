/**
 * SavATree — Service Catalog & Pricing Config
 * ------------------------------------------------------------------
 * Single source of truth for a SERV Express prototype.
 *
 * Powers off one data layer:
 *   1. An instant-quote calculator (sqft / per-tree / per-unit driven)
 *   2. A consultation-request intake router
 *   3. Form generation via each service's `quoteInputs` schema
 *   4. Agent context (toAgentContext) for a conversational quoting flow
 *
 * ⚠️ PRICING NOTE
 * SavATree publishes NO public pricing — every service on savatree.com
 * routes to "Request a Consultation." Numbers below are 2026 market
 * benchmark estimates, biased for their premium, ISA-certified,
 * branded-product positioning, and CALIBRATED against real reported
 * customer quotes (see REPORTED_QUOTES). They are SEED VALUES to tune
 * per-branch, NOT SavATree's published rates.
 * ------------------------------------------------------------------
 */

export const PRICING_DISCLAIMER =
  "Estimate only. SavATree pricing is set per-property by a certified arborist after assessment. Final pricing may vary with square footage remeasurement, species, tree size, access, and local branch rates.";

/**
 * Real, publicly reported SavATree quotes used to calibrate the ranges below.
 * Kept in the file as living documentation — sanity-check any rate change here.
 */
export const REPORTED_QUOTES = [
  { desc: "Fertilization, 2 trees, 3 annual treatments", total: 2058 },     // ≈ $343/tree/treatment
  { desc: "Pruning + 3 support cables", total: 2228 },
  { desc: "Multi-treatment disease plan + pruning", total: 5880 },
  { desc: "Large tree pruning (single)", total: 3890 },
] as const;

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type Vertical =
  | "trees_shrubs"   // arborist tree/shrub work (pruning, removal, structural)
  | "plant_health"   // Plant Health Care — biggest revenue category
  | "lawn"
  | "tick"           // tick & mosquito
  | "deer"
  | "landscape"
  | "holiday"
  | "commercial";

/** How the customer transacts. The core SERV Express split. */
export type FulfillmentPath = "instant_quote" | "consultation";

export type Cadence = "one_time" | "annual_program" | "seasonal";

export type PricingModel =
  | "per_sqft"        // property-size driven (lawn, tick, mosquito, pest barrier)
  | "per_tree"        // per tree/shrub × treatments/yr (plant health care)
  | "per_unit"        // per stump-inch, etc.
  | "tiered_program"  // fixed program tiers
  | "hourly"          // consulting, root removal
  | "flat_range"      // single job with a low/high band
  | "consultation";   // arborist-assessed, no instant price

export interface PriceBand {
  low: number;
  high: number;
  typical?: number;
}

/** Field the quote calculator / agent must collect for a service. */
export interface QuoteInputField {
  key: string;
  label: string;
  type: "sqft" | "number" | "select" | "boolean";
  options?: string[];
  unit?: string;
  optional?: boolean;
}

/** Property size buckets — drives per_sqft services (S/M/L/XL pattern). */
export type PropertySize = "S" | "M" | "L" | "XL";

export const PROPERTY_SIZE_TIERS: Record<
  PropertySize,
  { label: string; maxSqft: number; midSqft: number }
> = {
  S: { label: "Small (<3,000 sq ft)", maxSqft: 3000, midSqft: 2000 },
  M: { label: "Medium (3,000–6,000 sq ft)", maxSqft: 6000, midSqft: 4500 },
  L: { label: "Large (6,000–12,000 sq ft)", maxSqft: 12000, midSqft: 9000 },
  XL: { label: "Extra Large (12,000+ sq ft)", maxSqft: 40000, midSqft: 18000 },
};

export function sizeFromSqft(sqft: number): PropertySize {
  if (sqft < 3000) return "S";
  if (sqft < 6000) return "M";
  if (sqft < 12000) return "L";
  return "XL";
}

export interface ProgramTier {
  id: string;
  name: string;
  blurb: string;
  visitsPerYear: number;
  annualRatePerSqft: PriceBand; // annual $/sq ft applied to turf sqft
  annualFloor: number;
}

export interface Service {
  id: string;
  name: string;
  vertical: Vertical;
  path: FulfillmentPath;
  cadence: Cadence;
  pricingModel: PricingModel;
  requiresAssessment: boolean;
  blurb: string;
  pricing: {
    band?: PriceBand;
    perSqftAnnual?: PriceBand;
    perTree?: PriceBand;          // $/tree (or shrub) per treatment
    treatmentsPerYear?: number;   // for per_tree annual programs
    perUnit?: PriceBand;
    unitLabel?: string;
    minCharge?: number;
    hourly?: PriceBand;
    tiers?: ProgramTier[];
    additionalUnit?: PriceBand;
  };
  /** What the instant-quote form / agent collects. Empty for consultation-only. */
  quoteInputs?: QuoteInputField[];
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// Lawn program tiers (Integrated / All-Nutrient / Organic)
// ─────────────────────────────────────────────────────────────────

const LAWN_PROGRAM_TIERS: ProgramTier[] = [
  {
    id: "integrated",
    name: "Integrated Lawn Care",
    blurb:
      "Traditional multi-step program: slow-release fertilization, weed control, and seasonal soil-up treatments.",
    visitsPerYear: 6,
    annualRatePerSqft: { low: 0.12, high: 0.2, typical: 0.15 },
    annualFloor: 480,
  },
  {
    id: "all_nutrient",
    name: "All-Nutrient Lawn Care",
    blurb:
      "Premium hybrid program with specially-formulated nutrients, minerals, and biostimulants for peak turf health.",
    visitsPerYear: 7,
    annualRatePerSqft: { low: 0.16, high: 0.26, typical: 0.2 },
    annualFloor: 620,
  },
  {
    id: "organic",
    name: "Organic Lawn Care",
    blurb:
      "Fully organic, natural-input program. Customer controls organic vs. traditional treatment of the property.",
    visitsPerYear: 6,
    annualRatePerSqft: { low: 0.18, high: 0.32, typical: 0.24 },
    annualFloor: 700,
  },
];

// Reusable input schemas
const TREE_INPUTS: QuoteInputField[] = [
  { key: "treeShrubCount", label: "How many trees?", type: "number", unit: "trees" },
  { key: "treeSize", label: "Average tree size", type: "select", options: ["Small (<15 ft)", "Medium (15–40 ft)", "Large (40 ft+)"] },
  { key: "species", label: "Species (if known)", type: "select", options: ["Unknown", "Oak", "Maple", "Ash", "Pine", "Other"], optional: true },
  { key: "soilTesting", label: "Add soil testing?", type: "boolean", optional: true },
];

const SHRUB_INPUTS: QuoteInputField[] = [
  { key: "treeShrubCount", label: "How many shrubs?", type: "number", unit: "shrubs" },
  { key: "avgHeight", label: "Average shrub height", type: "select", options: ["Under 3 ft", "3–6 ft", "6 ft+"] },
];

// ─────────────────────────────────────────────────────────────────
// The catalog
// ─────────────────────────────────────────────────────────────────

export const CATALOG: Service[] = [
  // ── TREES & SHRUBS (arborist work) ──────────────────────────────
  {
    id: "tree_pruning",
    name: "Tree Pruning",
    vertical: "trees_shrubs",
    path: "consultation",
    cadence: "annual_program",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb:
      "Year-round pruning plan custom-built by an ISA Certified Arborist, with seasonal visits built into an annual care plan.",
    pricing: { band: { low: 400, high: 3900, typical: 900 } },
    notes:
      "Sold as a rotating annual plan. Real quotes: single large-tree pruning ~$3,890. Soft estimate only.",
  },
  {
    id: "tree_cabling_bracing",
    name: "Tree Cabling & Bracing",
    vertical: "trees_shrubs",
    path: "consultation",
    cadence: "one_time",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb: "Structural support hardware for weak crotches and heavy limbs to reduce failure risk.",
    pricing: { band: { low: 500, high: 2200 } },
    notes: "Real quote: pruning + 3 cables bundled at ~$2,228.",
  },
  {
    id: "tree_removal",
    name: "Tree & Stump Removal",
    vertical: "trees_shrubs",
    path: "consultation",
    cadence: "one_time",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb:
      "Full tree takedown by trained climbers. Height, diameter, lean, and proximity to structures drive price.",
    pricing: { band: { low: 800, high: 3500, typical: 1500 } },
    notes: "Large hazardous hardwoods near structures can exceed $3,500. Stump grinding quoted separately.",
  },
  {
    id: "stump_grinding",
    name: "Stump Grinding",
    vertical: "trees_shrubs",
    path: "instant_quote",
    cadence: "one_time",
    pricingModel: "per_unit",
    requiresAssessment: false,
    blurb: "Grind the stump 4–6 inches below grade. Priced by stump diameter.",
    pricing: {
      perUnit: { low: 4, high: 7, typical: 5 },
      unitLabel: "inch of stump diameter",
      minCharge: 160,
      additionalUnit: { low: 40, high: 70 },
    },
    quoteInputs: [
      { key: "stumpDiameterInches", label: "Stump diameter", type: "number", unit: "inches" },
      { key: "stumpCount", label: "Number of stumps", type: "number", unit: "stumps" },
    ],
  },
  {
    id: "emergency_storm_damage",
    name: "Emergency & Storm Damage",
    vertical: "trees_shrubs",
    path: "consultation",
    cadence: "one_time",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb: "Rapid-response removal of hazardous or fallen limbs and trees.",
    pricing: { band: { low: 500, high: 6000 } },
    notes: "Urgent path — route to dispatch, not standard scheduling.",
  },
  {
    id: "shrub_pruning",
    name: "Shrub Pruning",
    vertical: "trees_shrubs",
    path: "instant_quote",
    cadence: "annual_program",
    pricingModel: "per_tree",
    requiresAssessment: false,
    blurb: "Seasonal shaping and health pruning for ornamental and privacy shrubs.",
    pricing: { perTree: { low: 25, high: 75, typical: 45 }, treatmentsPerYear: 2 },
    quoteInputs: SHRUB_INPUTS,
    notes: "Per shrub × visits/yr. Bundles well with shrub fertilization/disease.",
  },

  // ── PLANT HEALTH CARE (biggest revenue category) ────────────────
  {
    id: "deep_root_fertilization",
    name: "Deep Root Tree & Shrub Fertilization",
    vertical: "plant_health",
    path: "instant_quote",
    cadence: "annual_program",
    pricingModel: "per_tree",
    requiresAssessment: false,
    blurb:
      "Deep-root feeding with branded ArborHealth® fertilizer and ArborKelp® biostimulant to support vigor and growth.",
    pricing: { perTree: { low: 150, high: 400, typical: 250 }, treatmentsPerYear: 3 },
    quoteInputs: TREE_INPUTS,
    notes: "Calibrated to real quote: 2 trees × 3 treatments = $2,058.",
  },
  {
    id: "soil_testing",
    name: "Soil Testing & Analysis",
    vertical: "plant_health",
    path: "instant_quote",
    cadence: "one_time",
    pricingModel: "flat_range",
    requiresAssessment: false,
    blurb: "Lab analysis of soil pH and nutrient levels to tune the treatment plan.",
    pricing: { band: { low: 50, high: 150, typical: 95 } },
    quoteInputs: [
      { key: "sampleCount", label: "Number of sample areas", type: "number", unit: "areas" },
    ],
    notes: "Common upsell/gate before fertilization programs.",
  },
  {
    id: "tree_disease_treatment",
    name: "Tree Disease Treatment",
    vertical: "plant_health",
    path: "consultation",
    cadence: "annual_program",
    pricingModel: "per_tree",
    requiresAssessment: true,
    blurb:
      "Diagnosis and targeted fungicide/treatment plans for common and emerging tree diseases, per species.",
    pricing: { perTree: { low: 200, high: 600, typical: 350 }, treatmentsPerYear: 2 },
    notes: "Diagnosis-gated — soft per-tree estimate, not bookable until arborist confirms.",
  },
  {
    id: "shrub_disease_treatment",
    name: "Shrub Disease Treatment",
    vertical: "plant_health",
    path: "consultation",
    cadence: "annual_program",
    pricingModel: "per_tree",
    requiresAssessment: true,
    blurb: "Species-specific shrub disease diagnosis and treatment plans.",
    pricing: { perTree: { low: 120, high: 400, typical: 220 }, treatmentsPerYear: 2 },
  },
  {
    id: "insect_mite_management",
    name: "Insect & Mite Management",
    vertical: "plant_health",
    path: "consultation",
    cadence: "annual_program",
    pricingModel: "per_tree",
    requiresAssessment: true,
    blurb: "Monitoring and treatment for tree/shrub insect and mite pressure across the season.",
    pricing: { perTree: { low: 150, high: 500, typical: 300 }, treatmentsPerYear: 2 },
  },
  {
    id: "emerald_ash_borer_treatment",
    name: "Emerald Ash Borer Treatment",
    vertical: "plant_health",
    path: "instant_quote",
    cadence: "annual_program",
    pricingModel: "per_tree",
    requiresAssessment: false,
    blurb:
      "Preventive trunk-injection treatment protecting ash trees from Emerald Ash Borer.",
    pricing: { perTree: { low: 150, high: 400, typical: 250 }, treatmentsPerYear: 1 },
    quoteInputs: [
      { key: "treeShrubCount", label: "How many ash trees?", type: "number", unit: "trees" },
      { key: "treeSize", label: "Average trunk size (DBH)", type: "select", options: ["Under 12 in", "12–24 in", "24 in+"] },
    ],
    notes: "Known pest → productizable per-tree. Usually 1–2 yr treatment intervals.",
  },
  {
    id: "spotted_lanternfly_treatment",
    name: "Spotted Lanternfly Treatment",
    vertical: "plant_health",
    path: "instant_quote",
    cadence: "seasonal",
    pricingModel: "per_tree",
    requiresAssessment: false,
    blurb: "Targeted treatment to control Spotted Lanternfly on host trees.",
    pricing: { perTree: { low: 100, high: 300, typical: 180 }, treatmentsPerYear: 2 },
    quoteInputs: [
      { key: "treeShrubCount", label: "How many affected trees?", type: "number", unit: "trees" },
    ],
  },
  {
    id: "organic_plant_health_care",
    name: "Organic Tree & Shrub Care",
    vertical: "plant_health",
    path: "instant_quote",
    cadence: "annual_program",
    pricingModel: "per_tree",
    requiresAssessment: false,
    blurb: "Fully organic plant health care program for trees and shrubs.",
    pricing: { perTree: { low: 180, high: 450, typical: 300 }, treatmentsPerYear: 3 },
    quoteInputs: TREE_INPUTS,
  },
  {
    id: "recharge_deep_root_watering",
    name: "Recharge — Deep Root Watering",
    vertical: "plant_health",
    path: "instant_quote",
    cadence: "seasonal",
    pricingModel: "per_tree",
    requiresAssessment: false,
    blurb:
      "Supplemental deep-root watering with natural Yuccah extracts to drive deeper, drought-resistant roots.",
    pricing: { perTree: { low: 40, high: 120, typical: 75 }, treatmentsPerYear: 2 },
    quoteInputs: [
      { key: "treeShrubCount", label: "How many trees/shrubs?", type: "number", unit: "plants" },
    ],
    notes: "Add-on to fertilization programs.",
  },

  // ── LAWN CARE ───────────────────────────────────────────────────
  {
    id: "lawn_program",
    name: "Lawn Care Program",
    vertical: "lawn",
    path: "instant_quote",
    cadence: "annual_program",
    pricingModel: "tiered_program",
    requiresAssessment: false,
    blurb:
      "Multi-visit annual lawn program. Choose Integrated (traditional), All-Nutrient (premium hybrid), or Organic.",
    pricing: { tiers: LAWN_PROGRAM_TIERS },
    quoteInputs: [
      { key: "turfSqft", label: "Lawn square footage", type: "sqft", unit: "sq ft" },
      { key: "tierId", label: "Program", type: "select", options: ["integrated", "all_nutrient", "organic"] },
      { key: "aeration", label: "Add core aeration?", type: "boolean", optional: true },
      { key: "overseeding", label: "Add overseeding?", type: "boolean", optional: true },
    ],
    notes: "Core recurring-revenue product. Priced per turf sq ft × tier rate. Auto-renews.",
  },
  {
    id: "insect_grub_management",
    name: "Insect & Grub Management",
    vertical: "lawn",
    path: "instant_quote",
    cadence: "annual_program",
    pricingModel: "flat_range",
    requiresAssessment: false,
    blurb: "Preventive and curative control for turf insects and subsurface grubs.",
    pricing: { band: { low: 60, high: 160, typical: 100 } },
    quoteInputs: [{ key: "turfSqft", label: "Lawn square footage", type: "sqft", unit: "sq ft" }],
  },
  {
    id: "core_aeration",
    name: "Core Aeration",
    vertical: "lawn",
    path: "instant_quote",
    cadence: "seasonal",
    pricingModel: "per_sqft",
    requiresAssessment: false,
    blurb: "Pull soil cores to relieve compaction and open pathways for air, water, and nutrients.",
    pricing: { perSqftAnnual: { low: 0.03, high: 0.06, typical: 0.04 }, minCharge: 95 },
    quoteInputs: [{ key: "turfSqft", label: "Lawn square footage", type: "sqft", unit: "sq ft" }],
    notes: "Usually once/year, spring or fall. $95–$250 typical residential.",
  },
  {
    id: "lawn_seeding",
    name: "Lawn Seeding / Overseeding",
    vertical: "lawn",
    path: "instant_quote",
    cadence: "seasonal",
    pricingModel: "per_sqft",
    requiresAssessment: false,
    blurb: "Overseeding or reseeding to thicken turf and fill bare spots.",
    pricing: { perSqftAnnual: { low: 0.09, high: 0.18, typical: 0.13 }, minCharge: 300 },
    quoteInputs: [{ key: "turfSqft", label: "Lawn square footage", type: "sqft", unit: "sq ft" }],
  },
  {
    id: "lawn_disease_treatment",
    name: "Lawn Disease Treatment",
    vertical: "lawn",
    path: "consultation",
    cadence: "annual_program",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb: "Diagnosis and treatment of turf fungal and disease issues.",
    pricing: { band: { low: 75, high: 300 } },
  },
  {
    id: "irrigation_service",
    name: "Irrigation Service",
    vertical: "lawn",
    path: "consultation",
    cadence: "seasonal",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb: "Irrigation system inspection, tuning, and seasonal service.",
    pricing: { band: { low: 100, high: 500 } },
  },
  {
    id: "weed_control",
    name: "Weed Control",
    vertical: "lawn",
    path: "instant_quote",
    cadence: "annual_program",
    pricingModel: "flat_range",
    requiresAssessment: false,
    blurb: "Pre- and post-emergent broadleaf weed control. Sold standalone or inside a program.",
    pricing: { band: { low: 50, high: 125, typical: 85 } },
    quoteInputs: [{ key: "turfSqft", label: "Lawn square footage", type: "sqft", unit: "sq ft" }],
  },
  {
    id: "homeshield_pest_barrier",
    name: "HomeShield Pest Barrier",
    vertical: "lawn",
    path: "instant_quote",
    cadence: "annual_program",
    pricingModel: "per_sqft",
    requiresAssessment: false,
    blurb:
      "Perimeter pest barrier program treating turf and structure-adjacent insects across 3–5 seasonal visits.",
    pricing: { perSqftAnnual: { low: 0.05, high: 0.1, typical: 0.07 }, minCharge: 300 },
    quoteInputs: [{ key: "turfSqft", label: "Property square footage", type: "sqft", unit: "sq ft" }],
    notes: "Annual ≈ $300–$750. Popular add-on for pet/family households.",
  },

  // ── TICK & MOSQUITO ─────────────────────────────────────────────
  {
    id: "tick_control_program",
    name: "Tick Control Program",
    vertical: "tick",
    path: "instant_quote",
    cadence: "annual_program",
    pricingModel: "per_sqft",
    requiresAssessment: false,
    blurb:
      "Targeted seasonal tick treatments (6–8 visits) to reduce tick populations across the property.",
    pricing: { perSqftAnnual: { low: 0.06, high: 0.11, typical: 0.08 }, minCharge: 300 },
    quoteInputs: [
      { key: "turfSqft", label: "Property square footage", type: "sqft", unit: "sq ft" },
      { key: "wooded", label: "Property type", type: "select", options: ["Mostly open", "Mixed", "Heavily wooded"] },
      { key: "pets", label: "Pets on property?", type: "boolean", optional: true },
    ],
    notes: "Annual ≈ $300–$700 for a standard yard; scales up past 10,000 sq ft.",
  },
  {
    id: "mosquito_control_program",
    name: "Mosquito Control Program",
    vertical: "tick",
    path: "instant_quote",
    cadence: "seasonal",
    pricingModel: "per_sqft",
    requiresAssessment: false,
    blurb:
      "Recurring seasonal mosquito barrier treatments to reduce populations through the warm months.",
    pricing: { perSqftAnnual: { low: 0.06, high: 0.12, typical: 0.09 }, minCharge: 400 },
    quoteInputs: [
      { key: "turfSqft", label: "Property square footage", type: "sqft", unit: "sq ft" },
      { key: "treeDensity", label: "Tree / vegetation density", type: "select", options: ["Low", "Medium", "High"] },
      { key: "treatments", label: "Treatments per season", type: "number", unit: "treatments", optional: true },
      { key: "tickAddOn", label: "Bundle tick control?", type: "boolean", optional: true },
    ],
    notes: "Annual ≈ $400–$900/season. Bundles with tick control.",
  },

  // ── DEER CONTROL ────────────────────────────────────────────────
  {
    id: "deer_clear_repellent",
    name: "Clear Repellent Treatments",
    vertical: "deer",
    path: "consultation",
    cadence: "annual_program",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb: "Clear-drying deer repellent applications that protect plantings without visible residue.",
    pricing: { band: { low: 400, high: 1200 } },
    notes: "Part of the patented triple-layer program.",
  },
  {
    id: "deer_three_circles",
    name: "Deer Repellent Solution (Three Circles)",
    vertical: "deer",
    path: "consultation",
    cadence: "annual_program",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb: "SavATree's patented triple-layer 'Three Circles' deer deterrent system.",
    pricing: { band: { low: 500, high: 1500 } },
    notes: "Proprietary/patented — premium, no public benchmark.",
  },
  {
    id: "deer_winter_deterrent",
    name: "Winter Deer Deterrent",
    vertical: "deer",
    path: "consultation",
    cadence: "seasonal",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb: "Cold-season deterrent applications for winter browse pressure.",
    pricing: { band: { low: 200, high: 800 } },
  },

  // ── LANDSCAPE ───────────────────────────────────────────────────
  {
    id: "landscape_design_maintenance",
    name: "Landscape Design & Maintenance",
    vertical: "landscape",
    path: "consultation",
    cadence: "annual_program",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb: "Design, installation, and ongoing maintenance of landscape plantings and beds.",
    pricing: { band: { low: 500, high: 10000 } },
    notes: "Fully scoped on site.",
  },

  // ── HOLIDAY ─────────────────────────────────────────────────────
  {
    id: "holiday_lighting",
    name: "Holiday Lighting & Decor",
    vertical: "holiday",
    path: "consultation",
    cadence: "seasonal",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb: "Custom holiday lighting design, install, takedown, and storage for home or business.",
    pricing: { band: { low: 500, high: 5000 } },
    notes: "Seasonal; scope by roofline/tree count on site.",
  },

  // ── COMMERCIAL / CONSULTING ─────────────────────────────────────
  {
    id: "commercial_services",
    name: "Commercial Landscape Solutions",
    vertical: "commercial",
    path: "consultation",
    cadence: "annual_program",
    pricingModel: "consultation",
    requiresAssessment: true,
    blurb:
      "Tree, shrub, and landscape maintenance programs for commercial and municipal properties.",
    pricing: { band: { low: 1000, high: 100000 } },
    notes: "Property-type specific (HOA, golf, office park, campus, municipal, hospital).",
  },
  {
    id: "consulting_group",
    name: "Consulting Group",
    vertical: "commercial",
    path: "consultation",
    cadence: "one_time",
    pricingModel: "hourly",
    requiresAssessment: true,
    blurb:
      "Registered Consulting & ISA Certified Arborists: risk assessments, appraisals, inventory, construction-related tree management, urban forest master planning.",
    pricing: { hourly: { low: 150, high: 350 } },
    notes: "ANSI A300 tree risk assessment (Probability × Consequences = Risk).",
  },
];

// ─────────────────────────────────────────────────────────────────
// Quote engine
// ─────────────────────────────────────────────────────────────────

export interface QuoteInput {
  serviceId: string;
  turfSqft?: number;
  tierId?: string;
  stumpDiameterInches?: number;
  stumpCount?: number;
  treeShrubCount?: number;
  hours?: number;
}

export interface QuoteResult {
  serviceId: string;
  serviceName: string;
  path: FulfillmentPath;
  cadence: Cadence;
  requiresAssessment: boolean;
  estimate: PriceBand | null;
  isBookable: boolean;
  lineItems: string[];
  disclaimer: string;
}

export function getService(id: string): Service | undefined {
  return CATALOG.find((s) => s.id === id);
}

const round = (n: number): number => Math.round(n);

export function generateQuote(input: QuoteInput): QuoteResult {
  const svc = getService(input.serviceId);
  if (!svc) throw new Error(`Unknown service: ${input.serviceId}`);

  const base = {
    serviceId: svc.id,
    serviceName: svc.name,
    path: svc.path,
    cadence: svc.cadence,
    requiresAssessment: svc.requiresAssessment,
    disclaimer: PRICING_DISCLAIMER,
  };

  const lineItems: string[] = [];
  let estimate: PriceBand | null = null;

  switch (svc.pricingModel) {
    case "tiered_program": {
      const tier =
        svc.pricing.tiers?.find((t) => t.id === input.tierId) ??
        svc.pricing.tiers?.[0];
      const sqft = input.turfSqft ?? PROPERTY_SIZE_TIERS.M.midSqft;
      if (tier) {
        const low = Math.max(tier.annualFloor, sqft * tier.annualRatePerSqft.low);
        const high = Math.max(tier.annualFloor, sqft * tier.annualRatePerSqft.high);
        estimate = { low: round(low), high: round(high) };
        lineItems.push(
          `${tier.name} — ${tier.visitsPerYear} visits/yr`,
          `${sqft.toLocaleString()} sq ft @ $${tier.annualRatePerSqft.low}–$${tier.annualRatePerSqft.high}/sq ft/yr`,
          `Annual floor: $${tier.annualFloor}`
        );
      }
      break;
    }

    case "per_sqft": {
      const sqft = input.turfSqft ?? PROPERTY_SIZE_TIERS.M.midSqft;
      const r = svc.pricing.perSqftAnnual!;
      const min = svc.pricing.minCharge ?? 0;
      estimate = {
        low: round(Math.max(min, sqft * r.low)),
        high: round(Math.max(min, sqft * r.high)),
      };
      lineItems.push(
        `${sqft.toLocaleString()} sq ft @ $${r.low}–$${r.high}/sq ft`,
        min ? `Minimum charge: $${min}` : ""
      );
      break;
    }

    case "per_tree": {
      const count = input.treeShrubCount ?? 3;
      const pt = svc.pricing.perTree!;
      const tx = svc.pricing.treatmentsPerYear ?? 1;
      estimate = {
        low: round(count * pt.low * tx),
        high: round(count * pt.high * tx),
      };
      lineItems.push(
        `${count} tree/shrub × $${pt.low}–$${pt.high}/ea × ${tx} treatment(s)/yr`
      );
      break;
    }

    case "per_unit": {
      const inches = input.stumpDiameterInches ?? 12;
      const count = input.stumpCount ?? 1;
      const u = svc.pricing.perUnit!;
      const min = svc.pricing.minCharge ?? 0;
      const firstLow = Math.max(min, inches * u.low);
      const firstHigh = Math.max(min, inches * u.high);
      const addl = svc.pricing.additionalUnit;
      const extra = Math.max(0, count - 1);
      estimate = {
        low: round(firstLow + extra * (addl?.low ?? 0)),
        high: round(firstHigh + extra * (addl?.high ?? 0)),
      };
      lineItems.push(
        `First stump: ${inches}" @ $${u.low}–$${u.high}/${svc.pricing.unitLabel}`,
        min ? `Minimum charge: $${min}` : "",
        extra ? `${extra} additional stump(s) @ $${addl?.low}–$${addl?.high} ea` : ""
      );
      break;
    }

    case "hourly": {
      const hrs = input.hours ?? 2;
      const h = svc.pricing.hourly!;
      estimate = { low: round(hrs * h.low), high: round(hrs * h.high) };
      lineItems.push(`${hrs} hr @ $${h.low}–$${h.high}/hr`);
      break;
    }

    case "flat_range": {
      estimate = svc.pricing.band ?? null;
      if (svc.pricing.band?.typical) lineItems.push(`Typical: ~$${svc.pricing.band.typical}`);
      break;
    }

    case "consultation": {
      estimate = svc.pricing.band ?? null;
      lineItems.push("Firm price provided after on-site arborist assessment.");
      break;
    }
  }

  return {
    ...base,
    estimate,
    isBookable: svc.path === "instant_quote",
    lineItems: lineItems.filter(Boolean),
  };
}

// ─────────────────────────────────────────────────────────────────
// Views / helpers
// ─────────────────────────────────────────────────────────────────

export const INSTANT_QUOTE_SERVICES = CATALOG.filter((s) => s.path === "instant_quote");
export const CONSULTATION_SERVICES = CATALOG.filter((s) => s.path === "consultation");
export const byVertical = (v: Vertical): Service[] => CATALOG.filter((s) => s.vertical === v);

export const VERTICAL_LABELS: Record<Vertical, string> = {
  trees_shrubs: "Trees & Shrubs",
  plant_health: "Plant Health Care",
  lawn: "Lawn Care",
  tick: "Tick & Mosquito",
  deer: "Deer Control",
  landscape: "Landscape Services",
  holiday: "Holiday Lighting & Decor",
  commercial: "Commercial & Consulting",
};

/**
 * Serialize the catalog into markdown for a conversational quoting agent's
 * system context (voda-agentic-style grounding — no separate API call needed).
 */
export function toAgentContext(): string {
  const lines: string[] = [
    "# SavATree Service Catalog (agent grounding)",
    "",
    `> ${PRICING_DISCLAIMER}`,
    "",
    "Two fulfillment paths:",
    "- **instant_quote** — quote and book directly (size / per-tree / unit driven).",
    "- **consultation** — route to arborist assessment; give a soft range only, never a firm bookable price.",
    "",
  ];

  (Object.keys(VERTICAL_LABELS) as Vertical[]).forEach((v) => {
    const services = byVertical(v);
    if (!services.length) return;
    lines.push(`## ${VERTICAL_LABELS[v]}`, "");
    services.forEach((s) => {
      const price =
        s.pricingModel === "tiered_program"
          ? s.pricing.tiers
              ?.map((t) => `${t.name} ~$${t.annualFloor}+/yr (${t.visitsPerYear} visits)`)
              .join("; ")
          : s.pricing.perTree
          ? `$${s.pricing.perTree.low}–$${s.pricing.perTree.high}/tree × ${s.pricing.treatmentsPerYear ?? 1}/yr`
          : s.pricing.band
          ? `$${s.pricing.band.low}–$${s.pricing.band.high}`
          : s.pricing.perSqftAnnual
          ? `$${s.pricing.perSqftAnnual.low}–$${s.pricing.perSqftAnnual.high}/sq ft`
          : s.pricing.perUnit
          ? `$${s.pricing.perUnit.low}–$${s.pricing.perUnit.high}/${s.pricing.unitLabel}`
          : s.pricing.hourly
          ? `$${s.pricing.hourly.low}–$${s.pricing.hourly.high}/hr`
          : "consultation";
      const inputs = s.quoteInputs?.length
        ? ` — asks: ${s.quoteInputs.map((i) => i.key).join(", ")}`
        : "";
      lines.push(`- **${s.name}** [${s.path}, ${s.cadence}] — ${s.blurb} _(${price})_${inputs}`);
    });
    lines.push("");
  });

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Quick self-check (ts-node / compiled node run)
// ─────────────────────────────────────────────────────────────────
declare const require: any;
declare const module: any;
if (typeof require !== "undefined" && require.main === module) {
  const examples: QuoteInput[] = [
    { serviceId: "lawn_program", tierId: "all_nutrient", turfSqft: 5000 },
    { serviceId: "deep_root_fertilization", treeShrubCount: 2 },
    { serviceId: "emerald_ash_borer_treatment", treeShrubCount: 4 },
    { serviceId: "mosquito_control_program", turfSqft: 8000 },
    { serviceId: "tick_control_program", turfSqft: 8000 },
    { serviceId: "stump_grinding", stumpDiameterInches: 18, stumpCount: 3 },
    { serviceId: "tree_disease_treatment", treeShrubCount: 3 },
    { serviceId: "tree_removal" },
  ];
  for (const ex of examples) {
    const q = generateQuote(ex);
    console.log(
      `\n${q.serviceName} [${q.path}${q.isBookable ? ", bookable" : ""}] ${
        q.estimate ? `$${q.estimate.low}–$${q.estimate.high}` : "—"
      }${q.cadence === "annual_program" ? "/yr" : ""}`
    );
    q.lineItems.forEach((li) => console.log(`  • ${li}`));
  }
  console.log(
    `\nCatalog: ${CATALOG.length} services — ${INSTANT_QUOTE_SERVICES.length} instant, ${CONSULTATION_SERVICES.length} consultation.`
  );
}
