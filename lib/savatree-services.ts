/**
 * SavATree — presentation layer over the program catalog.
 * ------------------------------------------------------------------
 * `savatree-catalog.ts` is the source of truth: PROGRAMS (the unit of sale),
 * ADDONS (attach to a program), PROJECTS (one-off arborist jobs), and the
 * quote engine. This module adds only UI concerns — vertical metadata, the
 * input config each price basis needs, and label helpers.
 *
 * The rule the UI must respect: treatments are never buyable. They render as
 * the included-visits timeline inside a tier, never as a selectable line item.
 */

import {
  Leaf,
  Sprout,
  Bug,
  Shield,
  Trees,
  Flower2,
  Building2,
  type LucideIcon,
} from "lucide-react"

import {
  PROGRAMS,
  PROJECTS,
  ADDONS,
  getAddon,
  PLANT_SIZE_MULTIPLIER,
  type Program,
  type Project,
  type Addon,
  type Vertical,
  type PriceBasis,
  type PlantSize,
  type Treatment,
  type TierLevel,
  type PropertyInputs,
  type PriceBand,
} from "@/lib/savatree-catalog"

// ─── Verticals ────────────────────────────────────────────────────────────────

export interface VerticalMeta {
  id: Vertical
  label: string
  icon: LucideIcon
  blurb: string
  /** program verticals enroll into a tiered plan; project verticals are one-off jobs. */
  kind: "program" | "project"
}

// Program verticals lead — they're the recurring revenue engine. Projects follow.
export const VERTICALS: VerticalMeta[] = [
  {
    id: "plant_health",
    label: "Plant Health Care",
    icon: Leaf,
    blurb: "A year-round care plan for your trees and shrubs.",
    kind: "program",
  },
  {
    id: "lawn",
    label: "Lawn Care",
    icon: Sprout,
    blurb: "Multi-visit turf programs built on your soil and grass type.",
    kind: "program",
  },
  {
    id: "pest",
    label: "Tick & Mosquito",
    icon: Bug,
    blurb: "Seasonal barrier treatments that make the yard usable again.",
    kind: "program",
  },
  {
    id: "deer",
    label: "Deer Protection",
    icon: Shield,
    blurb: "Patented layered deterrent system for your plantings.",
    kind: "program",
  },
  {
    id: "tree_work",
    label: "Tree Work",
    icon: Trees,
    blurb: "Pruning, removal, cabling & storm response.",
    kind: "project",
  },
  {
    id: "landscape",
    label: "Landscape & Lighting",
    icon: Flower2,
    blurb: "Design, planting, maintenance & holiday lighting.",
    kind: "project",
  },
  {
    id: "commercial",
    label: "Commercial",
    icon: Building2,
    blurb: "Programs for HOAs, campuses, and municipalities.",
    kind: "project",
  },
]

export function getVerticalMeta(id: Vertical): VerticalMeta {
  return VERTICALS.find((v) => v.id === id) ?? VERTICALS[0]
}

export const VERTICAL_LABELS: Record<Vertical, string> = VERTICALS.reduce(
  (acc, v) => ({ ...acc, [v.id]: v.label }),
  {} as Record<Vertical, string>,
)

// ─── Lookups ──────────────────────────────────────────────────────────────────

export function programForVertical(id: Vertical): Program | undefined {
  return PROGRAMS.find((p) => p.vertical === id)
}

export function projectsForVertical(id: Vertical): Project[] {
  // Instant-quotable jobs lead; urgent (storm) work sinks to the bottom of the list
  // because it routes to dispatch, not to a quote.
  return PROJECTS.filter((p) => p.vertical === id).sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? 1 : -1
    if (a.path !== b.path) return a.path === "instant_quote" ? -1 : 1
    return 0
  })
}

/** Add-ons a program can carry, in catalog order. */
export function addonsForProgram(programId: string): Addon[] {
  const program = PROGRAMS.find((p) => p.id === programId)
  if (!program) return []
  return program.eligibleAddons
    .map((id) => getAddon(id))
    .filter((a): a is Addon => Boolean(a) && a!.attachesTo.includes(programId))
}

// ─── Property inputs, by price basis ──────────────────────────────────────────

export interface BasisConfig {
  /** Key on PropertyInputs this basis writes to. */
  key: "turfSqft" | "propertySqft" | "plantCount" | "bedCount"
  kind: "sqft" | "count"
  label: string
  help: string
  unit: string
  default: number
  min: number
  max: number
  step: number
  presets: number[]
}

