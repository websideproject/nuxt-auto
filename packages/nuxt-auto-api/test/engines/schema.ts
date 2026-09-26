import { relations } from 'drizzle-orm'
import * as s from 'drizzle-orm/sqlite-core'
import * as p from 'drizzle-orm/pg-core'
import * as m from 'drizzle-orm/mysql-core'

export type Dialect = 'sqlite' | 'pg' | 'mysql'

/**
 * One schema, built for each dialect, covering what differs between engines: auto-increment and text primary
 * keys, soft delete with a cascade (`tasks`) and a `set null` child (`notes`), a unique column (`tags.name`, so
 * a batch can fail inside the database), a junction with metadata (`projectTags`) and relations for `?include=`.
 */
export function buildSchema(dialect: Dialect) {
  const b = builders(dialect)
  const softDelete = () => ({
    deletedAt: b.timestamp('deleted_at'),
    deletedBy: b.text('deleted_by'),
    deletionId: b.text('deletion_id'),
    deletedReason: b.text('deleted_reason'),
  })

  const projects = b.table('projects', {
    id: b.pk(),
    name: b.text('name').notNull(),
    organizationId: b.text('organization_id'),
    updatedAt: b.timestamp('updated_at'),
    ...softDelete(),
  })
  const tasks = b.table('tasks', {
    id: b.pk(),
    projectId: b.int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    title: b.text('title').notNull(),
    done: b.bool('done').notNull().default(false),
    ...softDelete(),
  })
  const notes = b.table('notes', {
    id: b.pk(),
    projectId: b.int('project_id').references(() => projects.id, { onDelete: 'set null' }),
    body: b.text('body').notNull(),
  })
  const tags = b.table('tags', {
    id: b.pk(),
    name: b.text('name').notNull().unique(),
  })
  const projectTags = b.table('project_tags', {
    projectId: b.int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    tagId: b.int('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
    role: b.text('role'),
  }, (t: any) => [b.primaryKey({ columns: [t.projectId, t.tagId] })])
  const revisions = b.table('revisions', {
    id: b.pk(),
    resource: b.text('resource').notNull(),
    recordId: b.text('record_id').notNull(),
    version: b.int('version').notNull(),
    operation: b.text('operation').notNull(),
    data: b.json('data'),
    userId: b.text('user_id'),
    organizationId: b.text('organization_id'),
    authMethod: b.text('auth_method'),
    reason: b.text('reason'),
  })
  const docs = b.table('docs', {
    id: b.text('id').primaryKey(),
    title: b.text('title').notNull(),
  })

  const projectsRelations = relations(projects, ({ many }) => ({ tasks: many(tasks), projectTags: many(projectTags) }))
  const tasksRelations = relations(tasks, ({ one }) => ({ project: one(projects, { fields: [tasks.projectId], references: [projects.id] }) }))
  const projectTagsRelations = relations(projectTags, ({ one }) => ({
    project: one(projects, { fields: [projectTags.projectId], references: [projects.id] }),
    tag: one(tags, { fields: [projectTags.tagId], references: [tags.id] }),
  }))
  const tagsRelations = relations(tags, ({ many }) => ({ projectTags: many(projectTags) }))

  return {
    /** Registered resources (the junction is deliberately not one). */
    resources: { projects, tasks, notes, tags, docs, revisions },
    /** Everything Drizzle needs, relations included. */
    full: { projects, tasks, notes, tags, projectTags, docs, revisions, projectsRelations, tasksRelations, projectTagsRelations, tagsRelations },
    /** Children before parents — the order rows are cleared in. */
    tables: [projectTags, tasks, notes, docs, tags, projects, revisions],
  }
}

function builders(dialect: Dialect): Record<string, any> {
  if (dialect === 'sqlite') {
    return {
      table: s.sqliteTable,
      primaryKey: s.primaryKey,
      pk: () => s.integer('id').primaryKey({ autoIncrement: true }),
      int: (n: string) => s.integer(n),
      text: (n: string) => s.text(n),
      bool: (n: string) => s.integer(n, { mode: 'boolean' }),
      timestamp: (n: string) => s.integer(n, { mode: 'timestamp' }),
      json: (n: string) => s.text(n, { mode: 'json' }),
    }
  }
  if (dialect === 'pg') {
    return {
      table: p.pgTable,
      primaryKey: p.primaryKey,
      pk: () => p.serial('id').primaryKey(),
      int: (n: string) => p.integer(n),
      text: (n: string) => p.text(n),
      bool: (n: string) => p.boolean(n),
      timestamp: (n: string) => p.timestamp(n),
      json: (n: string) => p.jsonb(n),
    }
  }
  return {
    table: m.mysqlTable,
    primaryKey: m.primaryKey,
    pk: () => m.int('id').autoincrement().primaryKey(),
    int: (n: string) => m.int(n),
    // MySQL cannot index or key a TEXT column without a length
    text: (n: string) => m.varchar(n, { length: 191 }),
    bool: (n: string) => m.boolean(n),
    timestamp: (n: string) => m.datetime(n),
    json: (n: string) => m.json(n),
  }
}
