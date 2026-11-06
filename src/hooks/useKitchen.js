import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { uid } from '../lib/shelfOps'
import { ingredientByFr, aisleOf, norm } from '../lib/ingredients'

const KEY = id => `levana.cuisine.${id}`
const EMPTY = { pantry: [], favorites: [], cooked: [], shopping: [] }
const lsGet = k => { try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(k)) || {}) } } catch { return { ...EMPTY } } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }
const same = (a, b) => norm(a) === norm(b)

/**
 * La cuisine : ce qu'il y a dans le frigo et les placards, nos recettes préférées, celles déjà
 * cuisinées, et la liste de courses. Une ligne par personne dans la table Supabase `user_kitchen`
 * (colonne `data` en jsonb) ; tant qu'elle n'existe pas (ou en mode démo), gardé dans ce navigateur.
 *   pantry   : [{ id, fr, en, alt, emoji, aisle, place: 'frigo' | 'placard', added_at }]
 *   favorites: [{ id, title, image, time }]   cooked: [{ id, title, image, at }]
 *   shopping : [{ id, fr, en, emoji, aisle, place, done }]
 */
export function useKitchen(userId) {
  const [data, setData] = useState(EMPTY)
  const ref = useRef(EMPTY)
  const local = useRef(isDemoMode)
  useEffect(() => {
    if (!userId) return
    let live = true
    ref.current = lsGet(KEY(userId)); setData(ref.current)
    if (isDemoMode) return
    supabase.from('user_kitchen').select('data').eq('user_id', userId).maybeSingle().then(({ data: row, error }) => {
      if (!live) return
      if (error) { local.current = true; return }
      if (row?.data) { ref.current = { ...EMPTY, ...row.data }; setData(ref.current); lsSet(KEY(userId), ref.current) }
    })
    return () => { live = false }
  }, [userId])

  const save = useCallback(fn => {
    ref.current = { ...ref.current, ...fn(ref.current) }
    setData(ref.current)
    lsSet(KEY(userId), ref.current)
    if (local.current) return
    supabase.from('user_kitchen').upsert({ user_id: userId, data: ref.current, updated_at: new Date().toISOString() }).then(({ error }) => { if (error) local.current = true })
  }, [userId])

  /** Ranger un ingrédient (du catalogue, ou à nous : { fr, en }). Déjà là au même endroit : rien. */
  const addItem = useCallback((it, place) => {
    const cat = it.aisle ? it : ingredientByFr(it.fr)
    const item = {
      id: uid(), fr: it.fr.trim(), en: (it.en || cat?.en || it.fr).toLowerCase(), alt: cat?.alt || it.alt || [],
      emoji: it.emoji || cat?.emoji || '🥣', aisle: it.aisle || cat?.aisle || (place === 'placard' ? 'conserves' : 'frais'),
      place: place || it.place || cat?.place || aisleOf(it.aisle).place, added_at: new Date().toISOString(),
    }
    save(d => (d.pantry.some(p => same(p.fr, item.fr) && p.place === item.place) ? {} : { pantry: [...d.pantry, item] }))
    return item
  }, [save])
  const removeItem = useCallback(id => save(d => ({ pantry: d.pantry.filter(p => p.id !== id) })), [save])
  const removeItems = useCallback(ids => { const s = new Set(ids); save(d => ({ pantry: d.pantry.filter(p => !s.has(p.id)) })) }, [save])
  const moveItem = useCallback((id, place) => save(d => ({ pantry: d.pantry.map(p => (p.id === id ? { ...p, place } : p)) })), [save])

  const isFavorite = useCallback(id => ref.current.favorites.some(f => f.id === id), [])
  const toggleFavorite = useCallback(r => save(d => (d.favorites.some(f => f.id === r.id)
    ? { favorites: d.favorites.filter(f => f.id !== r.id) }
    : { favorites: [{ id: r.id, title: r.title, image: r.image, time: r.time || null }, ...d.favorites] })), [save])
  const markCooked = useCallback(r => save(d => ({ cooked: [{ id: r.id, title: r.title, image: r.image, at: new Date().toISOString() }, ...d.cooked.filter(c => c.id !== r.id)].slice(0, 60) })), [save])

  /** La liste de courses : ce qui manque pour une recette, sans doublons. */
  const addShopping = useCallback(list => save(d => {
    const next = [...d.shopping]
    for (const it of list) {
      if (next.some(s => same(s.fr, it.fr) && !s.done)) continue
      const cat = ingredientByFr(it.fr)
      next.push({ id: uid(), fr: it.fr, en: it.en || cat?.en || '', emoji: cat?.emoji || '🛒', aisle: cat?.aisle || '', place: cat?.place || 'frigo', done: false })
    }
    return { shopping: next }
  }), [save])
  const toggleShopping = useCallback(id => save(d => ({ shopping: d.shopping.map(s => (s.id === id ? { ...s, done: !s.done } : s)) })), [save])
  const removeShopping = useCallback(id => save(d => ({ shopping: d.shopping.filter(s => s.id !== id) })), [save])
  /** Les courses cochées sont rangées : chacune à sa place (frigo ou placard), et quittent la liste. */
  const storeShopping = useCallback(() => save(d => {
    const bought = d.shopping.filter(s => s.done)
    const pantry = [...d.pantry]
    for (const s of bought) {
      if (pantry.some(p => same(p.fr, s.fr))) continue
      const cat = ingredientByFr(s.fr)
      pantry.push({ id: uid(), fr: s.fr, en: s.en || cat?.en || s.fr.toLowerCase(), alt: cat?.alt || [], emoji: s.emoji, aisle: s.aisle || cat?.aisle || 'frais', place: s.place || cat?.place || 'frigo', added_at: new Date().toISOString() })
    }
    return { pantry, shopping: d.shopping.filter(s => !s.done) }
  }), [save])

  return { ...data, addItem, removeItem, removeItems, moveItem, isFavorite, toggleFavorite, markCooked, addShopping, toggleShopping, removeShopping, storeShopping }
}
