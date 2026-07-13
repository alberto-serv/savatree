"use client"

/**
 * SavATree — branch configuration.
 * ------------------------------------------------------------------
 * The catalog (savatree-catalog.ts) says WHAT SavATree sells. This says what it
 * costs HERE, and which of it this branch actually does.
 *
 * A SavATree branch is a franchise with a territory, a crew, and a local market.
 * The San Jose manager and the Cleveland manager sell the same Plant Health Care
 * Program, and it is not the same price, because a crew-hour isn't the same price
 * and — the part that's unique to California — the city gets a say in whether the
 * work happens at all.
 *
 * Four things a manager controls, in the order they matter:
 *
 *   1. WHAT WE SELL. Not every branch does holiday lighting. A service the branch
 *      can't staff should not appear on the booking page, because the fastest way
 *      to lose a customer is to sell them something and then call to say no.
 *   2. WHAT IT COSTS. Per-tier rates and the annual floor that protects small
 *      properties, per program. Plus the branch labor index for tree work, which
 *      scales the national benchmark bands to what a climber costs in this market.
 *   3. THE CITY'S RULES. Tree-protection thresholds and permit fees. This is the
 *      one SavATree's model has that a cleaning franchise doesn't: in California
 *      an ordinance can add thousands to a removal, add weeks to it, or forbid it.
 *      Those numbers belong to a city, so they belong to the branch that serves it.
 *   4. ADD-ONS. Price, and which programs may offer them.
 *
 * The config is a set of OVERRIDES over the catalog, not a copy of it. Adding a
 * program to the catalog gives every branch the corporate default automatically
 * instead of leaving them with a hole where its price should be.
 * ------------------------------------------------------------------
 */

import { useCallback, useEffect, useState } from "react"
import {
  PROGRAMS, ADDONS, PROJECTS,
  type Program, type Addon, type Vertical, type TierLevel, type PriceBand,
} from "@/lib/savatree-catalog"
import { DEFAULT_PERMIT_POLICY, type PermitPolicy } from "@/lib/california-trees"
import { DEFAULT_TREE_RATES, type TreeRateCard } from "@/lib/tree-care"

export const CONFIG_KEY = "savatree-branch-config-v1"

// ─── Shape ────────────────────────────────────────────────────────────────────

export interface BranchIdentity {
  branchName: string
  city: string
  phone: string
  email: string
}

export interface TierRates {
  /** $ per basis unit per year — plants, sq ft, or beds, depending on the program. */
  rateLow: number
  rateHigh: number
  /** The floor that keeps a small property from being quoted below cost. */
  annualFloor: number
}

// Whether a program is SOLD here is `serviceEnabled` — one switch, on the service
// tile, where the manager already looks. A second `enabled` flag down here would
// be a second source of truth for the same question, and the two would disagree.
export interface ProgramConfig {
  /** Organic is a style choice, never a better tier. This is its uplift, as a %. */
  organicUpliftPct?: number
  tiers: Record<TierLevel, TierRates>
}

export interface TreeConfig {
  /**
   * Scales every tree-work band at once. The height bands below are what a tree
   * costs; this is the branch saying "and we're a Bay Area crew." Two knobs
   * because they answer different questions: the bands are the shape of the price
   * curve, the index is the market it sits in. A manager who's just moved into a
   * pricier labor market moves ONE number; a manager who's learned that his 60-80
   * ft removals lose money moves one band.
   */
  rateIndex: number
  /** The branch's tree rate card — base prices, job factors, stump, floors. */
  rates: TreeRateCard
  /** Which tree jobs this branch's crews actually take. */
  jobs: Record<string, boolean>
  /** Off → even the smallest clean job books an arborist instead of a crew. */
  allowDirectBooking: boolean
}

export interface BranchConfig {
  identity: BranchIdentity
  /** Service tiles, in the order the booking page offers them. */
  serviceOrder: Vertical[]
  serviceEnabled: Record<string, boolean>
  programs: Record<string, ProgramConfig>
  tree: TreeConfig
  permit: PermitPolicy
  /** Branch price for each add-on, overriding the catalog band. */
  addonRates: Record<string, PriceBand>
  /** Which programs offer which add-ons here. */
  addonEnabled: Record<string, Record<string, boolean>>
}

// ─── The San Jose default ─────────────────────────────────────────────────────

/**
 * The order the booking page offers services in. Tree work leads — in the South
 * Bay it's what a homeowner is looking at when they decide to call someone.
 */
export const SERVICE_ORDER: Vertical[] = [
  "tree_work", "lawn", "plant_health", "pest", "deer", "landscape",
]

