"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowRight, Check, Shield, Phone, Leaf, Minus, Plus, CalendarDays, Info,
  ClipboardCheck, BadgeCheck, Sparkles, RefreshCw, AlertTriangle,
} from "lucide-react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import {
  VERTICALS, getVerticalMeta, programForVertical, projectsForVertical,
  BASIS_CONFIG, PLANT_SIZES, treatmentsBySeason, money, bandText, summarizeInputs,
  type VerticalMeta,
} from "@/lib/savatree-services"
import {
  quoteProgram, quoteProject, getAddon, PRICING_DISCLAIMER,
  type Program, type Project, type Vertical,
  type TierLevel, type PlantSize, type PropertyInputs, type ProgramTier,
} from "@/lib/savatree-catalog"
import {
  estimateTreeWork, triageEmergency,
  type TreeInputs, type TreeJob, type Confidence,
} from "@/lib/tree-care"
import { CA_SPECIES, type TreeSpecies } from "@/lib/california-trees"

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const [vertical, setVertical] = useState<Vertical | null>(null)
  const [tier, setTier] = useState<TierLevel>("better")
  const [inputs, setInputs] = useState<PropertyInputs>({})
  const [projectId, setProjectId] = useState<string | null>(null)

  const meta = vertical ? getVerticalMeta(vertical) : null
  const program = vertical ? programForVertical(vertical) : undefined
  const projects = vertical ? projectsForVertical(vertical) : []
  const project = projectId ? projects.find((p) => p.id === projectId) : undefined

  const selectVertical = (v: Vertical) => {
    const p = programForVertical(v)
    setVertical(v)
    setProjectId(null)
    setTier("better")
    // Seed the basis input so the tier cards always show a real price, never $0.
    setInputs(p ? { [BASIS_CONFIG[p.priceBasis].key]: BASIS_CONFIG[p.priceBasis].default, plantSize: "medium" } : {})
    scrollTo("step-2")
  }

  const selectProject = (p: Project) => {
    setProjectId(p.id)
    scrollTo("step-3")
  }

  const setInput = <K extends keyof PropertyInputs>(key: K, value: PropertyInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }))

  // Plan price per tier. Add-ons are chosen at checkout, so nothing here is a cart —
  // these numbers compare plans and nothing else.
  const tierQuotes = useMemo(() => {
    if (!program) return null
    return Object.fromEntries(
      program.tiers.map((t) => [t.level, quoteProgram(program.id, t.level, inputs)]),
    ) as Record<TierLevel, ReturnType<typeof quoteProgram>>
  }, [program, inputs])

  const quote = useMemo(() => (program ? quoteProgram(program.id, tier, inputs) : null), [program, tier, inputs])

  const projectQuote = useMemo(() => {
    if (!project || project.path !== "instant_quote") return null
    return quoteProject(project.id, inputs)
  }, [project, inputs])

  const enroll = () => {
    if (!program || !quote) return
    router.push(
      `/checkout?${new URLSearchParams({
        kind: "program",
        id: program.id,
        name: program.name,
        vertical: program.vertical,
        tier: quote.tier,
        tierName: quote.tierName,
        visits: String(quote.visitsPerYear),
        low: String(quote.annual.low),
        high: String(quote.annual.high),
        monthlyLow: String(quote.monthly.low),
        monthlyHigh: String(quote.monthly.high),
        autoRenews: String(quote.autoRenews),
        summary: summarizeInputs(program, inputs),
      }).toString()}`,
    )
  }

  const bookProject = () => {
    if (!project || !projectQuote) return
    router.push(
      `/checkout?${new URLSearchParams({
        kind: "project",
        id: project.id,
        name: project.name,
        vertical: project.vertical,
        low: String(projectQuote.estimate.low),
        high: String(projectQuote.estimate.high),
        summary: `${inputs.stumpDiameterInches ?? 12}" diameter · ${inputs.stumpCount ?? 1} stump(s)`,
        lines: projectQuote.lines.join(" | "),
      }).toString()}`,
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Hero />

      {/* ── Step 1 — Vertical ──────────────────────────────────────────── */}
      <section id="step-1" className="border-t border-border bg-white scroll-mt-4">
        <div className="container mx-auto px-4 py-12 md:py-14">
          <div className="max-w-5xl mx-auto">
            <StepHeader step={1} title="What can we help you with?" subtitle="Pick a category and we'll build you a care plan — or scope the job." />

            {/* Split the grid the way the business does: recurring plans, then one-off
                work. It also squares off a 7-card grid that was leaving a ragged hole. */}
            <div className="space-y-9">
              {([
                { kind: "program", label: "Year-round care plans", cols: "lg:grid-cols-4" },
                { kind: "project", label: "Projects & one-off work", cols: "sm:grid-cols-3" },
              ] as const).map((group) => (
                <div key={group.kind}>
                  <div className="flex items-center gap-3 mb-4">
                    <p className="eyebrow shrink-0">{group.label}</p>
                    <span className="h-px flex-1 bg-line-soft" />
                  </div>
                  <div className={`grid grid-cols-2 ${group.cols} gap-3 md:gap-3.5`}>
                    {VERTICALS.filter((v) => v.kind === group.kind).map((v) => (
                      <VerticalCard key={v.id} meta={v} selected={vertical === v.id} onClick={() => selectVertical(v.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Enrollable program: property → plan → add-ons → checkout ───── */}
      {program && meta && program.path === "instant_quote" && (
        <>
          <section id="step-2" className="border-t border-border bg-background scroll-mt-4">
            <div className="container mx-auto px-4 py-12 md:py-14">
              <div className="max-w-3xl mx-auto">
                <StepHeader step={2} title="Tell us about your property" subtitle={program.blurb} />
                <PropertyInputsPanel program={program} inputs={inputs} setInput={setInput} />
              </div>
            </div>
          </section>

          <section id="step-3" className="border-t border-border bg-white scroll-mt-4">
            <div className="container mx-auto px-4 py-12 md:py-14">
              <div className="max-w-6xl mx-auto">
                <StepHeader
                  step={3}
                  title="Choose your plan"
                  subtitle="Every plan is a year-round agreement designed by an ISA Certified Arborist. Prices scale with your property."
                />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
                  {program.tiers.map((t) => (
                    <TierCard
                      key={t.level}
                      tier={t}
                      annual={tierQuotes?.[t.level].annual ?? { low: 0, high: 0 }}
                      monthly={tierQuotes?.[t.level].monthly ?? { low: 0, high: 0 }}
                      selected={tier === t.level}
                      onClick={() => setTier(t.level)}
                    />
                  ))}
                </div>

                {/* The tier card already itemizes what's in the plan — repeating it here
                    would just be the same list twice. Price, cadence, CTA. */}
                {quote && (
                  <div className="mt-8 max-w-3xl mx-auto rounded-[16px] border border-line bg-brand-band shadow-brand-sm">
                    <div className="p-7 md:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                      <div>
                        <p className="eyebrow mb-1.5">{quote.tierName} · {quote.visitsPerYear} visits/yr</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl md:text-[46px] font-extrabold text-navy leading-none tracking-[-0.02em]">
                            ${money(quote.annual.low)}
                            {quote.annual.high !== quote.annual.low && <span> – ${money(quote.annual.high)}</span>}
                          </span>
                          <span className="text-body text-[15px] font-semibold">/yr</span>
                        </div>
                        <p className="text-[13px] text-body mt-1.5">
                          ≈ ${money(quote.monthly.low)}–${money(quote.monthly.high)}/mo
                          {quote.autoRenews && (
                            <span className="inline-flex items-center gap-1 ml-2 text-orange-deep font-semibold">
                              <RefreshCw className="w-3 h-3" /> Renews annually
                            </span>
                          )}
                        </p>
                      </div>
                      <button onClick={enroll} className="btn-orange shrink-0">
                        Continue to enrollment
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
                <p className="mt-4 max-w-3xl mx-auto text-[12px] text-muted-foreground leading-relaxed">{PRICING_DISCLAIMER}</p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Consultation-gated programs (deer) never enter the plan builder — pressure,
          bed count, and browse damage can only be judged on site. Straight to the form. */}
      {program && meta && program.path === "consultation" && (
        <section id="step-2" className="border-t border-border bg-white scroll-mt-4">
          <div className="container mx-auto px-4 py-12 md:py-14">
            <ConsultationPanel
              title={program.name}
              blurb={program.blurb}
              softRange={`${bandText(programFloorBand(program))}/yr`}
              tiers={program.tiers}
            />
          </div>
        </section>
      )}

      {/* ── Project path: pick the job → quote or consult ───────────────── */}
      {meta?.kind === "project" && (
        <section id="step-2" className="border-t border-border bg-background scroll-mt-4">
          <div className="container mx-auto px-4 py-12 md:py-14">
            <div className="max-w-4xl mx-auto">
              <StepHeader
                step={2}
                title={`${meta.label} — what do you need?`}
                subtitle={
                  meta.id === "tree_work"
                    ? "Tell us about the tree and we'll give you an honest range on the spot."
                    : "One-off jobs, scoped by a certified arborist."
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.map((p) => (
                  <ProjectCard key={p.id} project={p} selected={projectId === p.id} onClick={() => selectProject(p)} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {project && (
        <section id="step-3" className="border-t border-border bg-white scroll-mt-4">
          <div className="container mx-auto px-4 py-12 md:py-14">
            {project.urgent ? (
              <UrgentPanel project={project} />
            ) : TREE_JOBS[project.id] ? (
              <TreeEstimator project={project} job={TREE_JOBS[project.id]} />
            ) : project.path === "instant_quote" ? (
              <div className="max-w-3xl mx-auto">
                <StepHeader step={3} title={project.name} subtitle={project.blurb} />
                <div className="space-y-8">
                  <div>
                    <FieldLabel label="Stump diameter" />
                    <NumberStepper
                      value={inputs.stumpDiameterInches ?? 14}
                      unit="inches"
                      min={4}
                      max={60}
                      presets={[8, 14, 20, 30]}
                      onChange={(n) => setInput("stumpDiameterInches", n)}
                    />
                  </div>
                  <div>
                    <FieldLabel label="Number of stumps" />
                    <NumberStepper
                      value={inputs.stumpCount ?? 1}
                      unit="stumps"
                      min={1}
                      max={20}
                      presets={[1, 2, 3, 5]}
                      onChange={(n) => setInput("stumpCount", n)}
                    />
                  </div>
                </div>

                {projectQuote && (
                  <div className="mt-10 rounded-[16px] border border-line bg-brand-band shadow-brand-sm overflow-hidden">
                    <div className="p-7 md:px-8">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                        <div>
                          <p className="eyebrow mb-1.5">One-time job</p>
                          <span className="text-4xl md:text-[46px] font-extrabold text-navy leading-none tracking-[-0.02em]">
                            {bandText(projectQuote.estimate)}
                          </span>
                        </div>
                        <button onClick={bookProject} className="btn-orange shrink-0">
                          Continue to booking
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                      <ul className="mt-5 border-t border-[#dbe7dd] pt-4 space-y-1.5">
                        {projectQuote.lines.map((li, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13.5px] text-body">
                            <Check className="w-4 h-4 text-orange mt-0.5 shrink-0" />
                            <span>{li}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <p className="mt-4 text-[12px] text-muted-foreground leading-relaxed">{PRICING_DISCLAIMER}</p>
              </div>
            ) : (
              <ConsultationPanel
                title={project.name}
                blurb={project.blurb}
                softRange={bandText(project.pricing.band)}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Trust Strip ────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-background">
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <TrustItem icon={BadgeCheck} title="ISA Certified Arborists" text="Science-based care by credentialed experts" />
            <TrustItem icon={Leaf} title="Branded, Eco-Minded Products" text="ArborHealth®, ArborKelp® & organic options" />
            <TrustItem icon={Phone} title="Free Consultation" text="Call (800) 543-3245 anytime" />
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * Soft range for a consultation-gated program: the entry tier on a typical
 * property through the top tier. A talking point for the form, not a quote.
 */
function programFloorBand(program: Program) {
  const tiers = program.tiers
  return {
    low: quoteProgram(program.id, tiers[0].level, {}).annual.low,
    high: quoteProgram(program.id, tiers[tiers.length - 1].level, {}).annual.high,
  }
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src="/images/hero.webp"
        alt="Sunlit mature trees over a manicured lawn"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center -z-10"
      />
      {/* Forest scrim — keeps the type legible over the dappled canopy light. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-deep/80 via-navy-deep/60 to-navy-deep/85" />

      <div className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <span className="brand-badge mb-5">ISA Certified Arborists</span>
          <h1 className="disp text-white mx-auto max-w-[18ch] text-[clamp(38px,5.6vw,64px)] drop-shadow-sm">
            Care for your trees, lawn &amp; landscape
          </h1>
          <p className="mt-[18px] text-lg text-white/85 max-w-[48ch] mx-auto">
            Build a year-round care plan for your property in under a minute — designed around your
            trees, your soil, and your yard.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button type="button" onClick={() => scrollTo("step-1")} className="btn-orange">
              Build my plan
              <ArrowRight className="w-5 h-5" />
            </button>
            {/* Escape hatch for customers who don't want to configure anything — they
                just want an arborist at the door. Skips straight to scheduling. */}
            <Link href="/checkout?kind=visit&name=Free+Arborist+Visit" className="btn-pill border-2 border-white/60 text-white hover:bg-white/10">
              <CalendarDays className="w-5 h-5" />
              Skip to booking
            </Link>
          </div>
          <p className="mt-3.5 text-[13px] text-white/65">
            Not sure what you need? Book a free arborist visit and skip the estimate.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function VerticalCard({ meta, selected, onClick }: { meta: VerticalMeta; selected: boolean; onClick: () => void }) {
  const Icon = meta.icon
  // Deer is a program but still arborist-gated — don't promise an instant plan.
  // Tree work is the mirror image: projects, but they now quote a range on the spot.
  const instant =
    meta.id === "tree_work" ||
    (meta.kind === "program" && programForVertical(meta.id)?.path === "instant_quote")
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative flex flex-col items-start text-left rounded-[14px] p-5 transition-all duration-150 hover:-translate-y-0.5 border-2 ${
        selected
          ? "border-orange bg-brand-select shadow-[0_10px_26px_rgba(23,171,45,0.22)]"
          : "border-line bg-white hover:border-[#c7d6ca] hover:shadow-brand-sm"
      }`}
    >
      <span className={`inline-flex items-center justify-center w-11 h-11 rounded-full mb-3 ${selected ? "bg-orange text-white" : "bg-sky text-navy"}`}>
        <Icon className="w-[22px] h-[22px]" />
      </span>
      <span className="font-bold text-navy text-[15px] leading-tight">{meta.label}</span>
      <span className="text-[12.5px] text-muted-foreground mt-1 leading-snug">{meta.blurb}</span>
      <span className="mt-auto pt-3 inline-flex items-center gap-1 text-[11px] font-bold text-orange-deep">
        {meta.id === "tree_work"
          ? <><Sparkles className="w-3 h-3" /> Instant range</>
          : instant
          ? <><Sparkles className="w-3 h-3" /> Instant plan</>
          : <><ClipboardCheck className="w-3 h-3" /> Scoped on site</>}
      </span>
    </button>
  )
}

