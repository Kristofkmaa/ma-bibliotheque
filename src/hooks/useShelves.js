import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'

const LS_KEY = uid => `levana.shelves.${uid}`
const FIELDS = 'id,name,position,material,wall,doors,book_ids'

const normalize = (s, i) => ({
  id: s.id, name: s.name || 'Étagère', position: i,
  material: s.material || 'chene', wall: s.wall || 'papier', doors: s.doors || 'panneau',
  book_ids: Array.isArray(s.book_ids) ? s.book_ids : [],
})

function lsLoad(uid) {
  try { return (JSON.parse(localStorage.getItem(LS_KEY(uid))) || []).map(normalize) } catch { return [] }
}
function lsSave(uid, list) {
  try { localStorage.setItem(LS_KEY(uid), JSON.stringify(list)) } catch { /* ignore */ }
}

/**
 * Étagères de l'utilisatrice, enregistrées dans la table Supabase `shelves`.
 * Si la table n'existe pas encore (migration SQL pas encore lancée) ou en mode démo,
 * le rangement est gardé dans ce navigateur : rien ne casse, et il sera envoyé
 * vers Supabase dès que la table existera.
 */
export function useShelves(userId) {
  const [shelves, setShelves] = useState([])
  const [storage, setStorage] = useState(isDemoMode ? 'local' : 'remote')
  const [ready, setReady] = useState(false)
  const ref = useRef([])
  const storageRef = useRef(storage)

  const fallbackLocal = useCallback(reason => {
    if (storageRef.current !== 'local') console.warn('Étagères gardées dans ce navigateur :', reason)
    storageRef.current = 'local'
    setStorage('local')
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const done = list => {
      if (cancelled) return
      ref.current = list
      setShelves(list)
      setReady(true)
    }
    if (isDemoMode) { done(lsLoad(userId)); return }
    supabase.from('shelves').select(FIELDS).eq('user_id', userId).order('position')
      .then(async ({ data, error }) => {
        if (error) { fallbackLocal(error.message); done(lsLoad(userId)); return }
        let list = (data || []).map(normalize)
        // Rangement fait avant la migration : on l'envoie maintenant vers Supabase
        const local = lsLoad(userId)
        if (!list.length && local.length) {
          const { error: e2 } = await supabase.from('shelves').upsert(local.map(s => ({ ...s, user_id: userId })))
          if (!e2) { list = local; try { localStorage.removeItem(LS_KEY(userId)) } catch { /* ignore */ } }
        }
        done(list)
      })
    return () => { cancelled = true }
  }, [userId, fallbackLocal])

  const commit = useCallback(async raw => {
    const next = raw.map(normalize)
    const prev = ref.current
    ref.current = next
    setShelves(next)
    if (storageRef.current === 'local') { lsSave(userId, next); return }
    const before = new Map(prev.map(s => [s.id, JSON.stringify(s)]))
    const changed = next.filter(s => before.get(s.id) !== JSON.stringify(s))
    const removed = prev.filter(s => !next.some(n => n.id === s.id)).map(s => s.id)
    try {
      if (changed.length) {
        const { error } = await supabase.from('shelves').upsert(changed.map(s => ({ ...s, user_id: userId })))
        if (error) throw error
      }
      if (removed.length) {
        const { error } = await supabase.from('shelves').delete().in('id', removed).eq('user_id', userId)
        if (error) throw error
      }
    } catch (e) {
      fallbackLocal(e.message || String(e))
      lsSave(userId, next)
    }
  }, [userId, fallbackLocal])

  return { shelves, commit, storage, ready }
}
