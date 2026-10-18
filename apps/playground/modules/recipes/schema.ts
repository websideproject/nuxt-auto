import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
// In an app: import { … } from '@websideproject/nuxt-auto-api/schema/sqlite'
import { id, timestamps, audit, softDelete } from '../../../../packages/nuxt-auto-api/src/runtime/schema/sqlite.ts'

/**
 * Notes — a table made of the schema presets: every column below except title and body comes from one, and each
 * turns a feature on by its name (docs: auto-api/schema-presets).
 */
const sd = softDelete()

export const notes = sqliteTable('notes', {
  ...id(), // id: UUID text key
  title: text('title').notNull(),
  body: text('body'),
  ...timestamps(), // createdAt, updatedAt (refreshed on every update)
  ...audit(), // createdBy, updatedBy — filled from the signed-in user by the audit-stamp plugin
  ...sd.columns // deletedAt, deletedBy, deletionId, deletedReason — DELETE moves a note to the trash
}, t => [...sd.indexes(t)])
