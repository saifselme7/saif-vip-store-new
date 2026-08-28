-- ============================================================
-- SAIF STORE — POST-MIGRATION ADMIN VERIFICATION (READ-ONLY)
--
-- Run AFTER: 2026-08-28-admin-reconcile.sql → functions.sql → rls.sql
-- Pure SQL — no psql meta-commands. Every row should say OK.
-- ============================================================

-- 1. Admin accounts exist (authentication + role)
SELECT '1) ADMIN ROLE' AS step,
       CASE WHEN COUNT(*) > 0
            THEN 'OK — ' || COUNT(*) || ' admin(s) exist'
            ELSE 'FAIL — no admin. Run: UPDATE profiles SET role = ''admin'' WHERE email = ''you@example.com'';'
       END AS result
FROM profiles WHERE role = 'admin';

-- 2. Role escalation guard (trigger present)
SELECT '2) ROLE ESCALATION GUARD' AS step,
       CASE WHEN COUNT(*) > 0 THEN 'OK — protect_profile_role trigger active' ELSE 'FAIL — trigger missing' END AS result
FROM pg_trigger WHERE tgname = 'profiles_protect_role';

-- 3. Required RPCs present
SELECT '3) REQUIRED RPC FUNCTIONS' AS step,
       CASE WHEN COUNT(*) = 0 THEN 'OK — all present'
            ELSE 'FAIL — MISSING: ' || string_agg(f.name, ', ')
       END AS result
FROM (VALUES
  ('place_order'), ('submit_payment'), ('review_payment'),
  ('admin_update_order_status'), ('admin_add_order_note'), ('admin_set_fulfillment'),
  ('customer_cancel_order'), ('admin_adjust_stock'), ('admin_dashboard_stats'),
  ('admin_sales_analytics'), ('admin_customer_stats'), ('validate_coupon'),
  ('get_product_rating_stats'), ('is_admin'), ('restore_order_stock')
) AS f(name)
WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = f.name);

-- 3b. review_payment resolves with the frontend's parameter name (p_decision)
SELECT '3b) review_payment SIGNATURE' AS step,
       CASE WHEN COUNT(*) > 0
            THEN 'OK — p_decision contract resolves'
            ELSE 'FAIL — frontend calls review_payment(p_decision => ...) — signature mismatch'
       END AS result
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'review_payment'
  AND pg_get_function_arguments(p.oid) ILIKE '%p_decision%';

-- 4. RPC smoke tests (run as postgres in the SQL editor — this verifies
--    execution, not permissions; permissions are enforced per-role by RLS)
SELECT '4a) admin_dashboard_stats' AS step,
       CASE WHEN (admin_dashboard_stats()).total_orders IS NOT NULL
            THEN 'OK — executed and returned statistics'
            ELSE 'FAIL' END AS result;
SELECT '4b) admin_sales_analytics' AS step,
       CASE WHEN EXISTS (SELECT 1 FROM admin_sales_analytics(30)) THEN 'OK — executed' ELSE 'FAIL' END AS result;
SELECT '4c) admin_customer_stats' AS step,
       CASE WHEN EXISTS (SELECT 1 FROM admin_customer_stats()) THEN 'OK — executed' ELSE 'FAIL' END AS result;

-- 5. Data preserved (row counts — compare with your expectations)
SELECT '5) DATA PRESERVED' AS step, 'products' AS table_name, COUNT(*) AS rows FROM products
UNION ALL SELECT '5) DATA PRESERVED', 'orders', COUNT(*) FROM orders
UNION ALL SELECT '5) DATA PRESERVED', 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT '5) DATA PRESERVED', 'payments', COUNT(*) FROM payments
UNION ALL SELECT '5) DATA PRESERVED', 'coupons', COUNT(*) FROM coupons
UNION ALL SELECT '5) DATA PRESERVED', 'reviews', COUNT(*) FROM reviews
UNION ALL SELECT '5) DATA PRESERVED', 'profiles', COUNT(*) FROM profiles
ORDER BY table_name;

-- 6. Payments integrity: one per order
SELECT '6) PAYMENT INTEGRITY' AS step,
       CASE WHEN COUNT(*) = 0 THEN 'OK — one active payment per order'
            ELSE 'WARN — ' || COUNT(*) || ' orders still have multiple ACTIVE payment rows' END AS result
FROM (SELECT order_id FROM payments WHERE COALESCE(payment_status, 'awaiting_payment') <> 'cancelled' GROUP BY order_id HAVING COUNT(*) > 1) d;
SELECT '6b) PAYMENT STATUS DISTRIBUTION' AS step, payment_status AS value, COUNT(*) FROM payments GROUP BY payment_status ORDER BY 3 DESC;

-- 7. Inventory audit log
SELECT '7) INVENTORY LOGS' AS step,
       CASE WHEN COUNT(*) > 0 THEN 'OK — ' || COUNT(*) || ' audit rows'
            ELSE 'INFO — empty (rows appear after the first order/adjustment)' END AS result
FROM inventory_logs;

-- 8. Storage buckets + policies
SELECT '8a) STORAGE BUCKETS' AS step,
       CASE WHEN COUNT(*) = 2 THEN 'OK — both buckets exist' ELSE 'FAIL — bucket(s) missing' END AS result
FROM storage.buckets WHERE id IN ('payment-screenshots', 'product-images');
SELECT '8b) SCREENSHOT POLICIES' AS step,
       CASE WHEN COUNT(*) >= 4 THEN 'OK — payment screenshot policies present' ELSE 'FAIL — policies missing' END AS result
FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (qual ILIKE '%payment-screenshots%' OR with_check ILIKE '%payment-screenshots%');

-- 9. No legacy policies / functions remain
SELECT '9a) LEGACY POLICIES (want OK)' AS step,
       CASE WHEN COUNT(*) = 0 THEN 'OK — no legacy policies'
            ELSE 'FAIL — remaining: ' || string_agg(policyname, ', ') END AS result
FROM pg_policies
WHERE (schemaname = 'public' AND policyname IN (
    'Users can view own profile', 'Users can update own profile', 'Users can insert own profile',
    'Products admin all', 'Orders own', 'Order items through order',
    'Reviews public read approved', 'Reviews own read', 'Reviews own write', 'Payments own read'))
   OR (schemaname = 'storage' AND policyname LIKE 'Screenshots owner%');
SELECT '9b) LEGACY FUNCTIONS (want OK)' AS step,
       CASE WHEN COUNT(*) = 0 THEN 'OK — no legacy functions'
            ELSE 'FAIL — legacy functions remain' END AS result
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN
  ('set_order_status', 'release_order_stock', 'set_user_role', 'log_product_stock_change');

-- 10. Site settings sanity
SELECT '10) SETTINGS' AS step,
       CASE WHEN payment_number IS NOT NULL AND payment_number <> ''
            THEN 'OK — payment number: ' || payment_number
            ELSE 'FAIL — payment number missing' END AS result,
       instapay_enabled, vodafone_cash_enabled, currency
FROM site_settings LIMIT 1;

-- Done
SELECT 'DONE' AS step,
       'If every row says OK, sign in to the app as an admin — the dashboard should load live statistics.' AS instruction;
