// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // Rules for formatting
    stylistic: true,
  },
  dirs: {
    src: [
      './apps',
      './packages',
    ],
  },
})
  .append({
    rules: {
      // Schema-driven: the runtime handles arbitrary user Drizzle tables, rows and hook payloads, so `any` is
      // frequently the honest type at those boundaries. Public API types are written out explicitly instead.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  })
