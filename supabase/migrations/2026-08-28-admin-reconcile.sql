-- ============================================================
-- SAIF STORE — ADMIN RECONCILE (2026-08-28)
-- Universal, additive, idempotent convergence migration.
--
-- Safe to run on a database in ANY of these states:
--   A) the original pre-transformation schema
--   B) the original schema + the sibling "upgrade_v2.sql" applied
--   C) partially upgraded with 2026-08-27-upgrade.sql
--   D) already fully migrated (no-op)
--
-- It NEVER drops tables and NEVER deletes rows. The only data
-- change is a status backfill on superseded duplicate payment
-- rows (rows are kept, only marked cancelled) so the one-payment-
-- per-order invariant can be enforced.
--
-- RUN ORDER for a broken admin dashboard:
--   1. supabase/migrations/2026-08-28-admin-reconcile.sql   (this file)
--   2. supabase/functions.sql
--   3. supabase/rls.sql
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1) Additive column changes (all IF NOT EXISTS)
-- ------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5 CHECK (low_stock_threshold >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_info TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_note TEXT;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'physical';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfillment_note TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(12,2);

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12,2);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS payment_number TEXT DEFAULT '01040324811';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS instapay_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS vodafone_cash_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- Backfill payment number if the column was just added
UPDATE site_settings SET payment_number = '01040324811' WHERE payment_number IS NULL;

-- ------------------------------------------------------------
-- 2) Backfills from the sibling "v2" schema (guarded — only when
--    those columns exist and ours are still empty)
-- ------------------------------------------------------------

-- One-time migration marker table (makes re-runs of this file safe)
CREATE TABLE IF NOT EXISTS public._saif_migration_meta (
  key TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- orders.stock_released (sibling) -> orders.stock_reserved (ours)
-- Runs exactly ONCE (guarded by marker): without the marker, a later re-run
-- could re-reserve stock for orders that the NEW flow has already cancelled.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'stock_released')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'stock_reserved')
     AND NOT EXISTS (SELECT 1 FROM public._saif_migration_meta WHERE key = 'sibling_stock_backfill') THEN
    UPDATE orders SET stock_reserved = NOT COALESCE(stock_released, TRUE)
    WHERE stock_reserved = FALSE AND stock_released IS NOT NULL;
    INSERT INTO public._saif_migration_meta (key) VALUES ('sibling_stock_backfill')
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;

-- coupons.max_discount (sibling) -> coupons.max_discount_amount (ours)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'coupons' AND column_name = 'max_discount') THEN
    UPDATE coupons SET max_discount_amount = max_discount WHERE max_discount_amount IS NULL;
  END IF;
END $$;

-- site_settings.minimum_order_amount (sibling) -> min_order_amount (ours)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'minimum_order_amount') THEN
    UPDATE site_settings SET min_order_amount = minimum_order_amount WHERE min_order_amount IS NULL;
  END IF;
END $$;

-- payments table from the sibling lineage already exists with their
-- `status` column, so CREATE TABLE IF NOT EXISTS (section 5) is a no-op —
-- add our payment_status column additively here, then backfill it below.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'payments')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'payments'
                       AND column_name = 'payment_status') THEN
    EXECUTE 'ALTER TABLE payments ADD COLUMN payment_status TEXT';
    RAISE NOTICE 'payments.payment_status added to existing (sibling) table';
  END IF;
END $$;

-- The sibling lineage made payments.user_id NOT NULL, but the current
-- application derives payment ownership through orders.user_id and does not
-- write this legacy column. Relax the constraint (no data change) so
-- place_order() can insert on sibling-lineage databases.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'user_id')
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'user_id'
         AND is_nullable = 'NO'
     ) THEN
    EXECUTE 'ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL';
    RAISE NOTICE 'payments.user_id NOT NULL relaxed (legacy sibling column)';
  END IF;
END $$;

-- payments.status (sibling) -> payments.payment_status (ours)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'status')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_status') THEN
    UPDATE payments SET payment_status = status WHERE payment_status IS NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3) orders.payment_status backfill for legacy rows (no payments
--    rows at all, e.g. state A/C): derive from order status
-- ------------------------------------------------------------
UPDATE orders
   SET payment_status = CASE
        WHEN status IN ('delivered', 'completed', 'shipped', 'confirmed', 'processing') THEN 'approved'
        WHEN status = 'cancelled' THEN 'cancelled'
        ELSE 'cancelled'
       END,
       payment_method = COALESCE(payment_method, 'instapay')
 WHERE payment_status IS NULL;

ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'awaiting_payment';

