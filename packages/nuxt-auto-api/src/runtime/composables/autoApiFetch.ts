import { useRequestFetch } from '#app'

/**
 * The fetch the auto-api composables use. During SSR it is Nuxt's `useRequestFetch()`, which forwards the
 * incoming request's headers (cookies, authorization) — a plain `$fetch` would call the API anonymously and a
 * protected resource would answer 401. On the client it is `$fetch`. Call it during setup.
 */
export function useAutoApiFetch(): typeof $fetch {
  try {
    return useRequestFetch() as typeof $fetch
  }
  catch {
    // outside a Nuxt context (unit tests)
    return $fetch
  }
}
