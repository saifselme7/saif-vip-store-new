-- ============================================================
-- SAIF STORE — Fashion storefront migration
-- Run once in the Supabase SQL Editor. It is idempotent (safe to re-run).
--
-- WHAT THIS DOES (content only — no tables, no columns, no RLS changes):
--   1. Retires the legacy "digital" categories from the storefront
--      (deactivated, never deleted — reactivate any time).
--   2. Archives the digital-catalogue products (status = 'archived',
--      reversible with a single UPDATE — nothing is deleted).
--   3. Refreshes homepage CMS copy to the fashion campaign.
--   4. Reorders homepage sections into the editorial narrative.
--   5. Disables the legacy digital rail section.
--   6. Refreshes brand copy in site_settings (descriptions + SEO only).
--
-- Everything remains editable from the admin dashboard afterwards.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Categories — retire the digital catalogue, refresh labels
-- ------------------------------------------------------------
UPDATE categories
SET is_active = FALSE, updated_at = NOW()
WHERE slug IN ('digital-products', 'social-media') AND is_active;

UPDATE categories
SET name = 'Pants & Jackets',
    name_ar = 'بناطيل وجاكيتات',
    description = 'Pants, bottoms and layered outerwear',
    description_ar = 'بناطيل وقطع طبقات مختارة بعناية',
    updated_at = NOW()
WHERE slug = 'streetwear';

-- ------------------------------------------------------------
-- 2) Digital products — archive (fully reversible, nothing deleted)
--    To bring them back later:
--      UPDATE products SET status='active' WHERE product_type='digital';
-- ------------------------------------------------------------
UPDATE products
SET status = 'archived', updated_at = NOW()
WHERE product_type = 'digital' AND status = 'active';

-- ------------------------------------------------------------
-- 3) Homepage sections — fashion campaign copy + narrative order
--    (positions drive render order; the storefront alternates the
--     black campaign sections with warm off-white catalogue sections)
-- ------------------------------------------------------------
UPDATE homepage_sections SET
  position = 1,
  config = config || '{"cta1_text_en":"Explore the Collection","cta1_text_ar":"اكتشف المجموعة","cta1_dest":"/products","cta2_text_en":"See What''s New","cta2_text_ar":"شوف الجديد","cta2_dest":"/products?sort=newest"}'::jsonb
WHERE section_key = 'hero';

UPDATE homepage_sections SET position = 2 WHERE section_key = 'rail_new';
UPDATE homepage_sections SET position = 3 WHERE section_key = 'categories';
UPDATE homepage_sections SET position = 4 WHERE section_key = 'rail_bestsellers';
UPDATE homepage_sections SET position = 5 WHERE section_key = 'spotlight';
UPDATE homepage_sections SET position = 6 WHERE section_key = 'brand';
UPDATE homepage_sections SET position = 7 WHERE section_key = 'rail_offers';
UPDATE homepage_sections SET position = 8 WHERE section_key = 'rail_featured';
UPDATE homepage_sections SET position = 9 WHERE section_key = 'reviews';
UPDATE homepage_sections SET position = 10 WHERE section_key = 'how_it_works';
UPDATE homepage_sections SET position = 11 WHERE section_key = 'final_cta';

-- The digital rail belongs to the retired concept: disabled, kept for history.
UPDATE homepage_sections
SET is_enabled = FALSE, position = 12
WHERE section_key = 'rail_digital';

UPDATE homepage_sections SET
  title_en = 'Made to be worn, not stored.',
  title_ar = 'اتعملت عشان تتلبس، مش تتخزن.',
  subtitle_en = 'SAIF STORE is an Egyptian fashion label building pieces that outlast trends — heavy fabrics, considered cuts, honest details. Every drop is small and limited, and every piece has a story.',
  subtitle_ar = 'SAIF STORE ماركة ملابس مصرية بتصمم قطع تعيش أطول من الترند — خامات تقيلة، قصات مدروسة، وتفاصيل مضبوطة. كل دروب صغير ومحدود، وكل قطعة ليها قصة.',
  config = config || '{"fact1_title_en":"Heavy fabrics","fact1_title_ar":"خامات تقيلة","fact1_text_en":"Carefully selected materials and precise construction — built to live with you for years.","fact1_text_ar":"أقمشة مختارة بعناية وخياطة متقنة — معمولة تعيش معاك سنين.","fact2_title_en":"Limited drops","fact2_title_ar":"دروب محدودة","fact2_text_en":"Small quantities in every drop. When it''s gone, it''s gone.","fact2_text_ar":"كميات صغيرة في كل دروب. أول ما تخلص، تخلص.","fact3_title_en":"Verified by humans","fact3_title_ar":"تأكيد بشري","fact3_text_en":"Every InstaPay / Vodafone Cash transfer is checked by our team.","fact3_text_ar":"كل تحويل انستا باي أو فودافون كاش بيراجعه فريقنا بنفسه."}'::jsonb
