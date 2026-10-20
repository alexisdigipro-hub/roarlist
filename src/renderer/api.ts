// The door the screens use: the desktop app's preload puts it on window.roarlist; in a browser it is the web store
// (the account's cloud), or at #demo the Lab's sample kept in memory.
import { demoApi } from './demo-api'
import { webApi } from './web-api'

export const isDemo = !window.roarlist && location.hash === '#demo'
if (!window.roarlist) (window as any).roarlist = isDemo ? demoApi : webApi
export const api = window.roarlist
export const isWeb = api.platform === 'web'
