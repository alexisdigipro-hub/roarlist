// Sign in with a RoarMe account (the same one as RoarMe, Roardino and RoarMail), make one, or ask for a new password.
import { useEffect, useRef, useState } from 'react'
import { isWeb } from '../api'
import { appUrl, connectFinish, connectPoll, connectStart, sb, verifyMfa, type ConnectPoll, type ConnectStart } from '../cloud'
import { LEGAL, t } from '../i18n'

const ERRORS: [RegExp, keyof typeof t][] = [
  [/invalid login/i, 'err_login'], [/not confirmed/i, 'err_confirm'], [/already registered|already exists/i, 'err_exists'],
  [/invalid totp|totp code|mfa/i, 'err_code'], [/at least|weak|short/i, 'err_short'], [/rate|too many|seconds/i, 'err_rate'], [/valid email|invalid email|email address/i, 'err_email'],
]
export const authError = (e: any) => {
  const m = String(e?.message || '')
  for (const [re, k] of ERRORS) if (re.test(m)) return t[k] as string
  return t.err_other
}

type Msg = { text: string; kind: '' | 'err' | 'ok' }

export function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [msg, setMsg] = useState<Msg>({ text: '', kind: '' })
  const [busy, setBusy] = useState(false)
  const [roar, setRoar] = useState(false)
  const up = mode === 'up'
  const field = (k: keyof typeof f, label: string, type: string, auto: string) => (
    <label className="field"><span>{label}</span>
      <input type={type} value={f[k]} autoComplete={auto} onChange={(e) => setF({ ...f, [k]: e.target.value })} required />
    </label>
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = f.email.trim()
    if (!email || !f.password) return setMsg({ text: t.fillBoth, kind: 'err' })
    if (up && !f.name.trim()) return setMsg({ text: t.needName, kind: 'err' })
    setBusy(true); setMsg({ text: t.working, kind: '' })
    try {
      if (up) {
        const { data, error } = await sb.auth.signUp({ email, password: f.password, options: { emailRedirectTo: appUrl(), data: { name: f.name.trim() } } })
        if (error) throw error
        if (!data.session) { setMode('in'); setMsg({ text: t.confirmSent, kind: 'ok' }) }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: f.password })
        if (error) throw error
      }
    } catch (err) {
      setMsg({ text: authError(err), kind: 'err' })
    } finally {
      setBusy(false)
    }
  }

  const forgot = async () => {
    if (!f.email.trim()) return setMsg({ text: t.needEmail, kind: 'err' })
    setMsg({ text: t.working, kind: '' })
    const { error } = await sb.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: appUrl() })
    setMsg(error ? { text: authError(error), kind: 'err' } : { text: t.resetSent, kind: 'ok' })
  }

  if (roar) return <RoarConnect onCancel={() => setRoar(false)} />

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="brand big"><b>ROAR</b><i>LIST</i></div>
        <button className="pill primary wide roar-account" type="button" onClick={() => setRoar(true)}>{t.roarAccount}</button>
        <p className="hint roar-hint">{t.roarAccountHint}</p>
        <div className="or"><span>{t.orEmail}</span></div>
        <div className="seg">
          <button type="button" className={up ? '' : 'on'} onClick={() => { setMode('in'); setMsg({ text: '', kind: '' }) }}>{t.signIn}</button>
          <button type="button" className={up ? 'on' : ''} onClick={() => { setMode('up'); setMsg({ text: '', kind: '' }) }}>{t.signUp}</button>
        </div>
        {up && field('name', t.fullName, 'text', 'name')}
        {field('email', t.email, 'email', 'email')}
        {field('password', up ? t.passwordNew : t.password, 'password', up ? 'new-password' : 'current-password')}
        <button className="pill primary wide" type="submit" disabled={busy}>{up ? t.signUp : t.signIn}</button>
        {!up && <button className="link center" type="button" onClick={forgot}>{t.forgot}</button>}
        {msg.text && <p className={`msg ${msg.kind}`}>{msg.text}</p>}
        <p className="hint">{t.sameAccount}</p>
        {up && <p className="hint set-legal">{t.agreeA} <a href={`${LEGAL}#terms`} target="_blank" rel="noreferrer">{t.terms}</a> {t.agreeB} <a href={`${LEGAL}#privacy`} target="_blank" rel="noreferrer">{t.privacy}</a>.</p>}
      </form>
    </div>
  )
}

