"use client"

/**
 * SavATree — branch setup console.
 * ------------------------------------------------------------------
 * Two views over one state, the way the Anago onboarding editor works: a live
 * PREVIEW of the customer's booking page, and an EDIT mode for the numbers
 * behind it. They share the same `useBranchConfig()` store, so the preview isn't
 * a mockup of the page — it IS the page, `<EmbedWizard>` itself, rendered with
 * the manager's current, unsaved edits. There is no gap for a discrepancy to
 * live in.
 *
 * Two things this console does that a cleaning-franchise editor doesn't have to:
 *
 *   1. It shows what the edit DOES. A wage box that says "$25" tells a manager
 *      nothing; a wage box that says "a 6-plant property now quotes $1,320–$2,400
 *      instead of $1,240–$2,260" tells them whether they meant it. Every pricing
 *      control here is next to the quote it moves.
 *   2. It lets the branch enter its city's tree ordinance. In California that is
 *      not a preference, it's the law, and it decides whether a removal costs
 *      $2,000 or $5,000 — or is refused. The numbers belong to a city, so they
 *      belong to the branch that serves it, and we say plainly that we're not the
 *      ones who know them.
 */

import { useState, useMemo, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Eye, SlidersHorizontal, Monitor, Smartphone, GripVertical, RotateCcw, Check,
  ChevronDown, TreePine, Building2, ShieldAlert, Phone, ExternalLink, Info,
} from "lucide-react"
import { EmbedWizard } from "@/app/embed/embed-wizard"
import {
  useBranchConfig, resolveProgram, resolveAddons, treeOptions, SERVICE_LABELS,
  type BranchStore,
} from "@/lib/branch-config"
import {
  PROGRAMS, ADDONS, quoteProgram,
  type Program, type TierLevel, type Vertical,
} from "@/lib/savatree-catalog"
import { BASIS_CONFIG, getVerticalMeta, money, bandText, projectsForVertical } from "@/lib/savatree-services"
import { estimateTreeWork } from "@/lib/tree-care"
import { CA_SPECIES, CA_ORDINANCE_DISCLAIMER, type TreeSpecies } from "@/lib/california-trees"

const TIER_ORDER: TierLevel[] = ["good", "better", "best"]

