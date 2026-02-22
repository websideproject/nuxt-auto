import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { apiKeys } from '../../modules/api-tokens/schema.ts'
import { articles } from '../../modules/blog/schema.ts'

/**
 * Users table
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role', { enum: ['user', 'admin', 'editor'] }).default('user').notNull(),
  password: text('password'), // Hidden field for demo
  apiKey: text('api_key'), // Hidden field for demo
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),

  // Request metadata (populated by requestMetadataPlugin)
  signupIp: text('signup_ip'),
  signupCountry: text('signup_country'),
  signupMeta: text('signup_meta', { mode: 'json' }),
  lastIp: text('last_ip'),
  lastSeen: integer('last_seen', { mode: 'timestamp' }),
})

/**
 * Posts table
 */
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
  published: integer('published', { mode: 'boolean' }).default(false).notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id'), // Multi-tenancy support
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Soft delete support
})

/**
 * Comments table
 */
export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  content: text('content').notNull(),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

/**
 * Relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  apiKeys: many(apiKeys),
  articles: many(articles),
}))

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}))

// Combined schema for migrations
// Note: For migrations that need blog tables, import them directly from modules/blog/schema
export const schema = {
  users,
  posts,
  comments,
  usersRelations,
  postsRelations,
  commentsRelations,
}
