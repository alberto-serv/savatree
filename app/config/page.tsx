import { Suspense } from "react"
import type { Metadata } from "next"
import { BranchConsole } from "./branch-console"

export const metadata: Metadata = {
  title: "SavATree — Branch Setup",
  description: "Configure the services, pricing, and city tree ordinance for your SavATree branch.",
}

/**
 * The branch manager's console. Not a customer surface — it's the tool the San
 * Jose manager uses to decide what their customers are shown and charged, with
 * the real booking widget as the preview so there's no gap between what they
 * configure and what ships.
 */
export default function ConfigPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7FAF7]" />}>
      <BranchConsole />
    </Suspense>
  )
}
