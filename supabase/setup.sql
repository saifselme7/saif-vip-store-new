-- ============================================================
-- SAIF STORE — Full Supabase setup for a NEW project (v2)
-- Run this file in the Supabase SQL Editor.
-- For EXISTING projects run upgrade_v2.sql instead.
-- ============================================================

BEGIN;

-- ============================================================
-- SAIF STORE — Database Schema (v2)
-- Run this in your Supabase SQL Editor on a NEW project.
-- For EXISTING projects run supabase/upgrade_v2.sql instead.
-- ============================================================

-- Enable extensions used by the schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Profiles (extends auth.users)
-- ============================================================
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

-- ============================================================
-- Admin helper (used by RLS policies, RPCs and triggers)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- SECURITY: users must never be able to promote themselves.
-- Column-level grants (in rls.sql) block role writes over PostgREST;
-- this trigger is defense-in-depth against any other path.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Allowed: admins managing users, or superuser/SQL editor.
    IF current_user IN ('postgres', 'supabase_admin') OR public.is_admin() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Modifying the role field is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role ON profiles;
CREATE TRIGGER protect_profile_role
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- ============================================================
-- Catalog
-- ============================================================
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  short_description TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(10,2),
  product_type TEXT DEFAULT 'physical' CHECK (product_type IN ('physical', 'digital')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  images TEXT[] DEFAULT '{}',
  thumbnail TEXT,
  stock INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  sku TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
  featured BOOLEAN DEFAULT FALSE,
  bestseller BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC(10,2),
  stock INTEGER DEFAULT 0,
  size TEXT,
  color TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Customer lists
-- ============================================================
CREATE TABLE wishlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

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

-- ============================================================
-- Orders
-- ============================================================
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','payment_review','confirmed','processing','ready',
    'shipped','delivered','completed','cancelled','rejected','refunded'
  )),
  subtotal NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  shipping_fee NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  coupon_code TEXT,
  payment_method TEXT CHECK (payment_method IN ('instapay', 'vodafone_cash')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address JSONB DEFAULT '{}',
  notes TEXT,
  -- Digital fulfillment info. Hidden from customers until payment is
  -- approved (served through the get_order_digital_delivery RPC only).
  digital_delivery JSONB DEFAULT '{}',
  -- Guard so stock is only ever restocked once per order.
  stock_released BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  product_type TEXT DEFAULT 'physical',
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Payments (manual verification ledger — one row per submission)
-- ============================================================
CREATE TABLE payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('instapay', 'vodafone_cash')),
  status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN (
    'awaiting_payment','under_review','approved','rejected','cancelled'
  )),
  expected_amount NUMERIC(10,2) NOT NULL,
  transferred_amount NUMERIC(10,2),
  payer_identifier TEXT,
  screenshot_path TEXT,
  customer_note TEXT,
  admin_note TEXT,
  rejection_reason TEXT,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Marketing
-- ============================================================
CREATE TABLE coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order_value NUMERIC(10,2),
  max_discount NUMERIC(10,2),
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- ============================================================
-- Site settings
-- ============================================================
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
  shipping_fee NUMERIC(10,2) DEFAULT 50,
  free_shipping_threshold NUMERIC(10,2) DEFAULT 1500,
  minimum_order_amount NUMERIC(10,2),
  -- Manual payment receiving number (InstaPay / Vodafone Cash).
  payment_number TEXT DEFAULT '01040324811',
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_image TEXT,
  footer_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Inventory audit log (auto-populated by triggers)
