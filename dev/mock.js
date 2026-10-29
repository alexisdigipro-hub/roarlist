// local test only: an in-memory "desktop" api so the app runs without an account (see dev/README.md)
const db = new Map(), imgs = new Map()
const ok = (v) => Promise.resolve(v)
const now = () => Date.now()
const shot = () => ({ id: crypto.randomUUID(), size: '', angle: '', move: '', lens: '', description: '', cast: '', duration: 0, notes: '', image: '', done: false })
window.roarlist = {
  platform: 'darwin',
  imageSrc: (p, f) => imgs.get(p + '/' + f) || '',
  list: () => ok([...db.values()].map(p => ({ id: p.id, title: p.title, date: p.date, updatedAt: p.updatedAt, shots: p.scenes.reduce((n, s) => n + s.shots.length, 0), done: 0, cover: '' }))),
  get: (id) => ok(structuredClone(db.get(id) || null)),
  create: (title) => { const id = crypto.randomUUID(); const p = { id, title, client: '', director: '', dop: '', date: '', aspect: '16:9', notes: '', createdAt: now(), updatedAt: now(), scenes: [{ id: crypto.randomUUID(), number: '1', heading: '', shots: [shot()] }] }; db.set(id, p); return ok(structuredClone(p)) },
  save: (p) => { db.set(p.id, structuredClone(p)); return ok() }, saveNow: (p) => db.set(p.id, p),
  duplicate: () => ok(null), remove: (id) => { db.delete(id); return ok() },
  saveImage: async (p, bytes, ext) => { const n = crypto.randomUUID() + '.' + ext; imgs.set(p + '/' + n, URL.createObjectURL(new Blob([bytes]))); return n },
  exportPdf: () => ok(false), exportHtml: () => ok(false), exportFile: () => ok(false), importFile: () => ok(null),
  onMenu: () => () => {}, onOpened: () => () => {},
  update: { state: () => ok({ status: 'idle' }), install: () => ok(false), on: () => () => {} },
}
