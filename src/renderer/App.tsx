// RoarList's window: shot lists on the left, the open one on the right as a list or a storyboard.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MenuCommand, PrintMode, Project, ProjectSummary } from '../shared/api'
import { fmtDur, totals } from '../shared/print'
import { ASPECTS, printLabels, t } from './i18n'
import * as M from './model'
import { api, isWeb } from './api'
import { Board } from './components/Board'
import { Icon } from './components/Icon'
import { Img } from './components/Img'
import { ShotList } from './components/ShotList'


export type Ops = {
  edit: (fn: (p: Project) => Project, history?: boolean) => void
  setImage: (shotId: string, file: Blob) => void
  setActive: (shotId: string) => void
  addShot: (sceneId: string) => void
  addShotAfter: (shotId: string) => void
  addScene: () => void
  removeShot: (shotId: string) => void
  removeScene: (sceneId: string) => void
  moveScene: (sceneId: string, by: number) => void
}

type Toast = { text: string; undo?: boolean } | null

// after React has drawn the new row: its description field
const later = (fn: () => void) => setTimeout(fn, 0)
const focusShot = (id: string) => later(() => {
  const row = document.querySelector(`[data-shot="${id}"]`)
  ;(row?.querySelector<HTMLElement>('textarea') || row?.querySelector<HTMLElement>('input:not([type=checkbox])'))?.focus()
})

