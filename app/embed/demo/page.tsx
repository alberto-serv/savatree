"use client"

/**
 * Proof the widget actually behaves like an embed.
 *
 * This page pretends to be someone else's website — its own type, its own
 * background, its own content above and below — and drops /embed into an
 * iframe. The only integration code is the useEffect below: listen for the
 * widget's height message, resize the frame. That's the whole contract.
 */

import { useEffect, useRef, useState } from "react"

const SNIPPET = `<iframe src="https://savatree.com/embed" style="width:100%;border:0" ></iframe>
<script>
  addEventListener("message", (e) => {
    if (e.data?.type !== "savatree:embed:height") return
    document.querySelector("iframe").style.height = e.data.height + "px"
  })
</script>`

export default function EmbedDemoPage() {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(620)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "savatree:embed:height" && typeof e.data.height === "number") {
        setHeight(e.data.height)
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  return (
    <div className="min-h-screen bg-[#faf8f4]">
      {/* Host site chrome — intentionally NOT SavATree's. The widget has to look
          right sitting inside someone else's brand. */}
      <header className="border-b border-[#e7e2d8]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <span className="text-[17px] font-semibold tracking-tight text-[#2b2a26]">Westchester Home Journal</span>
          <span className="text-[13px] text-[#8a857a]">Garden &amp; Landscape</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#a8a294]">Sponsored</p>
        <h1 className="mt-3 font-serif text-[38px] leading-tight text-[#2b2a26]">
          When is it too late to save a dying oak?
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-[#57534a]">
          Most homeowners call an arborist a season too late. The tells — thinning canopy, dieback at the
          crown, bark that sheds in plates — show up long before a tree becomes a hazard, and by the time a
          limb comes down over the driveway, the cheap intervention has usually expired.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-[#57534a]">
          Get a range on the work before you call anyone. SavATree&apos;s estimator asks the same questions an
          arborist would on a walk-around:
        </p>

        <div className="my-10">
          <iframe
            ref={frameRef}
            src="/embed"
            title="SavATree estimator"
            style={{ height }}
            className="w-full border-0 transition-[height] duration-300"
          />
        </div>

        <p className="text-[17px] leading-relaxed text-[#57534a]">
          Pricing varies by branch, and every number above is an estimate until a certified arborist walks
          the property — but you&apos;ll know the order of magnitude before the truck pulls up.
        </p>

        <div className="mt-12 rounded-xl border border-[#e7e2d8] bg-white p-6">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#a8a294]">Integration</p>
          <p className="mt-2 text-[14px] text-[#57534a]">
            The whole embed, including auto-resize:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-[#2b2a26] p-4 text-[12.5px] leading-relaxed text-[#e9e5dc]">
            <code>{SNIPPET}</code>
          </pre>
        </div>
      </main>
    </div>
  )
}
