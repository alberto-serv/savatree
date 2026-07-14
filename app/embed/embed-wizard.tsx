"use client"

/**
 * SavATree — embeddable estimator widget.
 * ------------------------------------------------------------------
 * The scrolling estimator on `/` is a page: it owns the viewport, it stacks
 * sections, and it hands the customer off to /checkout. This is the same
 * catalog and the same pricing engine wearing a different body — one card,
 * one question at a time, no page scroll, no navigation. It has to survive
 * inside somebody else's <iframe>.
 *
 * Three consequences drive the design:
 *
 *   1. ONE SCREEN AT A TIME. An embed can't scroll a host page. Every question
 *      stands alone; Back/Next moves the machine. `screensFor()` is the whole
 *      flow — read it and you know every path a customer can take.
 *   2. NEVER LEAVE. Enrollment, estimate, and confirmation all land inside the
 *      card. Routing to /checkout would break out of the frame.
 *   3. TELL THE HOST OUR HEIGHT. The card grows and shrinks per screen, so we
 *      post a resize message the parent can listen for (see /embed/demo).
 *
 * The pricing rules are NOT re-implemented here — quoteProgram, quoteProject,
 * and estimateTreeWork are the same functions the main page calls. If a number
 * looks wrong, it's wrong in both places, which is the point.
 */

