"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowRight, Check, Shield, Phone, Leaf,
  Minus, Plus, ClipboardCheck, BadgeCheck, Sparkles,
} from "lucide-react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import {
  VERTICALS, servicesForVertical, instantCountForVertical, getVerticalMeta,
  cadenceLabel, defaultInputValue,
} from "@/lib/savatree-services"
import {
  getService, generateQuote, PRICING_DISCLAIMER,
  type Service, type Vertical, type QuoteInputField, type QuoteInput,
} from "@/lib/savatree-catalog"

// ─── Helpers ──────────────────────────────────────────────────────────────────

type InputValue = number | string | boolean
type InputState = Record<string, InputValue>

const SQFT_MIN = 1000
const SQFT_MAX = 40000
const SQFT_STEP = 500

function initInputs(svc: Service): InputState {
  const state: InputState = {}
  for (const f of svc.quoteInputs ?? []) state[f.key] = defaultInputValue(f)
  return state
}

// Map the collected form values onto the quote engine's input shape.
function toQuoteInput(serviceId: string, inputs: InputState): QuoteInput {
  return {
    serviceId,
    turfSqft: typeof inputs.turfSqft === "number" ? inputs.turfSqft : undefined,
    tierId: typeof inputs.tierId === "string" ? inputs.tierId : undefined,
    stumpDiameterInches: typeof inputs.stumpDiameterInches === "number" ? inputs.stumpDiameterInches : undefined,
    stumpCount: typeof inputs.stumpCount === "number" ? inputs.stumpCount : undefined,
    treeShrubCount: typeof inputs.treeShrubCount === "number" ? inputs.treeShrubCount : undefined,
  }
}

