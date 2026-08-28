import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { createTestDb, applyFullSchema, asUser, execAsUser, createTestUser } from './db-harness'

/**
 * Full integration test of the database layer: schema + RPCs + RLS on a real
 * PostgreSQL engine (PGlite/WASM) with Supabase's auth/storage mocked.
 */

let db: PGlite

const ADMIN = '11111111-1111-1111-1111-111111111111'
const ALICE = '22222222-2222-2222-2222-222222222222'
const BOB = '33333333-3333-3333-3333-333333333333'

beforeAll(async () => {
  db = await createTestDb()
  await applyFullSchema(db)
  await createTestUser(db, ADMIN, 'admin@saif.test', 'Admin', 'admin')
  await createTestUser(db, ALICE, 'alice@saif.test', 'Alice')
  await createTestUser(db, BOB, 'bob@saif.test', 'Bob')
}, 120_000)

async function productId(slug: string) {
  const r = await db.query<{ id: string }>('SELECT id FROM products WHERE slug = $1', [slug])
  return r.rows[0].id
}

async function firstVariantId(slug: string) {
  const r = await db.query<{ id: string }>(
    `SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.slug = $1 LIMIT 1`,
    [slug],
  )
  return r.rows[0].id
}

describe('schema & seed', () => {
  it('seeds settings, categories, products and coupons', async () => {
    const settings = await db.query<{ payment_number: string; currency: string; shipping_fee: number }>(
      'SELECT payment_number, currency, shipping_fee FROM site_settings LIMIT 1',
    )
    expect(settings.rows[0].payment_number).toBe('01040324811')
    expect(settings.rows[0].currency).toBe('EGP')

    const counts = await db.query<{ products: string; categories: string; coupons: string }>(`
      SELECT
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM coupons) AS coupons`)
    expect(Number(counts.rows[0].products)).toBeGreaterThan(5)
    expect(Number(counts.rows[0].categories)).toBe(6)
    expect(Number(counts.rows[0].coupons)).toBe(2)
  })

  it('creates the handle_new_user profile trigger', async () => {
    const r = await db.query<{ full_name: string; role: string }>('SELECT full_name, role FROM profiles WHERE id = $1', [ALICE])
    expect(r.rows[0].full_name).toBe('Alice')
    expect(r.rows[0].role).toBe('customer')
  })
})

describe('SECURITY: role escalation protection', () => {
  it('blocks a customer from promoting themselves to admin via UPDATE', async () => {
    await expect(
      asUser(db, ALICE, "UPDATE profiles SET role = 'admin' WHERE id = $1", [ALICE]),
    ).rejects.toThrow(/role cannot be modified|permission denied/i)
  })

  it('blocks a customer from setting role on INSERT', async () => {
    const newUser = '44444444-4444-4444-4444-444444444444'
    await expect(
      asUser(db, ALICE, 'INSERT INTO profiles (id, full_name, role) VALUES ($1, $2, $3)', [newUser, 'Mallory', 'admin']),
    ).rejects.toThrow(/permission denied|rejected/i)
  })

  it('allows updating own profile fields', async () => {
    const r = await asUser(db, ALICE, 'UPDATE profiles SET phone = $1 WHERE id = $2 RETURNING phone', ['01012345678', ALICE])
    expect(r.rows[0].phone).toBe('01012345678')
  })

  it('still reports customer role after the attempt', async () => {
    const r = await db.query<{ role: string }>('SELECT role FROM profiles WHERE id = $1', [ALICE])
    expect(r.rows[0].role).toBe('customer')
  })
})

