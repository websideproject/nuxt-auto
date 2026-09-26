import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

export function useDB() {
  if (!_db) {
    const sqlite = new Database(':memory:')

    // Create tables for in-memory test database
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'user'
      );

      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        published INTEGER NOT NULL DEFAULT 0,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at INTEGER,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource TEXT NOT NULL,
        operation TEXT NOT NULL,
        record_id TEXT NOT NULL,
        user_id TEXT,
        before TEXT,
        after TEXT,
        ip TEXT,
        timestamp INTEGER NOT NULL
      );
    `)

    // Seed a test user so posts can reference it
    sqlite.exec(`INSERT INTO users (email, name, role) VALUES ('test@example.com', 'Test User', 'admin')`)

    _db = drizzle(sqlite, { schema })
  }
  return _db
}
