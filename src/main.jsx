import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { initTheme } from './lib/theme'

document.body.classList.add('app-shell')
initTheme()     // clair ou sombre, comme les rideaux du salon l'ont laissé

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
