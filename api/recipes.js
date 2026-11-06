/**
 * Relais des recettes : Spoonacular (les recettes) et DeepL (la traduction en français).
 * Les clés restent sur le serveur : SPOONACULAR_API_KEY et DEEPL_API_KEY dans Vercel.
 *   /api/recipes?have=egg,milk,tomato   → ce qu'on peut cuisiner avec ce qu'on a
 *   /api/recipes?q=gratin&type=…&diet=… → recherche (le texte est traduit en anglais)
 *   /api/recipes?random=1&type=…        → des idées
 *   /api/recipes?id=716429              → la fiche complète, en français
 *   /api/recipes?tr=courgette           → un mot traduit en anglais (un ingrédient à nous)
 *   /api/recipes?check=1                → les variables vues par le site (noms seulement)
 */
import { ingredientByEn, unitFr, isStaple } from '../src/lib/ingredients.js'

const trCache = new Map()   // traductions déjà faites (gardées tant que la fonction reste chaude)

const TYPES = { plat: 'main course', entree: 'appetizer', dessert: 'dessert', salade: 'salad', soupe: 'soup', petitdej: 'breakfast', apero: 'fingerfood', accompagnement: 'side dish', boisson: 'drink', sauce: 'sauce', pain: 'bread' }
const DIETS = { vegetarien: 'vegetarian', vegan: 'vegan', sansgluten: 'gluten free' }
const DISH_FR = { 'main course': 'Plat', 'main dish': 'Plat', dinner: 'Dîner', lunch: 'Déjeuner', 'side dish': 'Accompagnement', dessert: 'Dessert', appetizer: 'Entrée', starter: 'Entrée', salad: 'Salade', soup: 'Soupe', breakfast: 'Petit-déjeuner', brunch: 'Brunch', snack: 'En-cas', fingerfood: 'Apéro', sauce: 'Sauce', drink: 'Boisson', beverage: 'Boisson', bread: 'Pain', 'morning meal': 'Petit-déjeuner', antipasti: 'Antipasti', 'hor d\'oeuvre': 'Apéro', dip: 'Sauce', condiment: 'Condiment', spread: 'À tartiner', marinade: 'Marinade' }

const img = (u, size = '636x393') => (u ? String(u).replace(/-\d+x\d+(\.\w+)$/, `-${size}$1`) : null)
const strip = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const clip = (s, n) => String(s || '').trim().slice(0, n)

