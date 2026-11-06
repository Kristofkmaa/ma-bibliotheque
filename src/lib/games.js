/**
 * Le catalogue des jeux : IGDB (toutes les plateformes) par notre relais /api/igdb ; tant que
 * ses identifiants ne sont pas réglés dans Vercel (ou s'il ne répond pas), la boutique Steam
 * (/api/steam) prend le relais. Tout est ramené à une même forme :
 *   { key, igdb_id, app_id (Steam), name, cover, hero, year, date, platforms, genres, rating, … }
 */
const cache = new Map()
function get(path, params) {
  const k = path + JSON.stringify(params)
  if (!cache.has(k)) {
    cache.set(k, fetch(`/api/${path}?` + new URLSearchParams(params)).then(async r => {
      const d = await r.json().catch(() => null)
      if (!r.ok || !d) throw Object.assign(new Error(d?.error || 'Le catalogue ne répond pas'), { status: r.ok ? 503 : r.status })
      return d
    }).catch(e => { cache.delete(k); throw e }))
  }
  return cache.get(k)
}

const IMG = 'https://images.igdb.com/igdb/image/upload/'
export const igdbImg = (id, size = 'cover_big') => (id ? `${IMG}t_${size}/${id}.jpg` : null)
const steamArt = (id, f) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/${f}`

// IGDB ne répond pas (pas encore de clés) : on passe à Steam pour toute la visite
let source = 'igdb'
export const catalogSource = () => source
const viaIgdb = async (fn, fallback) => {
  if (source === 'igdb') {
    try { return await fn() } catch (e) { if (e.status === 400) throw e; source = 'steam' }   // pas de clés, refusées, ou pas de relais : Steam
  }
  return fallback()
}

const fromIgdb = g => ({
  key: 'igdb:' + g.igdb_id,
  igdb_id: g.igdb_id,
  app_id: g.steam || null,
  name: g.name,
  cover: igdbImg(g.cover, 'cover_big'),
  hero: g.artworks?.[0] ? igdbImg(g.artworks[0], '1080p') : g.shots?.[0] ? igdbImg(g.shots[0], '1080p') : null,
  year: g.year, date: g.date || (g.year ? String(g.year) : ''),
  platforms: g.platforms || [], genres: g.genres || [], rating: g.rating,
  art: [...(g.artworks || []).map(a => igdbImg(a, '1080p')), ...(g.shots || []).map(a => igdbImg(a, '1080p'))],
  shots: (g.shots || []).map(a => igdbImg(a, 'screenshot_huge')),
})
const fromSteam = g => ({
  key: 'steam:' + g.id,
  igdb_id: null,
  app_id: g.id,
  name: g.name,
  cover: steamArt(g.id, 'library_600x900.jpg'),
  coverFallback: g.img || null,
  hero: steamArt(g.id, 'library_hero.jpg'),
  year: null, date: '', platforms: ['PC'], genres: g.genres || [], rating: g.metascore || g.metacritic || null,
})

// Steam n'a que des jeux PC : pour une autre famille de plateformes, rien
const steamOnly = (pf, fn) => (pf && pf !== 'all' && pf !== 'pc' ? Promise.resolve(null) : fn())
const pfParam = pf => (pf && pf !== 'all' ? { pf } : {})

export const searchCatalog = (q, pf = 'all') => viaIgdb(
  () => get('igdb', { q, ...pfParam(pf) }).then(d => d.results.map(fromIgdb)),
  () => steamOnly(pf, () => get('steam', { q }).then(d => (d.results || []).map(fromSteam))).then(r => r || []),
)

export const featuredCatalog = (pf = 'all') => viaIgdb(
  () => get('igdb', { featured: '1', ...pfParam(pf) }).then(d => ({ hot: d.hot.map(fromIgdb), best: d.best.map(fromIgdb), soon: d.soon.map(fromIgdb) })),
  () => steamOnly(pf, () => get('steam', { featured: '1' }).then(d => ({ hot: (d.top || []).map(fromSteam), best: (d.specials || []).map(fromSteam), soon: (d.news || []).map(fromSteam) })))
    .then(r => r || { hot: [], best: [], soon: [] }),
)

/** Les familles de plateformes, pour trier le catalogue et notre bibliothèque. */
export const PLATFORM_GROUPS = [['all', 'Toutes'], ['ps', 'PlayStation'], ['xbox', 'Xbox'], ['switch', 'Switch'], ['pc', 'PC'], ['other', 'Autres']]
export function platformGroup(name) {
  const n = String(name || '')
  if (/^PS[45]\b|PlayStation [45]/i.test(n)) return 'ps'
  if (/xbox|^XONE$|^XSX|Series X/i.test(n)) return 'xbox'
  if (/switch|^NS2?$/i.test(n)) return 'switch'
  if (/^PC$|windows/i.test(n)) return 'pc'
  return 'other'
}
/** Ce jeu est-il de cette famille ? (la plateforme où l'on y joue d'abord, sinon toutes les siennes) */
export const onPlatform = (g, pf) => {
  if (!pf || pf === 'all') return true
  const list = g.platform ? [g.platform] : g.platforms || []
  if (!list.length) return pf === 'other'
  return list.some(p => platformGroup(p) === pf)
}

const plain = html => { try { return new DOMParser().parseFromString(html, 'text/html').body.textContent || '' } catch { return html } }

/** La fiche complète d'un jeu (IGDB ; la description en français de Steam quand il y est). */
export async function catalogGame(ref) {
  if (ref.igdb_id && source === 'igdb') {
    try {
      const d = await get('igdb', { id: String(ref.igdb_id) })
      const g = { ...fromIgdb(d), summary: d.summary || d.storyline || '', videos: d.videos || [], developers: d.developers || [], publishers: d.publishers || [], votes: d.votes || 0 }
      if (g.app_id) {
        // la même fiche chez Steam : sa description est en français, ses images aussi grandes
        try {
          const s = await get('steam', { id: String(g.app_id) })
          if (s.short) { g.summaryFr = plain(s.short) }
          if (!g.videos.length && s.movies?.length) g.videos = s.movies.map(m => ({ mp4: m.mp4, webm: m.webm, hls: m.hls, thumb: m.thumb }))
          g.hero = steamArt(g.app_id, 'library_hero.jpg')
          g.heroFallback = fromIgdb(d).hero
        } catch { /* ignore */ }
      }
      return g
    } catch (e) { if (e.status !== 404) source = 'steam'; if (!ref.app_id) throw e }
  }
  if (!ref.app_id) throw new Error('Fiche indisponible')
  const s = await get('steam', { id: String(ref.app_id) })
  return {
    ...fromSteam({ id: ref.app_id, name: s.name, img: s.img, genres: s.genres, metacritic: s.metacritic }),
    igdb_id: ref.igdb_id || null,
    date: s.release || '', summaryFr: plain(s.short || ''), summary: '',
    platforms: (s.platforms || []).map(p => ({ windows: 'PC', mac: 'Mac', linux: 'Linux' })[p] || p),
    shots: s.screenshots || [], art: [s.background, ...(s.screenshots || [])].filter(Boolean),
    videos: (s.movies || []).map(m => ({ mp4: m.mp4, webm: m.webm, hls: m.hls, thumb: m.thumb })),
    developers: s.developers || [], publishers: s.publishers || [],
  }
}

/** Les statuts d'un jeu dans notre bibliothèque (comme pour les livres). */
export const STATUSES = [['a_jouer', 'À jouer'], ['en_cours', 'En cours'], ['termine', 'Terminé'], ['abandonne', 'Abandonné']]
export const statusLabel = s => STATUSES.find(x => x[0] === s)?.[1] || 'À jouer'
