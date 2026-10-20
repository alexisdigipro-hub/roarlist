// RoarMe's Supabase project: its Auth is the account (the same one as RoarMe, Roardino and RoarMail), and RoarList
// keeps its own table roarlist_projects and private bucket roarlist-images (supabase/roarlist.sql).
// The publishable key is public by design; every row and file is guarded by its owner.
import { createClient, type Session } from '@supabase/supabase-js'

export const SB_URL = 'https://bzmjhbnwhdwmncxkqkdl.supabase.co'
const SB_KEY = 'sb_publishable_7mQ3e0NH5lCmdoIKx2-FUA_EgCoXx9X'

export const sb = createClient(SB_URL, SB_KEY, {
  auth: { storageKey: 'roarlist-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

let session: Session | null = null
export const user = () => session?.user || null
export const uid = () => session?.user.id || ''

const subs = new Set<(s: Session | null, event: string) => void>()
export function onAuth(fn: (s: Session | null, event: string) => void) { subs.add(fn); return () => { subs.delete(fn) } }

sb.auth.onAuthStateChange((event, s) => {
  session = s
  // Supabase advises against awaiting its own calls inside this callback
  setTimeout(() => subs.forEach((f) => f(s, event)), 0)
})

export async function currentSession() {
  const { data } = await sb.auth.getSession()
  session = data.session
  return session
}

export const appUrl = () => location.origin + location.pathname
