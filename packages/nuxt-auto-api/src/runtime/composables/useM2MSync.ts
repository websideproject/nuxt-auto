import { unref } from 'vue'
import type { MaybeRef } from 'vue'
import type { M2MOperationResponse, M2MSyncRequest } from '../types'
import type { AutoApiMutationOptions } from './mutationHandlers'
import { useAutoApiM2MMutation } from './m2mMutation'

/**
 * Make the record's linked set exactly `ids`.
 *
 * @example
 * const { mutate } = useM2MSync('posts', postId, 'tags')
 * mutate({ ids: [1, 2] })
 */
export function useM2MSync(
  resource: MaybeRef<string>,
  id: MaybeRef<string | number>,
  relation: MaybeRef<string>,
  options?: AutoApiMutationOptions<M2MOperationResponse, M2MSyncRequest>,
) {
  const relationRef = () => unref(relation)
  return useAutoApiM2MMutation<M2MOperationResponse, M2MSyncRequest>({
    resource,
    id,
    method: 'POST',
    segments: () => [relationRef()],
    affects: vars => [{ relation: relationRef(), update: () => vars.ids }],
    options,
  })
}
