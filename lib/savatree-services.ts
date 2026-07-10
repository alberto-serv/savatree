/**
 * SavATree — presentation layer over the service catalog.
 * ------------------------------------------------------------------
 * `savatree-catalog.ts` is the source of truth for services, pricing, and the
 * quote engine. This module adds the UI concerns the estimator flow needs:
 * vertical metadata (icon, blurb, ordering) and a few view helpers. Keeping it
 * separate mirrors how the Anago prototype split cleaning-data (config) from the
 * page components.
 */

import {
  Sprout,
  Leaf,
  Bug,
  Trees,
  Shield,
  Flower2,
  Sparkles,
  Building2,
  type LucideIcon,
} from "lucide-react"

import {
  CATALOG,
  byVertical,
  VERTICAL_LABELS,
  getService,
  type Service,
  type Vertical,
  type QuoteInputField,
} from "@/lib/savatree-catalog"

export interface VerticalMeta {
  id: Vertical
  label: string
  icon: LucideIcon
  blurb: string
  /** Photo behind the vertical card (optional — falls back to a solid tint). */
  image?: string
}

// Ordered so the productized, instant-quote-heavy verticals lead — that's the
// SERV Express bet (quote and book what we can, route the rest to an arborist).
export const VERTICALS: VerticalMeta[] = [
  {
    id: "lawn",
    label: VERTICAL_LABELS.lawn,
    icon: Sprout,
    blurb: "Multi-visit lawn programs, aeration, seeding & grub control.",
    image: "/images/sat/lawn.jpg",
  },
  {
    id: "plant_health",
    label: VERTICAL_LABELS.plant_health,
    icon: Leaf,
    blurb: "Deep-root fertilization, disease & pest treatment for trees & shrubs.",
    image: "/images/sat/plant-health.jpg",
  },
  {
    id: "tick",
    label: VERTICAL_LABELS.tick,
    icon: Bug,
    blurb: "Seasonal tick & mosquito barrier treatments for your property.",
    image: "/images/sat/tick.jpg",
  },
  {
    id: "trees_shrubs",
    label: VERTICAL_LABELS.trees_shrubs,
    icon: Trees,
    blurb: "Pruning, removal, cabling & storm response by certified arborists.",
    image: "/images/sat/trees.jpg",
  },
  {
    id: "deer",
    label: VERTICAL_LABELS.deer,
    icon: Shield,
    blurb: "Patented multi-layer deer repellent programs to protect plantings.",
    image: "/images/sat/deer.jpg",
  },
  {
    id: "landscape",
    label: VERTICAL_LABELS.landscape,
    icon: Flower2,
    blurb: "Design, installation & ongoing maintenance of beds and plantings.",
    image: "/images/sat/landscape.jpg",
  },
  {
    id: "holiday",
    label: VERTICAL_LABELS.holiday,
    icon: Sparkles,
    blurb: "Custom holiday lighting design, install, takedown & storage.",
    image: "/images/sat/holiday.jpg",
  },
  {
    id: "commercial",
    label: VERTICAL_LABELS.commercial,
    icon: Building2,
    blurb: "Tree, shrub & landscape programs for commercial and municipal sites.",
    image: "/images/sat/commercial.jpg",
  },
]

export function getVerticalMeta(id: Vertical): VerticalMeta {
  return VERTICALS.find((v) => v.id === id) ?? VERTICALS[0]
}

/** Services in a vertical, instant-quote ones first (they lead the flow). */
export function servicesForVertical(id: Vertical): Service[] {
  return byVertical(id).sort((a, b) => {
    if (a.path === b.path) return 0
    return a.path === "instant_quote" ? -1 : 1
  })
}

/** Count of bookable (instant) services in a vertical — drives the card badge. */
export function instantCountForVertical(id: Vertical): number {
  return byVertical(id).filter((s) => s.path === "instant_quote").length
}

export const CADENCE_SUFFIX: Record<Service["cadence"], string> = {
  one_time: "one-time",
  annual_program: "/yr",
  seasonal: "/season",
}

/** Human label for a cadence, used on estimate cards. */
export function cadenceLabel(cadence: Service["cadence"]): string {
  switch (cadence) {
    case "annual_program":
      return "Annual program"
    case "seasonal":
      return "Seasonal"
    case "one_time":
      return "One-time service"
  }
}

/** Sensible starting value for a quote input so the estimate is never empty. */
export function defaultInputValue(field: QuoteInputField): number | string | boolean {
  switch (field.type) {
    case "sqft":
      return 4500
    case "number":
      return field.key === "treeShrubCount" ? 3 : field.key === "stumpDiameterInches" ? 14 : 1
    case "select":
      return field.options?.[0] ?? ""
    case "boolean":
      return false
  }
}

export { CATALOG, getService, VERTICAL_LABELS }
export type { Service, Vertical, QuoteInputField }
