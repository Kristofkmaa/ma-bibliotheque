import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { uid } from '../lib/shelfOps'

const LS_KEY = id => `levana.series.${id}`
const EXTRA_KEY = id => `levana.series.extra.${id}`   // catégorie, film ou série, durée : gardés aussi ici (si les colonnes manquent)
const EXTRA = ['category', 'media', 'runtime']

const normalize = s => ({
  id: s.id || uid(),
  tmdb_id: s.tmdb_id,
  media: s.media === 'movie' ? 'movie' : 'tv',
  name: s.name || '',
  overview: s.overview || '',
  first_air_date: s.first_air_date || '',
  poster_path: s.poster_path || null,
  backdrop_path: s.backdrop_path || null,
  genres: Array.isArray(s.genres) ? s.genres : [],
  seasons: s.seasons ?? null,
  networks: Array.isArray(s.networks) ? s.networks : [],
  rating: s.rating ?? null,
  runtime: s.runtime ?? null,
  category: s.category || null,
  added_at: s.added_at || new Date().toISOString(),
})

function lsLoad(id) {
  try { return (JSON.parse(localStorage.getItem(LS_KEY(id))) || []).map(normalize) } catch { return [] }
}
function lsSave(id, list) {
  try { localStorage.setItem(LS_KEY(id), JSON.stringify(list)) } catch { /* ignore */ }
}
function extraLoad(id) {
  try { return JSON.parse(localStorage.getItem(EXTRA_KEY(id))) || {} } catch { return {} }
}
function extraSave(id, list) {
  const m = {}
  for (const s of list) {
    const e = {}
    if (s.category) e.category = s.category
    if (s.media === 'movie') e.media = 'movie'
    if (s.runtime) e.runtime = s.runtime
    if (Object.keys(e).length) m[s.id] = e
  }
  try { localStorage.setItem(EXTRA_KEY(id), JSON.stringify(m)) } catch { /* ignore */ }
}
// ce qui est gardé ici complète ce que Supabase ne connaît pas (colonnes pas encore créées)
const withExtra = (list, m) => list.map(s => {
  const e = m[s.id]
  if (!e) return s
  return { ...s, category: s.category || e.category || null, media: s.media === 'movie' ? 'movie' : e.media || s.media, runtime: s.runtime || e.runtime || null }
})
const sameWork = (a, b) => a.tmdb_id === b.tmdb_id && (a.media || 'tv') === (b.media || 'tv')

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
    const done = list => { if (!cancelled) { list = withExtra(list, extraLoad(userId)); ref.current = list; setSeries(list) } }
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

  const set = useCallback(next => { ref.current = next; setSeries(next); extraSave(userId, next); if (local.current) lsSave(userId, next) }, [userId])
  const remote = useCallback(async fn => {
    if (local.current) return
    try { const { error } = await fn(); if (error) throw error } catch { local.current = true; lsSave(userId, ref.current) }
  }, [userId])

  const addSeries = useCallback(show => {
    if (ref.current.some(s => sameWork(s, show))) return null
    const row = normalize({ ...show, id: uid(), added_at: new Date().toISOString() })
    set([row, ...ref.current])
    // d'abord avec toutes les colonnes ; si Supabase ne les a pas encore, sans elles (elles restent ici)
    remote(async () => {
      const full = await supabase.from('user_series').insert({ ...row, user_id: userId })
      if (!full.error) return full
      const base = { ...row, user_id: userId }
      for (const k of EXTRA) delete base[k]
      return supabase.from('user_series').insert(base)
    })
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
