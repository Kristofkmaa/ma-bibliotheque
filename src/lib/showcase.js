import { toDisplay, spineColors } from './bookUtils'
import { tmdbImg, tmdbImgCors, isMovie, year } from './tmdb'
import { relayUrl } from './covers'
import { platformGroup } from './games'

const steamCover = id => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`

/**
 * Un média de notre vitrine, prêt à être posé sur le meuble : son nom, sa vignette, son
 * format (livre, Blu-ray, boîtier de jeu de telle console) et l'image de sa couverture
 * (utilisable en 3D, par le relais).
 */
export function resolveShowcase(items, { books = [], series = [], games = [] }) {
  const out = []
  for (const it of items) {
    if (it.kind === 'book') {
      const b = books.find(x => x.id === it.id)
      if (!b) continue
      const d = toDisplay(b)
      const [bg, fg] = spineColors(b)
      out.push({ ...it, key: 'b' + it.id, name: d.title, sub: d.authors[0], thumb: d.cover || null, tex: d.cover ? relayUrl(d.cover.replace(/^http:/, 'https:')) : null, format: 'book', color: bg, ink: fg })
    } else if (it.kind === 'work') {
      const s = series.find(x => x.id === it.id)
      if (!s) continue
      out.push({ ...it, key: 'w' + it.id, name: s.name, sub: [isMovie(s) ? 'Film' : 'Série', year(s)].filter(Boolean).join(' · '), thumb: tmdbImg(s.poster_path, 'w185'), tex: tmdbImgCors(s.poster_path, 'w342'), format: 'bluray', band: isMovie(s) ? 'FILM' : 'SÉRIE', year: year(s) })
    } else if (it.kind === 'game') {
      const g = games.find(x => x.id === it.id)
      if (!g) continue
      const plat = g.platform || g.platforms?.[0] || 'PC'
      const fam = platformGroup(plat)
      const cover = g.app_id ? steamCover(g.app_id) : g.img
      out.push({ ...it, key: 'g' + it.id, name: g.name, sub: plat, thumb: g.img || cover, tex: cover ? relayUrl(cover) : null, format: fam === 'switch' ? 'switch' : 'game', fam, band: plat.replace(/^PC · /, '').toUpperCase() })
    }
  }
  return out
}
