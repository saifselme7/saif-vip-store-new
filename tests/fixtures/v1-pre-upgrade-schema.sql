-- ============================================================
-- SAIF STORE — Original v1 Baseline Schema (pre-upgrade)
-- Fixture for testing migrations and reconciliation
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  address JSONB DEFAULT '{}',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  slug TEXT NOT NULL UNIQUE,
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  description_ar TEXT,
  short_description TEXT DEFAULT '',
  short_description_ar TEXT,
  price NUMERIC(10,2) NOT NULL,
  compare_at_price NUMERIC(10,2),
  sku TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  bestseller BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  product_type TEXT NOT NULL DEFAULT 'physical' CHECK (product_type IN ('physical', 'digital')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  images TEXT[] NOT NULL DEFAULT '{}',
  thumbnail TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC(10,2),
  compare_at_price NUMERIC(10,2),
  stock INTEGER NOT NULL DEFAULT 0,
  size TEXT,
  color TEXT,
  color_code TEXT,
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  min_order_value NUMERIC(12,2),
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'rejected', 'delivered')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'SAIF STORE',
  store_description TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP',
  shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 50,
  free_shipping_threshold NUMERIC(10,2),
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  social_links JSONB DEFAULT '{}',
  announcement TEXT,
  announcement_enabled BOOLEAN DEFAULT false,
  announcement_link TEXT,
  announcement_link_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
