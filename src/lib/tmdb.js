/**
 * Séries (TMDB) : recherche et fiches passent par notre relais /api/tmdb (la clé reste sur
 * le serveur) ; les images viennent de image.tmdb.org (directement pour les pages, par le
 * relais /api/cover pour la télé 3D, qui en a besoin sans restriction d'origine).
 */
import { relayUrl } from './covers'

const IMG = 'https://image.tmdb.org/t/p/'

/** Adresse d'une image TMDB (chemin « /abc.jpg ») ; une adresse complète est gardée telle quelle. */
export function tmdbImg(path, size = 'w500') {
  if (!path) return null
  return path.startsWith('/') && !path.startsWith('//') ? IMG + size + path : path
}

/** Même image, utilisable dans un canevas WebGL (relais, sauf pour nos propres adresses). */
export function tmdbImgCors(path, size = 'w780') {
  const u = tmdbImg(path, size)
  if (!u) return null
  return u.startsWith(IMG) ? relayUrl(u) : u
}

async function get(params) {
  const r = await fetch('/api/tmdb?' + new URLSearchParams(params))
  let data = null
  try { data = await r.json() } catch { /* ignore */ }
  if (!r.ok) throw new Error(data?.error || 'Recherche indisponible')
  return data
}

export const searchSeries = q => get({ q }).then(d => d.results || [])
export const seriesDetails = id => get({ id: String(id) })

export const year = s => (s?.first_air_date || '').slice(0, 4)

const imgCache = new Map()
/** Charge une image (une seule fois) ; résout avec l'image décodée, ou null. */
export function loadImage(src) {
  if (!src) return Promise.resolve(null)
  if (imgCache.has(src)) return imgCache.get(src)
  const p = new Promise(resolve => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.decoding = 'async'
    im.onload = () => resolve(im)
    im.onerror = () => resolve(null)
    im.src = src
  })
  imgCache.set(src, p)
  return p
}
