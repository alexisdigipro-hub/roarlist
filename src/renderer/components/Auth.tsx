// Sign in with a RoarMe account (the same one as RoarMe, Roardino and RoarMail), make one, or ask for a new password.
import { useState } from 'react'
import { appUrl, sb } from '../cloud'
import { LEGAL, t } from '../i18n'

const ERRORS: [RegExp, keyof typeof t][] = [
  [/invalid login/i, 'err_login'], [/not confirmed/i, 'err_confirm'], [/already registered|already exists/i, 'err_exists'],
  [/at least|weak|short/i, 'err_short'], [/rate|too many|seconds/i, 'err_rate'], [/valid email|invalid email|email address/i, 'err_email'],
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

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="brand big"><b>ROAR</b><i>LIST</i></div>
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
