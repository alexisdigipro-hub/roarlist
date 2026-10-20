// The web implementation of ListApi (themadlions.com/roarlist): shot lists and their pictures live in this browser
// (IndexedDB), nothing goes to a server. PDF goes through the browser's print dialog ("Save as PDF").
import type { ListApi, PrintLabels, PrintMode, Project, ProjectSummary } from '../shared/api'
import { IMG, clean, newScene } from '../shared/clean'
import { printHtml } from '../shared/print'

const DB = 'roarlist'
let dbp: Promise<IDBDatabase> | null = null
const db = () => (dbp ||= new Promise((ok, bad) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => {
    r.result.createObjectStore('projects', { keyPath: 'id' })
    r.result.createObjectStore('images') // key: <project>/<file>, value: Blob
  }
  r.onsuccess = () => ok(r.result)
  r.onerror = () => bad(r.error)
}))

const req = <T>(r: IDBRequest<T>) => new Promise<T>((ok, bad) => { r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error) })
async function store(name: 'projects' | 'images', mode: IDBTransactionMode = 'readonly') {
  return (await db()).transaction(name, mode).objectStore(name)
}

const uid = () => crypto.randomUUID()
const urls = new Map<string, string>() // object URLs of pictures already read

async function blobOf(pid: string, file: string): Promise<Blob | undefined> {
  return req((await store('images')).get(`${pid}/${file}`)) as Promise<Blob | undefined>
}
const toDataUrl = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(''); r.readAsDataURL(b) })
const b64 = (data: string) => data.slice(data.indexOf(',') + 1)

function imagesIn(p: Project) {
  return [...new Set(p.scenes.flatMap((sc) => sc.shots.map((s) => s.image)).filter(Boolean))]
}

async function get(id: string): Promise<Project | null> {
  const raw = await req((await store('projects')).get(id))
  return raw ? clean(raw, id) : null
}

async function save(p: Project) {
  await req((await store('projects', 'readwrite')).put({ ...clean(p, p.id), updatedAt: Date.now() }))
}

// pictures no shot uses any more go when the project is opened
async function sweep(p: Project) {
  const used = new Set(imagesIn(p))
  const s = await store('images', 'readwrite')
  const keys = (await req(s.getAllKeys(IDBKeyRange.bound(`${p.id}/`, `${p.id}/￿`)))) as string[]
  for (const k of keys) if (!used.has(k.slice(p.id.length + 1))) s.delete(k)
}

function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([data], { type }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 30e3)
}
const safeName = (s: string) => (s || 'RoarList').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'RoarList'

async function pageFor(id: string, mode: PrintMode, labels: PrintLabels, screen: boolean) {
  const p = await get(id)
  if (!p) return null
  const data: Record<string, string> = {}
  for (const f of imagesIn(p)) { const b = await blobOf(id, f); if (b) data[f] = await toDataUrl(b) }
  return { p, html: printHtml(p, mode, labels, (f) => data[f] || '', screen) }
}

function pickFile(accept: string) {
  return new Promise<File | null>((ok) => {
    const i = document.createElement('input')
    i.type = 'file'; i.accept = accept
    i.onchange = () => ok(i.files?.[0] || null)
    i.click()
  })
}

async function unpack(text: string): Promise<Project> {
  const data = JSON.parse(text)
  if (data?.format !== 'roarlist' || !data.project) throw new Error('not a RoarList file')
  const id = uid()
  const p = clean(data.project, id)
  const s = await store('images', 'readwrite')
  const have = new Set<string>()
  for (const [name, enc] of Object.entries(data.images || {})) {
    if (!IMG.test(name) || typeof enc !== 'string') continue
    const bin = Uint8Array.from(atob(enc), (c) => c.charCodeAt(0))
    const ext = name.split('.').pop()!.replace('jpg', 'jpeg')
    s.put(new Blob([bin], { type: `image/${ext}` }), `${id}/${name}`)
    have.add(name)
  }
  p.scenes = p.scenes.map((sc) => ({ ...sc, id: uid(), shots: sc.shots.map((x) => ({ ...x, id: uid(), image: have.has(x.image) ? x.image : '' })) }))
  await save(p)
  return (await get(id))!
}

