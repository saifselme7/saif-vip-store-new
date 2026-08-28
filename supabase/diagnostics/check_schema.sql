-- ============================================================
-- SAIF STORE — DATABASE STATE DIAGNOSTIC (READ-ONLY)
--
-- Run this FIRST in the Supabase SQL Editor (Dashboard → SQL Editor
-- → New query → paste → RUN). Pure SQL — no psql meta-commands.
--
-- It changes NOTHING. It reports what exists and what the current
-- application still needs. Keep the output — it decides which
-- migration path you run.
-- ============================================================

-- ---------- 1. Which "lineage" is the database in? ----------
SELECT '1) DATABASE LINEAGE' AS step,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'payments')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'status')
      THEN 'SIBLING-V2 LINEAGE (payments.status column) → run 2026-08-28-admin-reconcile.sql'
    WHEN EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'payments')
      THEN 'UPGRADED LINEAGE (payments exists) → compare missing pieces below'
    ELSE 'ORIGINAL/V1 LINEAGE (no payments table) → run 2026-08-28-admin-reconcile.sql (works from any state)'
  END AS detected_state;

-- ---------- 2. Required tables ----------
SELECT '2) REQUIRED TABLES' AS step,
       t.name AS table_name,
       CASE WHEN to_regclass('public.' || t.name) IS NULL THEN 'MISSING' ELSE 'exists' END AS status
FROM (VALUES ('payments'), ('order_events'), ('inventory_logs'),
             ('products'), ('product_variants'), ('categories'),
             ('orders'), ('order_items'), ('coupons'), ('reviews'),
             ('site_settings'), ('profiles'), ('wishlists')) AS t(name)
ORDER BY status DESC, table_name;

-- ---------- 3. Required columns ----------
SELECT '3) REQUIRED COLUMNS' AS step,
       c.table_name || '.' || c.column_name AS column_name,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public'
                           AND table_name = c.table_name AND column_name = c.column_name)
            THEN 'exists' ELSE 'MISSING' END AS status
FROM (VALUES
  ('orders','payment_status'), ('orders','payment_method'), ('orders','shipping_fee'),
  ('orders','stock_reserved'), ('orders','internal_note'),
  ('payments','payment_status'), ('payments','payer_identifier'), ('payments','screenshot_path'),
  ('payments','verified_by'), ('payments','verified_at'), ('payments','rejection_reason'),
  ('order_items','product_type'), ('order_items','image'), ('order_items','fulfillment_note'),
  ('order_items','fulfilled_at'),
  ('products','low_stock_threshold'), ('products','specifications'), ('products','delivery_info'),
  ('coupons','max_discount_amount'),
  ('site_settings','payment_number'), ('site_settings','instapay_enabled'),
  ('site_settings','vodafone_cash_enabled'), ('site_settings','min_order_amount'),
  ('site_settings','payment_instructions')
) AS c(table_name, column_name)
ORDER BY status DESC, column_name;

-- ---------- 4. Required RPC functions ----------
SELECT '4) REQUIRED RPC FUNCTIONS' AS step,
       f.name AS function_name,
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p
                         JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = f.name)
            THEN 'exists' ELSE 'MISSING' END AS status
FROM (VALUES
  ('place_order'), ('submit_payment'), ('review_payment'),
  ('admin_update_order_status'), ('admin_add_order_note'), ('admin_set_fulfillment'),
  ('customer_cancel_order'), ('admin_adjust_stock'),
  ('admin_dashboard_stats'), ('admin_sales_analytics'), ('admin_customer_stats'),
  ('validate_coupon'), ('get_product_rating_stats'), ('is_admin'), ('restore_order_stock')
) AS f(name)
ORDER BY status, function_name;

-- ---------- 4b. review_payment signature (frontend calls p_decision) ----------
SELECT '4b) review_payment SIGNATURES' AS step,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'review_payment';
-- Expected after migration: p_payment_id uuid, p_decision text, p_admin_note text, p_rejection_reason text

-- ---------- 5. Admin accounts ----------
SELECT '5) ADMIN ACCOUNTS' AS step,
       role, COUNT(*) AS profiles_count
FROM profiles GROUP BY role ORDER BY role;
-- If no 'admin' row: the dashboard is blocked at the door. Promote yourself:
--   UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';

-- ---------- 6. Storage buckets ----------
SELECT '6) STORAGE BUCKETS' AS step, id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('payment-screenshots', 'product-images')
ORDER BY id;

-- ---------- 7. Storage policies for payment screenshots ----------
SELECT '7) SCREENSHOT POLICIES' AS step, policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (qual ILIKE '%payment-screenshots%' OR with_check ILIKE '%payment-screenshots%')
ORDER BY policyname;

-- ---------- 8. Legacy/duplicate policies that must be gone ----------
SELECT '8) LEGACY POLICIES STILL PRESENT (want ZERO rows)' AS step,
       schemaname, tablename, policyname
FROM pg_policies
WHERE (schemaname = 'public' AND policyname IN (
    'Users can view own profile', 'Users can update own profile', 'Users can insert own profile',
    'Products admin all', 'Orders own', 'Order items through order',
    'Reviews public read approved', 'Reviews own read', 'Reviews own write', 'Payments own read'))
   OR (schemaname = 'storage' AND policyname IN (
    'Screenshots owner upload', 'Screenshots owner or admin read',
    'Screenshots owner update', 'Screenshots owner delete'))
ORDER BY tablename, policyname;

-- ---------- 9. Legacy/conflicting functions that must be gone ----------
SELECT '9) LEGACY FUNCTIONS STILL PRESENT (want ZERO rows)' AS step,
       p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'set_order_status', 'release_order_stock', 'set_user_role', 'log_product_stock_change')
ORDER BY p.proname;

-- ---------- 10. Orders with multiple payment rows ----------
SELECT '10) ORDERS WITH MULTIPLE ACTIVE PAYMENTS (want ZERO rows)' AS step,
       order_id, COUNT(*) AS active_payment_rows
FROM payments WHERE COALESCE(payment_status, 'awaiting_payment') <> 'cancelled'
GROUP BY order_id HAVING COUNT(*) > 1;

-- ---------- 11. Order/payment status distributions ----------
SELECT '11a) ORDER STATUS' AS step, status AS value, COUNT(*) FROM orders GROUP BY status ORDER BY 3 DESC;
SELECT '11b) ORDER PAYMENT STATUS' AS step, payment_status AS value, COUNT(*) FROM orders GROUP BY payment_status ORDER BY 3 DESC;

-- ---------- Next step ----------
SELECT 'NEXT STEP' AS step,
  'Run, in order: supabase/migrations/2026-08-28-admin-reconcile.sql → supabase/functions.sql → supabase/rls.sql, then supabase/diagnostics/verify_admin.sql' AS instruction;