-- ============================================================
CREATE TABLE inventory_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  change INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.log_product_stock_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO public.inventory_log (product_id, variant_id, change, stock_after, changed_by)
    VALUES (
      COALESCE(NEW.product_id, OLD.product_id),
      CASE WHEN TG_TABLE_NAME = 'product_variants' THEN NEW.id ELSE NULL END,
      NEW.stock - OLD.stock,
      NEW.stock,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_stock_log ON products;
CREATE TRIGGER products_stock_log
AFTER UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION public.log_product_stock_change();

DROP TRIGGER IF EXISTS variants_stock_log ON product_variants;
CREATE TRIGGER variants_stock_log
AFTER UPDATE ON product_variants
FOR EACH ROW EXECUTE FUNCTION public.log_product_stock_change();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_created ON products(created_at DESC);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_wishlists_user ON wishlists(user_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_inventory_log_product ON inventory_log(product_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
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



-- ============================================================
-- SAIF STORE — Server-side business logic (RPCs)
-- All checkout/payment/admin mutations run through these
-- SECURITY DEFINER functions so prices, stock and coupons are
-- validated on the database side and stay transactional.
-- ============================================================

-- ------------------------------------------------------------
-- Coupon validation (does NOT expose full coupon rows).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_subtotal NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c coupons%rowtype;
  v_discount NUMERIC;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Enter a coupon code.');
  END IF;

  SELECT * INTO c FROM coupons
  WHERE upper(code) = upper(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon code does not exist.');
  END IF;
  IF NOT c.is_active THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon is no longer active.');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon has expired.');
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses_count >= c.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon has reached its usage limit.');
  END IF;
  IF c.min_order_value IS NOT NULL AND p_subtotal < c.min_order_value THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon requires a minimum order of ' || c.min_order_value::text || '.'
    );
  END IF;

  IF c.type = 'percentage' THEN
    v_discount := round(p_subtotal * c.value / 100, 2);
  ELSE
    v_discount := LEAST(c.value, p_subtotal);
  END IF;
  IF c.max_discount IS NOT NULL THEN
    v_discount := LEAST(v_discount, c.max_discount);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', c.code,
    'type', c.type,
    'value', c.value,
    'discount', v_discount,
    'message', 'Coupon applied.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO authenticated;

-- ------------------------------------------------------------
-- Atomic checkout: validates stock & coupon, computes totals on
-- the server, reserves stock, creates order + order items.
-- p_items: [{"product_id": "...", "variant_id": null, "quantity": 2}]
-- p_customer: {"name","email","phone","governorate","city","address","notes"}
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(
  p_items JSONB,
  p_coupon_code TEXT,
  p_customer JSONB,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_settings site_settings%rowtype;
  v_item JSONB;
  v_product products%rowtype;
  v_variant product_variants%rowtype;
  v_price NUMERIC;
  v_qty INTEGER;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_shipping NUMERIC := 0;
  v_total NUMERIC;
  v_has_physical BOOLEAN := FALSE;
  v_order_id UUID;
  v_order_number TEXT;
  v_coupon coupons%rowtype;
  v_rows INTEGER;
  v_lines JSONB := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;
  IF p_payment_method NOT IN ('instapay', 'vodafone_cash') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF coalesce(trim(p_customer->>'name'), '') = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF coalesce(trim(p_customer->>'email'), '') = '' THEN
    RAISE EXCEPTION 'Customer email is required';
  END IF;

  SELECT * INTO v_settings FROM site_settings LIMIT 1;

  -- Pass 1: validate every line, reserve stock, compute subtotal.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    SELECT * INTO v_product FROM products
    WHERE id = (v_item->>'product_id')::uuid AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in your cart is no longer available';
    END IF;

    v_price := v_product.price;
    IF v_item->>'variant_id' IS NOT NULL THEN
      SELECT * INTO v_variant FROM product_variants
      WHERE id = (v_item->>'variant_id')::uuid AND product_id = v_product.id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'A selected option for "%" is no longer available', v_product.name;
      END IF;
      IF v_variant.price IS NOT NULL THEN v_price := v_variant.price; END IF;
    END IF;

    -- Physical goods: atomically reserve stock (variant + aggregate).
    IF v_product.product_type = 'physical' THEN
      v_has_physical := TRUE;
      IF v_item->>'variant_id' IS NOT NULL THEN
        UPDATE product_variants SET stock = stock - v_qty
        WHERE id = v_variant.id AND stock >= v_qty;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 0 THEN
          RAISE EXCEPTION 'Insufficient stock for "%" (%)', v_product.name, v_variant.name;
        END IF;
      END IF;
      UPDATE products SET stock = stock - v_qty
      WHERE id = v_product.id AND stock >= v_qty;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows = 0 THEN
        RAISE EXCEPTION 'Insufficient stock for "%"', v_product.name;
      END IF;
    END IF;

    v_subtotal := v_subtotal + (v_price * v_qty);
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id,
      'variant_id', CASE WHEN v_item->>'variant_id' IS NULL THEN NULL ELSE (v_item->>'variant_id')::uuid END,
      'product_name', v_product.name,
      'variant_name', CASE WHEN v_item->>'variant_id' IS NULL THEN NULL ELSE v_variant.name END,
      'product_type', v_product.product_type,
      'price', v_price,
      'quantity', v_qty,
      'total', v_price * v_qty
    );
  END LOOP;

  -- Minimum order amount.
  IF v_settings.minimum_order_amount IS NOT NULL AND v_subtotal < v_settings.minimum_order_amount THEN
    RAISE EXCEPTION 'The minimum order amount is %', v_settings.minimum_order_amount;
  END IF;

  -- Coupon (server-side revalidation — never trust the client).
  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon FROM coupons
    WHERE upper(code) = upper(trim(p_coupon_code)) AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR uses_count < max_uses)
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The coupon code is invalid or expired';
    END IF;
    IF v_coupon.min_order_value IS NOT NULL AND v_subtotal < v_coupon.min_order_value THEN
      RAISE EXCEPTION 'The coupon requires a minimum order of %', v_coupon.min_order_value;
    END IF;
    IF v_coupon.type = 'percentage' THEN
      v_discount := round(v_subtotal * v_coupon.value / 100, 2);
    ELSE
      v_discount := LEAST(v_coupon.value, v_subtotal);
    END IF;
    IF v_coupon.max_discount IS NOT NULL THEN
      v_discount := LEAST(v_discount, v_coupon.max_discount);
    END IF;
    UPDATE coupons SET uses_count = uses_count + 1 WHERE id = v_coupon.id;
  END IF;

  -- Shipping (physical goods only).
  IF v_has_physical THEN
    IF v_settings.free_shipping_threshold IS NULL OR v_subtotal < v_settings.free_shipping_threshold THEN
      v_shipping := coalesce(v_settings.shipping_fee, 0);
    END IF;
  END IF;

  v_total := v_subtotal - v_discount + v_shipping;
  v_order_number := 'SAIF-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  INSERT INTO orders (
    order_number, user_id, status, subtotal, discount, shipping_fee, total,
    coupon_code, payment_method, customer_name, customer_email, customer_phone,
    shipping_address, notes
  ) VALUES (
    v_order_number, v_user, 'pending', v_subtotal, v_discount, v_shipping, v_total,
    CASE WHEN v_coupon.id IS NULL THEN NULL ELSE v_coupon.code END,
    p_payment_method,
    trim(p_customer->>'name'),
    trim(p_customer->>'email'),
    NULLIF(trim(p_customer->>'phone'), ''),
    jsonb_strip_nulls(jsonb_build_object(
      'governorate', p_customer->>'governorate',
      'city', p_customer->>'city',
      'address', p_customer->>'address'
    )),
    NULLIF(trim(p_customer->>'notes'), '')
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, product_type, price, quantity, total)
  SELECT
    v_order_id,
    (l->>'product_id')::uuid,
    CASE WHEN l->>'variant_id' IS NULL THEN NULL ELSE (l->>'variant_id')::uuid END,
    l->>'product_name',
    l->>'variant_name',
    coalesce(l->>'product_type', 'physical'),
    (l->>'price')::numeric,
    (l->>'quantity')::int,
    (l->>'total')::numeric
  FROM jsonb_array_elements(v_lines) AS l;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'shipping', v_shipping,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(JSONB, TEXT, JSONB, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Customer submits manual payment evidence for their own order.
-- Creates a new payment ledger row; rejects if a submission is
-- already awaiting review.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_payment(
  p_order_id UUID,
  p_payment_method TEXT,
  p_transferred_amount NUMERIC,
  p_payer_identifier TEXT,
  p_screenshot_path TEXT,
  p_customer_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_order orders%rowtype;
  v_payment_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.user_id <> v_user THEN
    RAISE EXCEPTION 'This order belongs to another account';
  END IF;
  IF v_order.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'This order has been cancelled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM payments
    WHERE order_id = p_order_id AND status IN ('under_review', 'approved')
  ) THEN
    RAISE EXCEPTION 'A payment for this order is already submitted or approved';
  END IF;
  IF p_payment_method NOT IN ('instapay', 'vodafone_cash') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF p_transferred_amount IS NULL OR p_transferred_amount <= 0 THEN
    RAISE EXCEPTION 'Enter the amount you transferred';
  END IF;
  IF coalesce(trim(p_payer_identifier), '') = '' THEN
    RAISE EXCEPTION 'Enter the phone/account number you paid from';
  END IF;
  IF coalesce(trim(p_screenshot_path), '') = '' THEN
    RAISE EXCEPTION 'Upload the transfer screenshot';
  END IF;

  INSERT INTO payments (
    order_id, user_id, payment_method, status, expected_amount,
    transferred_amount, payer_identifier, screenshot_path, customer_note
  ) VALUES (
    p_order_id, v_user, p_payment_method, 'under_review', v_order.total,
    p_transferred_amount, trim(p_payer_identifier), trim(p_screenshot_path), p_customer_note
  ) RETURNING id INTO v_payment_id;

  UPDATE orders SET status = 'payment_review', payment_method = p_payment_method
  WHERE id = p_order_id AND status IN ('pending', 'payment_review');

  RETURN jsonb_build_object('payment_id', v_payment_id, 'status', 'under_review');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Admin payment review. p_action: approve | reject | hold | cancel
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%rowtype;
  v_item order_items%rowtype;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.stock_released THEN RETURN; END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.product_type = 'physical' THEN
      IF v_item.variant_id IS NOT NULL THEN
        UPDATE product_variants SET stock = stock + v_item.quantity WHERE id = v_item.variant_id;
      END IF;
      UPDATE products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  UPDATE orders SET stock_released = TRUE WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_payment(
  p_payment_id UUID,
  p_action TEXT,
  p_admin_note TEXT DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%rowtype;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status = 'approved' THEN
    RAISE EXCEPTION 'This payment was already approved';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE payments SET
      status = 'approved',
      admin_note = coalesce(p_admin_note, admin_note),
      verified_by = auth.uid(),
      verified_at = now()
    WHERE id = p_payment_id;
    UPDATE orders SET status = 'confirmed' WHERE id = v_payment.order_id;
    RETURN jsonb_build_object('status', 'approved');

  ELSIF p_action = 'reject' THEN
    IF coalesce(trim(p_rejection_reason), '') = '' THEN
      RAISE EXCEPTION 'A rejection reason is required';
    END IF;
    UPDATE payments SET
      status = 'rejected',
      rejection_reason = trim(p_rejection_reason),
      admin_note = coalesce(p_admin_note, admin_note),
      verified_by = auth.uid(),
      verified_at = now()
    WHERE id = p_payment_id;
    RETURN jsonb_build_object('status', 'rejected');

  ELSIF p_action = 'hold' THEN
    UPDATE payments SET
      status = 'under_review',
      admin_note = coalesce(p_admin_note, admin_note)
    WHERE id = p_payment_id;
    RETURN jsonb_build_object('status', 'under_review');

  ELSIF p_action = 'cancel' THEN
    UPDATE payments SET
      status = 'cancelled',
      admin_note = coalesce(p_admin_note, admin_note),
      verified_by = auth.uid(),
      verified_at = now()
    WHERE id = p_payment_id;
    UPDATE orders SET status = 'cancelled' WHERE id = v_payment.order_id;
    PERFORM public.release_order_stock(v_payment.order_id);
    RETURN jsonb_build_object('status', 'cancelled');

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_payment(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Admin order status updates (with automatic restock on cancel).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_order_status(p_order_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_status NOT IN ('pending','payment_review','confirmed','processing','ready','shipped','delivered','completed','cancelled','refunded') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE orders SET status = p_status WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF p_status IN ('cancelled', 'refunded') THEN
    PERFORM public.release_order_stock(p_order_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_order_status(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Digital delivery: only served to the owner (or an admin) and
-- only once the payment has been approved.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_digital_delivery(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%rowtype;
  v_paid BOOLEAN;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.user_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM payments WHERE order_id = p_order_id AND status = 'approved'
  ) INTO v_paid;

  IF NOT v_paid THEN
    RETURN jsonb_build_object('unlocked', false);
  END IF;
  RETURN jsonb_build_object('unlocked', true, 'delivery', coalesce(v_order.digital_delivery, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_digital_delivery(UUID) TO authenticated;

-- ------------------------------------------------------------
-- Admin: analytics summary (aggregated, no raw data dumps).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_analytics_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'revenue', coalesce(sum(o.total), 0),
        'orders', count(*)::int,
        'avg_order_value', coalesce(round(avg(o.total), 2), 0),
        'customers', (SELECT count(*) FROM profiles WHERE role = 'customer'),
        'products', (SELECT count(*) FROM products),
        'low_stock', (SELECT count(*) FROM products WHERE status = 'active' AND product_type = 'physical' AND stock <= low_stock_threshold AND stock > 0),
        'out_of_stock', (SELECT count(*) FROM products WHERE status = 'active' AND product_type = 'physical' AND stock <= 0),
        'awaiting_payments', (SELECT count(*) FROM payments WHERE status = 'under_review'),
        'pending_orders', (SELECT count(*) FROM orders WHERE status IN ('pending', 'payment_review'))
      )
      FROM orders o
      WHERE o.status IN ('confirmed','processing','ready','shipped','delivered','completed')
    ),
    'daily', (
      SELECT coalesce(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT
          to_char(o.created_at, 'YYYY-MM-DD') AS day,
          coalesce(sum(o.total), 0)::numeric AS revenue,
          count(*)::int AS orders
        FROM orders o
        WHERE o.created_at >= now() - interval '30 days'
          AND o.status NOT IN ('cancelled', 'refunded', 'pending', 'payment_review')
        GROUP BY 1
      ) d
    ),
    'top_products', (
      SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.units DESC), '[]'::jsonb)
      FROM (
        SELECT oi.product_name AS name, sum(oi.quantity)::int AS units, sum(oi.total)::numeric AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('cancelled', 'refunded', 'pending', 'payment_review')
        GROUP BY oi.product_name
        ORDER BY units DESC
        LIMIT 8
      ) t
    ),
    'payment_methods', (
      SELECT coalesce(jsonb_agg(row_to_json(m)), '[]'::jsonb)
      FROM (
        SELECT p.payment_method AS method, count(*)::int AS count, sum(p.expected_amount)::numeric AS total
        FROM payments p
        WHERE p.status = 'approved'
        GROUP BY p.payment_method
      ) m
    ),
    'order_statuses', (
      SELECT coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      FROM (SELECT status, count(*)::int AS count FROM orders GROUP BY status) s
    ),
    'product_types', (
      SELECT coalesce(jsonb_agg(row_to_json(pt)), '[]'::jsonb)
      FROM (
        SELECT oi.product_type AS type, sum(oi.total)::numeric AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('cancelled', 'refunded', 'pending', 'payment_review')
        GROUP BY oi.product_type
      ) pt
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary() TO authenticated;

-- ------------------------------------------------------------
-- Admin: per-customer order stats.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_stats()
RETURNS TABLE (user_id UUID, order_count BIGINT, total_spent NUMERIC, last_order_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    count(o.id) AS order_count,
    coalesce(sum(o.total) FILTER (WHERE o.status NOT IN ('cancelled', 'refunded')), 0) AS total_spent,
    max(o.created_at) AS last_order_at
  FROM profiles p
  LEFT JOIN orders o ON o.user_id = p.id
  WHERE p.role = 'customer'
  GROUP BY p.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_stats() TO authenticated;

-- ------------------------------------------------------------
-- Admin: change a user's role (the ONLY supported way besides
-- the SQL editor — regular users cannot touch role at all).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_role NOT IN ('customer', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE profiles SET role = p_role WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT) TO authenticated;



-- ============================================================
-- SAIF STORE — Row Level Security (v2)
-- Safe to re-run: every policy is dropped before recreation.
-- Requires schema.sql (or upgrade_v2.sql) to be applied first.
-- ============================================================

-- Drop legacy v1 policies that are replaced (not recreated) in v2.
DROP POLICY IF EXISTS "Orders user insert" ON orders;
DROP POLICY IF EXISTS "Order items own insert" ON order_items;
DROP POLICY IF EXISTS "Order items admin delete" ON order_items;
DROP POLICY IF EXISTS "Carts own or session" ON carts;

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
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- Security model: RLS is row-level only, so column-level GRANTs
-- are what stop a user from writing `role` on their own row.
-- The protect_profile_role trigger is defense-in-depth.
-- ============================================================
REVOKE ALL ON profiles FROM anon;
REVOKE ALL ON profiles FROM authenticated;
GRANT SELECT ON profiles TO anon, authenticated;
GRANT INSERT (id, full_name, avatar_url, phone, address) ON profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, phone, address) ON profiles TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- CATALOG: public read of active rows, admin writes
-- ============================================================
DROP POLICY IF EXISTS "Categories public read" ON categories;
CREATE POLICY "Categories public read"
  ON categories FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Categories admin write" ON categories;
CREATE POLICY "Categories admin write"
  ON categories FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Products public read active" ON products;
CREATE POLICY "Products public read active"
  ON products FOR SELECT TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "Products admin all" ON products;
CREATE POLICY "Products admin all"
  ON products FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Variants public read" ON product_variants;
CREATE POLICY "Variants public read"
  ON product_variants FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Variants admin write" ON product_variants;
CREATE POLICY "Variants admin write"
  ON product_variants FOR ALL
  USING (public.is_admin());

-- ============================================================
-- WISHLISTS: own rows only
-- ============================================================
DROP POLICY IF EXISTS "Wishlists own" ON wishlists;
CREATE POLICY "Wishlists own"
  ON wishlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CARTS (legacy server cart tables — storefront uses local cart)
-- ============================================================
DROP POLICY IF EXISTS "Carts own" ON carts;
CREATE POLICY "Carts own"
  ON carts FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Cart items through cart" ON cart_items;
CREATE POLICY "Cart items through cart"
  ON cart_items FOR ALL
  USING (EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));

-- ============================================================
-- ORDERS: created exclusively via the place_order RPC.
-- Customers read their own, admins manage everything.
-- ============================================================
DROP POLICY IF EXISTS "Orders own" ON orders;
CREATE POLICY "Orders own"
  ON orders FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- No INSERT policy for regular users: only the SECURITY DEFINER
-- place_order() function can create orders (bypassing RLS), which
-- is what guarantees server-side pricing and stock checks.
DROP POLICY IF EXISTS "Orders admin update" ON orders;
CREATE POLICY "Orders admin update"
  ON orders FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Order items through order" ON order_items;
CREATE POLICY "Order items through order"
  ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR public.is_admin())
  ));

