/**
 * La boutique Stim : recherche, fiches et rayons des jeux, par notre relais /api/steam
 * (données publiques de la boutique Steam). Gardés en mémoire pendant la visite.
 */
const cache = new Map()
function get(params) {
  const k = JSON.stringify(params)
  if (!cache.has(k)) {
    cache.set(k, fetch('/api/steam?' + new URLSearchParams(params)).then(async r => {
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'La boutique ne répond pas')
      return d
    }).catch(e => { cache.delete(k); throw e }))
  }
  return cache.get(k)
}

export const searchGames = q => get({ q }).then(d => d.results || [])
export const gameDetails = id => get({ id: String(id) })
export const featuredGames = () => get({ featured: '1' })

/** « 59,99 € », « Gratuit » */
export const fmtPrice = p => (p == null ? '—' : p === 0 ? 'Gratuit' : `${p.toFixed(2).replace('.', ',')} €`)
