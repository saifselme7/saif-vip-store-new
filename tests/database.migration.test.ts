import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { createTestDb, readSql, readOldSchema, asUser, execAsUser, createTestUser } from './db-harness'

/**
 * Migration test: upgrades a database running the OLD (pre-upgrade) schema
 * with existing data, then verifies the new structure and data survival.
 */

let db: PGlite

const ALICE = '22222222-2222-2222-2222-222222222222'
const ADMIN = '11111111-1111-1111-1111-111111111111'

beforeAll(async () => {
  db = await createTestDb()
  // 1) Install the OLD schema and seed some legacy data
  await db.exec(await readOldSchema())
  await db.exec(`
    INSERT INTO site_settings (store_name, currency, shipping_fee, contact_email)
    VALUES ('SAIF STORE', 'USD', 5.00, 'hello@saifstore.com');
    INSERT INTO categories (name, slug, sort_order) VALUES
      ('T-Shirts', 't-shirts', 1), ('Hoodies', 'hoodies', 2), ('Digital', 'digital', 5);
    INSERT INTO products (name, slug, price, product_type, category_id, stock, status, images, thumbnail)
    VALUES ('Legacy Tee', 'legacy-tee', 45.00, 'physical',
            (SELECT id FROM categories WHERE slug='t-shirts'), 10, 'active', '{}', NULL);
  `)
  await createTestUser(db, ALICE, 'alice@saif.test', 'Alice')
  await createTestUser(db, ADMIN, 'admin@saif.test', 'Admin', 'admin')
  // A legacy order in each legacy status
  await db.exec(`
    INSERT INTO orders (order_number, user_id, status, subtotal, discount, total,
      customer_name, customer_email, customer_phone, shipping_address)
    VALUES
      ('SAIF-OLD-1', '${ALICE}', 'pending', 100, 0, 105, 'Alice', 'alice@saif.test', '010', '{}'),
      ('SAIF-OLD-2', '${ALICE}', 'ready', 200, 0, 205, 'Alice', 'alice@saif.test', '010', '{}'),
      ('SAIF-OLD-3', '${ALICE}', 'rejected', 300, 0, 305, 'Alice', 'alice@saif.test', '010', '{}'),
      ('SAIF-OLD-4', '${ALICE}', 'delivered', 400, 0, 405, 'Alice', 'alice@saif.test', '010', '{}');
    INSERT INTO order_items (order_id, product_id, product_name, price, quantity, total)
    SELECT o.id, p.id, p.name, p.price, 1, p.price
    FROM orders o CROSS JOIN products p WHERE o.order_number LIKE 'SAIF-OLD-%';
  `)

  // 2) Run the upgrade migration + new functions + policies
  await db.exec(readSql('migrations/2026-08-27-upgrade.sql'))
  await db.exec(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
  `)
  await db.exec(readSql('functions.sql'))
  await db.exec(readSql('rls.sql'))
}, 120_000)

describe('migration from the old schema', () => {
  it('keeps all existing data', async () => {
    const products = await db.query<{ c: string }>('SELECT COUNT(*) AS c FROM products')
    expect(Number(products.rows[0].c)).toBe(1)
    const orders = await db.query<{ c: string }>('SELECT COUNT(*) AS c FROM orders')
    expect(Number(orders.rows[0].c)).toBe(4)
    const items = await db.query<{ c: string }>('SELECT COUNT(*) AS c FROM order_items')
    expect(Number(items.rows[0].c)).toBe(4)
    const profiles = await db.query<{ c: string }>('SELECT COUNT(*) AS c FROM profiles')
    expect(Number(profiles.rows[0].c)).toBe(2)
  })

  it('normalises legacy statuses and backfills payment status', async () => {
    const rows = await db.query<{ order_number: string; status: string; payment_status: string }>(
      'SELECT order_number, status, payment_status FROM orders ORDER BY order_number',
    )
    const byNumber = Object.fromEntries(rows.rows.map(r => [r.order_number, r]))
    expect(byNumber['SAIF-OLD-1'].status).toBe('pending')
    expect(byNumber['SAIF-OLD-1'].payment_status).toBe('cancelled')
    expect(byNumber['SAIF-OLD-2'].status).toBe('processing') // 'ready' normalised
    expect(byNumber['SAIF-OLD-3'].status).toBe('cancelled') // 'rejected' normalised
    expect(byNumber['SAIF-OLD-4'].status).toBe('delivered')
    expect(byNumber['SAIF-OLD-4'].payment_status).toBe('approved')
  })

  it('adds the new columns with defaults', async () => {
    const cols = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'site_settings' AND column_name IN
       ('payment_number','instapay_enabled','vodafone_cash_enabled','min_order_amount','payment_instructions')`,
    )
    expect(cols.rows.map(c => c.column_name).sort()).toEqual(
      ['instapay_enabled', 'min_order_amount', 'payment_instructions', 'payment_number', 'vodafone_cash_enabled'].sort(),
    )
    const settings = await db.query<{ payment_number: string | null; currency: string }>(
      'SELECT payment_number, currency FROM site_settings LIMIT 1',
    )
    expect(settings.rows[0].payment_number).toBe('01040324811')
    expect(settings.rows[0].currency).toBe('USD') // existing value preserved
  })

  it('creates the payments / order_events / inventory_logs tables', async () => {
    for (const table of ['payments', 'order_events', 'inventory_logs']) {
      const r = await db.query<{ c: string }>(`SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_name = $1`, [table])
      expect(Number(r.rows[0].c)).toBe(1)
    }
  })

  it('creates the storage buckets', async () => {
    const r = await db.query<{ id: string; public: boolean }>('SELECT id, public FROM storage.buckets ORDER BY id')
    const ids = r.rows.map(b => b.id)
    expect(ids).toContain('payment-screenshots')
    expect(ids).toContain('product-images')
    expect(r.rows.find(b => b.id === 'payment-screenshots')!.public).toBe(false)
  })

  it('blocks role escalation on the migrated database', async () => {
    await expect(
      asUser(db, ALICE, "UPDATE profiles SET role = 'admin' WHERE id = $1", [ALICE]),
    ).rejects.toThrow(/role cannot be modified|permission denied/i)
  })

  it('supports the full new payment flow after migration', async () => {
    const product = await db.query<{ id: string; stock: string }>('SELECT id, stock FROM products LIMIT 1')
    const r = await asUser<{ result: Record<string, unknown> }>(db, ALICE, `
      SELECT place_order($1::jsonb, $2::jsonb, NULL, 'vodafone_cash', $3::jsonb, NULL) AS result`, [
      JSON.stringify({ name: 'Alice', email: 'alice@saif.test', phone: '01011111111' }),
      JSON.stringify([{ product_id: product.rows[0].id, variant_id: null, quantity: 1 }]),
      JSON.stringify({ address: '1 St', governorate: 'Cairo', city: 'Zamalek' }),
    ])
    const orderId = r.rows[0].result.order_id as string
    expect(Number(r.rows[0].result.total)).toBe(50) // 45 product + 5 legacy shipping fee

    await asUser(db, ALICE, `SELECT submit_payment($1, '01011111111', 50, '${ALICE}/${orderId}.png', NULL)`, [orderId])
    const payment = await db.query<{ payment_status: string }>('SELECT payment_status FROM payments WHERE order_id = $1', [orderId])
    expect(payment.rows[0].payment_status).toBe('under_review')

    const pid = await db.query<{ id: string }>('SELECT id FROM payments WHERE order_id = $1', [orderId])
    await asUser(db, ADMIN, `SELECT review_payment($1, 'approved', NULL, NULL)`, [pid.rows[0].id])
    const order = await db.query<{ status: string; payment_status: string }>(
      'SELECT status, payment_status FROM orders WHERE id = $1', [orderId],
    )
    expect(order.rows[0].status).toBe('confirmed')
    expect(order.rows[0].payment_status).toBe('approved')

    const after = await db.query<{ stock: string }>('SELECT stock FROM products LIMIT 1')
    expect(Number(after.rows[0].stock)).toBe(Number(product.rows[0].stock) - 1)
  })

  it('is idempotent — running the migration twice is safe', async () => {
    await db.exec(readSql('migrations/2026-08-27-upgrade.sql'))
    const orders = await db.query<{ c: string }>('SELECT COUNT(*) AS c FROM orders')
    expect(Number(orders.rows[0].c)).toBe(5)
  })
})
