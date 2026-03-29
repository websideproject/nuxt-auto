# Hooks & Plugins

## Resource Hooks

Lifecycle hooks fire around every CRUD operation. Register via `autoApi.hooks` config or inside a plugin.

```ts
interface ResourceHooks {
  // Create
  beforeCreate?: (data: any, ctx: HandlerContext) => Promise<any> | any
  afterCreate?:  (result: any, ctx: HandlerContext) => Promise<any> | any

  // Update
  beforeUpdate?: (id: string|number, data: any, ctx: HandlerContext) => Promise<any> | any
  afterUpdate?:  (result: any, ctx: HandlerContext) => Promise<any> | any

  // Delete
  beforeDelete?: (id: string|number, ctx: HandlerContext) => Promise<void> | void
  afterDelete?:  (id: string|number, ctx: HandlerContext) => Promise<void> | void

  // List
  beforeList?: (ctx: HandlerContext) => Promise<void> | void
  afterList?:  (results: any[], ctx: HandlerContext) => Promise<any[]|void> | any[]|void

  // Get
  beforeGet?: (id: string|number, ctx: HandlerContext) => Promise<void> | void
  afterGet?:  (result: any, ctx: HandlerContext) => Promise<any> | any

  // M2M
  beforeM2MSync?:   (relation: string, ids: any[], ctx: HandlerContext) => Promise<any>|any
  afterM2MSync?:    (relation: string, result: any, ctx: HandlerContext) => Promise<void>|void
  beforeM2MAdd?:    (relation: string, ids: any[], ctx: HandlerContext) => Promise<any>|any
  afterM2MAdd?:     (relation: string, result: any, ctx: HandlerContext) => Promise<void>|void
  beforeM2MRemove?: (relation: string, ids: any[], ctx: HandlerContext) => Promise<void>|void
  afterM2MRemove?:  (relation: string, result: any, ctx: HandlerContext) => Promise<void>|void
}
```

**Return values from `after*` hooks modify the response** sent to the client.
**Return values from `before*` hooks modify the data** passed to the operation (except void hooks).

### Static hook registration (nuxt.config.ts)

```ts
autoApi: {
  hooks: {
    posts: {
      beforeCreate: async (data, ctx) => {
        data.authorId = ctx.user!.id
        data.slug = generateSlug(data.title)
        return data
      },
      afterCreate: async (result, ctx) => {
        await sendNotification(result.id)
        return result
      },
      beforeDelete: async (id, ctx) => {
        await cleanupPostAssets(id)
      },
    },
  },
}
```

### Via module registration

```ts
registry.register('posts', {
  schema: ...,
  hooks: createModuleImport(resolver.resolve('./hooks'), 'postsHooks'),
})
```

---

## Plugin System

Plugins can add middleware, hooks, and context extensions at **runtime**. They can also register Nuxt server handlers and imports at **build time**.

### `defineAutoApiPlugin`

```ts
import { defineAutoApiPlugin } from '@websideproject/nuxt-auto-api'

const MyPlugin = defineAutoApiPlugin({
  name: 'my-plugin',
  version: '1.0.0',

  // Build-time: add server handlers, imports, templates
  buildSetup?: async (ctx: PluginBuildContext) => {
    ctx.addServerHandler({ route: '/api/custom', handler: ... })
    ctx.addImportsDir(resolver.resolve('./composables'))
    ctx.logger.info('Plugin registered')
  },

  // Runtime: add middleware, hooks, context extensions
  runtimeSetup?: async (ctx: PluginRuntimeContext) => {
    // Add middleware for specific resources/operations
    ctx.addMiddleware({
      name: 'my-middleware',
      order?: 10,
      stage: 'post-auth',   // 'pre-auth' | 'post-auth' | 'pre-execute' | 'post-execute'
      resources?: ['posts', 'comments'],   // omit = all resources
      operations?: ['create', 'update'],   // omit = all operations
      handler: async (handlerCtx) => {
        // Mutate handlerCtx, add additionalFilters, short-circuit, etc.
        handlerCtx.additionalFilters?.push(eq(table.active, true))
      },
    })

    // Add hooks for a specific resource
    ctx.addHook('posts', {
      afterCreate: async (result, ctx) => { ... },
    })

    // Add hooks for all resources
    ctx.addGlobalHook({
      beforeCreate: async (data, ctx) => {
        data.createdAt = new Date()
        return data
      },
    })

    // Extend HandlerContext with custom data
    ctx.extendContext(async (handlerCtx) => {
      const featureFlags = await getFeatureFlags(handlerCtx.event)
      handlerCtx.requestMeta = { ...handlerCtx.requestMeta, featureFlags }
    })
  },
})
```

### Register in config

```ts
autoApi: {
  plugins: [MyPlugin],
  // or plugin directory:
  // plugins: './server/plugins/auto-api',
}
```

---

## Middleware Stages

| Stage | When it runs |
|-------|-------------|
| `pre-auth` | Before authorization checks |
| `post-auth` | After authorization, before DB operation |
| `pre-execute` | Just before the DB query |
| `post-execute` | After DB query, before response |

---

## Short-Circuiting

From a middleware handler, set `ctx.shortCircuit` to skip the remaining pipeline and return a custom response:

```ts
handler: async (ctx) => {
  const cached = await cache.get(ctx.resource + ctx.params.id)
  if (cached) {
    ctx.shortCircuit = { data: cached, status: 200 }
  }
}
```

---

## PluginBuildContext

```ts
interface PluginBuildContext {
  addServerHandler: (handler: any) => void
  addServerImportsDir: (dir: string) => void
  addImportsDir: (dir: string) => void
  addServerPlugin: (plugin: string) => void
  addPlugin: (plugin: any) => void
  addTemplate: (template: any) => void
  options: AutoApiOptions
  nuxt: Nuxt
  resolver: Resolver
  logger: PluginLogger
}
```

## PluginRuntimeContext

```ts
interface PluginRuntimeContext {
  addMiddleware: (middleware: AutoApiMiddleware) => void
  addHook: (resource: string, hooks: ResourceHooks) => void
  addGlobalHook: (hooks: ResourceHooks) => void
  extendContext: (fn: (ctx: HandlerContext) => void|Promise<void>) => void
  runtimeConfig: any
  logger: PluginLogger
}
```
