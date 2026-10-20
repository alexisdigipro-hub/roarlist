// RoarList's main process: the window, the shot lists on disk, images, PDF and file export, the menu.
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, net, protocol, shell } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import * as store from './store'
import { printHtml } from '../shared/print'
import type { MenuCommand, PrintLabels, PrintMode } from '../shared/api'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const updater = require('./updater.js')

if (!app.requestSingleInstanceLock()) app.quit()

// the screens show a shot's frame as roarimg://p/<project>/<file>; only files inside a project's images folder answer
protocol.registerSchemesAsPrivileged([{ scheme: 'roarimg', privileges: { standard: true, secure: true, supportFetchAPI: true } }])

let win: BrowserWindow | null = null
let quitting = false
let pendingOpen: string | null = null

function show() {
  if (!win) return createWindow()
  if (win.isMinimized()) win.restore()
  win.show(); win.focus()
}

function createWindow() {
  const mac = process.platform === 'darwin'
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 600, show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f2328' : '#eceef1',
    title: 'RoarList',
    ...(mac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 18 } }
      : { titleBarStyle: 'hidden' as const, titleBarOverlay: { color: '#2a2f36', symbolColor: '#eef0f3', height: 40 } }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true,
    },
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  win.once('ready-to-show', () => win?.show())
  win.webContents.setWindowOpenHandler(({ url }) => { openSafe(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); openSafe(url) } })
  win.on('close', (e) => { if (process.platform === 'darwin' && !quitting) { e.preventDefault(); win?.hide() } })
  win.on('closed', () => { win = null })
  win.webContents.on('did-finish-load', () => { if (pendingOpen) { openRoarlist(pendingOpen); pendingOpen = null } })
}

function openSafe(url: string) {
  if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url)
}

const menu = (c: MenuCommand) => { show(); win?.webContents.send('list:menu', c) }

// a .roarlist double-clicked in Finder / Explorer becomes a new shot list
function openRoarlist(file: string) {
  if (!/\.roarlist$/i.test(file)) return
  if (!win || win.webContents.isLoading()) { pendingOpen = file; return }
  try {
    const p = store.unpack(fs.readFileSync(file, 'utf8'))
    win.webContents.send('list:opened', p)
    show()
  } catch (e: any) {
    dialog.showErrorBox('RoarList', String(e?.message || e))
  }
}

const safeName = (s: string) => (s || 'RoarList').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'RoarList'

async function askSave(name: string, ext: string, label: string) {
  const r = await dialog.showSaveDialog(win!, { defaultPath: path.join(app.getPath('documents'), `${safeName(name)}.${ext}`), filters: [{ name: label, extensions: [ext] }] })
  return r.canceled || !r.filePath ? null : r.filePath
}

