// themadlions.com/roarlist/#demo (the Lab's live example): a sample shot list with drawn frames, kept in memory only.
// No account, nothing saved; a reload starts it fresh.
import type { ListApi, PrintMode, PrintLabels, Project } from '../shared/api'
import { clean } from '../shared/clean'
import { printHtml } from '../shared/print'

const uid = () => crypto.randomUUID()
const images = new Map<string, string>() // file -> data URL
const store = new Map<string, Project>()

// a night frame: graphite sky, a red glow, rails or a wagon, a figure
function draw(kind: 'wide' | 'walk' | 'face' | 'hand' | 'wagon' | 'pov' | 'eyes', seed: number) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 360
  const x = c.getContext('2d')!
  const g = x.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, '#2b3038'); g.addColorStop(1, '#0d0e11')
  x.fillStyle = g; x.fillRect(0, 0, 640, 360)
  const glow = (cx: number, cy: number, r: number, a: number) => {
    const rg = x.createRadialGradient(cx, cy, 4, cx, cy, r); rg.addColorStop(0, `rgba(212,0,0,${a})`); rg.addColorStop(1, 'rgba(212,0,0,0)')
    x.fillStyle = rg; x.fillRect(0, 0, 640, 360)
  }
  x.fillStyle = 'rgba(0,0,0,.65)'
  if (kind === 'wide') {
    glow(480 - seed * 20, 120, 260, .7)
    for (let i = 0; i < 10; i++) x.fillRect(i * 66, 210 - ((i * 37) % 70), 48, 200)
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(250, 360); x.lineTo(318, 230); x.moveTo(390, 360); x.lineTo(322, 230); x.stroke()
  } else if (kind === 'walk') {
    glow(320, 150, 230, .55)
    x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 3
    x.beginPath(); x.moveTo(120, 360); x.lineTo(300, 200); x.moveTo(520, 360); x.lineTo(340, 200); x.stroke()
    x.fillStyle = '#050506'; x.beginPath(); x.ellipse(320, 175, 15, 17, 0, 0, 7); x.fill(); x.fillRect(303, 190, 34, 90)
  } else if (kind === 'face') {
    glow(150, 180, 300, .85)
    x.fillStyle = '#050506'; x.beginPath(); x.ellipse(360, 200, 110, 140, -.1, 0, 7); x.fill(); x.fillRect(270, 300, 190, 80)
    x.strokeStyle = 'rgba(255,90,70,.7)'; x.lineWidth = 3; x.beginPath(); x.ellipse(360, 200, 110, 140, -.1, 2.3, 4.2); x.stroke()
  } else if (kind === 'hand') {
    glow(520, 80, 260, .5)
    x.fillStyle = '#5b636e'; x.fillRect(0, 250, 640, 26)
    x.fillStyle = '#0a0a0b'; x.beginPath(); x.ellipse(330, 238, 90, 34, -.1, 0, 7); x.fill()
    for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(270 + i * 36, 258, 12, 26, 0, 0, 7); x.fill() }
  } else if (kind === 'wagon') {
    glow(320, 60, 240, .45)
    x.fillStyle = 'rgba(255,255,255,.07)'
    for (let i = 0; i < 4; i++) x.fillRect(40 + i * 150, 60, 110, 90)
    x.fillStyle = '#050506'; x.beginPath(); x.ellipse(190, 190, 70, 80, 0, 0, 7); x.fill(); x.fillRect(110, 250, 170, 110)
  } else if (kind === 'pov') {
    glow(320, 180, 200, .6)
    x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2
    for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(320, 180); x.lineTo(i * 92, 360); x.stroke() }
    x.fillStyle = 'rgba(255,220,180,.9)'; x.beginPath(); x.arc(320, 180, 6, 0, 7); x.fill()
  } else {
    x.fillStyle = '#151619'; x.fillRect(0, 0, 640, 360)
    glow(320, 180, 330, .45)
    x.fillStyle = '#050506'
    for (const cx of [210, 430]) { x.beginPath(); x.ellipse(cx, 180, 80, 34, 0, 0, 7); x.fill() }
    x.fillStyle = 'rgba(255,80,60,.85)'
    for (const cx of [210, 430]) { x.beginPath(); x.arc(cx, 180, 14, 0, 7); x.fill() }
  }
  const name = `${uid()}.jpg`
  images.set(name, c.toDataURL('image/jpeg', .82))
  return name
}

