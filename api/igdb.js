/**
 * Relais IGDB (la base de jeux de Twitch : toutes les plateformes, consoles, PC, rétro, mobile).
 * Les identifiants restent sur le serveur : variables TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET
 * dans Vercel. Le jeton d'accès (valable ~60 jours) est gardé en mémoire entre deux appels.
 *   /api/igdb?q=zelda       → recherche
 *   /api/igdb?id=1942       → fiche d'un jeu (résumé, images, vidéos, studio, plateformes…)
 *   /api/igdb?featured=1    → les rayons : populaires en ce moment, les mieux notés, bientôt
 * Avec &pf=ps|xbox|switch|pc|mobile|retro : seulement les jeux de ces plateformes (retro : tout le reste) ;
 * et pour le PC, une boutique : &pf=pc:steam|epic|gog|battlenet|ea|ubisoft|itch.
 */
// les familles de plateformes (identifiants IGDB) : PS5, PS4 · Xbox Series, One · Switch, Switch 2 · PC · Android, iOS
const PF = { ps: [167, 48], xbox: [169, 49], switch: [130, 508], pc: [6], mobile: [34, 39] }
const MAIN = [...Object.values(PF).flat(), 14, 3]   // + Mac, Linux : le « rétro » est tout le reste
// les boutiques PC : par le lien de leur page sur la fiche IGDB du jeu, ou par l'éditeur
const STORE = {
  steam: 'websites.url ~ *"steampowered.com"*',
  epic: 'websites.url ~ *"epicgames.com"*',
  gog: 'websites.url ~ *"gog.com"*',
  itch: 'websites.url ~ *"itch.io"*',
  battlenet: '(involved_companies.company.name ~ *"Blizzard"* | involved_companies.company.name ~ *"Activision"*)',
  ea: '(involved_companies.company.name ~ *"Electronic Arts"* | involved_companies.company.name ~ *"EA Sports"*)',
  ubisoft: 'involved_companies.company.name ~ *"Ubisoft"*',
}
const pfWhere = (pf, withStore = true) => {
  const [fam, store] = String(pf || '').split(':')
  if (fam === 'retro' || fam === 'other') return ` & platforms != (${MAIN.join(',')})`
  if (!PF[fam]) return ''
  return ` & platforms = (${PF[fam].join(',')})` + (fam === 'pc' && withStore && STORE[store] ? ` & ${STORE[store]}` : '')
}
// les boutiques PC où l'on trouve le jeu (d'après les liens de sa fiche)
const STORE_URL = [['steam', /steampowered\.com/], ['epic', /epicgames\.com/], ['gog', /gog\.com/], ['itch', /itch\.io/], ['battlenet', /battle\.net|blizzard\.com/], ['ea', /\bea\.com/], ['ubisoft', /ubisoft\.com|ubi\.com/]]
const storesOf = g => STORE_URL.filter(([, re]) => (g.websites || []).some(w => re.test(w.url || ''))).map(([k]) => k)
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
  stores: storesOf(g),
})

export default async function handler(req, res) {
  // les clés : TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET (on tolère un nom approchant, des espaces en trop)
  const names = Object.keys(process.env).filter(k => /twitch|igdb/i.test(k))
  const val = re => { const k = names.find(n => re.test(n.replace(/\s+/g, ''))); return k ? String(process.env[k] || '').trim() : '' }
  const id = val(/^TWITCH_CLIENT_ID$/i) || val(/client_?id/i) || val(/(twitch|igdb).*_id$/i)
  const secret = val(/^TWITCH_CLIENT_SECRET$/i) || val(/secret/i)
  // diagnostic : quelles variables le site voit (leurs noms seulement, jamais leurs valeurs)
  if (req.query.check) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ variables: names.map(n => ({ nom: n, remplie: !!String(process.env[n] || '').trim() })), clientId: !!id, secret: !!secret, environnement: process.env.VERCEL_ENV || 'inconnu' })
    return
  }
  if (!id || !secret) {
    res.status(503).json({ error: 'TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants dans Vercel', vues: names, environnement: process.env.VERCEL_ENV || 'inconnu' })
    return
  }
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
    const pfq = String(req.query.pf || '')
    let pw = pfWhere(pfq), approx = false
    // un filtre de boutique refusé par IGDB : on garde la plateforme seule (le PC en général)
    const tryGames = async build => {
      try { return await games(build(pw)) } catch (e) {
        if (e.status !== 400 || !pfq.includes(':')) throw e
        approx = true; pw = pfWhere(pfq, false)
        return games(build(pw))
      }
    }
    let out
    if (q) {
      const list = await tryGames(w => `search "${q}"; fields ${LIST}; where version_parent = null${w}; limit 30;`)
      out = { results: list.map(pick), approx }
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
      const hot = await tryGames(w => `fields ${LIST}; where first_release_date > ${now - (w ? 400 : 150) * 86400} & first_release_date < ${now} & cover != null & total_rating_count > 2${w}; sort total_rating_count desc; limit 18;`)
      const [best, soon] = await Promise.all([
        games(`fields ${LIST}; where total_rating_count > ${pw ? 40 : 400} & cover != null${pw}; sort total_rating desc; limit 18;`),
        games(`fields ${LIST}; where first_release_date > ${now} & cover != null & hypes > ${pw ? 0 : 3}${pw}; sort hypes desc; limit 18;`),
      ])
      out = { hot: hot.map(pick), best: best.map(pick), soon: soon.map(pick), approx }
    } else { res.status(400).json({ error: 'q, id ou featured attendu' }); return }
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=43200')
    res.status(200).json(out)
  } catch (e) {
    res.status(e.status === 401 ? 502 : 500).json({ error: e.status === 401 ? 'Identifiants Twitch refusés' : 'La base de jeux ne répond pas' })
  }
}
