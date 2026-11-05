/**
 * Relais TMDB (Vercel) : la clé reste sur le serveur (variable d'environnement TMDB_API_KEY,
 * jamais envoyée au navigateur). Deux usages seulement :
 *   /api/tmdb?q=friends   → recherche de séries
 *   /api/tmdb?id=1668     → fiche d'une série (saisons, genres…)
 * La clé peut être la « clé d'API » (v3) ou le « jeton d'accès en lecture » (v4, commence par eyJ).
 */
const BASE = 'https://api.themoviedb.org/3'

const pickShow = s => ({
  tmdb_id: s.id,
  name: s.name || s.original_name || '',
  original_name: s.original_name || '',
  overview: s.overview || '',
  first_air_date: s.first_air_date || '',
  poster_path: s.poster_path || null,
  backdrop_path: s.backdrop_path || null,
  vote: typeof s.vote_average === 'number' ? Math.round(s.vote_average * 10) / 10 : null,
})

export default async function handler(req, res) {
  const key = (process.env.TMDB_API_KEY || process.env.TMDB_KEY || '').trim()
  if (!key) { res.status(503).json({ error: 'TMDB_API_KEY manquante dans Vercel' }); return }
  const bearer = key.startsWith('eyJ')
  const call = async (path, params = {}) => {
    const u = new URL(BASE + path)
    for (const [k, v] of Object.entries({ language: 'fr-FR', ...params })) u.searchParams.set(k, v)
    if (!bearer) u.searchParams.set('api_key', key)
    const r = await fetch(u, { headers: { Accept: 'application/json', ...(bearer ? { Authorization: `Bearer ${key}` } : {}) } })
    if (!r.ok) throw Object.assign(new Error('TMDB ' + r.status), { status: r.status })
    return r.json()
  }
  try {
    const q = String(req.query.q || '').trim().slice(0, 120)
    const id = parseInt(req.query.id, 10)
    let out
    if (q) {
      const data = await call('/search/tv', { query: q, include_adult: 'false', page: '1' })
      out = { results: (data.results || []).slice(0, 18).map(pickShow) }
    } else if (id > 0) {
      const s = await call(`/tv/${id}`)
      out = {
        ...pickShow(s),
        genres: (s.genres || []).map(g => g.name).slice(0, 3),
        seasons: s.number_of_seasons || null,
        episodes: s.number_of_episodes || null,
        status: s.status || '',
        networks: (s.networks || []).map(n => n.name).slice(0, 2),
      }
    } else { res.status(400).json({ error: 'q ou id attendu' }); return }
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    res.status(200).json(out)
  } catch (e) {
    res.status(e.status === 401 ? 502 : 500).json({ error: e.status === 401 ? 'Clé TMDB refusée' : 'TMDB indisponible' })
  }
}
