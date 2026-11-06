import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'

const KEY = id => `levana.vitrine.${id}`
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)) || [] } catch { return [] } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }
export const SHOWCASE_MAX = 8

/**
 * Nos médias préférés, posés sur le meuble télé du salon, dans l'ordre qu'on veut :
 * [{ kind: 'book' | 'work' | 'game', id }]. Table Supabase `user_showcase` ; tant qu'elle
 * n'existe pas (ou en mode démo), gardés dans ce navigateur.
 */
export function useShowcase(userId) {
  const [items, setItems] = useState([])
  const ref = useRef([])
  const local = useRef(isDemoMode)
  useEffect(() => {
    if (!userId) return
    let live = true
    ref.current = lsGet(KEY(userId)); setItems(ref.current)
    if (isDemoMode) return
    supabase.from('user_showcase').select('items').eq('user_id', userId).maybeSingle().then(({ data, error }) => {
      if (!live) return
      if (error) { local.current = true; return }
      if (Array.isArray(data?.items)) { ref.current = data.items; setItems(ref.current); lsSet(KEY(userId), ref.current) }
    })
    return () => { live = false }
  }, [userId])
  const save = useCallback(next => {
    ref.current = next.slice(0, SHOWCASE_MAX)
    setItems(ref.current)
    lsSet(KEY(userId), ref.current)
    if (local.current) return
    supabase.from('user_showcase').upsert({ user_id: userId, items: ref.current }).then(({ error }) => { if (error) local.current = true })
  }, [userId])
  const same = (a, b) => a.kind === b.kind && a.id === b.id
  const add = useCallback(it => { if (ref.current.some(x => same(x, it)) || ref.current.length >= SHOWCASE_MAX) return; save([...ref.current, { kind: it.kind, id: it.id }]) }, [save])
  const remove = useCallback(it => save(ref.current.filter(x => !same(x, it))), [save])
  const move = useCallback((it, d) => {
    const cur = [...ref.current], i = cur.findIndex(x => same(x, it)), j = i + d
    if (i < 0 || j < 0 || j >= cur.length) return
    ;[cur[i], cur[j]] = [cur[j], cur[i]]
    save(cur)
  }, [save])
  return { items, add, remove, move, set: save }
}
