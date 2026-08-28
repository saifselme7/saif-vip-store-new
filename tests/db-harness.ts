/**
 * Database test harness.
 *
 * Runs the real Supabase SQL files against PGlite (PostgreSQL in WASM) with
 * faithful mocks of the `auth` and `storage` schemas that Supabase provides:
 *   - auth.uid() reads the current test user from a session GUC
 *   - `SET ROLE authenticated` simulates PostgREST's connection role, so
 *     RLS policies are enforced exactly as in production
 *   - storage.buckets / storage.objects / storage.foldername() back the
 *     storage policies
 */

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SUPABASE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../supabase')

export async function createTestDb() {
  const db = await PGlite.create()

  // ---- Supabase environment mocks -------------------------------------
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE TABLE auth.users (
      id UUID PRIMARY KEY,
      email TEXT,
      raw_user_meta_data JSONB DEFAULT '{}'
    );

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
    $$;

    CREATE OR REPLACE FUNCTION auth.role()
    RETURNS TEXT LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'authenticated')
    $$;

    -- PostgREST connection roles
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE service_role NOLOGIN;

    GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

    -- storage schema mock
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE storage.buckets (
      id TEXT PRIMARY KEY,
      name TEXT,
      public BOOLEAN DEFAULT false,
      file_size_limit BIGINT,
      allowed_mime_types TEXT[]
    );
    CREATE TABLE storage.objects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id TEXT REFERENCES storage.buckets(id),
      name TEXT,
      owner UUID,
      metadata JSONB DEFAULT '{}'
    );
    ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated, anon;
    GRANT SELECT ON storage.buckets TO authenticated, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

    CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
    RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
      SELECT string_to_array(name, '/')
    $$;
  `)

  // uuid-ossp is unavailable in PGlite; gen_random_uuid() is core in PG13+.
  await db.exec(`
    CREATE OR REPLACE FUNCTION uuid_generate_v4()
    RETURNS UUID LANGUAGE sql VOLATILE AS $$
      SELECT gen_random_uuid()
    $$;
  `)

  return db
}

function stripExtensionStatements(sql: string) {
  return sql
    .split('\n')
    .filter(line => !/^\s*CREATE EXTENSION/i.test(line))
    .join('\n')
}

export function readSql(file: string) {
  return stripExtensionStatements(readFileSync(join(SUPABASE_DIR, file), 'utf8'))
}

export async function readOldSchema() {
  // The pre-upgrade schema, pinned to the commit before the transformation
  // so the migration path keeps being tested no matter what HEAD is.
  const { execSync } = await import('node:child_process')
  const sql = execSync('git show a050038e3986e65d2dc2a7f3cc8f5fe759ae6479:supabase/schema.sql', {
    cwd: join(SUPABASE_DIR, '..'),
    encoding: 'utf8',
  })
  return stripExtensionStatements(sql)
}

export async function applyFullSchema(db: PGlite) {
  await db.exec(readSql('schema.sql'))
  // Approximate Supabase's default grants now that tables exist.
  await db.exec(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  `)
  await db.exec(readSql('functions.sql'))
  await db.exec(readSql('rls.sql'))
  await db.exec(readSql('seed.sql'))
}

/** Run SQL as a specific (non-superuser) role + user id, like PostgREST. */
export async function asUser(
  db: PGlite,
  userId: string | null,
  sql: string,
  params?: unknown[],
  role: 'authenticated' | 'anon' = 'authenticated',
) {
  await db.exec(`SET ROLE ${role}`)
  await db.exec(userId ? `SELECT set_config('app.user_id', '${userId}', false)` : `SELECT set_config('app.user_id', '', false)`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('RESET ROLE')
  }
}

/** Execute SQL as a user without returning rows (multi-statement safe). */
export async function execAsUser(
  db: PGlite,
  userId: string | null,
  sql: string,
  role: 'authenticated' | 'anon' = 'authenticated',
) {
  await db.exec(`SET ROLE ${role}`)
  await db.exec(userId ? `SELECT set_config('app.user_id', '${userId}', false)` : `SELECT set_config('app.user_id', '', false)`)
  try {
    await db.exec(sql)
  } finally {
    await db.exec('RESET ROLE')
  }
}

export async function createTestUser(db: PGlite, id: string, email: string, fullName: string, role: 'customer' | 'admin' = 'customer') {
  await db.query('INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)', [
    id,
    email,
    JSON.stringify({ full_name: fullName }),
  ])
  // handle_new_user trigger creates the profile row
  const profile = await db.query<{ id: string; role: string }>('SELECT id, role FROM profiles WHERE id = $1', [id])
  if (role === 'admin') {
    await db.exec("UPDATE profiles SET role = 'admin' WHERE id = '" + id + "'")
  }
  return profile.rows[0]
}
