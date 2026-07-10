"use client"

import Link from "next/link"
import Image from "next/image"
import { Phone } from "lucide-react"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-line-soft bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-[78px] w-full max-w-[1400px] items-center justify-between px-4 md:px-6">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Image src="/images/savatree-logo.svg" alt="SavATree" width={160} height={55} priority className="h-[46px] w-auto" />
        </Link>
        <a
          href="tel:8005433245"
          className="hidden items-center gap-2 text-sm font-bold text-navy transition-colors hover:text-orange sm:inline-flex"
        >
          <Phone className="h-4 w-4 text-orange" />
          (800) 543-3245
        </a>
      </div>
    </header>
  )
}
