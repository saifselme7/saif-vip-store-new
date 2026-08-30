import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createTestDb, readSql, asUser, execAsUser, createTestUser } from './db-harness'

/**
 * RECONCILIATION TESTS — prove that
 *   migrations/2026-08-28-admin-reconcile.sql → functions.sql → rls.sql
 * converges BOTH known database lineages to the schema the current
 * application expects, additively, with data preserved and idempotent re-runs:
 *
 *   Lineage A — original/v1 (pre-transformation schema + original RLS)
 *   Lineage B — sibling-v2  (v1 + the sibling "upgrade_v2.sql", where
 *               payments use `status`, stock uses `stock_released`, the
 *               audit table is `inventory_log`, and review_payment takes
 *               p_action instead of p_decision)
 */

const TESTS_DIR = dirname(fileURLToPath(import.meta.url))
const SIBLING_SQL = readFileSync(join(TESTS_DIR, 'fixtures/sibling-upgrade-v2.sql'), 'utf8')
  .split('\n')
  .filter(line => !/^\s*CREATE EXTENSION/i.test(line))
  .join('\n')

function originalSchemaSql(): string {
  try {
    return execSync('git show a050038e3986e65d2dc2a7f3cc8f5fe759ae6479:supabase/schema.sql', {
      cwd: join(TESTS_DIR, '..'),
      encoding: 'utf8',
    })
      .split('\n')
      .filter(line => !/^\s*CREATE EXTENSION/i.test(line))
      .join('\n')
  } catch {
    return readFileSync(join(TESTS_DIR, 'fixtures/v1-pre-upgrade-schema.sql'), 'utf8')
      .split('\n')
      .filter(line => !/^\s*CREATE EXTENSION/i.test(line))
      .join('\n')
  }
}

function originalRlsSql(): string {
  try {
    return execSync('git show a050038e3986e65d2dc2a7f3cc8f5fe759ae6479:supabase/rls.sql', {
      cwd: join(TESTS_DIR, '..'),
      encoding: 'utf8',
    })
  } catch {
    return readFileSync(join(TESTS_DIR, 'fixtures/v1-pre-upgrade-rls.sql'), 'utf8')
  }
}

/** The full reconciliation stack, in the documented run order. */
async function applyReconciliation(db: PGlite) {
  await db.exec(readSql('migrations/2026-08-28-admin-reconcile.sql'))
  await db.exec(readSql('functions.sql'))
  await db.exec(readSql('migrations/2026-08-29-bilingual-cms.sql'))
  await db.exec(readSql('rls.sql'))
}

const ADMIN = '11111111-1111-1111-1111-111111111111'
const ALICE = '22222222-2222-2222-2222-222222222222'

const REQUIRED_RPCS = [
  'place_order', 'submit_payment', 'review_payment',
  'admin_update_order_status', 'admin_add_order_note', 'admin_set_fulfillment',
  'customer_cancel_order', 'admin_adjust_stock', 'admin_dashboard_stats',
  'admin_sales_analytics', 'admin_customer_stats', 'validate_coupon',
  'get_product_rating_stats', 'is_admin', 'restore_order_stock',
]

