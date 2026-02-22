/**
 * Filter fields from relations based on enhanced include syntax
 *
 * @deprecated This function is now a no-op as field selection is handled by Drizzle via `columns` option in `buildNestedRelations`.
 * Kept for backward compatibility with existing calls.
 */
export function filterRelationFields(
  data: any,
  _relationsConfig?: Record<string, any>
): any {
  return data
}
