-- ============================================================
-- SAIF STORE — Server-side business logic (RPCs)
-- All checkout/payment/admin mutations run through these
-- SECURITY DEFINER functions so prices, stock and coupons are
-- validated on the database side and stay transactional.
-- ============================================================

-- ------------------------------------------------------------
-- Coupon validation (does NOT expose full coupon rows).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_subtotal NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c coupons%rowtype;
  v_discount NUMERIC;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Enter a coupon code.');
  END IF;

  SELECT * INTO c FROM coupons
  WHERE upper(code) = upper(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon code does not exist.');
  END IF;
  IF NOT c.is_active THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon is no longer active.');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon has expired.');
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses_count >= c.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon has reached its usage limit.');
  END IF;
  IF c.min_order_value IS NOT NULL AND p_subtotal < c.min_order_value THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon requires a minimum order of ' || c.min_order_value::text || '.'
    );
  END IF;

  IF c.type = 'percentage' THEN
    v_discount := round(p_subtotal * c.value / 100, 2);
  ELSE
    v_discount := LEAST(c.value, p_subtotal);
  END IF;
  IF c.max_discount IS NOT NULL THEN
    v_discount := LEAST(v_discount, c.max_discount);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', c.code,
    'type', c.type,
    'value', c.value,
    'discount', v_discount,
    'message', 'Coupon applied.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO authenticated;

