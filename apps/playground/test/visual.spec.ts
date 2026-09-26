import { expect, test } from '@playwright/test'

/**
 * Screenshots of the playground, compared against committed baselines. The baselines are also the images the
 * docs show (apps/docs/public/screenshots/, see playwright.config.ts), so a page that changes fails here until
 * its picture is refreshed — the docs cannot quietly go stale.
 *
 * Nothing in a picture may depend on when or where it was taken:
 *   - data: `bun run db:visual` rebuilds .data/visual.sqlite from empty with the seed, whose timestamps are fixed;
 *   - clocks: the browser's is pinned below (the footer prints the year); the server runs with TZ=UTC;
 *   - locale, timezone, colour scheme, motion: pinned in playwright.config.ts.
 * So there is nothing left to mask. The suite also never writes: the database is built once per run, and a write
 * in one test would change the pictures of the next — each test checks that.
 *
 * Run and refresh: scripts/visual-baseline.sh.
 */

const FIXED_NOW = new Date('2026-02-01T12:00:00Z')

const VIEWPORTS = [
  { width: 1440, height: 900 }
  // Mobile is off for now: the suite guards what the pages do, and the admin has no mobile layout yet (at 375 px
  // the sidebar keeps its width). Turn it back on with a refresh: `bun run visual:baseline -- -375`.
  // { width: 375, height: 812 }
]

interface Shot {
  /** The image name, `<name>-<width>.png`, which is also the test title a refresh filters on. */
  name: string
  path: string
  /** The playground's demo session (server/plugins/auth.ts): a cookie holding the role. */
  role: 'admin' | 'editor' | 'user'
  /** Text the page shows only once its data has loaded: the picture is taken after it appears. */
  says: string
  fullPage?: boolean
}

const SHOTS: Shot[] = [
  // nuxt-auto-admin
  { name: 'admin-dashboard', path: '/admin', role: 'admin', says: 'Manage comments' },
  { name: 'admin-list', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle' },
  { name: 'admin-detail', path: '/admin/articles/1', role: 'admin', says: 'getting-started-nuxt-4' },
  { name: 'admin-edit', path: '/admin/articles/1/edit', role: 'admin', says: 'TypeScript, Nuxt' },
  // Playground pages built on the nuxt-auto-api composables
  { name: 'app-posts-list', path: '/posts', role: 'admin', says: 'Post 20' },
  { name: 'app-post-detail', path: '/posts/1', role: 'admin', says: 'Great post!' },
  // Object-level authorization as a regular user: other people's posts are locked. The page is long, the top
  // of it makes the point.
  { name: 'app-posts-permissions', path: '/demo/posts', role: 'user', says: 'Only the owner or an admin can edit it', fullPage: false }
]

// Fails the run up front when :3100 is not serving the visual database (the dev database, or none at all),
// instead of producing a full set of wrong pictures.
test.beforeAll(async ({ request }) => {
  const res = await request.get('/api/posts/1', { headers: { cookie: 'demo-session=admin' } })
  expect(res.ok(), `GET /api/posts/1 → ${res.status()}: is \`bun run preview:visual\` serving on :3100?`).toBe(true)
  const { data } = await res.json()
  expect(data.createdAt, 'not the seeded visual database: run `bun run db:visual` and restart the preview').toBe('2026-01-16T09:00:00.000Z')
})

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport })

    for (const shot of SHOTS) {
      const image = `${shot.name}-${viewport.width}`

      test(image, async ({ page, context, baseURL }) => {
        await context.addCookies([{ name: 'demo-session', value: shot.role, url: baseURL! }])
        await page.clock.setFixedTime(FIXED_NOW)

        const writes: string[] = []
        page.on('request', (r) => {
          if (r.method() !== 'GET' && r.method() !== 'HEAD') writes.push(`${r.method()} ${r.url()}`)
        })
        const mismatches: string[] = []
        page.on('console', (m) => {
          if (/hydration/i.test(m.text())) mismatches.push(m.text())
        })

        await page.goto(shot.path, { waitUntil: 'networkidle' })
        await expect(page.locator('body')).toContainText(shot.says)
        await page.evaluate(() => document.fonts.ready)

        expect(writes, 'the database is shared by the whole run, so a page must not write to it').toEqual([])
        // A mismatch leaves the server's HTML and the client's render mixed, differently on every run: a page that
        // SSRs a query must `await suspense()` so both render the same data.
        expect(mismatches, 'hydration mismatch').toEqual([])
        // A full-page shot widens the viewport to the scroll width, so a page that overflows horizontally reflows
        // at a width that depends on timing, and its picture differs from run to run.
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          'the page overflows the viewport horizontally'
        ).toBeLessThanOrEqual(viewport.width)
        await expect(page).toHaveScreenshot(`${image}.png`, { fullPage: shot.fullPage ?? true })
      })
    }
  })
}
