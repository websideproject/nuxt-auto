/**
 * Row types for the client composables.
 *
 * With `autoApi.typedRows: true` the module fills this interface with one entry per registered resource, so
 * `useAutoApiList('posts')` returns typed rows with no type argument. Without it the interface is empty and rows are
 * `any`, as before. It is global so the generated declaration merges with it wherever the composables are imported
 * from.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AutoApiResourceRows {}
}

/** A value as it arrives over JSON: dates are ISO strings. */
export type AutoApiWire<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Array<AutoApiWire<U>>
    : T extends object
      ? { [K in keyof T]: AutoApiWire<T[K]> }
      : T

/** The row a resource's routes return: the table's select model as JSON, without the resource's hidden fields. */
export type AutoApiRow<TTable, THidden extends string = never> = TTable extends { $inferSelect: infer TRow }
  ? Omit<AutoApiWire<TRow>, THidden>
  : any

/**
 * The row type a composable returns: the explicit type argument when one is given, else the registered resource's
 * row (`autoApi.typedRows`), else `any`.
 */
export type AutoApiRowOf<T, R extends string> = [T] extends [never]
  ? (R extends keyof AutoApiResourceRows ? AutoApiResourceRows[R] : any)
  : T
