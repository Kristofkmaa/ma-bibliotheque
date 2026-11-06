import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'

const KEY = id => `levana.livres.top.${id}`
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)) || [] } catch { return [] } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }
export const TOP_MAX = 5

/**
 * Notre top 5 de livres (les ids, du n°1 au n°5) : table Supabase `user_book_top` ; tant
 * qu'elle n'existe pas (ou en mode démo), gardé dans ce navigateur.
 */
export function useBookTop(userId) {
  const [ids, setIdsState] = useState([])
  const ref = useRef([])
  const local = useRef(isDemoMode)
  useEffect(() => {
    if (!userId) return
    let live = true
    ref.current = lsGet(KEY(userId)); setIdsState(ref.current)
    if (isDemoMode) return
    supabase.from('user_book_top').select('book_ids').eq('user_id', userId).maybeSingle().then(({ data, error }) => {
      if (!live) return
      if (error) { local.current = true; return }
      if (data?.book_ids) { ref.current = data.book_ids; setIdsState(ref.current); lsSet(KEY(userId), ref.current) }
    })
    return () => { live = false }
  }, [userId])
  const save = useCallback(next => {
    ref.current = next.slice(0, TOP_MAX)
    setIdsState(ref.current)
    lsSet(KEY(userId), ref.current)
    if (local.current) return
    supabase.from('user_book_top').upsert({ user_id: userId, book_ids: ref.current }).then(({ error }) => { if (error) local.current = true })
  }, [userId])
  /** Ajouter un livre à la fin du top (s'il est plein : à la place de « replace »). */
  const add = useCallback((id, replace = null) => {
    const cur = ref.current.filter(x => x !== id)
    if (replace) return save(cur.map(x => (x === replace ? id : x)))
    if (cur.length >= TOP_MAX) return
    save([...cur, id])
  }, [save])
  const remove = useCallback(id => save(ref.current.filter(x => x !== id)), [save])
  const move = useCallback((id, d) => {
    const cur = [...ref.current], i = cur.indexOf(id), j = i + d
    if (i < 0 || j < 0 || j >= cur.length) return
    ;[cur[i], cur[j]] = [cur[j], cur[i]]
    save(cur)
  }, [save])
  return { ids, add, remove, move, set: save }
}
