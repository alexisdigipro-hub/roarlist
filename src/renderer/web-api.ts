// The web implementation of ListApi (themadlions.com/roarlist): shot lists live in the signed-in person's cloud
// (table roarlist_projects, pictures in the private bucket roarlist-images under <user>/<project>/<file>).
// PDF goes through the browser's print dialog ("Save as PDF").
// Shot lists made in this browser before accounts (IndexedDB) move into the account on the first sign-in.
import type { ListApi, PrintLabels, PrintMode, Project, ProjectSummary } from '../shared/api'
import { IMG, clean, newScene } from '../shared/clean'
import { printHtml } from '../shared/print'
import { sb, uid as me } from './cloud'

const BUCKET = 'roarlist-images'
const uid = () => crypto.randomUUID()
const urls = new Map<string, string>() // object URLs of pictures already downloaded
const blobs = new Map<string, Blob>()
const path = (pid: string, file: string) => `${me()}/${pid}/${file}`

function must<T>(r: { data: T; error: any }): T {
  if (r.error) throw r.error
  return r.data
}

async function blobOf(pid: string, file: string): Promise<Blob | undefined> {
  const key = `${pid}/${file}`
  if (blobs.has(key)) return blobs.get(key)
  const { data } = await sb.storage.from(BUCKET).download(path(pid, file))
  if (data) blobs.set(key, data)
  return data || undefined
}
const toDataUrl = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(''); r.readAsDataURL(b) })
const b64 = (data: string) => data.slice(data.indexOf(',') + 1)
const imagesIn = (p: Project) => [...new Set(p.scenes.flatMap((sc) => sc.shots.map((s) => s.image)).filter(Boolean))]

function summary(p: Project): ProjectSummary {
  let shots = 0, done = 0, cover = ''
  for (const sc of p.scenes) for (const s of sc.shots) { shots++; if (s.done) done++; if (!cover && s.image) cover = s.image }
  return { id: p.id, title: p.title, date: p.date, updatedAt: p.updatedAt, shots, done, cover }
}

async function get(id: string): Promise<Project | null> {
  const row = must(await sb.from('roarlist_projects').select('data').eq('id', id).maybeSingle())
  return row ? clean(row.data, id) : null
}

async function save(p: Project) {
  const data = { ...clean(p, p.id), updatedAt: Date.now() }
  const updated = must(await sb.from('roarlist_projects').update({ data }).eq('id', p.id).select('id'))
  if (!updated?.length) must(await sb.from('roarlist_projects').insert({ id: p.id, data }))
}

async function listFiles(pid: string) {
  const { data } = await sb.storage.from(BUCKET).list(`${me()}/${pid}`, { limit: 1000 })
  return (data || []).map((f) => f.name)
}

// pictures no shot uses any more go when the project is opened
async function sweep(p: Project) {
  const used = new Set(imagesIn(p))
  const gone = (await listFiles(p.id)).filter((f) => !used.has(f))
  if (gone.length) await sb.storage.from(BUCKET).remove(gone.map((f) => path(p.id, f)))
}

