// A person's settings: the look (light/dark, accent, corners), language, the defaults for new lists and shots,
// which columns the list shows, and how PDFs are printed. Kept in this browser / app, and in the account when signed in.

export type Settings = {
  mode: 'system' | 'dark' | 'light'
  accent: string        // key of ACCENTS
  radius: number        // 4 to 16
  textSize: 'small' | 'standard' | 'large'
  language: 'system' | 'el' | 'en'
  aspect: string        // for new shot lists
  lens: string          // for the first shot of a new list
  columns: Record<string, boolean> // false hides that column in the list
  paper: 'A4' | 'Letter'
  pdfFrames: boolean    // frames in the list PDF
  confirmDelete: boolean // ask before deleting a shot
}

// RoarMe's accents (Settings > Appearance there), red first: the THEMADLIONS colour
export const ACCENTS: [string, string][] = [
  ['red', '#d40000'], ['coral', '#ff6b57'], ['orange', '#f97316'], ['yellow', '#facc15'], ['green', '#22c55e'],
  ['cyan', '#22d3ee'], ['blue', '#3b82f6'], ['violet', '#8b5cf6'], ['magenta', '#d946ef'], ['white', '#ffffff'],
]
export const COLUMNS = ['frame', 'size', 'angle', 'move', 'lens', 'cast', 'duration', 'notes'] as const

export const DEFAULTS: Settings = {
  mode: 'dark', accent: 'red', radius: 12, textSize: 'standard', language: 'system', aspect: '16:9', lens: '',
  columns: {}, paper: 'A4', pdfFrames: true, confirmDelete: false,
}

const KEY = 'roarlist-settings'

export function load(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...DEFAULTS } }
}

let current = load()
const subs = new Set<(s: Settings) => void>()
let remote: ((s: Settings) => void) | null = null

export const get = () => current
export const shown = (col: string) => current.columns[col] !== false
export function subscribe(fn: (s: Settings) => void) { subs.add(fn); return () => { subs.delete(fn) } }
// the web app sends changes to the account
export function onChange(fn: ((s: Settings) => void) | null) { remote = fn }

export function set(patch: Partial<Settings>, fromAccount = false) {
  const langBefore = current.language
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* private window */ }
  apply()
  subs.forEach((f) => f(current))
  if (!fromAccount && remote) remote(current)
  // the words are picked when the app starts
  if (current.language !== langBefore) setTimeout(() => location.reload(), 150)
}

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null
const inkOn = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160 ? '#111111' : '#ffffff'
}

export function apply() {
  const r = document.documentElement
  const s = current
  r.dataset.mode = s.mode === 'system' ? (media?.matches ? 'light' : 'dark') : s.mode
  r.dataset.text = s.textSize
  const hex = (ACCENTS.find(([k]) => k === s.accent) || ACCENTS[0])[1]
  r.style.setProperty('--accent', hex)
  r.style.setProperty('--accent-ink', inkOn(hex))
  r.style.setProperty('--r', `${Math.min(16, Math.max(4, Number(s.radius) || 12))}px`)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', r.dataset.mode === 'light' ? '#eceef1' : '#1f2328')
}
media?.addEventListener('change', () => { if (current.mode === 'system') apply() })
