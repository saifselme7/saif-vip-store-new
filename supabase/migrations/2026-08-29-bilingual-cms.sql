-- ============================================================
-- SAIF STORE — BILINGUAL + CMS MIGRATION (2026-08-29)
--
-- Adds Egyptian-Arabic content fields and the database-driven
-- homepage section configuration (order / visibility / content).
--
-- Safe by design:
--   * purely additive (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS)
--   * idempotent (safe to re-run)
--   * preserves all existing data
--   * backfills the new homepage_sections defaults from live settings
--   * maintains RLS: public read where content is public, admin-only writes
--
-- Run AFTER the database is on the current lineage
-- (2026-08-28-admin-reconcile.sql → functions.sql → rls.sql).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Bilingual product fields
-- ------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications_ar JSONB DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_info_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description_ar TEXT;

-- ------------------------------------------------------------
-- 2) Bilingual category fields
-- ------------------------------------------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description_ar TEXT;

-- ------------------------------------------------------------
-- 3) Localization + SEO + footer settings
-- ------------------------------------------------------------
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS default_language TEXT DEFAULT 'en'
  CHECK (default_language IN ('en', 'ar'));
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS available_languages TEXT[] DEFAULT ARRAY['en','ar'];
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS store_description_ar TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_title_ar TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_subtitle_ar TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS announcement_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS announcement_ar TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS announcement_link TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS announcement_link_text TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS footer_text_ar TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS shipping_info TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS shipping_info_ar TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS og_image TEXT;

-- ------------------------------------------------------------
-- 4) Homepage sections — the CMS table
--    position: render order (ascending). The storefront reads enabled
--    sections ordered by position; copy lives in title/subtitle (EN/AR)
--    plus a per-section JSONB config for CTA labels, product selections,
--    display limits, etc.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE UNIQUE INDEX IF NOT EXISTS homepage_sections_key_idx ON homepage_sections(section_key);
CREATE INDEX IF NOT EXISTS homepage_sections_position_idx ON homepage_sections(position);