export const BASIS_CONFIG: Record<PriceBasis, BasisConfig> = {
  turf_sqft: {
    key: "turfSqft",
    kind: "sqft",
    label: "How big is your lawn?",
    help: "Turf area only — drag the slider or type it in.",
    unit: "sq ft",
    default: 4500,
    min: 1000,
    max: 40000,
    step: 500,
    presets: [],
  },
  property_sqft: {
    key: "propertySqft",
    kind: "sqft",
    label: "How big is your property?",
    help: "The treatable outdoor area — yard, beds, and woodline edge.",
    unit: "sq ft",
    default: 8000,
    min: 1000,
    max: 40000,
    step: 500,
    presets: [],
  },
  plant_count: {
    key: "plantCount",
    kind: "count",
    label: "How many trees and shrubs?",
    help: "Everything you want on the plan — an arborist confirms the count on site.",
    unit: "trees & shrubs",
    default: 6,
    min: 1,
    max: 200,
    step: 1,
    presets: [2, 4, 6, 10],
  },
  bed_count: {
    key: "bedCount",
    kind: "count",
    label: "How many planting beds need protection?",
    help: "Beds, borders, and ornamental groupings the deer browse.",
    unit: "beds",
    default: 4,
    min: 1,
    max: 40,
    step: 1,
    presets: [2, 3, 5, 8],
  },
}

/** Plant size is the dominant cost driver in plant health care — never skip it. */
export const PLANT_SIZES: { value: PlantSize; label: string; detail: string }[] = [
  { value: "small", label: "Small", detail: "Shrubs & ornamentals" },
  { value: "medium", label: "Medium", detail: "15–40 ft" },
  { value: "large", label: "Large", detail: "40–60 ft" },
  { value: "mature", label: "Mature", detail: "60 ft+ specimen" },
]

export { PLANT_SIZE_MULTIPLIER }

// ─── Treatment timeline ───────────────────────────────────────────────────────

export const SEASON_ORDER: Treatment["season"][] = [
  "dormant",
  "early_spring",
  "spring",
  "summer",
  "late_summer",
  "fall",
]

export const SEASON_LABELS: Record<Treatment["season"], string> = {
  dormant: "Dormant",
  early_spring: "Early Spring",
  spring: "Spring",
  summer: "Summer",
  late_summer: "Late Summer",
  fall: "Fall",
}

/** Treatments grouped into the seasonal timeline the tier card renders. */
export function treatmentsBySeason(treatments: Treatment[]): {
  season: Treatment["season"]
  label: string
  items: Treatment[]
}[] {
  return SEASON_ORDER.map((season) => ({
    season,
    label: SEASON_LABELS[season],
    items: treatments.filter((t) => t.season === season),
  })).filter((g) => g.items.length > 0)
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const TIER_LABELS: Record<TierLevel, string> = {
  good: "Essential",
  better: "Recommended",
  best: "Premium",
}

export function money(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: 0 })
}

export function bandText(band: PriceBand): string {
  return band.high !== band.low
    ? `$${money(band.low)}–$${money(band.high)}`
    : `$${money(band.low)}`
}

export function addonCadenceLabel(addon: Addon): string {
  switch (addon.cadence) {
    case "annual":
      return "Annual"
    case "seasonal":
      return "Seasonal"
    case "one_time":
      return "One-time"
  }
}

/** Human summary of the property inputs — rides along to checkout. */
export function summarizeInputs(program: Program, inputs: PropertyInputs): string {
  const cfg = BASIS_CONFIG[program.priceBasis]
  const value = inputs[cfg.key] ?? cfg.default
  const parts: string[] = []

  if (cfg.kind === "sqft") {
    parts.push(`${money(value)} sq ft`)
  } else if (program.priceBasis === "plant_count") {
    const size = PLANT_SIZES.find((s) => s.value === (inputs.plantSize ?? "medium"))
    parts.push(`${value} ${size?.label.toLowerCase() ?? "medium"} trees & shrubs`)
  } else {
    parts.push(`${value} ${cfg.unit}`)
  }

  if (inputs.organic && program.organicModifier) parts.push("Organic program")
  return parts.join(" · ")
}

export { PROGRAMS, PROJECTS, ADDONS }
export type { Program, Project, Addon, Vertical, PriceBasis, PlantSize, Treatment, TierLevel, PropertyInputs }
