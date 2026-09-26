import { describe, it, expect } from 'vitest'
import { generateVirtualModule } from '../../src/module'
import { createModuleImport } from '../../src/utils/moduleImport'

// The registry is generated as code at build time, so anything that is not an import reference (a function, a
// Zod schema) cannot be carried into it. Each such case must fail the build — silently dropping it would leave a
// resource without its hooks, its rules or its validation.
describe('generated resource registry', () => {
  const schema = createModuleImport('/app/schema.ts', 'posts')

  it('imports every part given as createModuleImport()', () => {
    const code = generateVirtualModule([{
      name: 'posts',
      schema,
      authorization: createModuleImport('/app/auth.ts', 'postsAuth'),
      validation: createModuleImport('/app/validation.ts', 'postsValidation'),
      hooks: createModuleImport('/app/hooks.ts', 'postsHooks'),
      protectedFields: ['authorId'],
    } as any])
    expect(code).toContain(`import { postsAuth as resource0Auth } from '/app/auth.ts'`)
    expect(code).toContain(`import { postsValidation as resource0Validation } from '/app/validation.ts'`)
    expect(code).toContain(`import { postsHooks as resource0Hooks } from '/app/hooks.ts'`)
    expect(code).toContain(`protectedFields: ["authorId"]`)
  })

  it.each([
    ['schema', { schema: {} }],
    ['authorization', { schema, authorization: { permissions: { read: true } } }],
    ['validation', { schema, validation: { create: {} } }],
    ['hooks', { schema, hooks: { beforeCreate: () => {} } }],
  ])('refuses an inline %s', (part, reg) => {
    expect(() => generateVirtualModule([{ name: 'posts', ...reg } as any]))
      .toThrow(`Resource "posts" ${part} must use createModuleImport()`)
  })
})