export const SERVICE_LABELS: Record<string, string> = {
  tree_work: "Tree Care",
  lawn: "Lawn Care",
  plant_health: "Shrub Care",
  pest: "Insect & Tick Control",
  deer: "Deer Deterrent",
  landscape: "Decor & Holiday Lighting",
}

/** Tree jobs the branch can toggle. Storm work is dispatch, and is never optional. */
export const TREE_JOB_IDS = ["tree_removal", "tree_pruning", "stump_grinding", "cabling_bracing"]

/**
 * A Bay Area crew-hour is not an Ohio crew-hour. The catalog's tree bands are
 * calibrated against national reported quotes, so the San Jose branch opens at an
 * index above 1.0 — and the manager is expected to tune it against their own
 * closed jobs. It is a starting point, not a measurement.
 */
const SAN_JOSE_RATE_INDEX = 1.35

/**
 * San Jose's own ordinance numbers go here. They ship as the conservative
 * statewide pattern (see california-trees.ts) rather than as invented
 * San Jose-specific figures — the manager holds the municipal code, we don't, and
 * a wrong number here is the difference between a customer getting a permit and a
 * customer getting a fine. The /config screen says so in as many words.
 */
function defaultPolicy(): PermitPolicy {
  return {
    ...structuredClone(DEFAULT_PERMIT_POLICY),
    cityLabel: "San Jose and the surrounding South Bay cities",
  }
}

export function defaultConfig(): BranchConfig {
  return {
    identity: {
      branchName: "SavATree — San Jose",
      city: "San Jose, CA",
      phone: "(408) 555-0142",
      email: "sanjose@savatree.com",
    },
    serviceOrder: [...SERVICE_ORDER],
    serviceEnabled: Object.fromEntries(SERVICE_ORDER.map((v) => [v, true])),
    programs: Object.fromEntries(
      PROGRAMS.map((p) => [
        p.id,
        {
          organicUpliftPct: p.organicModifier ? Math.round((p.organicModifier - 1) * 100) : undefined,
          tiers: Object.fromEntries(
            p.tiers.map((t) => [
              t.level,
              { rateLow: t.rate.low, rateHigh: t.rate.high, annualFloor: t.annualFloor },
            ]),
          ) as Record<TierLevel, TierRates>,
        },
      ]),
    ),
    tree: {
      rateIndex: SAN_JOSE_RATE_INDEX,
      rates: {
        ...structuredClone(DEFAULT_TREE_RATES),
        // A crew, a chipper, and a round trip across the South Bay cost the same
        // whether the tree is twelve feet or thirty. Corporate ships no floor;
        // a real branch has one.
        minimumJobCharge: 450,
      },
      jobs: Object.fromEntries(TREE_JOB_IDS.map((id) => [id, true])),
      // A protected-tree removal can't be booked blind anyway (see tree-care.ts),
      // and in a city this dense the arborist visit is the cross-sell. Off.
      allowDirectBooking: false,
    },
    permit: defaultPolicy(),
    addonRates: Object.fromEntries(ADDONS.map((a) => [a.id, { ...a.pricing.band }])),
    addonEnabled: Object.fromEntries(
      PROGRAMS.map((p) => [
        p.id,
        Object.fromEntries(
          ADDONS.filter((a) => a.attachesTo.includes(p.id)).map((a) => [a.id, true]),
        ),
      ]),
    ),
  }
}

// ─── Resolvers — config + catalog → what the estimator actually prices ────────

/** The branch's version of a program: catalog structure, branch numbers. */
export function resolveProgram(cfg: BranchConfig, program: Program): Program {
  const pc = cfg.programs[program.id]
  if (!pc) return program

  return {
    ...program,
    organicModifier:
      program.organicModifier && pc.organicUpliftPct != null
        ? 1 + pc.organicUpliftPct / 100
        : program.organicModifier,
    tiers: program.tiers.map((t) => {
      const rates = pc.tiers[t.level]
      if (!rates) return t
      return {
        ...t,
        rate: { low: rates.rateLow, high: rates.rateHigh },
        annualFloor: rates.annualFloor,
      }
    }),
  }
}

/** The branch's add-on list: catalog copy, branch prices. */
export function resolveAddons(cfg: BranchConfig): Addon[] {
  return ADDONS.map((a) => {
    const band = cfg.addonRates[a.id]
    if (!band) return a
    return { ...a, pricing: { ...a.pricing, band: { ...band } } } as Addon
  })
}

/** Add-ons a program offers HERE — the branch can withdraw any of them. */
export function branchAddonsFor(cfg: BranchConfig, programId: string): Addon[] {
  return resolveAddons(cfg).filter(
    (a) => a.attachesTo.includes(programId) && cfg.addonEnabled[programId]?.[a.id],
  )
}

