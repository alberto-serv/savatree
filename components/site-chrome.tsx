"use client"

import { usePathname } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

// Most of the site shares one minimal header/footer (see layout.tsx). Standalone
// marketing clones like /landing ship their own full navigation + footer, so we
// skip the shared chrome for those routes and hand them the raw children.
//
// /embed is the other reason: it renders inside a customer's iframe, where a
// SavATree header and footer would be someone else's chrome bolted onto their
// page. /embed/demo is a mock host site and brings its own.
//
// /config isn't a customer surface at all — it's the branch manager's console,
// and it carries its own branch-identified header.
const STANDALONE_PREFIXES = ["/landing", "/embed", "/config"]

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const standalone = STANDALONE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )

  if (standalone) return <>{children}</>

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
