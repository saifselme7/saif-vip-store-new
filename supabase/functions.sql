-- ============================================================
-- SAIF STORE — Database functions (RPCs)
-- Idempotent: safe to re-run.
-- All SECURITY DEFINER functions pin search_path and validate
-- permissions explicitly. Execute rights are revoked from
-- PUBLIC/anon and granted only where required.
-- ============================================================

-- ------------------------------------------------------------
-- Helper: is the current caller an admin?
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- Helper: compute the discount a coupon grants for a subtotal.
-- Returns the discount amount, or raises with a reason.
-- Used inside place_order (server-side authority).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coupon_discount(p_code TEXT, p_subtotal NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_discount NUMERIC(12,2);
BEGIN
  SELECT * INTO c FROM coupons WHERE UPPER(code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon code not found';
  END IF;
  IF NOT c.is_active THEN
    RAISE EXCEPTION 'This coupon is no longer active';
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < NOW() THEN
    RAISE EXCEPTION 'This coupon has expired';
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses_count >= c.max_uses THEN
    RAISE EXCEPTION 'This coupon has reached its usage limit';
  END IF;
  IF c.min_order_value IS NOT NULL AND p_subtotal < c.min_order_value THEN
    RAISE EXCEPTION 'This coupon requires a minimum order of %', c.min_order_value;
  END IF;

  IF c.type = 'percentage' THEN
    v_discount := ROUND(p_subtotal * c.value / 100.0, 2);
    IF c.max_discount_amount IS NOT NULL THEN
      v_discount := LEAST(v_discount, c.max_discount_amount);
    END IF;
  ELSE
    v_discount := LEAST(c.value, p_subtotal);
  END IF;

  RETURN v_discount;
END;
$$;

-- ------------------------------------------------------------
-- Public: validate a coupon for a given subtotal without
-- applying it. Used by the cart/checkout UI.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_subtotal NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_discount NUMERIC(12,2);
BEGIN
  SELECT * INTO c FROM coupons WHERE UPPER(code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Coupon code not found');
  END IF;
  IF NOT c.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'This coupon is no longer active');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'This coupon has expired');
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses_count >= c.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'This coupon has reached its usage limit');
  END IF;
  IF c.min_order_value IS NOT NULL AND p_subtotal < c.min_order_value THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Minimum order of ' || c.min_order_value || ' required for this coupon');
  END IF;

  IF c.type = 'percentage' THEN
    v_discount := ROUND(p_subtotal * c.value / 100.0, 2);
    IF c.max_discount_amount IS NOT NULL THEN
      v_discount := LEAST(v_discount, c.max_discount_amount);
    END IF;
  ELSE
    v_discount := LEAST(c.value, p_subtotal);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'reason', NULL,
    'discount', v_discount,
    'coupon', jsonb_build_object(
      'code', c.code,
      'type', c.type,
      'value', c.value,
      'min_order_value', c.min_order_value,
      'max_discount_amount', c.max_discount_amount
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- Public: aggregated rating stats for products (approved
-- reviews only). Used for rating badges + sorting.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_rating_stats()
RETURNS TABLE (product_id UUID, avg_rating NUMERIC, review_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.product_id, ROUND(AVG(r.rating), 1) AS avg_rating, COUNT(*) AS review_count
  FROM reviews r
  WHERE r.status = 'approved'
  GROUP BY r.product_id;
$$;

-- ------------------------------------------------------------
-- Helper: restore reserved stock for an order (idempotent).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  it RECORD;
  v_prev INTEGER;
BEGIN
  SELECT id, stock_reserved INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT o.stock_reserved THEN
    RETURN;
  END IF;

  FOR it IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF it.variant_id IS NOT NULL THEN
      SELECT stock INTO v_prev FROM product_variants WHERE id = it.variant_id FOR UPDATE;
      UPDATE product_variants SET stock = stock + it.quantity WHERE id = it.variant_id;
      INSERT INTO inventory_logs (product_id, variant_id, change_type, delta, previous_value, new_value, note, created_by)
      VALUES (it.product_id, it.variant_id, 'restore', it.quantity, v_prev, v_prev + it.quantity, 'Order ' || p_order_id::text || ' cancelled', auth.uid());
    ELSE
      SELECT stock INTO v_prev FROM products WHERE id = it.product_id FOR UPDATE;
      UPDATE products SET stock = stock + it.quantity WHERE id = it.product_id;
      INSERT INTO inventory_logs (product_id, change_type, delta, previous_value, new_value, note, created_by)
      VALUES (it.product_id, 'restore', it.quantity, v_prev, v_prev + it.quantity, 'Order ' || p_order_id::text || ' cancelled', auth.uid());
    END IF;
  END LOOP;

  UPDATE orders SET stock_reserved = FALSE WHERE id = p_order_id;
END;
$$;

-- ------------------------------------------------------------
-- Customer: atomic checkout.
-- Validates the cart against live product data, locks rows,
-- computes all totals server-side, validates the coupon,
-- creates order + items + payment record + timeline event and
-- reserves inventory — all in one transaction.
--
-- p_customer: { name, email, phone }
-- p_items:    [ { product_id, variant_id, quantity } ]
-- p_shipping: { address, governorate, city } | null
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(
  p_customer JSONB,
  p_items JSONB,
  p_coupon_code TEXT,
  p_payment_method TEXT,
  p_shipping JSONB,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_settings RECORD;
  v_item JSONB;
  v_product RECORD;
  v_variant RECORD;
  v_qty INTEGER;
  v_unit_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_subtotal NUMERIC(12,2) := 0;
  v_discount NUMERIC(12,2) := 0;
  v_shipping_fee NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_coupon_id UUID;
  v_order_id UUID;
  v_order_number TEXT;
  v_has_physical BOOLEAN := FALSE;
  v_customer_name TEXT;
  v_customer_email TEXT;
  v_customer_phone TEXT;
  v_image TEXT;
  v_variant_name TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order';
  END IF;
  IF p_payment_method NOT IN ('instapay', 'vodafone_cash') THEN
    RAISE EXCEPTION 'Please choose a payment method';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;

  v_customer_name := TRIM(coalesce(p_customer->>'name', ''));
  v_customer_email := TRIM(coalesce(p_customer->>'email', ''));
  v_customer_phone := TRIM(coalesce(p_customer->>'phone', ''));

  IF v_customer_name = '' OR v_customer_email = '' OR v_customer_phone = '' THEN
    RAISE EXCEPTION 'Please provide your name, email and phone number';
  END IF;

  SELECT * INTO v_settings FROM site_settings ORDER BY id LIMIT 1;

  -- Validate items and compute the subtotal from live DB prices.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'Invalid quantity for one of the items in your cart';
    END IF;

    SELECT id, name, slug, price, stock, status, product_type, thumbnail, images
      INTO v_product
      FROM products
     WHERE id = (v_item->>'product_id')::uuid
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'One of the products in your cart is no longer available';
    END IF;
    IF v_product.status <> 'active' THEN
      RAISE EXCEPTION '"%" is no longer available', v_product.name;
    END IF;

    v_unit_price := v_product.price;
    v_variant := NULL;

    IF v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' <> '' THEN
      SELECT * INTO v_variant FROM product_variants
       WHERE id = (v_item->>'variant_id')::uuid
         AND product_id = v_product.id
         FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected option for "%" is no longer available', v_product.name;
      END IF;
      IF v_variant.stock IS NOT NULL AND v_qty > v_variant.stock THEN
        RAISE EXCEPTION 'Only % left of "%" (%)', v_variant.stock, v_product.name, v_variant.name;
      END IF;
      IF v_variant.price IS NOT NULL THEN
        v_unit_price := v_variant.price;
      END IF;
    ELSE
      IF v_qty > v_product.stock THEN
        RAISE EXCEPTION 'Only % left of "%"', v_product.stock, v_product.name;
      END IF;
    END IF;

    IF v_product.product_type = 'physical' THEN
      v_has_physical := TRUE;
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  END LOOP;

  v_subtotal := ROUND(v_subtotal, 2);

  IF v_settings.min_order_amount IS NOT NULL AND v_settings.min_order_amount > 0 AND v_subtotal < v_settings.min_order_amount THEN
    RAISE EXCEPTION 'The minimum order amount is %', v_settings.min_order_amount;
  END IF;

  -- Coupon (validated and locked server-side).
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    SELECT id INTO v_coupon_id FROM coupons WHERE UPPER(code) = UPPER(TRIM(p_coupon_code)) FOR UPDATE;
    IF v_coupon_id IS NULL THEN
      RAISE EXCEPTION 'Coupon code not found';
    END IF;
    v_discount := public.coupon_discount(p_coupon_code, v_subtotal);
  END IF;

  -- Shipping (physical goods only; free above threshold).
  IF v_has_physical THEN
    IF p_shipping IS NULL
       OR TRIM(coalesce(p_shipping->>'address', '')) = ''
       OR TRIM(coalesce(p_shipping->>'governorate', '')) = ''
       OR TRIM(coalesce(p_shipping->>'city', '')) = '' THEN
      RAISE EXCEPTION 'Please provide a complete delivery address';
    END IF;
    IF v_settings.free_shipping_threshold IS NOT NULL AND v_subtotal >= v_settings.free_shipping_threshold THEN
      v_shipping_fee := 0;
    ELSE
      v_shipping_fee := COALESCE(v_settings.shipping_fee, 0);
    END IF;
  END IF;

  v_total := ROUND(v_subtotal - v_discount + v_shipping_fee, 2);
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  -- Generate a unique order number.
  v_order_number := 'SAIF-' || to_char(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6));
  IF EXISTS (SELECT 1 FROM orders WHERE order_number = v_order_number) THEN
    v_order_number := v_order_number || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4));
  END IF;

  INSERT INTO orders (
    order_number, user_id, status, payment_status, payment_method,
    subtotal, discount, shipping_fee, total, coupon_code, stock_reserved,
    customer_name, customer_email, customer_phone, shipping_address, notes
  ) VALUES (
    v_order_number, v_user, 'payment_review', 'awaiting_payment', p_payment_method,
    v_subtotal, v_discount, v_shipping_fee, v_total, NULLIF(TRIM(coalesce(p_coupon_code, '')), ''),
    TRUE,
    v_customer_name, v_customer_email, v_customer_phone,
    CASE WHEN v_has_physical THEN COALESCE(p_shipping, '{}'::jsonb) ELSE '{}'::jsonb END,
    NULLIF(TRIM(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO v_order_id;

  -- Insert item snapshots, decrement stock, log inventory.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::integer;

    SELECT id, name, price, stock, product_type, thumbnail, images INTO v_product
      FROM products WHERE id = (v_item->>'product_id')::uuid;
    v_unit_price := v_product.price;
    v_variant := NULL;
    v_variant_name := NULL;
    v_image := COALESCE(v_product.thumbnail, v_product.images[1]);

    IF v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' <> '' THEN
      SELECT * INTO v_variant FROM product_variants WHERE id = (v_item->>'variant_id')::uuid;
      v_variant_name := v_variant.name;
      IF v_variant.price IS NOT NULL THEN
        v_unit_price := v_variant.price;
      END IF;
      IF v_variant.image IS NOT NULL THEN
        v_image := v_variant.image;
      END IF;
      UPDATE product_variants SET stock = stock - v_qty WHERE id = v_variant.id;
      INSERT INTO inventory_logs (product_id, variant_id, change_type, delta, previous_value, new_value, note, created_by)
      VALUES (v_product.id, v_variant.id, 'order', -v_qty, v_variant.stock, v_variant.stock - v_qty, 'Order ' || v_order_number, v_user);
    ELSE
      UPDATE products SET stock = stock - v_qty WHERE id = v_product.id;
      INSERT INTO inventory_logs (product_id, change_type, delta, previous_value, new_value, note, created_by)
      VALUES (v_product.id, 'order', -v_qty, v_product.stock, v_product.stock - v_qty, 'Order ' || v_order_number, v_user);
    END IF;

    v_line_total := ROUND(v_unit_price * v_qty, 2);

    INSERT INTO order_items (
      order_id, product_id, variant_id, product_name, variant_name,
      product_type, image, price, quantity, total
    ) VALUES (
      v_order_id, (v_item->>'product_id')::uuid, NULLIF(v_item->>'variant_id', '')::uuid,
      v_product.name, v_variant_name, v_product.product_type, v_image,
      v_unit_price, v_qty, v_line_total
    );
  END LOOP;

  -- Payment record awaiting the customer's transfer proof.
  INSERT INTO payments (order_id, payment_method, payment_status, expected_amount)
  VALUES (v_order_id, p_payment_method, 'awaiting_payment', v_total);

  -- Consume the coupon.
  IF v_coupon_id IS NOT NULL THEN
    UPDATE coupons SET uses_count = uses_count + 1 WHERE id = v_coupon_id;
  END IF;

  INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
  VALUES (v_order_id, 'order_created', 'payment_review', 'awaiting_payment',
          'Order placed. Awaiting payment confirmation.', v_user);

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'shipping_fee', v_shipping_fee,
    'total', v_total
  );
END;
$$;

-- ------------------------------------------------------------
-- Customer: submit manual payment evidence (InstaPay /
-- Vodafone Cash). Marks the payment as under review.
-- The screenshot must already be uploaded to the private
-- payment-screenshots bucket under the customer's own folder.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_payment(
  p_order_id UUID,
  p_payer_identifier TEXT,
  p_transferred_amount NUMERIC,
  p_screenshot_path TEXT,
  p_customer_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  o RECORD;
  p RECORD;
  v_payer TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO o FROM orders WHERE id = p_order_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT * INTO p FROM payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No payment record found for this order';
  END IF;

  IF p.payment_status IN ('approved', 'cancelled') THEN
    RAISE EXCEPTION 'This payment has already been % — it can no longer be modified', p.payment_status;
  END IF;

  v_payer := TRIM(coalesce(p_payer_identifier, ''));
  IF v_payer = '' OR v_payer !~ '^[0-9A-Za-z@._\-]{6,40}$' THEN
    RAISE EXCEPTION 'Please provide a valid payer phone number / account identifier';
  END IF;
  IF p.payment_method = 'vodafone_cash' AND v_payer !~ '^01[0-9]{9}$' THEN
    RAISE EXCEPTION 'Please provide a valid Vodafone Cash phone number (11 digits starting with 01)';
  END IF;
  IF p_transferred_amount IS NULL OR p_transferred_amount <= 0 THEN
    RAISE EXCEPTION 'Please enter the amount you transferred';
  END IF;
  IF p_screenshot_path IS NULL OR p_screenshot_path = '' THEN
    RAISE EXCEPTION 'Please upload a screenshot of your transfer';
  END IF;
  IF p_screenshot_path NOT LIKE v_user::text || '/%' OR p_screenshot_path LIKE '%..%' THEN
    RAISE EXCEPTION 'Invalid screenshot reference';
  END IF;

  UPDATE payments SET
    payer_identifier = v_payer,
    transferred_amount = p_transferred_amount,
    screenshot_path = p_screenshot_path,
    customer_note = NULLIF(TRIM(coalesce(p_customer_note, '')), ''),
    payment_status = 'under_review',
    rejection_reason = NULL,
    verified_by = NULL,
    verified_at = NULL,
    updated_at = NOW()
  WHERE id = p.id;

  UPDATE orders SET
    payment_status = 'under_review',
    status = 'payment_review',
    updated_at = NOW()
  WHERE id = o.id;

  INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
  VALUES (o.id, 'payment_submitted', 'payment_review', 'under_review',
          'Payment evidence submitted via ' || REPLACE(p.payment_method, '_', ' ') || '. Under review.', v_user);

  RETURN jsonb_build_object('payment_id', p.id, 'payment_status', 'under_review');
END;
$$;

-- ------------------------------------------------------------
-- Admin: review a payment (approve / reject / under review /
-- cancel). Rejecting requires a reason. Approving records the
-- verifier and timestamps, and confirms the order.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_payment(
  p_payment_id UUID,
  p_decision TEXT,
  p_admin_note TEXT,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  p RECORD;
  o RECORD;
  v_note TEXT;
  v_reason TEXT;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'under_review', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO p FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  SELECT * INTO o FROM orders WHERE id = p.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF p.payment_status = p_decision THEN
    RAISE EXCEPTION 'Payment is already marked as %', p_decision;
  END IF;

  v_note := NULLIF(TRIM(coalesce(p_admin_note, '')), '');
  v_reason := NULLIF(TRIM(coalesce(p_rejection_reason, '')), '');

  IF p_decision = 'rejected' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  IF p_decision = 'approved' THEN
    IF o.status IN ('cancelled', 'refunded') THEN
      RAISE EXCEPTION 'Cannot approve a payment for a cancelled or refunded order';
    END IF;
    UPDATE payments SET
      payment_status = 'approved',
      admin_note = v_note,
      rejection_reason = NULL,
      verified_by = v_admin,
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = p.id;

    UPDATE orders SET
      payment_status = 'approved',
      status = CASE WHEN o.status IN ('confirmed','processing','shipped','delivered','completed') THEN o.status ELSE 'confirmed' END,
      updated_at = NOW()
    WHERE id = o.id;

    INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
    VALUES (o.id, 'payment_reviewed', 'confirmed', 'approved', 'Payment approved.', v_admin);

  ELSIF p_decision = 'rejected' THEN
    UPDATE payments SET
      payment_status = 'rejected',
      admin_note = v_note,
      rejection_reason = v_reason,
      verified_by = v_admin,
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = p.id;

    UPDATE orders SET
      payment_status = 'rejected',
      status = 'payment_review',
      updated_at = NOW()
    WHERE id = o.id;

    INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
    VALUES (o.id, 'payment_reviewed', 'payment_review', 'rejected', 'Payment rejected: ' || v_reason, v_admin);

  ELSIF p_decision = 'cancelled' THEN
    UPDATE payments SET
      payment_status = 'cancelled',
      admin_note = v_note,
      updated_at = NOW()
    WHERE id = p.id;

    UPDATE orders SET payment_status = 'cancelled', status = 'cancelled', updated_at = NOW()
    WHERE id = o.id;

    PERFORM public.restore_order_stock(o.id);

    INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
    VALUES (o.id, 'payment_reviewed', 'cancelled', 'cancelled', 'Payment cancelled by admin.', v_admin);

  ELSE -- under_review
    UPDATE payments SET
      payment_status = 'under_review',
      admin_note = v_note,
      rejection_reason = NULL,
      verified_by = NULL,
      verified_at = NULL,
      updated_at = NOW()
    WHERE id = p.id;

    UPDATE orders SET payment_status = 'under_review', status = 'payment_review', updated_at = NOW()
    WHERE id = o.id;

    INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
    VALUES (o.id, 'payment_reviewed', 'payment_review', 'under_review', 'Payment placed under review.', v_admin);
  END IF;

  RETURN jsonb_build_object('payment_id', p.id, 'payment_status', p_decision, 'order_status',
    (SELECT status FROM orders WHERE id = o.id));
END;
$$;

-- ------------------------------------------------------------
-- Admin: update the order status (with timeline entry).
-- Cancelling an order restores reserved stock exactly once.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id UUID,
  p_status TEXT,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  o RECORD;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_status NOT IN ('pending','payment_review','confirmed','processing','shipped','delivered','completed','cancelled','refunded') THEN
    RAISE EXCEPTION 'Invalid order status';
  END IF;

  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  UPDATE orders SET status = p_status, updated_at = NOW() WHERE id = o.id;

  IF p_status = 'cancelled' THEN
    PERFORM public.restore_order_stock(o.id);
  END IF;

  INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
  VALUES (o.id, 'status_change', p_status, o.payment_status, NULLIF(TRIM(coalesce(p_message, '')), ''), v_admin);
END;
$$;

-- ------------------------------------------------------------
-- Admin: add an internal note to an order (timeline entry).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_add_order_note(
  p_order_id UUID,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_note IS NULL OR TRIM(p_note) = '' THEN
    RAISE EXCEPTION 'Note cannot be empty';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  UPDATE orders SET internal_note = TRIM(p_note), updated_at = NOW() WHERE id = p_order_id;

  INSERT INTO order_events (order_id, event_type, message, created_by)
  VALUES (p_order_id, 'note', TRIM(p_note), auth.uid());
END;
$$;

-- ------------------------------------------------------------
-- Admin: fulfill a digital order item (delivery details are
-- only written after the payment has been approved).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_fulfillment(
  p_order_item_id UUID,
  p_fulfillment_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_fulfillment_note IS NULL OR TRIM(p_fulfillment_note) = '' THEN
    RAISE EXCEPTION 'Fulfillment note cannot be empty';
  END IF;

  SELECT oi.*, o.payment_status AS order_payment_status
    INTO it
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
   WHERE oi.id = p_order_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;
  IF it.order_payment_status <> 'approved' THEN
    RAISE EXCEPTION 'Digital delivery details can only be added after the payment is approved';
  END IF;

  UPDATE order_items
     SET fulfillment_note = TRIM(p_fulfillment_note),
         fulfilled_at = NOW()
   WHERE id = p_order_item_id;

  INSERT INTO order_events (order_id, event_type, message, created_by)
  VALUES (it.order_id, 'fulfillment', 'Digital item "' || it.product_name || '" fulfilled.', auth.uid());
END;
$$;

-- ------------------------------------------------------------
-- Customer: cancel their own order while payment has not been
-- approved (restores reserved stock).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_cancel_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  o RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO o FROM orders WHERE id = p_order_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF o.payment_status = 'approved' OR o.status NOT IN ('payment_review', 'pending') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled. Please contact support.';
  END IF;
  IF o.payment_status = 'under_review' THEN
    RAISE EXCEPTION 'Your payment is currently being reviewed. Please wait for the review to finish or contact support.';
  END IF;

  UPDATE orders SET status = 'cancelled', payment_status = 'cancelled', updated_at = NOW() WHERE id = o.id;
  UPDATE payments SET payment_status = 'cancelled', updated_at = NOW() WHERE order_id = o.id;

  PERFORM public.restore_order_stock(o.id);

  INSERT INTO order_events (order_id, event_type, status, payment_status, message, created_by)
  VALUES (o.id, 'cancellation', 'cancelled', 'cancelled', 'Order cancelled by customer.', v_user);
END;
$$;

-- ------------------------------------------------------------
-- Admin: adjust stock with a full audit trail.
-- p_action: set | increase | decrease
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_stock(
  p_product_id UUID,
  p_variant_id UUID,
  p_action TEXT,
  p_value INTEGER,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_prev INTEGER;
  v_new INTEGER;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_action NOT IN ('set', 'increase', 'decrease') THEN
    RAISE EXCEPTION 'Invalid stock action';
  END IF;
  IF p_value IS NULL OR p_value < 0 THEN
    RAISE EXCEPTION 'Value must be zero or more';
  END IF;

  IF p_variant_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM product_variants WHERE id = p_variant_id AND product_id = p_product_id) THEN
      RAISE EXCEPTION 'Variant not found for this product';
    END IF;
    SELECT stock INTO v_prev FROM product_variants WHERE id = p_variant_id FOR UPDATE;
    v_new := CASE p_action
      WHEN 'set' THEN p_value
      WHEN 'increase' THEN v_prev + p_value
      ELSE GREATEST(v_prev - p_value, 0)
    END;
    UPDATE product_variants SET stock = v_new WHERE id = p_variant_id;
    INSERT INTO inventory_logs (product_id, variant_id, change_type, delta, previous_value, new_value, note, created_by)
    VALUES (p_product_id, p_variant_id, p_action, v_new - v_prev, v_prev, v_new, NULLIF(TRIM(coalesce(p_note, '')), ''), v_admin);
  ELSE
    SELECT stock INTO v_prev FROM products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;
    v_new := CASE p_action
      WHEN 'set' THEN p_value
      WHEN 'increase' THEN v_prev + p_value
      ELSE GREATEST(v_prev - p_value, 0)
    END;
    UPDATE products SET stock = v_new WHERE id = p_product_id;
    INSERT INTO inventory_logs (product_id, change_type, delta, previous_value, new_value, note, created_by)
    VALUES (p_product_id, p_action, v_new - v_prev, v_prev, v_new, NULLIF(TRIM(coalesce(p_note, '')), ''), v_admin);
  END IF;

  RETURN jsonb_build_object('previous', v_prev, 'new', v_new);
END;
$$;

-- ------------------------------------------------------------
-- Admin: dashboard overview statistics (real aggregates).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'total_orders', (SELECT COUNT(*) FROM orders),
    'total_revenue', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'approved'),
    'total_customers', (SELECT COUNT(*) FROM profiles WHERE role = 'customer'),
    'total_products', (SELECT COUNT(*) FROM products),
    'pending_orders', (SELECT COUNT(*) FROM orders WHERE status = 'payment_review'),
    'payments_awaiting', (SELECT COUNT(*) FROM payments WHERE payment_status = 'awaiting_payment'),
    'payments_under_review', (SELECT COUNT(*) FROM payments WHERE payment_status = 'under_review'),
    'payments_approved', (SELECT COUNT(*) FROM payments WHERE payment_status = 'approved'),
    'payments_rejected', (SELECT COUNT(*) FROM payments WHERE payment_status = 'rejected'),
    'low_stock_products', (SELECT COUNT(*) FROM products WHERE status = 'active' AND product_type = 'physical' AND stock <= low_stock_threshold AND stock > 0),
    'out_of_stock_products', (SELECT COUNT(*) FROM products WHERE status = 'active' AND stock = 0),
    'digital_orders', (SELECT COUNT(DISTINCT order_id) FROM order_items WHERE product_type = 'digital'),
    'recent_orders', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT o.id, o.order_number, o.customer_name, o.total, o.status, o.payment_status, o.created_at
        FROM orders o ORDER BY o.created_at DESC LIMIT 10
      ) t
    ),
    'recent_payments', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT p.id, p.order_id, p.payment_method, p.payment_status, p.expected_amount, p.transferred_amount,
               p.payer_identifier, p.created_at, o.order_number, o.customer_name, o.customer_phone
        FROM payments p JOIN orders o ON o.id = p.order_id
        ORDER BY p.created_at DESC LIMIT 8
      ) t
    ),
    'best_sellers', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT pr.id, pr.name, pr.slug, pr.thumbnail, SUM(oi.quantity) AS quantity_sold,
               SUM(oi.total) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.payment_status = 'approved'
        JOIN products pr ON pr.id = oi.product_id
        GROUP BY pr.id, pr.name, pr.slug, pr.thumbnail
        ORDER BY quantity_sold DESC LIMIT 5
      ) t
    ),
    'low_stock_list', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT p.id, p.name, p.sku, p.stock, p.low_stock_threshold
        FROM products p
        WHERE p.status = 'active' AND p.stock <= p.low_stock_threshold
        ORDER BY p.stock ASC LIMIT 8
      ) t
    ),
    'sales_trend', (
      SELECT COALESCE(jsonb_agg(t ORDER BY day), '[]'::jsonb) FROM (
        SELECT d::date AS day,
               COALESCE(SUM(o.total), 0) AS revenue,
               COUNT(o.id) AS orders
        FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
        LEFT JOIN orders o ON o.created_at::date = d::date AND o.payment_status = 'approved'
        GROUP BY d
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- Admin: sales analytics over a window (default 30 days).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_sales_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER := GREATEST(LEAST(COALESCE(p_days, 30), 365), 1);
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'days', v_days,
    'daily', (
      SELECT COALESCE(jsonb_agg(t ORDER BY day), '[]'::jsonb) FROM (
        SELECT d::date AS day,
               COALESCE(SUM(o.total), 0) AS revenue,
               COUNT(o.id) AS orders
        FROM generate_series(CURRENT_DATE - (v_days - 1) * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') d
        LEFT JOIN orders o ON o.created_at::date = d::date
        GROUP BY d
      ) t
    ),
    'paid_daily', (
      SELECT COALESCE(jsonb_agg(t ORDER BY day), '[]'::jsonb) FROM (
        SELECT d::date AS day,
               COALESCE(SUM(o.total), 0) AS revenue,
               COUNT(o.id) AS orders
        FROM generate_series(CURRENT_DATE - (v_days - 1) * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') d
        LEFT JOIN orders o ON o.created_at::date = d::date AND o.payment_status = 'approved'
        GROUP BY d
      ) t
    ),
    'total_revenue_paid', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'approved'),
    'total_revenue_all', (SELECT COALESCE(SUM(total), 0) FROM orders),
    'total_orders', (SELECT COUNT(*) FROM orders),
    'avg_order_value', (SELECT COALESCE(ROUND(AVG(total), 2), 0) FROM orders WHERE payment_status = 'approved'),
    'top_products', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT pr.name, pr.slug, SUM(oi.quantity) AS quantity, SUM(oi.total) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products pr ON pr.id = oi.product_id
        WHERE o.payment_status = 'approved'
        GROUP BY pr.name, pr.slug
        ORDER BY revenue DESC LIMIT 10
      ) t
    ),
    'top_categories', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT c.name, SUM(oi.quantity) AS quantity, SUM(oi.total) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.payment_status = 'approved'
        JOIN products pr ON pr.id = oi.product_id
        JOIN categories c ON c.id = pr.category_id
        GROUP BY c.name
        ORDER BY revenue DESC LIMIT 10
      ) t
    ),
    'payment_methods', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT p.payment_method, COUNT(*) AS count, COALESCE(SUM(p.expected_amount), 0) AS amount
        FROM payments p GROUP BY p.payment_method
      ) t
    ),
    'order_status_distribution', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT o.status, COUNT(*) AS count FROM orders o GROUP BY o.status
      ) t
    ),
    'product_type_split', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT oi.product_type, SUM(oi.quantity) AS quantity, SUM(oi.total) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.payment_status = 'approved'
        GROUP BY oi.product_type
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- Admin: customers with real order statistics.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_customer_stats()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ,
  orders_count BIGINT,
  total_spent NUMERIC,
  last_order_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.id, pr.full_name, au.email, pr.phone, pr.created_at,
         COUNT(o.id) AS orders_count,
         COALESCE(SUM(CASE WHEN o.payment_status = 'approved' THEN o.total ELSE 0 END), 0) AS total_spent,
         MAX(o.created_at) AS last_order_at
  FROM profiles pr
  JOIN auth.users au ON au.id = pr.id
  LEFT JOIN orders o ON o.user_id = pr.id
  WHERE pr.role = 'customer'
  GROUP BY pr.id, pr.full_name, au.email, pr.phone, pr.created_at
  ORDER BY pr.created_at DESC;
