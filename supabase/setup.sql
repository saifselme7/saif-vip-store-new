-- ============================================================
-- SAIF STORE — Full Supabase setup for a NEW project
-- Run this file in the Supabase SQL Editor.
-- It applies the schema, functions, RLS policies (including
-- storage policies) and seed data in order.
--
-- UPGRADING AN EXISTING PROJECT?
-- Run supabase/migrations/2026-08-28-admin-reconcile.sql,
-- then functions.sql + rls.sql, then
-- supabase/migrations/2026-08-29-bilingual-cms.sql.
-- ============================================================

-- ============================================================
-- SAIF STORE — Database Schema (fresh install)
-- Run this in your Supabase SQL Editor, followed by functions.sql,
-- rls.sql and seed.sql (or use setup.sql which combines them).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ------------------------------------------------------------
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  address JSONB DEFAULT '{}',
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row whenever a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  description_ar TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  short_description TEXT DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  compare_at_price NUMERIC(12,2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  product_type TEXT DEFAULT 'physical' CHECK (product_type IN ('physical', 'digital')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  images TEXT[] DEFAULT '{}',
  thumbnail TEXT,
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold INTEGER DEFAULT 5 CHECK (low_stock_threshold >= 0),
  sku TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
  featured BOOLEAN DEFAULT FALSE,
  bestseller BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  specifications JSONB DEFAULT '{}',
  specifications_ar JSONB DEFAULT '{}',
  delivery_info TEXT,
  delivery_info_ar TEXT,
  name_ar TEXT,
  short_description_ar TEXT,
  description_ar TEXT,
  seo_title TEXT,
  seo_title_ar TEXT,
  seo_description TEXT,
  seo_description_ar TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- PRODUCT VARIANTS
-- ------------------------------------------------------------
CREATE TABLE product_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC(12,2),
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  size TEXT,
  color TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- WISHLISTS
-- ------------------------------------------------------------
CREATE TABLE wishlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ------------------------------------------------------------
-- CARTS (server-side cart persistence)
-- ------------------------------------------------------------
CREATE TABLE carts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cart_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- COUPONS
-- ------------------------------------------------------------
CREATE TABLE coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  min_order_value NUMERIC(12,2),
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  max_discount_amount NUMERIC(12,2),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'payment_review' CHECK (status IN ('pending','payment_review','confirmed','processing','shipped','delivered','completed','cancelled','refunded')),
  payment_status TEXT CHECK (payment_status IN ('awaiting_payment','payment_submitted','under_review','approved','rejected','cancelled')),
  payment_method TEXT CHECK (payment_method IN ('instapay','vodafone_cash')),
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  shipping_fee NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  coupon_code TEXT,
  stock_reserved BOOLEAN DEFAULT FALSE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address JSONB DEFAULT '{}',
  notes TEXT,
  internal_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ORDER ITEMS (snapshots of the purchased products)
-- ------------------------------------------------------------
CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  product_type TEXT DEFAULT 'physical',
  image TEXT,
  price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total NUMERIC(12,2) NOT NULL,
  fulfillment_note TEXT,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- PAYMENTS (manual InstaPay / Vodafone Cash verification)
-- ------------------------------------------------------------
CREATE TABLE payments (
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

-- ------------------------------------------------------------
-- ORDER EVENTS (order timeline, auditable history)
-- ------------------------------------------------------------
CREATE TABLE order_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('order_created','status_change','payment_submitted','payment_reviewed','note','fulfillment','cancellation')),
  status TEXT,
  payment_status TEXT,
  message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- INVENTORY LOGS (auditable stock movements)
-- ------------------------------------------------------------
CREATE TABLE inventory_logs (
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
-- HOMEPAGE SECTIONS (CMS: order / visibility / bilingual content)
-- ------------------------------------------------------------
CREATE TABLE homepage_sections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  title_en TEXT,
  title_ar TEXT,
  subtitle_en TEXT,
  subtitle_ar TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- REVIEWS
-- ------------------------------------------------------------
CREATE TABLE reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- SITE SETTINGS
-- ------------------------------------------------------------
CREATE TABLE site_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_name TEXT DEFAULT 'SAIF STORE',
  store_description TEXT DEFAULT '',
  logo_url TEXT,
  favicon_url TEXT,
  contact_email TEXT DEFAULT 'hello@saifstore.com',
  contact_phone TEXT,
  social_links JSONB DEFAULT '{}',
  announcement TEXT,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  currency TEXT DEFAULT 'EGP',
  shipping_fee NUMERIC(12,2) DEFAULT 0,
  free_shipping_threshold NUMERIC(12,2),
  min_order_amount NUMERIC(12,2),
  payment_number TEXT DEFAULT '01040324811',
  instapay_enabled BOOLEAN DEFAULT TRUE,
  vodafone_cash_enabled BOOLEAN DEFAULT TRUE,
  payment_instructions TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_title_ar TEXT,
  hero_subtitle_ar TEXT,
  hero_image TEXT,
  footer_text TEXT,
  footer_text_ar TEXT,
  store_description_ar TEXT,
  default_language TEXT DEFAULT 'en' CHECK (default_language IN ('en', 'ar')),
  available_languages TEXT[] DEFAULT ARRAY['en','ar'],
  announcement_enabled BOOLEAN DEFAULT TRUE,
  announcement_ar TEXT,
  announcement_link TEXT,
  announcement_link_text TEXT,
  shipping_info TEXT,
  shipping_info_ar TEXT,
  seo_title TEXT,
  seo_description TEXT,
  og_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_bestseller ON products(bestseller);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_wishlists_user ON wishlists(user_id);
CREATE INDEX idx_wishlists_user_product ON wishlists(user_id, product_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_order_events_order ON order_events(order_id, created_at);
CREATE INDEX idx_inventory_logs_product ON inventory_logs(product_id, created_at DESC);
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_coupons_active ON coupons(is_active);
CREATE UNIQUE INDEX idx_homepage_sections_key ON homepage_sections(section_key);
CREATE INDEX idx_homepage_sections_position ON homepage_sections(position);

-- ------------------------------------------------------------
-- updated_at TRIGGERS
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER carts_updated_at BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER homepage_sections_updated_at BEFORE UPDATE ON homepage_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- ROLE-ESCALATION GUARD (defense in depth, see functions.sql)
-- ------------------------------------------------------------
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


-- ============================================================
-- SAIF STORE — Database functions (RPCs)
-- Idempotent: safe to re-run.
-- All SECURITY DEFINER functions pin search_path and validate
-- permissions explicitly. Execute rights are revoked from
-- PUBLIC/anon and granted only where required.
-- ============================================================

-- ------------------------------------------------------------
-- Helper: is the current caller an admin?
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

-- ------------------------------------------------------------
-- Helper: compute the discount a coupon grants for a subtotal.
-- Returns the discount amount, or raises with a reason.
-- Used inside place_order (server-side authority).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coupon_discount(p_code TEXT, p_subtotal NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_discount NUMERIC(12,2);
BEGIN
  SELECT * INTO c FROM coupons WHERE UPPER(code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon code not found';
  END IF;
  IF NOT c.is_active THEN
    RAISE EXCEPTION 'This coupon is no longer active';
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < NOW() THEN
    RAISE EXCEPTION 'This coupon has expired';
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses_count >= c.max_uses THEN
    RAISE EXCEPTION 'This coupon has reached its usage limit';
  END IF;
  IF c.min_order_value IS NOT NULL AND p_subtotal < c.min_order_value THEN
    RAISE EXCEPTION 'This coupon requires a minimum order of %', c.min_order_value;
  END IF;

  IF c.type = 'percentage' THEN
    v_discount := ROUND(p_subtotal * c.value / 100.0, 2);
    IF c.max_discount_amount IS NOT NULL THEN
      v_discount := LEAST(v_discount, c.max_discount_amount);
    END IF;
  ELSE
    v_discount := LEAST(c.value, p_subtotal);
  END IF;

  RETURN v_discount;
END;
$$;

-- ------------------------------------------------------------
-- Public: validate a coupon for a given subtotal without
-- applying it. Used by the cart/checkout UI.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_subtotal NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_discount NUMERIC(12,2);
BEGIN
  SELECT * INTO c FROM coupons WHERE UPPER(code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Coupon code not found');
  END IF;
  IF NOT c.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'This coupon is no longer active');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'This coupon has expired');
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses_count >= c.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'This coupon has reached its usage limit');
  END IF;
  IF c.min_order_value IS NOT NULL AND p_subtotal < c.min_order_value THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Minimum order of ' || c.min_order_value || ' required for this coupon');
  END IF;

  IF c.type = 'percentage' THEN
    v_discount := ROUND(p_subtotal * c.value / 100.0, 2);
    IF c.max_discount_amount IS NOT NULL THEN
      v_discount := LEAST(v_discount, c.max_discount_amount);
    END IF;
  ELSE
    v_discount := LEAST(c.value, p_subtotal);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'reason', NULL,
    'discount', v_discount,
    'coupon', jsonb_build_object(
      'code', c.code,
      'type', c.type,
      'value', c.value,
      'min_order_value', c.min_order_value,
      'max_discount_amount', c.max_discount_amount
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- Public: aggregated rating stats for products (approved
-- reviews only). Used for rating badges + sorting.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_rating_stats()
RETURNS TABLE (product_id UUID, avg_rating NUMERIC, review_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.product_id, ROUND(AVG(r.rating), 1) AS avg_rating, COUNT(*) AS review_count
  FROM reviews r
  WHERE r.status = 'approved'
  GROUP BY r.product_id;
$$;

-- ------------------------------------------------------------
-- Helper: restore reserved stock for an order (idempotent).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  it RECORD;
  v_prev INTEGER;
BEGIN
  SELECT id, stock_reserved INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT o.stock_reserved THEN
    RETURN;
  END IF;

  FOR it IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF it.variant_id IS NOT NULL THEN
      SELECT stock INTO v_prev FROM product_variants WHERE id = it.variant_id FOR UPDATE;
      UPDATE product_variants SET stock = stock + it.quantity WHERE id = it.variant_id;
      INSERT INTO inventory_logs (product_id, variant_id, change_type, delta, previous_value, new_value, note, created_by)
      VALUES (it.product_id, it.variant_id, 'restore', it.quantity, v_prev, v_prev + it.quantity, 'Order ' || p_order_id::text || ' cancelled', auth.uid());
    ELSE
      SELECT stock INTO v_prev FROM products WHERE id = it.product_id FOR UPDATE;
      UPDATE products SET stock = stock + it.quantity WHERE id = it.product_id;
      INSERT INTO inventory_logs (product_id, change_type, delta, previous_value, new_value, note, created_by)
      VALUES (it.product_id, 'restore', it.quantity, v_prev, v_prev + it.quantity, 'Order ' || p_order_id::text || ' cancelled', auth.uid());
    END IF;
  END LOOP;

  UPDATE orders SET stock_reserved = FALSE WHERE id = p_order_id;
END;
$$;

-- ------------------------------------------------------------
-- Customer: atomic checkout.
-- Validates the cart against live product data, locks rows,
-- computes all totals server-side, validates the coupon,
-- creates order + items + payment record + timeline event and
-- reserves inventory — all in one transaction.
--
-- p_customer: { name, email, phone }
-- p_items:    [ { product_id, variant_id, quantity } ]
-- p_shipping: { address, governorate, city } | null
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(
  p_customer JSONB,
  p_items JSONB,
  p_coupon_code TEXT,
  p_payment_method TEXT,
  p_shipping JSONB,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_settings RECORD;
  v_item JSONB;
  v_product RECORD;
  v_variant RECORD;
  v_qty INTEGER;
  v_unit_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_subtotal NUMERIC(12,2) := 0;
  v_discount NUMERIC(12,2) := 0;
  v_shipping_fee NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_coupon_id UUID;
  v_order_id UUID;
  v_order_number TEXT;
  v_has_physical BOOLEAN := FALSE;
  v_customer_name TEXT;
  v_customer_email TEXT;
  v_customer_phone TEXT;
  v_image TEXT;
  v_variant_name TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order';
  END IF;
  IF p_payment_method NOT IN ('instapay', 'vodafone_cash') THEN
    RAISE EXCEPTION 'Please choose a payment method';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;

  v_customer_name := TRIM(coalesce(p_customer->>'name', ''));
  v_customer_email := TRIM(coalesce(p_customer->>'email', ''));
  v_customer_phone := TRIM(coalesce(p_customer->>'phone', ''));

  IF v_customer_name = '' OR v_customer_email = '' OR v_customer_phone = '' THEN
    RAISE EXCEPTION 'Please provide your name, email and phone number';
  END IF;

  SELECT * INTO v_settings FROM site_settings ORDER BY id LIMIT 1;

  -- Validate items and compute the subtotal from live DB prices.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'Invalid quantity for one of the items in your cart';
    END IF;

    SELECT id, name, slug, price, stock, status, product_type, thumbnail, images
      INTO v_product
      FROM products
     WHERE id = (v_item->>'product_id')::uuid
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'One of the products in your cart is no longer available';
    END IF;
    IF v_product.status <> 'active' THEN
      RAISE EXCEPTION '"%" is no longer available', v_product.name;
    END IF;

    v_unit_price := v_product.price;
    v_variant := NULL;

    IF v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' <> '' THEN
      SELECT * INTO v_variant FROM product_variants
       WHERE id = (v_item->>'variant_id')::uuid
         AND product_id = v_product.id
         FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected option for "%" is no longer available', v_product.name;
      END IF;
      IF v_variant.stock IS NOT NULL AND v_qty > v_variant.stock THEN
        RAISE EXCEPTION 'Only % left of "%" (%)', v_variant.stock, v_product.name, v_variant.name;
      END IF;
      IF v_variant.price IS NOT NULL THEN
        v_unit_price := v_variant.price;
      END IF;
    ELSE
      IF v_qty > v_product.stock THEN
        RAISE EXCEPTION 'Only % left of "%"', v_product.stock, v_product.name;
      END IF;
    END IF;

    IF v_product.product_type = 'physical' THEN
      v_has_physical := TRUE;
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  END LOOP;

  v_subtotal := ROUND(v_subtotal, 2);

  IF v_settings.min_order_amount IS NOT NULL AND v_settings.min_order_amount > 0 AND v_subtotal < v_settings.min_order_amount THEN
    RAISE EXCEPTION 'The minimum order amount is %', v_settings.min_order_amount;
  END IF;

  -- Coupon (validated and locked server-side).
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    SELECT id INTO v_coupon_id FROM coupons WHERE UPPER(code) = UPPER(TRIM(p_coupon_code)) FOR UPDATE;
    IF v_coupon_id IS NULL THEN
      RAISE EXCEPTION 'Coupon code not found';
    END IF;
    v_discount := public.coupon_discount(p_coupon_code, v_subtotal);
  END IF;

  -- Shipping (physical goods only; free above threshold).
  IF v_has_physical THEN
    IF p_shipping IS NULL
       OR TRIM(coalesce(p_shipping->>'address', '')) = ''
       OR TRIM(coalesce(p_shipping->>'governorate', '')) = ''
       OR TRIM(coalesce(p_shipping->>'city', '')) = '' THEN
      RAISE EXCEPTION 'Please provide a complete delivery address';
    END IF;
    IF v_settings.free_shipping_threshold IS NOT NULL AND v_subtotal >= v_settings.free_shipping_threshold THEN
      v_shipping_fee := 0;
    ELSE
      v_shipping_fee := COALESCE(v_settings.shipping_fee, 0);
    END IF;
  END IF;

  v_total := ROUND(v_subtotal - v_discount + v_shipping_fee, 2);
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  -- Generate a unique order number.
  v_order_number := 'SAIF-' || to_char(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6));
  IF EXISTS (SELECT 1 FROM orders WHERE order_number = v_order_number) THEN
    v_order_number := v_order_number || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4));
  END IF;

  INSERT INTO orders (
    order_number, user_id, status, payment_status, payment_method,
    subtotal, discount, shipping_fee, total, coupon_code, stock_reserved,
    customer_name, customer_email, customer_phone, shipping_address, notes
  ) VALUES (
    v_order_number, v_user, 'payment_review', 'awaiting_payment', p_payment_method,
    v_subtotal, v_discount, v_shipping_fee, v_total, NULLIF(TRIM(coalesce(p_coupon_code, '')), ''),
    TRUE,
    v_customer_name, v_customer_email, v_customer_phone,
    CASE WHEN v_has_physical THEN COALESCE(p_shipping, '{}'::jsonb) ELSE '{}'::jsonb END,
    NULLIF(TRIM(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO v_order_id;

  -- Insert item snapshots, decrement stock, log inventory.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::integer;

    SELECT id, name, price, stock, product_type, thumbnail, images INTO v_product
      FROM products WHERE id = (v_item->>'product_id')::uuid;
    v_unit_price := v_product.price;
    v_variant := NULL;
    v_variant_name := NULL;
    v_image := COALESCE(v_product.thumbnail, v_product.images[1]);

    IF v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' <> '' THEN
      SELECT * INTO v_variant FROM product_variants WHERE id = (v_item->>'variant_id')::uuid;
      v_variant_name := v_variant.name;
      IF v_variant.price IS NOT NULL THEN
        v_unit_price := v_variant.price;
      END IF;
      IF v_variant.image IS NOT NULL THEN
        v_image := v_variant.image;
      END IF;
      UPDATE product_variants SET stock = stock - v_qty WHERE id = v_variant.id;
      INSERT INTO inventory_logs (product_id, variant_id, change_type, delta, previous_value, new_value, note, created_by)
      VALUES (v_product.id, v_variant.id, 'order', -v_qty, v_variant.stock, v_variant.stock - v_qty, 'Order ' || v_order_number, v_user);
    ELSE
      UPDATE products SET stock = stock - v_qty WHERE id = v_product.id;
      INSERT INTO inventory_logs (product_id, change_type, delta, previous_value, new_value, note, created_by)
      VALUES (v_product.id, 'order', -v_qty, v_product.stock, v_product.stock - v_qty, 'Order ' || v_order_number, v_user);
    END IF;

    v_line_total := ROUND(v_unit_price * v_qty, 2);

    INSERT INTO order_items (
      order_id, product_id, variant_id, product_name, variant_name,
      product_type, image, price, quantity, total
    ) VALUES (
      v_order_id, (v_item->>'product_id')::uuid, NULLIF(v_item->>'variant_id', '')::uuid,
      v_product.name, v_variant_name, v_product.product_type, v_image,
      v_unit_price, v_qty, v_line_total
    );
  END LOOP;

  -- Payment record awaiting the customer's transfer proof.
  INSERT INTO payments (order_id, payment_method, payment_status, expected_amount)
  VALUES (v_order_id, p_payment_method, 'awaiting_payment', v_total);

  -- Consume the coupon.
  IF v_coupon_id IS NOT NULL THEN
    UPDATE coupons SET uses_count = uses_count + 1 WHERE id = v_coupon_id;
  END IF;

  INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
  VALUES (v_order_id, 'order_created', 'payment_review', 'awaiting_payment',
          'Order placed. Awaiting payment confirmation.', v_user);

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'shipping_fee', v_shipping_fee,
    'total', v_total
  );
END;
$$;

-- ------------------------------------------------------------
-- Customer: submit manual payment evidence (InstaPay /
-- Vodafone Cash). Marks the payment as under review.
-- The screenshot must already be uploaded to the private
-- payment-screenshots bucket under the customer's own folder.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_payment(
  p_order_id UUID,
  p_payer_identifier TEXT,
  p_transferred_amount NUMERIC,
  p_screenshot_path TEXT,
  p_customer_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  o RECORD;
  p RECORD;
  v_payer TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO o FROM orders WHERE id = p_order_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT * INTO p FROM payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No payment record found for this order';
  END IF;

  IF p.payment_status IN ('approved', 'cancelled') THEN
    RAISE EXCEPTION 'This payment has already been % — it can no longer be modified', p.payment_status;
  END IF;

  v_payer := TRIM(coalesce(p_payer_identifier, ''));
  IF v_payer = '' OR v_payer !~ '^[0-9A-Za-z@._\-]{6,40}$' THEN
    RAISE EXCEPTION 'Please provide a valid payer phone number / account identifier';
  END IF;
  IF p.payment_method = 'vodafone_cash' AND v_payer !~ '^01[0-9]{9}$' THEN
    RAISE EXCEPTION 'Please provide a valid Vodafone Cash phone number (11 digits starting with 01)';
  END IF;
  IF p_transferred_amount IS NULL OR p_transferred_amount <= 0 THEN
    RAISE EXCEPTION 'Please enter the amount you transferred';
  END IF;
  IF p_screenshot_path IS NULL OR p_screenshot_path = '' THEN
    RAISE EXCEPTION 'Please upload a screenshot of your transfer';
  END IF;
  IF p_screenshot_path NOT LIKE v_user::text || '/%' OR p_screenshot_path LIKE '%..%' THEN
    RAISE EXCEPTION 'Invalid screenshot reference';
  END IF;

  UPDATE payments SET
    payer_identifier = v_payer,
    transferred_amount = p_transferred_amount,
    screenshot_path = p_screenshot_path,
    customer_note = NULLIF(TRIM(coalesce(p_customer_note, '')), ''),
    payment_status = 'under_review',
    rejection_reason = NULL,
    verified_by = NULL,
    verified_at = NULL,
    updated_at = NOW()
  WHERE id = p.id;

  UPDATE orders SET
    payment_status = 'under_review',
    status = 'payment_review',
    updated_at = NOW()
  WHERE id = o.id;

  INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
  VALUES (o.id, 'payment_submitted', 'payment_review', 'under_review',
          'Payment evidence submitted via ' || REPLACE(p.payment_method, '_', ' ') || '. Under review.', v_user);

  RETURN jsonb_build_object('payment_id', p.id, 'payment_status', 'under_review');
END;
$$;

-- ------------------------------------------------------------
-- Admin: review a payment (approve / reject / under review /
-- cancel). Rejecting requires a reason. Approving records the
-- verifier and timestamps, and confirms the order.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_payment(
  p_payment_id UUID,
  p_decision TEXT,
  p_admin_note TEXT,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  p RECORD;
  o RECORD;
  v_note TEXT;
  v_reason TEXT;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'under_review', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO p FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  SELECT * INTO o FROM orders WHERE id = p.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF p.payment_status = p_decision THEN
    RAISE EXCEPTION 'Payment is already marked as %', p_decision;
  END IF;

  v_note := NULLIF(TRIM(coalesce(p_admin_note, '')), '');
  v_reason := NULLIF(TRIM(coalesce(p_rejection_reason, '')), '');

  IF p_decision = 'rejected' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  IF p_decision = 'approved' THEN
    IF o.status IN ('cancelled', 'refunded') THEN
      RAISE EXCEPTION 'Cannot approve a payment for a cancelled or refunded order';
    END IF;
    UPDATE payments SET
      payment_status = 'approved',
      admin_note = v_note,
      rejection_reason = NULL,
      verified_by = v_admin,
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = p.id;

    UPDATE orders SET
      payment_status = 'approved',
      status = CASE WHEN o.status IN ('confirmed','processing','shipped','delivered','completed') THEN o.status ELSE 'confirmed' END,
      updated_at = NOW()
    WHERE id = o.id;

    INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
    VALUES (o.id, 'payment_reviewed', 'confirmed', 'approved', 'Payment approved.', v_admin);

  ELSIF p_decision = 'rejected' THEN
    UPDATE payments SET
      payment_status = 'rejected',
      admin_note = v_note,
      rejection_reason = v_reason,
      verified_by = v_admin,
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = p.id;

    UPDATE orders SET
      payment_status = 'rejected',
      status = 'payment_review',
      updated_at = NOW()
    WHERE id = o.id;

    INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
    VALUES (o.id, 'payment_reviewed', 'payment_review', 'rejected', 'Payment rejected: ' || v_reason, v_admin);

  ELSIF p_decision = 'cancelled' THEN
    UPDATE payments SET
      payment_status = 'cancelled',
      admin_note = v_note,
      updated_at = NOW()
    WHERE id = p.id;

    UPDATE orders SET payment_status = 'cancelled', status = 'cancelled', updated_at = NOW()
    WHERE id = o.id;

    PERFORM public.restore_order_stock(o.id);

    INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
    VALUES (o.id, 'payment_reviewed', 'cancelled', 'cancelled', 'Payment cancelled by admin.', v_admin);

  ELSE -- under_review
    UPDATE payments SET
      payment_status = 'under_review',
      admin_note = v_note,
      rejection_reason = NULL,
      verified_by = NULL,
      verified_at = NULL,
      updated_at = NOW()
    WHERE id = p.id;

    UPDATE orders SET payment_status = 'under_review', status = 'payment_review', updated_at = NOW()
    WHERE id = o.id;

    INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
    VALUES (o.id, 'payment_reviewed', 'payment_review', 'under_review', 'Payment placed under review.', v_admin);
  END IF;

  RETURN jsonb_build_object('payment_id', p.id, 'payment_status', p_decision, 'order_status',
    (SELECT status FROM orders WHERE id = o.id));
END;
$$;

-- ------------------------------------------------------------
-- Admin: update the order status (with timeline entry).
-- Cancelling an order restores reserved stock exactly once.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id UUID,
  p_status TEXT,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  o RECORD;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_status NOT IN ('pending','payment_review','confirmed','processing','shipped','delivered','completed','cancelled','refunded') THEN
    RAISE EXCEPTION 'Invalid order status';
  END IF;

  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  UPDATE orders SET status = p_status, updated_at = NOW() WHERE id = o.id;

  IF p_status = 'cancelled' THEN
    PERFORM public.restore_order_stock(o.id);
  END IF;

  INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
  VALUES (o.id, 'status_change', p_status, o.payment_status, NULLIF(TRIM(coalesce(p_message, '')), ''), v_admin);
END;
$$;

-- ------------------------------------------------------------
-- Admin: add an internal note to an order (timeline entry).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_add_order_note(
  p_order_id UUID,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_note IS NULL OR TRIM(p_note) = '' THEN
    RAISE EXCEPTION 'Note cannot be empty';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  UPDATE orders SET internal_note = TRIM(p_note), updated_at = NOW() WHERE id = p_order_id;

  INSERT INTO order_events (order_id, event_type, message, created_by)
  VALUES (p_order_id, 'note', TRIM(p_note), auth.uid());
END;
$$;

-- ------------------------------------------------------------
-- Admin: fulfill a digital order item (delivery details are
-- only written after the payment has been approved).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_fulfillment(
  p_order_item_id UUID,
  p_fulfillment_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_fulfillment_note IS NULL OR TRIM(p_fulfillment_note) = '' THEN
    RAISE EXCEPTION 'Fulfillment note cannot be empty';
  END IF;

  SELECT oi.*, o.payment_status AS order_payment_status
    INTO it
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
   WHERE oi.id = p_order_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;
  IF it.order_payment_status <> 'approved' THEN
    RAISE EXCEPTION 'Digital delivery details can only be added after the payment is approved';
  END IF;

  UPDATE order_items
     SET fulfillment_note = TRIM(p_fulfillment_note),
         fulfilled_at = NOW()
   WHERE id = p_order_item_id;

  INSERT INTO order_events (order_id, event_type, message, created_by)
  VALUES (it.order_id, 'fulfillment', 'Digital item "' || it.product_name || '" fulfilled.', auth.uid());
END;
$$;

-- ------------------------------------------------------------
-- Customer: cancel their own order while payment has not been
-- approved (restores reserved stock).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_cancel_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  o RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO o FROM orders WHERE id = p_order_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF o.payment_status = 'approved' OR o.status NOT IN ('payment_review', 'pending') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled. Please contact support.';
  END IF;
  IF o.payment_status = 'under_review' THEN
    RAISE EXCEPTION 'Your payment is currently being reviewed. Please wait for the review to finish or contact support.';
  END IF;

  UPDATE orders SET status = 'cancelled', payment_status = 'cancelled', updated_at = NOW() WHERE id = o.id;
  UPDATE payments SET payment_status = 'cancelled', updated_at = NOW() WHERE order_id = o.id;

  PERFORM public.restore_order_stock(o.id);

  INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
  VALUES (o.id, 'cancellation', 'cancelled', 'cancelled', 'Order cancelled by customer.', v_user);
END;
$$;

-- ------------------------------------------------------------
-- Admin: adjust stock with a full audit trail.
-- p_action: set | increase | decrease
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_stock(
  p_product_id UUID,
  p_variant_id UUID,
  p_action TEXT,
  p_value INTEGER,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_prev INTEGER;
  v_new INTEGER;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_action NOT IN ('set', 'increase', 'decrease') THEN
    RAISE EXCEPTION 'Invalid stock action';
  END IF;
  IF p_value IS NULL OR p_value < 0 THEN
    RAISE EXCEPTION 'Value must be zero or more';
  END IF;

  IF p_variant_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM product_variants WHERE id = p_variant_id AND product_id = p_product_id) THEN
      RAISE EXCEPTION 'Variant not found for this product';
    END IF;
    SELECT stock INTO v_prev FROM product_variants WHERE id = p_variant_id FOR UPDATE;
    v_new := CASE p_action
      WHEN 'set' THEN p_value
      WHEN 'increase' THEN v_prev + p_value
      ELSE GREATEST(v_prev - p_value, 0)
    END;
    UPDATE product_variants SET stock = v_new WHERE id = p_variant_id;
    INSERT INTO inventory_logs (product_id, variant_id, change_type, delta, previous_value, new_value, note, created_by)
    VALUES (p_product_id, p_variant_id, p_action, v_new - v_prev, v_prev, v_new, NULLIF(TRIM(coalesce(p_note, '')), ''), v_admin);
  ELSE
    SELECT stock INTO v_prev FROM products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;
    v_new := CASE p_action
      WHEN 'set' THEN p_value
      WHEN 'increase' THEN v_prev + p_value
      ELSE GREATEST(v_prev - p_value, 0)
    END;
    UPDATE products SET stock = v_new WHERE id = p_product_id;
    INSERT INTO inventory_logs (product_id, change_type, delta, previous_value, new_value, note, created_by)
    VALUES (p_product_id, p_action, v_new - v_prev, v_prev, v_new, NULLIF(TRIM(coalesce(p_note, '')), ''), v_admin);
  END IF;

  RETURN jsonb_build_object('previous', v_prev, 'new', v_new);
END;
$$;

-- ------------------------------------------------------------
-- Admin: dashboard overview statistics (real aggregates).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'total_orders', (SELECT COUNT(*) FROM orders),
    'total_revenue', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'approved'),
    'total_customers', (SELECT COUNT(*) FROM profiles WHERE role = 'customer'),
    'total_products', (SELECT COUNT(*) FROM products),
    'pending_orders', (SELECT COUNT(*) FROM orders WHERE status = 'payment_review'),
    'payments_awaiting', (SELECT COUNT(*) FROM payments WHERE payment_status = 'awaiting_payment'),
    'payments_under_review', (SELECT COUNT(*) FROM payments WHERE payment_status = 'under_review'),
    'payments_approved', (SELECT COUNT(*) FROM payments WHERE payment_status = 'approved'),
    'payments_rejected', (SELECT COUNT(*) FROM payments WHERE payment_status = 'rejected'),
    'low_stock_products', (SELECT COUNT(*) FROM products WHERE status = 'active' AND product_type = 'physical' AND stock <= low_stock_threshold AND stock > 0),
    'out_of_stock_products', (SELECT COUNT(*) FROM products WHERE status = 'active' AND stock = 0),
    'digital_orders', (SELECT COUNT(DISTINCT order_id) FROM order_items WHERE product_type = 'digital'),
    'recent_orders', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT o.id, o.order_number, o.customer_name, o.total, o.status, o.payment_status, o.created_at
        FROM orders o ORDER BY o.created_at DESC LIMIT 10
      ) t
    ),
    'recent_payments', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT p.id, p.order_id, p.payment_method, p.payment_status, p.expected_amount, p.transferred_amount,
               p.payer_identifier, p.created_at, o.order_number, o.customer_name, o.customer_phone
        FROM payments p JOIN orders o ON o.id = p.order_id
        ORDER BY p.created_at DESC LIMIT 8
      ) t
    ),
    'best_sellers', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT pr.id, pr.name, pr.slug, pr.thumbnail, SUM(oi.quantity) AS quantity_sold,
               SUM(oi.total) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.payment_status = 'approved'
        JOIN products pr ON pr.id = oi.product_id
        GROUP BY pr.id, pr.name, pr.slug, pr.thumbnail
        ORDER BY quantity_sold DESC LIMIT 5
      ) t
    ),
    'low_stock_list', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT p.id, p.name, p.sku, p.stock, p.low_stock_threshold
        FROM products p
        WHERE p.status = 'active' AND p.stock <= p.low_stock_threshold
        ORDER BY p.stock ASC LIMIT 8
      ) t
    ),
    'sales_trend', (
      SELECT COALESCE(jsonb_agg(t ORDER BY day), '[]'::jsonb) FROM (
        SELECT d::date AS day,
               COALESCE(SUM(o.total), 0) AS revenue,
               COUNT(o.id) AS orders
        FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
        LEFT JOIN orders o ON o.created_at::date = d::date AND o.payment_status = 'approved'
        GROUP BY d
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- Admin: sales analytics over a window (default 30 days).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_sales_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER := GREATEST(LEAST(COALESCE(p_days, 30), 365), 1);
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'days', v_days,
    'daily', (
      SELECT COALESCE(jsonb_agg(t ORDER BY day), '[]'::jsonb) FROM (
        SELECT d::date AS day,
               COALESCE(SUM(o.total), 0) AS revenue,
               COUNT(o.id) AS orders
        FROM generate_series(CURRENT_DATE - (v_days - 1) * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') d
        LEFT JOIN orders o ON o.created_at::date = d::date
        GROUP BY d
      ) t
    ),
    'paid_daily', (
      SELECT COALESCE(jsonb_agg(t ORDER BY day), '[]'::jsonb) FROM (
        SELECT d::date AS day,
               COALESCE(SUM(o.total), 0) AS revenue,
               COUNT(o.id) AS orders
        FROM generate_series(CURRENT_DATE - (v_days - 1) * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') d
        LEFT JOIN orders o ON o.created_at::date = d::date AND o.payment_status = 'approved'
        GROUP BY d
      ) t
    ),
    'total_revenue_paid', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'approved'),
    'total_revenue_all', (SELECT COALESCE(SUM(total), 0) FROM orders),
    'total_orders', (SELECT COUNT(*) FROM orders),
    'avg_order_value', (SELECT COALESCE(ROUND(AVG(total), 2), 0) FROM orders WHERE payment_status = 'approved'),
    'top_products', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT pr.name, pr.slug, SUM(oi.quantity) AS quantity, SUM(oi.total) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products pr ON pr.id = oi.product_id
        WHERE o.payment_status = 'approved'
        GROUP BY pr.name, pr.slug
        ORDER BY revenue DESC LIMIT 10
      ) t
    ),
    'top_categories', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT c.name, SUM(oi.quantity) AS quantity, SUM(oi.total) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.payment_status = 'approved'
        JOIN products pr ON pr.id = oi.product_id
        JOIN categories c ON c.id = pr.category_id
        GROUP BY c.name
        ORDER BY revenue DESC LIMIT 10
      ) t
    ),
    'payment_methods', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT p.payment_method, COUNT(*) AS count, COALESCE(SUM(p.expected_amount), 0) AS amount
        FROM payments p GROUP BY p.payment_method
      ) t
    ),
    'order_status_distribution', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT o.status, COUNT(*) AS count FROM orders o GROUP BY o.status
      ) t
    ),
    'product_type_split', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT oi.product_type, SUM(oi.quantity) AS quantity, SUM(oi.total) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.payment_status = 'approved'
        GROUP BY oi.product_type
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- Admin: customers with real order statistics.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_customer_stats()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ,
  orders_count BIGINT,
  total_spent NUMERIC,
  last_order_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.id, pr.full_name, au.email, pr.phone, pr.created_at,
         COUNT(o.id) AS orders_count,
         COALESCE(SUM(CASE WHEN o.payment_status = 'approved' THEN o.total ELSE 0 END), 0) AS total_spent,
         MAX(o.created_at) AS last_order_at
  FROM profiles pr
  JOIN auth.users au ON au.id = pr.id
  LEFT JOIN orders o ON o.user_id = pr.id
  WHERE pr.role = 'customer'
  GROUP BY pr.id, pr.full_name, au.email, pr.phone, pr.created_at
  ORDER BY pr.created_at DESC;
