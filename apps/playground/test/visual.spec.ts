import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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
 * in one test would change the pictures of the next — each test checks that the server accepted none.
 *
 * A shot's `act` steps are what a user does before the picture (open a menu, run a query), written with the same
 * locators a person would use, so they double as a script for recording the demo.
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
  /**
   * What a user does before the picture: open a menu or a dialog, run a query. Each step waits for what it
   * produced, so the picture never races it. Steps may send requests the server refuses, never one it accepts.
   */
  act?: (page: Page) => Promise<void>
  /** Photograph one part of the page instead of the page: a README-sized picture of one feature. */
  crop?: (page: Page) => Locator
  /** A full-page picture unless false. An open dialog or menu is photographed at the viewport it floats in. */
  fullPage?: boolean
}

/** The card (UCard) holding a heading. */
const card = (page: Page, heading: string) =>
  page.locator('div.rounded-lg, div.rounded-xl').filter({ has: page.getByRole('heading', { name: heading, exact: true }) }).last()

// ─── nuxt-auto-admin ─────────────────────────────────────────────────────────────────────────────────────────
const openRowMenu = async (page: Page, row = 0) => {
  await page.getByRole('button', { name: 'Row actions' }).nth(row).click()
  await expect(page.getByRole('menuitem', { name: 'View' })).toBeVisible()
}
const selectRows = async (page: Page, count: number) => {
  const boxes = page.getByRole('checkbox', { name: 'Select row' })
  for (let i = 0; i < count; i++) await boxes.nth(i).click()
  await expect(page.getByTestId('admin-bulk-delete')).toContainText(`(${count})`)
}

