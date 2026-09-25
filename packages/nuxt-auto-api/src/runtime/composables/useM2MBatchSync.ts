import type { MaybeRef } from 'vue'
import type { M2MBatchSyncRequest, M2MBatchSyncResponse } from '../types'
import type { AutoApiMutationOptions } from './mutationHandlers'
import { useAutoApiM2MMutation } from './m2mMutation'

/**
 * Sync several relations of one record in a single request.
 *
 * @example
 * const { mutate } = useM2MBatchSync('posts', postId)
 * mutate({ relations: { tags: { ids: [1, 2] }, categories: { ids: [5] } } })
 */
export function useM2MBatchSync(
  resource: MaybeRef<string>,
  id: MaybeRef<string | number>,
  options?: AutoApiMutationOptions<M2MBatchSyncResponse, M2MBatchSyncRequest>,
) {
  return useAutoApiM2MMutation<M2MBatchSyncResponse, M2MBatchSyncRequest>({
    resource,
    id,
    method: 'POST',
    segments: () => ['batch'],
    affects: vars => Object.entries(vars.relations).map(([relation, { ids }]) => ({ relation, update: () => ids })),
    options,
  })
}
