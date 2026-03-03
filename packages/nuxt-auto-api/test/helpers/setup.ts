import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { sql } from 'drizzle-orm'

/**
 * Create in-memory SQLite database for testing
 */
export async function setupTestDatabase(schema: any) {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })

  // Create tables from schema
  await createTablesFromSchema(db, sqlite, schema)

  return { db, sqlite }
}

/**
 * Create tables from schema (since we don't have migrations in tests)
 */
async function createTablesFromSchema(db: any, sqlite: any, schema: any) {
  // Create users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      password TEXT,
      api_key TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `)

  // Create posts table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      published INTEGER NOT NULL DEFAULT 0,
      user_id INTEGER NOT NULL,
      organization_id TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      deleted_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create comments table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create tags table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `)

  // Create post_tags junction table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS post_tags (
      post_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, tag_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `)
}

/**
 * Seed database with test data
 */
export async function seedDatabase(db: any, schema: any) {
  // Insert test users
  const users = await db.insert(schema.users).values([
    { email: 'admin@test.com', name: 'Admin', role: 'admin', password: 'hashed_password_123', apiKey: 'sk_live_admin123' },
    { email: 'user@test.com', name: 'User', role: 'user', password: 'hashed_password_456', apiKey: 'sk_live_user456' },
    { email: 'editor@test.com', name: 'Editor', role: 'editor', password: 'hashed_password_789', apiKey: 'sk_live_editor789' }
  ]).returning()

  // Insert test posts
  const posts = await db.insert(schema.posts).values([
    { title: 'Post 1', content: 'Content 1', userId: users[0].id, published: true },
    { title: 'Post 2', content: 'Content 2', userId: users[1].id, published: false }
  ]).returning()

  return { users, posts }
}

/**
 * Clean database between tests
 */
export async function cleanDatabase(db: any, schema: any) {
  if (schema.comments) {
    await db.delete(schema.comments)
  }
  await db.delete(schema.posts)
  await db.delete(schema.users)
}
