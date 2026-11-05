import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { uid } from '../lib/shelfOps'

const LS_KEY = id => `levana.series.${id}`
const FIELDS = 'id,tmdb_id,name,overview,first_air_date,poster_path,backdrop_path,genres,seasons,networks,rating,added_at'

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
  added_at: s.added_at || new Date().toISOString(),
})

function lsLoad(id) {
  try { return (JSON.parse(localStorage.getItem(LS_KEY(id))) || []).map(normalize) } catch { return [] }
}
function lsSave(id, list) {
  try { localStorage.setItem(LS_KEY(id), JSON.stringify(list)) } catch { /* ignore */ }
}

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
    const done = list => { if (!cancelled) { ref.current = list; setSeries(list) } }
    if (isDemoMode) { done(lsLoad(userId)); return }
    supabase.from('user_series').select(FIELDS).eq('user_id', userId).order('added_at', { ascending: false })
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

  const set = useCallback(next => { ref.current = next; setSeries(next); if (local.current) lsSave(userId, next) }, [userId])
  const remote = useCallback(async fn => {
    if (local.current) return
    try { const { error } = await fn(); if (error) throw error } catch { local.current = true; lsSave(userId, ref.current) }
  }, [userId])

  const addSeries = useCallback(show => {
    if (ref.current.some(s => s.tmdb_id === show.tmdb_id)) return null
    const row = normalize({ ...show, id: uid(), added_at: new Date().toISOString() })
    set([row, ...ref.current])
    remote(() => supabase.from('user_series').insert({ ...row, user_id: userId }))
    return row
  }, [set, remote, userId])

  const updateSeries = useCallback((id, patch) => {
    set(ref.current.map(s => (s.id === id ? normalize({ ...s, ...patch }) : s)))
    remote(() => supabase.from('user_series').update(patch).eq('id', id).eq('user_id', userId))
  }, [set, remote, userId])

  const removeSeries = useCallback(id => {
    set(ref.current.filter(s => s.id !== id))
    remote(() => supabase.from('user_series').delete().eq('id', id).eq('user_id', userId))
  }, [set, remote, userId])

  return { series, addSeries, updateSeries, removeSeries }
}
