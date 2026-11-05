/**
 * Relais TMDB (Vercel) : la clé reste sur le serveur (variable d'environnement TMDB_API_KEY,
 * jamais envoyée au navigateur). Trois usages seulement :
 *   /api/tmdb?q=friends   → recherche de séries
 *   /api/tmdb?id=1668     → fiche d'une série (saisons, genres…)
 *   /api/tmdb?videos=1668 → ses vidéos YouTube : le générique d'abord, sinon les bandes-annonces
 *   /api/tmdb?images=1668 → ses grandes images (pour les faire défiler derrière le titre)
 *   /api/tmdb?providers=1668 → où le regarder en France (abonnement, location, achat ; données JustWatch)
 * Avec &type=movie, les mêmes appels pour les films (recherche, fiche, bandes-annonces, images).
 * La clé peut être la « clé d'API » (v3) ou le « jeton d'accès en lecture » (v4, commence par eyJ).
 */
const BASE = 'https://api.themoviedb.org/3'

// le générique d'abord, puis les bandes-annonces et teasers ; en français de préférence
const TYPE_RANK = { 'Opening Credits': 0, Trailer: 1, Teaser: 2 }
const rankVideo = v => TYPE_RANK[v.type] * 10 + (v.iso_639_1 === 'fr' ? 0 : v.iso_639_1 === 'en' ? 2 : 4) + (v.official ? 0 : 1)

const pickShow = s => ({
  tmdb_id: s.id,
  media: s.title != null || s.release_date != null ? 'movie' : 'tv',
  name: s.name || s.title || s.original_name || s.original_title || '',
  original_name: s.original_name || s.original_title || '',
  overview: s.overview || '',
  first_air_date: s.first_air_date || s.release_date || '',
  poster_path: s.poster_path || null,
  backdrop_path: s.backdrop_path || null,
  vote: typeof s.vote_average === 'number' ? Math.round(s.vote_average * 10) / 10 : null,
  votes: s.vote_count || 0,
})

export default async function handler(req, res) {
  const key = (process.env.TMDB_API_KEY || process.env.TMDB_KEY || '').trim()
  if (!key) { res.status(503).json({ error: 'TMDB_API_KEY manquante dans Vercel' }); return }
  const bearer = key.startsWith('eyJ')
  const call = async (path, params = {}) => {
    const u = new URL(BASE + path)
    for (const [k, v] of Object.entries({ language: 'fr-FR', ...params })) if (v) u.searchParams.set(k, v)
    if (!bearer) u.searchParams.set('api_key', key)
    const r = await fetch(u, { headers: { Accept: 'application/json', ...(bearer ? { Authorization: `Bearer ${key}` } : {}) } })
    if (!r.ok) throw Object.assign(new Error('TMDB ' + r.status), { status: r.status })
    return r.json()
  }
  try {
    const q = String(req.query.q || '').trim().slice(0, 120)
    const id = parseInt(req.query.id, 10)
    const vid = parseInt(req.query.videos, 10)
    const img = parseInt(req.query.images, 10)
    const prov = parseInt(req.query.providers, 10)
    const kind = req.query.type === 'movie' ? 'movie' : 'tv'
    let out
    if (prov > 0) {
      const data = await call(`/${kind}/${prov}/watch/providers`, { language: '' })
      const fr = data.results?.FR || {}
      const pick = list => (list || []).sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
        .map(p => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path || null }))
      out = { link: fr.link || null, flatrate: pick(fr.flatrate), free: pick([...(fr.free || []), ...(fr.ads || [])]), rent: pick(fr.rent), buy: pick(fr.buy) }
    } else if (img > 0) {
      // les images sans texte d'abord (null), puis françaises, puis anglaises ; les mieux notées
      const data = await call(`/${kind}/${img}/images`, { language: '', include_image_language: 'null,fr,en' })
      const rank = b => (b.iso_639_1 == null ? 0 : 1) * 10 - (b.vote_average || 0)
      out = { backdrops: (data.backdrops || []).filter(b => b.file_path && b.width >= 1000).sort((a, b) => rank(a) - rank(b)).slice(0, 8).map(b => b.file_path) }
    } else if (vid > 0) {
      // vidéos en français et en anglais d'un coup, on trie nous-mêmes
      const data = await call(`/${kind}/${vid}/videos`, { include_video_language: 'fr,en,null' })
      const vids = (data.results || [])
        .filter(v => v.site === 'YouTube' && v.key && v.type in TYPE_RANK)
        .sort((a, b) => rankVideo(a) - rankVideo(b))
        .slice(0, 6)
        .map(v => ({ key: v.key, type: v.type, name: v.name || '', lang: v.iso_639_1 || '' }))
      out = { videos: vids }
    } else if (q) {
      const data = await call(`/search/${kind}`, { query: q, include_adult: 'false', page: '1' })
      out = { results: (data.results || []).slice(0, 18).map(r => ({ ...pickShow(r), media: kind })) }
    } else if (id > 0 && kind === 'movie') {
      const s = await call(`/movie/${id}`, { append_to_response: 'credits' })
      out = {
        ...pickShow(s),
        media: 'movie',
        genres: (s.genres || []).map(g => g.name).slice(0, 3),
        runtime: s.runtime || null,
        seasons: null,
        // pour un film : le ou la cinéaste, à la place de la chaîne
        networks: (s.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name).slice(0, 2),
      }
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
    } else { res.status(400).json({ error: 'q, id ou videos attendu' }); return }
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    res.status(200).json(out)
  } catch (e) {
    res.status(e.status === 401 ? 502 : 500).json({ error: e.status === 401 ? 'Clé TMDB refusée' : 'TMDB indisponible' })
  }
}