function TierCard({
  tier, annual, monthly, selected, onClick,
}: {
  tier: ProgramTier
  annual: { low: number; high: number }
  monthly: { low: number; high: number }
  selected: boolean
  onClick: () => void
}) {
  const seasons = treatmentsBySeason(tier.treatments)
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex flex-col text-left rounded-[18px] p-6 pt-7 transition-all duration-150 border-2 ${
        selected
          ? "border-orange bg-brand-select shadow-[0_12px_30px_rgba(23,171,45,0.18)]"
          : "border-line bg-white hover:border-[#c7d6ca] hover:shadow-brand-sm"
      }`}
    >
      {tier.popular && (
        <span className="absolute -top-3 left-6 brand-badge">Most Popular</span>
      )}
      <h3 className="font-bold text-navy text-[19px] leading-tight">{tier.name}</h3>
      <p className="text-[13px] text-muted-foreground mt-1 leading-snug min-h-[36px]">{tier.tagline}</p>

      <div className="mt-4 pb-4 border-b border-line">
        <div className="flex items-baseline gap-1">
          <span className="text-[30px] font-extrabold text-navy leading-none tracking-[-0.02em]">
            ${money(annual.low)}–${money(annual.high)}
          </span>
          <span className="text-body text-[13px] font-semibold">/yr</span>
        </div>
        <p className="text-[12.5px] text-muted-foreground mt-1.5">
          ≈ ${money(monthly.low)}–${money(monthly.high)}/mo · {tier.visitsPerYear} visits a year
        </p>
      </div>

      {/* Treatments are the proof, not the product — they list, they never buy. */}
      <div className="mt-5 space-y-3.5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-navy">Your visits</p>
        {seasons.map((group) => (
          <div key={group.season}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">{group.label}</p>
            <ul className="space-y-1">
              {group.items.map((t) => (
                <li key={t.name} className="flex items-start gap-2 text-[13px] text-body leading-snug">
                  <Leaf className="w-3.5 h-3.5 text-orange mt-[3px] shrink-0" />
                  <span>{t.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {(tier.includedAddons ?? []).length > 0 && (
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">Included free</p>
          <ul className="space-y-1">
            {(tier.includedAddons ?? []).map((id) => {
              const addon = getAddon(id)
              if (!addon) return null
              return (
                <li key={id} className="flex items-start gap-2 text-[13px] font-semibold text-orange-deep leading-snug">
                  <Check className="w-3.5 h-3.5 mt-[3px] shrink-0" />
                  <span>{addon.name}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* mt-auto pins the CTA to the card floor so all three line up, without
          stretching the visit list away from the price it justifies. */}
      <span
        className={`mt-auto pt-6 inline-flex items-center justify-center w-full text-sm font-bold ${
          selected ? "text-orange-deep" : "text-navy"
        }`}
      >
        <span className={`inline-flex items-center justify-center w-full rounded-lg py-3 transition-colors ${
          selected ? "bg-orange text-white" : "bg-sky text-navy"
        }`}>
          {selected ? <><Check className="w-4 h-4 mr-1.5" /> Selected</> : "Choose this plan"}
        </span>
      </span>
    </button>
  )
}

function ProjectCard({ project, selected, onClick }: { project: Project; selected: boolean; onClick: () => void }) {
  // Tree jobs now quote a range on the spot, even though the arborist still
  // confirms the number — so they're no longer a bare "consult".
  const quotesARange = Boolean(TREE_JOBS[project.id])
  const instant = project.path === "instant_quote" || quotesARange
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex flex-col text-left rounded-[14px] p-5 transition-all duration-150 border-2 ${
        selected ? "border-orange bg-brand-select" : "border-line bg-white hover:border-[#c7d6ca] hover:shadow-brand-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-navy text-[16px] leading-tight">{project.name}</h3>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em] ${
            project.urgent ? "bg-gold/25 text-navy" : instant ? "bg-orange/12 text-orange-deep" : "bg-sky text-navy"
          }`}
        >
          {project.urgent
            ? <><AlertTriangle className="w-3 h-3" /> Urgent</>
            : quotesARange
            ? <><Sparkles className="w-3 h-3" /> Instant range</>
            : instant
            ? <><Sparkles className="w-3 h-3" /> Instant</>
            : <><ClipboardCheck className="w-3 h-3" /> Consult</>}
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground mt-1.5 leading-snug">{project.blurb}</p>
    </button>
  )
}