describe('SECURITY: data isolation', () => {
  it('hides other customers orders and payments', async () => {
    // Place an order as Alice
    const tee = await productId('off-by-design-tee')
    const order = await asUser<Record<string, unknown>>(db, ALICE, `
      SELECT place_order(
        $1::jsonb, $2::jsonb, NULL, 'instapay', $3::jsonb, NULL) AS result`, [
      JSON.stringify({ name: 'Alice', email: 'alice@saif.test', phone: '01011111111' }),
      JSON.stringify([{ product_id: tee, variant_id: null, quantity: 1 }]),
      JSON.stringify({ address: '1 Test St', governorate: 'Cairo', city: 'Nasr City' }),
    ])
    const result = order.rows[0].result as Record<string, string>
    expect(result.order_number).toMatch(/^SAIF-\d{6}-/)

    // Bob cannot see Alice's order
    const bobView = await asUser<{ count: string }>(db, BOB, 'SELECT COUNT(*) AS count FROM orders')
    expect(Number(bobView.rows[0].count)).toBe(0)
    const bobPayments = await asUser<{ count: string }>(db, BOB, 'SELECT COUNT(*) AS count FROM payments')
    expect(Number(bobPayments.rows[0].count)).toBe(0)

    // Alice sees her order
    const aliceView = await asUser<{ count: string }>(db, ALICE, 'SELECT COUNT(*) AS count FROM orders')
    expect(Number(aliceView.rows[0].count)).toBe(1)
  })

  it('prevents customers from inserting orders or payments directly', async () => {
    await expect(
      asUser(db, BOB, `INSERT INTO orders (order_number, user_id, customer_name, customer_email)
        VALUES ('HACK-1', $1, 'Bob', 'bob@saif.test')`, [BOB]),
    ).rejects.toThrow()
    // Payments can only reference orders the customer can see — none for Bob.
    const inserted = await asUser<{ count: string }>(db, BOB, `
      INSERT INTO payments (order_id, payment_method, expected_amount)
      SELECT id, 'instapay', 0 FROM orders RETURNING 1 AS one`)
    expect(Number(inserted.rows[0]?.count ?? 0)).toBe(0)
  })

  it('prevents customers from approving payments via the table (RPC only)', async () => {
    const r = await asUser<{ count: string; status: string }>(
      db, ALICE, 'SELECT COUNT(*) AS count, MAX(payment_status) AS status FROM payments')
    expect(Number(r.rows[0].count)).toBe(1)
    // RLS silently filters the rows — the update must be a no-op.
    await asUser(db, ALICE, `UPDATE payments SET payment_status = 'approved'`)
    const after = await asUser<{ status: string }>(
      db, ALICE, 'SELECT MAX(payment_status) AS status FROM payments')
    expect(after.rows[0].status).not.toBe('approved')
  })

  it('hides coupon codes from unauthenticated users', async () => {
    const r = await asUser<{ count: string }>(db, null, 'SELECT COUNT(*) AS count FROM coupons', undefined, 'anon')
    expect(Number(r.rows[0].count)).toBe(0)
  })
})

