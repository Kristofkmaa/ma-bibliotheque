/**
 * Le thème du site, clair ou sombre, piloté par les rideaux du salon : rideaux fermés, tout le
 * site passe en sombre (bibliothèque comprise) ; ouverts, il redevient clair. Gardé d'une visite
 * à l'autre.
 */
const KEY = 'levana.salon.rideaux'

export function isDarkSaved() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function applyTheme(dark) {
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#121110' : '#EDEBE6')
  window.dispatchEvent(new CustomEvent('maruchime-theme', { detail: { dark } }))
}

export const initTheme = () => applyTheme(isDarkSaved())
