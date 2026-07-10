import Link from "next/link"
import Image from "next/image"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-navy text-[#b6cdbd]">
      <div className="container mx-auto px-6 py-14 md:px-8">
        <div className="flex flex-wrap justify-between gap-10 border-b border-white/[0.14] pb-8">
          <div className="max-w-[440px]">
            <Link href="/" className="inline-block rounded-[6px]">
              <Image
                src="/images/savatree-logo-white.svg"
                alt="SavATree"
                width={160}
                height={55}
                className="h-11 w-auto"
              />
            </Link>
            <p className="mt-[18px] text-sm leading-relaxed text-[#b6cdbd]">
              Science-based tree, shrub, lawn, and plant health care delivered by ISA Certified Arborists.
              Caring for the trees and landscapes that matter to you since 1985.
            </p>
          </div>
          <div className="space-y-3">
            <h5 className="eyebrow text-gold">Contact</h5>
            <p className="text-sm text-[#d4e4d9]">Locations across the Northeast, Mid-Atlantic &amp; beyond</p>
            <p className="text-sm">
              <a href="tel:8005433245" className="font-semibold text-gold hover:text-gold-deep transition-colors">
                (800) 543-3245
              </a>
            </p>
          </div>
        </div>
        <div className="mt-[22px] flex flex-col items-center justify-between gap-3 text-[12.5px] text-[#8aa694] md:flex-row">
          <p>&copy; {currentYear} SavATree. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="https://www.savatree.com/privacy-policy.html" className="hover:text-[#d4e4d9] transition-colors">
              Privacy Policy
            </Link>
            <Link href="https://www.savatree.com/terms-of-use.html" className="hover:text-[#d4e4d9] transition-colors">
              Terms of Service
            </Link>
            <a
              href="https://www.goserv.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 opacity-80 transition-opacity hover:opacity-100"
            >
              <span>Powered by</span>
              <Image
                src="/serv-logo.png"
                alt="Serv"
                width={48}
                height={18}
                className="h-[14px] w-auto brightness-0 invert"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