// ─── Property inputs ──────────────────────────────────────────────────────────

function PropertyInputsPanel({
  program, inputs, setInput,
}: {
  program: Program
  inputs: PropertyInputs
  setInput: <K extends keyof PropertyInputs>(key: K, value: PropertyInputs[K]) => void
}) {
  const cfg = BASIS_CONFIG[program.priceBasis]
  const value = (inputs[cfg.key] as number | undefined) ?? cfg.default

  // One panel, one centered column — the controls sit under their own headings
  // instead of drifting to the left edge of a centered section.
  return (
    <div className="rounded-[18px] border border-line bg-white shadow-brand-sm divide-y divide-line-soft">
      <div className="p-7 md:p-9">
        <FieldLabel label={cfg.label} help={cfg.help} />
        {cfg.kind === "sqft" ? (
          <MeasureSlider
            value={value}
            min={cfg.min}
            max={cfg.max}
            step={cfg.step}
            unit="sq ft"
            ticks={[10000, 20000, 30000]}
            onChange={(n) => setInput(cfg.key, n)}
          />
        ) : (
          <NumberStepper
            value={value}
            unit={cfg.unit}
            min={cfg.min}
            max={cfg.max}
            presets={cfg.presets}
            onChange={(n) => setInput(cfg.key, n)}
          />
        )}
      </div>

      {/* Tree size is the dominant cost driver in PHC — a 60-ft oak is not a shrub. */}
      {program.priceBasis === "plant_count" && (
        <div className="p-7 md:p-9">
          <FieldLabel label="How big are they, on average?" help="Bigger canopies take more material and more labor." />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-2xl mx-auto">
            {PLANT_SIZES.map((size) => {
              const selected = (inputs.plantSize ?? "medium") === size.value
              return (
                <button
                  key={size.value}
                  onClick={() => setInput("plantSize", size.value as PlantSize)}
                  className={`rounded-xl px-4 py-3 text-center border-2 transition-all ${
                    selected ? "border-orange bg-brand-select" : "border-line bg-white hover:border-[#c7d6ca]"
                  }`}
                >
                  <p className={`font-bold text-[15px] ${selected ? "text-orange-deep" : "text-navy"}`}>{size.label}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{size.detail}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Organic is a style choice, not a better tier. Never present it as an upgrade. */}
      {program.organicModifier && (
        <div className="p-7 md:p-9">
          <button
            onClick={() => setInput("organic", !inputs.organic)}
            aria-pressed={!!inputs.organic}
            className={`flex w-full max-w-2xl mx-auto items-start gap-3 rounded-xl p-4 border-2 text-left transition-all ${
              inputs.organic ? "border-orange bg-brand-select" : "border-line bg-white hover:border-[#c7d6ca]"
            }`}
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 shrink-0 mt-0.5 ${inputs.organic ? "border-orange bg-orange text-white" : "border-line bg-white"}`}>
              {inputs.organic ? <Check className="h-4 w-4" /> : null}
            </span>
            <span>
              <span className="block font-semibold text-navy text-[15px]">Make it an organic program</span>
              <span className="block text-[13px] text-muted-foreground mt-0.5">
                Natural-input treatments at any plan level (+{Math.round((program.organicModifier - 1) * 100)}%). A style choice — not a better plan.
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <div className="mb-6 text-center">
      <p className="font-bold text-navy text-[17px]">{label}</p>
      {help && <p className="text-[13px] text-muted-foreground mt-1">{help}</p>}
    </div>
  )
}

function NumberStepper({
  value, unit, min, max, presets, onChange,
}: { value: number; unit?: string; min: number; max: number; presets: number[]; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-center gap-5">
        <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease"
          className="flex items-center justify-center w-12 h-12 shrink-0 rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Minus className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center w-40">
          <span className="text-[44px] leading-none font-extrabold text-navy tabular-nums">{value}</span>
          {unit && <span className="text-sm text-muted-foreground text-center mt-1.5">{unit}</span>}
        </div>
        <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Increase"
          className="flex items-center justify-center w-12 h-12 shrink-0 rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      {presets.length > 0 && (
        <div className="flex justify-center gap-2 mt-6">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => onChange(p)}
              className={`w-12 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                value === p ? "bg-orange/10 border-orange text-orange-deep" : "bg-white border-border text-navy hover:border-orange/40"
              }`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Sq ft of turf, or feet of tree — same control, different unit. */
function MeasureSlider({
  value, min, max, step, unit, ticks: tickValues, onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  unit: string
  ticks: number[]
  onChange: (n: number) => void
}) {
  const v = Math.min(Math.max(value || min, min), max)
  const ticks = tickValues.filter((t) => t > min && t < max)
  const tickPct = (n: number) => ((n - min) / (max - min)) * 100

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-baseline justify-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={value ? value.toLocaleString() : ""}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value.replace(/[^\d]/g, ""), 10)
            onChange(Number.isNaN(n) ? 0 : n)
          }}
          onBlur={() => { if (!value || value < min) onChange(min) }}
          aria-label={`Size in ${unit}`}
          className="w-44 bg-transparent border-b-2 border-line text-center text-[34px] font-extrabold text-navy tabular-nums focus:border-orange focus:outline-none transition-colors"
        />
        <span className="text-sm font-semibold text-muted-foreground">{unit}</span>
      </div>
      <SliderPrimitive.Root
        className="relative mt-8 flex w-full touch-none select-none items-center"
        min={min} max={max} step={step} value={[v]}
        onValueChange={([n]) => onChange(n)} aria-label={`Size in ${unit}`}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow rounded-full bg-line">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-orange" />
          {ticks.map((t) => (
            <span key={t} className="pointer-events-none absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-[#c7d6ca]" style={{ left: `${tickPct(t)}%` }} />
          ))}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="relative z-10 block h-6 w-6 cursor-grab rounded-full border-2 border-orange bg-white shadow-brand-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 active:cursor-grabbing" />
      </SliderPrimitive.Root>
      <div className="relative mt-3 h-4 text-xs font-medium text-muted-foreground">
        <span className="absolute left-0">{min.toLocaleString()}</span>
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${tickPct(t)}%` }}>{t.toLocaleString()}</span>
        ))}
        <span className="absolute right-0">{max.toLocaleString()}+</span>
      </div>
    </div>
  )
}

// ─── Tree work estimator ──────────────────────────────────────────────────────

/** Catalog projects that the tree-care model can actually price. */
const TREE_JOBS: Record<string, TreeJob> = {
  tree_removal: "removal",
  tree_pruning: "pruning",
  cabling_bracing: "cabling",
}

const ACCESS_CHOICES = [
  { value: "open", label: "Open", detail: "A truck can reach it" },
  { value: "moderate", label: "Moderate", detail: "Some obstacles" },
  { value: "tight", label: "Tight", detail: "Backyard, gated, no truck" },
] as const

const PROXIMITY_CHOICES = [
  { value: "open_yard", label: "Open yard", detail: "Nothing beneath it" },
  { value: "near_structure", label: "Near a structure", detail: "House, fence, shed" },
  { value: "over_structure_or_lines", label: "Over a structure or lines", detail: "Roof or power lines" },
] as const

const CONDITION_CHOICES = [
  { value: "healthy", label: "Healthy", detail: "Full, normal canopy" },
  { value: "declining", label: "Declining", detail: "Thinning or dieback" },
  { value: "dead_or_decayed", label: "Dead or decayed", detail: "Dead limbs, cavities" },
] as const

const LEAN_CHOICES = [
  { value: "none", label: "Straight", detail: "No noticeable lean" },
  { value: "moderate", label: "Slight lean", detail: "Leans a little" },
  { value: "severe", label: "Severe lean", detail: "Leaning hard" },
] as const

const CONFIDENCE_COPY: Record<Confidence, { label: string; blurb: string }> = {
  high: { label: "Tight estimate", blurb: "Straightforward job — this range should hold." },
  medium: { label: "Estimated range", blurb: "A few things an arborist has to see before we can narrow it." },
  low: { label: "Wide range", blurb: "Real unknowns here. We'd rather be honest than precise." },
}

function TreeEstimator({ project, job }: { project: Project; job: TreeJob }) {
  const router = useRouter()
  const [t, setT] = useState<TreeInputs>({
    job,
    heightFt: 40,
    count: 1,
    access: "moderate",
    proximity: "near_structure",
    condition: "healthy",
    lean: "none",
    // "Not sure" is the truthful starting state, and the model treats it as the
    // worst plausible case — possibly a protected oak. The estimate starts wide
    // and visibly narrows the moment they tell us what the tree is.
    species: "unknown",
  })

  // Keep the job in sync when the customer switches between pruning/removal/cabling.
  const inputs: TreeInputs = { ...t, job }
  const set = <K extends keyof TreeInputs>(k: K, v: TreeInputs[K]) => setT((p) => ({ ...p, [k]: v }))

  const est = useMemo(() => estimateTreeWork(inputs), [inputs])
  const conf = CONFIDENCE_COPY[est.confidence]

  // The model decides the route; the page only obeys it. A hazardous or oversized
  // job books the arborist, never the work.
  const go = () => {
    const params = new URLSearchParams({
      kind: est.nextStep === "book_job" ? "project" : "assessment",
      id: project.id,
      name: project.name,
      vertical: project.vertical,
      low: String(est.estimate.low),
      high: String(est.estimate.high),
      summary: [
        `${est.count} tree${est.count === 1 ? "" : "s"}`,
        `${inputs.heightFt} ft`,
        inputs.diameterInches ? `${inputs.diameterInches}" trunk` : null,
        CONDITION_CHOICES.find((c) => c.value === inputs.condition)?.label.toLowerCase(),
      ].filter(Boolean).join(" · "),
      lines: est.lines.map((l) => `${l.label} — ${bandText(l.band)}`).join(" | "),
      notes: est.needsArboristBecause.join(" | "),
      confidence: est.confidence,
    })
    router.push(`/checkout?${params.toString()}`)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepHeader step={3} title={project.name} subtitle="Tell us about the tree. We'll give you an honest range — an arborist confirms it on site." />

      <div className="rounded-[18px] border border-line bg-white shadow-brand-sm divide-y divide-line-soft">
        {/* First question, because in California it's the one that decides
            whether this is a tree job or a permit application. */}
        <div className="p-7 md:p-9">
          <FieldLabel
            label="What kind of tree is it?"
            help="California cities protect native oaks, redwoods, and any tree large enough to count as a heritage tree."
          />
          <ChoiceGroup
            choices={CA_SPECIES.map((s) => ({ value: s.id, label: s.label, detail: s.detail }))}
            value={t.species ?? "unknown"}
            onChange={(v) => set("species", v as TreeSpecies)}
            columns={4}
          />
        </div>

        <div className="p-7 md:p-9">
          <FieldLabel label="How tall is the tree?" help="A rough guess is fine — compare it to your house." />
          <MeasureSlider value={inputs.heightFt} min={10} max={120} step={5} unit="ft" ticks={[30, 60, 90]} onChange={(n) => set("heightFt", n)} />
        </div>

        <div className="p-7 md:p-9">
          <FieldLabel label="How thick is the trunk?" help="Roughly, at chest height. Leave it alone if you're not sure — we'll assume typical for the height." />
          <NumberStepper
            value={inputs.diameterInches ?? Math.round(inputs.heightFt / 3)}
            unit="inches across"
            min={4}
            max={80}
            presets={[]}
            onChange={(n) => set("diameterInches", n)}
          />
        </div>

        <div className="p-7 md:p-9">
          <FieldLabel label="How many trees?" />
          <NumberStepper value={inputs.count ?? 1} unit={job === "removal" ? "trees" : "trees"} min={1} max={25} presets={[1, 2, 3, 5]} onChange={(n) => set("count", n)} />
        </div>

        <div className="p-7 md:p-9">
          <FieldLabel label="Can a truck get to it?" help="Access is the single biggest cost driver on a tree job." />
          <ChoiceGroup choices={ACCESS_CHOICES} value={inputs.access ?? "moderate"} onChange={(v) => set("access", v)} />
        </div>

        <div className="p-7 md:p-9">
          <FieldLabel label="What's underneath it?" />
          <ChoiceGroup choices={PROXIMITY_CHOICES} value={inputs.proximity ?? "near_structure"} onChange={(v) => set("proximity", v)} />
        </div>

        <div className="p-7 md:p-9">
          <FieldLabel label="What condition is it in?" />
          <ChoiceGroup choices={CONDITION_CHOICES} value={inputs.condition ?? "healthy"} onChange={(v) => set("condition", v)} />
        </div>

        <div className="p-7 md:p-9">
          <FieldLabel label="Is it leaning?" />
          <ChoiceGroup choices={LEAN_CHOICES} value={inputs.lean ?? "none"} onChange={(v) => set("lean", v)} />
        </div>

        {job === "removal" && (
          <div className="p-7 md:p-9">
            <button
              onClick={() => set("addStumpGrinding", !inputs.addStumpGrinding)}
              aria-pressed={!!inputs.addStumpGrinding}
              className={`flex w-full max-w-2xl mx-auto items-start gap-3 rounded-xl p-4 border-2 text-left transition-all ${
                inputs.addStumpGrinding ? "border-orange bg-brand-select" : "border-line bg-white hover:border-[#c7d6ca]"
              }`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 shrink-0 mt-0.5 ${inputs.addStumpGrinding ? "border-orange bg-orange text-white" : "border-line bg-white"}`}>
                {inputs.addStumpGrinding ? <Check className="h-4 w-4" /> : null}
              </span>
              <span>
                <span className="block font-semibold text-navy text-[15px]">Grind the stump too</span>
                <span className="block text-[13px] text-muted-foreground mt-0.5">Otherwise the stump stays. Priced by trunk diameter.</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* The estimate. A range, always — never a single number. */}
      <div className="mt-8 rounded-[16px] border border-line bg-brand-band shadow-brand-sm">
        <div className="p-7 md:px-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
            <div>
              <p className="eyebrow mb-1.5">{conf.label} · ±{est.spreadPct}%</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl md:text-[46px] font-extrabold text-navy leading-none tracking-[-0.02em]">
                  {bandText(est.estimate)}
                </span>
              </div>
              <p className="text-[13px] text-body mt-2 max-w-sm">{conf.blurb}</p>
            </div>
            <button onClick={go} className="btn-orange shrink-0">
              {est.nextStep === "book_job" ? "Continue to booking" : "Book your free assessment"}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {est.lines.length > 1 && (
            <ul className="mt-5 border-t border-[#dbe7dd] pt-4 space-y-1.5">
              {est.lines.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3 text-[13.5px] text-body">
                  <span className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-orange mt-0.5 shrink-0" />
                    <span>{l.label}</span>
                  </span>
                  <span className="font-semibold text-navy tabular-nums shrink-0">{bandText(l.band)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Why the band is this wide. Saying it out loud is the whole point — an honest
          wide range beats a fake-precise number. */}
      {est.factors.length > 0 && (
        <div className="mt-4 rounded-[16px] border border-line bg-white p-6">
          <p className="eyebrow mb-3">What&apos;s driving this range</p>
          <ul className="space-y-2">
            {est.factors.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13.5px] text-body">
                <Info className="w-4 h-4 text-navy/50 mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {est.needsArboristBecause.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line-soft">
              <p className="eyebrow mb-3">Only an arborist can judge this on site</p>
              <ul className="space-y-2">
                {est.needsArboristBecause.map((n) => (
                  <li key={n} className="flex items-start gap-2 text-[13.5px] font-semibold text-navy">
                    <ClipboardCheck className="w-4 h-4 text-orange mt-0.5 shrink-0" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* The visit is the cross-sell engine. This is where it fires. */}
      {est.upsell && (
        <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-gold/40 bg-gold/10 p-6">
          <Leaf className="w-5 h-5 text-gold-deep mt-0.5 shrink-0" />
          <p className="text-[13.5px] text-navy leading-relaxed">{est.upsell}</p>
        </div>
      )}

      <p className="mt-4 text-[12px] text-muted-foreground leading-relaxed">{est.disclaimer}</p>
    </div>
  )
}

/** Radio-style choice cards. Defaults to one column per choice — pass `columns`
 *  when the list is long enough that a single row would shred the cards. */
function ChoiceGroup<T extends string>({
  choices, value, onChange, columns,
}: {
  choices: readonly { value: T; label: string; detail: string }[]
  value: T
  onChange: (v: T) => void
  columns?: number
}) {
  const cols = columns ?? choices.length
  return (
    <div className="grid grid-cols-2 gap-2.5 max-w-2xl mx-auto sm:[grid-template-columns:var(--cols)]" style={{ ["--cols" as string]: `repeat(${cols}, minmax(0, 1fr))` }}>
      {choices.map((c) => {
        const selected = value === c.value
        return (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            aria-pressed={selected}
            className={`rounded-xl px-4 py-3 text-center border-2 transition-all ${
              selected ? "border-orange bg-brand-select" : "border-line bg-white hover:border-[#c7d6ca]"
            }`}
          >
            <p className={`font-bold text-[14.5px] ${selected ? "text-orange-deep" : "text-navy"}`}>{c.label}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{c.detail}</p>
          </button>
        )
      })}
    </div>
  )
}

// ─── Urgent (storm) panel ─────────────────────────────────────────────────────

function UrgentPanel({ project }: { project: Project }) {
  // Nobody with a tree on their roof wants a pricing wizard. No estimate, no
  // range, no number — the model routes this straight to dispatch.
  const triage = triageEmergency()
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold/20 mb-4">
        <AlertTriangle className="w-7 h-7 text-gold-deep" />
      </div>
      <h2 className="disp text-navy text-[clamp(26px,3.5vw,38px)]">{project.name}</h2>
      <p className="text-body mt-3 max-w-lg mx-auto">{project.blurb}</p>
      <div className="mt-8 rounded-[16px] border border-line bg-brand-band p-8">
        <p className="text-[15px] font-semibold text-navy">{triage.message}</p>
        <a href="tel:8005433245" className="btn-orange mt-5 w-full sm:w-auto">
          <Phone className="w-5 h-5" />
          (800) 543-3245
        </a>
        <p className="text-[13px] text-muted-foreground mt-4">
          Emergency crews are dispatched directly and the work is priced on site.
        </p>
      </div>
    </div>
  )
}

// ─── Consultation panel ───────────────────────────────────────────────────────

function ConsultationPanel({
  title, blurb, softRange, tiers,
}: { title: string; blurb: string; softRange?: string; tiers?: ProgramTier[] }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", message: "" })
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-navy/10 mb-4">
          <ClipboardCheck className="w-7 h-7 text-navy" />
        </div>
        <h2 className="disp text-navy text-[clamp(26px,3.5vw,38px)]">{title}</h2>
        <p className="text-body mt-3 max-w-lg mx-auto">{blurb}</p>
        {softRange && (
          <p className="mt-3 text-sm font-semibold text-orange-deep">
            Typical range {softRange} · firm price after an on-site arborist assessment
          </p>
        )}
      </div>

      {/* Show the plan levels, not prices — deer pressure is judged on site. */}
      {tiers && tiers.length > 0 && (
        <div className="mb-8 rounded-[16px] border border-line bg-brand-band-soft p-6">
          <p className="eyebrow mb-4">Protection levels your arborist will scope</p>
          <ul className="space-y-3.5">
            {tiers.map((t) => (
              <li key={t.level} className="flex items-start gap-3">
                <Shield className="w-[18px] h-[18px] text-orange mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-navy text-[15px]">
                    {t.name}
                    <span className="ml-2 text-[12px] font-semibold text-muted-foreground">{t.visitsPerYear} visits/yr</span>
                  </p>
                  <p className="text-[13px] text-muted-foreground leading-snug">{t.tagline}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: BadgeCheck, title: "Certified Arborist", desc: "A credentialed expert assesses on site" },
          { icon: Shield, title: "Tailored Program", desc: "Built around your property and plantings" },
          { icon: Phone, title: "Personal Contact", desc: "A specialist reaches out to you" },
        ].map((perk) => (
          <div key={perk.title} className="bg-card border border-border rounded-lg p-4 text-center">
            <perk.icon className="w-5 h-5 text-orange mx-auto mb-2" />
            <p className="font-semibold text-sm text-navy">{perk.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{perk.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-line rounded-[16px] shadow-brand overflow-hidden">
        <div className="bg-navy px-6 py-5">
          <h3 className="disp text-white text-xl">Request a Consultation</h3>
          <p className="text-sm text-white/70 mt-1">Tell us how to reach you and a certified arborist will follow up.</p>
        </div>
        <div className="p-6 md:p-8">
          {!submitted ? (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="c-first">First Name *</Label>
                  <Input id="c-first" required value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} placeholder="Jane" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="c-last">Last Name *</Label>
                  <Input id="c-last" required value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} placeholder="Doe" className="mt-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="c-email">Email Address *</Label>
                <Input id="c-email" type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="c-phone">Phone Number *</Label>
                <Input id="c-phone" type="tel" required value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="c-address">Property Address</Label>
                <Input id="c-address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Maple Ave, Bedford, NY" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="c-msg">Tell us about your property</Label>
                <Textarea id="c-msg" value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} rows={3} placeholder="Number of trees, species if known, concerns, preferred timing…" className="mt-1" />
              </div>
              <button type="submit" className="btn-orange w-full">
                Request Consultation
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-xs text-muted-foreground text-center">No obligation · A certified arborist will contact you personally</p>
            </form>
          ) : (
            <div className="py-10 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-orange/10 mb-2">
                <Check className="w-7 h-7 text-orange" />
              </div>
              <h3 className="text-xl font-semibold text-navy">Request received</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                A certified arborist will reach out to discuss your {title.toLowerCase()} and schedule an on-site assessment.
              </p>
              <p className="text-sm text-muted-foreground">
                Need to talk sooner? Call <a href="tel:8005433245" className="text-orange-deep hover:underline font-semibold">(800) 543-3245</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function scrollTo(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }))
}

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-[34px]">
      <div className="inline-flex items-center gap-3">
        <span className="step-num">{step}</span>
        <h2 className="disp text-navy text-[clamp(24px,3.4vw,36px)]">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-muted-foreground mt-2.5 max-w-xl mx-auto">{subtitle}</p>}
    </div>
  )
}

function TrustItem({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Icon className="w-[26px] h-[26px] text-orange mb-1.5" />
      <p className="font-bold text-navy text-[15px]">{title}</p>
      <p className="text-[13px] text-muted-foreground">{text}</p>
    </div>
  )
}
