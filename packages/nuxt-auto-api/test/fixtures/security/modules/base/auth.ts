import { eq } from 'drizzle-orm'

export const usersAuth = { permissions: { read: 'users:read' } }
// read + update only; create / delete are simply not declared.
export const postsAuth = { permissions: { read: true, update: 'posts:update' } }
export const labelsAuth = { permissions: { read: 'labels:read' } }
// Row visibility through listFilter only (no objectLevel) — must also apply to GET/PATCH/DELETE by id.
export const docsAuth = {
  permissions: { read: true, update: true },
  listFilter: (t: any) => eq(t.published, true),
}