export function BranchConsole() {
  const store = useBranchConfig()
  const [mode, setMode] = useState<"preview" | "edit">("preview")
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")

  const go = (next: "preview" | "edit") => {
    setMode(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen bg-[#F5F8F5]">
      <ConsoleHeader store={store} />

      {/* Mode bar — sticky, because the manager flips between "what did I change"
          and "what does it look like" constantly. */}
      <div className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex rounded-xl bg-sky p-1">
            {([
              { id: "preview", label: "Preview", icon: Eye },
              { id: "edit", label: "Edit setup", icon: SlidersHorizontal },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold transition-colors ${
                  mode === t.id ? "bg-white text-navy shadow-brand-sm" : "text-navy/60 hover:text-navy"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          {mode === "preview" ? (
            <div className="flex rounded-xl bg-sky p-1">
              {([
                { id: "desktop", icon: Monitor, label: "Desktop" },
                { id: "mobile", icon: Smartphone, label: "Mobile" },
              ] as const).map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDevice(d.id)}
                  aria-label={d.label}
                  className={`rounded-lg p-2 transition-colors ${
                    device === d.id ? "bg-white text-navy shadow-brand-sm" : "text-navy/50 hover:text-navy"
                  }`}
                >
                  <d.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          ) : (
            <ResetControl store={store} />
          )}
        </div>
      </div>

      {mode === "preview" ? (
        <PreviewPane store={store} device={device} onEdit={() => go("edit")} />
      ) : (
        <EditPane store={store} onPreview={() => go("preview")} />
      )}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function ConsoleHeader({ store }: { store: BranchStore }) {
  const { identity } = store.cfg
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-4">
          {/* The mark is a tall SVG. Without a height class it renders at its own
              intrinsic ratio and towers over the branch name beside it — pin the
              height and let the width follow, exactly as the site header does. */}
          <Image
            src="/images/savatree-logo.svg"
            alt="SavATree"
            width={160}
            height={55}
            priority
            className="h-[38px] w-auto"
          />
          <span className="hidden h-9 w-px shrink-0 bg-line sm:block" />
          <div>
            <p className="text-[15px] font-bold leading-tight text-navy">{identity.branchName}</p>
            <p className="mt-0.5 text-[12.5px] leading-tight text-muted-foreground">
              {identity.city} · {identity.phone}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-sky px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-navy">
          Branch setup
        </span>
      </div>
    </header>
  )
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function PreviewPane({
  store, device, onEdit,
}: { store: BranchStore; device: "desktop" | "mobile"; onEdit: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-7 text-center">
        <h1 className="disp text-navy text-[clamp(26px,3.6vw,38px)]">Your booking page</h1>
        <p className="mx-auto mt-2 max-w-[52ch] text-[14px] text-muted-foreground">
          This is the live page your customers see, priced with your rates. Change anything in{" "}
          <button onClick={onEdit} className="font-bold text-orange-deep hover:underline">Edit setup</button>{" "}
          and it updates here.
        </p>
      </div>

      {/* The real widget, not a mockup of it. */}
      <div className="flex justify-center">
        <div
          className={`w-full rounded-[24px] bg-navy-deep/95 p-4 shadow-brand transition-all duration-300 ${
            device === "mobile" ? "max-w-[420px]" : "max-w-[760px]"
          }`}
        >
          <div className="rounded-[18px] bg-white/5 p-2">
            <EmbedWizard config={store.cfg} />
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-[12.5px] text-muted-foreground">
        Customers reach this page at{" "}
        <Link href="/embed" className="font-semibold text-orange-deep hover:underline">
          /embed
          <ExternalLink className="ml-1 inline h-3 w-3" />
        </Link>{" "}
        — embedded on your branch site or linked directly.
      </p>
    </div>
  )
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

function EditPane({ store, onPreview }: { store: BranchStore; onPreview: () => void }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="disp text-navy text-[clamp(26px,3.6vw,38px)]">Set up your branch</h1>
        <p className="mt-2 max-w-[60ch] text-[14px] text-muted-foreground">
          What you sell, what it costs here, and the tree rules your cities enforce. Every change shows
          up in your{" "}
          <button onClick={onPreview} className="font-bold text-orange-deep hover:underline">preview</button>{" "}
          immediately.
        </p>
      </div>

      {/* Ordered the way the branch thinks: what we sell, then tree care (the lead
          service, and the one with a rate card), then the city's rules that govern
          it, then plans — with add-ons directly beneath the plans they attach to. */}
      <div className="space-y-5">
        <IdentitySection store={store} />
        <ServicesSection store={store} />
        <TreeSection store={store} />
        <OrdinanceSection store={store} />
        <ProgramsSection store={store} />
        <AddonsSection store={store} />
      </div>

      <div className="mt-8 flex justify-center">
        <button onClick={onPreview} className="btn-orange">
          <Eye className="h-5 w-5" />
          See it on your booking page
        </button>
      </div>
    </div>
  )
}

function Section({
  title, blurb, icon: Icon, children, defaultOpen = false,
}: {
  title: string
  blurb: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-white shadow-brand-sm">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-6 py-5 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky text-navy">
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold text-navy">{title}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{blurb}</span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-navy/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-line-soft px-6 py-6">{children}</div>}
    </section>
  )
}

// ─── Identity ─────────────────────────────────────────────────────────────────

function IdentitySection({ store }: { store: BranchStore }) {
  const { identity } = store.cfg
  return (
    <Section
      title="Branch details"
      blurb="The name, city, and number your customers see."
      icon={Building2}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Text label="Branch name" value={identity.branchName} onChange={(v) => store.setIdentity({ branchName: v })} />
        <Text label="City" value={identity.city} onChange={(v) => store.setIdentity({ city: v })} />
        <Text label="Phone" value={identity.phone} onChange={(v) => store.setIdentity({ phone: v })} />
        <Text label="Email" value={identity.email} onChange={(v) => store.setIdentity({ email: v })} />
      </div>
      <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
        <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        This number is what a customer with a limb through their roof calls. It replaces the national
        line everywhere in your booking flow.
      </p>
    </Section>
  )
}

// ─── Services ─────────────────────────────────────────────────────────────────

function ServicesSection({ store }: { store: BranchStore }) {
  const [dragId, setDragId] = useState<Vertical | null>(null)
  const { serviceOrder, serviceEnabled } = store.cfg
  const onCount = serviceOrder.filter((v) => serviceEnabled[v]).length

  return (
    <Section
      title="Services you sell"
      blurb={`${onCount} of ${serviceOrder.length} shown · drag to set the order customers see`}
      icon={SlidersHorizontal}
      defaultOpen
    >
      <div className="space-y-2">
        {serviceOrder.map((id) => {
          const Icon = getVerticalMeta(id).icon
          const on = serviceEnabled[id]
          return (
            <div
              key={id}
              onDragOver={(e) => {
                if (!dragId || dragId === id) return
                e.preventDefault()
                store.reorderService(dragId, id)
              }}
              onDrop={(e) => e.preventDefault()}
              className={`flex items-center gap-3 rounded-xl border-2 px-3 py-3 transition-all ${
                dragId === id ? "border-orange bg-brand-select" : "border-line bg-white"
              } ${on ? "" : "opacity-55"}`}
            >
              <span
                draggable
                onDragStart={(e) => {
                  setDragId(id)
                  e.dataTransfer.effectAllowed = "move"
                  e.dataTransfer.setData("text/plain", id) // Firefox won't drag without it
                }}
                onDragEnd={() => setDragId(null)}
                aria-label={`Drag to reorder ${SERVICE_LABELS[id]}`}
                className="cursor-grab text-navy/30 hover:text-navy/60 active:cursor-grabbing"
              >
                <GripVertical className="h-5 w-5" />
              </span>
              <Icon className="h-5 w-5 shrink-0 text-navy" />
              <span className="flex-1 text-[14.5px] font-bold text-navy">{SERVICE_LABELS[id]}</span>
              <span className="text-[12px] font-semibold text-muted-foreground">{on ? "Shown" : "Hidden"}</span>
              <Toggle on={on} onClick={() => store.toggleService(id)} label={SERVICE_LABELS[id]} />
            </div>
          )
        })}
      </div>
      <Note>
        A service you can&apos;t staff should not be on the page. The fastest way to lose a customer is
        to sell them something and then call back to say no.
      </Note>
    </Section>
  )
}

// ─── Programs ─────────────────────────────────────────────────────────────────

function ProgramsSection({ store }: { store: BranchStore }) {
  const programs = PROGRAMS.filter((p) => store.cfg.serviceEnabled[p.vertical])

  return (
    <Section
      title="Plan pricing"
      blurb="Rates and floors for your year-round care plans."
      icon={Building2}
    >
      <div className="space-y-4">
        {programs.map((p) => (
          <ProgramCard key={p.id} program={p} store={store} />
        ))}
        {programs.length === 0 && (
          <p className="text-[13.5px] text-muted-foreground">
            No plan services are switched on. Turn one on above to price it.
          </p>
        )}
      </div>
    </Section>
  )
}

function ProgramCard({ program, store }: { program: Program; store: BranchStore }) {
  const [open, setOpen] = useState(false)
  const pc = store.cfg.programs[program.id]
  const basis = BASIS_CONFIG[program.priceBasis]
  const resolved = useMemo(() => resolveProgram(store.cfg, program), [store.cfg, program])
  const addons = useMemo(() => resolveAddons(store.cfg), [store.cfg])

  // A typical property for this program, so the manager sees the consequence of
  // the number they just typed rather than the number itself.
  const sample = useMemo(() => {
    const inputs = { [basis.key]: basis.default, plantSize: "medium" as const }
    return TIER_ORDER.map((level) => {
      const tier = resolved.tiers.find((t) => t.level === level)
      if (!tier) return null
      const q = quoteProgram(program.id, level, inputs, { program: resolved, addons })
      return { level, name: tier.name, quote: q }
    }).filter(Boolean) as { level: TierLevel; name: string; quote: ReturnType<typeof quoteProgram> }[]
  }, [resolved, addons, program.id, basis])

  const sampleLabel =
    basis.kind === "sqft"
      ? `${money(basis.default)} sq ft`
      : `${basis.default} ${basis.unit}`

  return (
    <div className="rounded-[14px] border border-line bg-[#FCFDFC]">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex-1">
          <span className="block text-[14.5px] font-bold text-navy">{program.name}</span>
          <span className="mt-0.5 block text-[12px] text-muted-foreground">
            {sample.map((s) => `${s.name} ${bandText(s.quote.annual)}`).join(" · ")}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-navy/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-line-soft px-4 py-5">
          <p className="mb-4 text-[12.5px] text-muted-foreground">
            Priced per <strong className="text-navy">{basis.unit}</strong> per year, with a floor that
            protects the small jobs.
          </p>

          <div className="space-y-3">
            {TIER_ORDER.map((level) => {
              const rates = pc?.tiers[level]
              const tier = program.tiers.find((t) => t.level === level)
              if (!rates || !tier) return null
              const q = sample.find((s) => s.level === level)?.quote
              return (
                <div key={level} className="rounded-xl border border-line bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[14px] font-bold text-navy">
                      {tier.name}
                      <span className="ml-2 text-[12px] font-semibold text-muted-foreground">
                        {tier.visitsPerYear} visits/yr
                      </span>
                    </span>
                    {q && (
                      <span className="text-[12.5px] text-muted-foreground">
                        {sampleLabel} →{" "}
                        <strong className="text-navy tabular-nums">{bandText(q.annual)}/yr</strong>
                        {q.annual.low === rates.annualFloor && (
                          <span className="ml-1.5 rounded bg-gold/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-navy">
                            at floor
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Money
                      label="Rate low"
                      suffix={`/${basis.kind === "sqft" ? "sq ft" : "unit"}/yr`}
                      value={rates.rateLow}
                      step={basis.kind === "sqft" ? 0.01 : 5}
                      onChange={(n) => store.setTierRate(program.id, level, { rateLow: n })}
                    />
                    <Money
                      label="Rate high"
                      suffix={`/${basis.kind === "sqft" ? "sq ft" : "unit"}/yr`}
                      value={rates.rateHigh}
                      step={basis.kind === "sqft" ? 0.01 : 5}
                      onChange={(n) => store.setTierRate(program.id, level, { rateHigh: n })}
                    />
                    <Money
                      label="Annual floor"
                      suffix="/yr"
                      value={rates.annualFloor}
                      step={25}
                      onChange={(n) => store.setTierRate(program.id, level, { annualFloor: n })}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {program.organicModifier && pc?.organicUpliftPct != null && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
              <span className="text-[13.5px] font-semibold text-navy">Organic program uplift</span>
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pc.organicUpliftPct}
                  onChange={(e) => store.setOrganicUplift(program.id, Number(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-line px-3 py-2 text-right text-[14px] font-bold tabular-nums text-navy focus:border-orange focus:outline-none"
                />
                <span className="text-[13px] font-semibold text-muted-foreground">%</span>
              </div>
              <p className="w-full text-[12px] text-muted-foreground">
                A style choice at any plan level — never presented to the customer as a better plan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tree care ────────────────────────────────────────────────────────────────

/** A quote the manager can recognise, recomputed from whatever they just typed. */
function useTreeSamples(store: BranchStore) {
  return useMemo(() => {
    const opts = treeOptions(store.cfg)
    const shape = { diameterInches: 14, count: 1, access: "moderate" as const }
    const at = (job: "removal" | "pruning" | "cabling", heightFt: number, extra = {}) =>
      estimateTreeWork({ job, heightFt, ...shape, ...extra }, opts)

    return {
      national: estimateTreeWork(
        { job: "removal", heightFt: 40, ...shape },
        { ...opts, rateIndex: 1 },
      ),
      removal: at("removal", 40),
      pruning: at("pruning", 40),
      cabling: at("cabling", 40),
      // The floor bites on light jobs, not short ones — a small prune, not a
      // small takedown. Show the manager the case their floor actually catches.
      small: at("pruning", 15, { diameterInches: 6, access: "open" as const }),
      stump: at("removal", 40, { addStumpGrinding: true }),
    }
  }, [store.cfg])
}

function TreeSection({ store }: { store: BranchStore }) {
  const { tree } = store.cfg
  const rates = tree.rates
  // In the order the customer meets them, not catalog order — a manager toggling
  // jobs should be looking at their own booking page.
  const jobs = projectsForVertical("tree_work").filter((p) => !p.urgent)
  const s = useTreeSamples(store)

  const bandLabel = (i: number) => {
    const lo = i === 0 ? 0 : rates.heightBands[i - 1].maxFt
    const hi = rates.heightBands[i].maxFt
    return hi >= 999 ? `${lo} ft and up` : `${lo}–${hi} ft`
  }

  return (
    <Section
      title="Tree care"
      blurb="Your rate card, your market, and which jobs your crews take."
      icon={TreePine}
      defaultOpen
    >
      {/* ── 1. What a tree costs, by height. The actual rate card. ── */}
      <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        What a removal costs, by tree height
      </p>
      <p className="mb-3 text-[12.5px] leading-snug text-muted-foreground">
        Removal is the reference job — pruning and cabling are priced as a fraction of it below. These are
        per tree, before access, condition, and your market index.
      </p>
      <div className="space-y-2">
        {rates.heightBands.map((b, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
            <span className="w-24 shrink-0 text-[13.5px] font-bold text-navy">{bandLabel(i)}</span>
            <div className="flex flex-1 items-center gap-2">
              <Money
                label="Low"
                aria={`${bandLabel(i)} removal, low`}
                value={b.band.low}
                step={25}
                onChange={(n) => store.setHeightBand(i, { low: n })}
              />
              <Money
                label="High"
                aria={`${bandLabel(i)} removal, high`}
                value={b.band.high}
                step={25}
                onChange={(n) => store.setHeightBand(i, { high: n })}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── 2. The market index. One number for "we're a Bay Area crew." ── */}
      <div className="mt-5 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-bold text-navy">Market index</p>
            <p className="mt-0.5 max-w-[46ch] text-[12.5px] leading-snug text-muted-foreground">
              Scales every band above at once. The rates ship as national benchmarks and a Bay Area
              crew-hour isn&apos;t an Ohio crew-hour. Tune it against jobs you&apos;ve actually closed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.5}
              max={2.5}
              step={0.05}
              aria-label="Branch labor index"
              value={tree.rateIndex}
              onChange={(e) => store.setTree({ rateIndex: Number(e.target.value) || 1 })}
              className="w-24 rounded-lg border border-line px-3 py-2 text-right text-[16px] font-extrabold tabular-nums text-navy focus:border-orange focus:outline-none"
            />
            <span className="text-[13px] font-semibold text-muted-foreground">×</span>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-brand-band p-3.5 text-[12.5px] text-body">
          A typical 40 ft removal, 14&quot; trunk, moderate access:{" "}
          <span className="line-through opacity-50">{bandText(s.national.estimate)}</span>{" "}
          <strong className="text-navy">{bandText(s.removal.estimate)}</strong>{" "}
          <span className="text-muted-foreground">at your rates</span>
        </div>
      </div>

      {/* ── 3. The truck-roll floor. ── */}
      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-bold text-navy">Minimum for any tree job</p>
            <p className="mt-0.5 max-w-[46ch] text-[12.5px] leading-snug text-muted-foreground">
              A crew, a chipper, and the drive cost the same whether the tree is twelve feet or thirty.
              Below this, you&apos;re paying for the privilege of doing the work. Set 0 for no floor.
            </p>
          </div>
          <Money
            label="Floor"
            aria="Minimum charge for any tree job"
            value={rates.minimumJobCharge}
            step={25}
            onChange={(n) => store.setTreeRates({ minimumJobCharge: n })}
          />
        </div>
        <div className="mt-4 rounded-lg bg-brand-band p-3.5 text-[12.5px] text-body">
          Pruning a 15 ft ornamental:{" "}
          <strong className="text-navy">{bandText(s.small.estimate)}</strong>
          {s.small.minimumApplied && (
            <span className="ml-2 rounded bg-gold/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-navy">
              at your floor
            </span>
          )}
        </div>
      </div>

      {/* ── 4. Pruning and cabling, as a share of removal. ── */}
      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <p className="text-[14px] font-bold text-navy">Pruning &amp; cabling, as a share of removal</p>
        <p className="mt-0.5 mb-3 text-[12.5px] leading-snug text-muted-foreground">
          A crew that&apos;s slow on takedowns but fast on climbs prices these differently. Same 40 ft tree.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            { job: "pruning" as const, label: "Pruning", sample: s.pruning },
            { job: "cabling" as const, label: "Cabling & bracing", sample: s.cabling },
          ]).map((row) => (
            <div key={row.job} className="rounded-lg border border-line-soft bg-[#FCFDFC] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-bold text-navy">{row.label}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={5}
                    max={150}
                    step={1}
                    aria-label={`${row.label} as a percentage of removal`}
                    value={Math.round(rates.jobFactor[row.job] * 100)}
                    onChange={(e) =>
                      store.setTreeRates({
                        jobFactor: {
                          ...rates.jobFactor,
                          [row.job]: Math.max(0.05, (Number(e.target.value) || 0) / 100),
                        },
                      })
                    }
                    className="w-16 rounded-lg border border-line px-2 py-1.5 text-right text-[13.5px] font-bold tabular-nums text-navy focus:border-orange focus:outline-none"
                  />
                  <span className="text-[12px] font-semibold text-muted-foreground">%</span>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                → <strong className="text-navy tabular-nums">{bandText(row.sample.estimate)}</strong>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Stump grinding. One rate card, whether it's its own job or an add-on. ── */}
      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <p className="text-[14px] font-bold text-navy">Stump grinding</p>
        <p className="mt-0.5 mb-3 text-[12.5px] leading-snug text-muted-foreground">
          Priced by trunk diameter. Used both as its own job and as the add-on to a removal — one rate
          card, so the same stump never gets two different numbers.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money
            label="Per inch, low"
            value={rates.stump.perInch.low}
            step={1}
            onChange={(n) => store.setTreeRates({ stump: { ...rates.stump, perInch: { ...rates.stump.perInch, low: n } } })}
          />
          <Money
            label="Per inch, high"
            value={rates.stump.perInch.high}
            step={1}
            onChange={(n) => store.setTreeRates({ stump: { ...rates.stump, perInch: { ...rates.stump.perInch, high: n } } })}
          />
          <Money
            label="Minimum"
            value={rates.stump.minCharge}
            step={10}
            onChange={(n) => store.setTreeRates({ stump: { ...rates.stump, minCharge: n } })}
          />
          <Money
            label="Each extra"
            value={rates.stump.additionalStump.low}
            step={5}
            onChange={(n) =>
              store.setTreeRates({
                stump: {
                  ...rates.stump,
                  additionalStump: { low: n, high: Math.max(n, rates.stump.additionalStump.high) },
                },
              })
            }
          />
        </div>
      </div>

      {/* ── 6. What the crews take. ── */}
      <p className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        Jobs your crews take
      </p>
      <div className="space-y-2">
        {jobs.map((j) => (
          <div key={j.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
            <span className="flex-1 text-[14px] font-semibold text-navy">{j.name}</span>
            <Toggle on={!!tree.jobs[j.id]} onClick={() => store.toggleTreeJob(j.id)} label={j.name} />
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-xl border border-line bg-[#FCFDFC] px-4 py-3 opacity-70">
          <span className="flex-1 text-[14px] font-semibold text-navy">Emergency &amp; Storm Damage</span>
          <span className="text-[12px] font-semibold text-muted-foreground">Always on — dispatch</span>
        </div>
      </div>

      {/* ── 7. Who gets a crew, and who gets an arborist. ── */}
      <div className="mt-4 rounded-xl border border-line bg-white px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="flex-1">
            <span className="block text-[14px] font-semibold text-navy">Let small, clean jobs book a crew directly</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
              Off, every tree job books a free arborist assessment instead — which is where the cross-sell
              happens, and the only way to catch a protected tree before a crew is on the calendar.
            </span>
          </span>
          <Toggle
            on={tree.allowDirectBooking}
            onClick={() => store.setTree({ allowDirectBooking: !tree.allowDirectBooking })}
            label="Direct booking"
          />
        </div>

        {tree.allowDirectBooking && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-3">
            <span className="max-w-[42ch] text-[12.5px] leading-snug text-muted-foreground">
              …but never above this height. Anything taller books an arborist no matter how clean it looks
              from the ground.
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={80}
                step={5}
                aria-label="Maximum height for direct booking, feet"
                value={rates.directBookMaxHeightFt}
                onChange={(e) => store.setTreeRates({ directBookMaxHeightFt: Number(e.target.value) || 30 })}
                className="w-20 rounded-lg border border-line px-3 py-2 text-right text-[14px] font-bold tabular-nums text-navy focus:border-orange focus:outline-none"
              />
              <span className="text-[12px] font-semibold text-muted-foreground">ft</span>
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// ─── Ordinance ────────────────────────────────────────────────────────────────

const PROTECTED_SPECIES: TreeSpecies[] = ["native_oak", "coast_redwood", "other_native"]

function OrdinanceSection({ store }: { store: BranchStore }) {
  const { permit } = store.cfg

  return (
    <Section
      title="City tree ordinance"
      blurb="Permit thresholds and fees for the cities you serve."
      icon={ShieldAlert}
    >
      {/* The honesty gate. These numbers are law, and we are guessing at them
          until the manager replaces them with their own city's code. */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border-2 border-gold/50 bg-gold/10 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" />
        <div className="text-[13px] leading-relaxed text-navy">
          <strong>These are the conservative California defaults, not your city&apos;s code.</strong> Tree
          protection is set city by city — San Jose, Santa Clara, Los Gatos, and Saratoga do not agree with
          each other — and your customers are quoted these numbers. Replace them with the ordinance you
          actually work under.
        </div>
      </div>

      <Text
        label="Whose rules these are (shown to customers)"
        value={permit.cityLabel}
        onChange={(v) => store.setPermit({ cityLabel: v })}
      />

      <p className="mb-3 mt-6 text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        Protected at this trunk diameter
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROTECTED_SPECIES.map((id) => {
          const meta = CA_SPECIES.find((s) => s.id === id)!
          return (
            <div key={id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <span className="flex-1">
                <span className="block text-[13.5px] font-bold text-navy">{meta.label}</span>
                <span className="block text-[11.5px] text-muted-foreground">{meta.detail}</span>
              </span>
              <input
                type="number"
                min={0}
                max={60}
                aria-label={`${meta.label} protected at trunk diameter, inches`}
                value={permit.speciesDbh[id] ?? 0}
                onChange={(e) => store.setSpeciesDbh(id, Number(e.target.value) || 0)}
                className="w-20 rounded-lg border border-line px-3 py-2 text-right text-[14px] font-bold tabular-nums text-navy focus:border-orange focus:outline-none"
              />
              <span className="text-[12px] font-semibold text-muted-foreground">in</span>
            </div>
          )
        })}
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
          <span className="flex-1">
            <span className="block text-[13.5px] font-bold text-navy">Heritage size — any species</span>
            <span className="block text-[11.5px] text-muted-foreground">Big enough to be protected on size alone</span>
          </span>
          <input
            type="number"
            min={0}
            max={80}
            aria-label="Heritage tree protected at trunk diameter, inches"
            value={permit.heritageDbh}
            onChange={(e) => store.setPermit({ heritageDbh: Number(e.target.value) || 0 })}
            className="w-20 rounded-lg border border-line px-3 py-2 text-right text-[14px] font-bold tabular-nums text-navy focus:border-orange focus:outline-none"
          />
          <span className="text-[12px] font-semibold text-muted-foreground">in</span>
        </div>
      </div>

      <p className="mb-3 mt-6 text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        What the permit process costs
      </p>
      <div className="space-y-3">
        {([
          { key: "filing", label: "City removal permit (filing fee)", hint: "Once per application" },
          { key: "report", label: "Arborist report the permit requires", hint: "Once per application" },
          { key: "mitigationPerTree", label: "Replacement planting or in-lieu fee", hint: "Per tree removed" },
          { key: "hazardDocumentation", label: "Hazard documentation", hint: "Dead or hazardous — expedited or exempt" },
          { key: "pruningPermit", label: "Pruning permit, where required", hint: "Heavy pruning of a protected tree" },
        ] as const).map((row) => (
          <div key={row.key} className="rounded-xl border border-line bg-white p-4">
            <div className="mb-2.5">
              <span className="block text-[13.5px] font-bold text-navy">{row.label}</span>
              <span className="block text-[11.5px] text-muted-foreground">{row.hint}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Money
                label="Low"
                value={permit[row.key].low}
                step={25}
                onChange={(n) => store.setPermit({ [row.key]: { ...permit[row.key], low: n } } as never)}
              />
              <Money
                label="High"
                value={permit[row.key].high}
                step={25}
                onChange={(n) => store.setPermit({ [row.key]: { ...permit[row.key], high: n } } as never)}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mb-3 mt-6 text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        How long the city takes
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <WeekRange
          label="Standard review"
          value={permit.reviewWeeks}
          onChange={(v) => store.setPermit({ reviewWeeks: v })}
        />
        <WeekRange
          label="When removal may be refused"
          value={permit.contestedReviewWeeks}
          onChange={(v) => store.setPermit({ contestedReviewWeeks: v })}
        />
      </div>

      <Note>{CA_ORDINANCE_DISCLAIMER}</Note>
    </Section>
  )
}

function WeekRange({
  label, value, onChange,
}: { label: string; value: [number, number]; onChange: (v: [number, number]) => void }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <span className="mb-2.5 block text-[13.5px] font-bold text-navy">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={52}
          value={value[0]}
          onChange={(e) => onChange([Number(e.target.value) || 0, value[1]])}
          className="w-20 rounded-lg border border-line px-3 py-2 text-right text-[14px] font-bold tabular-nums text-navy focus:border-orange focus:outline-none"
        />
        <span className="text-[13px] text-muted-foreground">to</span>
        <input
          type="number"
          min={0}
          max={52}
          value={value[1]}
          onChange={(e) => onChange([value[0], Number(e.target.value) || 0])}
          className="w-20 rounded-lg border border-line px-3 py-2 text-right text-[14px] font-bold tabular-nums text-navy focus:border-orange focus:outline-none"
        />
        <span className="text-[13px] font-semibold text-muted-foreground">weeks</span>
      </div>
    </div>
  )
}

// ─── Add-ons ──────────────────────────────────────────────────────────────────

function AddonsSection({ store }: { store: BranchStore }) {
  const programs = PROGRAMS.filter((p) => store.cfg.serviceEnabled[p.vertical])

  return (
    <Section
      title="Add-ons"
      blurb="Your price for each, and which plans may offer it."
      icon={SlidersHorizontal}
    >
      <div className="space-y-3">
        {ADDONS.map((a) => {
          const band = store.cfg.addonRates[a.id]
          const attaches = programs.filter((p) => a.attachesTo.includes(p.id))
          if (attaches.length === 0) return null
          const unit =
            a.pricing.model === "per_plant" ? "per plant / treatment"
            : a.pricing.model === "per_sqft" ? "per sq ft"
            : "flat"
          return (
            <div key={a.id} className="rounded-xl border border-line bg-white p-4">
              <div className="mb-3">
                <span className="block text-[14px] font-bold text-navy">{a.name}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{a.blurb}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Money
                  label={`Low (${unit})`}
                  value={band.low}
                  step={a.pricing.model === "per_sqft" ? 0.01 : 5}
                  onChange={(n) => store.setAddonRate(a.id, { ...band, low: n })}
                />
                <Money
                  label={`High (${unit})`}
                  value={band.high}
                  step={a.pricing.model === "per_sqft" ? 0.01 : 5}
                  onChange={(n) => store.setAddonRate(a.id, { ...band, high: n })}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
                {attaches.map((p) => {
                  const on = !!store.cfg.addonEnabled[p.id]?.[a.id]
                  return (
                    <button
                      key={p.id}
                      onClick={() => store.toggleAddon(p.id, a.id)}
                      aria-pressed={on}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                        on ? "bg-orange text-white" : "bg-sky text-navy/60 hover:text-navy"
                      }`}
                    >
                      {on && <Check className="mr-1 inline h-3 w-3" />}
                      {getVerticalMeta(p.vertical).label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <Note>
        Add-ons attach to a plan — they are never sold on their own. Withdraw one here and it disappears
        from that plan&apos;s checkout entirely.
      </Note>
    </Section>
  )
}

// ─── Reset ────────────────────────────────────────────────────────────────────

function ResetControl({ store }: { store: BranchStore }) {
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (!confirming) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirming(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [confirming])

  const doReset = () => {
    store.reset()
    setConfirming(false)
    setToast(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(false), 3000)
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        disabled={!store.dirty}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold text-navy/60 transition-colors hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RotateCcw className="h-4 w-4" />
        Reset to SavATree defaults
      </button>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirming(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 p-4 backdrop-blur-sm"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[18px] bg-white p-7 shadow-brand">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky text-navy">
              <RotateCcw className="h-6 w-6" />
            </span>
            <h3 className="disp text-[22px] text-navy">Reset to SavATree defaults?</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-body">
              This restores the corporate plan rates, the tree labor index, your city&apos;s ordinance
              settings, add-on prices, and every service&apos;s visibility and order. Your branch&apos;s
              changes are lost.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                autoFocus
                onClick={() => setConfirming(false)}
                className="btn-pill flex-1 border-2 border-line bg-white text-navy hover:border-navy/30"
              >
                Cancel
              </button>
              <button onClick={doReset} className="btn-orange flex-1">
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-navy px-5 py-3 text-[13px] font-bold text-white shadow-brand transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <Check className="mr-1.5 inline h-4 w-4" />
        Reset to SavATree defaults
      </div>
    </>
  )
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

function Text({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[14px] text-navy focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
      />
    </label>
  )
}

function Money({
  label, value, step, suffix, aria, onChange,
}: {
  label: string
  value: number
  step: number
  suffix?: string
  /** When the visible label repeats down a column ("Low", "Low", "Low"), give the
   *  field a name that says WHICH row it belongs to. */
  aria?: string
  value2?: never
  onChange: (n: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-semibold text-muted-foreground">{label}</span>
      <span className="flex items-center rounded-lg border border-line bg-white px-3 focus-within:border-orange">
        <span className="text-[13px] font-semibold text-muted-foreground">$</span>
        <input
          type="number"
          min={0}
          step={step}
          aria-label={aria ?? label}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full bg-transparent py-2.5 text-right text-[14px] font-bold tabular-nums text-navy focus:outline-none"
        />
        {suffix && <span className="ml-1 whitespace-nowrap text-[11.5px] text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-orange" : "bg-line"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
