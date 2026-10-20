// The list view: scenes, and under each one its shots as rows. Rows are dragged by their handle,
// within a scene or into another one.
import { useEffect, useRef, useState } from 'react'
import type { Project, Scene, Shot } from '../../shared/api'
import { fmtDur, ratio, shotNo } from '../../shared/print'
import { ANGLES, MOVES, SIZES, t, val } from '../i18n'
import { moveShot, parseDur } from '../model'
import type { Ops } from '../App'
import { Frame } from './Frame'
import { Icon } from './Icon'

const LENSES = ['14mm', '18mm', '24mm', '28mm', '35mm', '40mm', '50mm', '65mm', '85mm', '100mm', '135mm']

type Drop = { scene: string; index: number } | null

export function ShotList({ p, ops }: { p: Project; ops: Ops }) {
  const dragging = useRef<string | null>(null)
  const [drop, setDrop] = useState<Drop>(null)
  const r = ratio(p.aspect)

  const overRow = (e: React.DragEvent, sc: Scene, i: number) => {
    if (!dragging.current) return
    e.preventDefault()
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const index = e.clientY > box.top + box.height / 2 ? i + 1 : i
    if (drop?.scene !== sc.id || drop.index !== index) setDrop({ scene: sc.id, index })
  }
  const finish = () => {
    if (dragging.current && drop) ops.edit((x) => moveShot(x, dragging.current!, drop.scene, drop.index), true)
    dragging.current = null
    setDrop(null)
  }

  return (
    <div className="scenes" onDragEnd={() => { dragging.current = null; setDrop(null) }}>
      <datalist id="sizes">{SIZES.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="lenses">{LENSES.map((s) => <option key={s} value={s} />)}</datalist>
      {p.scenes.map((sc, si) => (
        <section key={sc.id} className="scene">
          <div className="scene-head"
            onDragOver={(e) => { if (dragging.current) { e.preventDefault(); setDrop({ scene: sc.id, index: 0 }) } }}
            onDrop={(e) => { e.preventDefault(); finish() }}>
            <span className="scene-tag">{t.scene}</span>
            <input className="scene-no" value={sc.number} size={Math.max(2, sc.number.length)}
              onChange={(e) => ops.edit((x) => ({ ...x, scenes: x.scenes.map((s) => (s.id === sc.id ? { ...s, number: e.target.value } : s)) }))} />
            <input className="scene-heading grow" value={sc.heading} placeholder={t.heading}
              onChange={(e) => ops.edit((x) => ({ ...x, scenes: x.scenes.map((s) => (s.id === sc.id ? { ...s, heading: e.target.value } : s)) }))} />
            <span className="muted small">{sc.shots.length} {t.shots.toLowerCase()}</span>
            <button className="tool small" title={t.moveUp} disabled={si === 0} onClick={() => ops.moveScene(sc.id, -1)}><Icon name="up" size={16} /></button>
            <button className="tool small" title={t.moveDown} disabled={si === p.scenes.length - 1} onClick={() => ops.moveScene(sc.id, 1)}><Icon name="down" size={16} /></button>
            <button className="tool small" title={t.remove} onClick={() => ops.removeScene(sc.id)}><Icon name="trash" size={16} /></button>
          </div>

          <div className="grid-head">
            <span /><span>#</span><span>{t.frame}</span><span>{t.size}</span><span>{t.angle}</span><span>{t.move}</span><span>{t.lens}</span>
            <span>{t.description}</span><span>{t.cast}</span><span>{t.duration}</span><span>{t.notes}</span><span title={t.done}><Icon name="check" size={14} /></span><span />
          </div>

          {sc.shots.map((s, i) => (
            <Row key={s.id} p={p} s={s} no={shotNo(sc.number, i)} r={r} ops={ops}
              dropBefore={drop?.scene === sc.id && drop.index === i}
              dropAfter={drop?.scene === sc.id && drop.index === sc.shots.length && i === sc.shots.length - 1}
              onGrab={() => { dragging.current = s.id }}
              onOver={(e) => overRow(e, sc, i)}
              onDrop={(e) => { e.preventDefault(); finish() }} />
          ))}
          {!sc.shots.length && drop?.scene === sc.id && <div className="drop-line" />}

          <button className="add-row" onClick={() => ops.addShot(sc.id)}><Icon name="plus" size={15} />{t.addShot}</button>
        </section>
      ))}
      <button className="pill add-scene" onClick={() => ops.addScene()}><Icon name="plus" size={16} />{t.addScene}</button>
    </div>
  )
}

type RowProps = {
  p: Project; s: Shot; no: string; r: number; ops: Ops
  dropBefore: boolean; dropAfter: boolean
  onGrab: () => void; onOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void
}

function Row({ p, s, no, r, ops, dropBefore, dropAfter, onGrab, onOver, onDrop }: RowProps) {
  const [draggable, setDraggable] = useState(false)
  const set = (patch: Partial<Shot>, history = false) => ops.edit((x) => ({
    ...x, scenes: x.scenes.map((sc) => ({ ...sc, shots: sc.shots.map((y) => (y.id === s.id ? { ...y, ...patch } : y)) })),
  }), history)

  return (
    <div data-shot={s.id} className={`shot${s.done ? ' is-done' : ''}${dropBefore ? ' drop-before' : ''}${dropAfter ? ' drop-after' : ''}`}
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', no); onGrab() }}
      onDragEnd={() => setDraggable(false)}
      onDragOver={onOver} onDrop={onDrop}
      onFocus={() => ops.setActive(s.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ops.addShotAfter(s.id) } }}>
      <span className="grip" title={t.drag} onMouseDown={() => setDraggable(true)} onMouseUp={() => setDraggable(false)}><Icon name="grip" size={16} /></span>
      <b className="no">{no}</b>
      <Frame projectId={p.id} image={s.image} ratio={r} onImage={(f) => ops.setImage(s.id, f)} onClear={() => set({ image: '' }, true)} />
      <input list="sizes" value={s.size} onChange={(e) => set({ size: e.target.value.toUpperCase() })} />
      <select value={s.angle} onChange={(e) => set({ angle: e.target.value })}>
        <option value="" />
        {ANGLES.map((a) => <option key={a} value={a}>{val(a)}</option>)}
      </select>
      <select value={s.move} onChange={(e) => set({ move: e.target.value })}>
        <option value="" />
        {MOVES.map((a) => <option key={a} value={a}>{val(a)}</option>)}
      </select>
      <input list="lenses" value={s.lens} onChange={(e) => set({ lens: e.target.value })} />
      <textarea rows={1} value={s.description} placeholder={t.descPh} onChange={(e) => set({ description: e.target.value })} />
      <textarea rows={1} value={s.cast} onChange={(e) => set({ cast: e.target.value })} />
      <Duration value={s.duration} onChange={(duration) => set({ duration })} />
      <textarea rows={1} value={s.notes} onChange={(e) => set({ notes: e.target.value })} />
      <label className="done" title={t.done}><input type="checkbox" checked={s.done} onChange={(e) => set({ done: e.target.checked })} /><span><Icon name="check" size={13} /></span></label>
      <button className="tool small row-x" title={t.remove} onClick={() => ops.removeShot(s.id)}><Icon name="close" size={15} /></button>
    </div>
  )
}

function Duration({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(fmtDur(value))
  useEffect(() => setText(fmtDur(value)), [value])
  return (
    <input value={text} placeholder="0:00" title={t.durHint}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { const n = parseDur(text); setText(fmtDur(n)); if (n !== value) onChange(n) }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) (e.target as HTMLInputElement).blur() }} />
  )
}