const ADMIN_SHOTS: Shot[] = [
  { name: 'admin-dashboard', path: '/admin', role: 'admin', says: 'Manage comments' },
  { name: 'admin-list', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle' },
  {
    name: 'admin-list-search', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle',
    act: async (page) => {
      await page.getByRole('textbox', { name: 'Search' }).fill('Draft')
      await expect(page.getByText('Modern Design Systems')).toBeHidden()
    }
  },
  {
    name: 'admin-list-filters', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle', fullPage: false,
    act: async (page) => {
      await page.getByTestId('admin-filters').click()
      await expect(page.getByPlaceholder('Contains…').first()).toBeVisible()
    }
  },
  {
    name: 'admin-list-export', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle', fullPage: false,
    act: async (page) => {
      await page.getByTestId('admin-export').click()
      await expect(page.getByRole('menuitem', { name: 'CSV' })).toBeVisible()
    }
  },
  { name: 'admin-row-actions', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle', fullPage: false, act: page => openRowMenu(page) },
  {
    name: 'admin-view-modal', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle', fullPage: false,
    act: async (page) => {
      await openRowMenu(page)
      await page.getByRole('menuitem', { name: 'View' }).click()
      await expect(page.getByRole('dialog')).toContainText('getting-started-nuxt-4')
    }
  },
  {
    name: 'admin-delete-confirm', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle', fullPage: false,
    act: async (page) => {
      await openRowMenu(page)
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await expect(page.getByRole('dialog')).toContainText('Confirm Delete')
    }
  },
  { name: 'admin-list-selection', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle', act: page => selectRows(page, 2) },
  {
    name: 'admin-bulk-delete', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle', fullPage: false,
    act: async (page) => {
      await selectRows(page, 2)
      await page.getByTestId('admin-bulk-delete').click()
      await expect(page.getByTestId('admin-bulk-delete-confirm')).toContainText('Delete 2')
    }
  },
  {
    name: 'admin-import', path: '/admin/articles', role: 'admin', says: 'Building Type-Safe APIs with Drizzle', fullPage: false,
    act: async (page) => {
      await page.getByTestId('admin-import').click()
      await expect(page.getByRole('dialog')).toBeVisible()
    }
  },
  // A regular user: drafts are hidden, Create is disabled, and the row menu offers nothing the API would refuse
  {
    name: 'admin-list-user', path: '/admin/articles', role: 'user', says: 'Building Type-Safe APIs with Drizzle', fullPage: false,
    act: page => openRowMenu(page)
  },
  { name: 'admin-detail', path: '/admin/articles/1', role: 'admin', says: 'getting-started-nuxt-4' },
  { name: 'admin-create', path: '/admin/articles/new', role: 'admin', says: 'Author Id' },
  { name: 'admin-edit', path: '/admin/articles/1/edit', role: 'admin', says: 'TypeScript, Nuxt' }
]

// ─── nuxt-auto-api, through the playground's pages ──────────────────────────────────────────────────────────
const API_SHOTS: Shot[] = [
  { name: 'app-posts-list', path: '/posts', role: 'admin', says: 'Post 20' },
  { name: 'app-post-detail', path: '/posts/1', role: 'admin', says: 'Great post!' },
  // Object-level authorization as a regular user: other people's posts are locked. The page is long, the top
  // of it makes the point.
  { name: 'app-posts-permissions', path: '/demo/posts', role: 'user', says: 'Only the owner or an admin can edit it', fullPage: false },
  // What one role may do on each resource, from GET /api/permissions
  { name: 'api-permission-matrix', path: '/demo', role: 'user', says: 'categories', crop: page => card(page, 'Permission Matrix') },
  // Role-based: a regular user reads published articles only, and cannot create, edit or delete
  { name: 'api-role-based', path: '/demo/articles', role: 'user', says: 'Modern Design Systems' },
  // Field-level: email is sent to admins, and to anyone else on their own record only
  { name: 'api-field-level', path: '/demo/users', role: 'user', says: 'user@playground.test' },
  // hiddenFields: password and apiKey exist on the table and never leave the API
  { name: 'api-hidden-fields', path: '/demo/hidden-fields', role: 'admin', says: 'Filtered from all responses', crop: page => card(page, 'Single User') },
  {
    name: 'api-nested-relations', path: '/demo/nested-relations', role: 'admin', says: 'Interactive Query Builder',
    crop: page => card(page, 'Interactive Query Builder'),
    act: async (page) => {
      const builder = card(page, 'Interactive Query Builder')
      await builder.getByRole('spinbutton').fill('2')
      await expect(builder).toContainText('limit=2')
      await builder.getByRole('button', { name: 'Run Query' }).click()
      await expect(builder).toContainText('"author"')
    }
  },
  {
    name: 'api-aggregations', path: '/demo/aggregations', role: 'admin', says: 'Total Posts',
    crop: page => card(page, 'Interactive Aggregation Builder'),
    act: async (page) => {
      await expect(page.getByText('User 3')).toBeVisible()
      const builder = card(page, 'Interactive Aggregation Builder')
      await builder.getByRole('button', { name: 'sum', exact: true }).click()
      await builder.getByRole('button', { name: 'Published', exact: true }).click()
      await builder.getByRole('button', { name: 'Execute Query' }).click()
      await expect(builder).toContainText('sum_id')
    }
  },
  {
    name: 'api-bulk-operations', path: '/demo/bulk-operations', role: 'admin', says: 'Post 20',
    crop: page => card(page, 'Bulk Delete'),
    act: async (page) => {
      const bulkDelete = card(page, 'Bulk Delete')
      for (const title of ['Post 7', 'Post 8', 'Post 9']) await bulkDelete.getByRole('checkbox', { name: `Select for delete: ${title}` }).click()
      await expect(bulkDelete).toContainText('Delete Selected (3)')
    }
  },
  {
    name: 'api-hooks', path: '/demo/hooks', role: 'admin', says: 'Hook Activity Feed',
    act: async (page) => {
      await page.getByRole('button', { name: 'Fetch Posts' }).click()
      await expect(card(page, 'Hook Activity Feed')).not.toContainText('No events yet')
    }
  },
  // Scoped API tokens: the editor token may read articles, and nothing it holds no scope for. (POST is left out:
  // the editor token may create articles, so that test would write.)
  {
    name: 'api-token-scopes', path: '/demo/api-tokens', role: 'admin', says: 'Scope Enforcement Demo',
    crop: page => card(page, 'Scope Enforcement Demo'),
    act: async (page) => {
      const scopes = card(page, 'Scope Enforcement Demo')
      for (const i of [0, 2, 3, 4]) await scopes.getByRole('button', { name: 'Test', exact: true }).nth(i).click()
      await expect(scopes.getByText(/^(Allowed|Denied)$/)).toHaveCount(4)
    }
  }
]

const SHOTS = [...ADMIN_SHOTS, ...API_SHOTS]

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

        // A write the server refuses changes nothing; one it accepts would change the pictures that follow
        const writes: string[] = []
        page.on('response', (r) => {
          const method = r.request().method()
          if (method !== 'GET' && method !== 'HEAD' && r.status() < 400) writes.push(`${method} ${r.url()} → ${r.status()}`)
        })
        const mismatches: string[] = []
        page.on('console', (m) => {
          if (/hydration/i.test(m.text())) mismatches.push(m.text())
        })

        await page.goto(shot.path, { waitUntil: 'networkidle' })
        await expect(page.locator('body')).toContainText(shot.says)
        if (shot.act) {
          await shot.act(page)
          // No hover left on the last button clicked; and a click far down scrolled the window, which a full-page
          // picture would show as the sticky header drawn halfway down the page
          await page.mouse.move(0, 0)
          if (!shot.crop && shot.fullPage !== false) await page.evaluate(() => window.scrollTo(0, 0))
        }
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
        if (shot.crop) {
          // A crop taller than the viewport is captured while scrolled, with the sticky header drawn over its top.
          // (The screenshot's own `style` option does not reach it there, so the page itself is changed.)
          await page.addStyleTag({ content: 'header { position: static !important; }' })
          await expect(shot.crop(page)).toHaveScreenshot(`${image}.png`)
        } else {
          await expect(page).toHaveScreenshot(`${image}.png`, { fullPage: shot.fullPage ?? true })
        }
      })
    }
  })
}
