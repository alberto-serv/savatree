"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowRight, Check, Shield, Phone, Leaf, Minus, Plus,
  ClipboardCheck, BadgeCheck, Sparkles, RefreshCw, AlertTriangle,
} from "lucide-react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import {
  VERTICALS, getVerticalMeta, programForVertical, projectsForVertical, addonsForProgram,
  BASIS_CONFIG, PLANT_SIZES, treatmentsBySeason, money, bandText, addonCadenceLabel,
  summarizeInputs,
  type VerticalMeta,
} from "@/lib/savatree-services"
import {
  quoteProgram, quoteProject, getAddon, PRICING_DISCLAIMER,
  type Program, type Project, type Addon, type Vertical,
  type TierLevel, type PlantSize, type PropertyInputs, type ProgramTier,
} from "@/lib/savatree-catalog"

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

  const toggleAddon = (id: string) =>
    setInputs((prev) => {
      const current = prev.addonIds ?? []
      return { ...prev, addonIds: current.includes(id) ? current.filter((a) => a !== id) : [...current, id] }
    })

  const setAddonCount = (id: string, n: number) =>
    setInputs((prev) => ({ ...prev, addonCounts: { ...prev.addonCounts, [id]: n } }))

  // Program price for each tier, add-ons excluded — the tier cards compare plans,
  // not carts. The full quote below adds the selected add-ons on top.
  const tierQuotes = useMemo(() => {
    if (!program) return null
    const bare = { ...inputs, addonIds: [] }
    return Object.fromEntries(
      program.tiers.map((t) => [t.level, quoteProgram(program.id, t.level, bare)]),
    ) as Record<TierLevel, ReturnType<typeof quoteProgram>>
  }, [program, inputs])

  const quote = useMemo(() => {
    if (!program) return null
    return quoteProgram(program.id, tier, inputs)
  }, [program, tier, inputs])

  const projectQuote = useMemo(() => {
    if (!project || project.path !== "instant_quote") return null
    return quoteProject(project.id, inputs)
  }, [project, inputs])

  const enroll = () => {
    if (!program || !quote) return
    const addonNames = quote.lines.filter((l) => l.band && !l.included).map((l) => l.label)
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
        addOns: addonNames.join(" | "),
        lines: quote.lines.map((l) => (l.band ? `${l.label} — ${bandText(l.band)}` : l.label)).join(" | "),
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-3.5">
              {VERTICALS.map((v) => (
                <VerticalCard key={v.id} meta={v} selected={vertical === v.id} onClick={() => selectVertical(v.id)} />
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
              </div>
            </div>
          </section>

          <section id="step-4" className="border-t border-border bg-background scroll-mt-4">
            <div className="container mx-auto px-4 py-12 md:py-14">
              <div className="max-w-3xl mx-auto">
                <StepHeader step={4} title="Add to your plan" subtitle="Optional treatments that attach to your program. Skip any you don't need." />
                <AddonList
                  program={program}
                  tier={program.tiers.find((t) => t.level === tier)!}
                  inputs={inputs}
                  onToggle={toggleAddon}
                  onCount={setAddonCount}
                />

                {quote && (
                  <div className="mt-10 rounded-[16px] border border-line bg-brand-band shadow-brand-sm overflow-hidden">
                    <div className="p-7 md:px-8">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
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

                      <ul className="mt-5 border-t border-[#dbe7dd] pt-4 space-y-1.5">
                        {quote.lines.map((line, i) => (
                          <li key={i} className="flex items-start justify-between gap-3 text-[13.5px] text-body">
                            <span className="flex items-start gap-2">
                              <Check className={`w-4 h-4 mt-0.5 shrink-0 ${line.included ? "text-navy/40" : "text-orange"}`} />
                              <span>{line.label}</span>
                            </span>
                            {line.band && <span className="font-semibold text-navy tabular-nums shrink-0">{bandText(line.band)}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <p className="mt-4 text-[12px] text-muted-foreground leading-relaxed">{PRICING_DISCLAIMER}</p>
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
              <StepHeader step={2} title={`${meta.label} — what do you need?`} subtitle="One-off jobs, scoped by a certified arborist. Stump grinding quotes instantly." />
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
          <button
            type="button"
            onClick={() => scrollTo("step-1")}
            className="btn-orange mt-7"
          >
            Build my plan
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function VerticalCard({ meta, selected, onClick }: { meta: VerticalMeta; selected: boolean; onClick: () => void }) {
  const Icon = meta.icon
  // Deer is a program but still arborist-gated — don't promise an instant plan.
  const instant = meta.kind === "program" && programForVertical(meta.id)?.path === "instant_quote"
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
      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-orange-deep">
        {instant ? <><Sparkles className="w-3 h-3" /> Instant plan</> : <><ClipboardCheck className="w-3 h-3" /> Scoped on site</>}
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
      <div className="mt-4 space-y-3 flex-1">
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
        <div className="mt-4 pt-4 border-t border-line">
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

      <span
        className={`mt-5 inline-flex items-center justify-center w-full rounded-lg py-3 text-sm font-bold transition-colors ${
          selected ? "bg-orange text-white" : "bg-sky text-navy"
        }`}
      >
        {selected ? <><Check className="w-4 h-4 mr-1.5" /> Selected</> : "Choose this plan"}
      </span>
    </button>
  )
}

function ProjectCard({ project, selected, onClick }: { project: Project; selected: boolean; onClick: () => void }) {
  const instant = project.path === "instant_quote"
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
          {project.urgent ? <><AlertTriangle className="w-3 h-3" /> Urgent</> : instant ? <><Sparkles className="w-3 h-3" /> Instant</> : <><ClipboardCheck className="w-3 h-3" /> Consult</>}
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

  return (
    <div className="space-y-9">
      <div>
        <FieldLabel label={cfg.label} help={cfg.help} />
        {cfg.kind === "sqft" ? (
          <PropertySlider value={value} min={cfg.min} max={cfg.max} step={cfg.step} onChange={(n) => setInput(cfg.key, n)} />
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
        <div>
          <FieldLabel label="How big are they, on average?" help="Bigger canopies take more material and more labor." />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PLANT_SIZES.map((size) => {
              const selected = (inputs.plantSize ?? "medium") === size.value
              return (
                <button
                  key={size.value}
                  onClick={() => setInput("plantSize", size.value as PlantSize)}
                  className={`rounded-xl px-4 py-3 text-left border-2 transition-all ${
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
        <button
          onClick={() => setInput("organic", !inputs.organic)}
          className={`flex w-full items-start gap-3 rounded-xl p-4 border-2 text-left transition-all ${
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
      )}
    </div>
  )
}

// ─── Add-ons ──────────────────────────────────────────────────────────────────

function AddonList({
  program, tier, inputs, onToggle, onCount,
}: {
  program: Program
  tier: ProgramTier
  inputs: PropertyInputs
  onToggle: (id: string) => void
  onCount: (id: string, n: number) => void
}) {
  const addons = addonsForProgram(program.id)
  const included = new Set(tier.includedAddons ?? [])
  const selectable = addons.filter((a) => !included.has(a.id))
  const bundled = addons.filter((a) => included.has(a.id))

  if (!addons.length) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        This program is sold as a complete plan — no add-ons to configure.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {bundled.map((addon) => (
        <div key={addon.id} className="flex items-start gap-3 rounded-[14px] p-[18px] border-2 border-line-soft bg-brand-band-soft">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-navy/10 text-navy shrink-0 mt-0.5">
            <Check className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h4 className="font-semibold text-navy text-[15.5px]">{addon.name}</h4>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-orange-deep">Included in {tier.name}</span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">{addon.blurb}</p>
          </div>
        </div>
      ))}

      {selectable.map((addon) => (
        <AddonRow
          key={addon.id}
          addon={addon}
          inputs={inputs}
          checked={(inputs.addonIds ?? []).includes(addon.id)}
          onToggle={() => onToggle(addon.id)}
          onCount={(n) => onCount(addon.id, n)}
        />
      ))}
    </div>
  )
}

function AddonRow({
  addon, inputs, checked, onToggle, onCount,
}: {
  addon: Addon
  inputs: PropertyInputs
  checked: boolean
  onToggle: () => void
  onCount: (n: number) => void
}) {
  // Price the add-on against the property the customer just described, so the
  // number on the row is the number that lands in the estimate.
  const band = useMemo(() => priceAddonRow(addon.id, inputs), [addon.id, inputs])
  const subset = addon.plantSubset
  const count = subset ? inputs.addonCounts?.[addon.id] ?? subset.default : 0

  return (
    <div
      className={`rounded-[14px] border-2 transition-all duration-150 ${
        checked ? "border-orange bg-brand-select" : "border-line bg-white hover:border-[#c7d6ca]"
      }`}
    >
      <button onClick={onToggle} aria-pressed={checked} className="flex w-full items-start gap-3 p-[18px] text-left">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 shrink-0 mt-0.5 ${checked ? "border-orange bg-orange text-white" : "border-line bg-white"}`}>
          {checked ? <Check className="h-4 w-4" /> : null}
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 className="font-semibold text-navy text-[15.5px]">{addon.name}</h4>
            {band && (
              <span className="text-[14px] font-bold text-navy tabular-nums">
                {bandText(band)}
                <span className="text-[12px] font-semibold text-muted-foreground ml-1">{addonCadenceLabel(addon).toLowerCase()}</span>
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">{addon.blurb}</p>
        </div>
      </button>

      {/* Subset add-ons treat only some plants — ask how many, don't assume the whole yard. */}
      {checked && subset && (
        <div className="px-[18px] pb-[18px] pt-1 ml-9">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft bg-white/70 px-4 py-3">
            <span className="text-[13.5px] font-semibold text-navy">{subset.label}</span>
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" aria-label={`Fewer ${subset.unit}`} onClick={() => onCount(Math.max(1, count - 1))} disabled={count <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-[18px] font-extrabold text-navy tabular-nums">{count}</span>
              <button type="button" aria-label={`More ${subset.unit}`} onClick={() => onCount(Math.min(subset.max, count + 1))} disabled={count >= subset.max}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Price a single add-on against the current property. The engine only prices
 * add-ons inside a program quote, so we quote the program with just this one
 * attached and read back its line.
 */
function priceAddonRow(addonId: string, inputs: PropertyInputs) {
  const addon = getAddon(addonId)
  if (!addon) return null
  try {
    const quoted = quoteProgram(addon.attachesTo[0], "good", { ...inputs, addonIds: [addonId] })
    // Subset add-ons append their count to the label, so match on the prefix.
    const line = quoted.lines.find((l) => l.label === addon.name || l.label.startsWith(`${addon.name} — `))
    return line?.band ?? null
  } catch {
    return null
  }
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <div className="mb-3.5">
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
    <div className="max-w-md">
      <div className="flex items-center gap-5">
        <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease"
          className="flex items-center justify-center w-12 h-12 rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Minus className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center w-40">
          <span className="text-4xl font-extrabold text-navy tabular-nums">{value}</span>
          {unit && <span className="text-sm text-muted-foreground text-center">{unit}</span>}
        </div>
        <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Increase"
          className="flex items-center justify-center w-12 h-12 rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      {presets.length > 0 && (
        <div className="flex gap-2 mt-5">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => onChange(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
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

function PropertySlider({
  value, min, max, step, onChange,
}: { value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  const v = Math.min(Math.max(value || min, min), max)
  const ticks = [10000, 20000, 30000].filter((t) => t > min && t < max)
  const tickPct = (n: number) => ((n - min) / (max - min)) * 100

  return (
    <div className="max-w-xl">
      <div className="flex items-baseline gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={value ? value.toLocaleString() : ""}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value.replace(/[^\d]/g, ""), 10)
            onChange(Number.isNaN(n) ? 0 : n)
          }}
          onBlur={() => { if (!value || value < min) onChange(min) }}
          aria-label="Property size in square feet"
          className="w-44 bg-transparent border-b-2 border-line text-3xl font-extrabold text-navy tabular-nums focus:border-orange focus:outline-none transition-colors"
        />
        <span className="text-sm font-semibold text-muted-foreground">sq ft</span>
      </div>
      <SliderPrimitive.Root
        className="relative mt-8 flex w-full touch-none select-none items-center"
        min={min} max={max} step={step} value={[v]}
        onValueChange={([n]) => onChange(n)} aria-label="Property size"
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

// ─── Urgent (storm) panel ─────────────────────────────────────────────────────

function UrgentPanel({ project }: { project: Project }) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold/20 mb-4">
        <AlertTriangle className="w-7 h-7 text-gold-deep" />
      </div>
      <h2 className="disp text-navy text-[clamp(26px,3.5vw,38px)]">{project.name}</h2>
      <p className="text-body mt-3 max-w-lg mx-auto">{project.blurb}</p>
      <div className="mt-8 rounded-[16px] border border-line bg-brand-band p-8">
        <p className="text-[15px] font-semibold text-navy">Don&apos;t wait on a quote — call our dispatch line.</p>
        <a href="tel:8005433245" className="btn-orange mt-5 w-full sm:w-auto">
          <Phone className="w-5 h-5" />
          (800) 543-3245
        </a>
        <p className="text-[13px] text-muted-foreground mt-4">
          Emergency crews are dispatched directly. Typical storm work runs {bandText(project.pricing.band)}, confirmed on site.
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
