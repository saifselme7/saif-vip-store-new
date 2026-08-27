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