async function assertConverged(db: PGlite) {
  // 1. All required RPC functions exist
  const rpcs = await db.query<{ proname: string }>(
    `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND proname = ANY($1)`,
    [REQUIRED_RPCS],
  )
  expect(new Set(rpcs.rows.map(r => r.proname)).size).toBe(REQUIRED_RPCS.length)

  // 2. review_payment resolves the FRONTEND contract (p_decision, not p_action)
  const sig = await db.query<{ args: string }>(
    `SELECT pg_get_function_arguments(p.oid) AS args FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND proname = 'review_payment'`,
  )
  expect(sig.rows[0].args).toContain('p_decision')
  expect(sig.rows[0].args).not.toContain('p_action')

  // 3. Required columns exist
  for (const [table, column] of [
    ['orders', 'payment_status'], ['orders', 'stock_reserved'], ['orders', 'internal_note'],
    ['payments', 'payment_status'], ['payments', 'payer_identifier'],
    ['order_items', 'fulfillment_note'], ['products', 'specifications'],
    ['coupons', 'max_discount_amount'], ['site_settings', 'payment_number'],
  ] as const) {
    const r = await db.query<{ c: string }>(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [table, column],
    )
    expect(Number(r.rows[0].c), `${table}.${column}`).toBe(1)
  }

  // 4. Legacy/conflicting functions gone
  const legacyFns = await db.query<{ proname: string }>(
    `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND proname = ANY($1)`,
    [['set_order_status', 'release_order_stock', 'set_user_role', 'log_product_stock_change']],
  )
  expect(legacyFns.rows).toEqual([])

  // 5. Legacy policies gone
  const legacyPolicies = await db.query<{ policyname: string }>(
    `SELECT policyname FROM pg_policies
     WHERE (schemaname='public' AND policyname = ANY($1))
        OR (schemaname='storage' AND policyname LIKE 'Screenshots owner%')`,
    [[
      'Users can view own profile', 'Users can update own profile', 'Users can insert own profile',
      'Products admin all', 'Orders own', 'Order items through order',
      'Reviews public read approved', 'Reviews own read', 'Reviews own write', 'Payments own read',
    ]],
  )
  expect(legacyPolicies.rows).toEqual([])

  // 6. Role escalation guard active
  await expect(
    asUser(db, ALICE, "UPDATE profiles SET role = 'admin' WHERE id = $1", [ALICE]),
  ).rejects.toThrow(/role cannot be modified|permission denied/i)

  // 7. Admin RPCs execute for admins, are blocked for customers
  await expect(asUser(db, ALICE, 'SELECT admin_dashboard_stats()')).rejects.toThrow(/admin access/i)
  const stats = await asUser<{ total_orders: string }>(db, ADMIN, `SELECT (admin_dashboard_stats()) ->> 'total_orders' AS total_orders`)
  expect(Number(stats.rows[0].total_orders)).toBeGreaterThanOrEqual(0)
}

/** End-to-end business flow against a converged database. */
async function assertBusinessFlow(db: PGlite, productSlug: string) {
  const product = await db.query<{ id: string; price: number; stock: number }>(
    'SELECT id, price, stock FROM products WHERE slug = $1', [productSlug],
  )
  const pid = product.rows[0].id

  // Customer places an order — named args exactly like the frontend/PostgREST
  const order = await asUser<{ order_id: string; total: number }>(db, ALICE, `
    SELECT place_order(
      p_customer := $1::jsonb,
      p_items := $2::jsonb,
      p_coupon_code := NULL,
      p_payment_method := 'instapay',
      p_shipping := $3::jsonb,
      p_notes := NULL
    ) AS result`, [
    JSON.stringify({ name: 'Alice', email: 'alice@saif.test', phone: '01011111111' }),
    JSON.stringify([{ product_id: pid, variant_id: null, quantity: 1 }]),
    JSON.stringify({ address: '1 St', governorate: 'Cairo', city: 'Zamalek' }),
  ])
  const orderResult = order.rows[0].result as { order_id: string; total: number }
  const orderId = orderResult.order_id
  expect(orderId).toBeTruthy()

  // Customer submits payment proof (named args = frontend contract)
  await asUser(db, ALICE, `
    SELECT submit_payment(
      p_order_id := $1::uuid,
      p_payer_identifier := $2::text,
      p_transferred_amount := $3::numeric,
      p_screenshot_path := $4::text,
      p_customer_note := NULL
    )`, [orderId, '01011111111', 100, `${ALICE}/proof.png`])

  // Admin reviews with the FRONTEND parameter name
  const payment = await db.query<{ id: string }>('SELECT id FROM payments WHERE order_id = $1', [orderId])
  const review = await asUser<{ result: { payment_status: string } }>(db, ADMIN, `
    SELECT review_payment(
      p_payment_id := $1::uuid,
      p_decision := 'approved',
      p_admin_note := NULL,
      p_rejection_reason := NULL
    ) AS result`, [payment.rows[0].id])
  expect(review.rows.length).toBeGreaterThanOrEqual(0) // call executed above; result shape checked below

  const status = await db.query<{ payment_status: string; status: string }>(
    'SELECT payment_status, status FROM orders WHERE id = $1', [orderId],
  )
  expect(status.rows[0].payment_status).toBe('approved')
  expect(status.rows[0].status).toBe('confirmed')

  // Inventory updated + audited
  const after = await db.query<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [pid])
  expect(after.rows[0].stock).toBe(product.rows[0].stock - 1)
  const logs = await db.query<{ c: string }>(
    'SELECT COUNT(*) AS c FROM inventory_logs WHERE product_id = $1', [pid],
  )
  expect(Number(logs.rows[0].c)).toBeGreaterThanOrEqual(1)

  // Analytics + customers execute
  await asUser(db, ADMIN, 'SELECT admin_sales_analytics(30)')
  await asUser(db, ADMIN, 'SELECT * FROM admin_customer_stats()')

  // Order status workflow + timeline
  await asUser(db, ADMIN, `SELECT admin_update_order_status($1, 'shipped', 'on its way')`, [orderId])
  const events = await db.query<{ c: string }>(
    'SELECT COUNT(*) AS c FROM order_events WHERE order_id = $1', [orderId],
  )
  expect(Number(events.rows[0].c)).toBeGreaterThanOrEqual(3)
}

