import { unref } from 'vue'
import type { MaybeRef } from 'vue'
import type { M2MOperationResponse, M2MRemoveRequest } from '../types'
import type { AutoApiMutationOptions } from './mutationHandlers'
import { useAutoApiM2MMutation } from './m2mMutation'

/**
 * Unlink `ids` from the record.
 *
 * @example
 * const { mutate } = useM2MRemove('posts', postId, 'tags')
 * mutate({ ids: [1, 2] })
 */
export function useM2MRemove(
  resource: MaybeRef<string>,
  id: MaybeRef<string | number>,
  relation: MaybeRef<string>,
  options?: AutoApiMutationOptions<M2MOperationResponse, M2MRemoveRequest>,
) {
  const relationRef = () => unref(relation)
  return useAutoApiM2MMutation<M2MOperationResponse, M2MRemoveRequest>({
    resource,
    id,
    method: 'DELETE',
    segments: () => [relationRef(), 'remove'],
    affects: vars => [{ relation: relationRef(), update: ids => ids.filter(id => !vars.ids.map(String).includes(String(id))) }],
    options,
  })
}
