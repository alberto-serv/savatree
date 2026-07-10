import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Body / UI — stands in for F37 Zagma (clean grotesque)
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        // Display / headings — stands in for Perfectly Nineties (high-contrast serif)
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      colors: {
        // ── SavATree brand palette ──
        // The Anago token *names* are kept so the shared markup keeps working,
        // but the values are SavATree's: forest green in the "navy" role, a
        // brighter leaf green in the "orange" (accent/CTA) role, amber for warmth.
        navy: { DEFAULT: "#1B5C34", deep: "#123F24" }, // primary forest green
        orange: { DEFAULT: "#17AB2D", deep: "#128A24" }, // accent / CTA leaf green
        gold: { DEFAULT: "#FFA500", deep: "#E08F00" }, // warm amber highlight
        cream: "#FFE7B8",
        sky: "#E6F4EA",
        ink: "#1F1C1D",
        body: "#46524A",
        line: { DEFAULT: "#E3E8E1", soft: "#EEF1EB" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        pill: "8px", // SavATree uses squared-off buttons, not pills
      },
      backgroundImage: {
        // Brand gradient — stat/price bands, hero wash, service highlight
        "brand-band": "linear-gradient(100deg,#E6F4EA 0%,#FBFDF9 52%,#FFF3D9 100%)",
        "brand-band-soft": "linear-gradient(100deg,#EEF7EF 0%,#FFFFFF 52%,#FBF6EA 100%)",
        "brand-select": "linear-gradient(180deg,#F2FAF3,#E9F6EC)",
      },
      boxShadow: {
        "brand-sm": "0 6px 20px rgba(27,92,52,.08)",
        brand: "0 18px 50px rgba(27,92,52,.12)",
        "orange-glow": "0 8px 22px rgba(23,171,45,.28)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
