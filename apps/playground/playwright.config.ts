import { defineConfig, devices } from '@playwright/test'

// Screenshot suite for the playground (test/visual.spec.ts). How to run it and refresh the baselines:
// the Contributing section of the README, or the header of scripts/visual-baseline.sh.
export default defineConfig({
  testDir: './test',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',

  // The baselines ARE the docs' images: written straight into the Docus public directory, so the pictures the
  // docs show are always the ones CI compares against. No platform suffix — there is one set, taken on Linux in
  // the Playwright container (scripts/visual-baseline.sh), because macOS renders fonts differently.
  snapshotPathTemplate: '../docs/public/screenshots/{arg}{ext}',

  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      // Room for a browser nudging a glyph, not for a changed row of text.
      maxDiffPixels: 100
    }
  },

  use: {
    // Always localhost: in CI the server runs in the job container; locally visual-baseline.sh forwards the
    // container's localhost to the host, so the URL is the same everywhere.
    baseURL: 'http://localhost:3100',
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' }
  },

  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] }
  ],

  // CI serves the playground itself; locally visual-baseline.sh serves it on the host.
  webServer: process.env.CI
    ? { command: 'bun run preview:visual', url: 'http://localhost:3100', timeout: 60_000 }
    : undefined
})
