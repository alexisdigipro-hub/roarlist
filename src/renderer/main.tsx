import { createRoot } from 'react-dom/client'
import { api } from './api'
import '@fontsource/jost/300.css'
import '@fontsource/jost/700.css'
import './styles.css'
import App from './App'

document.documentElement.dataset.platform = api.platform
createRoot(document.getElementById('root')!).render(<App />)
