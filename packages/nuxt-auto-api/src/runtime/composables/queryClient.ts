import { QueryClient } from '@tanstack/vue-query'

/**
 * Create default query client for Auto API
 */
export function createAutoApiQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
        refetchOnWindowFocus: false,
        retry: 1
      },
      mutations: {
        retry: 0
      }
    }
  })
}