export default function App() {
  const [lists, setLists] = useState<ProjectSummary[] | null>(null)
  const [p, setP] = useState<Project | null>(null)
  const [view, setView] = useState<PrintMode>(() => (localStorage.getItem('view') as PrintMode) || 'list')
  const [menu, setMenu] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [update, setUpdate] = useState<{ status: string; version: string } | null>(null)
  const cur = useRef<Project | null>(null)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const history = useRef<Project[]>([])
  const active = useRef<string>('')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const say = (text: string, undo = false) => {
    setToast({ text, undo })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), undo ? 6000 : 2200)
  }

  const refresh = useCallback(async () => setLists(await api.list()), [])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (!dirty.current || !cur.current) return
    dirty.current = false
    await api.save(cur.current)
    refresh()
  }, [refresh])

  const put = useCallback((next: Project, record: boolean) => {
    if (record && cur.current) history.current = [...history.current.slice(-49), cur.current]
    cur.current = next
    setP(next)
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 400)
  }, [flush])

  const open = useCallback(async (id: string) => {
    await flush()
    const next = await api.get(id)
    history.current = []
    cur.current = next
    setP(next)
    if (next) localStorage.setItem('last', id)
  }, [flush])

  const create = useCallback(async () => {
    await flush()
    const next = await api.create('')
    history.current = []
    cur.current = next
    setP(next)
    localStorage.setItem('last', next.id)
    await refresh()
    later(() => document.querySelector<HTMLInputElement>('.title')?.focus())
  }, [flush, refresh])

  const undo = useCallback(() => {
    const prev = history.current.pop()
    if (!prev || !cur.current || prev.id !== cur.current.id) return
    cur.current = prev
    setP(prev)
    dirty.current = true
    flush()
    setToast(null)
  }, [flush])

  const edit = (fn: (x: Project) => Project, record = false) => { if (cur.current) put(fn(cur.current), record) }

  const ops: Ops = {
    edit,
    setActive: (id) => { active.current = id },
    setImage: async (shotId, file) => {
      const pid = cur.current?.id
      if (!pid) return
      try {
        const name = await M.ingestImage(pid, file)
        if (cur.current?.id === pid) edit((x) => M.mapShot(x, shotId, (s) => ({ ...s, image: name })), true)
      } catch {
        say(t.imgError)
      }
    },
    addShot: (sceneId) => { if (!cur.current) return; const [n, id] = M.addShot(cur.current, sceneId); put(n, true); focusShot(id) },
    addShotAfter: (shotId) => {
      const sc = cur.current?.scenes.find((x) => x.shots.some((s) => s.id === shotId))
      if (!sc || !cur.current) return
      const [n, id] = M.addShot(cur.current, sc.id, shotId); put(n, true); focusShot(id)
    },
    addScene: () => {
      if (!cur.current) return
      const sc = M.newScene(M.nextSceneNumber(cur.current))
      put({ ...cur.current, scenes: [...cur.current.scenes, sc] }, true)
      later(() => document.querySelector<HTMLInputElement>('.scene:last-of-type .scene-heading')?.focus())
    },
    removeShot: (id) => { edit((x) => M.removeShot(x, id), true); say(t.deleted, true) },
    removeScene: (id) => {
      const sc = cur.current?.scenes.find((x) => x.id === id)
      if (!sc) return
      if (sc.shots.some((s) => s.description || s.image) && !confirm(t.removeSceneQ)) return
      edit((x) => ({ ...x, scenes: x.scenes.filter((s) => s.id !== id) }), true)
      say(`${t.scene} ${sc.number}: ${t.deleted.toLowerCase()}`, true)
    },
    moveScene: (id, by) => edit((x) => M.moveScene(x, id, by), true),
  }
  const opsRef = useRef(ops)
  opsRef.current = ops

  const exportAs = async (kind: 'pdf' | 'board' | 'html' | 'file') => {
    setMenu(false)
    if (!cur.current) return
    await flush()
    const id = cur.current.id
    const ok = kind === 'file' ? await api.exportFile(id)
      : kind === 'html' ? await api.exportHtml(id, view, printLabels())
      : await api.exportPdf(id, kind === 'board' ? 'board' : 'list', printLabels())
    if (ok) say(t.exported)
  }

  const exportRef = useRef(exportAs)
  exportRef.current = exportAs

  const importFile = async () => {
    await flush()
    const n = await api.importFile()
    if (n) { await refresh(); open(n.id) }
  }

  // first load: the shot lists, and the one open last time
  useEffect(() => {
    api.list().then(async (all) => {
      setLists(all)
      const last = localStorage.getItem('last')
      const pick = all.find((x) => x.id === last) || all[0]
      if (pick) open(pick.id)
    })
    api.update.state().then(setUpdate)
    const offU = api.update.on(setUpdate)
    const offO = api.onOpened((n) => { refresh(); open(n.id) })
    const save = () => { if (dirty.current && cur.current) { dirty.current = false; api.saveNow(cur.current) } }
    // leaving the window (or quitting) writes what is pending at once
    window.addEventListener('beforeunload', save)
    window.addEventListener('blur', flush)
    return () => { offU(); offO(); window.removeEventListener('beforeunload', save); window.removeEventListener('blur', flush) }
  }, [open, refresh, flush])

  useEffect(() => api.onMenu((c: MenuCommand) => {
    const o = opsRef.current
    const sc = cur.current?.scenes
    if (c === 'new') create()
    else if (c === 'import') importFile()
    else if (c === 'export-pdf') exportAs('pdf')
    else if (c === 'export-board') exportAs('board')
    else if (c === 'export-html') exportAs('html')
    else if (c === 'export-file') exportAs('file')
    else if (c === 'add-scene') o.addScene()
    else if (c === 'add-shot') {
      if (active.current && sc?.some((x) => x.shots.some((s) => s.id === active.current))) o.addShotAfter(active.current)
      else if (sc?.length) o.addShot(sc[sc.length - 1].id)
    }
  }))

  // undo for the big changes (a removed shot or scene, a reorder, an image) when no text field is being edited;
  // a pasted picture goes to the shot being edited
  useEffect(() => {
    const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && (document.activeElement as HTMLInputElement).type !== 'checkbox'
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing()) { e.preventDefault(); undo() }
      if (e.key === 'Escape') setMenu(false)
      if (isWeb && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); exportRef.current(e.shiftKey ? 'board' : 'pdf') }
    }
    const paste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith('image/'))
      if (f && active.current) { e.preventDefault(); opsRef.current.setImage(active.current, f) }
    }
    window.addEventListener('keydown', key)
    window.addEventListener('paste', paste)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('paste', paste) }
  }, [undo])

  useEffect(() => { localStorage.setItem('view', view) }, [view])

  if (!lists) return <div className="boot"><div className="spinner" /></div>

  const tot = p ? totals(p) : null
  const field = (k: 'client' | 'director' | 'dop', label: string) => (
    <label className="meta-field"><span>{label}</span><input value={p![k]} onChange={(e) => edit((x) => ({ ...x, [k]: e.target.value }))} /></label>
  )

  return (
    <div className={`app${sideOpen ? ' side-open' : ''}`}>
      <div className="drag" />
      {sideOpen && <div className="side-shade" onClick={() => setSideOpen(false)} />}
      <aside className="side">
        <div className="brand"><b>ROAR</b><i>LIST</i></div>
        <button className="pill primary new" onClick={() => { setSideOpen(false); create() }}><Icon name="plus" size={16} />{t.newList}</button>
        <div className="side-title muted small">{t.shotlists}</div>
        <div className="projects">
          {lists.map((x) => (
            <div key={x.id} className={`project${p?.id === x.id ? ' on' : ''}`} onClick={() => { setSideOpen(false); if (p?.id !== x.id) open(x.id) }}>
              <div className="cover">{x.cover ? <Img projectId={x.id} file={x.cover} /> : <Icon name="clapper" size={18} />}</div>
              <div className="grow">
                <div className="ellipsis">{(p?.id === x.id ? p.title : x.title) || t.untitled}</div>
                <div className="muted small ellipsis">
                  {x.date ? new Date(x.date + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' : ''}{x.done}/{x.shots} {t.shots.toLowerCase()}
                </div>
              </div>
              <div className="project-tools">
                <button className="tool small" title={t.duplicate} onClick={async (e) => {
                  e.stopPropagation(); await flush()
                  const n = await api.duplicate(x.id, `${t.copyOf} ${x.title || t.untitled}`)
                  await refresh(); open(n.id)
                }}><Icon name="copy" size={15} /></button>
                <button className="tool small" title={t.remove} onClick={async (e) => {
                  e.stopPropagation()
                  if (!confirm(t.removeQ)) return
                  if (p?.id === x.id) { clearTimeout(timer.current); dirty.current = false; cur.current = null; setP(null) }
                  await api.remove(x.id); await refresh()
                }}><Icon name="trash" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
        <button className="link import" onClick={importFile}><Icon name="open" size={16} />{t.open}</button>
      </aside>

      {!p ? (
        <main className="main empty">
          <div className="empty-mark"><b>ROAR</b><i>LIST</i></div>
          <h2>{t.empty}</h2>
          <p className="muted">{t.emptySub}</p>
          <button className="pill primary" onClick={create}>{t.start}</button>
        </main>
      ) : (
        <main className="main">
          <div className="bar">
            <button className="tool side-toggle" title={t.shotlists} onClick={() => setSideOpen(true)}><Icon name="menu" size={18} /></button>
            <div className="seg">
              <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><Icon name="list" size={16} />{t.list}</button>
              <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}><Icon name="board" size={16} />{t.board}</button>
            </div>
            <span className="grow" />
            {tot && <span className="muted small totals">{tot.done}/{tot.shots} {t.shots.toLowerCase()}{tot.secs ? ` · ${fmtDur(tot.secs)}` : ''}</span>}
            <div className="menu-wrap">
              <button className="pill" onClick={() => setMenu(!menu)}><Icon name="download" size={16} />{t.export}</button>
              {menu && (
                <>
                  <div className="menu-shade" onClick={() => setMenu(false)} />
                  <div className="menu">
                    <button onClick={() => exportAs('pdf')}><Icon name="list" size={16} />{t.pdfList}</button>
                    <button onClick={() => exportAs('board')}><Icon name="board" size={16} />{t.pdfBoard}</button>
                    <button onClick={() => exportAs('html')}><Icon name="download" size={16} />{t.html}</button>
                    <button onClick={() => exportAs('file')}><Icon name="clapper" size={16} /><span>{t.file}<small className="muted">{t.fileHint}</small></span></button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="page">
            <header className="doc-head">
              <input className="title" value={p.title} placeholder={t.untitled} onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} />
              <div className="meta-row">
                {field('client', t.client)}
                {field('director', t.director)}
                {field('dop', t.dop)}
                <label className="meta-field"><span>{t.date}</span><input type="date" value={p.date} onChange={(e) => edit((x) => ({ ...x, date: e.target.value }))} /></label>
                <label className="meta-field small-field"><span>{t.aspect}</span>
                  <select value={p.aspect} onChange={(e) => edit((x) => ({ ...x, aspect: e.target.value }))}>
                    {ASPECTS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
              </div>
              <textarea className="doc-notes" rows={1} value={p.notes} placeholder={t.projectNotes} onChange={(e) => edit((x) => ({ ...x, notes: e.target.value }))} />
            </header>
            {view === 'list' ? <ShotList p={p} ops={ops} /> : <Board p={p} ops={ops} />}
          </div>
        </main>
      )}

      {toast && (
        <div className="toast">{toast.text}{toast.undo && <button className="link undo" onClick={undo}>{t.undo}</button>}</div>
      )}
      {update?.status === 'ready' && (
        <div className="update"><span>{t.updateReady} · {update.version}</span><button className="pill primary small" onClick={() => api.update.install()}>{t.restart}</button></div>
      )}
    </div>
  )
}
