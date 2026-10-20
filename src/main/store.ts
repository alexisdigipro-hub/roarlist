// Shot lists live on this computer: <userData>/projects/<id>/project.json plus an images folder.
// A .roarlist file is the same project in one JSON file with its images inside, to send to someone.
import { app, shell } from 'electron'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { Project, ProjectSummary, Scene, Shot } from '../shared/api'

const ID = /^[a-z0-9-]{8,40}$/
const IMG = /^[a-z0-9-]{8,40}\.(png|jpe?g|webp|gif)$/

export const root = () => path.join(app.getPath('userData'), 'projects')
const dirOf = (id: string) => {
  if (!ID.test(id)) throw new Error('bad project id')
  return path.join(root(), id)
}
const imagesOf = (id: string) => path.join(dirOf(id), 'images')
export const imagePath = (id: string, file: string) => {
  if (!IMG.test(file)) throw new Error('bad image name')
  return path.join(imagesOf(id), file)
}

export const uid = () => crypto.randomUUID()

export const newShot = (): Shot => ({ id: uid(), size: '', angle: '', move: '', lens: '', description: '', cast: '', duration: 0, notes: '', image: '', done: false })
export const newScene = (n: number): Scene => ({ id: uid(), number: String(n), heading: '', shots: [newShot()] })

// whatever comes from disk or a file someone sent: keep only what a project has, with the right types
function clean(raw: any, id: string): Project {
  const str = (x: any) => (typeof x === 'string' ? x : '')
  const shots = (a: any): Shot[] => (Array.isArray(a) ? a : []).map((s: any) => ({
    id: str(s?.id) || uid(), size: str(s?.size), angle: str(s?.angle), move: str(s?.move), lens: str(s?.lens),
    description: str(s?.description), cast: str(s?.cast), duration: Math.max(0, Number(s?.duration) || 0), notes: str(s?.notes),
    image: IMG.test(str(s?.image)) ? s.image : '', done: !!s?.done,
  }))
  return {
    id, title: str(raw?.title), client: str(raw?.client), director: str(raw?.director), dop: str(raw?.dop),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(raw?.date)) ? raw.date : '', aspect: str(raw?.aspect) || '16:9', notes: str(raw?.notes),
    scenes: (Array.isArray(raw?.scenes) ? raw.scenes : []).map((sc: any) => ({ id: str(sc?.id) || uid(), number: str(sc?.number), heading: str(sc?.heading), shots: shots(sc?.shots) })),
    createdAt: Number(raw?.createdAt) || Date.now(), updatedAt: Number(raw?.updatedAt) || Date.now(),
  }
}

function writeJson(file: string, data: unknown) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1))
  fs.renameSync(tmp, file)
}

export function get(id: string): Project | null {
  try { return clean(JSON.parse(fs.readFileSync(path.join(dirOf(id), 'project.json'), 'utf8')), id) } catch { return null }
}

export function list(): ProjectSummary[] {
  fs.mkdirSync(root(), { recursive: true })
  const out: ProjectSummary[] = []
  for (const id of fs.readdirSync(root())) {
    if (!ID.test(id)) continue
    const p = get(id)
    if (!p) continue
    let shots = 0, done = 0, cover = ''
    for (const sc of p.scenes) for (const s of sc.shots) { shots++; if (s.done) done++; if (!cover && s.image) cover = s.image }
    out.push({ id, title: p.title, date: p.date, updatedAt: p.updatedAt, shots, done, cover })
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function save(p: Project) {
  const d = dirOf(p.id)
  fs.mkdirSync(path.join(d, 'images'), { recursive: true })
  writeJson(path.join(d, 'project.json'), { ...clean(p, p.id), updatedAt: Date.now() })
}

export function create(title: string): Project {
  const now = Date.now()
  const p: Project = { id: uid(), title, client: '', director: '', dop: '', date: '', aspect: '16:9', notes: '', scenes: [newScene(1)], createdAt: now, updatedAt: now }
  save(p)
  return p
}

export function duplicate(id: string, title: string): Project {
  const src = get(id)
  if (!src) throw new Error('not found')
  const copy = { ...src, id: uid(), title, createdAt: Date.now() }
  fs.cpSync(imagesOf(id), imagesOf(copy.id), { recursive: true })
  save(copy)
  return get(copy.id)!
}

// to the system trash, so a slip can be undone from there
export async function remove(id: string) {
  const d = dirOf(id)
  if (fs.existsSync(d)) await shell.trashItem(d)
}

const EXT: Record<string, string> = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', gif: 'gif' }
export function saveImage(id: string, bytes: Buffer, ext: string) {
  const e = EXT[String(ext).toLowerCase().replace(/^\./, '')]
  if (!e) throw new Error('unsupported image')
  if (bytes.length > 40e6) throw new Error('image too large')
  fs.mkdirSync(imagesOf(id), { recursive: true })
  const name = `${uid()}.${e}`
  fs.writeFileSync(imagePath(id, name), bytes)
  return name
}

// images no shot uses any more go when the project is opened (not while editing, so a quick undo of a removal still works)
export function sweep(id: string) {
  const p = get(id)
  if (!p) return
  const used = new Set(p.scenes.flatMap((sc) => sc.shots.map((s) => s.image)).filter(Boolean))
  try { for (const f of fs.readdirSync(imagesOf(id))) if (!used.has(f)) fs.rmSync(path.join(imagesOf(id), f), { force: true }) } catch { /* no images yet */ }
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
export const mimeOf = (file: string) => MIME[file.split('.').pop()!.toLowerCase()] || 'application/octet-stream'
export const dataUrl = (id: string, file: string) => {
  try { return `data:${mimeOf(file)};base64,${fs.readFileSync(imagePath(id, file)).toString('base64')}` } catch { return '' }
}

export function pack(id: string) {
  const p = get(id)
  if (!p) throw new Error('not found')
  const images: Record<string, string> = {}
  for (const sc of p.scenes) for (const s of sc.shots) {
    if (s.image && !images[s.image]) try { images[s.image] = fs.readFileSync(imagePath(id, s.image)).toString('base64') } catch { /* missing */ }
  }
  return { format: 'roarlist', version: 1, project: p, images }
}

export function unpack(text: string): Project {
  const data = JSON.parse(text)
  if (data?.format !== 'roarlist' || !data.project) throw new Error('not a RoarList file')
  const id = uid()
  const p = clean(data.project, id)
  fs.mkdirSync(imagesOf(id), { recursive: true })
  for (const [name, b64] of Object.entries(data.images || {})) {
    if (IMG.test(name) && typeof b64 === 'string') fs.writeFileSync(imagePath(id, name), Buffer.from(b64, 'base64'))
  }
  for (const sc of p.scenes) for (const s of sc.shots) if (s.image && !fs.existsSync(imagePath(id, s.image))) s.image = ''
  // fresh ids so the same file can be opened twice
  p.scenes = p.scenes.map((sc) => ({ ...sc, id: uid(), shots: sc.shots.map((s) => ({ ...s, id: uid() })) }))
  save(p)
  return get(id)!
}
