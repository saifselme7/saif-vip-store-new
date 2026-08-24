-- ============================================================
-- SAIF STORE — Full Supabase setup for the NEW project
-- Run this file in the new project SQL Editor.
-- It runs schema.sql, rls.sql, and seed.sql in order.
-- ============================================================

BEGIN;

-- SAIF STORE Database Schema
-- Run this in your Supabase SQL Editor on the NEW project.

-- Enable extensions used by the schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles table (extends auth.users)
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
-- This guarantees the storefront, RLS admin checks, and dashboard always
-- have a matching profile (especially when email confirmation is enabled,
-- where the browser session is not available immediately after signup).
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

-- Categories
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

-- Products
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
  sku TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
  featured BOOLEAN DEFAULT FALSE,
  bestseller BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Variants
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

-- Wishlists
CREATE TABLE wishlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Carts
CREATE TABLE carts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart Items
CREATE TABLE cart_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','ready','shipped','delivered','completed','cancelled','rejected')),
  subtotal NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  coupon_code TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coupons
CREATE TABLE coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order_value NUMERIC(10,2),
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews
-- user_id references profiles(id) so PostgREST can embed the author's
-- profile (profiles.id is the same UUID as the auth user id).
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

-- Site Settings
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
  currency TEXT DEFAULT 'USD',
  shipping_fee NUMERIC(10,2) DEFAULT 0,
  free_shipping_threshold NUMERIC(10,2),
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_image TEXT,
  footer_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_wishlists_user ON wishlists(user_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_status ON reviews(status);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
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
CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Row Level Security Policies for SAIF STORE
-- Safe to re-run: every policy is dropped before it is recreated.

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
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own profile, admins see all
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Categories: public read, admin write
DROP POLICY IF EXISTS "Categories public read" ON categories;
CREATE POLICY "Categories public read"
  ON categories FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Categories admin write" ON categories;
CREATE POLICY "Categories admin write"
  ON categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Products: public read active, admin all
DROP POLICY IF EXISTS "Products public read active" ON products;
CREATE POLICY "Products public read active"
  ON products FOR SELECT
  TO authenticated, anon
  USING (status = 'active');

DROP POLICY IF EXISTS "Products admin all" ON products;
CREATE POLICY "Products admin all"
  ON products FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Variants: public read, admin write
DROP POLICY IF EXISTS "Variants public read" ON product_variants;
CREATE POLICY "Variants public read"
  ON product_variants FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Variants admin write" ON product_variants;
CREATE POLICY "Variants admin write"
  ON product_variants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Wishlists: own only
DROP POLICY IF EXISTS "Wishlists own" ON wishlists;
CREATE POLICY "Wishlists own"
  ON wishlists FOR ALL
  USING (auth.uid() = user_id);

-- Carts: own or session
DROP POLICY IF EXISTS "Carts own or session" ON carts;
CREATE POLICY "Carts own or session"
  ON carts FOR ALL
  USING (user_id = auth.uid() OR session_id = coalesce(current_setting('request.headers'::text, true)::json->>'x-session-id', ''));

-- Cart items: through cart ownership
DROP POLICY IF EXISTS "Cart items through cart" ON cart_items;
CREATE POLICY "Cart items through cart"
  ON cart_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND (carts.user_id = auth.uid() OR carts.session_id = coalesce(current_setting('request.headers'::text, true)::json->>'x-session-id', ''))
  ));

-- Orders: own orders, admin all
DROP POLICY IF EXISTS "Orders own" ON orders;
CREATE POLICY "Orders own"
  ON orders FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Orders user insert" ON orders;
CREATE POLICY "Orders user insert"
  ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Orders admin update" ON orders;
CREATE POLICY "Orders admin update"
  ON orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Order items: through order ownership
DROP POLICY IF EXISTS "Order items through order" ON order_items;
CREATE POLICY "Order items through order"
  ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ))
  ));

-- The storefront checkout writes order_items while acting as the
-- authenticated customer who owns the order, so allow that.
DROP POLICY IF EXISTS "Order items own insert" ON order_items;
CREATE POLICY "Order items own insert"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can manage order items too.
DROP POLICY IF EXISTS "Order items admin manage" ON order_items;
CREATE POLICY "Order items admin manage"
  ON order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Order items admin delete" ON order_items;
CREATE POLICY "Order items admin delete"
  ON order_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Coupons: public read active, admin all
