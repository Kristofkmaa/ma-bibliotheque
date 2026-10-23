// Outils partagés par l'étagère Ex-libris et le livre qui s'ouvre

const CLOTH = ['#5c1f24', '#1f3352', '#23432f', '#6b4a1a', '#3f2a4f', '#1e4a4a', '#4a2a1e', '#2b2f45', '#5a3a12', '#33402a']

const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

export const clothOf = (book) => CLOTH[hash((book.title || '') + (book.google_id || book.googleId || '')) % CLOTH.length]
export const heightOf = (book) => 142 + (hash(book.title || '') % 34)
export const pagesOf = (book) => +(book.page_count || book.pageCount) || 0
export const spineWidthOf = (book) => Math.max(24, Math.min(48, Math.round((pagesOf(book) || 280) / 12)))
export const authorOf = (book) => (Array.isArray(book.authors) ? book.authors.join(', ') : book.authors) || ''
export const yearOf = (book) => String(book.published_date || book.publishedDate || '').slice(0, 4)
export const coverOf = (book) => book.cover || book.cover_url || ''
export const statusesOf = (book) => (book.statuses?.length ? book.statuses : book.status ? [book.status] : [])

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const lastName = (book) => norm(authorOf(book).split(',')[0].trim().split(' ').pop())

export const SORTS = [
  { id: 'title',  label: 'Titre A → Z' },
  { id: 'author', label: 'Auteur A → Z' },
  { id: 'recent', label: 'Ajout récent' },
  { id: 'rating', label: 'Mieux notés' },
  { id: 'year',   label: 'Parution récente' },
  { id: 'pages',  label: 'Plus courts' },
]

const COMPARE = {
  title:  (a, b) => norm(a.title).localeCompare(norm(b.title), 'fr'),
  author: (a, b) => lastName(a).localeCompare(lastName(b), 'fr') || norm(a.title).localeCompare(norm(b.title), 'fr'),
  recent: (a, b) => String(b.added_at || '').localeCompare(String(a.added_at || '')),
  rating: (a, b) => (+b.rating || 0) - (+a.rating || 0) || norm(a.title).localeCompare(norm(b.title), 'fr'),
  year:   (a, b) => (+yearOf(b) || -1e9) - (+yearOf(a) || -1e9),
  pages:  (a, b) => (pagesOf(a) || 1e9) - (pagesOf(b) || 1e9),
}

export const sortBooks = (books, by = 'title') => [...books].sort(COMPARE[by] || COMPARE.title)

// La note de l'appli : 1 = J'aime pas, 3 = J'aime, 5 = J'adore
export const verdictOf = (rating) => ({ 1: "Tu n'as pas aimé", 3: 'Tu as aimé', 5: 'Tu as adoré' }[+rating] || '')

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
