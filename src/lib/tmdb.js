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

/** Recherche : séries (« tv ») ou films (« movie »). */
export const searchSeries = (q, media = 'tv') => get({ q, type: media }).then(d => d.results || [])
export const seriesDetails = (id, media = 'tv') => get({ id: String(id), type: media })
export const isMovie = s => s?.media === 'movie'
/** Clé unique d'une œuvre : un film et une série peuvent avoir le même numéro chez TMDB. */
export const workKey = s => (isMovie(s) ? 'm' : 't') + s.tmdb_id
/** « 2 h 05 » */
export const runtimeLabel = m => (m ? (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`) : '')

const imageCache = new Map()
/** Les grandes images d'une œuvre (pour les faire défiler derrière son titre). */
export function seriesImages(tmdbId, media = 'tv') {
  const k = media + tmdbId
  if (!imageCache.has(k)) {
    const p = get({ images: String(tmdbId), type: media }).then(d => d.backdrops || [], () => { imageCache.delete(k); return [] })
    imageCache.set(k, p)
  }
  return imageCache.get(k)
}

const videoCache = new Map()
/** Les vidéos d'une série (générique d'abord, sinon bandes-annonces), gardées en mémoire. */
export function seriesVideos(tmdbId, media = 'tv') {
  const k = media + tmdbId
  if (!videoCache.has(k)) {
    const p = get({ videos: String(tmdbId), type: media }).then(d => d.videos || [], () => { videoCache.delete(k); return [] })
    videoCache.set(k, p)
  }
  return videoCache.get(k)
}

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