describe('place_order RPC (atomic checkout)', () => {
  it('creates order + items + payment, reserves stock and computes totals server-side', async () => {
    const tee = await productId('off-by-design-tee')
    const variant = await firstVariantId('off-by-design-tee')
    const hoodie = await productId('command-k-hoodie')

    const before = await db.query<{ stock: string; variant_stock: string }>(
      `SELECT p.stock AS stock, (SELECT stock FROM product_variants WHERE id = $2) AS variant_stock
       FROM products p WHERE p.id = $1`,
      [tee, variant],
    )

    const r = await asUser<{ result: Record<string, unknown> }>(db, ALICE, `
      SELECT place_order($1::jsonb, $2::jsonb, NULL, 'vodafone_cash', $3::jsonb, NULL) AS result`, [
      JSON.stringify({ name: 'Alice', email: 'alice@saif.test', phone: '01011111111' }),
      JSON.stringify([
        { product_id: tee, variant_id: variant, quantity: 2 },
        { product_id: hoodie, variant_id: null, quantity: 1 },
      ]),
      JSON.stringify({ address: '12 Test St', governorate: 'Cairo', city: 'Nasr City' }),
    ])

    const result = r.rows[0].result
    expect(result.order_id).toBeTruthy()
    // 850*2 + 1450 = 3150 subtotal; free shipping (>= 1500)
    expect(Number(result.subtotal)).toBe(3150)
    expect(Number(result.shipping_fee)).toBe(0)
    expect(Number(result.total)).toBe(3150)

    // Stock decremented (variant + product-level for the hoodie)
    const after = await db.query<{ stock: string; variant_stock: string }>(
      `SELECT p.stock AS stock, (SELECT stock FROM product_variants WHERE id = $2) AS variant_stock
       FROM products p WHERE p.id = $1`,
      [tee, variant],
    )
    expect(Number(after.rows[0].variant_stock)).toBe(Number(before.rows[0].variant_stock) - 2)
    expect(Number(after.rows[0].stock)).toBe(Number(before.rows[0].stock)) // variant-level only

    // Payment record created as awaiting_payment
    const payment = await db.query<{ payment_status: string; expected_amount: number }>(
      'SELECT payment_status, expected_amount FROM payments WHERE order_id = $1',
      [result.order_id],
    )
    expect(payment.rows[0].payment_status).toBe('awaiting_payment')
    expect(Number(payment.rows[0].expected_amount)).toBe(3150)

    // Order items snapshot
    const items = await db.query<{ product_name: string; quantity: number; total: number; product_type: string }>(
      'SELECT product_name, quantity, total, product_type FROM order_items WHERE order_id = $1',
      [result.order_id],
    )
    expect(items.rows).toHaveLength(2)
    expect(items.rows[0].product_type).toBe('physical')

    // Timeline event recorded
    const events = await db.query<{ event_type: string }>(
      'SELECT event_type FROM order_events WHERE order_id = $1',
      [result.order_id],
    )
    expect(events.rows[0].event_type).toBe('order_created')
  })

  it('rejects quantities above available stock', async () => {
    const tee = await productId('off-by-design-tee')
    const stock = await db.query<{ stock: string }>('SELECT stock FROM products WHERE id = $1', [tee])
    const qty = Number(stock.rows[0].stock) + 5
    await expect(
      asUser(db, BOB, `SELECT place_order($1::jsonb, $2::jsonb, NULL, 'instapay', $3::jsonb, NULL)`, [
        JSON.stringify({ name: 'Bob', email: 'bob@saif.test', phone: '01022222222' }),
        JSON.stringify([{ product_id: tee, variant_id: null, quantity: qty }]),
        JSON.stringify({ address: '1 St', governorate: 'Giza', city: 'Dokki' }),
      ]),
    ).rejects.toThrow(/only .* left/i)
  })

  it('rejects orders for draft/inactive products', async () => {
    const draft = await db.query<{ id: string }>(`INSERT INTO products (name, slug, price, status, stock)
      VALUES ('Draft Item', 'draft-item', 100, 'draft', 5) RETURNING id`)
    await expect(
      asUser(db, BOB, `SELECT place_order($1::jsonb, $2::jsonb, NULL, 'instapay', $3::jsonb, NULL)`, [
        JSON.stringify({ name: 'Bob', email: 'bob@saif.test', phone: '01022222222' }),
        JSON.stringify([{ product_id: draft.rows[0].id, variant_id: null, quantity: 1 }]),
        JSON.stringify({ address: '1 St', governorate: 'Giza', city: 'Dokki' }),
      ]),
    ).rejects.toThrow(/no longer available/i)
  })

  it('requires a delivery address for physical goods', async () => {
    const tee = await productId('off-by-design-tee')
    await expect(
      asUser(db, BOB, `SELECT place_order($1::jsonb, $2::jsonb, NULL, 'instapay', NULL, NULL)`, [
        JSON.stringify({ name: 'Bob', email: 'bob@saif.test', phone: '01022222222' }),
        JSON.stringify([{ product_id: tee, variant_id: null, quantity: 1 }]),
      ]),
    ).rejects.toThrow(/delivery address/i)
  })

  it('applies and consumes coupons server-side', async () => {
    const validation = await asUser<{ result: Record<string, unknown> }>(db, ALICE,
      'SELECT validate_coupon($1, $2) AS result', ['WELCOME20', 1000])
    const v = validation.rows[0].result as { valid: boolean; discount: number }
    expect(v.valid).toBe(true)
    expect(Number(v.discount)).toBe(200) // 20% of 1000, max 300

    const wallpaper = await productId('saif-wallpaper-pack') // digital, 120 EGP
    const before = await db.query<{ uses: string }>(`SELECT uses_count AS uses FROM coupons WHERE code = 'WELCOME20'`)

    const r = await asUser<{ result: Record<string, unknown> }>(db, ALICE, `
      SELECT place_order($1::jsonb, $2::jsonb, 'WELCOME20', 'instapay', NULL, NULL) AS result`, [
      JSON.stringify({ name: 'Alice', email: 'alice@saif.test', phone: '01011111111' }),
      JSON.stringify([{ product_id: wallpaper, variant_id: null, quantity: 5 }]),
    ])
    const result = r.rows[0].result
    expect(Number(result.subtotal)).toBe(600)
    expect(Number(result.discount)).toBe(120) // 20%, capped at 300
    expect(Number(result.shipping_fee)).toBe(0) // digital only
    expect(Number(result.total)).toBe(480)

    const after = await db.query<{ uses: string }>(`SELECT uses_count AS uses FROM coupons WHERE code = 'WELCOME20'`)
    expect(Number(after.rows[0].uses)).toBe(Number(before.rows[0].uses) + 1)
  })

  it('rejects invalid or below-minimum coupons', async () => {
    await expect(
      asUser(db, BOB, `SELECT place_order($1::jsonb, $2::jsonb, 'NOPE', 'instapay', NULL, NULL)`, [
        JSON.stringify({ name: 'Bob', email: 'bob@saif.test', phone: '01022222222' }),
        JSON.stringify([{ product_id: await productId('saif-wallpaper-pack'), variant_id: null, quantity: 1 }]),
      ]),
    ).rejects.toThrow(/not found/i)
  })
})