async function exportPdf(id: string, mode: PrintMode, labels: PrintLabels) {
  const p = store.get(id)
  if (!p) return false
  const file = await askSave(`${p.title}${mode === 'board' ? ' storyboard' : ''}`, 'pdf', 'PDF')
  if (!file) return false
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roarlist-'))
  const page = path.join(dir, 'print.html')
  fs.writeFileSync(page, printHtml(p, mode, labels, (f) => pathToFileURL(store.imagePath(id, f)).href))
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
  try {
    await w.loadFile(page)
    // let the frames finish decoding before the page is printed
    await new Promise((ok) => setTimeout(ok, 300))
    const pdf = await w.webContents.printToPDF({ landscape: true, pageSize: labels.paper === 'Letter' ? 'Letter' : 'A4', printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font:7px Helvetica,Arial;color:#8a857b;padding:0 12mm;display:flex;justify-content:space-between"><span>${(p.title || '').replace(/[<>&]/g, '')}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` })
    fs.writeFileSync(file, pdf)
    shell.openPath(file)
    return true
  } finally {
    w.destroy()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

app.on('open-file', (e, file) => { e.preventDefault(); if (app.isReady()) openRoarlist(file); else pendingOpen = file })
app.on('second-instance', (_e, argv) => { const f = argv.find((a) => /\.roarlist$/i.test(a)); if (f) openRoarlist(f); show() })
app.on('activate', () => show())
app.on('before-quit', () => { quitting = true })

app.whenReady().then(() => {
  app.setName('RoarList')
  const startFile = process.argv.find((a) => /\.roarlist$/i.test(a))
  if (startFile) pendingOpen = startFile

  protocol.handle('roarimg', (req) => {
    try {
      const u = new URL(req.url)
      const [, id, file] = u.pathname.split('/')
      return net.fetch(pathToFileURL(store.imagePath(id, decodeURIComponent(file))).href)
    } catch {
      return new Response('', { status: 404 })
    }
  })

  ipcMain.handle('list:list', () => store.list())
  ipcMain.handle('list:get', (_e, id: string) => { store.sweep(id); return store.get(id) })
  ipcMain.handle('list:create', (_e, title: string) => store.create(String(title || '')))
  ipcMain.handle('list:save', (_e, p) => store.save(p))
  ipcMain.on('list:save-sync', (e, p) => { try { store.save(p) } catch { /* keep closing */ } e.returnValue = true })
  ipcMain.handle('list:duplicate', (_e, id: string, title: string) => store.duplicate(id, String(title || '')))
  ipcMain.handle('list:remove', (_e, id: string) => store.remove(id))
  ipcMain.handle('list:saveImage', (_e, id: string, bytes: ArrayBuffer, ext: string) => store.saveImage(id, Buffer.from(bytes), ext))
  ipcMain.handle('list:exportPdf', (_e, id: string, mode: PrintMode, labels: PrintLabels) => exportPdf(id, mode, labels))
  ipcMain.handle('list:exportHtml', async (_e, id: string, mode: PrintMode, labels: PrintLabels) => {
    const p = store.get(id)
    if (!p) return false
    const file = await askSave(p.title, 'html', 'Web page')
    if (!file) return false
    fs.writeFileSync(file, printHtml(p, mode, labels, (f) => store.dataUrl(id, f), true))
    shell.showItemInFolder(file)
    return true
  })
  ipcMain.handle('list:exportFile', async (_e, id: string) => {
    const p = store.get(id)
    if (!p) return false
    const file = await askSave(p.title, 'roarlist', 'RoarList')
    if (!file) return false
    fs.writeFileSync(file, JSON.stringify(store.pack(id)))
    shell.showItemInFolder(file)
    return true
  })
  ipcMain.handle('list:importFile', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'RoarList', extensions: ['roarlist'] }] })
    if (r.canceled || !r.filePaths[0]) return null
    return store.unpack(fs.readFileSync(r.filePaths[0], 'utf8'))
  })

  createWindow()
  updater.start(ipcMain, () => { quitting = true })

  const mac = process.platform === 'darwin'
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{
      label: 'RoarList',
      submenu: [
        { role: 'about' as const }, { type: 'separator' as const },
        { label: 'Settings…', accelerator: 'Cmd+,', click: () => menu('settings') },
        { type: 'separator' as const }, { role: 'hide' as const }, { role: 'hideOthers' as const }, { role: 'unhide' as const },
        { type: 'separator' as const }, { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Shot List', accelerator: 'CmdOrCtrl+N', click: () => menu('new') },
        { label: 'Open .roarlist…', accelerator: 'CmdOrCtrl+O', click: () => menu('import') },
        { type: 'separator' },
        { label: 'Export PDF (List)…', accelerator: 'CmdOrCtrl+P', click: () => menu('export-pdf') },
        { label: 'Export PDF (Storyboard)…', accelerator: 'CmdOrCtrl+Shift+P', click: () => menu('export-board') },
        { label: 'Export Web Page…', click: () => menu('export-html') },
        { label: 'Save as .roarlist…', accelerator: 'CmdOrCtrl+Shift+S', click: () => menu('export-file') },
        { type: 'separator' },
        ...(mac ? [] : [{ label: 'Settings…', accelerator: 'Ctrl+,', click: () => menu('settings') }, { type: 'separator' as const }]),
        mac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Shots',
      submenu: [
        { label: 'Add Shot', accelerator: 'CmdOrCtrl+Return', click: () => menu('add-shot') },
        { label: 'Add Scene', accelerator: 'CmdOrCtrl+Shift+Return', click: () => menu('add-scene') },
      ],
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]))
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
