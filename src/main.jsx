import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { initTheme } from './lib/theme'
import { lockViewport } from './lib/lockViewport'

document.body.classList.add('app-shell')
lockViewport()   // téléphone : ni zoom, ni page qui glisse de côté
initTheme()     // clair ou sombre, comme les rideaux du salon l'ont laissé

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