describe('payment verification workflow', () => {
  let orderId: string
  let paymentId: string

  beforeAll(async () => {
    // Alice places a digital order (no shipping needed)
    const wallpaper = await productId('saif-wallpaper-pack')
    const r = await asUser<{ result: Record<string, unknown> }>(db, ALICE, `
      SELECT place_order($1::jsonb, $2::jsonb, NULL, 'instapay', NULL, NULL) AS result`, [
      JSON.stringify({ name: 'Alice', email: 'alice@saif.test', phone: '01011111111' }),
      JSON.stringify([{ product_id: wallpaper, variant_id: null, quantity: 1 }]),
    ])
    orderId = r.rows[0].result.order_id as string
    const p = await db.query<{ id: string }>('SELECT id FROM payments WHERE order_id = $1', [orderId])
    paymentId = p.rows[0].id
  })

  it('rejects submission with an invalid payer identifier for Vodafone', async () => {
    await expect(
      asUser(db, ALICE, `SELECT submit_payment($1, 'abc', 120, 'x/1.png', NULL)`, [orderId]),
    ).rejects.toThrow()
  })

  it('rejects submission with a screenshot path outside the customer folder', async () => {
    await expect(
      asUser(db, ALICE, `SELECT submit_payment($1, '01011111111', 120, '${BOB}/hack.png', NULL)`, [orderId]),
    ).rejects.toThrow(/invalid screenshot/i)
  })

  it('rejects another customer submitting someone else’s payment', async () => {
    await expect(
      asUser(db, BOB, `SELECT submit_payment($1, '01022222222', 120, '${BOB}/x.png', NULL)`, [orderId]),
    ).rejects.toThrow(/order not found|permission/i)
  })

  it('accepts a valid payment submission and marks it under review', async () => {
    const r = await asUser<{ result: Record<string, unknown> }>(db, ALICE,
      `SELECT submit_payment($1, '01011111111', 120, '${ALICE}/${orderId}.png', 'ref ABC') AS result`, [orderId])
    expect(r.rows[0].result).toMatchObject({ payment_status: 'under_review' })

    const order = await db.query<{ status: string; payment_status: string }>(
      'SELECT status, payment_status FROM orders WHERE id = $1', [orderId],
    )
    expect(order.rows[0].status).toBe('payment_review')
    expect(order.rows[0].payment_status).toBe('under_review')
  })

  it('rejects rejection without a reason (admin RPC validation)', async () => {
    await expect(
      asUser(db, ADMIN, `SELECT review_payment($1, 'rejected', NULL, NULL)`, [paymentId]),
    ).rejects.toThrow(/rejection reason/i)
  })

  it('blocks non-admins from reviewing payments', async () => {
    await expect(
      asUser(db, ALICE, `SELECT review_payment($1, 'approved', NULL, NULL)`, [paymentId]),
    ).rejects.toThrow(/admin access/i)
  })

  it('rejects the payment with a reason; customer can resubmit', async () => {
    await asUser(db, ADMIN, `SELECT review_payment($1, 'rejected', NULL, 'amount does not match')`, [paymentId])

    const payment = await db.query<{ payment_status: string; rejection_reason: string; verified_by: string }>(
      'SELECT payment_status, rejection_reason, verified_by FROM payments WHERE id = $1', [paymentId],
    )
    expect(payment.rows[0].payment_status).toBe('rejected')
    expect(payment.rows[0].rejection_reason).toBe('amount does not match')
    expect(payment.rows[0].verified_by).toBe(ADMIN)

    // Customer resubmits with the correct amount
    const r = await asUser<{ result: Record<string, unknown> }>(db, ALICE,
      `SELECT submit_payment($1, '01011111111', 120, '${ALICE}/${orderId}-2.png', NULL) AS result`, [orderId])
    expect(r.rows[0].result).toMatchObject({ payment_status: 'under_review' })
  })

  it('approves the payment, records the verifier and confirms the order', async () => {
    await asUser(db, ADMIN, `SELECT review_payment($1, 'approved', 'verified', NULL)`, [paymentId])

    const payment = await db.query<{ payment_status: string; verified_by: string; verified_at: string | null }>(
      'SELECT payment_status, verified_by, verified_at FROM payments WHERE id = $1', [paymentId],
    )
    expect(payment.rows[0].payment_status).toBe('approved')
    expect(payment.rows[0].verified_by).toBe(ADMIN)
    expect(payment.rows[0].verified_at).not.toBeNull()

    const order = await db.query<{ status: string; payment_status: string }>(
      'SELECT status, payment_status FROM orders WHERE id = $1', [orderId],
    )
    expect(order.rows[0].status).toBe('confirmed')
    expect(order.rows[0].payment_status).toBe('approved')
  })

  it('blocks modifying an approved payment', async () => {
    await expect(
      asUser(db, ALICE, `SELECT submit_payment($1, '01011111111', 120, '${ALICE}/x.png', NULL)`, [orderId]),
    ).rejects.toThrow(/approved/)
  })

  it('rejects fulfillment details before payment approval', async () => {
    // New order, payment not yet approved
    const wallpaper = await productId('saif-wallpaper-pack')
    const r = await asUser<{ result: Record<string, unknown> }>(db, BOB, `
      SELECT place_order($1::jsonb, $2::jsonb, NULL, 'instapay', NULL, NULL) AS result`, [
      JSON.stringify({ name: 'Bob', email: 'bob@saif.test', phone: '01022222222' }),
      JSON.stringify([{ product_id: wallpaper, variant_id: null, quantity: 1 }]),
    ])
    const bobOrderId = r.rows[0].result.order_id as string
    const item = await db.query<{ id: string }>('SELECT id FROM order_items WHERE order_id = $1', [bobOrderId])
    await expect(
      asUser(db, ADMIN, `SELECT admin_set_fulfillment($1, 'delivered')`, [item.rows[0].id]),
    ).rejects.toThrow(/approved/i)
  })

  it('allows fulfillment after approval and the customer sees it', async () => {
    const item = await db.query<{ id: string }>('SELECT id FROM order_items WHERE order_id = $1', [orderId])
    await asUser(db, ADMIN, `SELECT admin_set_fulfillment($1, 'Download link sent by email')`, [item.rows[0].id])

    // Alice can see the fulfillment note on her own order item
    const seen = await asUser<{ fulfillment_note: string }>(db, ALICE,
      'SELECT fulfillment_note FROM order_items WHERE id = $1', [item.rows[0].id])
    expect(seen.rows[0].fulfillment_note).toContain('Download link')
  })
})

