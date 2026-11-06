/**
 * Les lectures : les statuts d'un livre (J'ai, Wishlist, Je lis, J'ai lu, J'aime), ses dates de
 * lecture et le défi de l'année.
 *   - « Je lis » note la date de début (aujourd'hui) ;
 *   - « J'ai lu » après « Je lis » note la date de fin : le livre compte dans le défi de l'année,
 *     avec son temps de lecture ;
 *   - « J'ai lu » directement : « lu il y a longtemps » (pas de dates, pas compté dans le défi),
 *     sauf si on lui donne des dates ensuite.
 * La pile à lire (PAL) se calcule : les livres qu'on a, pas encore lus ni commencés.
 */
export const BOOK_STATES = [
  { id: 'possede', label: 'J’ai', short: 'J’ai' },
  { id: 'souhaite', label: 'Wishlist', short: 'Wishlist' },
  { id: 'en_cours', label: 'Je lis', short: 'Je lis' },
  { id: 'lu', label: 'J’ai lu', short: 'J’ai lu' },
  { id: 'aime', label: 'J’aime', short: 'J’aime' },
]
// la colonne « status » de Supabase n'accepte que ces valeurs (statuses, elle, accepte tout)
export const LEGACY = ['lu', 'possede', 'souhaite', 'en_cours']

const has = (b, s) => (b.statuses || (b.status ? [b.status] : [])).includes(s)
export const isOwned = b => has(b, 'possede')
export const isWish = b => has(b, 'souhaite')
export const isReading = b => has(b, 'en_cours')
export const isRead = b => has(b, 'lu')
export const isLoved = b => has(b, 'aime')
export const inPal = b => isOwned(b) && !isRead(b) && !isReading(b)

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const DAY = 864e5
const toTime = s => (s ? new Date(s + 'T12:00:00').getTime() : null)

/**
 * Basculer un statut : rend { statuses, dates } (les nouvelles dates de ce livre, ou undefined si
 * elles ne changent pas) et `askDates` quand il faut proposer de les régler (J'ai lu directement).
 */
export function toggleState(book, id, dates = {}) {
  const cur = new Set(book.statuses || (book.status ? [book.status] : []))
  const on = !cur.has(id)
  let next = { ...dates }
  let askDates = false
  if (on) {
    cur.add(id)
    if (id === 'possede') cur.delete('souhaite')        // on l'a acheté : il quitte la wishlist
    if (id === 'souhaite') cur.delete('possede')
    if (id === 'en_cours') {
      cur.delete('lu')
      next = { start: dates.start && !dates.longAgo ? dates.start : today(), end: null, longAgo: false }
    }
    if (id === 'lu') {
      const wasReading = cur.has('en_cours') && dates.start && !dates.longAgo
      cur.delete('en_cours')
      if (wasReading) next = { start: dates.start, end: today(), longAgo: false }
      else if (!dates.end) { next = { start: null, end: null, longAgo: true }; askDates = true }
    }
  } else {
    cur.delete(id)
    if (id === 'en_cours') next = { start: null, end: null, longAgo: false }
    if (id === 'lu') next = dates.start && !dates.longAgo ? { start: dates.start, end: null, longAgo: false } : { start: null, end: null, longAgo: false }
    if (id === 'lu' && next.start) cur.add('en_cours')    // on n'avait pas fini : on le lit encore
  }
  const statuses = [...cur]
  if (!statuses.length) statuses.push('souhaite')
  // le premier statut (colonne « status ») doit être un des anciens
  statuses.sort((a, b) => (LEGACY.includes(a) ? 0 : 1) - (LEGACY.includes(b) ? 0 : 1))
  if (!LEGACY.includes(statuses[0])) statuses.unshift('possede')
  const changed = JSON.stringify(next) !== JSON.stringify(dates)
  return { statuses, dates: changed ? next : undefined, askDates }
}

/** Le temps de lecture, en jours (le jour de début et de fin compris), ou null. */
export function readingDays(dates) {
  if (!dates?.start || !dates?.end || dates.longAgo) return null
  return Math.max(1, Math.round((toTime(dates.end) - toTime(dates.start)) / DAY) + 1)
}
/** Depuis combien de jours on le lit. */
export const daysSince = s => (s ? Math.max(1, Math.round((Date.now() - toTime(s)) / DAY) + 1) : null)
export const daysFr = n => (n == null ? '' : n === 1 ? '1 jour' : n < 30 ? `${n} jours` : n < 60 ? '1 mois' : `${Math.round(n / 30)} mois`)
export const dateFr = s => (s ? new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
export const dateShort = s => (s ? new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')

/** L'année où il a été lu (pour le défi), ou null (lu il y a longtemps, ou pas fini). */
export const readYear = (b, dates) => (isRead(b) && dates?.end && !dates.longAgo ? +dates.end.slice(0, 4) : null)

/** Le défi d'une année : les livres lus cette année-là, mois par mois, pages, temps moyen. */
export function challenge(books, datesOf, year) {
  const read = books.filter(b => readYear(b, datesOf(b.id)) === year)
    .sort((a, b) => datesOf(b.id).end.localeCompare(datesOf(a.id).end))
  const months = Array.from({ length: 12 }, (_, m) => read.filter(b => +datesOf(b.id).end.slice(5, 7) === m + 1).length)
  const pages = read.reduce((s, b) => s + (b.page_count || 0), 0)
  const days = read.map(b => readingDays(datesOf(b.id))).filter(Boolean)
  const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null
  return { read, months, pages, avg }
}
