import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import type { DatabaseEngine } from '../../src/runtime/types/database'
import { buildSchema, type Dialect } from './schema'

/**
 * Real databases for the engine conformance suite.
 *
 * SQLite, libsql (Turso's driver, on a local file) and D1 (Miniflare's local D1 — the same workerd runtime
 * `wrangler dev` uses) always run. Postgres, MySQL and PlanetScale run when a URL is given, which CI does
 * with service containers:
 *
 *   AUTOAPI_TEST_PG_URL=postgres://postgres:test@localhost:5432/autoapi
 *   AUTOAPI_TEST_MYSQL_URL=mysql://root:test@localhost:3306/autoapi
 *   AUTOAPI_TEST_PLANETSCALE_URL=http://root:test@localhost:3900   (ps-http-sim in front of that MySQL)
 *
 * `AUTOAPI_TEST_REQUIRE_ENGINES=1` (set in CI) turns a missing URL into a failure instead of a skip.
 */
export interface TestEngine {
  engine: DatabaseEngine
  dialect: Dialect
  db: any
  schema: ReturnType<typeof buildSchema>
  close: () => Promise<void>
}

export interface EngineSpec {
  engine: DatabaseEngine
  available: boolean
  connect: () => Promise<TestEngine>
}

const env = process.env

export const ENGINES: EngineSpec[] = [
  { engine: 'better-sqlite3', available: true, connect: connectSqlite },
  { engine: 'turso', available: true, connect: connectLibsql },
  { engine: 'd1', available: true, connect: connectD1 },
  { engine: 'postgres', available: !!env.AUTOAPI_TEST_PG_URL, connect: connectPostgres },
  { engine: 'mysql', available: !!env.AUTOAPI_TEST_MYSQL_URL, connect: connectMysql },
  { engine: 'planetscale', available: !!env.AUTOAPI_TEST_PLANETSCALE_URL && !!env.AUTOAPI_TEST_MYSQL_URL, connect: connectPlanetscale },
]

if (env.AUTOAPI_TEST_REQUIRE_ENGINES) {
  const missing = ENGINES.filter(e => !e.available).map(e => e.engine)
  if (missing.length) throw new Error(`AUTOAPI_TEST_REQUIRE_ENGINES is set but these engines have no URL: ${missing.join(', ')}`)
}

async function sqliteDdl(full: Record<string, any>): Promise<string[]> {
  const { generateSQLiteDrizzleJson, generateSQLiteMigration } = await import('drizzle-kit/api')
  return generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(full))
}

async function connectSqlite(): Promise<TestEngine> {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = buildSchema('sqlite')
  const client = new Database(':memory:')
  client.pragma('foreign_keys = ON')
  for (const stmt of await sqliteDdl(schema.full)) client.exec(stmt)
  return { engine: 'better-sqlite3', dialect: 'sqlite', db: drizzle(client, { schema: schema.full }), schema, close: async () => {
    client.close()
  } }
}

async function connectLibsql(): Promise<TestEngine> {
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const schema = buildSchema('sqlite')
  const client = createClient({ url: `file:${join(mkdtempSync(join(tmpdir(), 'autoapi-libsql-')), 'test.db')}` })
  await client.execute('PRAGMA foreign_keys = ON')
  for (const stmt of await sqliteDdl(schema.full)) await client.execute(stmt)
  return { engine: 'turso', dialect: 'sqlite', db: drizzle(client, { schema: schema.full }), schema, close: async () => client.close() }
}

async function connectD1(): Promise<TestEngine> {
  const { Miniflare } = await import('miniflare')
  const { drizzle } = await import('drizzle-orm/d1')
  const schema = buildSchema('sqlite')
  const mf = new Miniflare({ modules: true, script: 'export default { fetch: () => new Response(null) }', d1Databases: { DB: 'autoapi-test' } })
  const d1: any = await mf.getD1Database('DB')
  for (const stmt of await sqliteDdl(schema.full)) await d1.prepare(stmt).run()
  return { engine: 'd1', dialect: 'sqlite', db: drizzle(d1, { schema: schema.full }), schema, close: () => mf.dispose() }
}

async function connectPostgres(): Promise<TestEngine> {
  const { default: postgres } = await import('postgres')
  const { drizzle } = await import('drizzle-orm/postgres-js')
  const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api')
  const schema = buildSchema('pg')
  const client = postgres(env.AUTOAPI_TEST_PG_URL!, { max: 5, onnotice: () => {} })
  await client.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  for (const stmt of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema.full))) await client.unsafe(stmt)
  return { engine: 'postgres', dialect: 'pg', db: drizzle(client, { schema: schema.full }), schema, close: () => client.end() }
}

async function mysqlSetup() {
  const { createPool } = await import('mysql2/promise')
  const { generateMySQLDrizzleJson, generateMySQLMigration } = await import('drizzle-kit/api')
  const schema = buildSchema('mysql')
  const pool = createPool({ uri: env.AUTOAPI_TEST_MYSQL_URL!, connectionLimit: 5 })
  const [tables]: any = await pool.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()')
  await pool.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const { name } of tables) await pool.query(`DROP TABLE \`${name}\``)
  await pool.query('SET FOREIGN_KEY_CHECKS = 1')
  for (const stmt of await generateMySQLMigration(await generateMySQLDrizzleJson({}), await generateMySQLDrizzleJson(schema.full))) await pool.query(stmt)
  return { pool, schema }
}

async function connectMysql(): Promise<TestEngine> {
  const { drizzle } = await import('drizzle-orm/mysql2')
  const { pool, schema } = await mysqlSetup()
  return { engine: 'mysql', dialect: 'mysql', db: drizzle(pool, { schema: schema.full, mode: 'default' }), schema, close: () => pool.end() }
}

async function connectPlanetscale(): Promise<TestEngine> {
  const { Client } = await import('@planetscale/database')
  const { drizzle } = await import('drizzle-orm/planetscale-serverless')
  const { pool, schema } = await mysqlSetup()
  await pool.end()
  const client = new Client({ url: env.AUTOAPI_TEST_PLANETSCALE_URL! })
  const db = drizzle(client, { schema: schema.full })
  await db.execute(sql`select 1`)
  return { engine: 'planetscale', dialect: 'mysql', db, schema, close: async () => {} }
}
