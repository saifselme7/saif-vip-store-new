-- ============================================================
-- SAIF STORE — Original v1 Baseline RLS (pre-upgrade)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- public tables read
CREATE POLICY "categories_read" ON categories FOR SELECT USING (true);
CREATE POLICY "products_read" ON products FOR SELECT USING (status = 'active');
CREATE POLICY "variants_read" ON product_variants FOR SELECT USING (true);
CREATE POLICY "settings_read" ON site_settings FOR SELECT USING (true);
CREATE POLICY "reviews_read" ON reviews FOR SELECT USING (true);

-- orders
CREATE POLICY "orders_read" ON orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "items_read" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "items_insert" ON order_items FOR INSERT WITH CHECK (true);

-- wishlists
CREATE POLICY "wishlists_all" ON wishlists FOR ALL USING (user_id = auth.uid());