DROP TRIGGER IF EXISTS homepage_sections_updated_at ON homepage_sections;
CREATE TRIGGER homepage_sections_updated_at BEFORE UPDATE ON homepage_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 5) Default sections (idempotent seed — never overwrites edits).
--    Values mirror the current hardcoded storefront so switching to the
--    CMS changes nothing visually until an admin edits it.
-- ------------------------------------------------------------
INSERT INTO homepage_sections (section_key, position, title_en, title_ar, subtitle_en, subtitle_ar, config) VALUES
  ('announcement', 0, NULL, NULL, NULL, NULL, '{}'),
  ('hero', 1, NULL, NULL, NULL, NULL,
   '{"eyebrow_en":"Streetwear","eyebrow_ar":"ستريت وير","eyebrow_mid_en":"Digital","eyebrow_mid_ar":"رقمي","eyebrow_end_en":"Curated","eyebrow_end_ar":"مختار بعناية","cta1_text_en":"Shop Now","cta1_text_ar":"تسوق دلوقتي","cta1_dest":"/products","cta2_text_en":"Digital Products","cta2_text_ar":"منتجات رقمية","cta2_dest":"/products?type=digital","overlay":20}'),
  ('brand', 2,
   'Made to be worn. Or judged. Or both.',
   'اتعملت عشان تتلبس. أو تحكم عليها. أو الاتنين.',
   'SAIF STORE curates premium streetwear alongside digital culture essentials — one standard for both worlds: real quality, honest information, and payments verified by people, not promises.',
   'SAIF STORE بتختار لك أحسن الستريت وير مع كل حاجة رقمية محترمة — معيار واحد للعالمين: جودة حقيقية، ومعلومات صريحة، ودفع بيتأكد بناس حقيقية مش وعود.',
   '{"fact1_title_en":"Physical drops","fact1_title_ar":"دروب ملموسة","fact1_text_en":"Heavyweight fabrics, careful printing — built to outlast trends.","fact1_text_ar":"أقمشة تقيلة وطباعة متقنة — معمولة تعيش أطول من الموضة.","fact2_title_en":"Digital essentials","fact2_title_ar":"أساسيات رقمية","fact2_text_en":"Boosts and digital goods, delivered after your payment is verified.","fact2_text_ar":"خدمات ومنتجات رقمية، بتوصلك بعد ما الدفع يتأكد.","fact3_title_en":"Verified by humans","fact3_title_ar":"تأكيد بشري","fact3_text_en":"Every InstaPay / Vodafone Cash transfer is checked by our team.","fact3_text_ar":"كل تحويل انستا باي أو فودافون كاش بيراجعه فريقنا بنفسه."}'),
  ('categories', 3,
   'Two worlds. One standard.',
   'عالمين. معيار واحد.',
   'Heavyweight streetwear shipped across Egypt, and digital essentials delivered after verification.',
   'ستريت وير تقيل بيوصل لكل مصر، وأساسيات رقمية بتوصلك بعد التأكيد.',
   '{"streetwear_label_en":"Streetwear","streetwear_label_ar":"ستريت وير","digital_label_en":"Digital","digital_label_ar":"رقمي","cta_text_en":"Explore","cta_text_ar":"اتفرج"}'),
  ('spotlight', 4, NULL, NULL,
   NULL, NULL,
   '{"heading_en":"The Spotlight","heading_ar":"المنتج المميز","cta_text_en":"View Product","cta_text_ar":"شوف المنتج"}'),
  ('rail_featured', 5,
   'Hand-picked from the current drop.',
   'اختياراتنا من الدروب الحالي.',
   'The pieces we would put in your hands first.',
   'القطع اللي هنبدأ بيها لو كنت قدامنا.',
   '{"source":"auto","limit":8,"view_all":"/products?featured=true"}'),
  ('rail_new', 6,
   'Fresh in.',
   'وصل حديثًا.',
   'The latest additions to the catalogue.',
   'آخر اللي اتضاف للكتالوج.',
   '{"source":"newest","limit":8,"view_all":"/products?sort=newest"}'),
  ('rail_offers', 7,
   'Marked down. While they last.',
   'تخفيضات. لحد ما تخلص.',
   'Real discounts on current stock — no countdowns, no games. When it''s gone, it''s gone.',
   'تخفيضات حقيقية على المخزون الحالي — من غير عدادات ولا ألعاب. أول ما تخلص تخلص.',
   '{"source":"offers","limit":4,"view_all":"/products?onSale=true"}'),
  ('rail_digital', 8,
   'Delivered after verification.',
   'بيوصلك بعد التأكيد.',
   'No shipping, no waiting on couriers — digital orders are fulfilled by our team once your payment is approved.',
   'من غير شحن ولا استنى مندوب — المنتجات الرقمية بنسلمها بنفسنا أول ما الدفع يتعتمد.',
   '{"source":"digital","limit":4,"view_all":"/products?type=digital"}'),
  ('rail_bestsellers', 9,
   'The pieces everyone comes back for.',
   'القطع اللي الناس بترجع تدور عليها.',
   'Best sellers, ranked by real orders.',
   'الأكثر مبيعًا، مرتبة على حسب طلبات حقيقية.',
   '{"source":"bestsellers","limit":8,"view_all":"/products?bestseller=true"}'),
  ('reviews', 10,
   'What customers say.',
   'اللي العملاء بيقولوه.',
   'Approved reviews from verified orders — moderated by our team.',
   'مراجعات معتمدة من طلبات حقيقية — بمراجعة فريقنا.',
   '{"count":3,"mode":"latest"}'),
  ('how_it_works', 11,
   'Ordered. Transferred. Verified.',
   'طلبت. حوّلت. اتأكدنا.',
   'No card needed. A payment flow built on manual verification — slow enough to be careful, fast enough to feel instant.',
   'من غير كروت. نظام دفع مبني على مراجعة بشرية — بالراحة الكفاية عشان نتأكد، وبالسرعة الكفاية عشان تحس إنه فوري.',
   '{"steps":[{"title_en":"Place your order","title_ar":"اطلب طلبك","text_en":"Check out with your account — your items are reserved immediately while we wait for payment.","text_ar":"اطلب من حسابك — منتجاتك بتتحجز في نفس اللحظة في انتظار الدفع."},{"title_en":"Transfer the total","title_ar":"حوّل الإجمالي","text_en":"Send the exact amount via InstaPay or Vodafone Cash to the number shown at checkout, then upload the screenshot.","text_ar":"حوّل المبلغ بالظبط عن طريق انستا باي أو فودافون كاش على الرقم اللي هيظهر عند الدفع، وبعدين ارفع صورة التحويل."},{"title_en":"We verify & deliver","title_ar":"نتأكد ونسلّم","text_en":"Our team checks every transfer manually. Once approved, physical orders ship and digital items are delivered.","text_ar":"فريقنا بيراجع كل تحويل بإيده. أول ما يتأكد، الطلبات الملموسة بتتشحن والرقمية بتتسلم."}]}'),
  ('final_cta', 12, NULL, NULL,
   'Spacing kept tight. Standards kept higher. Explore the pieces — or the digital essentials.',
   'مسافات مضبوطة ومعايير أعلى. اتفرج على القطع — أو على الأساسيات الرقمية.',
   '{"cta_text_en":"Shop the Collection","cta_text_ar":"اتفرج على الكولكشن","cta_dest":"/products","secondary_text_en":"Our Story","secondary_text_ar":"قصتنا","secondary_dest":"/about"}')
ON CONFLICT (section_key) DO NOTHING;

-- Backfill the announcement section from legacy settings once
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM site_settings WHERE announcement IS NOT NULL AND announcement <> '')
     AND EXISTS (SELECT 1 FROM homepage_sections WHERE section_key = 'announcement')
     AND (SELECT title_en FROM homepage_sections WHERE section_key = 'announcement') IS NULL THEN
    UPDATE homepage_sections
       SET title_en = s.announcement,
           is_enabled = s.announcement_enabled
      FROM site_settings s
     WHERE homepage_sections.section_key = 'announcement';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6) RLS: content is public-read; writes are admin-only
-- ------------------------------------------------------------
ALTER TABLE homepage_sections ENABLE ROW LEVEL SECURITY;

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

COMMIT;
