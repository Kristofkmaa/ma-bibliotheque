const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
const BASE_URL = 'https://www.googleapis.com/books/v1'

/**
 * Construit une URL de couverture haute résolution.
 * On essaie plusieurs stratégies dans l'ordre de qualité décroissante.
 */
function buildCoverUrl(googleId, imageLinks = {}, isbn = null) {
  // 1. Liens directs de l'API Google Books (les plus fiables)
  const raw = imageLinks.extraLarge || imageLinks.large || imageLinks.medium ||
              imageLinks.thumbnail || imageLinks.smallThumbnail || ''
  if (raw) {
    return raw
      .replace('http://', 'https://')
      .replace(/zoom=\d/, 'zoom=1')
      .replace('&edge=curl', '')
  }

  // 2. Open Library via ISBN
  if (isbn) {
    return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
  }

  // 3. Dernier recours : publisher content Google
  if (googleId) {
    return `https://books.google.com/books/publisher/content/images/frontcover/${googleId}?fife=w480-h720&source=gbs_api`
  }

  return ''
}

/**
 * Formate un volume Google Books en objet utilisable
 */
function formatBook(volume) {
  const info = volume.volumeInfo || {}
  const imageLinks = info.imageLinks || {}

  const isbn =
    (info.industryIdentifiers || []).find(i => i.type === 'ISBN_13')?.identifier ||
    (info.industryIdentifiers || []).find(i => i.type === 'ISBN_10')?.identifier ||
    null

  const cover = buildCoverUrl(volume.id, imageLinks, isbn)

  const saleInfo = volume.saleInfo || {}
  const price = saleInfo.listPrice?.amount
    ? { amount: saleInfo.listPrice.amount, currency: saleInfo.listPrice.currencyCode || 'EUR' }
    : null
  const buyLink = saleInfo.buyLink || null

  return {
    googleId: volume.id,
    title: info.title || 'Titre inconnu',
    authors: info.authors || ['Auteur inconnu'],
    description: info.description || '',
    cover,
    publishedDate: info.publishedDate || '',
    pageCount: info.pageCount || null,
    categories: info.categories || [],
    isbn,
    language: info.language || 'fr',
    averageRating: info.averageRating || null,
    price,
    buyLink,
  }
}

/**
 * Recherche de livres par texte
 */
export async function searchBooks(query, options = {}) {
  const { maxResults = 20, langRestrict = '' } = options
  if (!query.trim()) return []

  const params = new URLSearchParams({
    q: query,
    maxResults,
    printType: 'books',
    ...(langRestrict && { langRestrict }),
    ...(API_KEY && { key: API_KEY }),
  })

  const res = await fetch(`${BASE_URL}/volumes?${params}`)
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`)
  const data = await res.json()

  return (data.items || []).map(formatBook)
}

/**
 * Recherche par ISBN
 */
export async function searchByISBN(isbn) {
  const params = new URLSearchParams({
    q: `isbn:${isbn}`,
    ...(API_KEY && { key: API_KEY }),
  })

  const res = await fetch(`${BASE_URL}/volumes?${params}`)
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`)
  const data = await res.json()

  if (!data.items?.length) return null
  return formatBook(data.items[0])
}

/**
 * Récupère un livre par son ID Google
 */
export async function getBookById(googleId) {
  const params = new URLSearchParams(API_KEY ? { key: API_KEY } : {})
  const res = await fetch(`${BASE_URL}/volumes/${googleId}?${params}`)
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`)
  const data = await res.json()
  return formatBook(data)
}
