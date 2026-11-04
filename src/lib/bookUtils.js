/** Palette "archive" pour les tranches générées (couleur de fond, couleur d'encre). */
export const SPINE_PALETTE = [
  ['#1F3FB0', '#F4F2ED'], // cobalt
  ['#B8322B', '#F4F2ED'], // vermillon
  ['#2E2A26', '#EDE6D6'], // charbon
  ['#D9CDB4', '#1B1A18'], // crème
  ['#1E5A4A', '#EFEBE0'], // vert profond
  ['#C7692A', '#1B1A18'], // orange brûlé
  ['#4A3B8C', '#F4F2ED'], // indigo
  ['#8C2F39', '#F4F2ED'], // sang de bœuf
  ['#E0B23A', '#1B1A18'], // moutarde
  ['#3B5B7E', '#F4F2ED'], // bleu ardoise
  ['#6B4F2A', '#F4F2ED'], // tabac
  ['#ECE3D1', '#1B1A18'], // os
]

export function hashString(str = '') {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}

export function spineColors(book) {
  const key = book.google_id || book.googleId || book.title || ''
  return SPINE_PALETTE[hashString(key) % SPINE_PALETTE.length]
}

/** Normalise une ligne `user_books` OU un résultat Google Books vers une forme unique d'affichage. */
export function toDisplay(book) {
  if (!book) return null
  const year = (book.published_date || book.publishedDate || '').toString().slice(0, 4)
  return {
    id: book.id || null,
    googleId: book.google_id || book.googleId || null,
    title: book.title || 'Titre inconnu',
    authors: book.authors?.length ? book.authors : ['Auteur inconnu'],
    cover: book.cover_url || book.cover || '',
    description: stripHtml(book.description || ''),
    year,
    pageCount: book.page_count ?? book.pageCount ?? null,
    categories: book.categories || [],
    isbn: book.isbn || null,
    statuses: book.statuses || (book.status ? [book.status] : []),
    rating: book.rating ?? null,
    notes: book.notes || '',
  }
}

export function stripHtml(html) {
  if (!html) return ''
  const el = document.createElement('div')
  el.innerHTML = html
  return (el.textContent || '').replace(/\s+/g, ' ').trim()
}

export function smoothstep(x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x * x * (3 - 2 * x)
}
