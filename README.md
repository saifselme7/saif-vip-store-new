# SAIF STORE

Premium e-commerce storefront + admin dashboard built with React, Vite, TypeScript and Supabase. Black / cream / red brand identity.

## Features

- **Storefront** — homepage rails (featured, new arrivals, best sellers, offers, digital), product listing with server-side filters + sorting, product detail pages with gallery/zoom, variants (size × color), reviews with moderation, wishlist, persistent stock-aware cart with drawer, debounced search with suggestions.
- **Manual payments** — InstaPay & Vodafone Cash with receiving number `01040324811`. Customers upload a transfer screenshot (private Supabase Storage bucket); admins verify manually (approve / reject with reason / under review / cancel). Payments are never auto-approved.
- **Atomic checkout** — the `place_order` RPC validates the cart against live stock with row locks, recomputes totals server-side, applies coupons, creates order + items + payment record + timeline event and reserves inventory in one transaction.
- **Admin dashboard** — live KPIs, payment verification queue with zoomable screenshots, order management with timeline and internal notes, product management (variants, image manager, specs, duplication, bulk actions), inventory adjustments with an audit log, customers with real order stats, coupons, review moderation, sales analytics, and full site settings (payment number, method toggles, shipping, announcement, maintenance mode).
- **Security** — role changes are blocked at the database level (column grants + trigger + RLS), payment screenshots are only accessible to their owner and admins, coupon codes are never exposed publicly.

## Setup

### 1. Supabase

**New project** — run `supabase/setup.sql` in the SQL Editor.

**Existing project / Admin Dashboard broken?** — run, in this exact order:
1. `supabase/diagnostics/check_schema.sql` — read-only state report (tells you which lineage your database is in)
2. `supabase/migrations/2026-08-28-admin-reconcile.sql` — additive, idempotent; converges BOTH known lineages (original v1 and the sibling v2 where payments used `status` and `review_payment` took `p_action`)
3. `supabase/functions.sql`
4. `supabase/rls.sql`
5. `supabase/diagnostics/verify_admin.sql` — read-only verification (every row should say OK)

The reconciliation never drops tables and never deletes rows; superseded duplicate payment rows are only *marked* cancelled. Re-running any step is safe.

### 2. Environment

```bash
cp .env.example .env
# fill in your project URL + publishable (anon) key
```

### 3. Run

```bash
npm install
npm run dev      # development
npm run build    # production build (also type-checks)
npm test         # unit + integration tests
```

### 4. Create an admin

Sign up normally, then promote yourself once in the SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';
```

(Regular users can never change roles — the database blocks it.)

## Payments flow

1. Customer checks out → `place_order()` reserves stock and creates the order (`payment_review`) with a payment record (`awaiting_payment`).
2. Customer transfers the exact total to the receiving number shown at checkout and uploads a screenshot → `submit_payment()` marks it `under_review`.
3. Admin verifies in **Admin → Payment Verification** → `review_payment()` approves (order → `confirmed`), rejects (reason required, customer can resubmit) or cancels (stock is returned).
4. Digital items get delivery details via `admin_set_fulfillment()`, visible to the customer only after payment approval.

## Testing

`npm test` runs:
- unit tests (pricing, validation, payment state rules)
- a jsdom smoke test (app renders with an unreachable backend)
- **full database integration tests** — the real SQL files run on PGlite (PostgreSQL WASM) with Supabase `auth`/`storage` mocked: checkout atomicity, stock reservation & restore, coupon consumption, payment state transitions, RLS isolation, role-escalation protection and storage policies
- the migration path from the previous schema (data survival + idempotency)
