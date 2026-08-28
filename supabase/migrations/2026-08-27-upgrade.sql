-- ============================================================
-- SAIF STORE — Upgrade migration for EXISTING projects
-- Run this once in your Supabase SQL Editor.
-- It is idempotent: safe to re-run.
-- It upgrades an older SAIF STORE database to the new schema:
--   * payments + manual InstaPay / Vodafone Cash verification
--   * order timeline + inventory audit log
--   * new columns (shipping fee, payment status, low stock, ...)
--   * storage buckets for payment screenshots & product images
--   * SECURITY FIX: users can no longer change their own role
-- After running this, also run functions.sql and rls.sql if
-- they have not been applied yet (they are idempotent too).
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1) New columns on existing tables
-- ------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5 CHECK (low_stock_threshold >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_info TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
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

-- ------------------------------------------------------------
-- 2) New tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('instapay','vodafone_cash')),
  payment_status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (payment_status IN ('awaiting_payment','payment_submitted','under_review','approved','rejected','cancelled')),
  expected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  transferred_amount NUMERIC(12,2) CHECK (transferred_amount IS NULL OR transferred_amount >= 0),
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

-- ------------------------------------------------------------
-- 3) Updated order status workflow
--    payment_review replaces the old pending flow; legacy
--    'ready'/'rejected' rows are normalised.
-- ------------------------------------------------------------
DO $$
BEGIN
  UPDATE orders SET status = 'processing' WHERE status = 'ready';
  UPDATE orders SET status = 'cancelled' WHERE status = 'rejected';

  EXECUTE 'ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check';
  EXECUTE 'ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (''pending'',''payment_review'',''confirmed'',''processing'',''shipped'',''delivered'',''completed'',''cancelled'',''refunded''))';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'order status constraint update skipped: %', SQLERRM;
END $$;

-- Payment status check constraint (added only if missing).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_payment_status_check' AND conrelid = 'orders'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN (''awaiting_payment'',''payment_submitted'',''under_review'',''approved'',''rejected'',''cancelled''))';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_payment_method_check' AND conrelid = 'orders'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN (''instapay'',''vodafone_cash''))';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4) Backfill payment status for legacy orders
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
-- 5) New indexes
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
-- 6) updated_at trigger for payments
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 7) SECURITY FIX — block role escalation
--    a) Column-level grants: `role` can no longer be written
--       by anon/authenticated API roles.
--    b) Trigger: raises if a non-admin changes a role.
--    c) RLS policies are refreshed in rls.sql.
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
-- 8) Storage buckets (private payment screenshots,
--    public product images)
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

-- NOTE: functions.sql and rls.sql must be run afterwards
-- (they are idempotent and contain the RPCs + policies,
-- including the storage object policies).