DROP POLICY IF EXISTS "Coupons public read active" ON coupons;
CREATE POLICY "Coupons public read active"
  ON coupons FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Coupons admin all" ON coupons;
CREATE POLICY "Coupons admin all"
  ON coupons FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Reviews: public read approved, own write
DROP POLICY IF EXISTS "Reviews public read approved" ON reviews;
CREATE POLICY "Reviews public read approved"
  ON reviews FOR SELECT
  TO authenticated, anon
  USING (status = 'approved');

DROP POLICY IF EXISTS "Reviews own write" ON reviews;
CREATE POLICY "Reviews own write"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reviews admin manage" ON reviews;
CREATE POLICY "Reviews admin manage"
  ON reviews FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Site settings: public read, admin write
DROP POLICY IF EXISTS "Site settings public read" ON site_settings;
CREATE POLICY "Site settings public read"
  ON site_settings FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Site settings admin write" ON site_settings;
CREATE POLICY "Site settings admin write"
  ON site_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));


-- Seed data for SAIF STORE

-- Insert default site settings
INSERT INTO site_settings (store_name, store_description, contact_email, currency, shipping_fee, hero_title, hero_subtitle, footer_text)
VALUES (
  'SAIF STORE',
  'Premium fashion and digital products.',
  'hello@saifstore.com',
  'USD',
  5.00,
  'SAIF STORE',
  'Premium fashion and digital products. Carefully curated.'
);

-- Insert categories
INSERT INTO categories (name, slug, description, sort_order, is_active) VALUES
  ('T-Shirts', 't-shirts', 'Premium cotton tees', 1, true),
  ('Hoodies', 'hoodies', 'Comfortable hoodies', 2, true),
  ('Pants', 'pants', 'Streetwear bottoms', 3, true),
  ('Accessories', 'accessories', 'Caps, bags, and more', 4, true),
  ('Digital', 'digital', 'Digital services and products', 5, true);

