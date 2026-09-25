import { unref } from 'vue'
import type { MaybeRef } from 'vue'
import type { M2MOperationResponse, M2MAddRequest } from '../types'
import type { AutoApiMutationOptions } from './mutationHandlers'
import { useAutoApiM2MMutation } from './m2mMutation'

/**
 * Link `ids` to the record (already-linked ids are left alone).
 *
 * @example
 * const { mutate } = useM2MAdd('posts', postId, 'tags')
 * mutate({ ids: [1, 2] })
 */
export function useM2MAdd(
  resource: MaybeRef<string>,
  id: MaybeRef<string | number>,
  relation: MaybeRef<string>,
  options?: AutoApiMutationOptions<M2MOperationResponse, M2MAddRequest>,
) {
  const relationRef = () => unref(relation)
  return useAutoApiM2MMutation<M2MOperationResponse, M2MAddRequest>({
    resource,
    id,
    method: 'POST',
    segments: () => [relationRef(), 'add'],
    affects: vars => [{ relation: relationRef(), update: ids => [...ids, ...vars.ids.filter(id => !ids.map(String).includes(String(id)))] }],
    options,
  })
}