function money(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

// Compact, human summary of what the customer entered — rides to checkout.
function summarize(svc: Service, inputs: InputState): string {
  const parts: string[] = []
  for (const f of svc.quoteInputs ?? []) {
    const v = inputs[f.key]
    if (v === "" || v === undefined) continue
    if (f.type === "boolean") { if (v) parts.push(f.label.replace(/\?$/, "")); continue }
    if (f.type === "sqft") { parts.push(`${money(Number(v))} sq ft`); continue }
    if (f.key === "tierId") {
      const tier = svc.pricing.tiers?.find((t) => t.id === v)
      parts.push(tier?.name ?? String(v)); continue
    }
    if (f.type === "number") { parts.push(`${v} ${f.unit ?? ""}`.trim()); continue }
    parts.push(String(v))
  }
  return parts.join(" · ")
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const [vertical, setVertical] = useState<Vertical | null>(null)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [inputs, setInputs] = useState<InputState>({})

  const service = serviceId ? getService(serviceId) : undefined

  const selectService = (svc: Service) => {
    setServiceId(svc.id)
    setInputs(initInputs(svc))
    requestAnimationFrame(() => document.getElementById("configure")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  const setInput = (key: string, value: InputValue) => setInputs((p) => ({ ...p, [key]: value }))

  const quote = useMemo(() => {
    if (!service || service.path !== "instant_quote") return null
    try { return generateQuote(toQuoteInput(service.id, inputs)) } catch { return null }
  }, [service, inputs])

  const handleContinue = () => {
    if (!service || !quote?.estimate) return
    const params = new URLSearchParams({
      service: service.id,
      serviceName: service.name,
      vertical: service.vertical,
      cadence: service.cadence,
      low: String(quote.estimate.low),
      high: String(quote.estimate.high),
      summary: summarize(service, inputs),
      lineItems: quote.lineItems.join(" | "),
    })
    router.push(`/checkout?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="bg-brand-band-soft border-b border-line-soft">
        <div className="container mx-auto px-4 pt-14 pb-14 md:pt-[62px] md:pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <span className="brand-badge mb-5">ISA Certified Arborists</span>
            <h1 className="disp text-navy mx-auto max-w-[18ch] text-[clamp(38px,5.6vw,64px)]">
              Care for your trees, lawn &amp; landscape
            </h1>
            <p className="mt-[18px] text-body text-lg max-w-[48ch] mx-auto">
              Get an instant estimate for lawn programs, fertilization, tick &amp; mosquito, and more —
              or request a consultation with a certified arborist.
            </p>
            <button
              type="button"
              onClick={() => document.getElementById("step-1")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="mt-[22px] inline-flex items-center gap-2 text-base font-bold text-orange-deep hover:text-orange transition-colors"
            >
              Start your estimate
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Step 1 — Vertical ──────────────────────────────────────────── */}
      <section id="step-1" className="border-t border-border bg-white scroll-mt-4">
        <div className="container mx-auto px-4 py-12 md:py-14">
          <div className="max-w-5xl mx-auto">
            <StepHeader step={1} title="What can we help you with?" subtitle="Pick a category to see the services we offer and get an estimate." />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-3.5">
              {VERTICALS.map((v) => (
                <VerticalCard
                  key={v.id}
                  meta={v}
                  instantCount={instantCountForVertical(v.id)}
                  selected={vertical === v.id}
                  onClick={() => {
                    setVertical(v.id)
                    setServiceId(null)
                    requestAnimationFrame(() => document.getElementById("step-2")?.scrollIntoView({ behavior: "smooth", block: "start" }))
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Step 2 — Service ───────────────────────────────────────────── */}
      {vertical && (
        <section id="step-2" className="border-t border-border bg-background scroll-mt-4">
          <div className="container mx-auto px-4 py-12 md:py-14">
            <div className="max-w-4xl mx-auto">
              <StepHeader step={2} title={`${getVerticalMeta(vertical).label} — choose a service`} subtitle="Green tags book online with an instant estimate; the rest are scoped by an arborist on site." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {servicesForVertical(vertical).map((svc) => (
                  <ServiceCard key={svc.id} svc={svc} selected={serviceId === svc.id} onClick={() => selectService(svc)} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Step 3 — Configure + Estimate (instant) OR Consultation ────── */}
      {service && (
        <section id="configure" className="border-t border-border bg-white scroll-mt-4">
          <div className="container mx-auto px-4 py-12 md:py-14">
            {service.path === "instant_quote" ? (
              <div className="max-w-3xl mx-auto">
                <StepHeader step={3} title={service.name} subtitle={service.blurb} />

                <div className="space-y-8">
                  {(service.quoteInputs ?? []).map((field) => (
                    <QuoteField
                      key={field.key}
                      field={field}
                      svc={service}
                      value={inputs[field.key]}
                      onChange={(v) => setInput(field.key, v)}
                    />
                  ))}
                </div>

                {/* Estimate */}
                {quote?.estimate && (
                  <div className="mt-10 rounded-[16px] border border-line bg-brand-band shadow-brand-sm overflow-hidden">
                    <div className="p-7 md:px-8">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                        <div>
                          <p className="eyebrow mb-1.5">{cadenceLabel(service.cadence)} estimate</p>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-4xl md:text-[46px] font-extrabold text-navy leading-none tracking-[-0.02em]">
                              ${money(quote.estimate.low)}
                              {quote.estimate.high !== quote.estimate.low && <span> – ${money(quote.estimate.high)}</span>}
                            </span>
                            <span className="text-body text-[15px] font-semibold">
                              {service.cadence === "annual_program" ? "/yr" : service.cadence === "seasonal" ? "/season" : ""}
                            </span>
                          </div>
                        </div>
                        <button onClick={handleContinue} className="btn-orange shrink-0">
                          Continue to booking
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                      {quote.lineItems.length > 0 && (
                        <ul className="mt-5 border-t border-[#dbe7dd] pt-4 space-y-1.5">
                          {quote.lineItems.map((li, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13.5px] text-body">
                              <Check className="w-4 h-4 text-orange mt-0.5 shrink-0" />
                              <span>{li}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
                <p className="mt-4 text-[12px] text-muted-foreground leading-relaxed">{PRICING_DISCLAIMER}</p>
              </div>
            ) : (
              <ConsultationPanel service={service} />
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

// ─── Vertical card ────────────────────────────────────────────────────────────

function VerticalCard({
  meta, instantCount, selected, onClick,
}: { meta: (typeof VERTICALS)[number]; instantCount: number; selected: boolean; onClick: () => void }) {
  const Icon = meta.icon
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
      {instantCount > 0 && (
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-orange-deep">
          <Sparkles className="w-3 h-3" />
          {instantCount} instant {instantCount === 1 ? "quote" : "quotes"}
        </span>
      )}
    </button>
  )
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({ svc, selected, onClick }: { svc: Service; selected: boolean; onClick: () => void }) {
  const instant = svc.path === "instant_quote"
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex flex-col text-left rounded-[14px] p-5 transition-all duration-150 border-2 ${
        selected ? "border-orange bg-brand-select" : "border-line bg-white hover:border-[#c7d6ca] hover:shadow-brand-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-navy text-[16px] leading-tight">{svc.name}</h3>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em] ${
            instant ? "bg-orange/12 text-orange-deep" : "bg-gold/20 text-navy"
          }`}
        >
          {instant ? <><Sparkles className="w-3 h-3" /> Instant</> : <><ClipboardCheck className="w-3 h-3" /> Consult</>}
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground mt-1.5 leading-snug">{svc.blurb}</p>
    </button>
  )
}

// ─── Dynamic quote field ──────────────────────────────────────────────────────

function QuoteField({
  field, svc, value, onChange,
}: { field: QuoteInputField; svc: Service; value: InputValue; onChange: (v: InputValue) => void }) {
  // Program-tier selects render as rich cards using the catalog's tier data.
  if (field.key === "tierId" && svc.pricing.tiers) {
    return (
      <div>
        <FieldLabel field={field} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {svc.pricing.tiers.map((t) => {
            const sel = value === t.id
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={`relative text-left rounded-2xl p-4 border-2 transition-all duration-150 ${
                  sel ? "border-orange bg-brand-select shadow-[0_8px_22px_rgba(23,171,45,0.16)]" : "border-line bg-white hover:border-[#c7d6ca]"
                }`}
              >
                <p className={`font-bold text-[15px] ${sel ? "text-orange-deep" : "text-navy"}`}>{t.name}</p>
                <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{t.blurb}</p>
                <p className="text-[11.5px] font-semibold text-navy mt-2">{t.visitsPerYear} visits / year</p>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  switch (field.type) {
    case "sqft":
      return (
        <div>
          <FieldLabel field={field} />
          <PropertySlider value={Number(value) || SQFT_MIN} onChange={(n) => onChange(n)} />
        </div>
      )
    case "number":
      return (
        <div>
          <FieldLabel field={field} />
          <NumberStepper value={Number(value) || 1} unit={field.unit} onChange={(n) => onChange(n)} field={field} />
        </div>
      )
    case "select":
      return (
        <div>
          <FieldLabel field={field} />
          <div className="flex flex-wrap gap-2.5">
            {(field.options ?? []).map((opt) => {
              const sel = value === opt
              return (
                <button
                  key={opt}
                  onClick={() => onChange(opt)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    sel ? "border-orange bg-brand-select text-orange-deep" : "border-line bg-white text-navy hover:border-[#c7d6ca]"
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )
    case "boolean":
      return (
        <button
          onClick={() => onChange(!value)}
          className={`flex w-full items-center gap-3 rounded-xl p-4 border-2 text-left transition-all ${
            value ? "border-orange bg-brand-select" : "border-line bg-white hover:border-[#c7d6ca]"
          }`}
        >
          <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 shrink-0 ${value ? "border-orange bg-orange text-white" : "border-line bg-white"}`}>
            {value ? <Check className="h-4 w-4" /> : null}
          </span>
          <span className="font-semibold text-navy text-[15px]">{field.label}</span>
        </button>
      )
  }
}

function FieldLabel({ field }: { field: QuoteInputField }) {
  return (
    <p className="font-bold text-navy text-[17px] mb-3.5">
      {field.label}
      {field.optional && <span className="ml-2 text-[12px] font-semibold text-muted-foreground">(optional)</span>}
    </p>
  )
}

// ─── Number stepper ───────────────────────────────────────────────────────────

function NumberStepper({
  value, unit, onChange, field,
}: { value: number; unit?: string; onChange: (n: number) => void; field: QuoteInputField }) {
  const min = 1
  const max = field.key === "stumpDiameterInches" ? 60 : 200
  const presets = field.key === "stumpDiameterInches" ? [8, 14, 20, 30] : field.key === "treeShrubCount" ? [1, 2, 3, 5] : [1, 2, 3, 4]
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="max-w-md">
      <div className="flex items-center gap-5">
        <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease"
          className="flex items-center justify-center w-12 h-12 rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Minus className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center w-36">
          <span className="text-4xl font-extrabold text-navy tabular-nums">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Increase"
          className="flex items-center justify-center w-12 h-12 rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>
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
    </div>
  )
}

// ─── Property size slider ─────────────────────────────────────────────────────

const TICKS = [10000, 20000, 30000]
const tickPct = (v: number) => ((v - SQFT_MIN) / (SQFT_MAX - SQFT_MIN)) * 100

function PropertySlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const v = Math.min(Math.max(value || SQFT_MIN, SQFT_MIN), SQFT_MAX)
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
          onBlur={() => { if (!value || value < SQFT_MIN) onChange(SQFT_MIN) }}
          aria-label="Property size in square feet"
          className="w-44 bg-transparent border-b-2 border-line text-3xl font-extrabold text-navy tabular-nums focus:border-orange focus:outline-none transition-colors"
        />
        <span className="text-sm font-semibold text-muted-foreground">sq ft</span>
      </div>
      <SliderPrimitive.Root
        className="relative mt-8 flex w-full touch-none select-none items-center"
        min={SQFT_MIN} max={SQFT_MAX} step={SQFT_STEP} value={[v]}
        onValueChange={([n]) => onChange(n)} aria-label="Property size"
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow rounded-full bg-line">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-orange" />
          {TICKS.map((t) => (
            <span key={t} className="pointer-events-none absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-[#c7d6ca]" style={{ left: `${tickPct(t)}%` }} />
          ))}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="relative z-10 block h-6 w-6 cursor-grab rounded-full border-2 border-orange bg-white shadow-brand-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 active:cursor-grabbing" />
      </SliderPrimitive.Root>
      <div className="relative mt-3 h-4 text-xs font-medium text-muted-foreground">
        <span className="absolute left-0">{SQFT_MIN.toLocaleString()}</span>
        {TICKS.map((t) => (
          <span key={t} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${tickPct(t)}%` }}>{t.toLocaleString()}</span>
        ))}
        <span className="absolute right-0">{SQFT_MAX.toLocaleString()}+</span>
      </div>
    </div>
  )
}

// ─── Consultation panel (for assessment-gated services) ───────────────────────

function ConsultationPanel({ service }: { service: Service }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", message: "" })
  const [submitted, setSubmitted] = useState(false)
  const softRange = service.pricing.band
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-navy/10 mb-4">
          <ClipboardCheck className="w-7 h-7 text-navy" />
        </div>
        <h2 className="disp text-navy text-[clamp(26px,3.5vw,38px)]">{service.name}</h2>
        <p className="text-body mt-3 max-w-lg mx-auto">{service.blurb}</p>
        {softRange && (
          <p className="mt-3 text-sm font-semibold text-orange-deep">
            Typical range ${money(softRange.low)}–${money(softRange.high)}
            {service.cadence === "annual_program" ? "/yr" : ""} · firm price after an on-site arborist assessment
          </p>
        )}
      </div>

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
                A certified arborist will reach out to discuss your {service.name.toLowerCase()} and schedule an on-site assessment.
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
