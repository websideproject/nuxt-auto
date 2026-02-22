import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: [
    './server/database/schema.ts',
    './modules/blog/schema.ts',
    './modules/api-tokens/schema.ts',
  ],
  out: './server/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: '.data/db.sqlite',
  },
})
