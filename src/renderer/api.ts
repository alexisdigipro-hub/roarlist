// The door the screens use: the desktop app's preload puts it on window.roarlist; in a browser it is the web store.
import { webApi } from './web-api'

if (!window.roarlist) (window as any).roarlist = webApi
export const api = window.roarlist
export const isWeb = api.platform === 'web'