import { useState, useMemo, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import * as SliderPrimitive from "@radix-ui/react-slider"
import {
  ArrowRight, ArrowLeft, Check, Phone, Minus, Plus, AlertTriangle,
  Info, RefreshCw, Sparkles, ClipboardCheck, Video, MapPin,
  ChevronLeft, ChevronRight, ShieldAlert, CalendarClock, Leaf, ChevronDown, CreditCard,
} from "lucide-react"
import {
  getAvailableDates, isSameDay, formatVisitDate, slotsFor,
  type VisitType, type TimeSlot,
} from "@/lib/scheduling"
import {
  getVerticalMeta, programForVertical, projectsForVertical,
  BASIS_CONFIG, PLANT_SIZES, money, bandText, summarizeInputs, treatmentsBySeason,
} from "@/lib/savatree-services"
import {
  quoteProgram, getProject, getAddon, PRICING_DISCLAIMER,
  type Vertical, type TierLevel, type PlantSize, type PropertyInputs, type Project,
  type ProgramTier,
} from "@/lib/savatree-catalog"
import { estimateTreeWork, priceStumpGrinding, type TreeInputs, type TreeJob } from "@/lib/tree-care"
import {
  CA_SPECIES, speciesAdvisory,
  type TreeSpecies, type PermitAssessment, type SpeciesAdvisory,
} from "@/lib/california-trees"
import {
  useSavedConfig, resolveProgram, resolveAddons, enabledServices, enabledTreeJobs,
  treeOptions, SERVICE_LABELS, type BranchConfig,
} from "@/lib/branch-config"

// ─── Flow ─────────────────────────────────────────────────────────────────────

type ScreenId =
  | "service"       // which vertical
  | "project"       // which one-off job (project verticals only)
  | "emergency"     // storm work — dispatch, never a quote
  | "basis"         // the program's price driver: plants, turf sq ft, beds…
  | "plantSize"     // PHC only, and the dominant cost driver
  | "organic"       // style choice, offered where the program supports it
  | "treeSpecies" | "treeSize" | "treeScope" | "treeAccess"
  | "stump"         // stump grinding: diameter + count
  | "plan"          // tier picker
  | "estimate"      // the range, for jobs that produce one
  | "visit"         // video call or an arborist on the property
  | "schedule"      // day + slot, shaped by the visit type
  | "contact"

type Phase = "Service" | "Details" | "Estimate" | "Schedule" | "Contact"

// A tier picker and a price band are the same phase wearing different clothes:
// both are the moment the customer sees a number. Giving them one label keeps
// the rail from relabelling itself the instant a service is chosen.
const PHASE_OF: Record<ScreenId, Phase> = {
  service: "Service",
  project: "Details", emergency: "Details",
  basis: "Details", plantSize: "Details", organic: "Details",
  treeSpecies: "Details", treeSize: "Details", treeScope: "Details",
  treeAccess: "Details", stump: "Details",
  plan: "Estimate",
  estimate: "Estimate",
  visit: "Schedule", schedule: "Schedule",
  contact: "Contact",
}

/** What the rail promises before we know enough to promise anything specific. */
const DEFAULT_PHASES: Phase[] = ["Service", "Details", "Estimate", "Schedule", "Contact"]

/**
 * The tile's words, everywhere the widget speaks to the customer. These are the
 * customer's words, not the catalog's: "Plant Health Care" is what SavATree calls
 * the program internally; "Shrub Care" is what the homeowner came looking for.
 * The vertical id underneath is unchanged, so the pricing engine never sees it.
 */
function serviceLabel(id: Vertical): string {
  return SERVICE_LABELS[id] ?? getVerticalMeta(id).label
}

/** Catalog projects the tree-care model can actually price. Everything else consults. */
const TREE_JOBS: Record<string, TreeJob> = {
  tree_removal: "removal",
  tree_pruning: "pruning",
  cabling_bracing: "cabling",
}

/**
 * The entire flow, as data. A screen exists only when the customer's answers so
 * far have earned it — which is why the progress rail can be honest about how
 * many steps are left instead of guessing.
 */
function screensFor(vertical: Vertical | null, projectId: string | null, job: TreeJob | null): ScreenId[] {
  const s: ScreenId[] = ["service"]
  if (!vertical) return s

  const meta = getVerticalMeta(vertical)

  if (meta.kind === "project") {
    s.push("project")
    const project = projectId ? getProject(projectId) : undefined
    if (!project) return s

    // Nobody with a limb through their roof wants a pricing wizard.
    if (project.urgent) return [...s, "emergency"]

    // Species leads. In California it's the input that decides whether this is a
    // tree job or a permit application.
    if (job) s.push("treeSpecies", "treeSize", "treeScope", "treeAccess", "estimate")
    else if (project.id === "stump_grinding") s.push("stump", "estimate")
    // Consultation projects (landscape, commercial, holiday lighting) skip the
    // estimate — an arborist scopes them, we don't — but they still book a visit.

    return [...s, "visit", "schedule", "contact"]
  }

  const program = programForVertical(vertical)
  if (!program) return s

  s.push("basis")
  if (program.priceBasis === "plant_count") s.push("plantSize")
  if (program.organicModifier) s.push("organic")
  // Deer is a program but stays arborist-gated: we still ask the questions so
  // the arborist arrives prepared, but we never show a plan price.
  if (program.path === "instant_quote") s.push("plan")

  return [...s, "visit", "schedule", "contact"]
}

// ─── Choice sets ──────────────────────────────────────────────────────────────

const ACCESS_CHOICES = [
  { value: "open", label: "Open", detail: "A truck can reach it" },
  { value: "moderate", label: "Moderate", detail: "Some obstacles" },
  { value: "tight", label: "Tight", detail: "Backyard, gated, no truck" },
] as const

// ─── Widget ───────────────────────────────────────────────────────────────────

/**
 * The booking widget, as configured by ONE branch.
 *
 * `config` is how /config previews itself: it passes the manager's live, unsaved
 * edits straight in, so the page they're looking at is the page their customers
 * will get — not an approximation of it. Left out, the widget loads the branch's
 * saved config from storage, which is what a real embed on a branch site does.
 *
 * Every price on this screen therefore comes from the branch, not the catalog:
 * the tier rates, the tree labor index, and the city's permit fees.
 */
export function EmbedWizard({ config }: { config?: BranchConfig } = {}) {
  const params = useSearchParams()
  const saved = useSavedConfig()
  const cfg = config ?? saved

  const [vertical, setVertical] = useState<Vertical | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [inputs, setInputs] = useState<PropertyInputs>({})
  const [tier, setTier] = useState<TierLevel>("better")
  // Only what the widget actually asks for. Proximity, condition, and lean are
  // absent on purpose — we don't ask, so we don't pretend to know, and the model
  // supplies its own defaults (near a structure, healthy, straight).
  const [tree, setTree] = useState<TreeInputs>({
    job: "removal", heightFt: 40, count: 1, access: "moderate",
  })
  const [step, setStep] = useState(0)
  // Which plan has its included-visits list open. One at a time — three expanded
  // treatment timelines is a wall of text in a 660px card, not a comparison.
  const [openTier, setOpenTier] = useState<TierLevel | null>(null)
  const [visitType, setVisitType] = useState<VisitType | null>(null)
  const [date, setDate] = useState<Date | null>(null)
  const [slotId, setSlotId] = useState("")
  const [weekStart, setWeekStart] = useState(0)
  const [contact, setContact] = useState({
    audience: "residential", firstName: "", lastName: "", email: "", phone: "", address: "", sms: false,
  })
  // Not a pricing input — the model never sees it. It rides along to the arborist
  // so they arrive ready to talk terms instead of discovering the question on site.
  const [financing, setFinancing] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)
  const dates = useMemo(() => getAvailableDates(), [])
  const slots = slotsFor(visitType ?? "in_person")
  const slot = slots.find((s) => s.id === slotId) ?? null

  // The branch's version of everything: its tier rates, its add-on prices, its
  // service list, its tree jobs. The catalog supplies the structure; the config
  // supplies the numbers.
  const services = useMemo(() => enabledServices(cfg), [cfg])
  const branchAddons = useMemo(() => resolveAddons(cfg), [cfg])
  const treeOpts = useMemo(() => treeOptions(cfg), [cfg])

  const catalogProgram = vertical ? programForVertical(vertical) : undefined
  const program = useMemo(
    () => (catalogProgram ? resolveProgram(cfg, catalogProgram) : undefined),
    [cfg, catalogProgram],
  )
  const project = projectId ? getProject(projectId) : undefined
  const job = projectId ? TREE_JOBS[projectId] ?? null : null

  /** Only the tree jobs this branch's crews actually take. Storm always stays. */
  const branchProjects = useMemo(() => {
    if (!vertical) return []
    const all = projectsForVertical(vertical)
    if (vertical !== "tree_work") return all
    const allowed = new Set(enabledTreeJobs(cfg))
    return all.filter((p) => allowed.has(p.id))
  }, [vertical, cfg])

  const screens = useMemo(() => screensFor(vertical, projectId, job), [vertical, projectId, job])
  const screen = screens[Math.min(step, screens.length - 1)]

  // Rail phases — derived from the flow, so a consultation-gated path never
  // renders an Estimate dot it has no intention of filling. Before a service is
  // picked there is no flow yet, so we show the common one rather than a single
  // lonely dot that tells the customer nothing about what they're in for.
  const phases = useMemo(() => {
    if (!vertical) return DEFAULT_PHASES
    const seen: Phase[] = []
    screens.forEach((s) => { if (!seen.includes(PHASE_OF[s])) seen.push(PHASE_OF[s]) })
    return seen
  }, [vertical, screens])

  const setInput = <K extends keyof PropertyInputs>(k: K, v: PropertyInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }))
  const setTreeInput = <K extends keyof TreeInputs>(k: K, v: TreeInputs[K]) =>
    setTree((p) => ({ ...p, [k]: v }))

  // ── Quotes. Same engine as the full-page estimator, priced at branch rates. ──
  const tierQuotes = useMemo(() => {
    if (!program || program.path !== "instant_quote") return null
    return Object.fromEntries(
      program.tiers.map((t) => [
        t.level,
        quoteProgram(program.id, t.level, inputs, { program, addons: branchAddons }),
      ]),
    ) as Record<TierLevel, ReturnType<typeof quoteProgram>>
  }, [program, inputs, branchAddons])

  const planQuote = tierQuotes?.[tier] ?? null

  // The widget asks three things about a tree — size, count, access — so the
  // model fills the rest from its defaults: a healthy, straight tree standing
  // near a structure. It therefore cannot tell a sound oak in an open yard from
  // a decayed leaner hanging over a roof. That's acceptable for a RANGE; it is
  // not acceptable for a booking, which is why the San Jose branch ships with
  // direct booking off and every tree job routes to the free arborist assessment.
  //
  // The branch's rate index and its city's permit policy both land here.
  const treeEstimate = useMemo(
    () => (job ? estimateTreeWork({ ...tree, job }, treeOpts) : null),
    [job, tree, treeOpts],
  )

  // Grinding a stump on its own is the same work as grinding it after a removal,
  // so it's priced from the same rate card — not from the catalog's project table.
  // Two tables for one stump is how the same customer gets two different numbers.
  const stumpQuote = useMemo(() => {
    if (project?.id !== "stump_grinding") return null
    const inches = inputs.stumpDiameterInches ?? 14
    const count = inputs.stumpCount ?? 1
    const raw = priceStumpGrinding(inches, count, cfg.tree.rates.stump)
    const k = cfg.tree.rateIndex
    const { stump } = cfg.tree.rates
    return {
      estimate: { low: Math.round(raw.low * k), high: Math.round(raw.high * k) },
      lines: [
        `${inches}" stump @ $${stump.perInch.low}–$${stump.perInch.high}/inch (min $${stump.minCharge})`,
        ...(count > 1 ? [`${count - 1} additional stump(s)`] : []),
      ],
      disclaimer: PRICING_DISCLAIMER,
    }
  }, [project, inputs, cfg.tree])

  // Available before there's a size, and therefore before there's a price.
  const speciesNotice =
    job && tree.species ? speciesAdvisory(tree.species, job, cfg.permit) : null

  // ── Navigation ──
  const selectVertical = (v: Vertical) => {
    const p = programForVertical(v)
    setVertical(v)
    setProjectId(null)
    setTier("better")
    // Seed the price basis so the plan cards never flash a $0 — a zero price
    // reads as "free", and we can't take it back once they've seen it.
    setInputs(p ? { [BASIS_CONFIG[p.priceBasis].key]: BASIS_CONFIG[p.priceBasis].default, plantSize: "medium" } : {})
  }

  const selectProject = (p: Project) => {
    setProjectId(p.id)
    const j = TREE_JOBS[p.id]
    if (j) setTree((prev) => ({ ...prev, job: j }))
    if (p.id === "stump_grinding") setInputs({ stumpDiameterInches: 14, stumpCount: 1 })
  }

  // Switching video ↔ in-person swaps the slot set underneath them, so a slot
  // chosen for the other kind of appointment can't survive the change.
  const chooseVisit = (v: VisitType) => {
    setVisitType(v)
    setSlotId("")
  }

  const canAdvance =
    screen === "service" ? Boolean(vertical)
    : screen === "project" ? Boolean(projectId)
    // No default species. A silent "other" would quietly price a protected oak
    // as an ordinary tree, which is the one mistake this question exists to stop.
    : screen === "treeSpecies" ? Boolean(tree.species)
    : screen === "visit" ? Boolean(visitType)
    : screen === "schedule" ? Boolean(date && slotId)
    : screen === "contact" ? Boolean(contact.firstName && contact.lastName && contact.email && contact.phone && contact.address)
    : screen !== "emergency"

  // Answering a question can CREATE the screens that follow it — picking a service
  // is what earns the questions. So the step clamp has to read the flow as it is
  // when we advance, not the shorter flow that existed at the moment of the click.
  // (Auto-advance fires from a timer, so the difference is not theoretical: clamped
  // against the stale list, selecting a service would pin the wizard on screen one.)
  const screensRef = useRef(screens)
  screensRef.current = screens

  const isLast = screen === "contact"
  const next = () =>
    isLast
      ? setSubmitted(true)
      : setStep((s) => Math.min(s + 1, screensRef.current.length - 1))

  // With history managed, the widget's own Back button and the browser's are the
  // same button — walking the history is what keeps them from disagreeing. Inside
  // a host's iframe there is no wizard history to walk, so it moves the step
  // directly. See the history effect below.
  const back = () =>
    ownsHistory ? window.history.back() : setStep((s) => Math.max(0, s - 1))

  /**
   * A single-choice question answers itself: tapping the tile IS the decision, and
   * making the customer confirm it with a second tap on Next is a tax on every
   * screen. So a choice advances the wizard on its own.
   *
   * The pause is not decoration — it's long enough for the selected state to land,
   * so the customer sees WHICH answer they gave before the screen moves. Advancing
   * instantly reads as a glitch.
   *
   * Callers pass `false` when the choice revealed something to read (a protected
   * oak, a video-call caveat). Auto-advancing past information the customer asked
   * for by tapping is worse than a wasted click.
   */
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chose = (shouldAdvance = true) => {
    if (!shouldAdvance) return
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(next, 260)
  }
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

  // Preselect a service from the host page: /embed?service=lawn drops the
  // customer straight into the questions for the page they were already reading.
  useEffect(() => {
    // Guarded against what this BRANCH sells, not the whole catalog. A deep link
    // must not open a flow whose tile the manager deliberately turned off.
    const requested = params.get("service") as Vertical | null
    if (requested && enabledServices(cfg).includes(requested)) {
      selectVertical(requested)
      setStep(1)
    }
    // Preselect once, on mount — later param changes must not yank a customer
    // out of a flow they're already halfway through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * On its own page, /embed IS the page — so the browser's Back button has to mean
   * "back one question," not "leave the estimator." A wizard that throws away six
   * answers because someone reached for the button their thumb already knows is a
   * wizard that gets abandoned.
   *
   * So each step gets a history entry, and Back walks them.
   *
   * ONLY when we're the top-level document. Framed into a customer's site, this
   * history belongs to THEM: pushing entries from inside the iframe would hijack
   * their Back button, so a visitor trying to leave the article they were reading
   * would instead reverse through our questions. There, Back stays theirs and the
   * widget's own Back button moves the step directly.
   */
  // `config` means we're being previewed inside another app (/config's console),
  // whose history is no more ours to push onto than a host site's. Only the
  // standalone, unframed /embed owns its back stack.
  const ownsHistory =
    !config && typeof window !== "undefined" && window.parent === window
  const fromPopstate = useRef(false)

  useEffect(() => {
    if (!ownsHistory) return

    const onPop = (e: PopStateEvent) => {
      const st = e.state as { w?: number; done?: boolean } | null
      // No wizard state on this entry → it's the page we arrived from. Let go.
      if (!st || typeof st.w !== "number") return
      fromPopstate.current = true
      setStep(st.w)
      setSubmitted(Boolean(st.done))
    }

    window.history.replaceState({ w: 0, done: false }, "")
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [ownsHistory])

  useEffect(() => {
    if (!ownsHistory) return

    // A popstate ALREADY moved the browser. Pushing here would re-add the entry we
    // just left, and the Back button would appear to do nothing.
    if (fromPopstate.current) {
      fromPopstate.current = false
      return
    }

    // Push only if this screen isn't already the entry we're standing on. Counting
    // mounts instead would double-push under React's dev double-invoke, and every
    // duplicate entry is a Back press that visibly does nothing.
    const here = window.history.state as { w?: number; done?: boolean } | null
    if (here && here.w === step && Boolean(here.done) === submitted) return

    window.history.pushState({ w: step, done: submitted }, "")
  }, [step, submitted, ownsHistory])

  // An iframe can't size itself. Tell the parent what we need; /embed/demo shows
  // the three lines of host code that listen for it.
  //
  // Framed, we also stay visually transparent — the customer's own page is the
  // background. Only when this is the top-level document do we paint the brand
  // backdrop behind the card, which is what makes /embed viewable on its own.
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof window === "undefined") return
    if (window.parent === window) {
      document.documentElement.classList.add("embed-standalone")
      return () => document.documentElement.classList.remove("embed-standalone")
    }
    const post = () =>
      window.parent.postMessage(
        { type: "savatree:embed:height", height: Math.ceil(el.getBoundingClientRect().height) + 48 },
        "*",
      )
    const observer = new ResizeObserver(post)
    observer.observe(el)
    post()
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={cardRef} className="w-full max-w-[660px] rounded-[20px] bg-sky p-6 shadow-brand sm:p-9">
      {submitted ? (
        <Confirmation
          contact={contact}
          phone={cfg.identity.phone}
          visitType={visitType}
          date={date}
          slot={slot}
          financing={financing}
          summary={
            planQuote ? `${planQuote.tierName} · ${bandText(planQuote.annual)}/yr`
            : treeEstimate ? bandText(treeEstimate.estimate)
            : stumpQuote ? bandText(stumpQuote.estimate)
            : null
          }
        />
      ) : (
        <>
          <Rail phases={phases} active={PHASE_OF[screen]} />

          <div className="mt-8">
            {screen === "service" && (
              <Screen title="What can we help you with?">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {services.map((id) => {
                    const Icon = getVerticalMeta(id).icon
                    const selected = vertical === id
                    return (
                      <button
                        key={id}
                        onClick={() => { selectVertical(id); chose() }}
                        aria-pressed={selected}
                        className={`flex items-center gap-3 rounded-xl px-4 py-4 text-left transition-all duration-150 ${
                          selected
                            ? "bg-navy text-white shadow-brand-sm"
                            : "bg-white text-navy shadow-[0_2px_8px_rgba(27,92,52,.07)] hover:-translate-y-0.5 hover:shadow-brand-sm"
                        }`}
                      >
                        <Icon className={`h-6 w-6 shrink-0 ${selected ? "text-white" : "text-navy"}`} />
                        <span className="text-[13.5px] font-extrabold uppercase leading-tight tracking-[0.04em]">
                          {serviceLabel(id)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Screen>
            )}

            {screen === "project" && vertical && (
              <Screen title={`${serviceLabel(vertical)} — what do you need?`}>
                <div className="grid grid-cols-1 gap-2.5">
                  {branchProjects.map((p) => {
                    const selected = projectId === p.id
                    const quotes = Boolean(TREE_JOBS[p.id]) || p.path === "instant_quote"
                    return (
                      <button
                        key={p.id}
                        onClick={() => { selectProject(p); chose() }}
                        aria-pressed={selected}
                        className={`rounded-xl px-4 py-3.5 text-left transition-all duration-150 ${
                          selected ? "bg-navy text-white shadow-brand-sm" : "bg-white hover:shadow-brand-sm"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className={`text-[15px] font-bold ${selected ? "text-white" : "text-navy"}`}>
                            {p.name}
                          </span>
                          <Tag
                            tone={p.urgent ? "urgent" : quotes ? "instant" : "consult"}
                            inverted={selected}
                          />
                        </span>
                        <span className={`mt-1 block text-[12.5px] leading-snug ${selected ? "text-white/70" : "text-muted-foreground"}`}>
                          {p.blurb}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Screen>
            )}

            {screen === "emergency" && <Emergency phone={cfg.identity.phone} />}

            {screen === "basis" && program && (
              <Screen
                title={BASIS_CONFIG[program.priceBasis].label}
                help={BASIS_CONFIG[program.priceBasis].help}
              >
                {BASIS_CONFIG[program.priceBasis].kind === "sqft" ? (
                  <Measure
                    value={(inputs[BASIS_CONFIG[program.priceBasis].key] as number) ?? BASIS_CONFIG[program.priceBasis].default}
                    min={BASIS_CONFIG[program.priceBasis].min}
                    max={BASIS_CONFIG[program.priceBasis].max}
                    step={BASIS_CONFIG[program.priceBasis].step}
                    unit="sq ft"
                    onChange={(n) => setInput(BASIS_CONFIG[program.priceBasis].key, n)}
                  />
                ) : (
                  <Stepper
                    value={(inputs[BASIS_CONFIG[program.priceBasis].key] as number) ?? BASIS_CONFIG[program.priceBasis].default}
                    unit={BASIS_CONFIG[program.priceBasis].unit}
                    min={BASIS_CONFIG[program.priceBasis].min}
                    max={BASIS_CONFIG[program.priceBasis].max}
                    presets={BASIS_CONFIG[program.priceBasis].presets}
                    onChange={(n) => setInput(BASIS_CONFIG[program.priceBasis].key, n)}
                  />
                )}
              </Screen>
            )}

            {screen === "plantSize" && (
              <Screen title="How big are they, on average?" help="Bigger canopies take more material and more labor.">
                <Choices
                  choices={PLANT_SIZES.map((s) => ({ value: s.value, label: s.label, detail: s.detail }))}
                  value={inputs.plantSize ?? "medium"}
                  onChange={(v) => { setInput("plantSize", v as PlantSize); chose() }}
                  columns={2}
                />
              </Screen>
            )}

            {screen === "organic" && program?.organicModifier && (
              <Screen title="Traditional or organic?" help="A style choice — not a better plan. Both are designed by the same arborist.">
                <Choices
                  choices={[
                    { value: "traditional", label: "Traditional", detail: "Conventional treatments" },
                    {
                      value: "organic",
                      label: "Organic",
                      detail: `Natural inputs (+${Math.round((program.organicModifier - 1) * 100)}%)`,
                    },
                  ]}
                  value={inputs.organic ? "organic" : "traditional"}
                  onChange={(v) => { setInput("organic", v === "organic"); chose() }}
                  columns={2}
                />
              </Screen>
            )}

            {screen === "treeSpecies" && (
              <Screen
                title="What kind of tree is it?"
                help="California cities protect native oaks, redwoods, and any tree big enough to be a heritage tree. Species decides whether the city has to approve this work."
              >
                <Choices
                  choices={CA_SPECIES.map((s) => ({ value: s.id, label: s.label, detail: s.detail }))}
                  value={tree.species ?? ("" as TreeSpecies)}
                  onChange={(v) => {
                    setTreeInput("species", v)
                    // A palm has nothing to tell them, so move on. An oak just put a
                    // permit warning on this screen — leave it up and let them read it.
                    chose(!(job && speciesAdvisory(v, job, cfg.permit)))
                  }}
                  columns={2}
                />
                {/* Said the instant they tap Oak, not four screens later at the
                    price. The permit, the weeks, and the chance of a flat refusal
                    are what change a customer's mind — make them cheap to learn. */}
                {speciesNotice && <SpeciesNotice advisory={speciesNotice} />}
              </Screen>
            )}

            {screen === "treeSize" && (
              <Screen title="How big is the tree?" help="A rough guess is fine — compare it to your house.">
                <p className="mb-3 text-center text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Height</p>
                <Measure
                  value={tree.heightFt}
                  min={10}
                  max={120}
                  step={5}
                  unit="ft"
                  onChange={(n) => setTreeInput("heightFt", n)}
                />
                <div className="mt-8 border-t border-line pt-7">
                  <p className="mb-3 text-center text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Trunk width
                  </p>
                  <Stepper
                    value={tree.diameterInches ?? Math.round(tree.heightFt / 3)}
                    unit="inches across"
                    min={4}
                    max={80}
                    presets={[]}
                    onChange={(n) => setTreeInput("diameterInches", n)}
                  />
                </div>
              </Screen>
            )}

            {screen === "treeScope" && (
              <Screen title="How many trees?">
                <Stepper
                  value={tree.count ?? 1}
                  unit="trees"
                  min={1}
                  max={25}
                  presets={[1, 2, 3, 5]}
                  onChange={(n) => setTreeInput("count", n)}
                />
                {job === "removal" && (
                  <div className="mt-8 border-t border-line pt-7">
                    <Toggle
                      checked={Boolean(tree.addStumpGrinding)}
                      onChange={(v) => setTreeInput("addStumpGrinding", v)}
                      label="Grind the stump too"
                      detail="Otherwise the stump stays. Priced by trunk diameter."
                    />
                  </div>
                )}
              </Screen>
            )}

            {screen === "treeAccess" && (
              <Screen title="Can a truck get to it?" help="Access is the single biggest cost driver on a tree job.">
                <Choices
                  choices={ACCESS_CHOICES}
                  value={tree.access ?? "moderate"}
                  onChange={(v) => { setTreeInput("access", v); chose() }}
                />
              </Screen>
            )}


            {screen === "stump" && (
              <Screen title="Tell us about the stump">
                <p className="mb-3 text-center text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Diameter</p>
                <Stepper
                  value={inputs.stumpDiameterInches ?? 14}
                  unit="inches"
                  min={4}
                  max={60}
                  presets={[8, 14, 20, 30]}
                  onChange={(n) => setInput("stumpDiameterInches", n)}
                />
                <div className="mt-8 border-t border-line pt-7">
                  <p className="mb-3 text-center text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    How many stumps
                  </p>
                  <Stepper
                    value={inputs.stumpCount ?? 1}
                    unit="stumps"
                    min={1}
                    max={20}
                    presets={[1, 2, 3, 5]}
                    onChange={(n) => setInput("stumpCount", n)}
                  />
                </div>
              </Screen>
            )}

            {screen === "plan" && program && tierQuotes && (
              <Screen title="Choose your plan" help={summarizeInputs(program, inputs)}>
                <div className="space-y-2.5">
                  {program.tiers.map((t) => (
                    <TierRow
                      key={t.level}
                      tier={t}
                      quote={tierQuotes[t.level]}
                      selected={tier === t.level}
                      expanded={openTier === t.level}
                      onSelect={() => setTier(t.level)}
                      onToggle={() => setOpenTier(openTier === t.level ? null : t.level)}
                    />
                  ))}
                </div>
                {planQuote?.autoRenews && (
                  <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-orange-deep">
                    <RefreshCw className="h-3.5 w-3.5" /> Renews annually · cancel anytime
                  </p>
                )}
                <Disclaimer text={PRICING_DISCLAIMER} />
              </Screen>
            )}

            {screen === "estimate" && treeEstimate && (
              <Screen title="Your estimated range">
                <Band
                  price={bandText(treeEstimate.estimate)}
                  lines={[
                    ...treeEstimate.lines.map((l) => `${l.label} — ${bandText(l.band)}`),
                    // A floored price is a suspiciously round number unless you say
                    // why it's round. The model already wrote the sentence.
                    ...(treeEstimate.minimumApplied
                      ? treeEstimate.factors.filter((f) => /minimum for a tree job/i.test(f))
                      : []),
                  ]}
                />
                {/* In California this outranks the price. A customer who books a
                    removal without knowing the city has to approve it — and can
                    refuse — has been sold a problem, not a service. */}
                {treeEstimate.permit?.isProtected && (
                  <ProtectedTreePanel permit={treeEstimate.permit} />
                )}

                {treeEstimate.needsArboristBecause.length > 0 && (
                  <div className="mt-3 rounded-[14px] bg-white p-5">
                    <p className="eyebrow mb-2.5">Only an arborist can judge this on site</p>
                    <ul className="space-y-1.5">
                      {treeEstimate.needsArboristBecause.map((n) => (
                        <li key={n} className="flex items-start gap-2 text-[13px] font-semibold text-navy">
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {treeEstimate.upsell && (
                  <p className="mt-3 flex items-start gap-2.5 rounded-[14px] bg-white p-5 text-[13px] leading-relaxed text-body">
                    <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
                    <span>{treeEstimate.upsell}</span>
                  </p>
                )}

                {/* Asked next to the number, because the number is what makes
                    somebody want to hear about financing. Ticking it changes
                    nothing about the price — it tells the arborist to bring it up. */}
                <FinancingToggle checked={financing} onToggle={() => setFinancing(!financing)} />

                <Disclaimer text={treeEstimate.disclaimer} />
              </Screen>
            )}

            {screen === "estimate" && stumpQuote && (
              <Screen title="Your estimate">
                <Band price={bandText(stumpQuote.estimate)} eyebrow="One-time job" lines={stumpQuote.lines} />
                <Disclaimer text={stumpQuote.disclaimer} />
              </Screen>
            )}

            {screen === "visit" && (
              <Screen
                title="How would you like to meet?"
                help="Both are free, and both end with a written plan and a firm price."
              >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {([
                    {
                      value: "in_person" as const,
                      icon: MapPin,
                      label: "On-site visit",
                      detail: "An arborist walks the property, measures, and inspects what can't be seen from a photo.",
                      note: "3-hour arrival window",
                    },
                    {
                      value: "video" as const,
                      icon: Video,
                      label: "Video consultation",
                      detail: "Walk an arborist around your yard on a call. Fastest way to get a plan.",
                      note: "30 minutes · usually sooner",
                    },
                  ]).map((o) => {
                    const selected = visitType === o.value
                    const Icon = o.icon
                    return (
                      <button
                        key={o.value}
                        onClick={() => { chooseVisit(o.value); chose() }}
                        aria-pressed={selected}
                        // A <button> vertically centers its content, which floats the
                        // shorter card's text out of line with the taller one. Be explicit.
                        className={`flex h-full flex-col items-start rounded-xl border-2 p-5 text-left transition-all ${
                          selected ? "border-orange bg-brand-select" : "border-transparent bg-white hover:border-[#c7d6ca]"
                        }`}
                      >
                        <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${
                          selected ? "bg-orange text-white" : "bg-sky text-navy"
                        }`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className={`block text-[15.5px] font-bold ${selected ? "text-orange-deep" : "text-navy"}`}>
                          {o.label}
                        </span>
                        <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground">{o.detail}</span>
                        {/* Pinned to the card floor so the two notes line up even
                            when one blurb wraps to an extra line. */}
                        <span className="mt-auto pt-2.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-navy/50">
                          {o.note}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Screen>
            )}

            {screen === "schedule" && visitType && (
              <Screen
                title={visitType === "video" ? "Pick a time for your call" : "Request a visit"}
                help={
                  visitType === "video"
                    ? "We'll email you a video link. Reschedule any time."
                    : "Pick a day and an arrival window. We'll confirm by text the morning of."
                }
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button" aria-label="Earlier dates"
                    onClick={() => setWeekStart(Math.max(0, weekStart - 5))} disabled={weekStart === 0}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-line bg-white text-navy transition-colors hover:border-[#c7d6ca] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="grid flex-1 grid-cols-5 gap-2">
                    {dates.slice(weekStart, weekStart + 5).map((d) => {
                      const selected = date !== null && isSameDay(d, date)
                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          onClick={() => setDate(d)}
                          aria-pressed={selected}
                          className={`flex flex-col items-center rounded-xl border-2 px-1 py-3 transition-all ${
                            selected ? "border-navy bg-navy" : "border-transparent bg-white hover:border-[#c7d6ca]"
                          }`}
                        >
                          <span className={`text-[10.5px] font-bold uppercase tracking-[0.08em] ${selected ? "text-[#b6cdbd]" : "text-muted-foreground"}`}>
                            {d.toLocaleDateString("en-US", { weekday: "short" })}
                          </span>
                          <span className={`my-0.5 text-[21px] font-extrabold ${selected ? "text-white" : "text-navy"}`}>
                            {d.getDate()}
                          </span>
                          <span className={`text-[10.5px] ${selected ? "text-[#b6cdbd]" : "text-muted-foreground"}`}>
                            {d.toLocaleDateString("en-US", { month: "short" })}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button" aria-label="Later dates"
                    onClick={() => setWeekStart(Math.min(dates.length - 5, weekStart + 5))}
                    disabled={weekStart + 5 >= dates.length}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-line bg-white text-navy transition-colors hover:border-[#c7d6ca] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* The slot list is the visit type made visible: arrival windows
                    for a truck, start times for a call. */}
                {date && (
                  <div className="mt-7">
                    <p className="mb-3 text-center text-[13px] font-semibold text-navy">
                      {visitType === "video" ? "Start time" : "Arrival window"} on{" "}
                      {date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </p>
                    <div className={`grid gap-2.5 ${visitType === "video" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
                      {slots.map((s) => {
                        const selected = slotId === s.id
                        return (
                          <button
                            key={s.id}
                            type="button"
                            // The slot is the last thing this screen needs — a day
                            // was already chosen to get here. Picking it completes
                            // the screen, so the screen moves on.
                            onClick={() => { setSlotId(s.id); chose() }}
                            aria-pressed={selected}
                            className={`rounded-xl border-2 px-3 py-3 text-center transition-all ${
                              selected ? "border-orange bg-brand-select" : "border-transparent bg-white hover:border-[#c7d6ca]"
                            }`}
                          >
                            <p className={`text-[14px] font-bold ${selected ? "text-orange-deep" : "text-navy"}`}>{s.label}</p>
                            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{s.time}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Screen>
            )}

            {screen === "contact" && (
              <Screen title="Enter your contact info">
                {/* No estimate on this path — say what happens next instead of
                    implying a price we never gave them. */}
                {!planQuote && !treeEstimate && !stumpQuote && (
                  <p className="-mt-2 mb-5 text-center text-[13px] text-body">
                    A certified arborist will scope this on site and follow up with a firm price.
                  </p>
                )}

                <fieldset className="mb-5">
                  <legend className="mb-2.5 w-full text-center text-[13.5px] font-semibold text-navy">I am interested in:</legend>
                  <div className="flex justify-center gap-6">
                    {[
                      { value: "residential", label: "Residential Services" },
                      { value: "commercial", label: "Commercial Services" },
                    ].map((o) => (
                      <label key={o.value} className="flex cursor-pointer items-center gap-2 text-[13.5px] text-body">
                        <input
                          type="radio"
                          name="audience"
                          checked={contact.audience === o.value}
                          onChange={() => setContact((p) => ({ ...p, audience: o.value }))}
                          className="h-4 w-4 accent-orange"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field placeholder="First name" value={contact.firstName} onChange={(v) => setContact((p) => ({ ...p, firstName: v }))} />
                    <Field placeholder="Last name" value={contact.lastName} onChange={(v) => setContact((p) => ({ ...p, lastName: v }))} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field type="email" placeholder="Email" value={contact.email} onChange={(v) => setContact((p) => ({ ...p, email: v }))} />
                    <Field type="tel" placeholder="Phone number" value={contact.phone} onChange={(v) => setContact((p) => ({ ...p, phone: v }))} />
                  </div>
                  <Field placeholder="Property address" value={contact.address} onChange={(v) => setContact((p) => ({ ...p, address: v }))} />
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={contact.sms}
                    onChange={(e) => setContact((p) => ({ ...p, sms: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-orange"
                  />
                  Yes, send me text updates from SavATree about my service. Message frequency varies. Reply STOP to opt out.
                </label>
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  By submitting this form, you&apos;re giving SavATree permission to reach out about your inquiry,
                  appointments, and service. We&apos;ll never share your personal information with third parties for
                  marketing purposes, and consent isn&apos;t a condition of purchase.
                </p>
              </Screen>
            )}
          </div>

          {/* Emergency owns its own CTA — a Next button under a dispatch number
              would invite the customer to keep filling out a form. */}
          {screen !== "emergency" && (
            <div className="mt-8 flex items-center gap-3">
              {step > 0 && (
                <button onClick={back} className="btn-pill flex-1 border-2 border-navy/20 bg-white text-navy hover:border-navy/40">
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
              )}
              <button onClick={next} disabled={!canAdvance} className="btn-orange flex-[2]">
                {isLast
                  ? visitType === "video" ? "Book my video call" : "Request my visit"
                  : "Next"}
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Chrome ───────────────────────────────────────────────────────────────────

function Rail({ phases, active }: { phases: Phase[]; active: Phase }) {
  const activeIndex = phases.indexOf(active)
  return (
    <div className="flex items-start">
      {phases.map((phase, i) => {
        const done = i < activeIndex
        const current = i === activeIndex
        return (
          <div key={phase} className="flex flex-1 items-start last:flex-none">
            {/* The rail is the widest fixed thing in the card, so it sets the
                floor on how narrow a host column can get. Keep the labels
                shrinkable. */}
            <div className="flex w-[52px] shrink-0 flex-col items-center gap-2 sm:w-16">
              <span
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-colors ${
                  done ? "border-orange bg-orange text-white"
                  : current ? "border-orange bg-white"
                  : "border-navy/30 bg-white"
                }`}
              >
                {done && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
              </span>
              <span
                className={`text-[9px] font-extrabold uppercase tracking-[0.06em] sm:text-[10px] sm:tracking-[0.1em] ${
                  current || done ? "text-navy" : "text-navy/40"
                }`}
              >
                {phase}
              </span>
            </div>
            {i < phases.length - 1 && (
              <span className="mt-[8px] flex-1 border-t-2 border-dashed border-navy/30" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Screen({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="disp text-center text-navy text-[clamp(24px,4.4vw,32px)]">{title}</h2>
      {help && <p className="mx-auto mt-2 max-w-[42ch] text-center text-[13px] text-muted-foreground">{help}</p>}
      <div className="mt-7">{children}</div>
    </div>
  )
}

function Tag({ tone, inverted }: { tone: "urgent" | "instant" | "consult"; inverted: boolean }) {
  const copy = tone === "urgent" ? "Urgent" : tone === "instant" ? "Instant range" : "Consult"
  const Icon = tone === "urgent" ? AlertTriangle : tone === "instant" ? Sparkles : ClipboardCheck
  const tint = inverted
    ? "bg-white/15 text-white"
    : tone === "urgent" ? "bg-gold/25 text-navy"
    : tone === "instant" ? "bg-orange/12 text-orange-deep"
    : "bg-sky text-navy"
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.05em] ${tint}`}>
      <Icon className="h-3 w-3" />
      {copy}
    </span>
  )
}

/** Interest, not an application. Nothing here is priced, and nothing is promised. */
function FinancingToggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={checked}
      className={`mt-3 flex w-full items-start gap-3 rounded-[14px] border-2 p-5 text-left transition-all ${
        checked ? "border-orange bg-brand-select" : "border-transparent bg-white hover:border-[#c7d6ca]"
      }`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
        checked ? "border-orange bg-orange text-white" : "border-line bg-white"
      }`}>
        {checked ? <Check className="h-4 w-4" /> : null}
      </span>
      <span>
        <span className="block text-[15px] font-bold text-navy">I&apos;m interested in financing</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
          We&apos;ll have your arborist go over monthly payment options at the visit. No credit check to ask.
        </span>
      </span>
    </button>
  )
}

function Band({ price, eyebrow, lines }: { price: string; eyebrow?: string; lines: string[] }) {
  return (
    <div className="rounded-[16px] bg-white p-6 text-center shadow-brand-sm">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <p className={`${eyebrow ? "mt-2 " : ""}text-[clamp(30px,6vw,42px)] font-extrabold leading-none tracking-[-0.02em] text-navy`}>{price}</p>
      {lines.length > 0 && (
        <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-left">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-body">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Disclaimer({ text }: { text: string }) {
  return <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">{text}</p>
}

/**
 * A plan, with its receipts.
 *
 * Selection and disclosure are separate controls — a customer opening "what's
 * included" on the Premium plan has not decided to buy the Premium plan, and a
 * card that switches their selection when they ask a question is a card that
 * sells by accident.
 *
 * The expanded list is the treatment timeline: the visits that justify the
 * price. Treatments are never buyable (see savatree-catalog.ts) — they only ever
 * explain what the plan already contains.
 */
function TierRow({
  tier, quote, selected, expanded, onSelect, onToggle,
}: {
  tier: ProgramTier
  quote: ReturnType<typeof quoteProgram>
  selected: boolean
  expanded: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  const seasons = treatmentsBySeason(tier.treatments)
  const included = (tier.includedAddons ?? []).map(getAddon).filter(Boolean)

  return (
    <div
      className={`rounded-xl border-2 transition-all duration-150 ${
        selected ? "border-orange bg-brand-select shadow-brand-sm" : "border-transparent bg-white"
      }`}
    >
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className="w-full px-4 pt-4 pb-3 text-left"
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="flex items-center gap-2">
            <span className="text-[16px] font-bold text-navy">{tier.name}</span>
            {tier.popular && <span className="brand-badge">Most Popular</span>}
          </span>
          <span className="text-[19px] font-extrabold tabular-nums text-navy">
            {bandText(quote.annual)}
            <span className="text-[12px] font-semibold text-body">/yr</span>
          </span>
        </span>
        <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground">
          {tier.visitsPerYear} visits a year · ≈ ${money(quote.monthly.low)}–${money(quote.monthly.high)}/mo · {tier.tagline}
        </span>
      </button>

      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1 px-4 pb-3.5 text-[12px] font-bold text-orange-deep hover:underline"
      >
        {expanded ? "Hide details" : "See more details"}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mx-4 mb-4 rounded-lg bg-white/70 p-4">
          <div className="space-y-3">
            {seasons.map((group) => (
              <div key={group.season}>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((t) => (
                    <li key={t.name} className="flex items-start gap-2 text-[12.5px] leading-snug text-body">
                      <Leaf className="mt-[3px] h-3 w-3 shrink-0 text-orange" />
                      <span>
                        {t.name}
                        {t.note && <span className="block text-[11.5px] text-muted-foreground">{t.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {included.length > 0 && (
            <div className="mt-3.5 border-t border-line pt-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Included free
              </p>
              <ul className="space-y-1">
                {included.map((a) => (
                  <li key={a!.id} className="flex items-start gap-2 text-[12.5px] font-semibold leading-snug text-orange-deep">
                    <Check className="mt-[3px] h-3 w-3 shrink-0" />
                    <span>{a!.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The early warning, shown on the species screen itself. Amber when the city can
 * refuse the job, calm green when the species is protected but this particular
 * job isn't in jeopardy — a pruning customer shouldn't be alarmed by a rule that
 * doesn't threaten them.
 */
function SpeciesNotice({ advisory }: { advisory: SpeciesAdvisory }) {
  const alarming = advisory.mayBeDenied
  return (
    <div
      className={`mt-5 rounded-[14px] border-2 p-5 ${
        alarming ? "border-gold/50 bg-gold/10" : "border-transparent bg-white"
      }`}
    >
      <p className="mb-2 flex items-start gap-2 text-[14px] font-bold leading-snug text-navy">
        {alarming
          ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
          : <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange" />}
        {advisory.headline}
      </p>
      <p className="text-[13px] leading-relaxed text-body">{advisory.body}</p>
    </div>
  )
}

/**
 * The California panel. Deliberately loud, and deliberately placed above the
 * "what an arborist must see" list: the permit is usually the longest pole in
 * the job, and "the city may say no" is not a footnote.
 */
function ProtectedTreePanel({ permit }: { permit: PermitAssessment }) {
  return (
    <div className="mt-3 rounded-[14px] border-2 border-gold/50 bg-gold/10 p-5">
      <p className="eyebrow mb-2.5 flex items-center gap-1.5 text-navy">
        <ShieldAlert className="h-4 w-4 text-gold-deep" />
        {permit.basis === "unidentified" ? "This tree may be protected" : "Protected tree"}
      </p>

      <ul className="space-y-2">
        {permit.reasons.map((r) => (
          <li key={r} className="text-[13px] leading-relaxed text-navy">{r}</li>
        ))}
      </ul>

      {permit.weeks && (
        <p className="mt-3.5 flex items-center gap-2 border-t border-gold/30 pt-3.5 text-[13px] font-semibold text-navy">
          <CalendarClock className="h-4 w-4 shrink-0 text-gold-deep" />
          {permit.weeks[0] === 0
            ? `Expect ${permit.weeks[1]} weeks or less for city sign-off`
            : `Expect ${permit.weeks[0]}–${permit.weeks[1]} weeks for city review`}
          {permit.mayBeDenied && " — and it can be refused"}
        </p>
      )}

      {/* Say who's getting the money. It isn't us. */}
      {permit.cost && permit.cost.high > 0 && (
        <p className="mt-2 text-[12px] leading-relaxed text-body">
          The permit, report, and replacement planting above are the city&apos;s costs, not
          SavATree&apos;s. We prepare the report and file the application for you.
        </p>
      )}
    </div>
  )
}

/** The branch's own number — a fallen limb in San Jose is not a national call. */
function Emergency({ phone }: { phone: string }) {
  return (
    <div className="text-center">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/25">
        <AlertTriangle className="h-7 w-7 text-gold-deep" />
      </span>
      <h2 className="disp text-navy text-[clamp(24px,4.4vw,32px)]">This is an emergency</h2>
      <p className="mx-auto mt-3 max-w-[38ch] text-[14px] text-body">
        Skip the estimate — we&apos;ll get a crew dispatched and price the work on site.
      </p>
      <a href={`tel:${phone.replace(/[^\d]/g, "")}`} className="btn-orange mt-6 w-full sm:w-auto">
        <Phone className="h-5 w-5" />
        {phone}
      </a>
    </div>
  )
}

function Confirmation({
  contact, phone, visitType, date, slot, summary, financing,
}: {
  contact: { firstName: string; email: string; address: string }
  phone: string
  visitType: VisitType | null
  date: Date | null
  slot: TimeSlot | null
  summary: string | null
  financing: boolean
}) {
  const video = visitType === "video"
  return (
    <div className="py-6 text-center">
      <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-orange text-white">
        <Check className="h-7 w-7" strokeWidth={3} />
      </span>
      <h2 className="disp text-navy text-[clamp(26px,4.4vw,34px)]">
        You&apos;re booked{contact.firstName ? `, ${contact.firstName}` : ""}
      </h2>
      <p className="mx-auto mt-3 max-w-[44ch] text-[14px] text-body">
        {video
          ? <>We&apos;ll email a video link to {contact.email || "you"} before the call. An ISA Certified Arborist will walk your property with you on camera.</>
          : <>An ISA Certified Arborist will walk {contact.address || "your property"} and confirm your plan and pricing on site.</>}
      </p>

      {/* The appointment is the product now. Lead with it; the estimate is
          supporting evidence. */}
      {date && slot && (
        <div className="mx-auto mt-6 max-w-[34ch] rounded-[14px] bg-white p-5">
          <p className="eyebrow flex items-center justify-center gap-1.5">
            {video ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {video ? "Video consultation" : "On-site visit"}
          </p>
          <p className="mt-2 text-[17px] font-bold leading-snug text-navy">{formatVisitDate(date)}</p>
          <p className="text-[13.5px] text-body">
            {slot.label} · {slot.time}
          </p>
          {summary && (
            <div className="mt-4 border-t border-line pt-3.5">
              <p className="eyebrow">Your estimate</p>
              <p className="mt-1 text-[19px] font-extrabold text-navy">{summary}</p>
            </div>
          )}
        </div>
      )}

      {financing && (
        <p className="mx-auto mt-4 flex max-w-[40ch] items-start justify-center gap-2 text-[13px] font-semibold text-orange-deep">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Your arborist will go over monthly payment options at the visit.</span>
        </p>
      )}

      <p className="mt-6 text-[13px] text-muted-foreground">
        Need to change it?{" "}
        <a href={`tel:${phone.replace(/[^\d]/g, "")}`} className="font-bold text-orange-deep hover:underline">
          {phone}
        </a>
      </p>
    </div>
  )
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

function Field({
  value, onChange, placeholder, type = "text",
}: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-line bg-white px-4 py-3 text-[14.5px] text-navy placeholder:text-muted-foreground focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/25"
    />
  )
}

function Stepper({
  value, unit, min, max, presets, onChange,
}: { value: number; unit?: string; min: number; max: number; presets: number[]; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="mx-auto max-w-sm">
      <div className="flex items-center justify-center gap-5">
        <button
          type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(clamp(value - 1))}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-navy transition-colors hover:border-orange/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-5 w-5" />
        </button>
        <div className="flex w-36 flex-col items-center">
          <span className="text-[42px] font-extrabold leading-none tabular-nums text-navy">{value}</span>
          {unit && <span className="mt-1.5 text-center text-[13px] text-muted-foreground">{unit}</span>}
        </div>
        <button
          type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(clamp(value + 1))}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-navy transition-colors hover:border-orange/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {presets.length > 0 && (
        <div className="mt-6 flex justify-center gap-2">
          {presets.map((p) => (
            <button
              key={p} type="button" onClick={() => onChange(p)}
              className={`w-12 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                value === p ? "border-orange bg-orange/10 text-orange-deep" : "border-line bg-white text-navy hover:border-orange/40"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Measure({
  value, min, max, step, unit, onChange,
}: { value: number; min: number; max: number; step: number; unit: string; onChange: (n: number) => void }) {
  const v = Math.min(Math.max(value || min, min), max)
  return (
    <div className="mx-auto max-w-md">
      <div className="flex items-baseline justify-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={value ? value.toLocaleString() : ""}
          aria-label={`Size in ${unit}`}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value.replace(/[^\d]/g, ""), 10)
            onChange(Number.isNaN(n) ? 0 : n)
          }}
          onBlur={() => { if (!value || value < min) onChange(min) }}
          className="w-40 border-b-2 border-line bg-transparent text-center text-[32px] font-extrabold tabular-nums text-navy transition-colors focus:border-orange focus:outline-none"
        />
        <span className="text-sm font-semibold text-muted-foreground">{unit}</span>
      </div>
      <SliderPrimitive.Root
        className="relative mt-7 flex w-full touch-none select-none items-center"
        min={min} max={max} step={step} value={[v]}
        onValueChange={([n]) => onChange(n)}
        aria-label={`Size in ${unit}`}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow rounded-full bg-white">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-orange" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="relative z-10 block h-6 w-6 cursor-grab rounded-full border-2 border-orange bg-white shadow-brand-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 active:cursor-grabbing" />
      </SliderPrimitive.Root>
      <div className="mt-2.5 flex justify-between text-[11.5px] font-medium text-muted-foreground">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}+</span>
      </div>
    </div>
  )
}

function Choices<T extends string>({
  choices, value, onChange, columns,
}: {
  choices: readonly { value: T; label: string; detail: string }[]
  value: T
  onChange: (v: T) => void
  columns?: number
}) {
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${columns ?? choices.length}, minmax(0, 1fr))` }}
    >
      {choices.map((c) => {
        const selected = value === c.value
        return (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            aria-pressed={selected}
            className={`rounded-xl border-2 px-3 py-3.5 text-center transition-all ${
              selected ? "border-orange bg-brand-select" : "border-transparent bg-white hover:border-[#c7d6ca]"
            }`}
          >
            <p className={`text-[14px] font-bold ${selected ? "text-orange-deep" : "text-navy"}`}>{c.label}</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{c.detail}</p>
          </button>
        )
      })}
    </div>
  )
}

function Toggle({
  checked, onChange, label, detail,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; detail: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
        checked ? "border-orange bg-brand-select" : "border-transparent bg-white hover:border-[#c7d6ca]"
      }`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
        checked ? "border-orange bg-orange text-white" : "border-line bg-white"
      }`}>
        {checked && <Check className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-[14.5px] font-semibold text-navy">{label}</span>
        <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
}
