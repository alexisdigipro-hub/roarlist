// The desktop implementation of ListApi: each call goes over IPC to the main process.
// The page gets this object only; it never sees Node or the disk.
import { contextBridge, ipcRenderer } from 'electron'
import type { ListApi, MenuCommand, Project } from '../shared/api'

const call = (name: string) => (...args: unknown[]) => ipcRenderer.invoke(`list:${name}`, ...args)
const listen = <T>(channel: string) => (cb: (v: T) => void) => {
  const h = (_e: unknown, v: T) => cb(v)
  ipcRenderer.on(channel, h)
  return () => { ipcRenderer.removeListener(channel, h) }
}

const api: ListApi & { update: Record<string, (...a: any[]) => any> } = {
  platform: process.platform,
  list: call('list') as ListApi['list'],
  get: call('get') as ListApi['get'],
  create: call('create') as ListApi['create'],
  save: call('save') as ListApi['save'],
  saveNow: (p) => { ipcRenderer.sendSync('list:save-sync', p) },
  duplicate: call('duplicate') as ListApi['duplicate'],
  remove: call('remove') as ListApi['remove'],
  saveImage: call('saveImage') as ListApi['saveImage'],
  exportPdf: call('exportPdf') as ListApi['exportPdf'],
  exportHtml: call('exportHtml') as ListApi['exportHtml'],
  exportFile: call('exportFile') as ListApi['exportFile'],
  importFile: call('importFile') as ListApi['importFile'],
  onMenu: listen<MenuCommand>('list:menu'),
  onOpened: listen<Project>('list:opened'),
  update: {
    state: () => ipcRenderer.invoke('list:update-state'),
    install: () => ipcRenderer.invoke('list:update-install'),
    on: listen<unknown>('list:update'),
  },
}

contextBridge.exposeInMainWorld('roarlist', api)
