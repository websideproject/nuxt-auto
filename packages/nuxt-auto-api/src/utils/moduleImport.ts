/**
 * Helper to create a module import reference for virtual module generation
 *
 * @param modulePath - Absolute path to the module file
 * @param exportName - Named export to import (default: use default export)
 *
 * @example
 * ```ts
 * import { createModuleImport } from 'nuxt-auto-api/utils'
 *
 * createModuleImport('./schema', 'articles')
 * // Will generate: import { articles } from './schema'
 *
 * createModuleImport('./auth', 'articlesAuth')
 * // Will generate: import { articlesAuth } from './auth'
 * ```
 */
export function createModuleImport(modulePath: string, exportName?: string) {
  return {
    __modulePath: modulePath,
    __exportName: exportName,
    __isModuleImport: true,
  }
}

/**
 * Check if a value is a module import reference
 */
export function isModuleImport(value: any): value is { __modulePath: string; __exportName?: string; __isModuleImport: true } {
  return value && typeof value === 'object' && value.__isModuleImport === true
}
