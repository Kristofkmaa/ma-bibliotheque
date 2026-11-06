/**
 * Relais vers les données publiques de la boutique Steam (sans clé), pour la boutique « Stim »
 * du PC du salon. Prix en euros, textes en français quand ils existent.
 *   /api/steam?q=zelda        → recherche
 *   /api/steam?id=1145360     → fiche d'un jeu (images, bande-annonce, genres, prix…)
 *   /api/steam?featured=1     → les rayons du moment (promos, meilleures ventes, nouveautés)
 */
const STORE = 'https://store.steampowered.com/api'
const common = 'cc=FR&l=french'

const euros = cents => (typeof cents === 'number' ? Math.round(cents) / 100 : null)

export default async function handler(req, res) {
  const get = async url => {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Maruchime)' } })
    if (!r.ok) throw Object.assign(new Error('Steam ' + r.status), { status: r.status })
    return r.json()
  }
  try {
    const q = String(req.query.q || '').trim().slice(0, 100)
    const id = parseInt(req.query.id, 10)
    let out
    if (q) {
      const d = await get(`${STORE}/storesearch/?term=${encodeURIComponent(q)}&${common}`)
      out = {
        results: (d.items || []).filter(i => i.type === 'app' || !i.type).slice(0, 24).map(i => ({
          id: i.id, name: i.name,
          img: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${i.id}/header.jpg`,
          small: i.tiny_image || null,
          price: i.price ? euros(i.price.final) : 0,
          original: i.price ? euros(i.price.initial) : null,
          metascore: i.metascore ? Number(i.metascore) || null : null,
        })),
      }
    } else if (id > 0) {
      const d = await get(`${STORE}/appdetails?appids=${id}&${common}`)
      const g = d?.[id]?.data
      if (!d?.[id]?.success || !g) { res.status(404).json({ error: 'Jeu introuvable' }); return }
      const po = g.price_overview
      out = {
        id, name: g.name, type: g.type,
        short: g.short_description || '',
        img: g.header_image || null, background: g.background_raw || g.background || null,
        capsule: g.capsule_imagev5 || g.capsule_image || null,
        screenshots: (g.screenshots || []).slice(0, 10).map(x => x.path_full),
        movies: (g.movies || []).slice(0, 3).map(m => ({ name: m.name, thumb: m.thumbnail, mp4: m.mp4?.max || m.mp4?.['480'] || null, webm: m.webm?.max || null, hls: m.hls_h264 || null })).filter(m => m.mp4 || m.webm || m.hls),
        genres: (g.genres || []).map(x => x.description).slice(0, 4),
        developers: (g.developers || []).slice(0, 2), publishers: (g.publishers || []).slice(0, 1),
        release: g.release_date?.date || '',
        metacritic: g.metacritic?.score || null,
        free: !!g.is_free,
        price: g.is_free ? 0 : po ? euros(po.final) : null,
        original: po ? euros(po.initial) : null,
        discount: po?.discount_percent || 0,
        platforms: Object.entries(g.platforms || {}).filter(([, v]) => v).map(([k]) => k),
      }
    } else if (req.query.featured) {
      const d = await get(`${STORE}/featuredcategories/?${common}`)
      const pick = list => (list?.items || []).filter(i => i.type === 0 || i.type === undefined).slice(0, 12).map(i => ({
        id: i.id, name: i.name, img: i.large_capsule_image || i.header_image || null,
        price: euros(i.final_price), original: euros(i.original_price), discount: i.discount_percent || 0,
      }))
      out = { specials: pick(d.specials), top: pick(d.top_sellers), news: pick(d.new_releases) }
    } else { res.status(400).json({ error: 'q, id ou featured attendu' }); return }
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=21600')
    res.status(200).json(out)
  } catch (e) {
    res.status(502).json({ error: 'La boutique ne répond pas' })
  }
}
