"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft, Check, MapPin, AlertCircle, Loader2, LocateFixed,
  ChevronLeft, ChevronRight, CalendarDays, RefreshCw, Minus, Plus, BadgeCheck,
} from "lucide-react"
import { addonsForProgram, money } from "@/lib/savatree-services"
import { getProgram, type TierLevel, type Addon } from "@/lib/savatree-catalog"
import {
  ARRIVAL_WINDOWS as TIME_SLOTS,
  getAvailableDates,
  isSameDay,
  formatVisitDate,
} from "@/lib/scheduling"

// ─── Component ───────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const searchParams = useSearchParams()

  // The quote, as handed over from the estimator.
  const [quote, setQuote] = useState({
    kind: "program",
    id: "",
    name: "Program",
    vertical: "",
    tier: "",
    tierName: "",
    visits: "",
    low: 0,
    high: 0,
    monthlyLow: 0,
    monthlyHigh: 0,
    autoRenews: false,
    summary: "",
    addOns: [] as string[],
    lines: [] as string[],
    notes: [] as string[], // what only an arborist can judge on site
    confidence: "",
    financing: false, // customer asked to hear about payment options
  })

  const [serviceAddress, setServiceAddress] = useState("")
  const [addressInput, setAddressInput] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [isLookingUpAddress, setIsLookingUpAddress] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isGeolocating, setIsGeolocating] = useState(false)
  const [addressNotRecognized, setAddressNotRecognized] = useState(false)
  const [extraAddOns, setExtraAddOns] = useState<string[]>([]) // add-on ids
  const [addOnCounts, setAddOnCounts] = useState<Record<string, number>>({})
  const [customerInfo, setCustomerInfo] = useState({ firstName: "", lastName: "", email: "" })
  const [phoneNumber, setPhoneNumber] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("")
  const [calendarWeekStart, setCalendarWeekStart] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const hasInit = useRef(false)

  const availableDates = useMemo(() => getAvailableDates(), [])

  const mockAddresses = useMemo(() => [
    "12 Maple Avenue, Bedford, NY 10506",
    "88 Chestnut Hill Rd, Wilton, CT 06897",
    "245 Old Forge Lane, Wayne, PA 19087",
    "17 Birchwood Drive, Summit, NJ 07901",
    "540 Elm Street, Concord, MA 01742",
  ], [])

  const isProgram = quote.kind === "program"
  // "Skip to booking" — no plan, no estimate, just get an arborist to the property.
  const isVisit = quote.kind === "visit"
  // A tree job too big or too hazardous to book blind: we quote a range, then the
  // arborist confirms the number before any work begins.
  const isAssessment = quote.kind === "assessment"

  // Anything eligible for this program the customer doesn't already have — neither
  // picked in the estimator nor bundled free at their tier. Never re-sell what the
  // plan already includes.
  const upsellAddOns = useMemo(() => {
    if (!isProgram || !quote.id) return []
    const program = getProgram(quote.id)
    const tier = program?.tiers.find((t) => t.level === (quote.tier as TierLevel))
    const included = new Set(tier?.includedAddons ?? [])
    const taken = new Set(quote.addOns)
    return addonsForProgram(quote.id).filter((a) => !included.has(a.id) && !taken.has(a.name))
  }, [isProgram, quote.id, quote.tier, quote.addOns])

  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    if (hasInit.current) return
    hasInit.current = true
    const get = (k: string) => searchParams.get(k) || ""
    const num = (k: string) => Number.parseInt(get(k) || "0", 10) || 0
    const list = (k: string) => get(k).split(" | ").map((s) => s.trim()).filter(Boolean)

    setQuote({
      kind: get("kind") || "program",
      id: get("id"),
      name: get("name") || "Program",
      vertical: get("vertical"),
      tier: get("tier"),
      tierName: get("tierName"),
      visits: get("visits"),
      low: num("low"),
      high: num("high"),
      monthlyLow: num("monthlyLow"),
      monthlyHigh: num("monthlyHigh"),
      autoRenews: get("autoRenews") === "true",
      summary: get("summary"),
      addOns: list("addOns"),
      lines: list("lines"),
      notes: list("notes"),
      confidence: get("confidence"),
      financing: get("financing") === "true",
    })

    const addr = get("address")
    if (addr) { setServiceAddress(addr); setAddressInput(addr) }
  }, [searchParams])

  useEffect(() => {
    const exact = mockAddresses.some((a) => a.toLowerCase() === addressInput.toLowerCase())
    if (addressInput.length >= 3 && !exact) {
      const filtered = mockAddresses.filter((a) => a.toLowerCase().includes(addressInput.toLowerCase()))
      setAddressSuggestions(filtered.length > 0 ? filtered : mockAddresses.slice(0, 5))
      setShowSuggestions(true)
    } else {
      setAddressSuggestions([])
      setShowSuggestions(false)
    }
  }, [addressInput, mockAddresses])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleAddressLookup = useCallback(async (address: string) => {
    if (!address.trim()) return
    setIsLookingUpAddress(true); setAddressNotRecognized(false)
    await new Promise((r) => setTimeout(r, 1000))
    const recognized = mockAddresses.some((s) => s.toLowerCase() === address.toLowerCase())
    setServiceAddress(address)
    setAddressNotRecognized(!recognized)
    setIsLookingUpAddress(false)
  }, [mockAddresses])

  const handleGeolocation = useCallback(async () => {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return }
    setIsGeolocating(true)
    try { await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })) } catch {}
    await new Promise((r) => setTimeout(r, 500))
    const addr = mockAddresses[0]
    setAddressInput(addr); setShowSuggestions(false); handleAddressLookup(addr)
    setIsGeolocating(false)
  }, [handleAddressLookup, mockAddresses])

  const handleSelectSuggestion = useCallback((s: string) => {
    setShowSuggestions(false); setAddressSuggestions([]); setAddressInput(s); handleAddressLookup(s)
  }, [handleAddressLookup])

  const toggleExtra = useCallback((id: string) => {
    setExtraAddOns((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id])
  }, [])

  const setAddOnCount = useCallback((id: string, n: number) => {
    setAddOnCounts((prev) => ({ ...prev, [id]: n }))
  }, [])

  /** "Emerald Ash Borer Protection (2 ash trees)" — the count rides along to the arborist. */
  const addOnLabel = useCallback((addon: Addon) => {
    const subset = addon.plantSubset
    if (!subset) return addon.name
    const n = addOnCounts[addon.id] ?? subset.default
    const unit = n === 1 ? subset.unit.replace(/s$/, "") : subset.unit
    return `${addon.name} (${n} ${unit})`
  }, [addOnCounts])

  /** Selected add-ons as human labels, counts folded in. */
  const extraAddOnLabels = useMemo(
    () => upsellAddOns.filter((a) => extraAddOns.includes(a.id)).map(addOnLabel),
    [upsellAddOns, extraAddOns, addOnLabel],
  )

  const priceText = quote.high !== quote.low ? `$${money(quote.low)} – $${money(quote.high)}` : `$${money(quote.low)}`
  const suffix = isProgram ? "/yr" : ""
  const canBook = customerInfo.firstName && customerInfo.lastName && customerInfo.email && phoneNumber.trim() && selectedDate && selectedTimeSlot && serviceAddress

  const handleBook = useCallback(async () => {
    setIsLoading(true)
    await new Promise((r) => setTimeout(r, 1300))
    const visitSlot = TIME_SLOTS.find((s) => s.id === selectedTimeSlot)
    const params = new URLSearchParams({
      kind: quote.kind,
      id: quote.id,
      name: quote.name,
      tierName: quote.tierName,
      visits: quote.visits,
      low: String(quote.low),
      high: String(quote.high),
      monthlyLow: String(quote.monthlyLow),
      monthlyHigh: String(quote.monthlyHigh),
      autoRenews: String(quote.autoRenews),
      summary: quote.summary,
      lines: quote.lines.join(" | "),
      notes: quote.notes.join(" | "),
      confidence: quote.confidence,
      financing: String(quote.financing),
      addOns: [...quote.addOns, ...extraAddOnLabels].join(" | "),
      address: [serviceAddress, addressLine2.trim()].filter(Boolean).join(", "),
      customerName: `${customerInfo.firstName} ${customerInfo.lastName}`.trim(),
      customerEmail: customerInfo.email,
      phone: phoneNumber,
      visitDate: selectedDate ? formatVisitDate(selectedDate) : "",
      visitTime: visitSlot ? visitSlot.time : "",
    })
    window.location.href = `/checkout/confirmation?${params.toString()}`
  }, [quote, extraAddOnLabels, serviceAddress, addressLine2, customerInfo, phoneNumber, selectedDate, selectedTimeSlot])

  const visibleDates = availableDates.slice(calendarWeekStart, calendarWeekStart + 5)
  const canGoBack = calendarWeekStart > 0
  const canGoForward = calendarWeekStart + 5 < availableDates.length

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-orange-deep hover:text-orange mb-5 text-sm font-bold transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {isVisit ? "Back to home" : "Back to estimate"}
          </Link>
          <h1 className="disp text-navy text-[clamp(34px,5vw,52px)] text-center">
            {isVisit
              ? "Book an Arborist Visit"
              : isAssessment
              ? "Book Your Free Assessment"
              : isProgram
              ? "Enroll in Your Plan"
              : "Schedule Your Service"}
          </h1>
        </div>

        <div className="max-w-2xl mx-auto space-y-5">
          {/* Skipped the estimator — there's no plan yet, so promise the visit, not a price. */}
          {isVisit ? (
            <Card className="rounded-[16px] border-line shadow-brand-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-display font-semibold text-navy text-[22px]">Your Free Arborist Visit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-brand-band border border-[#dbe7dd] p-6 rounded-[14px]">
                  <p className="text-[15px] text-body">
                    No estimate needed. An ISA Certified Arborist walks your property, listens to what you
                    care about, and designs a plan around what they find — trees, lawn, pests, and all.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {[
                      "A credentialed arborist assesses your property in person",
                      "You get a written plan and pricing built for your yard",
                      "No obligation — nothing is booked until you say so",
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2 text-[13.5px] text-body">
                        <BadgeCheck className="h-4 w-4 text-orange mt-0.5 shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11.5px] text-muted-foreground mt-4 italic">
                    Prefer to see numbers first?{" "}
                    <Link href="/" className="font-semibold text-orange-deep hover:underline not-italic">Build a plan instead</Link>.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card className="rounded-[16px] border-line shadow-brand-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display font-semibold text-navy text-[22px]">
                {isProgram ? "Your Plan" : isAssessment ? "Your Estimated Range" : "Your Service"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-brand-band border border-[#dbe7dd] p-6 rounded-[14px]">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                  <h3 className="text-[19px] font-semibold text-navy">{quote.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-orange-deep">{priceText}</span>
                    {suffix && <span className="text-body text-[13px] font-semibold">{suffix}</span>}
                  </div>
                </div>

                {/* Never let a range read as a firm price. */}
                {isAssessment && (
                  <p className="text-[13px] font-semibold text-navy">
                    Estimated range — not a firm price. Your arborist confirms the number before any work begins.
                  </p>
                )}

                {isProgram && quote.tierName && (
                  <p className="text-[13.5px] text-body">
                    {quote.tierName}
                    {quote.visits && ` · ${quote.visits} visits a year`}
                    {quote.monthlyHigh > 0 && ` · ≈ $${money(quote.monthlyLow)}–$${money(quote.monthlyHigh)}/mo`}
                  </p>
                )}
                {quote.summary && <p className="text-[13.5px] text-body mt-1.5">{quote.summary}</p>}

                {quote.lines.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {quote.lines.map((li, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[13px] text-body">
                        <Check className="h-3.5 w-3.5 text-orange mt-0.5 shrink-0" />
                        <span>{li}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* The band is wide for reasons. Name them — it's what the visit is for. */}
                {quote.notes.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#dbe7dd]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                      What your arborist will confirm on site
                    </p>
                    <ul className="space-y-1.5">
                      {quote.notes.map((n, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-navy font-semibold">
                          <BadgeCheck className="h-4 w-4 text-orange mt-0.5 shrink-0" />
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {quote.autoRenews && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-orange-deep">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Renews automatically each year · cancel anytime
                  </p>
                )}
                {/* They ticked it on the estimate. Show it back to them so it's
                    clearly on the record, not swallowed by the handoff. */}
                {quote.financing && (
                  <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold text-orange-deep">
                    <BadgeCheck className="h-4 w-4 shrink-0 mt-px" />
                    Financing requested — your arborist will go over monthly payment options at the visit.
                  </p>
                )}
                <p className="text-[11.5px] text-muted-foreground mt-3 italic">
                  Final pricing confirmed after your arborist&apos;s on-site assessment.
                </p>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Add-on upsell — only ever offered against a program, never standalone. */}
          {upsellAddOns.length > 0 && (
            <Card className="rounded-[16px] border-line shadow-brand-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-display font-semibold text-navy text-[22px]">Add to Your Plan (Optional)</CardTitle>
                <p className="text-[13px] text-muted-foreground mt-2">
                  Common additions for a property like yours. Pricing is confirmed at your assessment.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upsellAddOns.map((addOn) => {
                    const checked = extraAddOns.includes(addOn.id)
                    const subset = addOn.plantSubset
                    const count = subset ? addOnCounts[addOn.id] ?? subset.default : 0
                    return (
                      <div key={addOn.id}
                        className={`border-2 rounded-[14px] transition-all duration-150 ${checked ? "border-orange bg-brand-select" : "border-line hover:border-[#c7d6ca]"}`}>
                        {/* The whole row toggles — a 16px checkbox is a mean click target. */}
                        <button type="button" onClick={() => toggleExtra(addOn.id)} aria-pressed={checked}
                          className="flex w-full items-start p-[18px] text-left">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 shrink-0 mt-0.5 ${checked ? "border-orange bg-orange text-white" : "border-line bg-white"}`}>
                            {checked ? <Check className="h-4 w-4" /> : null}
                          </span>
                          <span className="ml-3 flex-1">
                            <span className="block font-semibold text-navy text-[15.5px]">{addOn.name}</span>
                            <span className="block text-[13px] text-muted-foreground mt-1">{addOn.blurb}</span>
                          </span>
                        </button>

                        {/* Subset add-ons treat only some of the plants (EAB → ash trees).
                            Ask how many so the arborist arrives with the right scope. */}
                        {checked && subset && (
                          <div className="mx-[18px] mb-[18px] ml-[54px] flex flex-wrap items-center gap-3 rounded-xl border border-line-soft bg-white/70 px-4 py-3">
                            <span className="text-[13.5px] font-semibold text-navy">{subset.label}</span>
                            <div className="flex items-center gap-2 ml-auto">
                              <button type="button" aria-label={`Fewer ${subset.unit}`} onClick={() => setAddOnCount(addOn.id, Math.max(1, count - 1))} disabled={count <= 1}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-8 text-center text-[18px] font-extrabold text-navy tabular-nums">{count}</span>
                              <button type="button" aria-label={`More ${subset.unit}`} onClick={() => setAddOnCount(addOn.id, Math.min(subset.max, count + 1))} disabled={count >= subset.max}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-navy hover:border-orange/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Personal Info + Service Address */}
          <Card className="rounded-[16px] border-line shadow-brand-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display font-semibold text-navy text-[22px]">Your Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" value={customerInfo.firstName} onChange={(e) => setCustomerInfo((p) => ({ ...p, firstName: e.target.value }))} placeholder="Jane" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" value={customerInfo.lastName} onChange={(e) => setCustomerInfo((p) => ({ ...p, lastName: e.target.value }))} placeholder="Doe" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo((p) => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="phone">Mobile Number *</Label>
                  <Input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="(555) 123-4567" className="mt-1" />
                </div>

                <div>
                  <Label>Property Address *</Label>
                  <div className="flex gap-3 mt-1" ref={suggestionRef}>
                    <div className="relative flex-1">
                      <div className="relative">
                        <button type="button" onClick={handleGeolocation} disabled={isGeolocating}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-orange transition-colors disabled:opacity-50">
                          {isGeolocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                        </button>
                        <Input value={addressInput} onChange={(e) => setAddressInput(e.target.value)} placeholder="Enter your property address" className="pl-10"
                          onKeyDown={(e) => { if (e.key === "Enter") { setShowSuggestions(false); handleAddressLookup(addressInput) } }} />
                      </div>
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {addressSuggestions.map((s, i) => (
                            <button key={i} type="button" onClick={() => handleSelectSuggestion(s)}
                              className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-2 text-sm border-b last:border-b-0">
                              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />{s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Unit, gate code, or access notes (optional)" className="mt-2" />
                  {isLookingUpAddress && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-orange-deep"><Loader2 className="h-4 w-4 animate-spin" />Looking up your address...</div>
                  )}
                  {addressNotRecognized && !isLookingUpAddress && (
                    <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground">Couldn&apos;t verify this address. Our arborist will confirm it on site.</p>
                    </div>
                  )}
                  {serviceAddress && !isLookingUpAddress && !addressNotRecognized && (
                    <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /><p className="text-sm text-foreground">Address verified.</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Visit */}
          <Card className="rounded-[16px] border-line shadow-brand-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display font-semibold text-navy text-[22px] flex items-center gap-2.5">
                <CalendarDays className="h-5 w-5 text-orange" />
                Request Your First Visit
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                A certified arborist walks the property, confirms your plan, and schedules the season&apos;s visits.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Request a date</Label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setCalendarWeekStart(Math.max(0, calendarWeekStart - 5))} disabled={!canGoBack}
                      className="flex items-center justify-center w-10 h-10 shrink-0 rounded-[10px] border-[1.5px] border-line text-navy hover:border-[#c7d6ca] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex-1 grid grid-cols-5 gap-2">
                      {visibleDates.map((date) => {
                        const isSelected = selectedDate && isSameDay(date, selectedDate)
                        return (
                          <button key={date.toISOString()} type="button" onClick={() => setSelectedDate(date)}
                            className={`flex flex-col items-center py-3 px-1 rounded-xl border-2 text-center transition-all ${isSelected ? "border-navy bg-navy" : "border-line hover:border-[#c7d6ca]"}`}>
                            <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${isSelected ? "text-[#b6cdbd]" : "text-muted-foreground"}`}>
                              {date.toLocaleDateString("en-US", { weekday: "short" })}
                            </span>
                            <span className={`text-[22px] font-extrabold my-0.5 ${isSelected ? "text-white" : "text-navy"}`}>{date.getDate()}</span>
                            <span className={`text-[11px] ${isSelected ? "text-[#b6cdbd]" : "text-muted-foreground"}`}>
                              {date.toLocaleDateString("en-US", { month: "short" })}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <button type="button" onClick={() => setCalendarWeekStart(Math.min(availableDates.length - 5, calendarWeekStart + 5))} disabled={!canGoForward}
                      className="flex items-center justify-center w-10 h-10 shrink-0 rounded-[10px] border-[1.5px] border-line text-navy hover:border-[#c7d6ca] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {selectedDate && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Request a time window for {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {TIME_SLOTS.map((slot) => {
                        const isSelected = selectedTimeSlot === slot.id
                        return (
                          <button key={slot.id} type="button" onClick={() => setSelectedTimeSlot(slot.id)}
                            className={`p-3.5 rounded-xl border-2 text-left transition-all ${isSelected ? "border-orange bg-brand-select" : "border-line hover:border-[#c7d6ca]"}`}>
                            <p className={`text-sm font-semibold ${isSelected ? "text-orange-deep" : "text-navy"}`}>{slot.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{slot.time}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Estimate summary — nothing to total on the skip-to-booking path. */}
          {!isVisit && (
            <Card className="rounded-[16px] border-line shadow-brand-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-display font-semibold text-navy text-[22px]">Estimate Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {quote.name}{isProgram && quote.tierName ? ` — ${quote.tierName}` : ""}
                    </span>
                    <span className="font-medium">{priceText}{suffix}</span>
                  </div>

                  {extraAddOnLabels.length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1 mt-1">Additions requested:</p>
                      <ul className="space-y-0.5">
                        {extraAddOnLabels.map((label) => (
                          <li key={label} className="text-foreground flex items-start gap-1.5">
                            <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <span>{label}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-muted-foreground mt-1.5 italic">Pricing for these is confirmed at your assessment.</p>
                    </div>
                  )}

                  <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold text-foreground">
                    <span>{isProgram ? "Annual estimate" : isAssessment ? "Estimated range" : "Estimate"}</span>
                    <span>{priceText}{suffix}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Confirm */}
          <div className="pb-8">
            <button onClick={handleBook} disabled={!canBook || isLoading} className="btn-orange w-full text-lg">
              {isLoading
                ? "Processing..."
                : isVisit
                ? "Confirm & Book Visit"
                : isAssessment
                ? "Confirm & Book Assessment"
                : isProgram
                ? "Confirm & Enroll"
                : "Confirm & Request Visit"}
            </button>
            {!canBook && <p className="text-xs text-muted-foreground text-center mt-3">Please fill in all required fields and select a visit date &amp; time</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
