/**
 * Les dates de péremption de nos réserves, et la semaine de recettes qui les finit à temps.
 */
const DAY = 864e5
const at = s => new Date(s + 'T12:00:00')
export const isoDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (iso, n) => { const d = at(iso); d.setDate(d.getDate() + n); return isoDay(d) }

/** Jours avant la date (0 : aujourd'hui, négatif : passée), ou null sans date. */
export const daysLeft = (iso, from = isoDay()) => (iso ? Math.round((at(iso) - at(from)) / DAY) : null)

/** 'over' (passée), 'today', 'soon' (≤ 2 jours), 'week' (≤ 6), 'ok', ou null sans date. */
export function urgency(n) {
  if (n == null) return null
  return n < 0 ? 'over' : n === 0 ? 'today' : n <= 2 ? 'soon' : n <= 6 ? 'week' : 'ok'
}

/** « périmé », « aujourd'hui », « demain », « dans 4 j », « 12 nov. ». */
export function leftFr(iso) {
  const n = daysLeft(iso)
  if (n == null) return ''
  if (n < -1) return `périmé (${-n} j)`
  if (n === -1) return 'périmé d’hier'
  if (n === 0) return 'aujourd’hui'
  if (n === 1) return 'demain'
  if (n <= 6) return `dans ${n} j`
  return at(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Les raccourcis pour poser une date d'un geste. */
export const QUICK_DATES = [['Aujourd’hui', 0], ['Demain', 1], ['3 jours', 3], ['1 semaine', 7], ['2 semaines', 14], ['1 mois', 30]]

/** « Ce soir », « Demain », « Lundi 10 ». */
export function dayFr(iso, today = isoDay()) {
  const n = daysLeft(iso, today)
  if (n === 0) return 'Ce soir'
  if (n === 1) return 'Demain'
  const s = at(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Préparer la semaine, jour après jour : chaque jour, la recette qui finit le mieux ce qui presse
 * à cette date-là (ce qui sera déjà périmé ne compte plus, ce qu'un jour d'avant a déjà fini non
 * plus ; ce qui manque compte contre).
 *   pool : [{ id, title, image, used: [{ en, fr }], missed: [...] }]
 *   match(en) → l'article de nos réserves (ou null)
 *   taken : les articles déjà prévus ailleurs (pour changer la recette d'un seul jour)
 */
export function planWeek(pool, match, { count = 7, start = isoDay(), skip = [], taken = [] } = {}) {
  const cands = pool.filter(r => !skip.includes(r.id)).map(r => ({ r, items: [...new Map(r.used.map(u => match(u.en)).filter(Boolean).map(it => [it.id, it])).values()] }))
  const used = new Set(taken)
  const out = []
  for (let i = 0; i < count && cands.length; i++) {
    const date = addDays(start, i)
    const w = it => {
      const n = it.expires ? daysLeft(it.expires, date) : null
      if (n != null && n < 0) return used.has(it.id) ? 0 : -1.2          // il sera périmé ce jour-là
      if (used.has(it.id)) return n != null && n <= 6 ? 0 : 0.3          // déjà fini (frais), ou il en reste
      return n == null ? 1 : Math.max(1.5, 12 - n * 1.2)                 // plus c'est pressé, plus ça compte
    }
    const score = c => c.items.reduce((s, it) => s + w(it), 0) - 1.6 * c.r.missed.length
    let best = 0
    for (let k = 1; k < cands.length; k++) if (score(cands[k]) > score(cands[best])) best = k
    const [c] = cands.splice(best, 1)
    c.items.forEach(it => used.add(it.id))
    out.push({ date, recipe: slim(c.r), done: false })
  }
  return out
}
export const slim = r => ({ id: r.id, title: r.title, image: r.image, time: r.time || null, used: r.used, missed: r.missed })
