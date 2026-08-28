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