// ---------------------------------------------------------------------------
// LINEAGE A — original/v1
// ---------------------------------------------------------------------------
describe('reconciliation — lineage A (original v1 schema)', () => {
  let db: PGlite
  beforeAll(async () => {
    db = await createTestDb()
    await db.exec(originalSchemaSql())
    await db.exec(originalRlsSql())
    await createTestUser(db, ADMIN, 'admin@saif.test', 'Admin', 'admin')
    await createTestUser(db, ALICE, 'alice@saif.test', 'Alice')
    // Legacy v1 data
    await db.exec(`
      INSERT INTO site_settings (store_name, currency, shipping_fee, contact_email)
      VALUES ('SAIF STORE', 'EGP', 75, 'hello@saifstore.com');
      INSERT INTO categories (name, slug, sort_order) VALUES ('T-Shirts', 't-shirts', 1);
      INSERT INTO products (name, slug, price, product_type, category_id, stock, status, images)
      VALUES ('Legacy Tee', 'legacy-tee', 300, 'physical',
              (SELECT id FROM categories WHERE slug='t-shirts'), 10, 'active', '{}');
      INSERT INTO orders (order_number, user_id, status, subtotal, discount, total,
        customer_name, customer_email, customer_phone, shipping_address)
      VALUES
        ('SAIF-A-1', '${ALICE}', 'pending',   300, 0, 375, 'Alice', 'alice@saif.test', '010', '{}'),
        ('SAIF-A-2', '${ALICE}', 'ready',     300, 0, 375, 'Alice', 'alice@saif.test', '010', '{}'),
        ('SAIF-A-3', '${ALICE}', 'rejected',  300, 0, 375, 'Alice', 'alice@saif.test', '010', '{}'),
        ('SAIF-A-4', '${ALICE}', 'delivered', 300, 0, 375, 'Alice', 'alice@saif.test', '010', '{}');
    `)
    await applyReconciliation(db)
  }, 120_000)

  it('converges the schema/function/policy contract', async () => {
    await assertConverged(db)
  })

  it('normalises legacy statuses and backfills payment_status', async () => {
    const rows = await db.query<{ order_number: string; status: string; payment_status: string }>(
      'SELECT order_number, status, payment_status FROM orders ORDER BY order_number',
    )
    const byNumber = Object.fromEntries(rows.rows.map(r => [r.order_number, r]))
    expect(byNumber['SAIF-A-1'].status).toBe('pending')
    expect(byNumber['SAIF-A-2'].status).toBe('processing') // 'ready' normalised
    expect(byNumber['SAIF-A-3'].status).toBe('cancelled')  // 'rejected' normalised
    expect(byNumber['SAIF-A-4'].status).toBe('delivered')
    expect(byNumber['SAIF-A-4'].payment_status).toBe('approved')
    expect(byNumber['SAIF-A-1'].payment_status).toBe('cancelled')
  })

  it('preserves all legacy data', async () => {
    expect(Number((await db.query('SELECT COUNT(*) AS c FROM orders')).rows[0].c)).toBe(4)
    expect(Number((await db.query('SELECT COUNT(*) AS c FROM products')).rows[0].c)).toBe(1)
  })

  it('runs the full business flow after convergence', async () => {
    await assertBusinessFlow(db, 'legacy-tee')
  })

  it('is idempotent — re-running the full stack changes nothing', async () => {
    await applyReconciliation(db)
    await assertConverged(db)
    const c = await db.query<{ c: string }>('SELECT COUNT(*) AS c FROM orders')
    expect(Number(c.rows[0].c)).toBe(5) // 4 legacy + 1 from the flow test
  })
})

