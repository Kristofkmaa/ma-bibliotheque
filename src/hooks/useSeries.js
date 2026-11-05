import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { uid } from '../lib/shelfOps'

const LS_KEY = id => `levana.series.${id}`
const CAT_KEY = id => `levana.series.cats.${id}`      // catégories, gardées aussi ici (si la colonne manque)

const normalize = s => ({
  id: s.id || uid(),
  tmdb_id: s.tmdb_id,
  name: s.name || '',
  overview: s.overview || '',
  first_air_date: s.first_air_date || '',
  poster_path: s.poster_path || null,
  backdrop_path: s.backdrop_path || null,
  genres: Array.isArray(s.genres) ? s.genres : [],
  seasons: s.seasons ?? null,
  networks: Array.isArray(s.networks) ? s.networks : [],
  rating: s.rating ?? null,
  category: s.category || null,
  added_at: s.added_at || new Date().toISOString(),
})

function lsLoad(id) {
  try { return (JSON.parse(localStorage.getItem(LS_KEY(id))) || []).map(normalize) } catch { return [] }
}
function lsSave(id, list) {
  try { localStorage.setItem(LS_KEY(id), JSON.stringify(list)) } catch { /* ignore */ }
}
function catsLoad(id) {
  try { return JSON.parse(localStorage.getItem(CAT_KEY(id))) || {} } catch { return {} }
}
function catsSave(id, list) {
  const m = {}
  for (const s of list) if (s.category) m[s.tmdb_id] = s.category
  try { localStorage.setItem(CAT_KEY(id), JSON.stringify(m)) } catch { /* ignore */ }
}
// la catégorie choisie ici l'emporte si Supabase ne la connaît pas (colonne pas encore créée)
const withCats = (list, m) => list.map(s => (s.category || !m[s.tmdb_id] ? s : { ...s, category: m[s.tmdb_id] }))

/**
 * Nos séries préférées (table Supabase `user_series`). Comme pour les étagères : tant que la
 * table n'existe pas (ou en mode démo), la liste est gardée dans ce navigateur, puis envoyée
 * vers Supabase dès que la table existe.
 */
export function useSeries(userId) {
  const [series, setSeries] = useState([])
  const ref = useRef([])
  const local = useRef(isDemoMode)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const done = list => { if (!cancelled) { list = withCats(list, catsLoad(userId)); ref.current = list; setSeries(list) } }
    if (isDemoMode) { done(lsLoad(userId)); return }
    supabase.from('user_series').select('*').eq('user_id', userId).order('added_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (error) { local.current = true; done(lsLoad(userId)); return }
        let list = (data || []).map(normalize)
        const saved = lsLoad(userId)
        if (!list.length && saved.length) {
          const { error: e2 } = await supabase.from('user_series').upsert(saved.map(s => ({ ...s, user_id: userId })))
          if (!e2) { list = saved; try { localStorage.removeItem(LS_KEY(userId)) } catch { /* ignore */ } }
        }
        done(list)
      })
    return () => { cancelled = true }
  }, [userId])

  const set = useCallback(next => { ref.current = next; setSeries(next); catsSave(userId, next); if (local.current) lsSave(userId, next) }, [userId])
  const remote = useCallback(async fn => {
    if (local.current) return
    try { const { error } = await fn(); if (error) throw error } catch { local.current = true; lsSave(userId, ref.current) }
  }, [userId])

  const addSeries = useCallback(show => {
    if (ref.current.some(s => s.tmdb_id === show.tmdb_id)) return null
    const row = normalize({ ...show, id: uid(), added_at: new Date().toISOString() })
    set([row, ...ref.current])
    const { category, ...base } = row
    remote(() => supabase.from('user_series').insert({ ...(category ? row : base), user_id: userId }))
    return row
  }, [set, remote, userId])

  const updateSeries = useCallback((id, patch) => {
    set(ref.current.map(s => (s.id === id ? normalize({ ...s, ...patch }) : s)))
    // la colonne « category » peut manquer : on n'abandonne pas Supabase pour autant (elle reste ici)
    if ('category' in patch) {
      if (!local.current) supabase.from('user_series').update({ category: patch.category }).eq('id', id).eq('user_id', userId).then(() => {}, () => {})
      const rest = { ...patch }; delete rest.category
      if (!Object.keys(rest).length) return
      patch = rest
    }
    remote(() => supabase.from('user_series').update(patch).eq('id', id).eq('user_id', userId))
  }, [set, remote, userId])

  const removeSeries = useCallback(id => {
    set(ref.current.filter(s => s.id !== id))
    remote(() => supabase.from('user_series').delete().eq('id', id).eq('user_id', userId))
  }, [set, remote, userId])

  /** Renomme une catégorie (toutes ses séries suivent). */
  const renameCategory = useCallback((from, to, members) => {
    const ids = new Set(members)
    for (const s of ref.current) if (ids.has(s.id)) updateSeries(s.id, { category: to || null })
  }, [updateSeries])

  return { series, addSeries, updateSeries, removeSeries, renameCategory }
}
