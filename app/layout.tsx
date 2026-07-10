import type React from "react"
import type { Metadata } from "next"
import { Manrope, Fraunces } from "next/font/google"
import "@/app/globals.css"
import { SiteChrome } from "@/components/site-chrome"
import { cn } from "@/lib/utils"

// Manrope — clean grotesque body/UI face, standing in for F37 Zagma.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
})

// Fraunces — high-contrast serif display face, standing in for Perfectly
// Nineties. Used for every heading, page/section/card title.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
})

export const metadata: Metadata = {
  title: "SavATree — Tree, Shrub & Lawn Care",
  description:
    "Science-based tree, shrub, lawn, and plant health care from ISA Certified Arborists. Instant estimates for lawn programs, fertilization, tick & mosquito, and more — or request a consultation.",
  icons: {
    icon: "https://www.savatree.com/img/upload/sat-favicon.png",
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="light">
      <body className={cn("min-h-screen bg-background font-sans antialiased", manrope.variable, fraunces.variable)}>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  )
}
