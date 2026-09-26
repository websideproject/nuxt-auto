import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

export function useDB() {
  if (!_db) {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, password TEXT, organization_id TEXT);
      CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, organization_id TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id), deleted_at INTEGER, cover TEXT);
      CREATE TABLE labels (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, organization_id TEXT);
      CREATE TABLE post_labels (post_id INTEGER NOT NULL, label_id INTEGER NOT NULL, PRIMARY KEY (post_id, label_id));
      CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL);
      CREATE TABLE docs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0);
      INSERT INTO users (email, password, organization_id) VALUES ('alice@a.test', 'hunter2', 'org_a'), ('bob@b.test', 's3cret', 'org_b');
      INSERT INTO posts (title, organization_id, user_id, deleted_at) VALUES
        ('A1', 'org_a', 1, NULL), ('B1', 'org_b', 2, NULL), ('B-trashed', 'org_b', 2, 1700000000),
        ('A2', 'org_a', 1, NULL), ('A3', 'org_a', 1, NULL), ('A-trashed', 'org_a', 1, 1700000000);
      INSERT INTO labels (name, organization_id) VALUES ('a-red', 'org_a'), ('b-blue', 'org_b'), ('a-green', 'org_a');
      INSERT INTO post_labels (post_id, label_id) VALUES (1, 1);
      INSERT INTO notes (body) VALUES ('n1'), ('n2');
      INSERT INTO docs (title, published) VALUES ('public doc', 1), ('draft doc', 0);
    `)
    _db = drizzle(sqlite, { schema })
  }
  return _db
}
