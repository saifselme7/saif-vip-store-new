# SAIF STORE

Premium streetwear & digital products e-commerce platform built with React, TypeScript, Tailwind CSS and Supabase — with a fully manual, transparent payment verification system (InstaPay / Vodafone Cash).

## Features

- **Storefront**: hero home, product listing with professional filters/sorting, rich product pages (gallery, variants, reviews, related), debounced search with suggestions, wishlist, quick view
- **Cart & Checkout**: stock-aware persistent cart, server-validated coupons, multi-step checkout with shipping info for Egypt
- **Manual Payment System**: InstaPay & Vodafone Cash to `01040324811` — customers upload transfer screenshots (private Supabase Storage), admins verify in a dedicated queue; nothing is ever auto-approved
- **Orders**: real order workflow (pending → payment review → confirmed → … → delivered/cancelled), customer order timeline, payment re-submission on rejection, locked digital delivery until payment approval
- **Admin Dashboard**: overview, analytics (real aggregates via RPC), products (variants + image management), inventory with audit log, orders, payment verification, customers, coupons, reviews, admin users, settings — all code-split
- **Security**: hardened RLS, column-level profile grants + trigger so users can never self-promote, private payment-screenshot storage, server-side pricing/coupon/stock enforcement in transactional RPCs

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

`.env.example` already points at the Supabase project:

```env
VITE_SUPABASE_URL=https://dgaxdbrohvxxarmbmxfv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_u9agbn4QnN26jDXmJKHXAQ_6e5rEaFJ
```

Only the publishable (anon) key is used — no service-role key exists anywhere in this codebase.

### 3. Set Up the Supabase Database

Open the project SQL Editor (`https://supabase.com/dashboard/project/dgaxdbrohvxxarmbmxfv/sql/new`).

**New project** — run one file:

- `supabase/setup.sql` (schema + business-logic functions + RLS/storage policies + seed)

**Existing project** (already ran the v1 setup) — run one file:

- `supabase/upgrade_v2.sql` — idempotent migration: adds the `payments` ledger, `inventory_log`, new order statuses, coupon caps, site settings fields, all RPCs, the new RLS set and the `payment-screenshots` storage bucket

Individual sources (if you prefer step-by-step): `supabase/schema.sql`, `supabase/functions.sql`, `supabase/rls.sql`, `supabase/seed.sql`.

### 4. Enable Authentication

1. Authentication → Providers → Email → enabled
2. Set Site URL to `http://localhost:5173` (or your deployed URL)

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 6. Tests & Production Build

```bash
npm run test     # vitest — checkout/coupon/stock/payment-transition logic
npm run build    # tsc + vite build
```

### 7. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Environment variables for the host:
- `VITE_SUPABASE_URL=https://dgaxdbrohvxxarmbmxfv.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_u9agbn4QnN26jDXmJKHXAQ_6e5rEaFJ`

## Admin Access

Create your first admin from the SQL editor (role writes are blocked everywhere else by design):

```sql
UPDATE profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
```

After that, manage admins from **Admin → System → Admin Users** (goes through a protected RPC).

## Payment Flow

**Customer**: checkout → choose InstaPay/Vodafone Cash → see the receiving number `01040324811` and exact total → transfer → enter payer number + amount → upload screenshot → submit. Order shows *Payment In Review*.

**Admin**: `/admin/payments` queue → open submission → inspect screenshot (signed 5-minute URL) → Approve (confirms order) / Reject (reason required, customer can re-submit) / Cancel (releases stock).

**Guarantees**: order + items are created atomically in one `place_order` RPC with server-side pricing, coupon re-validation and stock reservation; screenshots live in a private bucket readable only by the owner and admins.

## Project Structure

```
saif-store/
├── public/                # Static assets
├── src/
│   ├── components/        # UI components (Header, CartDrawer, ProductCard, ui/)
│   ├── components/admin/  # Admin layout (grouped sidebar)
│   ├── context/           # Auth, App, Cart, Wishlist contexts
│   ├── hooks/             # Data hooks (products, orders, categories, admin)
│   ├── lib/               # Supabase client, checkout logic, storage, constants
│   ├── pages/             # Storefront pages
│   ├── pages/admin/       # Admin pages (lazy-loaded)
│   └── types/             # Domain types
├── supabase/
│   ├── schema.sql         # Full schema (new projects)
│   ├── functions.sql      # Business-logic RPCs
│   ├── rls.sql            # RLS + storage policies
│   ├── seed.sql           # Catalog & settings seed
│   ├── setup.sql          # All of the above in one file
│   └── upgrade_v2.sql     # Idempotent v1 → v2 migration
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

## Tech Stack

React 18 · TypeScript (strict) · Vite · Tailwind CSS · Supabase (Auth, PostgREST, Storage, RPC) · Vitest
