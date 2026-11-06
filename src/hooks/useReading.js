import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'

const KEY = id => `levana.lectures.${id}`
const EMPTY = { books: {}, goals: {} }
const lsGet = k => { try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(k)) || {}) } } catch { return { ...EMPTY } } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

/**
 * Nos lectures : les dates de chaque livre ({ start, end, longAgo }) et l'objectif du défi de
 * chaque année. Une ligne par personne dans la table Supabase `user_reading` (colonne `data`, en
 * jsonb) ; tant qu'elle n'existe pas (ou en mode démo), gardé dans ce navigateur.
 */
export function useReading(userId) {
  const [data, setData] = useState(EMPTY)
  const ref = useRef(EMPTY)
  const local = useRef(isDemoMode)
  useEffect(() => {
    if (!userId) return
    let live = true
    ref.current = lsGet(KEY(userId)); setData(ref.current)
    if (isDemoMode) return
    supabase.from('user_reading').select('data').eq('user_id', userId).maybeSingle().then(({ data: row, error }) => {
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
    supabase.from('user_reading').upsert({ user_id: userId, data: ref.current, updated_at: new Date().toISOString() }).then(({ error }) => { if (error) local.current = true })
  }, [userId])

  const datesOf = useCallback(id => data.books[id] || {}, [data.books])
  const setDates = useCallback((id, dates) => save(d => ({ books: { ...d.books, [id]: { ...(d.books[id] || {}), ...dates } } })), [save])
  const forget = useCallback(id => save(d => { const b = { ...d.books }; delete b[id]; return { books: b } }), [save])
  const goalOf = useCallback(y => data.goals[y] ?? null, [data.goals])
  const setGoal = useCallback((y, n) => save(d => ({ goals: { ...d.goals, [y]: n } })), [save])
  return { datesOf, setDates, forget, goalOf, setGoal }
}