$$;

-- ------------------------------------------------------------
-- Search suggestions for the storefront.
-- Matches product name, category name and tags.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_suggestions(p_query TEXT, p_limit INTEGER DEFAULT 6)
RETURNS TABLE (id UUID, name TEXT, slug TEXT, thumbnail TEXT, price NUMERIC, category_name TEXT, product_type TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.slug, p.thumbnail, p.price, c.name AS category_name, p.product_type
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.status = 'active'
    AND p.name ILIKE '%' || p_query || '%'
  ORDER BY p.featured DESC, p.bestseller DESC, p.created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 6), 20);
$$;

-- ------------------------------------------------------------
-- Function grants
-- ------------------------------------------------------------
-- is_admin() is referenced by RLS policies that also apply to the anon
-- role (e.g. the public products policy), so anon must be able to EXECUTE
-- it. For anon it always returns FALSE (auth.uid() is null) — no data leaks.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

REVOKE ALL ON FUNCTION public.coupon_discount(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_coupon(TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.get_product_rating_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_rating_stats() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.restore_order_stock(UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.place_order(JSONB, JSONB, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB, TEXT, TEXT, JSONB, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_payment(UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment(UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.review_payment(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_payment(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_order_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_add_order_note(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_order_note(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_fulfillment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_fulfillment(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.customer_cancel_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_cancel_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_adjust_stock(UUID, UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_stock(UUID, UUID, TEXT, INTEGER, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_sales_analytics(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sales_analytics(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_customer_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_customer_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.search_suggestions(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_suggestions(TEXT, INTEGER) TO anon, authenticated;


-- ============================================================
-- SAIF STORE — Row Level Security policies
-- Safe to re-run: every policy is dropped before it is recreated.
-- Includes column-level grants that block role escalation and
-- storage policies for payment screenshots / product images.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_sections ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- PROFILES
-- SECURITY: users can never modify their own `role`.
-- 1) Column-level grants remove UPDATE/INSERT rights on `role`.
-- 2) A trigger raises if a non-admin changes the role.
-- 3) RLS restricts rows to the owner (admins see all).
-- ------------------------------------------------------------
-- Legacy policy names from the original project (must be removed so they
-- do not OR-combine with the new policies)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Profiles select own or admin" ON profiles;
CREATE POLICY "Profiles select own or admin"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Profiles update own" ON profiles;
CREATE POLICY "Profiles update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles insert own" ON profiles;
CREATE POLICY "Profiles insert own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Column-level privileges: the `role` and `id` columns can no
-- longer be written by the anon/authenticated PostgREST roles.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, phone, address) ON public.profiles TO authenticated;
REVOKE INSERT ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, full_name, avatar_url, phone, address) ON public.profiles TO authenticated;

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Categories public read" ON categories;
CREATE POLICY "Categories public read"
  ON categories FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Categories admin write" ON categories;
CREATE POLICY "Categories admin write"
  ON categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Products public read active" ON products;
CREATE POLICY "Products public read active"
  ON products FOR SELECT
  TO authenticated, anon
  USING (status = 'active' OR public.is_admin());

DROP POLICY IF EXISTS "Products admin all" ON products;

DROP POLICY IF EXISTS "Products admin insert" ON products;
CREATE POLICY "Products admin insert"
  ON products FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Products admin update" ON products;
CREATE POLICY "Products admin update"
  ON products FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Products admin delete" ON products;
CREATE POLICY "Products admin delete"
  ON products FOR DELETE
  USING (public.is_admin());

-- ------------------------------------------------------------
-- PRODUCT VARIANTS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Variants public read" ON product_variants;
CREATE POLICY "Variants public read"
  ON product_variants FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Variants admin write" ON product_variants;
CREATE POLICY "Variants admin write"
  ON product_variants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- WISHLISTS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Wishlists own" ON wishlists;
CREATE POLICY "Wishlists own"
  ON wishlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- CARTS / CART ITEMS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Carts own or session" ON carts;
CREATE POLICY "Carts own or session"
  ON carts FOR ALL
  USING (user_id = auth.uid() OR session_id = coalesce(current_setting('request.headers'::text, true)::json->>'x-session-id', ''));

DROP POLICY IF EXISTS "Cart items through cart" ON cart_items;
CREATE POLICY "Cart items through cart"
  ON cart_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM carts
    WHERE carts.id = cart_items.cart_id
      AND (carts.user_id = auth.uid()
           OR carts.session_id = coalesce(current_setting('request.headers'::text, true)::json->>'x-session-id', ''))
  ));

-- ------------------------------------------------------------
-- ORDERS
-- Orders are created exclusively through the place_order RPC,
-- so there is no direct customer INSERT policy.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Orders own" ON orders;

DROP POLICY IF EXISTS "Orders select own or admin" ON orders;
CREATE POLICY "Orders select own or admin"
  ON orders FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Orders admin update" ON orders;
CREATE POLICY "Orders admin update"
  ON orders FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Orders admin delete" ON orders;
CREATE POLICY "Orders admin delete"
  ON orders FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Orders user insert" ON orders;
DROP POLICY IF EXISTS "Orders admin insert" ON orders;
CREATE POLICY "Orders admin insert"
  ON orders FOR INSERT
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- ORDER ITEMS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Order items through order" ON order_items;

DROP POLICY IF EXISTS "Order items select through order" ON order_items;
CREATE POLICY "Order items select through order"
  ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR public.is_admin())
  ));

DROP POLICY IF EXISTS "Order items admin manage" ON order_items;
CREATE POLICY "Order items admin manage"
  ON order_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Order items own insert" ON order_items;
DROP POLICY IF EXISTS "Order items admin delete" ON order_items;
DROP POLICY IF EXISTS "Order items admin update" ON order_items;

-- ------------------------------------------------------------
-- PAYMENTS
-- Customers can read their own payment records (through the
-- order). All mutations happen through RPCs that verify
-- permissions — no direct customer write policies.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Payments own read" ON payments;

DROP POLICY IF EXISTS "Payments select own or admin" ON payments;
CREATE POLICY "Payments select own or admin"
  ON payments FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Payments admin update" ON payments;
CREATE POLICY "Payments admin update"
  ON payments FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Payments admin insert" ON payments;
DROP POLICY IF EXISTS "Payments admin delete" ON payments;

-- ------------------------------------------------------------
-- ORDER EVENTS (timeline)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Order events select through order" ON order_events;
CREATE POLICY "Order events select through order"
  ON order_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_events.order_id
      AND (orders.user_id = auth.uid() OR public.is_admin())
  ));

DROP POLICY IF EXISTS "Order events admin insert" ON order_events;
CREATE POLICY "Order events admin insert"
  ON order_events FOR INSERT
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- INVENTORY LOGS (admin only)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Inventory logs admin read" ON inventory_logs;
CREATE POLICY "Inventory logs admin read"
  ON inventory_logs FOR SELECT
  USING (public.is_admin());

-- ------------------------------------------------------------
-- COUPONS
-- Coupon codes are NOT exposed publicly — customers validate
-- codes through the validate_coupon RPC only.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Coupons public read active" ON coupons;
DROP POLICY IF EXISTS "Coupons admin all" ON coupons;
CREATE POLICY "Coupons admin all"
  ON coupons FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- REVIEWS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Reviews public read approved" ON reviews;
DROP POLICY IF EXISTS "Reviews own read" ON reviews;
DROP POLICY IF EXISTS "Reviews own write" ON reviews;
DROP POLICY IF EXISTS "Reviews read approved or own" ON reviews;
CREATE POLICY "Reviews read approved or own"
  ON reviews FOR SELECT
  TO authenticated, anon
  USING (status = 'approved' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Reviews own insert" ON reviews;
CREATE POLICY "Reviews own insert"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Reviews admin manage" ON reviews;
CREATE POLICY "Reviews admin manage"
  ON reviews FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- HOMEPAGE SECTIONS (CMS content — public read, admin write)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Homepage sections public read" ON homepage_sections;
CREATE POLICY "Homepage sections public read"
  ON homepage_sections FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Homepage sections admin write" ON homepage_sections;
CREATE POLICY "Homepage sections admin write"
  ON homepage_sections FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- SITE SETTINGS (no secrets stored here)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Site settings public read" ON site_settings;
CREATE POLICY "Site settings public read"
  ON site_settings FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Site settings admin write" ON site_settings;
CREATE POLICY "Site settings admin write"
  ON site_settings FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- STORAGE
-- ============================================================

-- Private bucket for payment screenshots (5 MB, images only).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-screenshots', 'payment-screenshots', false, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 5242880,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public bucket for product images (5 MB, images only).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 'product-images', true, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Payment screenshots: customers may upload only into their own
-- folder (payment-screenshots/<user_id>/...) and may read only
-- their own files. Admins can read everything in the bucket.
-- (Also remove legacy sibling policies that granted owner update/delete.)
DROP POLICY IF EXISTS "Screenshots owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Screenshots owner or admin read" ON storage.objects;
DROP POLICY IF EXISTS "Screenshots owner update" ON storage.objects;
DROP POLICY IF EXISTS "Screenshots owner delete" ON storage.objects;

DROP POLICY IF EXISTS "Payment screenshots customer upload" ON storage.objects;
CREATE POLICY "Payment screenshots customer upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Payment screenshots customer read" ON storage.objects;
CREATE POLICY "Payment screenshots customer read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Payment screenshots admin read" ON storage.objects;
CREATE POLICY "Payment screenshots admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Payment screenshots admin delete" ON storage.objects;
CREATE POLICY "Payment screenshots admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND public.is_admin()
  );

-- Product images: public bucket (public read is implied), admin write.
DROP POLICY IF EXISTS "Product images admin insert" ON storage.objects;
CREATE POLICY "Product images admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Product images admin update" ON storage.objects;
CREATE POLICY "Product images admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Product images admin delete" ON storage.objects;
CREATE POLICY "Product images admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  );


-- ============================================================
-- SAIF STORE — Seed data (fresh install)
-- Catalog priced in EGP for the Egyptian market
-- (InstaPay / Vodafone Cash are EGP payment rails).
-- ============================================================

-- Site settings
INSERT INTO site_settings (
  store_name, store_description, store_description_ar, contact_email, contact_phone, currency,
  shipping_fee, free_shipping_threshold, payment_number,
  instapay_enabled, vodafone_cash_enabled, payment_instructions,
  announcement, announcement_ar, announcement_enabled, hero_title, hero_subtitle,
  hero_title_ar, hero_subtitle_ar, footer_text, footer_text_ar, default_language, seo_title, seo_description
) VALUES (
  'SAIF STORE',
  'Premium streetwear and digital products, curated in Egypt.',
  'ستريت وير ومنتجات رقمية بريميوم، مختارة بعناية في مصر.',
  'hello@saifstore.com',
  '01040324811',
  'EGP',
  75.00,
  1500.00,
  '01040324811',
  true,
  true,
  'Transfer the exact order total, then upload a screenshot of the confirmation. Payments are verified manually, usually within a few hours.',
  'Free shipping on orders over EGP 1,500',
  'شحن مجاني على الطلبات أكتر من 1,500 جنيه',
  true,
  'SAIF STORE',
  'Premium streetwear and digital products. Carefully curated.',
  'SAIF STORE',
  'ستريت وير ومنتجات رقمية بريميوم. مختارين بعناية.',
  '© SAIF STORE. All rights reserved.',
  '© SAIF STORE. كل الحقوق محفوظة.',
  'en',
  'SAIF STORE — Premium Streetwear & Digital Products',
  'Premium streetwear and digital products, curated in Egypt. Manual payment via InstaPay & Vodafone Cash.'
);

-- Categories
INSERT INTO categories (name, name_ar, slug, description, description_ar, sort_order, is_active) VALUES
  ('T-Shirts', 'تيشيرتات', 't-shirts', 'Premium heavyweight cotton tees', 'تيشيرتات قطن تقيلة بريميوم', 1, true),
  ('Hoodies', 'هوديز', 'hoodies', 'Oversized and classic hoodies', 'هودي أوفرسايز وكلاسيك', 2, true),
  ('Streetwear', 'ستريت وير', 'streetwear', 'Bottoms and layered pieces', 'بناطيل وقطع طبقات', 3, true),
  ('Accessories', 'أكسسوارات', 'accessories', 'Caps, bags, beanies and more', 'كابات وشنط وباني وأكتر', 4, true),
  ('Digital Products', 'منتجات رقمية', 'digital-products', 'Digital goods and licenses', 'منتجات وخدمات رقمية', 5, true),
  ('Social Media Services', 'خدمات سوشيال ميديا', 'social-media', 'Boost packages delivered after confirmation', 'باقات بوست بتوصلك بعد التأكيد', 6, true);

-- Physical products
INSERT INTO products (name, slug, description, short_description, description_ar, short_description_ar, price, compare_at_price, product_type, category_id, images, thumbnail, stock, low_stock_threshold, sku, status, featured, bestseller, tags, specifications) VALUES
  ('Off by Design Tee', 'off-by-design-tee',
   'Made to be worn. Or judged. Or both. Premium 240gsm heavyweight cotton with a minimal screen-printed design. Pre-shrunk, boxy fit, built to outlast trends.',
   '240gsm heavyweight cotton tee.',
   'اتعملت عشان تتلبس. أو تحكم عليها. أو الاتنين. قطن تقيل 240 جرام بطبعة سكرين بسيطة. مقاس بوكسي مسبق التقليص، معمولة تعيش أطول من الترند.',
   'تيشيرت قطن تقيل 240 جرام.',
   850.00, 1050.00, 'physical', (SELECT id FROM categories WHERE slug = 't-shirts'),
   ARRAY['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&q=80', 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&q=80'],
   'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&q=80',
   24, 5, 'SAIF-TS-001', 'active', true, true, ARRAY['tee', 'cotton', 'minimal'],
   '{"Material": "100% cotton, 240gsm", "Fit": "Boxy / oversized", "Care": "Machine wash cold, hang dry"}'::jsonb),
  ('Layered Signal Tee', 'layered-signal-tee',
   'A quiet tee with a loud grid. Mid-weight ring-spun cotton with a small chest hit and drop shoulder.',
   'Mid-weight ring-spun cotton tee.',
   'تيشيرت هادي بشبكة عالية الصوت. قطن رينج سبون متوسط بياقة مرتخية وطبعة صغيرة على الصدر.',
   'تيشيرت قطن رينج سبون متوسط.',
   720.00, NULL, 'physical', (SELECT id FROM categories WHERE slug = 't-shirts'),
   ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80'],
   'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80',
   30, 5, 'SAIF-TS-002', 'active', false, false, ARRAY['tee', 'cotton'],
   '{"Material": "100% ring-spun cotton", "Fit": "Regular"}'::jsonb),
  ('Command K Hoodie', 'command-k-hoodie',
   'The shortcut to comfort. 400gsm brushed fleece hoodie with kangaroo pocket, tonal embroidery and ribbed cuffs.',
   '400gsm brushed fleece hoodie.',
   'الشورت كت للراحة. هودي فليس مبرّد 400 جرام بجيب كنغر وتطريز تونال وأساور مضلعة.',
   'هودي فليس مبرّد 400 جرام.',
   1450.00, 1750.00, 'physical', (SELECT id FROM categories WHERE slug = 'hoodies'),
   ARRAY['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&q=80', 'https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=900&q=80'],
   'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&q=80',
   12, 4, 'SAIF-HD-001', 'active', true, true, ARRAY['hoodie', 'oversized', 'fleece'],
   '{"Material": "80% cotton / 20% polyester fleece", "Weight": "400gsm", "Fit": "Oversized"}'::jsonb),
  ('Monochrome Joggers', 'monochrome-joggers',
   'A declaration of intent. Relaxed fit joggers in heavy cotton twill with elastic cuffs and side pockets.',
   'Heavy twill relaxed joggers.',
   'إعلان نوايا. جوجر مقاس مريح من تويل قطن تقيل بأساور مطاطة وجيوب جانبية.',
   'جوجر تويل تقيل بمقاس مريح.',
   1100.00, 1400.00, 'physical', (SELECT id FROM categories WHERE slug = 'streetwear'),
   ARRAY['https://images.unsplash.com/photo-1517438476312-10d79c077509?w=900&q=80'],
   'https://images.unsplash.com/photo-1517438476312-10d79c077509?w=900&q=80',
   20, 5, 'SAIF-SW-001', 'active', false, true, ARRAY['joggers', 'pants'],
   '{"Material": "Cotton twill", "Fit": "Relaxed"}'::jsonb),
  ('Static Cargo Pants', 'static-cargo-pants',
   'Utility silhouette with six pockets and adjustable hem. Cut from durable ripstop cotton.',
   'Ripstop utility cargo pants.',
   'قصة يوتيليتي بستة جيوب وطرف قابل للتعديل. من قطن ريب ستوب المتين.',
   'بنطلون كارجو ريب ستوب يوتيليتي.',
   1250.00, NULL, 'physical', (SELECT id FROM categories WHERE slug = 'streetwear'),
   ARRAY['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=900&q=80'],
   'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=900&q=80',
   14, 5, 'SAIF-SW-002', 'active', false, false, ARRAY['cargo', 'pants'],
   '{"Material": "Cotton ripstop", "Pockets": "6"}'::jsonb),
  ('Kerned Confidence Cap', 'kerned-confidence-cap',
   'Designed with enough spacing to keep your thoughts aligned. Structured 6-panel cap with embroidered logo and brass clasp.',
   'Structured 6-panel cap.',
   'مصمم بمسافات كفاية تخلي أفكارك مرتبة. كاب سداسي مبني بستايل قوي بشعار مطرز وقفل نحاس.',
   'كاب سداسي بستايل قوي.',
   650.00, NULL, 'physical', (SELECT id FROM categories WHERE slug = 'accessories'),
   ARRAY['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&q=80'],
   'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&q=80',
   18, 4, 'SAIF-AC-001', 'active', false, true, ARRAY['cap', 'accessory'],
   '{"Material": "Cotton twill", "Closure": "Brass clasp"}'::jsonb),
  ('Positive Space Tote', 'positive-space-tote',
   'For those who believe in leaving room to breathe. 16oz heavy canvas tote with contrast stitching and inner pocket.',
   '16oz heavy canvas tote.',
   'للي بيؤمن إن لازم تسيك مساحة تتنفس. شنطة كانفاس تقيلة 16 أونصة بخياطة متباينة وجيب داخلي.',
   'شنطة كانفاس تقيلة 16 أونصة.',
   500.00, 650.00, 'physical', (SELECT id FROM categories WHERE slug = 'accessories'),
   ARRAY['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=80'],
   'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=80',
   32, 6, 'SAIF-AC-002', 'active', true, false, ARRAY['tote', 'bag'],
   '{"Material": "16oz canvas", "Dimensions": "38 × 42 × 12 cm"}'::jsonb),
  ('Red Beanie', 'red-beanie',
   'Warmth with an edge. Ribbed knit beanie in signature SAIF red with woven label.',
   'Ribbed knit beanie.',
   'دفا بشخصية. باني مضلع بأحمر SAIF المميز بليبل منسوج.',
   'باني مضلع.',
   550.00, NULL, 'physical', (SELECT id FROM categories WHERE slug = 'accessories'),
   ARRAY['https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=900&q=80'],
   'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=900&q=80',
   15, 4, 'SAIF-AC-003', 'active', false, false, ARRAY['beanie', 'winter'],
   '{"Material": "Acrylic ribbed knit"}'::jsonb);

-- Digital products
INSERT INTO products (name, slug, description, short_description, description_ar, short_description_ar, price, compare_at_price, product_type, category_id, images, thumbnail, stock, low_stock_threshold, sku, status, featured, bestseller, tags, metadata, delivery_info) VALUES
  ('TikTok Followers — 1K', 'tiktok-followers-1k',
   'A 1,000-follower boost package for your TikTok profile. No password required — only your username. Delivery starts after your order is confirmed.',
   '1,000 TikTok followers.',
   'باقة 1000 متابع لحسابك على تيك توك. من غير باسورد — بس اليوزر نيم. التسليم بيبدأ بعد ما طلبك يتأكد.',
   '1000 متابع تيك توك.',
   220.00, NULL, 'digital', (SELECT id FROM categories WHERE slug = 'social-media'),
   ARRAY['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=900&q=80'],
   'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=900&q=80',
   999, 0, 'SAIF-DG-001', 'active', true, true, ARRAY['tiktok', 'social'],
   '{"delivery_time": "24-72h", "platform": "tiktok", "quantity": 1000}'::jsonb,
   'Delivered within 24–72 hours after payment verification. You will be contacted on the phone number or email used at checkout.'),
  ('TikTok Followers — 5K', 'tiktok-followers-5k',
   'A 5,000-follower boost package for your TikTok profile. No password required — only your username. Delivery starts after your order is confirmed.',
   '5,000 TikTok followers.',
   'باقة 5000 متابع لحسابك على تيك توك. من غير باسورد — بس اليوزر نيم. التسليم بيبدأ بعد ما طلبك يتأكد.',
   '5000 متابع تيك توك.',
   950.00, 1100.00, 'digital', (SELECT id FROM categories WHERE slug = 'social-media'),
   ARRAY['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=900&q=80'],
   'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=900&q=80',
   999, 0, 'SAIF-DG-002', 'active', false, false, ARRAY['tiktok', 'social'],
   '{"delivery_time": "48-96h", "platform": "tiktok", "quantity": 5000}'::jsonb,
   'Delivered within 48–96 hours after payment verification. You will be contacted on the phone number or email used at checkout.'),
  ('Instagram Likes — 500', 'instagram-likes-500',
   'A 500-like package for an Instagram post of your choice. Just send the post link after checkout. Delivery starts after your order is confirmed.',
   '500 Instagram likes.',
   'باقة 500 لايك لبوست انستجرام من اختيارك. ابعت لينك البوست بس بعد الطلب. التسليم بيبدأ بعد ما طلبك يتأكد.',
   '500 لايك انستجرام.',
   150.00, NULL, 'digital', (SELECT id FROM categories WHERE slug = 'social-media'),
   ARRAY['https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=900&q=80'],
   'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=900&q=80',
   999, 0, 'SAIF-DG-003', 'active', false, false, ARRAY['instagram', 'social'],
   '{"delivery_time": "up to 24h", "platform": "instagram", "quantity": 500}'::jsonb,
   'Delivered within 24 hours after payment verification. You will be contacted to confirm the post link.'),
  ('Instagram Followers — 1K', 'instagram-followers-1k',
   'A 1,000-follower boost package for your Instagram profile. No password required — only your username. Delivery starts after your order is confirmed.',
   '1,000 Instagram followers.',
   'باقة 1000 متابع لحسابك على انستجرام. من غير باسورد — بس اليوزر نيم. التسليم بيبدأ بعد ما طلبك يتأكد.',
   '1000 متابع انستجرام.',
   260.00, NULL, 'digital', (SELECT id FROM categories WHERE slug = 'social-media'),
   ARRAY['https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=900&q=80'],
   'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=900&q=80',
   999, 0, 'SAIF-DG-005', 'active', false, false, ARRAY['instagram', 'social'],
   '{"delivery_time": "24-72h", "platform": "instagram", "quantity": 1000}'::jsonb,
   'Delivered within 24–72 hours after payment verification. You will be contacted on the phone number or email used at checkout.'),
  ('YouTube Views — 10K', 'youtube-views-10k',
   'A 10,000-view package for one YouTube video, delivered gradually for a natural pace. Delivery starts after your order is confirmed.',
   '10,000 YouTube views.',
   'باقة 10,000 مشاهدة لفيديو واحد على يوتيوب، بتتسلم تدريجي بشكل طبيعي. التسليم بيبدأ بعد ما طلبك يتأكد.',
   '10,000 مشاهدة يوتيوب.',
   420.00, 500.00, 'digital', (SELECT id FROM categories WHERE slug = 'social-media'),
   ARRAY['https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=900&q=80'],
   'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=900&q=80',
   999, 0, 'SAIF-DG-004', 'active', false, false, ARRAY['youtube', 'social'],
   '{"delivery_time": "72h", "platform": "youtube", "quantity": 10000}'::jsonb,
   'Delivered gradually over ~72 hours after payment verification. You will be contacted to confirm the video link.'),
  ('SAIF Wallpaper Pack', 'saif-wallpaper-pack',
   'A curated pack of 12 high-resolution SAIF STORE wallpapers for desktop and mobile (4K, PNG). Delivered instantly to your email after confirmation.',
   '12 × 4K wallpapers.',
   'باقة من 12 خلفية SAIF STORE عالية الدقة للموبايل واللابتوب (4K بصيغة PNG). بتوصلك على إيميلك فورًا بعد التأكيد.',
   '12 خلفية بدقة 4K.',
   120.00, NULL, 'digital', (SELECT id FROM categories WHERE slug = 'digital-products'),
   ARRAY['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&q=80'],
   'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&q=80',
   999, 0, 'SAIF-DG-006', 'active', false, false, ARRAY['wallpaper', 'artwork'],
   '{"delivery_time": "up to 12h", "format": "PNG 4K", "quantity": 12}'::jsonb,
   'A download link is sent to your order email within 12 hours after payment verification.');

-- Variants for physical products
INSERT INTO product_variants (product_id, name, sku, price, stock, size, color) VALUES
  ((SELECT id FROM products WHERE slug = 'off-by-design-tee'), 'S / Black', 'SAIF-TS-001-S-BLK', NULL, 6, 'S', 'Black'),
  ((SELECT id FROM products WHERE slug = 'off-by-design-tee'), 'M / Black', 'SAIF-TS-001-M-BLK', NULL, 10, 'M', 'Black'),
  ((SELECT id FROM products WHERE slug = 'off-by-design-tee'), 'L / Black', 'SAIF-TS-001-L-BLK', NULL, 8, 'L', 'Black'),
  ((SELECT id FROM products WHERE slug = 'layered-signal-tee'), 'M / White', 'SAIF-TS-002-M-WHT', NULL, 12, 'M', 'White'),
  ((SELECT id FROM products WHERE slug = 'layered-signal-tee'), 'L / White', 'SAIF-TS-002-L-WHT', NULL, 10, 'L', 'White'),
  ((SELECT id FROM products WHERE slug = 'command-k-hoodie'), 'M / Grey', 'SAIF-HD-001-M-GRY', NULL, 5, 'M', 'Grey'),
  ((SELECT id FROM products WHERE slug = 'command-k-hoodie'), 'L / Grey', 'SAIF-HD-001-L-GRY', NULL, 4, 'L', 'Grey'),
  ((SELECT id FROM products WHERE slug = 'command-k-hoodie'), 'XL / Grey', 'SAIF-HD-001-XL-GRY', NULL, 3, 'XL', 'Grey'),
  ((SELECT id FROM products WHERE slug = 'monochrome-joggers'), 'M / Black', 'SAIF-SW-001-M-BLK', NULL, 10, 'M', 'Black'),
  ((SELECT id FROM products WHERE slug = 'monochrome-joggers'), 'L / Black', 'SAIF-SW-001-L-BLK', NULL, 10, 'L', 'Black'),
  ((SELECT id FROM products WHERE slug = 'static-cargo-pants'), 'M / Olive', 'SAIF-SW-002-M-OLV', NULL, 7, 'M', 'Olive'),
  ((SELECT id FROM products WHERE slug = 'static-cargo-pants'), 'L / Olive', 'SAIF-SW-002-L-OLV', NULL, 7, 'L', 'Olive');

-- Coupons
INSERT INTO coupons (code, type, value, min_order_value, max_uses, max_discount_amount, is_active) VALUES
  ('WELCOME20', 'percentage', 20, 500.00, 100, 300.00, true),
  ('SAIF100', 'fixed', 100, 1000.00, NULL, NULL, true);