/** Services this branch sells, in its own order. */
export function enabledServices(cfg: BranchConfig): Vertical[] {
  return cfg.serviceOrder.filter((v) => cfg.serviceEnabled[v])
}

/** Tree jobs this branch takes. Storm/emergency always stays — it's dispatch. */
export function enabledTreeJobs(cfg: BranchConfig): string[] {
  return PROJECTS.filter(
    (p) => p.vertical === "tree_work" && (p.urgent || cfg.tree.jobs[p.id]),
  ).map((p) => p.id)
}

/** Everything estimateTreeWork needs from the branch. */
export function treeOptions(cfg: BranchConfig) {
  return {
    rateIndex: cfg.tree.rateIndex,
    rates: cfg.tree.rates,
    permitPolicy: cfg.permit,
    allowDirectBooking: cfg.tree.allowDirectBooking,
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/**
 * Merge a saved config over the current defaults, field by field. Never spread a
 * saved blob in wholesale: a config saved before a program existed would leave
 * that program with no rates at all, and the estimator would quote it at $0.
 * Defaults win wherever the save is silent.
 */
export function mergeConfig(saved: unknown): BranchConfig {
  const base = defaultConfig()
  if (!saved || typeof saved !== "object") return base
  const s = saved as Partial<BranchConfig>

  const cfg: BranchConfig = {
    ...base,
    identity: { ...base.identity, ...(s.identity ?? {}) },
    tree: {
      ...base.tree,
      ...(s.tree ?? {}),
      jobs: { ...base.tree.jobs, ...(s.tree?.jobs ?? {}) },
      rates: {
        ...base.tree.rates,
        ...(s.tree?.rates ?? {}),
        // A saved band list replaces ours wholesale only if it's actually usable.
        // An empty or malformed array would leave every tree priced at nothing.
        heightBands:
          Array.isArray(s.tree?.rates?.heightBands) && s.tree.rates.heightBands.length > 0
            ? s.tree.rates.heightBands
            : base.tree.rates.heightBands,
        jobFactor: { ...base.tree.rates.jobFactor, ...(s.tree?.rates?.jobFactor ?? {}) },
        stump: { ...base.tree.rates.stump, ...(s.tree?.rates?.stump ?? {}) },
      },
    },
    permit: {
      ...base.permit,
      ...(s.permit ?? {}),
      speciesDbh: { ...base.permit.speciesDbh, ...(s.permit?.speciesDbh ?? {}) },
    },
    serviceEnabled: { ...base.serviceEnabled, ...(s.serviceEnabled ?? {}) },
    addonRates: { ...base.addonRates, ...(s.addonRates ?? {}) },
    addonEnabled: Object.fromEntries(
      Object.entries(base.addonEnabled).map(([pid, addons]) => [
        pid,
        { ...addons, ...(s.addonEnabled?.[pid] ?? {}) },
      ]),
    ),
    programs: Object.fromEntries(
      Object.entries(base.programs).map(([pid, pc]) => {
        const savedProgram = s.programs?.[pid]
        if (!savedProgram) return [pid, pc]
        return [
          pid,
          {
            ...pc,
            ...savedProgram,
            tiers: Object.fromEntries(
              Object.entries(pc.tiers).map(([level, rates]) => [
                level,
                { ...rates, ...(savedProgram.tiers?.[level as TierLevel] ?? {}) },
              ]),
            ) as Record<TierLevel, TierRates>,
          },
        ]
      }),
    ),
  }

  // A saved order can't invent services, and can't lose the ones it never saw.
  if (Array.isArray(s.serviceOrder)) {
    const valid = s.serviceOrder.filter((v) => SERVICE_ORDER.includes(v))
    cfg.serviceOrder = [...valid, ...SERVICE_ORDER.filter((v) => !valid.includes(v))]
  }

  return cfg
}

function load(): BranchConfig {
  try {
    return mergeConfig(JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"))
  } catch {
    return defaultConfig()
  }
}

// ─── Editor hook ──────────────────────────────────────────────────────────────

export interface BranchStore {
  cfg: BranchConfig
  /** False until localStorage has been read — the server can't know the branch's rates. */
  hydrated: boolean
  setIdentity: (patch: Partial<BranchIdentity>) => void
  toggleService: (v: Vertical) => void
  reorderService: (fromId: Vertical, toId: Vertical) => void
  setTierRate: (programId: string, level: TierLevel, patch: Partial<TierRates>) => void
  setOrganicUplift: (programId: string, pct: number) => void
  setTree: (patch: Partial<TreeConfig>) => void
  setTreeRates: (patch: Partial<TreeRateCard>) => void
  setHeightBand: (index: number, patch: { maxFt?: number; low?: number; high?: number }) => void
  toggleTreeJob: (jobId: string) => void
  setPermit: (patch: Partial<PermitPolicy>) => void
  setSpeciesDbh: (species: string, dbh: number | null) => void
  setAddonRate: (addonId: string, band: PriceBand) => void
  toggleAddon: (programId: string, addonId: string) => void
  setAllAddons: (programId: string, enabled: boolean) => void
  reset: () => void
  dirty: boolean
}

export function useBranchConfig(): BranchStore {
  const [cfg, setCfg] = useState<BranchConfig>(defaultConfig)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setCfg(load())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
    } catch {
      // A branch with a full disk still gets to quote a job.
    }
  }, [cfg, hydrated])

  const patch = useCallback((fn: (c: BranchConfig) => BranchConfig) => setCfg(fn), [])

  return {
    cfg,
    hydrated,
    dirty: hydrated && JSON.stringify(cfg) !== JSON.stringify(defaultConfig()),

    setIdentity: (p) => patch((c) => ({ ...c, identity: { ...c.identity, ...p } })),

    toggleService: (v) =>
      patch((c) => ({ ...c, serviceEnabled: { ...c.serviceEnabled, [v]: !c.serviceEnabled[v] } })),

    // Move `from` into `to`'s slot — the same drag semantics as the facility cards
    // in the Anago editor this is modelled on.
    reorderService: (from, to) =>
      patch((c) => {
        if (from === to) return c
        const next = c.serviceOrder.filter((v) => v !== from)
        const i = next.indexOf(to)
        if (i === -1) return c
        next.splice(i, 0, from)
        return { ...c, serviceOrder: next }
      }),

    setTierRate: (programId, level, p) =>
      patch((c) => ({
        ...c,
        programs: {
          ...c.programs,
          [programId]: {
            ...c.programs[programId],
            tiers: {
              ...c.programs[programId].tiers,
              [level]: { ...c.programs[programId].tiers[level], ...p },
            },
          },
        },
      })),

    setOrganicUplift: (programId, pct) =>
      patch((c) => ({
        ...c,
        programs: { ...c.programs, [programId]: { ...c.programs[programId], organicUpliftPct: pct } },
      })),

    setTree: (p) => patch((c) => ({ ...c, tree: { ...c.tree, ...p } })),

    setTreeRates: (p) =>
      patch((c) => ({ ...c, tree: { ...c.tree, rates: { ...c.tree.rates, ...p } } })),

    setHeightBand: (index, p) =>
      patch((c) => ({
        ...c,
        tree: {
          ...c.tree,
          rates: {
            ...c.tree.rates,
            heightBands: c.tree.rates.heightBands.map((b, i) =>
              i === index
                ? {
                    maxFt: p.maxFt ?? b.maxFt,
                    band: { low: p.low ?? b.band.low, high: p.high ?? b.band.high },
                  }
                : b,
            ),
          },
        },
      })),

    toggleTreeJob: (jobId) =>
      patch((c) => ({
        ...c,
        tree: { ...c.tree, jobs: { ...c.tree.jobs, [jobId]: !c.tree.jobs[jobId] } },
      })),

    setPermit: (p) => patch((c) => ({ ...c, permit: { ...c.permit, ...p } })),

    setSpeciesDbh: (species, dbh) =>
      patch((c) => ({
        ...c,
        permit: { ...c.permit, speciesDbh: { ...c.permit.speciesDbh, [species]: dbh } },
      })),

    setAddonRate: (addonId, band) =>
      patch((c) => ({ ...c, addonRates: { ...c.addonRates, [addonId]: band } })),

    toggleAddon: (programId, addonId) =>
      patch((c) => ({
        ...c,
        addonEnabled: {
          ...c.addonEnabled,
          [programId]: {
            ...c.addonEnabled[programId],
            [addonId]: !c.addonEnabled[programId]?.[addonId],
          },
        },
      })),

    setAllAddons: (programId, enabled) =>
      patch((c) => ({
        ...c,
        addonEnabled: {
          ...c.addonEnabled,
          [programId]: Object.fromEntries(
            ADDONS.filter((a) => a.attachesTo.includes(programId)).map((a) => [a.id, enabled]),
          ),
        },
      })),

    reset: () => setCfg(defaultConfig()),
  }
}

/**
 * Read-only hydrate, for the customer-facing widget. The booking page must render
 * on the server with the corporate defaults and then swap to the branch's numbers
 * once localStorage is readable — anything else is a hydration mismatch.
 */
export function useSavedConfig(): BranchConfig {
  const [cfg, setCfg] = useState<BranchConfig>(defaultConfig)
  useEffect(() => setCfg(load()), [])
  return cfg
}
