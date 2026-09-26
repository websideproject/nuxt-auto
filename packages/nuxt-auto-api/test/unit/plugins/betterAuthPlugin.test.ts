import { describe, it, expect } from 'vitest'
import { createBetterAuthPlugin } from '../../../src/runtime/plugins/betterAuthPlugin'

/** Run the plugin's context extender against a context, the way the pipeline does. */
async function run(plugin: ReturnType<typeof createBetterAuthPlugin>, eventContext: Record<string, any>, ctx: Record<string, any> = {}) {
  let extender: any
  await plugin.runtimeSetup!({
    extendContext: (fn: any) => { extender = fn },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  } as any)
  const context: any = { user: null, permissions: [], event: { context: eventContext, headers: new Headers() }, ...ctx }
  await extender(context)
  return context
}

const session = { session: { activeOrganizationId: 'org_1' }, user: { id: 'u1', email: 'a@b.c', role: 'editor', permissions: ['posts:write'] } }

describe('createBetterAuthPlugin', () => {
  it('maps a session by default: user, roles, permissions and the ACTIVE org from the session', async () => {
    const ctx = await run(createBetterAuthPlugin({ getSession: async () => session }), {})
    expect(ctx.user).toMatchObject({ id: 'u1', email: 'a@b.c', roles: ['editor'], organizationId: 'org_1' })
    expect(ctx.permissions).toEqual(['posts:write'])
  })

  it('reads event.context.user / .session when no getSession is given', async () => {
    const ctx = await run(createBetterAuthPlugin(), { user: session.user, session: session.session })
    expect(ctx.user.organizationId).toBe('org_1')
  })

  it('passes the session to mapUser and getPermissions (the active org lives on the session)', async () => {
    const ctx = await run(createBetterAuthPlugin({
      getSession: async () => session,
      mapUser: (u, s) => ({ id: u.id, organizationId: s.activeOrganizationId }) as any,
      getPermissions: (u, s) => [`${u.role}@${s.activeOrganizationId}`],
    }), {})
    expect(ctx.user).toEqual({ id: 'u1', organizationId: 'org_1' })
    expect(ctx.permissions).toEqual(['editor@org_1'])
  })

  it('leaves an anonymous request anonymous, and never overrides a user another plugin set', async () => {
    expect((await run(createBetterAuthPlugin({ getSession: async () => null }), {})).user).toBeNull()
    const existing = { id: 'token-user' }
    const ctx = await run(createBetterAuthPlugin({ getSession: async () => session }), {}, { user: existing })
    expect(ctx.user).toBe(existing)
  })
})
