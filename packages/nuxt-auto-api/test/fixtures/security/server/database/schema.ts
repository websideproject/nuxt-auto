import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  password: text('password'),
  organizationId: text('organization_id'),
})

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  organizationId: text('organization_id'),
  userId: integer('user_id').notNull().references(() => users.id),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  cover: text('cover'),
})

export const labels = sqliteTable('labels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  organizationId: text('organization_id'),
})

export const postLabels = sqliteTable('post_labels', {
  postId: integer('post_id').notNull().references(() => posts.id),
  labelId: integer('label_id').notNull().references(() => labels.id),
}, t => [primaryKey({ columns: [t.postId, t.labelId] })])

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  body: text('body').notNull(),
})

export const docs = sqliteTable('docs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
})

export const usersRelations = relations(users, ({ many }) => ({ posts: many(posts) }))
export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.userId], references: [users.id] }),
  postLabels: many(postLabels),
}))
export const postLabelsRelations = relations(postLabels, ({ one }) => ({
  post: one(posts, { fields: [postLabels.postId], references: [posts.id] }),
  label: one(labels, { fields: [postLabels.labelId], references: [labels.id] }),
}))
