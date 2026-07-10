"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { CalendarDays, Clock, MapPin } from "lucide-react"
import { getService, type Service } from "@/lib/savatree-catalog"
import { cadenceLabel } from "@/lib/savatree-services"

function fmt(n: string): string {
  const num = parseFloat(n)
  if (isNaN(num)) return "0"
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

export default function ConfirmationPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState({
    service: "",
    serviceName: "",
    vertical: "",
    cadence: "",
    low: "0",
    high: "0",
    summary: "",
    addOns: "",
    address: "",
    customerName: "",
    customerEmail: "",
    phone: "",
    visitDate: "",
    visitTime: "",
  })

  useEffect(() => {
    const d: Record<string, string> = {}
    for (const key of Object.keys(data)) {
      d[key] = searchParams.get(key) || (data as Record<string, string>)[key]
    }
    setData(d as typeof data)
  }, [searchParams])

  const addOns = data.addOns ? data.addOns.split(",").map((a) => a.trim()).filter(Boolean) : []
  const cadenceSuffix = data.cadence === "annual_program" ? "/yr" : data.cadence === "seasonal" ? "/season" : ""
  const priceText = data.high !== data.low ? `$${fmt(data.low)} – $${fmt(data.high)}` : `$${fmt(data.low)}`
  const quoteDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="text-center mb-10 print:hidden">
          <h1 className="disp text-navy text-[clamp(34px,5vw,52px)] mb-2">You&apos;re All Set</h1>
          <p className="text-muted-foreground text-base">Your estimate and requested visit are confirmed below</p>
        </div>

        <div className="max-w-[760px] mx-auto bg-white border border-line rounded-[16px] shadow-brand-sm overflow-hidden print:shadow-none print:border-0">
          <div className="px-6 py-5 md:px-8 md:py-6 flex items-center justify-between border-b border-line-soft">
            <div>
              <Image src="/images/savatree-logo.svg" alt="SavATree" width={150} height={52} className="h-10 w-auto" />
              <p className="text-muted-foreground text-xs mt-2">(800) 543-3245 · savatree.com</p>
            </div>
            <p className="text-xs text-muted-foreground">{quoteDate}</p>
          </div>

          <div className="px-6 py-6 md:px-8 md:py-8 space-y-6">
            {data.customerName && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2">Prepared For</h3>
                <p className="text-foreground font-semibold">{data.customerName}</p>
                {data.customerEmail && <p className="text-sm text-muted-foreground">{data.customerEmail}</p>}
                {data.phone && <p className="text-sm text-muted-foreground">{data.phone}</p>}
              </div>
            )}

            {data.visitDate && (
              <div className="border-t border-line-soft pt-5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">Your Requested Visit</h3>
                <div className="bg-[#F3F8F3] border border-line-soft rounded-[14px] p-4">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <CalendarDays className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm font-semibold text-foreground">Arborist Visit · {data.visitDate}</p>
                    </div>
                    {data.visitTime && (
                      <div className="flex items-start gap-2.5">
                        <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground">{data.visitTime}</p>
                      </div>
                    )}
                    {data.address && (
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground">{data.address}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    A certified arborist will assess your property and confirm your program on-site.
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-line-soft pt-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">Selected Service</h3>
              <div className="bg-[#F3F8F3] border border-line-soft rounded-[14px] p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-[19px] font-semibold text-navy">{data.serviceName}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-orange-deep">{priceText}</span>
                    {cadenceSuffix && <span className="text-sm text-body font-semibold">{cadenceSuffix}</span>}
                  </div>
                </div>
                {data.cadence && <p className="text-sm text-muted-foreground mt-1">{cadenceLabel(data.cadence as Service["cadence"])}</p>}
                {data.summary && <p className="text-sm text-muted-foreground mt-1">{data.summary}</p>}
              </div>
            </div>

            {addOns.length > 0 && (
              <div className="border-t border-line-soft pt-5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">Add-On Services</h3>
                <ul className="space-y-1.5 text-sm">
                  {addOns.map((addon, i) => (
                    <li key={i} className="text-foreground">&middot; {addon}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground mt-2 italic">Add-on pricing confirmed during your visit.</p>
              </div>
            )}

            <div className="border-t border-line-soft pt-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">Estimate</h3>
              <div className="flex justify-between font-bold">
                <span className="text-navy">{data.cadence === "annual_program" ? "Annual Estimate" : "Estimate"}</span>
                <span className="text-navy text-base">{priceText}{cadenceSuffix}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Estimate only. Final pricing is set per-property by a certified arborist after assessment and may vary with tree size, species, access, and local branch rates.
              </p>
            </div>
          </div>

          <div className="border-t border-line-soft px-6 py-5 md:px-8 bg-[#F3F8F3] print:bg-transparent">
            <p className="text-[11px] text-muted-foreground">&copy; {new Date().getFullYear()} SavATree. All rights reserved.</p>
            {data.visitDate && (
              <p className="text-[11px] text-muted-foreground mt-2 print:hidden">
                Need to reschedule? Call <a href="tel:8005433245" className="font-semibold text-orange-deep hover:text-orange transition-colors">(800) 543-3245</a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
