import { sql } from 'drizzle-orm'

/**
 * Insert a revision row for the given operation if the `revisions` table is in the schema.
 * No-op (safe) when module-auto-revision is not installed. Shared by the restore handler and the
 * batch restore/purge utilities so all recovery paths record history identically.
 */
export async function recordRevisionIfPresent(
  context: any,
  resource: string,
  recordId: string | number,
  operation: string,
  data: any,
  reason?: string,
): Promise<void> {
  const rev = context.schema?.revisions
  if (!rev || !data) return
  try {
    await context.db.insert(rev).values({
      resource,
      recordId: String(recordId),
      operation,
      data,
      reason: reason ?? null,
      userId: context.user?.id ? String(context.user.id) : null,
      organizationId: (context.user as any)?.organizationId ?? null,
      authMethod: (context as any).authMethod ?? null,
      version: sql`(SELECT COALESCE(MAX(${rev.version}),0)+1 FROM ${rev}
                    WHERE ${rev.resource}=${resource} AND ${rev.recordId}=${String(recordId)})`,
    })
  }
  catch (err) {
    console.error('[autoApi:revision] Failed to record revision:', err)
  }
}
