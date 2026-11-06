/**
 * Relais d'images de couverture (Vercel) : la scène 3D (WebGL) ne peut utiliser une image
 * que si son serveur l'autorise (CORS). On la récupère ici et on la renvoie avec l'en-tête
 * qui va bien. Seuls quelques hôtes de couvertures sont acceptés (pas de relais ouvert).
 */
const ALLOWED = ['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org', 'archive.org', 'image.tmdb.org', 'steamstatic.com', 'images.igdb.com']

export default async function handler(req, res) {
  try {
    const raw = String(req.query.url || '')
    const url = new URL(raw)
    const okHost = ALLOWED.some(h => url.hostname === h || url.hostname.endsWith('.' + h))
    if (url.protocol !== 'https:' || !okHost) { res.status(400).send('URL non autorisée'); return }
    const upstream = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (BibliothequeLevana cover relay)' } })
    const type = upstream.headers.get('content-type') || ''
    if (!upstream.ok || !type.startsWith('image/')) { res.status(404).send('Couverture introuvable'); return }
    const buf = Buffer.from(await upstream.arrayBuffer())
    if (buf.length > 6 * 1024 * 1024) { res.status(413).send('Image trop lourde'); return }
    res.setHeader('Content-Type', type)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=2592000, immutable')
    res.status(200).send(buf)
  } catch {
    res.status(400).send('Requête invalide')
  }
}