const noop = () => () => {}

export const webApi: ListApi & { update: any } = {
  platform: 'web',
  imageSrc(pid, file) {
    const key = `${pid}/${file}`
    const u = urls.get(key)
    if (u) return u
    return blobOf(pid, file).then((b) => {
      if (!b) return ''
      const url = URL.createObjectURL(b)
      urls.set(key, url)
      return url
    })
  },
  async list() {
    const all = (await req((await store('projects')).getAll())) as any[]
    return all.map((raw): ProjectSummary => {
      const p = clean(raw, raw.id)
      let shots = 0, done = 0, cover = ''
      for (const sc of p.scenes) for (const s of sc.shots) { shots++; if (s.done) done++; if (!cover && s.image) cover = s.image }
      return { id: p.id, title: p.title, date: p.date, updatedAt: p.updatedAt, shots, done, cover }
    }).sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async get(id) {
    const p = await get(id)
    if (p) sweep(p).catch(() => {})
    return p
  },
  async create(title) {
    const now = Date.now()
    const p: Project = { id: uid(), title, client: '', director: '', dop: '', date: '', aspect: '16:9', notes: '', scenes: [newScene(1)], createdAt: now, updatedAt: now }
    await save(p)
    return p
  },
  save,
  saveNow(p) { save(p).catch(() => {}) },
  async duplicate(id, title) {
    const src = await get(id)
    if (!src) throw new Error('not found')
    const copy = { ...src, id: uid(), title, createdAt: Date.now() }
    for (const f of imagesIn(src)) {
      const b = await blobOf(id, f)
      if (b) await req((await store('images', 'readwrite')).put(b, `${copy.id}/${f}`))
    }
    await save(copy)
    return (await get(copy.id))!
  },
  async remove(id) {
    await req((await store('projects', 'readwrite')).delete(id))
    await req((await store('images', 'readwrite')).delete(IDBKeyRange.bound(`${id}/`, `${id}/￿`)))
  },
  async saveImage(pid, bytes, ext) {
    const e = String(ext).toLowerCase().replace('jpeg', 'jpg')
    if (!/^(png|jpg|webp|gif)$/.test(e)) throw new Error('unsupported image')
    const name = `${uid()}.${e}`
    const blob = new Blob([bytes], { type: `image/${e === 'jpg' ? 'jpeg' : e}` })
    await req((await store('images', 'readwrite')).put(blob, `${pid}/${name}`))
    urls.set(`${pid}/${name}`, URL.createObjectURL(blob))
    return name
  },
  // the printed page goes into a hidden frame and the browser's print dialog makes the PDF
  async exportPdf(id, mode, labels) {
    const page = await pageFor(id, mode, labels, false)
    if (!page) return false
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    f.srcdoc = page.html
    document.body.appendChild(f)
    await new Promise((ok) => { f.onload = ok })
    await new Promise((ok) => setTimeout(ok, 300))
    const title = document.title
    document.title = safeName(`${page.p.title}${mode === 'board' ? ' storyboard' : ''}`) // Chrome names the PDF after it
    f.contentWindow!.focus()
    f.contentWindow!.print()
    document.title = title
    setTimeout(() => f.remove(), 1000)
    return true
  },
  async exportHtml(id, mode, labels) {
    const page = await pageFor(id, mode, labels, true)
    if (!page) return false
    download(`${safeName(page.p.title)}.html`, page.html, 'text/html')
    return true
  },
  async exportFile(id) {
    const p = await get(id)
    if (!p) return false
    const images: Record<string, string> = {}
    for (const f of imagesIn(p)) { const b = await blobOf(id, f); if (b) images[f] = b64(await toDataUrl(b)) }
    download(`${safeName(p.title)}.roarlist`, JSON.stringify({ format: 'roarlist', version: 1, project: p, images }), 'application/json')
    return true
  },
  async importFile() {
    const f = await pickFile('.roarlist,application/json')
    return f ? unpack(await f.text()) : null
  },
  onMenu: noop,
  onOpened: noop,
  update: {
    state: async () => ({ status: 'idle', version: '', progress: 0 }),
    install: async () => false,
    on: noop,
  },
}
