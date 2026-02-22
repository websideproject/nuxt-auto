import { Database } from 'bun:sqlite';

const db = new Database('.data/db.sqlite');

console.log('Initializing database tables for Bun...');

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;');

// Create users table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT DEFAULT 'user' NOT NULL,
    password TEXT,
    api_key TEXT,
    created_at INTEGER,
    updated_at INTEGER
  );
`);

// Create posts table
db.run(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    published INTEGER DEFAULT 0 NOT NULL,
    user_id INTEGER NOT NULL,
    organization_id TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Create comments table
db.run(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at INTEGER,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

console.log('Database tables initialized successfully.');
db.close();