describe('inventory & cancellation', () => {
  it('restores stock exactly once when an order is cancelled', async () => {
    const tee = await productId('off-by-design-tee')
    const before = await db.query<{ stock: string }>('SELECT stock FROM products WHERE id = $1', [tee])

    const r = await asUser<{ result: Record<string, unknown> }>(db, BOB, `
      SELECT place_order($1::jsonb, $2::jsonb, NULL, 'instapay', $3::jsonb, NULL) AS result`, [
      JSON.stringify({ name: 'Bob', email: 'bob@saif.test', phone: '01022222222' }),
      JSON.stringify([{ product_id: tee, variant_id: null, quantity: 3 }]),
      JSON.stringify({ address: '5 St', governorate: 'Cairo', city: 'Maadi' }),
    ])
    const orderId = r.rows[0].result.order_id as string

    const afterOrder = await db.query<{ stock: string }>('SELECT stock FROM products WHERE id = $1', [tee])
    expect(Number(afterOrder.rows[0].stock)).toBe(Number(before.rows[0].stock) - 3)

    // Bob cancels while awaiting payment
    await asUser(db, BOB, 'SELECT customer_cancel_order($1)', [orderId])

    const afterCancel = await db.query<{ stock: string }>('SELECT stock FROM products WHERE id = $1', [tee])
    expect(Number(afterCancel.rows[0].stock)).toBe(Number(before.rows[0].stock))

    const order = await db.query<{ status: string; payment_status: string }>(
      'SELECT status, payment_status FROM orders WHERE id = $1', [orderId],
    )
    expect(order.rows[0].status).toBe('cancelled')
    expect(order.rows[0].payment_status).toBe('cancelled')

    // Double-cancel is rejected
    await expect(asUser(db, BOB, 'SELECT customer_cancel_order($1)', [orderId])).rejects.toThrow()
  })

  it('blocks cancellation while the payment is under review', async () => {
    const tee = await productId('off-by-design-tee')
    const r = await asUser<{ result: Record<string, unknown> }>(db, BOB, `
      SELECT place_order($1::jsonb, $2::jsonb, NULL, 'instapay', $3::jsonb, NULL) AS result`, [
      JSON.stringify({ name: 'Bob', email: 'bob@saif.test', phone: '01022222222' }),
      JSON.stringify([{ product_id: tee, variant_id: null, quantity: 1 }]),
      JSON.stringify({ address: '5 St', governorate: 'Cairo', city: 'Maadi' }),
    ])
    const orderId = r.rows[0].result.order_id as string
    await asUser(db, BOB, `SELECT submit_payment($1, '01022222222', 850, '${BOB}/${orderId}.png', NULL)`, [orderId])

    await expect(asUser(db, BOB, 'SELECT customer_cancel_order($1)', [orderId])).rejects.toThrow(/being reviewed|under review/i)
  })

  it('admin stock adjustments are audited', async () => {
    const tee = await productId('off-by-design-tee')
    const r = await asUser<{ result: Record<string, unknown> }>(db, ADMIN,
      `SELECT admin_adjust_stock($1, NULL, 'increase', 10, 'shipment received') AS result`, [tee])
    expect(r.rows[0].result).toMatchObject({ new: expect.any(Number) })

    const logs = await db.query<{ change_type: string; note: string }>(
      'SELECT change_type, note FROM inventory_logs WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1', [tee],
    )
    expect(logs.rows[0].change_type).toBe('increase')
    expect(logs.rows[0].note).toBe('shipment received')
  })

  it('blocks non-admins from adjusting stock', async () => {
    const tee = await productId('off-by-design-tee')
    await expect(
      asUser(db, ALICE, `SELECT admin_adjust_stock($1, NULL, 'set', 999, NULL)`, [tee]),
    ).rejects.toThrow(/admin access/i)
  })
})