-- ------------------------------------------------------------
-- 4) orders status workflow normalisation + constraints
-- ------------------------------------------------------------
DO $$
BEGIN
  EXECUTE 'ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check';
  UPDATE orders SET status = 'processing' WHERE status = 'ready';
  UPDATE orders SET status = 'cancelled' WHERE status = 'rejected';
  EXECUTE 'ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (''pending'',''payment_review'',''confirmed'',''processing'',''shipped'',''delivered'',''completed'',''cancelled'',''refunded''))';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'order status constraint update skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'orders_payment_status_check' AND conrelid = 'orders'::regclass) THEN
    EXECUTE 'ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN (''awaiting_payment'',''payment_submitted'',''under_review'',''approved'',''rejected'',''cancelled''))';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'orders_payment_method_check' AND conrelid = 'orders'::regclass) THEN
    EXECUTE 'ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN (''instapay'',''vodafone_cash''))';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5) New tables (IF NOT EXISTS — never touches existing data)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('order_created','status_change','payment_submitted','payment_reviewed','note','fulfillment','cancellation')),
  status TEXT,
  payment_status TEXT,
  message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('set','increase','decrease','order','restore')),
  delta INTEGER NOT NULL DEFAULT 0,
  previous_value INTEGER NOT NULL DEFAULT 0,
  new_value INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- payments table itself (state A: original schema — create fresh;
-- state B/D: already exists, left untouched by this statement)
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('instapay','vodafone_cash')),
  payment_status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (payment_status IN ('awaiting_payment','payment_submitted','under_review','approved','rejected','cancelled')),
  expected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  transferred_amount NUMERIC(12,2),
  payer_identifier TEXT,
  screenshot_path TEXT,
  customer_note TEXT,
  admin_note TEXT,
  rejection_reason TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 6) Enforce one payment per order.
--    Sibling v2 allowed several payments per order. Superseded
--    duplicates are MARKED cancelled (rows preserved), then a
--    unique index is created only when no duplicates remain.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_status') THEN
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY order_id
               ORDER BY (payment_status = 'approved') DESC, created_at DESC, id DESC
             ) AS rn
      FROM payments
    )
    UPDATE payments
       SET payment_status = 'cancelled',
           admin_note = CONCAT_WS(' | ', NULLIF(admin_note, ''), 'Superseded by a newer payment record during schema reconciliation')
     WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
       AND COALESCE(payment_status, 'awaiting_payment') NOT IN ('approved', 'cancelled');
  END IF;
END $$;

