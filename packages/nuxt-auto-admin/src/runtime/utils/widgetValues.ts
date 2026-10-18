/** Pure helpers behind the form widgets. */

/** `'Hello, World!'` → `'hello-world'`: lowercase ASCII words joined by dashes (accents dropped). */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A tags value as an array: an array, a JSON array string, or a comma-separated string. */
export function toTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string' || !value.trim()) return []
  if (value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(String)
    }
    catch {
      // not JSON — read it as a list
    }
  }
  return value.split(',').map(t => t.trim()).filter(Boolean)
}

/** The text a JSON editor shows for a value: pretty-printed JSON (a string is shown as it is). */
export function jsonText(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

/** Parse a JSON editor's text: the value, `null` for empty text, or the parse error. */
export function parseJsonText(text: string): { value: unknown } | { error: string } {
  if (!text.trim()) return { value: null }
  try {
    return { value: JSON.parse(text) }
  }
  catch (error) {
    return { error: (error as Error).message }
  }
}

/** `'2mb'` / `'500kb'` / a byte count → bytes; `undefined` when not given or not understood. */
export function parseByteSize(size: unknown): number | undefined {
  if (typeof size === 'number') return size
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(String(size ?? '').trim())
  if (!match) return undefined
  const unit = (match[2] ?? 'b').toLowerCase()
  return Math.round(Number(match[1]) * ({ b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 } as Record<string, number>)[unit]!)
}

const TOOLBAR_ITEMS: Record<string, Record<string, unknown>> = {
  bold: { kind: 'mark', mark: 'bold', icon: 'i-heroicons-bold' },
  italic: { kind: 'mark', mark: 'italic', icon: 'i-heroicons-italic' },
  underline: { kind: 'mark', mark: 'underline', icon: 'i-heroicons-underline' },
  strike: { kind: 'mark', mark: 'strike', icon: 'i-heroicons-strikethrough' },
  code: { kind: 'mark', mark: 'code', icon: 'i-heroicons-code-bracket' },
  heading1: { kind: 'heading', level: 1, icon: 'i-heroicons-h1' },
  heading2: { kind: 'heading', level: 2, icon: 'i-heroicons-h2' },
  heading3: { kind: 'heading', level: 3, icon: 'i-heroicons-h3' },
  bulletList: { kind: 'bulletList', icon: 'i-heroicons-list-bullet' },
  orderedList: { kind: 'orderedList', icon: 'i-heroicons-numbered-list' },
  blockquote: { kind: 'blockquote', icon: 'i-heroicons-chat-bubble-bottom-center-text' },
  codeBlock: { kind: 'codeBlock', icon: 'i-heroicons-code-bracket-square' },
  horizontalRule: { kind: 'horizontalRule', icon: 'i-heroicons-minus' },
  link: { kind: 'link', icon: 'i-heroicons-link' },
  undo: { kind: 'undo', icon: 'i-heroicons-arrow-uturn-left' },
  redo: { kind: 'redo', icon: 'i-heroicons-arrow-uturn-right' },
}

/** The default `toolbar` of the rich text and markdown editors; `'|'` starts a new group. */
export const DEFAULT_TOOLBAR = ['bold', 'italic', 'strike', 'code', '|', 'heading1', 'heading2', 'heading3', '|', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', '|', 'link', '|', 'undo', 'redo']

/** `toolbar` names → Nuxt UI `UEditorToolbar` item groups (unknown names are skipped). */
export function toolbarItems(names: string[] = DEFAULT_TOOLBAR): Array<Array<Record<string, unknown>>> {
  const groups: Array<Array<Record<string, unknown>>> = [[]]
  for (const name of names) {
    if (name === '|') groups.push([])
    else if (TOOLBAR_ITEMS[name]) groups[groups.length - 1]!.push({ ...TOOLBAR_ITEMS[name], tooltip: { text: name } })
  }
  return groups.filter(g => g.length)
}