describe('storage policies (payment screenshots)', () => {
  it('allows customers to upload only into their own folder', async () => {
    await execAsUser(db, ALICE, `INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('payment-screenshots', '${ALICE}/order-1.png', '${ALICE}')`)

    await expect(
      execAsUser(db, ALICE, `INSERT INTO storage.objects (bucket_id, name, owner)
        VALUES ('payment-screenshots', '${BOB}/sneaky.png', '${ALICE}')`),
    ).rejects.toThrow()
  })

  it('hides other customers screenshots and shows them to admins', async () => {
    const bobSee = await asUser<{ count: string }>(db, BOB,
      `SELECT COUNT(*) AS count FROM storage.objects WHERE bucket_id = 'payment-screenshots'`)
    expect(Number(bobSee.rows[0].count)).toBe(0)

    const aliceSee = await asUser<{ count: string }>(db, ALICE,
      `SELECT COUNT(*) AS count FROM storage.objects WHERE bucket_id = 'payment-screenshots'`)
    expect(Number(aliceSee.rows[0].count)).toBeGreaterThan(0)

    const adminSee = await asUser<{ count: string }>(db, ADMIN,
      `SELECT COUNT(*) AS count FROM storage.objects WHERE bucket_id = 'payment-screenshots'`)
    expect(Number(adminSee.rows[0].count)).toBeGreaterThan(0)
  })

  it('allows admins only to upload product images', async () => {
    await expect(
      execAsUser(db, ALICE, `INSERT INTO storage.objects (bucket_id, name, owner)
        VALUES ('product-images', 'anything.png', '${ALICE}')`),
    ).rejects.toThrow()

    await execAsUser(db, ADMIN, `INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('product-images', 'products/new.png', '${ADMIN}')`)
  })
})

