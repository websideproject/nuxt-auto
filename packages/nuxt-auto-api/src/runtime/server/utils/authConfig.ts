import type { HandlerContext, ResourceAuthConfig } from '../../types'

function isPlainObject(v: any): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Merge one operation's permission value: string/array/boolean → override replaces; object (descriptor)
 * over object → merged per key (a key set to `null` deletes it). This is what lets an app override a
 * structured permission *as data* through `autoApi.authorization` in nuxt.config.
 */
function mergePermissionValue(base: any, override: any): any {
  if (override === undefined) return base
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, any> = { ...base }
    for (const [k, v] of Object.entries(override)) {
      if (v === null) Reflect.deleteProperty(out, k)
      else out[k] = v
    }
    return out
  }
  return override
}

function mergePermissionMap(base: Record<string, any> | undefined, override: Record<string, any> | undefined) {
  if (!override) return base
  const out: Record<string, any> = { ...base }
  for (const [op, val] of Object.entries(override)) out[op] = mergePermissionValue(base?.[op], val)
  return out
}

/**
 * Merge a nuxt.config `autoApi.authorization[resource]` override into the module's ResourceAuthConfig.
 *
 * nuxt.config values reach the server through `runtimeConfig`, which is serialized — so an override can only
 * carry data (booleans, permission strings, arrays, descriptor objects). Functions (`objectLevel`,
 * `listFilter`, permission functions) always come from the build-time import.
 */
export function mergeAuthConfig(
  base: ResourceAuthConfig | undefined,
  override: Record<string, any> | undefined,
): ResourceAuthConfig | undefined {
  if (!override) return base
  if (!base) return override as ResourceAuthConfig

  const merged: ResourceAuthConfig = { ...base }
  if (override.permissions) merged.permissions = mergePermissionMap(base.permissions as any, override.permissions) as any
  if (override.fields) {
    merged.fields = { ...base.fields }
    for (const [name, cfg] of Object.entries(override.fields as Record<string, any>)) {
      merged.fields[name] = mergePermissionMap(base.fields?.[name] as any, cfg) as any
    }
  }
  if (override.custom) {
    merged.custom = { ...base.custom }
    for (const [name, cfg] of Object.entries(override.custom as Record<string, any>)) {
      merged.custom[name] = {
        permissions: mergePermissionMap(base.custom?.[name]?.permissions as any, (cfg as any)?.permissions) as any,
      }
    }
  }
  merged.objectLevel = base.objectLevel
  merged.listFilter = base.listFilter
  return merged
}

/**
 * The effective authorization config for `resource` in this request: the module's declaration with the
 * app's nuxt.config override merged in. `undefined` means the resource declared nothing — which denies
 * every operation (see `evaluatePermission`).
 */
export function getAuthConfig(context: HandlerContext, resource: string = context.resource): ResourceAuthConfig | undefined {
  if (resource === context.resource && context.effectiveAuth) return context.effectiveAuth
  const declared = context.registry?.[resource]?.authorization
    ?? (resource === context.resource ? context.resourceConfig?.authorization : undefined)
  const override = (context.runtimeConfig as any)?.autoApi?.authorization?.[resource]
  return mergeAuthConfig(declared, override)
}
