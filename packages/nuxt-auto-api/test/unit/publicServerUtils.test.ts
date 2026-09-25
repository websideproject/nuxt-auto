import { describe, it, expect } from 'vitest'
import * as publicUtils from '../../src/runtime/server/utils.public'
import { PUBLIC_SERVER_UTILS } from '../../src/runtime/server/publicServerUtils'

describe('server auto-imports', () => {
  it('are exactly the runtime exports of @websideproject/nuxt-auto-api/utils', () => {
    expect([...PUBLIC_SERVER_UTILS].sort()).toEqual(Object.keys(publicUtils).sort())
  })
})