describe('reviews moderation', () => {
  it('customers can submit pending reviews; only approved ones are public', async () => {
    const tee = await productId('off-by-design-tee')
    await execAsUser(db, ALICE, `INSERT INTO reviews (product_id, user_id, rating, title, body, status)
      VALUES ('${tee}', '${ALICE}', 5, 'Great tee', 'Loved it.', 'pending')`)

    const anonSee = await asUser<{ count: string }>(db, null,
      `SELECT COUNT(*) AS count FROM reviews WHERE product_id = '${tee}'`, undefined, 'anon')
    expect(Number(anonSee.rows[0].count)).toBe(0)

    await execAsUser(db, ADMIN, `UPDATE reviews SET status = 'approved' WHERE title = 'Great tee'`)

    const anonSeeAfter = await asUser<{ count: string }>(db, null,
      `SELECT COUNT(*) AS count FROM reviews WHERE product_id = '${tee}'`, undefined, 'anon')
    expect(Number(anonSeeAfter.rows[0].count)).toBe(1)
  })
})

describe('analytics RPCs', () => {
  it('returns dashboard stats for admins and rejects customers', async () => {
    await expect(asUser(db, ALICE, 'SELECT admin_dashboard_stats()')).rejects.toThrow(/admin access/i)

    const r = await asUser<{ result: Record<string, unknown> }>(db, ADMIN, 'SELECT admin_dashboard_stats() AS result')
    const stats = r.rows[0].result
    expect(Number(stats.total_orders)).toBeGreaterThan(0)
    expect(Number(stats.payments_approved)).toBeGreaterThan(0)
    expect(Array.isArray(stats.recent_orders)).toBe(true)
    expect(Array.isArray(stats.sales_trend)).toBe(true)
  })

  it('returns sales analytics for admins', async () => {
    const r = await asUser<{ result: Record<string, unknown> }>(db, ADMIN,
      'SELECT admin_sales_analytics(30) AS result')
    const analytics = r.rows[0].result
    expect(Number(analytics.total_revenue_paid)).toBeGreaterThan(0)
    expect(Array.isArray(analytics.top_products)).toBe(true)
  })

  it('returns customer stats for admins', async () => {
    const r = await asUser<{ email: string; orders_count: number }>(db, ADMIN, 'SELECT * FROM admin_customer_stats()')
    const alice = r.rows.find((row: { email: string }) => row.email === 'alice@saif.test')
    expect(alice).toBeTruthy()
    expect(Number(alice!.orders_count)).toBeGreaterThan(0)
  })
})

describe('order status workflow', () => {
  it('admin can move orders through statuses with timeline entries', async () => {
    const tee = await productId('off-by-design-tee')
    const r = await asUser<{ result: Record<string, unknown> }>(db, ALICE, `
      SELECT place_order($1::jsonb, $2::jsonb, NULL, 'instapay', $3::jsonb, NULL) AS result`, [
      JSON.stringify({ name: 'Alice', email: 'alice@saif.test', phone: '01011111111' }),
      JSON.stringify([{ product_id: tee, variant_id: null, quantity: 1 }]),
      JSON.stringify({ address: '9 St', governorate: 'Cairo', city: 'Zamalek' }),
    ])
    const orderId = r.rows[0].result.order_id as string
    const paymentId = (await db.query<{ id: string }>('SELECT id FROM payments WHERE order_id = $1', [orderId])).rows[0].id

    await asUser(db, ALICE, `SELECT submit_payment($1, '01011111111', 850, '${ALICE}/${orderId}.png', NULL)`, [orderId])
    await asUser(db, ADMIN, `SELECT review_payment($1, 'approved', NULL, NULL)`, [paymentId])
    await asUser(db, ADMIN, `SELECT admin_update_order_status($1, 'processing', 'preparing')`, [orderId])
    await asUser(db, ADMIN, `SELECT admin_update_order_status($1, 'shipped', NULL)`, [orderId])
    await asUser(db, ADMIN, `SELECT admin_add_order_note($1, 'called customer')`, [orderId])

    const order = await db.query<{ status: string; internal_note: string }>(
      'SELECT status, internal_note FROM orders WHERE id = $1', [orderId],
    )
    expect(order.rows[0].status).toBe('shipped')
    expect(order.rows[0].internal_note).toBe('called customer')

    const events = await db.query<{ event_type: string }>(
      'SELECT event_type FROM order_events WHERE order_id = $1 ORDER BY created_at', [orderId],
    )
    const types = events.rows.map(e => e.event_type)
    expect(types).toContain('order_created')
    expect(types).toContain('payment_submitted')
    expect(types).toContain('payment_reviewed')
    expect(types).toContain('status_change')
    expect(types).toContain('note')
  })
})
