/**
 * Query key factory for TanStack Query
 * Provides consistent query key structure across all composables
 */

import type { ListQueryParams } from './useAutoApiQuery'
import type { M2MListQuery } from '../types'

export const autoApiKeys = {
  /**
   * All queries
   */
  all: ['autoapi'] as const,

  /**
   * All queries for a resource
   */
  resource: (resource: string) => ['autoapi', resource] as const,

  /**
   * List queries for a resource
   */
  lists: (resource: string) => [...autoApiKeys.resource(resource), 'list'] as const,
  list: (resource: string, params?: ListQueryParams) =>
    [...autoApiKeys.lists(resource), params] as const,

  /**
   * Get queries for a resource
   */
  gets: (resource: string) => [...autoApiKeys.resource(resource), 'get'] as const,
  get: (resource: string, id: string | number, params?: Pick<ListQueryParams, 'include' | 'fields'>) =>
    [...autoApiKeys.gets(resource), id, params] as const,

  /**
   * Infinite scroll queries for a resource
   */
  infinites: (resource: string) => [...autoApiKeys.resource(resource), 'infinite'] as const,
  infinite: (resource: string, params?: Omit<ListQueryParams, 'cursor'>) =>
    [...autoApiKeys.infinites(resource), params] as const,

  /**
   * Aggregate queries for a resource
   */
  aggregates: (resource: string) => [...autoApiKeys.resource(resource), 'aggregate'] as const,
  aggregate: (resource: string, params?: any) =>
    [...autoApiKeys.aggregates(resource), params] as const,

  /**
   * M2M relation queries
   */
  m2m: (resource: string, id: string | number) =>
    [...autoApiKeys.resource(resource), id, 'm2m'] as const,

  m2mRelation: (resource: string, id: string | number, relation: string, params?: M2MListQuery) =>
    [...autoApiKeys.m2m(resource, id), relation, params] as const,

  /**
   * Permissions queries
   */
  permissions: (resource: string) => [...autoApiKeys.resource(resource), 'permissions'] as const,
  allPermissions: () => ['autoapi', 'permissions'] as const,
}
