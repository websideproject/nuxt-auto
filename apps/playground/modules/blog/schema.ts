import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { users } from '../../server/database/schema.ts'

/**
 * Articles table for blog module
 */
export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
  slug: text('slug').notNull().unique(),
  published: integer('published', { mode: 'boolean' }).default(false),
  authorId: integer('author_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

/**
 * Categories table - for organizing articles
 */
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

/**
 * Tags table - for tagging articles
 */
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

/**
 * Article-Category junction table
 * ✅ Supports both camelCase and snake_case naming
 * ✅ Composite primary key (no standalone id)
 * ✅ Cascade deletes to clean up orphaned records
 *
 * This example uses snake_case (common for third-party systems)
 * camelCase (articleCategories) also works!
 */
export const articleCategories = sqliteTable('article_categories', {
  articleId: integer('article_id')
    .notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  // Optional metadata column (still auto-detected as junction)
  // sortOrder: integer('sort_order').default(0),
}, (table) => ({
  // Composite primary key - required for auto-detection
  pk: primaryKey({ columns: [table.articleId, table.categoryId] })
}))

/**
 * Article-Tag junction table
 * ✅ Supports both camelCase and snake_case naming
 * ✅ Composite primary key (no standalone id)
 * ✅ Cascade deletes to clean up orphaned records
 *
 * This example uses snake_case (common for third-party systems)
 * camelCase (articleTags) also works!
 */
export const articleTags = sqliteTable('article_tags', {
  articleId: integer('article_id')
    .notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  // Composite primary key - required for auto-detection
  pk: primaryKey({ columns: [table.articleId, table.tagId] })
}))

/**
 * Relations
 */
export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
  articleCategories: many(articleCategories),
  articleTags: many(articleTags),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
  articleCategories: many(articleCategories),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  articleTags: many(articleTags),
}))

export const articleCategoriesRelations = relations(articleCategories, ({ one }) => ({
  article: one(articles, {
    fields: [articleCategories.articleId],
    references: [articles.id],
  }),
  category: one(categories, {
    fields: [articleCategories.categoryId],
    references: [categories.id],
  }),
}))

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, {
    fields: [articleTags.articleId],
    references: [articles.id],
  }),
  tag: one(tags, {
    fields: [articleTags.tagId],
    references: [tags.id],
  }),
}))
