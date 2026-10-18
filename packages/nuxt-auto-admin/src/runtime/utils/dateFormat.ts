/**
 * `DateTimePicker`'s `format` option: a pattern of `YYYY`, `MM`, `DD`, `HH` (24h), `mm`, `ss` and literal text —
 * `'DD/MM/YYYY'`, `'YYYY-MM-DD HH:mm'`. Values are in the browser's time zone, like the picker itself.
 */
type Token = 'YYYY' | 'MM' | 'DD' | 'HH' | 'mm' | 'ss'
const TOKEN_RE = /YYYY|MM|DD|HH|mm|ss/g

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** `date` written in `format`. */
export function formatDate(date: Date, format: string): string {
  const parts: Record<Token, string> = {
    YYYY: pad(date.getFullYear(), 4),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  }
  return format.replace(TOKEN_RE, token => parts[token as Token])
}

/** The date `text` spells in `format`, or `null` when it does not match or is not a real date (31/02). */
export function parseDate(text: string, format: string): Date | null {
  const order: Token[] = []
  const pattern = format.split(TOKEN_RE).map(literal => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const tokens = format.match(TOKEN_RE) ?? []
  let source = pattern[0]!
  tokens.forEach((token, i) => {
    order.push(token as Token)
    source += (token === 'YYYY' ? '(\\d{4})' : '(\\d{1,2})') + pattern[i + 1]
  })
  const match = new RegExp(`^${source}$`).exec(text.trim())
  if (!match) return null

  const value: Record<Token, number> = { YYYY: 1970, MM: 1, DD: 1, HH: 0, mm: 0, ss: 0 }
  order.forEach((token, i) => {
    value[token] = Number(match[i + 1])
  })
  const date = new Date(value.YYYY, value.MM - 1, value.DD, value.HH, value.mm, value.ss)
  const real = date.getFullYear() === value.YYYY && date.getMonth() === value.MM - 1 && date.getDate() === value.DD
    && date.getHours() === value.HH && date.getMinutes() === value.mm && date.getSeconds() === value.ss
  return real ? date : null
}

/** Whether `format` includes a time of day. */
export function formatHasTime(format: string): boolean {
  return /HH|mm|ss/.test(format)
}