DROP POLICY IF EXISTS "Order items admin manage" ON order_items;
CREATE POLICY "Order items admin manage"
  ON order_items FOR ALL
  USING (public.is_admin());

-- ============================================================
-- PAYMENTS: customers only see their own submissions; all writes
-- go through submit_payment() / review_payment() RPCs.
-- ============================================================
DROP POLICY IF EXISTS "Payments own read" ON payments;
CREATE POLICY "Payments own read"
  ON payments FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- COUPONS: codes are NOT publicly readable. Customers validate
-- coupons through validate_coupon(); admins manage rows.
-- ============================================================
DROP POLICY IF EXISTS "Coupons public read active" ON coupons;
DROP POLICY IF EXISTS "Coupons admin all" ON coupons;
CREATE POLICY "Coupons admin all"
  ON coupons FOR ALL
  USING (public.is_admin());

-- ============================================================
-- REVIEWS: approved reviews public, customers manage own,
-- admins moderate.
-- ============================================================
DROP POLICY IF EXISTS "Reviews public read approved" ON reviews;
CREATE POLICY "Reviews public read approved"
  ON reviews FOR SELECT TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "Reviews own read" ON reviews;
CREATE POLICY "Reviews own read"
  ON reviews FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Reviews own write" ON reviews;
CREATE POLICY "Reviews own write"
  ON reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reviews admin manage" ON reviews;