function sample(): Project {
  const shot = (size: string, angle: string, move: string, lens: string, description: string, cast: string, duration: number, notes: string, kind: Parameters<typeof draw>[0] | '', done = false, seed = 0) =>
    ({ id: uid(), size, angle, move, lens, description, cast, duration, notes, image: kind ? draw(kind, seed) : '', done })
  const d = new Date(); d.setDate(d.getDate() + 3)
  return {
    id: uid(), title: 'Night Shoot · Music video', client: 'THEMADLIONS', director: 'The director', dop: 'The DoP',
    date: d.toISOString().slice(0, 10), aspect: '16:9', notes: 'Red practicals only. Smoke from 22:00. Playback on every take.',
    createdAt: Date.now(), updatedAt: Date.now(),
    scenes: [
      { id: uid(), number: '1', heading: 'EXT. ROUF RAILWAY - NIGHT', shots: [
        shot('EWS', 'high', 'drone', '24mm', 'The yard from above, the red glow on the rails, a train idles', '', 12, 'Start at 21:30, after the last train', 'wide', true),
        shot('MS', 'eye', 'steadicam', '35mm', 'The singer walks between the rails towards camera', 'Singer', 20, 'Lead back with the Steadicam', 'walk', true),
        shot('CU', 'low', 'handheld', '85mm', 'Red light on one side of the face, she sings the chorus', 'Singer', 15, '', 'face'),
        shot('INS', 'high', 'static', '100mm', 'Her hand slides along the cold rail', 'Singer', 6, 'Macro, focus pull', 'hand'),
      ] },
      { id: uid(), number: '2', heading: 'INT. OLD WAGON - NIGHT', shots: [
        shot('OTS', 'eye', 'dolly', '50mm', 'Over her shoulder: the empty wagon, windows lit red', 'Singer', 10, '', 'wagon'),
        shot('POV', 'eye', 'push', '28mm', 'Her point of view down the tunnel of light', '', 8, 'Slow push, 2 m of track', 'pov'),
        shot('ECU', 'eye', 'static', '100mm', 'Eyes open on the last beat', 'Singer', 4, 'End of the video', 'eyes'),
      ] },
    ],
  }
}

let seeded = false
function seed() {
  if (seeded) return
  seeded = true
  const p = sample()
  store.set(p.id, p)
}

const imagesIn = (p: Project) => [...new Set(p.scenes.flatMap((sc) => sc.shots.map((s) => s.image)).filter(Boolean))]
const page = (id: string, mode: PrintMode, labels: PrintLabels, screen: boolean) => {
  const p = store.get(id)
  return p ? printHtml(p, mode, labels, (f) => images.get(f) || '', screen) : ''
}
const noop = () => () => {}

export const demoApi: ListApi & { update: any } = {
  platform: 'web',
  imageSrc: (_pid, file) => images.get(file) || '',
  async list() {
    seed()
    return [...store.values()].map((p) => {
      let shots = 0, done = 0, cover = ''
      for (const sc of p.scenes) for (const s of sc.shots) { shots++; if (s.done) done++; if (!cover && s.image) cover = s.image }
      return { id: p.id, title: p.title, date: p.date, updatedAt: p.updatedAt, shots, done, cover }
    }).sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async get(id) { seed(); const p = store.get(id); return p ? structuredClone(p) : null },
  async create(title) {
    const p = clean({ title, scenes: [{ number: '1', heading: '', shots: [{}] }] }, uid())
    store.set(p.id, p)
    return structuredClone(p)
  },
  async save(p) { store.set(p.id, { ...structuredClone(p), updatedAt: Date.now() }) },
  saveNow(p) { store.set(p.id, structuredClone(p)) },
  async duplicate(id, title) {
    const src = store.get(id)!
    const copy = { ...structuredClone(src), id: uid(), title, updatedAt: Date.now() }
    store.set(copy.id, copy)
    return structuredClone(copy)
  },
  async remove(id) { store.delete(id) },
  async saveImage(_pid, bytes, ext) {
    const name = `${uid()}.${ext}`
    const b = new Blob([bytes], { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` })
    images.set(name, await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b) }))
    return name
  },
  async exportPdf(id, mode, labels) {
    const html = page(id, mode, labels, false)
    if (!html) return false
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    f.srcdoc = html
    document.body.appendChild(f)
    await new Promise((ok) => { f.onload = ok })
    f.contentWindow!.focus(); f.contentWindow!.print()
    setTimeout(() => f.remove(), 1000)
    return true
  },
  async exportHtml(id, mode, labels) {
    const html = page(id, mode, labels, true)
    if (!html) return false
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'RoarList demo.html'
    document.body.appendChild(a); a.click(); a.remove()
    return true
  },
  async exportFile(id) {
    const p = store.get(id)
    if (!p) return false
    const imgs: Record<string, string> = {}
    for (const f of imagesIn(p)) { const u = images.get(f); if (u) imgs[f] = u.slice(u.indexOf(',') + 1) }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: 'roarlist', version: 1, project: p, images: imgs })], { type: 'application/json' }))
    a.download = 'RoarList demo.roarlist'
    document.body.appendChild(a); a.click(); a.remove()
    return true
  },
  async importFile() { return null },
  onMenu: noop,
  onOpened: noop,
  update: { state: async () => ({ status: 'idle', version: '', progress: 0 }), install: async () => false, on: noop },
}