$$;

-- ------------------------------------------------------------
-- Search suggestions for the storefront.
-- Matches product name, category name and tags.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_suggestions(p_query TEXT, p_limit INTEGER DEFAULT 6)
RETURNS TABLE (id UUID, name TEXT, slug TEXT, thumbnail TEXT, price NUMERIC, category_name TEXT, product_type TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.slug, p.thumbnail, p.price, c.name AS category_name, p.product_type
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.status = 'active'
    AND p.name ILIKE '%' || p_query || '%'
  ORDER BY p.featured DESC, p.bestseller DESC, p.created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 6), 20);
$$;

-- ------------------------------------------------------------
-- Function grants
-- ------------------------------------------------------------
-- is_admin() is referenced by RLS policies that also apply to the anon
-- role (e.g. the public products policy), so anon must be able to EXECUTE
-- it. For anon it always returns FALSE (auth.uid() is null) — no data leaks.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

REVOKE ALL ON FUNCTION public.coupon_discount(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_coupon(TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.get_product_rating_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_rating_stats() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.restore_order_stock(UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.place_order(JSONB, JSONB, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB, TEXT, TEXT, JSONB, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_payment(UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment(UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.review_payment(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_payment(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_order_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_add_order_note(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_order_note(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_fulfillment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_fulfillment(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.customer_cancel_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_cancel_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_adjust_stock(UUID, UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_stock(UUID, UUID, TEXT, INTEGER, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_sales_analytics(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sales_analytics(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_customer_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_customer_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.search_suggestions(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_suggestions(TEXT, INTEGER) TO anon, authenticated;
