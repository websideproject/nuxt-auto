/**
 * Rebuild the screenshot suite's database from empty: every migration, then the playground seed.
 * The pictures are only comparable if every run starts from the same rows, so the file is deleted first.
 * It is a separate file from the dev database (.data/db.sqlite), which is left alone.
 *
 *   bun run db:visual
 */
import { mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { useDB } from '../server/database/db'
import { seed } from '../server/database/seed'

const file = process.env.PLAYGROUND_DB ||= '.data/visual.sqlite'
rmSync(file, { force: true })
mkdirSync(dirname(file), { recursive: true })
migrate(useDB(), { migrationsFolder: 'server/database/migrations' })
await seed()