-- ------------------------------------------------------------
-- Atomic checkout: validates stock & coupon, computes totals on
-- the server, reserves stock, creates order + order items.
-- p_items: [{"product_id": "...", "variant_id": null, "quantity": 2}]
-- p_customer: {"name","email","phone","governorate","city","address","notes"}
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(
  p_items JSONB,
  p_coupon_code TEXT,
  p_customer JSONB,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_settings site_settings%rowtype;
  v_item JSONB;
  v_product products%rowtype;
  v_variant product_variants%rowtype;
  v_price NUMERIC;
  v_qty INTEGER;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_shipping NUMERIC := 0;
  v_total NUMERIC;
  v_has_physical BOOLEAN := FALSE;
  v_order_id UUID;
  v_order_number TEXT;
  v_coupon coupons%rowtype;
  v_rows INTEGER;
  v_lines JSONB := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;
  IF p_payment_method NOT IN ('instapay', 'vodafone_cash') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF coalesce(trim(p_customer->>'name'), '') = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF coalesce(trim(p_customer->>'email'), '') = '' THEN
    RAISE EXCEPTION 'Customer email is required';
  END IF;

  SELECT * INTO v_settings FROM site_settings LIMIT 1;

  -- Pass 1: validate every line, reserve stock, compute subtotal.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    SELECT * INTO v_product FROM products
    WHERE id = (v_item->>'product_id')::uuid AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in your cart is no longer available';
    END IF;

    v_price := v_product.price;
    IF v_item->>'variant_id' IS NOT NULL THEN
      SELECT * INTO v_variant FROM product_variants
      WHERE id = (v_item->>'variant_id')::uuid AND product_id = v_product.id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'A selected option for "%" is no longer available', v_product.name;
      END IF;
      IF v_variant.price IS NOT NULL THEN v_price := v_variant.price; END IF;
    END IF;

    -- Physical goods: atomically reserve stock (variant + aggregate).
    IF v_product.product_type = 'physical' THEN
      v_has_physical := TRUE;
      IF v_item->>'variant_id' IS NOT NULL THEN
        UPDATE product_variants SET stock = stock - v_qty
        WHERE id = v_variant.id AND stock >= v_qty;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 0 THEN
          RAISE EXCEPTION 'Insufficient stock for "%" (%)', v_product.name, v_variant.name;
        END IF;
      END IF;
      UPDATE products SET stock = stock - v_qty
      WHERE id = v_product.id AND stock >= v_qty;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows = 0 THEN
        RAISE EXCEPTION 'Insufficient stock for "%"', v_product.name;
      END IF;
    END IF;

    v_subtotal := v_subtotal + (v_price * v_qty);
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id,
      'variant_id', CASE WHEN v_item->>'variant_id' IS NULL THEN NULL ELSE (v_item->>'variant_id')::uuid END,
      'product_name', v_product.name,
      'variant_name', CASE WHEN v_item->>'variant_id' IS NULL THEN NULL ELSE v_variant.name END,
      'product_type', v_product.product_type,
      'price', v_price,
      'quantity', v_qty,
      'total', v_price * v_qty
    );
  END LOOP;

  -- Minimum order amount.
  IF v_settings.minimum_order_amount IS NOT NULL AND v_subtotal < v_settings.minimum_order_amount THEN
    RAISE EXCEPTION 'The minimum order amount is %', v_settings.minimum_order_amount;
  END IF;

  -- Coupon (server-side revalidation — never trust the client).
  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon FROM coupons
    WHERE upper(code) = upper(trim(p_coupon_code)) AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR uses_count < max_uses)
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The coupon code is invalid or expired';
    END IF;
    IF v_coupon.min_order_value IS NOT NULL AND v_subtotal < v_coupon.min_order_value THEN
      RAISE EXCEPTION 'The coupon requires a minimum order of %', v_coupon.min_order_value;
    END IF;
    IF v_coupon.type = 'percentage' THEN
      v_discount := round(v_subtotal * v_coupon.value / 100, 2);
    ELSE
      v_discount := LEAST(v_coupon.value, v_subtotal);
    END IF;
    IF v_coupon.max_discount IS NOT NULL THEN
      v_discount := LEAST(v_discount, v_coupon.max_discount);
    END IF;
    UPDATE coupons SET uses_count = uses_count + 1 WHERE id = v_coupon.id;
  END IF;

  -- Shipping (physical goods only).
  IF v_has_physical THEN
    IF v_settings.free_shipping_threshold IS NULL OR v_subtotal < v_settings.free_shipping_threshold THEN
      v_shipping := coalesce(v_settings.shipping_fee, 0);
    END IF;
  END IF;

  v_total := v_subtotal - v_discount + v_shipping;
  v_order_number := 'SAIF-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  INSERT INTO orders (
    order_number, user_id, status, subtotal, discount, shipping_fee, total,
    coupon_code, payment_method, customer_name, customer_email, customer_phone,
    shipping_address, notes
  ) VALUES (
    v_order_number, v_user, 'pending', v_subtotal, v_discount, v_shipping, v_total,
    CASE WHEN v_coupon.id IS NULL THEN NULL ELSE v_coupon.code END,
    p_payment_method,
    trim(p_customer->>'name'),
    trim(p_customer->>'email'),
    NULLIF(trim(p_customer->>'phone'), ''),
    jsonb_strip_nulls(jsonb_build_object(
      'governorate', p_customer->>'governorate',
      'city', p_customer->>'city',
      'address', p_customer->>'address'
    )),
    NULLIF(trim(p_customer->>'notes'), '')
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, product_type, price, quantity, total)
  SELECT
    v_order_id,
    (l->>'product_id')::uuid,
    CASE WHEN l->>'variant_id' IS NULL THEN NULL ELSE (l->>'variant_id')::uuid END,
    l->>'product_name',
    l->>'variant_name',
    coalesce(l->>'product_type', 'physical'),
    (l->>'price')::numeric,
    (l->>'quantity')::int,
    (l->>'total')::numeric
  FROM jsonb_array_elements(v_lines) AS l;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'shipping', v_shipping,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(JSONB, TEXT, JSONB, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Customer submits manual payment evidence for their own order.
-- Creates a new payment ledger row; rejects if a submission is
-- already awaiting review.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_payment(
  p_order_id UUID,
  p_payment_method TEXT,
  p_transferred_amount NUMERIC,
  p_payer_identifier TEXT,
  p_screenshot_path TEXT,
  p_customer_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_order orders%rowtype;
  v_payment_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.user_id <> v_user THEN
    RAISE EXCEPTION 'This order belongs to another account';
  END IF;
  IF v_order.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'This order has been cancelled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM payments
    WHERE order_id = p_order_id AND status IN ('under_review', 'approved')
  ) THEN
    RAISE EXCEPTION 'A payment for this order is already submitted or approved';
  END IF;
  IF p_payment_method NOT IN ('instapay', 'vodafone_cash') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF p_transferred_amount IS NULL OR p_transferred_amount <= 0 THEN
    RAISE EXCEPTION 'Enter the amount you transferred';
  END IF;
  IF coalesce(trim(p_payer_identifier), '') = '' THEN
    RAISE EXCEPTION 'Enter the phone/account number you paid from';
  END IF;
  IF coalesce(trim(p_screenshot_path), '') = '' THEN
    RAISE EXCEPTION 'Upload the transfer screenshot';
  END IF;

  INSERT INTO payments (
    order_id, user_id, payment_method, status, expected_amount,
    transferred_amount, payer_identifier, screenshot_path, customer_note
  ) VALUES (
    p_order_id, v_user, p_payment_method, 'under_review', v_order.total,
    p_transferred_amount, trim(p_payer_identifier), trim(p_screenshot_path), p_customer_note
  ) RETURNING id INTO v_payment_id;

  UPDATE orders SET status = 'payment_review', payment_method = p_payment_method
  WHERE id = p_order_id AND status IN ('pending', 'payment_review');

  RETURN jsonb_build_object('payment_id', v_payment_id, 'status', 'under_review');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Admin payment review. p_action: approve | reject | hold | cancel
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%rowtype;
  v_item order_items%rowtype;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.stock_released THEN RETURN; END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.product_type = 'physical' THEN
      IF v_item.variant_id IS NOT NULL THEN
        UPDATE product_variants SET stock = stock + v_item.quantity WHERE id = v_item.variant_id;
      END IF;
      UPDATE products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  UPDATE orders SET stock_released = TRUE WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_payment(
  p_payment_id UUID,
  p_action TEXT,
  p_admin_note TEXT DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%rowtype;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status = 'approved' THEN
    RAISE EXCEPTION 'This payment was already approved';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE payments SET
      status = 'approved',
      admin_note = coalesce(p_admin_note, admin_note),
      verified_by = auth.uid(),
      verified_at = now()
    WHERE id = p_payment_id;
    UPDATE orders SET status = 'confirmed' WHERE id = v_payment.order_id;
    RETURN jsonb_build_object('status', 'approved');

  ELSIF p_action = 'reject' THEN
    IF coalesce(trim(p_rejection_reason), '') = '' THEN
      RAISE EXCEPTION 'A rejection reason is required';
    END IF;
    UPDATE payments SET
      status = 'rejected',
      rejection_reason = trim(p_rejection_reason),
      admin_note = coalesce(p_admin_note, admin_note),
      verified_by = auth.uid(),
      verified_at = now()
    WHERE id = p_payment_id;
    RETURN jsonb_build_object('status', 'rejected');

  ELSIF p_action = 'hold' THEN
    UPDATE payments SET
      status = 'under_review',
      admin_note = coalesce(p_admin_note, admin_note)
    WHERE id = p_payment_id;
    RETURN jsonb_build_object('status', 'under_review');

  ELSIF p_action = 'cancel' THEN
    UPDATE payments SET
      status = 'cancelled',
      admin_note = coalesce(p_admin_note, admin_note),
      verified_by = auth.uid(),
      verified_at = now()
    WHERE id = p_payment_id;
    UPDATE orders SET status = 'cancelled' WHERE id = v_payment.order_id;
    PERFORM public.release_order_stock(v_payment.order_id);
    RETURN jsonb_build_object('status', 'cancelled');

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_payment(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Admin order status updates (with automatic restock on cancel).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_order_status(p_order_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_status NOT IN ('pending','payment_review','confirmed','processing','ready','shipped','delivered','completed','cancelled','refunded') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE orders SET status = p_status WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF p_status IN ('cancelled', 'refunded') THEN
    PERFORM public.release_order_stock(p_order_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_order_status(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Digital delivery: only served to the owner (or an admin) and
-- only once the payment has been approved.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_digital_delivery(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%rowtype;
  v_paid BOOLEAN;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.user_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM payments WHERE order_id = p_order_id AND status = 'approved'
  ) INTO v_paid;

  IF NOT v_paid THEN
    RETURN jsonb_build_object('unlocked', false);
  END IF;
  RETURN jsonb_build_object('unlocked', true, 'delivery', coalesce(v_order.digital_delivery, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_digital_delivery(UUID) TO authenticated;

-- ------------------------------------------------------------
-- Admin: analytics summary (aggregated, no raw data dumps).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_analytics_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'revenue', coalesce(sum(o.total), 0),
        'orders', count(*)::int,
        'avg_order_value', coalesce(round(avg(o.total), 2), 0),
        'customers', (SELECT count(*) FROM profiles WHERE role = 'customer'),
        'products', (SELECT count(*) FROM products),
        'low_stock', (SELECT count(*) FROM products WHERE status = 'active' AND product_type = 'physical' AND stock <= low_stock_threshold AND stock > 0),
        'out_of_stock', (SELECT count(*) FROM products WHERE status = 'active' AND product_type = 'physical' AND stock <= 0),
        'awaiting_payments', (SELECT count(*) FROM payments WHERE status = 'under_review'),
        'pending_orders', (SELECT count(*) FROM orders WHERE status IN ('pending', 'payment_review'))
      )
      FROM orders o
      WHERE o.status IN ('confirmed','processing','ready','shipped','delivered','completed')
    ),
    'daily', (
      SELECT coalesce(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT
          to_char(o.created_at, 'YYYY-MM-DD') AS day,
          coalesce(sum(o.total), 0)::numeric AS revenue,
          count(*)::int AS orders
        FROM orders o
        WHERE o.created_at >= now() - interval '30 days'
          AND o.status NOT IN ('cancelled', 'refunded', 'pending', 'payment_review')
        GROUP BY 1
      ) d
    ),
    'top_products', (
      SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.units DESC), '[]'::jsonb)
      FROM (
        SELECT oi.product_name AS name, sum(oi.quantity)::int AS units, sum(oi.total)::numeric AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('cancelled', 'refunded', 'pending', 'payment_review')
        GROUP BY oi.product_name
        ORDER BY units DESC
        LIMIT 8
      ) t
    ),
    'payment_methods', (
      SELECT coalesce(jsonb_agg(row_to_json(m)), '[]'::jsonb)
      FROM (
        SELECT p.payment_method AS method, count(*)::int AS count, sum(p.expected_amount)::numeric AS total
        FROM payments p
        WHERE p.status = 'approved'
        GROUP BY p.payment_method
      ) m
    ),
    'order_statuses', (
      SELECT coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      FROM (SELECT status, count(*)::int AS count FROM orders GROUP BY status) s
    ),
    'product_types', (
      SELECT coalesce(jsonb_agg(row_to_json(pt)), '[]'::jsonb)
      FROM (
        SELECT oi.product_type AS type, sum(oi.total)::numeric AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('cancelled', 'refunded', 'pending', 'payment_review')
        GROUP BY oi.product_type
      ) pt
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary() TO authenticated;

-- ------------------------------------------------------------
-- Admin: per-customer order stats.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_stats()
RETURNS TABLE (user_id UUID, order_count BIGINT, total_spent NUMERIC, last_order_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    count(o.id) AS order_count,
    coalesce(sum(o.total) FILTER (WHERE o.status NOT IN ('cancelled', 'refunded')), 0) AS total_spent,
    max(o.created_at) AS last_order_at
  FROM profiles p
  LEFT JOIN orders o ON o.user_id = p.id
  WHERE p.role = 'customer'
  GROUP BY p.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_stats() TO authenticated;

-- ------------------------------------------------------------
-- Admin: change a user's role (the ONLY supported way besides
-- the SQL editor — regular users cannot touch role at all).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_role NOT IN ('customer', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE profiles SET role = p_role WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT) TO authenticated;
