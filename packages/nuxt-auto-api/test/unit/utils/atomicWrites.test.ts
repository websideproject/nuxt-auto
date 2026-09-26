import { afterEach, describe, it, expect } from 'vitest'
import { atomicWritesFor } from '../../../src/runtime/server/utils/atomicWrites'

describe('atomicWritesFor', () => {
  afterEach(() => {
    globalThis.__autoApiDbAdapter = undefined
  })

  const recorder = () => {
    const ran: string[] = []
    return { ran, db: { tag: 'mine' }, write: (name: string) => (db: any) => ran.push(`${name}@${db.tag}`) }
  }

  it('a hand-built context with only a db (a test, a script) runs the writes on that db', async () => {
    const { ran, db, write } = recorder()
    await atomicWritesFor({ db }, [write('a'), write('b')])
    expect(ran).toEqual(['a@mine', 'b@mine'])
  })

  it('never sends them to an initialized adapter over a different database', async () => {
    const { ran, db, write } = recorder()
    globalThis.__autoApiDbAdapter = { db: { tag: 'other' }, supportsTransactions: false, supportsNativeBatch: false } as any
    await atomicWritesFor({ db }, [write('a')])
    expect(ran).toEqual(['a@mine'])
  })

  it('uses the context\'s adapter — its transaction', async () => {
    const { ran, db, write } = recorder()
    const adapter = { db, supportsTransactions: true, atomic: async (fn: any) => fn({ tx: { tag: 'tx' } }) } as any
    await atomicWritesFor({ db, adapter }, [write('a')])
    expect(ran).toEqual(['a@tx'])
  })
})