WHERE section_key = 'brand';

UPDATE homepage_sections SET
  title_en = 'Pick your uniform.',
  title_ar = 'اختار ستايلك.',
  subtitle_en = 'From tees to jackets — every category holds pieces chosen with one standard.',
  subtitle_ar = 'من التيشيرت للجاكيت — كل قسم فيه قطع مختارة بعناية لكل اللوكات.',
  config = config || '{"cta_text_en":"Explore","cta_text_ar":"اتفرج"}'::jsonb
WHERE section_key = 'categories';

UPDATE homepage_sections SET
  config = config || '{"heading_en":"Featured Look","heading_ar":"اللوك المميز","cta_text_en":"View Product","cta_text_ar":"شوف المنتج"}'::jsonb
WHERE section_key = 'spotlight';

UPDATE homepage_sections SET
  title_en = 'Fresh in.',
  title_ar = 'وصل حديثًا.',
  subtitle_en = 'The latest additions to the catalogue.',
  subtitle_ar = 'آخر اللي اتضاف للكتالوج.'
WHERE section_key = 'rail_new';

UPDATE homepage_sections SET
  title_en = 'The pieces everyone comes back for.',
  title_ar = 'القطع اللي الناس بترجع تدور عليها.',
  subtitle_en = 'Best sellers, ranked by real orders.',
  subtitle_ar = 'الأكثر مبيعًا، مرتبة على حسب طلبات حقيقية.'
WHERE section_key = 'rail_bestsellers';

UPDATE homepage_sections SET
  subtitle_en = 'Limited pieces, heavy fabrics, and details you won''t find anywhere else.',
  subtitle_ar = 'قطع محدودة، خامات تقيلة، وتفاصيل مش هتلاقيها في أي حتة تانية.',
  config = config || '{"cta_text_en":"Shop the Collection","cta_text_ar":"اتفرج على الكولكشن","cta_dest":"/products","secondary_text_en":"Our Story","secondary_text_ar":"قصتنا","secondary_dest":"/about"}'::jsonb
WHERE section_key = 'final_cta';

UPDATE homepage_sections SET
  config = config || '{"steps":[{"title_en":"Place your order","title_ar":"اطلب طلبك","text_en":"Check out with your account — your items are reserved immediately while we wait for payment.","text_ar":"اطلب من حسابك — منتجاتك بتتحجز في نفس اللحظة في انتظار الدفع."},{"title_en":"Transfer the total","title_ar":"حوّل الإجمالي","text_en":"Send the exact amount via InstaPay or Vodafone Cash to the number shown at checkout, then upload the screenshot.","text_ar":"حوّل المبلغ بالظبط عن طريق انستا باي أو فودافون كاش على الرقم اللي بيظهر عند الدفع، وبعدين ارفع صورة التحويل."},{"title_en":"We verify & deliver","title_ar":"نتأكد ونبعتهولك","text_en":"Our team checks every transfer manually. Once approved, your order is prepared and shipped to your door.","text_ar":"فريقنا بيراجع كل تحويل بإيده. أول ما يتأكد، طلبك بيتجهز وبيتشحن لباب البيت."}]}'::jsonb
WHERE section_key = 'how_it_works';

-- ------------------------------------------------------------
-- 4) Site settings — brand copy refresh (payments, fees, numbers,
--    announcements and everything operational stay untouched)
-- ------------------------------------------------------------
UPDATE site_settings SET
  store_description = 'Premium fashion label from Egypt — t-shirts, hoodies, sweatshirts, pants and jackets. Heavy fabrics, limited drops, honest details.',
  store_description_ar = 'ماركة ملابس بريميوم من مصر — تيشيرتات، هوديز، سويتشيرتات، بناطيل وجاكيتات. خامات تقيلة، دروب محدودة، وتفاصيل مضبوطة.',
  hero_subtitle = 'Premium clothing from Egypt — heavy fabrics, considered cuts, honest details. Every piece is made to be worn, not stored.',
  hero_subtitle_ar = 'ملابس بريميوم من مصر — خامات تقيلة، قصات مدروسة، وتفاصيل مضبوطة. كل قطعة متعملة عشان تتلبس كتير، مش تتخزن.',
  seo_title = 'SAIF STORE — Wear Your Statement',
  seo_description = 'Premium fashion from Egypt — t-shirts, hoodies, sweatshirts, pants and jackets. Manual payment via InstaPay & Vodafone Cash.',
  updated_at = NOW()
WHERE store_description ILIKE '%digital%' OR hero_subtitle ILIKE '%digital%' OR seo_title IS NULL OR seo_title = 'SAIF STORE — Premium Streetwear & Digital Products';

COMMIT;
