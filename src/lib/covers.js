/**
 * Couvertures : adresses (relais /api/cover pour la 3D, image directe, Open Library)
 * et préchargement. Chaque couverture n'est téléchargée qu'une fois : la recherche, le panier
 * et la bibliothèque 3D réutilisent la même image déjà décodée.
 */

const rawCover = b => (b?.cover_url || b?.cover || '').replace('http://', 'https://')

export const relayUrl = src => `/api/cover?url=${encodeURIComponent(src)}`

export function coverKey(b) {
  const raw = rawCover(b)
  if (raw) return raw
  return b?.isbn ? `isbn:${b.isbn}` : null
}

export function coverCandidates(b) {
  const raw = rawCover(b)
  const out = []
  if (raw) out.push(relayUrl(raw), raw)
  if (b?.isbn) out.push(`https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg?default=false`)
  return out
}

const pending = new Map() // clé → Promise<{ url, img } | null>

/** Lance (une seule fois) le téléchargement de la couverture ; la promesse donne l'image prête. */
export function preloadCover(b) {
  const key = coverKey(b)
  if (!key) return Promise.resolve(null)
  if (pending.has(key)) return pending.get(key)
  const list = coverCandidates(b)
  const p = new Promise(resolve => {
    const tryNext = i => {
      if (i >= list.length) { resolve(null); return }
      const img = new Image()
      img.crossOrigin = 'anonymous'   // utilisable comme texture 3D
      img.decoding = 'async'
      img.onload = () => {
        if (img.naturalWidth < 20) { tryNext(i + 1); return } // image vide d'Open Library
        const done = () => resolve({ url: list[i], img })
        img.decode ? img.decode().then(done, done) : done()
      }
      img.onerror = () => tryNext(i + 1)
      img.src = list[i]
    }
    tryNext(0)
  })
  pending.set(key, p)
  return p
}

/** Adresse à afficher dans une balise <img> (celle qui a fonctionné, sinon la meilleure). */
export function displayCoverUrl(b) {
  const list = coverCandidates(b)
  return list[0] || ''
}
