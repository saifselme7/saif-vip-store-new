# SAIF STORE

Premium fashion and digital products e-commerce platform built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Storefront**: Home, Products, Product Detail, Search, Categories
- **Physical & Digital Products**: Full support for both product types
- **Cart & Checkout**: Real cart with order creation
- **Authentication**: Sign up, Login, Profile, Order History
- **Wishlist**: Save favorite products
- **Admin Dashboard**: Products, Orders, Categories, Customers, Coupons, Reviews, Settings
- **Supabase Backend**: Real database with RLS, Auth, and Storage

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

`.env.example` already points at the NEW Supabase project:

```env
VITE_SUPABASE_URL=https://dgaxdbrohvxxarmbmxfv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_u9agbn4QnN26jDXmJKHXAQ_6e5rEaFJ
```

`VITE_SUPABASE_PUBLISHABLE_KEY` is the public/publishable key for this project
(Supabase Dashboard → Project Settings → API → `anon/public` key). No secret key
or service-role key is used or committed anywhere in this codebase.

### 3. Set Up the NEW Supabase Database

1. Open the NEW Supabase project SQL Editor (`https://supabase.com/dashboard/project/dgaxdbrohvxxarmbmxfv/sql/new`)
2. Run the migration files in this order:
   - `supabase/schema.sql` — creates all tables, indexes, triggers
   - `supabase/rls.sql` — enables RLS and creates the required policies
   - `supabase/seed.sql` — inserts default site settings, categories, products, variants, coupons
3. If you prefer one file, run `supabase/setup.sql` (it contains all three steps).

### 4. Enable Authentication

1. Go to Authentication → Providers → Email
2. Enable Email provider (you can leave email confirmation on or off — the schema
   auto-creates a `profiles` row on signup either way)
3. Set Site URL to `http://localhost:5173` (or your deployed URL)

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 6. Build for Production

```bash
npm run build
```

### 7. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Make sure to add these environment variables in the Vercel dashboard:
- `VITE_SUPABASE_URL=https://dgaxdbrohvxxarmbmxfv.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_u9agbn4QnN26jDXmJKHXAQ_6e5rEaFJ`

## Project Structure

```
saif-store/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable UI components
│   ├── components/admin/# Admin layout
│   ├── context/         # React contexts (Auth, Cart, App)
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities, Supabase client, constants
│   ├── pages/           # Store pages
│   ├── pages/admin/     # Admin dashboard pages
│   ├── types/           # TypeScript types
│   ├── App.tsx          # Main app with routing
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles + Tailwind
├── supabase/
│   ├── schema.sql       # Database schema
│   ├── rls.sql          # Row Level Security policies
│   └── seed.sql         # Demo data
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── .env.example
```

## Admin Access

After signing up, manually update the user's role in Supabase:

```sql
UPDATE profiles SET role = 'admin' WHERE id = 'your-user-id';
```

Then navigate to `/admin`.

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Supabase (Auth, Database, Storage)
- Lucide React (icons)

## License

MIT
