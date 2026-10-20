import { createRoot } from 'react-dom/client'
import { api } from './api'
import '@fontsource/jost/300.css'
import '@fontsource/jost/700.css'
import './styles.css'
import App from './App'
import { apply } from './settings'

document.documentElement.dataset.platform = api.platform
apply()
createRoot(document.getElementById('root')!).render(<App />)
