# Heroes Lawn Care

A modern lawn care service booking platform built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- 🏡 Address-based service quotes
- 📍 Geolocation support
- 📦 Three-tier package system (Bronze, Silver, Gold)
- 📱 Fully responsive design
- ✨ Modern UI with shadcn/ui components
- 🎨 Tailwind CSS styling
- 📝 Form validation with React Hook Form
- 🔒 Type-safe with TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Run the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint errors automatically
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting
- `pnpm type-check` - Run TypeScript type checking

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── about/             # About page
│   ├── checkout/          # Checkout flow
│   ├── contact/           # Contact page
│   ├── services/          # Services page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # Reusable React components
│   ├── ui/               # shadcn/ui components
│   ├── footer.tsx
│   ├── header.tsx
│   └── navbar.tsx
├── lib/                   # Utility functions
├── public/               # Static assets
└── styles/               # Global styles
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui + Radix UI
- **Forms:** React Hook Form + Zod
- **Icons:** Lucide React
- **Deployment:** Vercel (recommended)

## Code Quality

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety

Run `pnpm lint` and `pnpm format` before committing changes.

## Deployment

The easiest way to deploy is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import your repository in Vercel
3. Vercel will automatically detect Next.js and configure the build
4. Deploy!

## License

Private - All rights reserved
