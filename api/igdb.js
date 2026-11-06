/**
 * Relais IGDB (la base de jeux de Twitch : toutes les plateformes, consoles, PC, rétro, mobile).
 * Les identifiants restent sur le serveur : variables TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET
 * dans Vercel. Le jeton d'accès (valable ~60 jours) est gardé en mémoire entre deux appels.
 *   /api/igdb?q=zelda       → recherche
 *   /api/igdb?id=1942       → fiche d'un jeu (résumé, images, vidéos, studio, plateformes…)
 *   /api/igdb?featured=1    → les rayons : populaires en ce moment, les mieux notés, bientôt
 * Avec &pf=ps|xbox|switch|pc|other : seulement les jeux de ces plateformes (other : ni l'une ni l'autre).
 */
// les familles de plateformes (identifiants IGDB) : PS5, PS4 · Xbox Series, One · Switch, Switch 2 · PC
const PF = { ps: [167, 48], xbox: [169, 49], switch: [130, 508], pc: [6] }
const MAIN = Object.values(PF).flat()
const pfWhere = pf => (PF[pf] ? ` & platforms = (${PF[pf].join(',')})` : pf === 'other' ? ` & platforms != (${MAIN.join(',')})` : '')
let token = null, tokenExp = 0

const LIST = 'name,cover.image_id,first_release_date,platforms.abbreviation,platforms.name,genres.name,total_rating,artworks.image_id,screenshots.image_id,websites.url'
const FULL = LIST + ',summary,storyline,videos.video_id,videos.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,total_rating_count'

// les genres d'IGDB, en français
const GENRES = {
  'Adventure': 'Aventure', 'Role-playing (RPG)': 'RPG', 'Shooter': 'Tir', 'Platform': 'Plates-formes', 'Puzzle': 'Réflexion',
  'Racing': 'Course', 'Sport': 'Sport', 'Strategy': 'Stratégie', 'Simulator': 'Simulation', 'Fighting': 'Combat', 'Indie': 'Indépendant',
  'Arcade': 'Arcade', 'Music': 'Musique', "Hack and slash/Beat 'em up": 'Beat’em all', 'Tactical': 'Tactique',
  'Turn-based strategy (TBS)': 'Tour par tour', 'Real Time Strategy (RTS)': 'Stratégie temps réel', 'Visual Novel': 'Visual novel',
  'Card & Board Game': 'Cartes et plateau', 'MOBA': 'MOBA', 'Point-and-click': 'Point & click', 'Quiz/Trivia': 'Quiz', 'Pinball': 'Flipper',
}
const PLATFORMS = { 'PC (Microsoft Windows)': 'PC', 'Mac': 'Mac', 'Linux': 'Linux' }

const dateFr = s => (s ? new Date(s * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '')
const steamOf = g => {
  for (const w of g.websites || []) { const m = /store\.steampowered\.com\/app\/(\d+)/.exec(w.url || ''); if (m) return +m[1] }
  return null
}
const pick = g => ({
  igdb_id: g.id,
  name: g.name || '',
  cover: g.cover?.image_id || null,
  artworks: (g.artworks || []).map(a => a.image_id).slice(0, 8),
  shots: (g.screenshots || []).map(a => a.image_id).slice(0, 10),
  year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
  date: dateFr(g.first_release_date),
  platforms: [...new Set((g.platforms || []).map(p => PLATFORMS[p.name] || p.abbreviation || p.name))].slice(0, 8),
  genres: (g.genres || []).map(x => GENRES[x.name] || x.name).slice(0, 4),
  rating: typeof g.total_rating === 'number' ? Math.round(g.total_rating) : null,
  steam: steamOf(g),
})

export default async function handler(req, res) {
  const id = (process.env.TWITCH_CLIENT_ID || '').trim(), secret = (process.env.TWITCH_CLIENT_SECRET || '').trim()
  if (!id || !secret) { res.status(503).json({ error: 'TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants dans Vercel' }); return }
  const auth = async () => {
    if (token && Date.now() < tokenExp - 60000) return token
    const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`, { method: 'POST' })
    if (!r.ok) throw Object.assign(new Error('Twitch ' + r.status), { status: 401 })
    const d = await r.json()
    token = d.access_token; tokenExp = Date.now() + (d.expires_in || 3600) * 1000
    return token
  }
  const games = async body => {
    const t = await auth()
    const r = await fetch('https://api.igdb.com/v4/games', { method: 'POST', headers: { 'Client-ID': id, Authorization: `Bearer ${t}`, Accept: 'application/json', 'Content-Type': 'text/plain' }, body })
    if (r.status === 401) { token = null }
    if (!r.ok) throw Object.assign(new Error('IGDB ' + r.status), { status: r.status })
    return r.json()
  }
  try {
    const q = String(req.query.q || '').trim().replace(/["\\;]/g, ' ').slice(0, 80)
    const gid = parseInt(req.query.id, 10)
    const now = Math.floor(Date.now() / 1000)
    const pw = pfWhere(String(req.query.pf || ''))
    let out
    if (q) {
      const list = await games(`search "${q}"; fields ${LIST}; where version_parent = null${pw}; limit 30;`)
      out = { results: list.map(pick) }
    } else if (gid > 0) {
      const [g] = await games(`fields ${FULL}; where id = ${gid};`)
      if (!g) { res.status(404).json({ error: 'Jeu introuvable' }); return }
      const cos = g.involved_companies || []
      out = {
        ...pick(g),
        summary: g.summary || '', storyline: g.storyline || '',
        videos: (g.videos || []).map(v => ({ yt: v.video_id, name: v.name || '' })).filter(v => v.yt).slice(0, 4),
        developers: cos.filter(c => c.developer).map(c => c.company?.name).filter(Boolean).slice(0, 2),
        publishers: cos.filter(c => c.publisher).map(c => c.company?.name).filter(Boolean).slice(0, 2),
        votes: g.total_rating_count || 0,
      }
    } else if (req.query.featured) {
      const [hot, best, soon] = await Promise.all([
        games(`fields ${LIST}; where first_release_date > ${now - 150 * 86400} & first_release_date < ${now} & cover != null & total_rating_count > 2${pw}; sort total_rating_count desc; limit 18;`),
        games(`fields ${LIST}; where total_rating_count > ${pw ? 60 : 400} & cover != null${pw}; sort total_rating desc; limit 18;`),
        games(`fields ${LIST}; where first_release_date > ${now} & cover != null & hypes > ${pw ? 0 : 3}${pw}; sort hypes desc; limit 18;`),
      ])
      out = { hot: hot.map(pick), best: best.map(pick), soon: soon.map(pick) }
    } else { res.status(400).json({ error: 'q, id ou featured attendu' }); return }
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=43200')
    res.status(200).json(out)
  } catch (e) {
    res.status(e.status === 401 ? 502 : 500).json({ error: e.status === 401 ? 'Identifiants Twitch refusés' : 'La base de jeux ne répond pas' })
  }
}
