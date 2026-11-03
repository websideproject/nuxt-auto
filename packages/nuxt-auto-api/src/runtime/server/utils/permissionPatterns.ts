/**
 * Whether a pattern covers a permission string: `*`, the string itself, `<resource>:*` or `*:<capability>`. Strings
 * without a `:` (role-style, `admin`) are covered only by `*` or themselves.
 *
 * The same rule matches a token's scope against a permission (`scopeCovers`) and a held pattern against a declared
 * permission (`evaluatePermission`). Pure, no Nitro imports.
 */
export function patternCovers(pattern: string, permission: string): boolean {
  if (pattern === '*' || pattern === permission) return true
  const i = permission.indexOf(':')
  if (i < 0) return false
  return pattern === `${permission.slice(0, i)}:*` || pattern === `*:${permission.slice(i + 1)}`
}

/**
 * Whether `held` grants `permission`: the string itself, or a held pattern (`posts:*`, `*:read`) that covers it.
 * `*` on its own is left to the caller, which decides where the super-admin wildcard applies.
 */
export function holdsPermission(held: readonly string[], permission: string): boolean {
  if (held.includes(permission)) return true
  return held.some(h => h !== '*' && h.includes('*') && patternCovers(h, permission))
}