export default async function handler(req, res) {
  const names = Object.keys(process.env).filter(k => /spoon|deepl/i.test(k))
  const val = re => { const k = names.find(n => re.test(n.replace(/\s+/g, ''))); return k ? String(process.env[k] || '').trim() : '' }
  const spoonKey = val(/^SPOONACULAR_API_KEY$/i) || val(/spoon/i)
  const deeplKey = val(/^DEEPL_API_KEY$/i) || val(/deepl/i)
  const q = req.query

  if (q.check) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ variables: names.map(n => ({ nom: n, remplie: !!String(process.env[n] || '').trim() })), spoonacular: !!spoonKey, deepl: !!deeplKey, environnement: process.env.VERCEL_ENV || 'inconnu' })
    return
  }

  // ---- DeepL : plusieurs textes d'un coup, chacun gardé en mémoire ---------------------------------
  const translate = async (texts, from, to, context) => {
    const k = t => `${from}>${to}:${t}`
    const todo = [...new Set(texts.filter(t => t && !trCache.has(k(t))))]
    if (todo.length && deeplKey) {
      const host = deeplKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
      for (let i = 0; i < todo.length; i += 50) {
        const part = todo.slice(i, i + 50)
        try {
          const r = await fetch(`${host}/v2/translate`, {
            method: 'POST',
            headers: { Authorization: `DeepL-Auth-Key ${deeplKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: part, source_lang: from.toUpperCase(), target_lang: to === 'fr' ? 'FR' : 'EN-GB', ...(context ? { context } : {}) }),
          })
          if (!r.ok) break
          const d = await r.json()
          part.forEach((t, j) => { const out = d.translations?.[j]?.text; if (out) trCache.set(k(t), out) })
        } catch { break }
      }
    }
    return texts.map(t => (t ? trCache.get(k(t)) ?? t : t))
  }
  // un nom d'ingrédient : notre catalogue d'abord (sans dépenser de traduction), sinon DeepL
  const ingFr = async list => {
    const fr = list.map(en => ingredientByEn(en)?.fr || null)
    const rest = list.filter((en, i) => !fr[i])
    const tr = await translate(rest, 'en', 'fr', 'Ingrédients d’une recette de cuisine')
    let j = 0
    return fr.map(f => f || cap(tr[j++]))
  }
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

  if (q.tr) {
    const [en] = await translate([clip(q.tr, 60)], 'fr', 'en', 'Un ingrédient de cuisine')
    res.setHeader('Cache-Control', 'public, s-maxage=2592000')
    res.status(200).json({ text: String(en || q.tr).toLowerCase(), translated: !!deeplKey })
    return
  }

  if (!spoonKey) {
    res.status(503).json({ error: 'SPOONACULAR_API_KEY manquante dans Vercel', missing: 'spoonacular' })
    return
  }
  const spoon = async (path, params = {}) => {
    const u = new URL('https://api.spoonacular.com' + path)
    for (const [a, b] of Object.entries(params)) if (b !== undefined && b !== '') u.searchParams.set(a, String(b))
    const r = await fetch(u, { headers: { 'x-api-key': spoonKey, Accept: 'application/json' } })
    if (r.status === 402 || r.status === 429) throw Object.assign(new Error('quota'), { status: 429 })
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('clé'), { status: 401 })
    if (r.status === 404) throw Object.assign(new Error('introuvable'), { status: 404 })
    if (!r.ok) throw Object.assign(new Error('Spoonacular ' + r.status), { status: 502 })
    return r.json()
  }
  const titlesFr = list => translate(list.map(x => x.title || ''), 'en', 'fr', 'Titre d’une recette de cuisine')
  const card = (x, title) => ({ id: x.id, title, image: img(x.image, '480x360'), time: x.readyInMinutes || null, servings: x.servings || null, vegetarian: !!x.vegetarian })

  try {
    let out, maxAge = 86400
    if (q.have) {
      const have = String(q.have).split(',').map(s => clip(s, 40).toLowerCase()).filter(Boolean).slice(0, 60)
      const list = await spoon('/recipes/findByIngredients', { ingredients: have.join(','), number: Math.min(36, +q.n || 24), ranking: q.rank === 'used' ? 1 : 2, ignorePantry: true })
      const allIng = [...new Set(list.flatMap(x => [...(x.usedIngredients || []), ...(x.missedIngredients || [])].map(i => i.name)))]
      const [titles, ingNames] = await Promise.all([titlesFr(list), ingFr(allIng)])
      const fr = new Map(allIng.map((n, i) => [n, ingNames[i]]))
      const side = arr => (arr || []).filter(i => !isStaple(i.name)).map(i => ({ en: i.name, fr: fr.get(i.name) || i.name }))
      out = { results: list.map((x, i) => ({ ...card(x, titles[i]), used: side(x.usedIngredients), missed: side(x.missedIngredients), likes: x.likes || 0 })) }
    } else if (q.id) {
      const id = parseInt(q.id, 10)
      if (!(id > 0)) { res.status(400).json({ error: 'id attendu' }); return }
      const d = await spoon(`/recipes/${id}/information`, { includeNutrition: false })
      const ings = (d.extendedIngredients || []).filter((x, i, a) => a.findIndex(y => y.id === x.id && y.name === x.name) === i)
      let steps = (d.analyzedInstructions || []).flatMap(b => (b.steps || []).map(s => s.step)).filter(Boolean)
      if (!steps.length && d.instructions) steps = strip(d.instructions).split(/(?<=\.)\s+(?=[A-Z])/).filter(s => s.length > 3)
      steps = steps.map(s => clip(s, 900)).slice(0, 40)
      const [[title, ...stepsFr], names] = await Promise.all([
        translate([d.title || '', ...steps], 'en', 'fr', 'Une recette de cuisine, étape par étape'),
        ingFr(ings.map(x => x.nameClean || x.name)),
      ])
      out = {
        id: d.id, title, image: img(d.image), time: d.readyInMinutes || null, servings: d.servings || null,
        source: d.sourceUrl || null, sourceName: d.sourceName || d.creditsText || '',
        vegetarian: !!d.vegetarian, vegan: !!d.vegan, glutenFree: !!d.glutenFree, dairyFree: !!d.dairyFree,
        dish: [...new Set((d.dishTypes || []).map(t => DISH_FR[t]).filter(Boolean))].slice(0, 3),
        ingredients: ings.map((x, i) => {
          const m = x.measures?.metric || {}
          const amount = typeof m.amount === 'number' ? m.amount : typeof x.amount === 'number' ? x.amount : null
          return { en: x.nameClean || x.name, fr: names[i], amount, unit: unitFr(m.unitShort ?? x.unit), staple: isStaple(x.nameClean || x.name), image: x.image ? `https://img.spoonacular.com/ingredients_100x100/${x.image}` : null }
        }),
        steps: stepsFr,
      }
      maxAge = 2592000
    } else if (q.q || q.type || q.diet) {
      const [query] = q.q ? await translate([clip(q.q, 80)], 'fr', 'en', 'Recherche d’une recette de cuisine') : ['']
      const d = await spoon('/recipes/complexSearch', { query, type: TYPES[q.type], diet: DIETS[q.diet], number: 24, addRecipeInformation: true, instructionsRequired: true, sort: query ? undefined : 'popularity' })
      const list = d.results || []
      const titles = await titlesFr(list)
      out = { results: list.map((x, i) => card(x, titles[i])), total: d.totalResults || list.length }
    } else if (q.random) {
      const d = await spoon('/recipes/random', { number: 12, 'include-tags': TYPES[q.type] || undefined })
      const list = (d.recipes || []).filter(x => x.image)
      const titles = await titlesFr(list)
      out = { results: list.map((x, i) => card(x, titles[i])) }
      maxAge = 3600
    } else { res.status(400).json({ error: 'have, q, id ou random attendu' }); return }
    out.translated = !!deeplKey
    res.setHeader('Cache-Control', `public, max-age=600, s-maxage=${maxAge}`)
    res.status(200).json(out)
  } catch (e) {
    const s = e.status || 500
    const msg = s === 429 ? 'Plus de recherches de recettes pour aujourd’hui (le quota gratuit est atteint) : ça revient demain.'
      : s === 401 ? 'La clé Spoonacular est refusée' : s === 404 ? 'Recette introuvable' : 'Le livre de recettes ne répond pas'
    res.status(s === 401 ? 502 : s).json({ error: msg })
  }
}