async function putImage(pid: string, name: string, blob: Blob) {
  must(await sb.storage.from(BUCKET).upload(path(pid, name), blob, { contentType: blob.type, upsert: true }))
  blobs.set(`${pid}/${name}`, blob)
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
  await Promise.all(imagesIn(p).map(async (f) => { const b = await blobOf(id, f); if (b) data[f] = await toDataUrl(b) }))
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

const mimeOf = (name: string) => `image/${name.split('.').pop()!.replace('jpg', 'jpeg')}`

// a project from a .roarlist file (or from this browser's old storage) becomes a new one in the account
async function adopt(raw: unknown, images: Record<string, Blob>): Promise<Project> {
  const id = uid()
  const p = clean(raw, id)
  const have = new Set<string>()
  for (const [name, blob] of Object.entries(images)) {
    if (!IMG.test(name)) continue
    await putImage(id, name, blob.type ? blob : new Blob([blob], { type: mimeOf(name) }))
    have.add(name)
  }
  p.scenes = p.scenes.map((sc) => ({ ...sc, id: uid(), shots: sc.shots.map((x) => ({ ...x, id: uid(), image: have.has(x.image) ? x.image : '' })) }))
  await save(p)
  return (await get(id))!
}

async function unpack(text: string): Promise<Project> {
  const data = JSON.parse(text)
  if (data?.format !== 'roarlist' || !data.project) throw new Error('not a RoarList file')
  const images: Record<string, Blob> = {}
  for (const [name, enc] of Object.entries(data.images || {})) {
    if (typeof enc !== 'string') continue
    images[name] = new Blob([Uint8Array.from(atob(enc), (c) => c.charCodeAt(0))], { type: mimeOf(name) })
  }
  return adopt(data.project, images)
}

/* ---------- shot lists from before accounts, kept in this browser's IndexedDB ---------- */
function openLegacy(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    const r = indexedDB.open('roarlist', 1)
    r.onupgradeneeded = () => { r.transaction?.abort(); ok(null) } // never made: nothing to move
    r.onsuccess = () => ok(r.result)
    r.onerror = () => ok(null)
  })
}
const idb = <T>(r: IDBRequest<T>) => new Promise<T>((ok, bad) => { r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error) })

export async function importLegacy(): Promise<number> {
  const db = await openLegacy()
  if (!db || !db.objectStoreNames.contains('projects')) return 0
  const all = (await idb(db.transaction('projects').objectStore('projects').getAll())) as any[]
  let n = 0
  for (const raw of all) {
    const images: Record<string, Blob> = {}
    const s = db.transaction('images').objectStore('images')
    const keys = (await idb(s.getAllKeys(IDBKeyRange.bound(`${raw.id}/`, `${raw.id}/￿`)))) as string[]
    for (const k of keys) {
      const b = (await idb(db.transaction('images').objectStore('images').get(k))) as Blob
      if (b) images[k.slice(raw.id.length + 1)] = b
    }
    await adopt({ ...raw, updatedAt: raw.updatedAt }, images)
    await idb(db.transaction('projects', 'readwrite').objectStore('projects').delete(raw.id))
    await idb(db.transaction('images', 'readwrite').objectStore('images').delete(IDBKeyRange.bound(`${raw.id}/`, `${raw.id}/￿`)))
    n++
  }
  db.close()
  return n
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
    const rows = must(await sb.from('roarlist_projects').select('id, data').order('updated_at', { ascending: false }))
    return (rows || []).map((r: any) => summary(clean(r.data, r.id))).sort((a, b) => b.updatedAt - a.updatedAt)
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
    for (const f of imagesIn(src)) await sb.storage.from(BUCKET).copy(path(id, f), path(copy.id, f))
    await save(copy)
    return (await get(copy.id))!
  },
  async remove(id) {
    must(await sb.from('roarlist_projects').delete().eq('id', id))
    const files = await listFiles(id)
    if (files.length) await sb.storage.from(BUCKET).remove(files.map((f) => path(id, f)))
  },
  async saveImage(pid, bytes, ext) {
    const e = String(ext).toLowerCase().replace('jpeg', 'jpg')
    if (!/^(png|jpg|webp|gif)$/.test(e)) throw new Error('unsupported image')
    const name = `${uid()}.${e}`
    const blob = new Blob([bytes], { type: mimeOf(name) })
    await putImage(pid, name, blob)
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

// settings follow the account
export async function loadAccountSettings() {
  const row = must(await sb.from('roarlist_settings').select('data').maybeSingle())
  return (row?.data || null) as Record<string, unknown> | null
}
export async function saveAccountSettings(data: unknown) {
  const updated = must(await sb.from('roarlist_settings').update({ data }).eq('id', me()).select('id'))
  if (!updated?.length) must(await sb.from('roarlist_settings').insert({ data }))
}