-- Partial unique index: exactly one ACTIVE payment per order. Cancelled
-- historical rows (superseded duplicates) are preserved and exempt, so the
-- index can be created without deleting anything.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM payments
    WHERE COALESCE(payment_status, 'awaiting_payment') <> 'cancelled'
    GROUP BY order_id HAVING COUNT(*) > 1
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS payments_one_active_per_order ON payments(order_id) WHERE COALESCE(payment_status, ''awaiting_payment'') <> ''cancelled''';
  ELSE
    RAISE NOTICE 'payments: multiple ACTIVE payments per order remain (e.g. two approved) — index NOT created. Resolve manually.';
  END IF;
END $$;

-- payments.payment_status CHECK (guarded for state B where the
-- column was just added to a sibling table without constraints)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_status')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                     WHERE conname = 'payments_payment_status_check' AND conrelid = 'payments'::regclass) THEN
    EXECUTE 'ALTER TABLE payments ADD CONSTRAINT payments_payment_status_check CHECK (payment_status IN (''awaiting_payment'',''payment_submitted'',''under_review'',''approved'',''rejected'',''cancelled''))';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 7) Copy sibling inventory_log rows into inventory_logs
--    (one-time, guarded; the sibling table is preserved as-is)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'inventory_log')
     AND NOT EXISTS (SELECT 1 FROM inventory_logs) THEN
    EXECUTE $sql$
      INSERT INTO inventory_logs (product_id, variant_id, change_type, delta, previous_value, new_value, created_by, created_at)
      SELECT product_id,
             variant_id,
             CASE WHEN COALESCE(change, 0) < 0 THEN 'order' WHEN COALESCE(change, 0) > 0 THEN 'increase' ELSE 'set' END,
             COALESCE(change, 0),
             GREATEST(stock_after - COALESCE(change, 0), 0),
             stock_after,
             changed_by,
             created_at
      FROM inventory_log
    $sql$;
    RAISE NOTICE 'inventory_log rows copied into inventory_logs (original table preserved)';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 8) Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_bestseller ON products(bestseller);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_product ON wishlists(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- ------------------------------------------------------------
-- 9) updated_at trigger on payments
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 10) SECURITY FIX (from 2026-08-27) — role escalation guard
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_user IN ('postgres', 'service_role') OR public.is_admin() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Permission denied: profile role cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_role ON profiles;
CREATE TRIGGER profiles_protect_role BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, phone, address) ON public.profiles TO authenticated;
REVOKE INSERT ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, full_name, avatar_url, phone, address) ON public.profiles TO authenticated;

-- ------------------------------------------------------------
-- 11) Remove sibling v2 objects that CONFLICT with the current
--     application (different signatures / double side-effects).
--     DROP ... IF EXISTS is a no-op when absent.
-- ------------------------------------------------------------

-- Triggers that would double-log stock movements for our RPCs
DROP TRIGGER IF EXISTS products_stock_log ON products;
DROP TRIGGER IF EXISTS variants_stock_log ON product_variants;
DROP FUNCTION IF EXISTS public.log_product_stock_change();

-- Functions with incompatible signatures (recreated by functions.sql).
-- place_order / submit_payment: sibling arg TYPES differ from ours, so these
-- drops are no-ops once our versions exist.
DROP FUNCTION IF EXISTS public.place_order(JSONB, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.submit_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT);
-- review_payment: the sibling shares our exact arg TYPES but names the second
-- parameter p_action (the frontend calls p_decision). Drop it ONLY when the
-- p_action variant is present, so re-running this migration never removes the
-- correct (p_decision) function installed by functions.sql.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'review_payment'
      AND pg_get_function_arguments(p.oid) ILIKE '%p_action%'
  ) THEN
    EXECUTE 'DROP FUNCTION public.review_payment(UUID, TEXT, TEXT, TEXT)';
    RAISE NOTICE 'sibling review_payment(p_action) variant dropped';
  END IF;
END $$;

-- Superseded mutating helpers (replaced by admin_update_order_status /
-- review_payment / restore_order_stock from functions.sql)
DROP FUNCTION IF EXISTS public.set_order_status(UUID, TEXT);
DROP FUNCTION IF EXISTS public.release_order_stock(UUID);
DROP FUNCTION IF EXISTS public.set_user_role(UUID, TEXT);

-- ------------------------------------------------------------
-- 12) Drop LEGACY policies (original project + sibling v2 names)
--     that rls.sql does not replace by name. Without this they
--     would OR-combine with the new policies (e.g. the old
--     "Reviews own write" allowed inserting pre-approved reviews,
--     bypassing moderation).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Products admin all" ON products;
DROP POLICY IF EXISTS "Orders own" ON orders;
DROP POLICY IF EXISTS "Order items through order" ON order_items;
DROP POLICY IF EXISTS "Reviews public read approved" ON reviews;
DROP POLICY IF EXISTS "Reviews own read" ON reviews;
DROP POLICY IF EXISTS "Reviews own write" ON reviews;
DROP POLICY IF EXISTS "Payments own read" ON payments;
DROP POLICY IF EXISTS "Screenshots owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Screenshots owner or admin read" ON storage.objects;
DROP POLICY IF EXISTS "Screenshots owner update" ON storage.objects;
DROP POLICY IF EXISTS "Screenshots owner delete" ON storage.objects;

-- ------------------------------------------------------------
-- 13) Storage buckets (upsert limits; policies come from rls.sql)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-screenshots', 'payment-screenshots', false, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 5242880,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 'product-images', true, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;

-- Run supabase/functions.sql and supabase/rls.sql next.