// after the link in a "new password" email
export function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<Msg>({ text: '', kind: '' })
  return (
    <div className="sheet-wrap">
      <form className="auth-card" onSubmit={async (e) => {
        e.preventDefault()
        const { error } = await sb.auth.updateUser({ password: pw })
        if (error) return setMsg({ text: authError(error), kind: 'err' })
        onDone()
      }}>
        <h2>{t.setNewPassword}</h2>
        <label className="field"><span>{t.passwordNew}</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <button className="pill primary wide" type="submit">{t.save}</button>
        {msg.text && <p className={`msg ${msg.kind}`}>{msg.text}</p>}
      </form>
    </div>
  )
}

// "Sign in with Roar Account": a code from roar-connect, allowed on themadlions.com/account in the browser, polled every
// 2 s; its one-time token becomes this app's session (App then goes on as after a password sign-in, two-step included)
const POLL_MS = 2000
const MAX_MS = 10 * 60 * 1000

function RoarConnect({ onCancel }: { onCancel: () => void }) {
  const [c, setC] = useState<ConnectStart | null>(null)
  const [state, setState] = useState<'start' | 'wait' | 'expired' | 'error'>('start')
  const run = useRef(0)

  // on the web the tab is opened at the click (before the fetch) so a popup blocker lets it through;
  // in the desktop app window.open goes to the system browser (main's setWindowOpenHandler)
  const openPage = (url: string, tab?: Window | null) => {
    if (tab && !tab.closed) { try { tab.location.href = url; tab.opener = null; return } catch { /* fall through */ } }
    window.open(url, '_blank', 'noopener')
  }

  const begin = async () => {
    const me = ++run.current
    const tab = isWeb ? window.open('', '_blank') : null
    setState('start'); setC(null)
    try {
      const s = await connectStart()
      if (me !== run.current) { tab?.close(); return }
      setC(s); setState('wait')
      openPage(s.url, tab)
      const until = Date.now() + Math.min(MAX_MS, (s.expires_in || 600) * 1000)
      while (me === run.current) {
        await new Promise((r) => setTimeout(r, POLL_MS))
        if (me !== run.current) return
        if (Date.now() > until) { setState('expired'); return }
        let r: ConnectPoll
        try { r = await connectPoll(s.code, s.secret) } catch { continue } // a dropped poll is tried again
        if (me !== run.current) return
        if (r.expired) { setState('expired'); return }
        if (r.token_hash) { await connectFinish(r.token_hash); run.current++; return }
      }
    } catch {
      tab?.close()
      if (me === run.current) setState('error')
    }
  }

  useEffect(() => { begin(); return () => { run.current++ } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const cancel = () => { run.current++; onCancel() }

  return (
    <div className="auth">
      <div className="auth-card connect-card">
        <div className="brand big"><b>ROAR</b><i>LIST</i></div>
        <h2>{t.allowTitle}</h2>
        {c && <div className="connect-code" aria-label={c.code}>{c.code}</div>}
        {state === 'start' && <p className="msg">{t.working}</p>}
        {state === 'wait' && <>
          <p className="msg">{t.allowHint}</p>
          <p className="msg connect-wait"><span className="spinner small" />{t.waiting}</p>
          <button className="pill wide" type="button" onClick={() => c && openPage(c.url)}>{t.openAgain}</button>
        </>}
        {(state === 'expired' || state === 'error') && <>
          <p className="msg err">{state === 'expired' ? t.codeExpired : t.connectErr}</p>
          <button className="pill primary wide" type="button" onClick={begin}>{t.tryAgain}</button>
        </>}
        <button className="link center" type="button" onClick={cancel}>{t.cancel}</button>
      </div>
    </div>
  )
}

// two-step verification after a sign-in (password or Roar Account) when the account has an authenticator
export function Mfa() {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<Msg>({ text: '', kind: '' })
  const [busy, setBusy] = useState(false)
  return (
    <div className="auth">
      <form className="auth-card" noValidate onSubmit={async (e) => {
        e.preventDefault()
        const v = code.replace(/\D/g, '')
        if (v.length !== 6) return setMsg({ text: t.mfaHint, kind: 'err' })
        setBusy(true); setMsg({ text: t.working, kind: '' })
        try { await verifyMfa(v) } catch (err) { setMsg({ text: authError(err), kind: 'err' }); setCode('') } finally { setBusy(false) }
      }}>
        <div className="brand big"><b>ROAR</b><i>LIST</i></div>
        <h2>{t.mfaTitle}</h2>
        <p className="msg">{t.mfaHint}</p>
        <label className="field"><span>{t.mfaCode}</span>
          <input className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </label>
        <button className="pill primary wide" type="submit" disabled={busy}>{t.verify}</button>
        {msg.text && <p className={`msg ${msg.kind}`}>{msg.text}</p>}
        <button className="link center" type="button" onClick={() => sb.auth.signOut()}>{t.signOut}</button>
      </form>
    </div>
  )
}
