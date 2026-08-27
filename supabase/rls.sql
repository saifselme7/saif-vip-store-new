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
