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

// "Sign in with Roar Account" (one sign-in for every Roar app): the app asks roar-connect for a code, the person allows
// it on themadlions.com/account in a browser where they are signed in, and the poll hands back a one-time magic-link
// token that becomes this app's own session. Nothing but the code and its secret is sent from here.
const CONNECT = `${SB_URL}/functions/v1/roar-connect`
const connect = async (body: Record<string, string>) => {
  const r = await fetch(CONNECT, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(String(j.error || j.message || r.status))
  return j
}
export type ConnectStart = { code: string; secret: string; url: string; expires_in: number }
export type ConnectPoll = { waiting?: boolean; expired?: boolean; token_hash?: string; email?: string }
export const connectStart = () => connect({ do: 'start', app: 'roarlist' }) as Promise<ConnectStart>
export const connectPoll = (code: string, secret: string) => connect({ do: 'poll', code, secret }) as Promise<ConnectPoll>
export async function connectFinish(token_hash: string) {
  const { error } = await sb.auth.verifyOtp({ type: 'magiclink', token_hash })
  if (error) throw error
}

// two-step verification: a session from a password or a Roar Account is aal1 until the authenticator's code is given
export async function needsMfa() {
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
  return !!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
}
export async function verifyMfa(code: string) {
  const { data, error } = await sb.auth.mfa.listFactors()
  if (error) throw error
  const f = data.totp.find((x) => x.status === 'verified')
  if (!f) throw new Error('no factor')
  const { error: e2 } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code })
  if (e2) throw e2
}
