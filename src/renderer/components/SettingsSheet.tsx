// Settings: account, appearance (light/dark, colour, corners, text), language, defaults for new lists,
// the list's columns, PDF, behaviour, about. Opens as a sheet with sections on the left.
import { useState } from 'react'
import { isWeb } from '../api'
import { sb, user } from '../cloud'
import { ASPECTS, t } from '../i18n'
import { ACCENTS, COLUMNS, set, type Settings } from '../settings'
import { useSettings } from '../useSettings'
import { authError } from './Auth'
import { Icon } from './Icon'

const VERSION = '0.3.0'
type Section = 'account' | 'appearance' | 'lists' | 'pdf' | 'about'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const [sec, setSec] = useState<Section>('appearance')
  const nav: [Section, string, string][] = [
    ['account', t.account, 'user'], ['appearance', t.appearance, 'sun'], ['lists', t.defaults, 'list'], ['pdf', t.pdf, 'download'], ['about', t.about, 'clapper'],
  ]
  return (
    <div className="sheet-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet settings" role="dialog" aria-label={t.settings}>
        <nav className="set-nav">
          <h2>{t.settings}</h2>
          {nav.map(([k, label, icon]) => (
            <button key={k} className={sec === k ? 'on' : ''} onClick={() => setSec(k)}><Icon name={icon} size={17} />{label}</button>
          ))}
        </nav>
        <div className="set-body">
          <button className="tool set-close" title={t.close} onClick={onClose}><Icon name="close" size={18} /></button>
          {sec === 'account' && <Account />}
          {sec === 'appearance' && <Appearance s={s} />}
          {sec === 'lists' && <Lists s={s} />}
          {sec === 'pdf' && <Pdf s={s} />}
          {sec === 'about' && (
            <section>
              <h3>{t.about}</h3>
              <div className="brand big"><b>ROAR</b><i>LIST</i></div>
              <p className="muted">TheMadlions Lab · Experiment 04</p>
              <Row label={t.version}><span>{VERSION}{isWeb ? ' · web' : ''}</span></Row>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <div className="grow"><div>{label}</div>{hint && <div className="muted small">{hint}</div>}</div>
      <div className="set-ctl">{children}</div>
    </div>
  )
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>)}
    </div>
  )
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <label className="switch"><input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} /><span /></label>
}

function Appearance({ s }: { s: Settings }) {
  return (
    <section>
      <h3>{t.appearance}</h3>
      <Row label={t.mode}>
        <Seg value={s.mode} options={[['dark', t.modeDark], ['light', t.modeLight], ['system', t.modeSystem]]} onChange={(mode) => set({ mode })} />
      </Row>
      <Row label={t.accent}>
        <div className="swatches">
          {ACCENTS.map(([k, hex]) => (
            <button key={k} className={`swatch${s.accent === k ? ' on' : ''}`} style={{ background: hex }} title={k} onClick={() => set({ accent: k })} />
          ))}
        </div>
      </Row>
      <Row label={t.radius}>
        <input type="range" min={4} max={16} value={s.radius} onChange={(e) => set({ radius: Number(e.target.value) })} />
        <span className="muted small num">{s.radius}px</span>
      </Row>
      <Row label={t.textSize}>
        <Seg value={s.textSize} options={[['small', t.small], ['standard', t.standard], ['large', t.large]]} onChange={(textSize) => set({ textSize })} />
      </Row>
      <Row label={t.language}>
        <Seg value={s.language} options={[['el', 'Ελληνικά'], ['en', 'English'], ['system', t.langSystem]]} onChange={(language) => set({ language })} />
      </Row>
    </section>
  )
}

function Lists({ s }: { s: Settings }) {
  const label: Record<string, string> = { frame: t.frame, size: t.size, angle: t.angle, move: t.move, lens: t.lens, cast: t.cast, duration: t.duration, notes: t.notes }
  return (
    <section>
      <h3>{t.defaults}</h3>
      <Row label={t.defAspect}>
        <select className="set-select" value={s.aspect} onChange={(e) => set({ aspect: e.target.value })}>
          {ASPECTS.map((a) => <option key={a}>{a}</option>)}
        </select>
      </Row>
      <Row label={t.defLens}>
        <input className="set-input" value={s.lens} placeholder="35mm" onChange={(e) => set({ lens: e.target.value })} />
      </Row>
      <h3>{t.columns}</h3>
      <p className="muted small">{t.columnsHint}</p>
      {COLUMNS.map((c) => (
        <Row key={c} label={label[c]}>
          <Switch on={s.columns[c] !== false} onChange={(v) => set({ columns: { ...s.columns, [c]: v } })} />
        </Row>
      ))}
      <h3>{t.behaviour}</h3>
      <Row label={t.confirmDelete}><Switch on={s.confirmDelete} onChange={(confirmDelete) => set({ confirmDelete })} /></Row>
    </section>
  )
}

function Pdf({ s }: { s: Settings }) {
  return (
    <section>
      <h3>{t.pdf}</h3>
      <Row label={t.paper}><Seg value={s.paper} options={[['A4', 'A4'], ['Letter', 'Letter']]} onChange={(paper) => set({ paper })} /></Row>
      <Row label={t.pdfFrames}><Switch on={s.pdfFrames} onChange={(pdfFrames) => set({ pdfFrames })} /></Row>
    </section>
  )
}

function Account() {
  const u = user()
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  if (!isWeb || !u) return <section><h3>{t.account}</h3><p className="muted">{t.localNote}</p></section>
  return (
    <section>
      <h3>{t.account}</h3>
      <Row label={t.signedInAs}><span className="ellipsis">{(u.user_metadata as any)?.name ? `${(u.user_metadata as any).name} · ` : ''}{u.email}</span></Row>
      <p className="muted small">{t.cloudNote}</p>
      <h3>{t.changePassword}</h3>
      <form className="row" onSubmit={async (e) => {
        e.preventDefault()
        const { error } = await sb.auth.updateUser({ password: pw })
        setMsg(error ? authError(error) : t.passwordSaved)
        if (!error) setPw('')
      }}>
        <input className="set-input grow" type="password" autoComplete="new-password" placeholder={t.newPassword} value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="pill" type="submit" disabled={pw.length < 6}>{t.save}</button>
      </form>
      {msg && <p className="msg">{msg}</p>}
      <button className="pill danger" onClick={() => sb.auth.signOut()}><Icon name="close" size={16} />{t.signOut}</button>
    </section>
  )
}
