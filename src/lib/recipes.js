/**
 * Les recettes, par notre relais /api/recipes (Spoonacular, traduit en français par DeepL).
 * Chaque réponse est gardée le temps de la visite : on ne redemande jamais deux fois la même chose
 * (le compte gratuit de Spoonacular compte ses recherches).
 */
const cache = new Map()
function get(params) {
  const k = JSON.stringify(params)
  if (!cache.has(k)) {
    cache.set(k, fetch('/api/recipes?' + new URLSearchParams(params)).then(async r => {
      const d = await r.json().catch(() => null)
      if (!r.ok || !d) throw Object.assign(new Error(d?.error || 'Le livre de recettes ne répond pas'), { status: r.ok ? 503 : r.status, missing: d?.missing || null })
      return d
    }).catch(e => { cache.delete(k); throw e }))
  }
  return cache.get(k)
}

/** Avec ce qu'on a : la liste des noms anglais de nos réserves. rank 'missing' (rien ou peu à acheter) ou 'used'. */
export const recipesWith = (have, rank = 'missing') => get({ have: [...new Set(have)].sort().join(','), rank })
export const searchRecipes = (q, { type = '', diet = '' } = {}) => get({ q: q.trim(), ...(type ? { type } : {}), ...(diet ? { diet } : {}) })
export const randomRecipes = (type = '') => get({ random: '1', ...(type ? { type } : {}) })
export const recipeDetail = id => get({ id: String(id) })
/** Un ingrédient à nous (hors catalogue) : son nom anglais, pour chercher les recettes. */
export const toEnglish = text => get({ tr: text.trim() }).then(d => d.text).catch(() => text.trim().toLowerCase())

/** Les types de plats et régimes proposés (les clés sont celles du relais). */
export const DISH_TYPES = [['', 'Tout'], ['plat', 'Plats'], ['entree', 'Entrées'], ['salade', 'Salades'], ['soupe', 'Soupes'], ['dessert', 'Desserts'], ['petitdej', 'Petit-déj'], ['apero', 'Apéro']]
export const DIETS = [['', 'Tout le monde'], ['vegetarien', 'Végétarien'], ['vegan', 'Vegan'], ['sansgluten', 'Sans gluten']]

/** Une quantité lisible : 0.5 → ½, 1.333 → 1 ⅓, 250 → 250. */
export function amountFr(n) {
  if (n == null || !isFinite(n) || n <= 0) return ''
  if (n >= 10) return String(Math.round(n))
  const whole = Math.floor(n), f = n - whole
  const FR = [[0, ''], [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾'], [1, '']]
  let best = FR[0], d = 1
  for (const x of FR) { const e = Math.abs(f - x[0]); if (e < d) { d = e; best = x } }
  if (d > 0.08) return String(Math.round(n * 10) / 10).replace('.', ',')
  const w = best[0] === 1 ? whole + 1 : whole
  return (w ? String(w) : '') + (best[1] ? (w ? ' ' : '') + best[1] : '') || '0'
}
export const timeFr = m => (!m ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`)
