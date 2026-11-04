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

/** Dimensions d'un dos : largeur selon le nombre de pages, hauteur variable mais stable. */
export function spineSize(book) {
  const h = hashString(book.google_id || book.googleId || book.title || '')
  const pages = book.page_count || book.pageCount || 160 + (h % 280)
  const w = Math.round(Math.min(58, Math.max(26, 20 + pages / 15)))
  const hr = 0.8 + ((h >>> 9) % 21) / 100 // 0.80 → 1.00
  return { w, hr }
}

export function authorInitials(book) {
  const a = (book.authors && book.authors[0]) || ''
  const parts = a.replace(/[^\p{L}\s-]/gu, '').split(/[\s-]+/).filter(Boolean)
  if (!parts.length) return '·'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const ARTICLES = /^(l['’]\s*|le\s+|la\s+|les\s+|un\s+|une\s+|des\s+|du\s+|the\s+|a\s+|an\s+)/i
export function titleKey(book) {
  return (book.title || '').trim().replace(ARTICLES, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
export function authorKey(book) {
  const a = (book.authors && book.authors[0]) || ''
  const last = a.trim().split(/\s+/).pop() || ''
  return last.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export const SORTS = [
  { id: 'recent', label: 'Ajout récent' },
  { id: 'title', label: 'Titre' },
  { id: 'author', label: 'Auteur' },
  { id: 'year', label: 'Année' },
  { id: 'color', label: 'Couleur' },
]

export function sortBooks(list, mode) {
  const arr = [...list]
  const coll = new Intl.Collator('fr')
  switch (mode) {
    case 'title': return arr.sort((a, b) => coll.compare(titleKey(a), titleKey(b)))
    case 'author': return arr.sort((a, b) => coll.compare(authorKey(a), authorKey(b)) || coll.compare(titleKey(a), titleKey(b)))
    case 'year': return arr.sort((a, b) => (parseInt(a.published_date) || 9999) - (parseInt(b.published_date) || 9999))
    case 'color': {
      const idx = b => SPINE_PALETTE.indexOf(spineColors(b))
      return arr.sort((a, b) => idx(a) - idx(b) || coll.compare(titleKey(a), titleKey(b)))
    }
    default: return arr.sort((a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0))
  }
}

export function toRoman(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  for (const [v, s] of map) while (n >= v) { out += s; n -= v }
  return out
}