CREATE POLICY "Reviews admin manage"
  ON reviews FOR ALL
  USING (public.is_admin());

-- ============================================================
-- SITE SETTINGS: public read, admin write
-- ============================================================
DROP POLICY IF EXISTS "Site settings public read" ON site_settings;
CREATE POLICY "Site settings public read"
  ON site_settings FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Site settings admin write" ON site_settings;
CREATE POLICY "Site settings admin write"
  ON site_settings FOR ALL
  USING (public.is_admin());

-- ============================================================
-- INVENTORY LOG: admin-only audit trail
-- ============================================================
DROP POLICY IF EXISTS "Inventory log admin read" ON inventory_log;
CREATE POLICY "Inventory log admin read"
  ON inventory_log FOR SELECT
  USING (public.is_admin());

-- Needed so the stock-change audit trigger can write when an admin
-- adjusts stock directly (RPC paths run as owner and bypass RLS anyway).
DROP POLICY IF EXISTS "Inventory log admin insert" ON inventory_log;
CREATE POLICY "Inventory log admin insert"
  ON inventory_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================
-- STORAGE: private bucket for payment screenshots.
-- Path convention: {user_id}/{order_id}.{ext}
--   - customers upload/read/delete only inside their own folder
--   - admins read any screenshot (verification)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-screenshots', 'payment-screenshots', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Screenshots owner upload" ON storage.objects;
CREATE POLICY "Screenshots owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Screenshots owner or admin read" ON storage.objects;
CREATE POLICY "Screenshots owner or admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Screenshots owner update" ON storage.objects;
CREATE POLICY "Screenshots owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Screenshots owner delete" ON storage.objects;
CREATE POLICY "Screenshots owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );



-- ============================================================
-- Seed data for SAIF STORE (v2)
-- NOTE on admins: roles can no longer be written through the API
-- by non-admins (see rls.sql). To make your first admin, run in
-- the SQL editor:
--   UPDATE profiles SET role = 'admin' WHERE id = '<your-user-id>';
-- (or: ... WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');)
-- ============================================================

-- Default site settings
INSERT INTO site_settings (
  store_name, store_description, contact_email, contact_phone, currency,
  shipping_fee, free_shipping_threshold, minimum_order_amount, payment_number,
  announcement, hero_title, hero_subtitle, footer_text
) VALUES (
  'SAIF STORE',
  'Premium streetwear and digital products. Carefully curated, honestly priced.',
  'hello@saifstore.com',
  '01040324811',
  'EGP',
  50.00,
  1500.00,
  100.00,
  '01040324811',
  'Free shipping on orders over 1,500 EGP — pay safely with InstaPay or Vodafone Cash',
  'SAIF STORE',
  'Premium streetwear and digital products. Carefully curated for the modern individual.',
  '© SAIF STORE. All rights reserved.'
);

-- Categories
INSERT INTO categories (name, slug, description, image, sort_order, is_active) VALUES
  ('T-Shirts', 't-shirts', 'Premium heavyweight cotton tees with minimal prints.', 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80', 1, true),
  ('Hoodies', 'hoodies', 'Oversized fits, tonal embroidery, everyday comfort.', 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80', 2, true),
  ('Pants', 'pants', 'Streetwear bottoms built for movement.', 'https://images.unsplash.com/photo-1517438476312-10d79c077509?w=800&q=80', 3, true),
  ('Accessories', 'accessories', 'Caps, beanies, totes — the finishing touches.', 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80', 4, true),
  ('Digital', 'digital', 'Digital services and social media packages.', 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80', 5, true);

-- Physical products
INSERT INTO products (name, slug, description, short_description, price, compare_at_price, product_type, category_id, images, thumbnail, stock, low_stock_threshold, sku, status, featured, bestseller, tags) VALUES
  ('Off by Design Tee', 'off-by-design-tee',
   'Made to be worn. Or judged. Or both. Premium heavyweight cotton with a minimal screen-printed design, pre-shrunk and built to keep its shape wash after wash.',
   'Premium heavyweight cotton tee.', 450.00, 550.00, 'physical',
   (SELECT id FROM categories WHERE slug = 't-shirts'),
   ARRAY['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80', 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80'],
   'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80',
   24, 5, 'SAIF-TS-001', 'active', true, false, ARRAY['tee', 'cotton', 'minimal']),

  ('Kerned Confidence Cap', 'kerned-confidence-cap',
   'Designed with enough spacing to keep your thoughts aligned. Structured 6-panel cap with embroidered logo and adjustable strap.',
   'Structured cap with embroidered logo.', 350.00, NULL, 'physical',
   (SELECT id FROM categories WHERE slug = 'accessories'),
   ARRAY['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80'],
   'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80',
   18, 5, 'SAIF-AC-001', 'active', false, true, ARRAY['cap', 'accessory']),

  ('Positive Space Tote', 'positive-space-tote',
   'For those who believe in leaving room to breathe. Heavy canvas tote with contrast stitching and reinforced handles.',
   'Heavy canvas tote bag.', 280.00, 350.00, 'physical',
   (SELECT id FROM categories WHERE slug = 'accessories'),
   ARRAY['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80'],
   'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80',
   32, 5, 'SAIF-AC-002', 'active', true, false, ARRAY['tote', 'bag']),

  ('Command K Hoodie', 'command-k-hoodie',
   'The shortcut to comfort. Oversized fit hoodie with kangaroo pocket, tonal embroidery and brushed fleece interior.',
   'Oversized fit hoodie.', 680.00, NULL, 'physical',
   (SELECT id FROM categories WHERE slug = 'hoodies'),
   ARRAY['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80'],
   'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80',
   12, 4, 'SAIF-HD-001', 'active', false, true, ARRAY['hoodie', 'oversized']),

  ('Monochrome Joggers', 'monochrome-joggers',
   'A declaration of intent. Relaxed fit joggers with elastic cuffs, side pockets and a matte tonal finish.',
   'Relaxed fit joggers.', 550.00, 700.00, 'physical',
   (SELECT id FROM categories WHERE slug = 'pants'),
   ARRAY['https://images.unsplash.com/photo-1517438476312-10d79c077509?w=800&q=80'],
   'https://images.unsplash.com/photo-1517438476312-10d79c077509?w=800&q=80',
   20, 5, 'SAIF-PT-001', 'active', false, false, ARRAY['joggers', 'pants']),

  ('Red Beanie', 'red-beanie',
   'Warmth with an edge. Ribbed knit beanie in signature SAIF red.',
   'Ribbed knit beanie.', 300.00, NULL, 'physical',
   (SELECT id FROM categories WHERE slug = 'accessories'),
   ARRAY['https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&q=80'],
   'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&q=80',
   3, 5, 'SAIF-AC-003', 'active', false, false, ARRAY['beanie', 'winter']);

-- Digital products
INSERT INTO products (name, slug, description, short_description, price, product_type, category_id, images, thumbnail, stock, sku, status, featured, tags, metadata) VALUES
  ('TikTok Followers — 1K', 'tiktok-followers-1k',
   'TikTok follower package for accounts you own. Delivered to your username within 24 hours. No password required.',
   '1,000 TikTok followers package.', 120.00, 'digital',
   (SELECT id FROM categories WHERE slug = 'digital'),
   ARRAY['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80'],
   'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80',
   999, 'SAIF-DG-001', 'active', true, ARRAY['tiktok', 'social', 'followers'],
   '{"delivery_time": "within 24 hours", "platform": "tiktok", "quantity": 1000, "requires": "your username only"}'::jsonb),

  ('TikTok Followers — 5K', 'tiktok-followers-5k',
   'TikTok follower package for accounts you own. Delivered to your username within 48 hours. No password required.',
   '5,000 TikTok followers package.', 450.00, 'digital',
   (SELECT id FROM categories WHERE slug = 'digital'),
   ARRAY['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80'],
   'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80',
   999, 'SAIF-DG-002', 'active', false, ARRAY['tiktok', 'social', 'followers'],
   '{"delivery_time": "within 48 hours", "platform": "tiktok", "quantity": 5000, "requires": "your username only"}'::jsonb),

  ('Instagram Likes — 500', 'instagram-likes-500',
   'Instagram likes package for posts you own. Add your post link after payment is approved. No password required.',
   '500 Instagram likes package.', 80.00, 'digital',
   (SELECT id FROM categories WHERE slug = 'digital'),
   ARRAY['https://images.unsplash.com/photo-16111626305-c69b3fa7fbe0?w=800&q=80'],
   'https://images.unsplash.com/photo-16111626305-c69b3fa7fbe0?w=800&q=80',
   999, 'SAIF-DG-003', 'active', false, ARRAY['instagram', 'social', 'likes'],
   '{"delivery_time": "12-24 hours", "platform": "instagram", "quantity": 500, "requires": "post link"}'::jsonb),

  ('YouTube Views — 10K', 'youtube-views-10k',
   'YouTube views package for videos you own. Gradual delivery over 72 hours for account safety. No password required.',
   '10,000 YouTube views package.', 250.00, 'digital',
   (SELECT id FROM categories WHERE slug = 'digital'),
   ARRAY['https://images.unsplash.com/photo-16111626475-46b635cb6868?w=800&q=80'],
   'https://images.unsplash.com/photo-16111626475-46b635cb6868?w=800&q=80',
   999, 'SAIF-DG-004', 'active', false, ARRAY['youtube', 'social', 'views'],
   '{"delivery_time": "gradual, up to 72 hours", "platform": "youtube", "quantity": 10000, "requires": "video link"}'::jsonb);

-- Variants for physical products
INSERT INTO product_variants (product_id, name, sku, price, stock, size, color) VALUES
  ((SELECT id FROM products WHERE slug = 'off-by-design-tee'), 'Small / Black', 'SAIF-TS-001-S-BLK', NULL, 8, 'S', 'Black'),
  ((SELECT id FROM products WHERE slug = 'off-by-design-tee'), 'Medium / Black', 'SAIF-TS-001-M-BLK', NULL, 8, 'M', 'Black'),
  ((SELECT id FROM products WHERE slug = 'off-by-design-tee'), 'Large / Black', 'SAIF-TS-001-L-BLK', NULL, 8, 'L', 'Black'),
  ((SELECT id FROM products WHERE slug = 'command-k-hoodie'), 'Medium / Grey', 'SAIF-HD-001-M-GRY', NULL, 6, 'M', 'Grey'),
  ((SELECT id FROM products WHERE slug = 'command-k-hoodie'), 'Large / Grey', 'SAIF-HD-001-L-GRY', NULL, 6, 'L', 'Grey'),
  ((SELECT id FROM products WHERE slug = 'monochrome-joggers'), 'Medium / Black', 'SAIF-PT-001-M-BLK', NULL, 10, 'M', 'Black'),
  ((SELECT id FROM products WHERE slug = 'monochrome-joggers'), 'Large / Black', 'SAIF-PT-001-L-BLK', NULL, 10, 'L', 'Black');

-- Sample coupons
INSERT INTO coupons (code, type, value, min_order_value, max_discount, max_uses, is_active) VALUES
  ('WELCOME20', 'percentage', 20, 500.00, 300.00, 100, true),
  ('SAIF50', 'fixed', 50, NULL, NULL, NULL, true);



COMMIT;