-- Insert sample products (physical)
INSERT INTO products (name, slug, description, short_description, price, compare_at_price, product_type, category_id, images, thumbnail, stock, sku, status, featured, bestseller, tags) VALUES
  ('Off by Design Tee', 'off-by-design-tee', 'Made to be worn. Or judged. Or both. Premium heavyweight cotton with a minimal screen-printed design.', 'Premium heavyweight cotton tee.', 45.00, 55.00, 'physical', (SELECT id FROM categories WHERE slug = 't-shirts'), ARRAY['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80', 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80'], 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80', 24, 'SAIF-TS-001', 'active', true, false, ARRAY['tee', 'cotton', 'minimal']),
  ('Kerned Confidence Cap', 'kerned-confidence-cap', 'Designed with enough spacing to keep your thoughts aligned. Structured 6-panel cap with embroidered logo.', 'Structured cap with embroidered logo.', 35.00, NULL, 'physical', (SELECT id FROM categories WHERE slug = 'accessories'), ARRAY['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80'], 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80', 18, 'SAIF-AC-001', 'active', false, true, ARRAY['cap', 'accessory']),
  ('Positive Space Tote', 'positive-space-tote', 'For those who believe in leaving room to breathe. Heavy canvas tote with contrast stitching.', 'Heavy canvas tote bag.', 28.00, 35.00, 'physical', (SELECT id FROM categories WHERE slug = 'accessories'), ARRAY['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80'], 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80', 32, 'SAIF-AC-002', 'active', true, false, ARRAY['tote', 'bag']),
  ('Command K Hoodie', 'command-k-hoodie', 'The shortcut to comfort. Oversized fit hoodie with kangaroo pocket and tonal embroidery.', 'Oversized fit hoodie.', 68.00, NULL, 'physical', (SELECT id FROM categories WHERE slug = 'hoodies'), ARRAY['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80'], 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80', 12, 'SAIF-HD-001', 'active', false, true, ARRAY['hoodie', 'oversized']),
  ('Monochrome Joggers', 'monochrome-joggers', 'A declaration of intent. Relaxed fit joggers with elastic cuffs and side pockets.', 'Relaxed fit joggers.', 55.00, 70.00, 'physical', (SELECT id FROM categories WHERE slug = 'pants'), ARRAY['https://images.unsplash.com/photo-1517438476312-10d79c077509?w=800&q=80'], 'https://images.unsplash.com/photo-1517438476312-10d79c077509?w=800&q=80', 20, 'SAIF-PT-001', 'active', false, false, ARRAY['joggers', 'pants']),
  ('Red Beanie', 'red-beanie', 'Warmth with an edge. Ribbed knit beanie in signature red.', 'Ribbed knit beanie.', 30.00, NULL, 'physical', (SELECT id FROM categories WHERE slug = 'accessories'), ARRAY['https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&q=80'], 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&q=80', 15, 'SAIF-AC-003', 'active', false, false, ARRAY['beanie', 'winter']);

-- Insert sample digital products
INSERT INTO products (name, slug, description, short_description, price, product_type, category_id, images, thumbnail, stock, sku, status, featured, tags, metadata) VALUES
  ('TikTok Followers — 1K', 'tiktok-followers-1k', 'Real TikTok followers delivered within 24 hours. No password required. Safe and secure.', '1,000 real TikTok followers.', 12.00, 'digital', (SELECT id FROM categories WHERE slug = 'digital'), ARRAY['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80'], 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80', 999, 'SAIF-DG-001', 'active', true, ARRAY['tiktok', 'social', 'followers'], '{"delivery_time": "24h", "platform": "tiktok", "quantity": 1000}'::jsonb),
  ('TikTok Followers — 5K', 'tiktok-followers-5k', 'Real TikTok followers delivered within 48 hours. No password required. Safe and secure.', '5,000 real TikTok followers.', 45.00, 'digital', (SELECT id FROM categories WHERE slug = 'digital'), ARRAY['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80'], 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80', 999, 'SAIF-DG-002', 'active', false, ARRAY['tiktok', 'social', 'followers'], '{"delivery_time": "48h", "platform": "tiktok", "quantity": 5000}'::jsonb),
  ('Instagram Likes — 500', 'instagram-likes-500', 'High-quality Instagram likes delivered instantly. Boost your engagement.', '500 Instagram likes.', 8.00, 'digital', (SELECT id FROM categories WHERE slug = 'digital'), ARRAY['https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&q=80'], 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&q=80', 999, 'SAIF-DG-003', 'active', false, ARRAY['instagram', 'social', 'likes'], '{"delivery_time": "instant", "platform": "instagram", "quantity": 500}'::jsonb),
  ('YouTube Views — 10K', 'youtube-views-10k', 'Real YouTube views to boost your video. Gradual delivery for safety.', '10,000 YouTube views.', 25.00, 'digital', (SELECT id FROM categories WHERE slug = 'digital'), ARRAY['https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800&q=80'], 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800&q=80', 999, 'SAIF-DG-004', 'active', false, ARRAY['youtube', 'social', 'views'], '{"delivery_time": "72h", "platform": "youtube", "quantity": 10000}'::jsonb);

-- Insert variants for physical products
INSERT INTO product_variants (product_id, name, sku, price, stock, size, color) VALUES
  ((SELECT id FROM products WHERE slug = 'off-by-design-tee'), 'Small / Black', 'SAIF-TS-001-S-BLK', NULL, 8, 'S', 'Black'),
  ((SELECT id FROM products WHERE slug = 'off-by-design-tee'), 'Medium / Black', 'SAIF-TS-001-M-BLK', NULL, 8, 'M', 'Black'),
  ((SELECT id FROM products WHERE slug = 'off-by-design-tee'), 'Large / Black', 'SAIF-TS-001-L-BLK', NULL, 8, 'L', 'Black'),
  ((SELECT id FROM products WHERE slug = 'command-k-hoodie'), 'Medium / Grey', 'SAIF-HD-001-M-GRY', NULL, 6, 'M', 'Grey'),
  ((SELECT id FROM products WHERE slug = 'command-k-hoodie'), 'Large / Grey', 'SAIF-HD-001-L-GRY', NULL, 6, 'L', 'Grey'),
  ((SELECT id FROM products WHERE slug = 'monochrome-joggers'), 'Medium / Black', 'SAIF-PT-001-M-BLK', NULL, 10, 'M', 'Black'),
  ((SELECT id FROM products WHERE slug = 'monochrome-joggers'), 'Large / Black', 'SAIF-PT-001-L-BLK', NULL, 10, 'L', 'Black');

-- Insert sample coupon
INSERT INTO coupons (code, type, value, min_order_value, max_uses, is_active) VALUES
  ('WELCOME20', 'percentage', 20, 50.00, 100, true),
  ('SAIF10', 'fixed', 10, NULL, NULL, true);


COMMIT;