// ---------------------------------------------------------------------------
// LINEAGE B — sibling-v2
// ---------------------------------------------------------------------------
describe('reconciliation — lineage B (sibling v2 schema)', () => {
  let db: PGlite
  beforeAll(async () => {
    db = await createTestDb()
    await db.exec(originalSchemaSql())
    await db.exec(originalRlsSql())
    await db.exec(SIBLING_SQL)
    await createTestUser(db, ADMIN, 'admin@saif.test', 'Admin', 'admin')
    await createTestUser(db, ALICE, 'alice@saif.test', 'Alice')

    // Sibling-style legacy data (their column shapes)
    await db.exec(`
      INSERT INTO categories (name, slug, sort_order) VALUES ('T-Shirts', 't-shirts', 1);
      INSERT INTO products (name, slug, price, product_type, category_id, stock, status, images, low_stock_threshold)
      VALUES ('Sibling Tee', 'sibling-tee', 400, 'physical',
              (SELECT id FROM categories WHERE slug='t-shirts'), 20, 'active', '{}', 5);
      INSERT INTO orders (order_number, user_id, status, subtotal, discount, total,
        customer_name, customer_email, customer_phone, shipping_address,
        shipping_fee, digital_delivery, stock_released, payment_method)
      VALUES
        ('SAIF-B-1', '${ALICE}', 'payment_review', 400, 0, 400, 'Alice', 'alice@saif.test', '010', '{}', 0, '{}', FALSE, 'instapay'),
        ('SAIF-B-2', '${ALICE}', 'delivered',      400, 0, 400, 'Alice', 'alice@saif.test', '010', '{}', 0, '{}', TRUE,  'vodafone_cash');
      -- Sibling payments use the 'status' column and allow multiple rows per order
      INSERT INTO payments (order_id, user_id, payment_method, status, expected_amount, transferred_amount, payer_identifier, screenshot_path)
      VALUES
        ((SELECT id FROM orders WHERE order_number='SAIF-B-1'), '${ALICE}', 'instapay', 'under_review', 400, 400, '01011111111', '${ALICE}/b1.png'),
        ((SELECT id FROM orders WHERE order_number='SAIF-B-1'), '${ALICE}', 'instapay', 'approved',     400, 400, '01011111111', '${ALICE}/b1-dupe.png'),
        ((SELECT id FROM orders WHERE order_number='SAIF-B-2'), '${ALICE}', 'vodafone_cash', 'approved', 400, 400, '01011111111', '${ALICE}/b2.png');
      -- Sibling audit log (singular table, different columns)
      INSERT INTO inventory_log (product_id, variant_id, change, stock_after, changed_by)
      VALUES ((SELECT id FROM products WHERE slug='sibling-tee'), NULL, -2, 18, '${ALICE}');
      INSERT INTO coupons (code, type, value, min_order_value, max_uses, max_discount)
      VALUES ('SIB10', 'fixed', 10, NULL, NULL, 50);
    `)
    await applyReconciliation(db)
  }, 120_000)

  it('converges the schema/function/policy contract', async () => {
    await assertConverged(db)
  })

  it('backfills payments.payment_status from the sibling status column', async () => {
    const rows = await db.query<{ order_number: string; payment_status: string }>(`
      SELECT o.order_number, p.payment_status
      FROM payments p JOIN orders o ON o.id = p.order_id
      ORDER BY o.order_number, p.created_at`,
    )
    const b1 = rows.rows.filter(r => r.order_number === 'SAIF-B-1')
    // duplicate resolved: under_review row superseded -> cancelled; approved kept
    expect(b1.map(r => r.payment_status).sort()).toEqual(['approved', 'cancelled'])
    const b2 = rows.rows.find(r => r.order_number === 'SAIF-B-2')
    expect(b2?.payment_status).toBe('approved')
  })

  it('enforces one ACTIVE payment per order (partial unique index)', async () => {
    const idx = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename='payments' AND indexname='payments_one_active_per_order'`,
    )
    expect(idx.rows).toHaveLength(1)
    // A second ACTIVE payment for the same order is rejected...
    await expect(
      db.query(`INSERT INTO payments (order_id, user_id, payment_method, payment_status, expected_amount)
                SELECT o.id, '${ALICE}', 'instapay', 'awaiting_payment', 1 FROM orders o LIMIT 1`),
    ).rejects.toThrow(/duplicate key|unique/i)
    // ...while cancelled historical rows stay preserved (nothing deleted).
    const preserved = await db.query<{ c: string }>(
      "SELECT COUNT(*) AS c FROM payments WHERE payment_status = 'cancelled'",
    )
    expect(Number(preserved.rows[0].c)).toBe(1)
  })

  it('maps stock_released -> stock_reserved for legacy orders (one time)', async () => {
    const rows = await db.query<{ order_number: string; stock_reserved: boolean }>(
      'SELECT order_number, stock_reserved FROM orders ORDER BY order_number',
    )
    const byNumber = Object.fromEntries(rows.rows.map(r => [r.order_number, r.stock_reserved]))
    expect(byNumber['SAIF-B-1']).toBe(true)  // stock_released FALSE -> reserved
    expect(byNumber['SAIF-B-2']).toBe(false) // stock_released TRUE  -> released
  })

  it('copies sibling inventory_log rows into inventory_logs (original preserved)', async () => {
    const copied = await db.query<{ c: string; delta: number; new_value: number }>(
      'SELECT COUNT(*) AS c, MAX(delta) AS delta, MAX(new_value) AS new_value FROM inventory_logs',
    )
    expect(Number(copied.rows[0].c)).toBe(1)
    expect(Number(copied.rows[0].delta)).toBe(-2)
    expect(Number(copied.rows[0].new_value)).toBe(18)
    const original = await db.query<{ c: string }>('SELECT COUNT(*) AS c FROM inventory_log')
    expect(Number(original.rows[0].c)).toBe(1) // untouched
  })

  it('backfills coupons.max_discount_amount from max_discount', async () => {
    const c = await db.query<{ max_discount_amount: number }>(
      "SELECT max_discount_amount FROM coupons WHERE code = 'SIB10'",
    )
    expect(Number(c.rows[0].max_discount_amount)).toBe(50)
  })

  it('preserves all legacy data (orders, payments, products)', async () => {
    expect(Number((await db.query('SELECT COUNT(*) AS c FROM orders')).rows[0].c)).toBe(2)
    expect(Number((await db.query('SELECT COUNT(*) AS c FROM payments')).rows[0].c)).toBe(3)
    expect(Number((await db.query('SELECT COUNT(*) AS c FROM products')).rows[0].c)).toBe(1)
  })

  it('runs the full business flow after convergence (p_decision contract)', async () => {
    await assertBusinessFlow(db, 'sibling-tee')
  })

  it('is idempotent — re-running never drops our review_payment or corrupts stock', async () => {
    // A cancelled order through the NEW flow must stay released after re-run
    const order = await asUser<{ order_id: string }>(db, ALICE, `
      SELECT (place_order(
        p_customer := $1::jsonb, p_items := $2::jsonb, p_coupon_code := NULL,
        p_payment_method := 'instapay', p_shipping := $3::jsonb, p_notes := NULL
      )) ->> 'order_id' AS order_id`, [
      JSON.stringify({ name: 'Alice', email: 'alice@saif.test', phone: '01011111111' }),
      JSON.stringify([{ product_id: (await db.query<{ id: string }>("SELECT id FROM products WHERE slug='sibling-tee'")).rows[0].id, variant_id: null, quantity: 1 }]),
      JSON.stringify({ address: '2 St', governorate: 'Cairo', city: 'Maadi' }),
    ])
    const cancelId = order.rows[0].order_id
    await asUser(db, ALICE, 'SELECT customer_cancel_order($1)', [cancelId])
    const stockBefore = await db.query<{ stock: number }>("SELECT stock FROM products WHERE slug='sibling-tee'")

    // Re-run the FULL stack
    await applyReconciliation(db)

    // review_payment still exists with p_decision (not dropped by re-run)
    const sig = await db.query<{ args: string }>(
      `SELECT pg_get_function_arguments(p.oid) AS args FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname='public' AND proname='review_payment'`,
    )
    expect(sig.rows[0].args).toContain('p_decision')

    // Cancelled order NOT re-reserved (marker prevented the sibling backfill)
    const cancelled = await db.query<{ stock_reserved: boolean }>(
      'SELECT stock_reserved FROM orders WHERE id = $1', [cancelId],
    )
    expect(cancelled.rows[0].stock_reserved).toBe(false)
    const stockAfter = await db.query<{ stock: number }>("SELECT stock FROM products WHERE slug='sibling-tee'")
    expect(stockAfter.rows[0].stock).toBe(stockBefore.rows[0].stock)

    // Contract still converged
    await assertConverged(db)
  })
})
