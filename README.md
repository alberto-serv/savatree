# SavATree — Service Estimator Prototype

A prototype tree, shrub, lawn, and plant-health-care estimator for SavATree, built
with Next.js 14, TypeScript, and Tailwind CSS. Adapted from the Anago commercial
cleaning flow into a **service-driven** estimator.

## The flow

1. **Pick a category** — one of eight verticals (Lawn Care, Plant Health Care,
   Tick & Mosquito, Trees & Shrubs, Deer Control, Landscape, Holiday, Commercial).
2. **Pick a service** — each is tagged **Instant** (books online with an instant
   estimate) or **Consult** (scoped by a certified arborist on site).
3. **Configure** — the estimator renders that service's own input schema
   (`quoteInputs`): a property-size slider, number steppers (tree / stump counts),
   option pills, program-tier cards, and add-on toggles.
4. **Estimate → Book**, or, for assessment-gated services, **Request a
   Consultation** via an inline arborist form.

## Architecture

- `lib/savatree-catalog.ts` — single source of truth: the service catalog, pricing
  models, and the `generateQuote()` engine. SavATree publishes no public pricing,
  so figures are 2026 market-benchmark seed values (see the disclaimer in-file).
- `lib/savatree-services.ts` — presentation layer: vertical metadata (icon, blurb,
  ordering) and view helpers over the catalog.
- `app/page.tsx` — the vertical → service → dynamic-input estimator.
- `app/checkout/` — booking + confirmation for instant-quote services.
- `app/contact/` — standalone consultation request.

Two fulfillment paths run off one data layer: `instant_quote` (bookable) and
`consultation` (arborist-assessed). There are 32 services (16 instant, 16
consultation) across the eight verticals.

## Branding

SavATree green palette (forest `#1B5C34`, leaf `#17AB2D`, amber `#FFA500`) with an
elegant serif display face. Fonts are close free stand-ins for the licensed brand
faces: **Fraunces** for Perfectly Nineties (display) and **Manrope** for F37 Zagma
(body) — swap in the real `@font-face` files when available.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run type-check` — TypeScript check
- `npm run lint` — ESLint
