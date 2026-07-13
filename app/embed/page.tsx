import { Suspense } from "react"
import type { Metadata } from "next"
import { EmbedWizard } from "./embed-wizard"

export const metadata: Metadata = {
  title: "SavATree — Request a Consultation",
  description: "Answer a few questions about your property and get an estimate from an ISA Certified Arborist.",
}

/**
 * The embed host page. Deliberately thin: the widget is the product, and this
 * page only exists so the widget has somewhere to live when it isn't framed.
 *
 * `bg-transparent` on the wrapper matters — dropped into an iframe on a
 * customer's site, the widget must sit on THEIR background, not paint a green
 * rectangle over it. The `frame-standalone` backdrop below is drawn only when
 * this page is the top-level document (see globals.css); inside a frame the
 * host page shows through untouched.
 */
export default function EmbedPage() {
  return (
    <div className="frame-standalone flex items-center justify-center bg-transparent p-4 sm:p-6">
      <Suspense fallback={<div className="h-[560px] w-full max-w-[660px] rounded-[20px] bg-sky" />}>
        <EmbedWizard />
      </Suspense>
    </div>
  )
}
