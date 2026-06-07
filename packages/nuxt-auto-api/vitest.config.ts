import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // `nitropack/runtime` pulls a nitro build-only virtual module (#nitro-internal-virtual/storage),
    // which crashes plain vitest on import. Alias it to a lightweight stub for unit/integration tests.
    // (Handlers/utils are imported directly here, not via a real nitro server, so the real module is
    // never needed.) See test/helpers/nitro-stub.ts.
    alias: {
      'nitropack/runtime': fileURLToPath(new URL('./test/helpers/nitro-stub.ts', import.meta.url)),
      // The auto-api registry is a build-time virtual module; tests stub it (empty by default →
      // safe-default permission resolution; set per-test via setRegistry()). See registry-stub.ts.
      '#nuxt-auto-api-registry': fileURLToPath(new URL('./test/helpers/registry-stub.ts', import.meta.url)),
    },
  },
})
