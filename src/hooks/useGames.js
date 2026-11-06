import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { uid } from '../lib/shelfOps'

const GAMES_KEY = id => `levana.games.${id}`
const RANK_KEY = id => `levana.games.top.${id}`        // l'ordre de « Mon top », si la colonne n'existe pas encore
const SETUP_KEY = id => `levana.pc.setup.${id}`        // le PC : fond d'écran et couleurs des lumières
const SETUP0 = { wallpaper: null, pc: 'rainbow', kb: 'rainbow' }

const normalize = g => ({
  id: g.id || uid(),
  app_id: g.app_id ?? null,             // le jeu chez Steam (ses grandes images)
  igdb_id: g.igdb_id ?? null,           // le jeu chez IGDB (toutes les plateformes)
  name: g.name || '',
  img: g.img || null,                   // la jaquette
  hero: g.hero || null,                 // la grande image
  genres: Array.isArray(g.genres) ? g.genres : [],
  platforms: Array.isArray(g.platforms) ? g.platforms : [],
  platform: g.platform || null,         // celle sur laquelle on y joue
  status: g.status || 'a_jouer',        // à jouer, en cours, terminé, abandonné
  release: g.release || '',
  favorite: !!g.favorite,
  rating: g.rating ?? null,
  fav_rank: g.favorite ? (g.fav_rank ?? null) : null,
  added_at: g.added_at || new Date().toISOString(),
})

const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

/**
 * Nos jeux (une bibliothèque, comme les livres et les films : on les ajoute, on note où on en
 * est) et les réglages du PC. Tables Supabase `user_games` et `user_wallet` (qui garde le
 * réglage du PC) ; tant qu'elles n'existent pas (ou en mode démo), tout reste dans ce navigateur.
 */
export function useGames(userId) {
  const [games, setGames] = useState([])
  const ref = useRef([])
  const local = useRef(isDemoMode)
  const [setup, setSetupState] = useState(SETUP0)
  const setupRef = useRef(SETUP0)
  // les colonnes ajoutées plus tard (fav_rank, wallpaper) : tant qu'elles manquent, on garde ça ici
  const rankCol = useRef(true)
  const setupCol = useRef(true)

  useEffect(() => {
    if (!userId) return
    let live = true
    setupRef.current = { ...SETUP0, ...lsGet(SETUP_KEY(userId), {}) }; setSetupState(setupRef.current)
    const fromLocal = () => {
      ref.current = lsGet(GAMES_KEY(userId), []).map(normalize); setGames(ref.current)
    }
    if (isDemoMode) { fromLocal(); return }
    Promise.all([
      supabase.from('user_games').select('*').eq('user_id', userId).order('added_at', { ascending: false }),
      supabase.from('user_wallet').select('pc_setup').eq('user_id', userId).maybeSingle(),
    ]).then(([g, wp]) => {
      if (!live) return
      if (g.error) { local.current = true; fromLocal(); return }
      let rows = g.data || []
      if (rows.length && !('fav_rank' in rows[0])) {
        rankCol.current = false
        const ranks = lsGet(RANK_KEY(userId), {})
        rows = rows.map(r => ({ ...r, fav_rank: ranks[r.app_id] ?? null }))
      }
      ref.current = rows.map(normalize); setGames(ref.current)
      if (wp.error) setupCol.current = false
      else if (wp.data?.pc_setup) { setupRef.current = { ...SETUP0, ...wp.data.pc_setup }; setSetupState(setupRef.current); lsSet(SETUP_KEY(userId), setupRef.current) }
    })
    return () => { live = false }
  }, [userId])

  const saveGames = useCallback(next => { ref.current = next; setGames(next); if (local.current) lsSet(GAMES_KEY(userId), next) }, [userId])
  const remote = useCallback(async fn => {
    if (local.current) return
    try { const { error } = await fn(); if (error) throw error } catch { local.current = true; lsSet(GAMES_KEY(userId), ref.current) }
  }, [userId])

  /** Le classement de « Mon top » : en base si la colonne existe, sinon dans ce navigateur. */
  const saveRanks = useCallback(changed => {
    lsSet(RANK_KEY(userId), Object.fromEntries(ref.current.filter(g => g.fav_rank != null).map(g => [g.app_id, g.fav_rank])))
    if (local.current || !rankCol.current) return
    Promise.all(changed.map(g => supabase.from('user_games').update({ fav_rank: g.fav_rank }).eq('id', g.id).eq('user_id', userId)))
      .then(rs => { if (rs.some(r => r.error)) rankCol.current = false }, () => { rankCol.current = false })
  }, [userId])

  /** Mettre un jeu dans « Mon top » (à la dernière place) ou l'en retirer (les suivants remontent). */
  const setFavorite = useCallback((id, on) => {
    const top = ref.current.filter(g => g.favorite && g.id !== id).sort((a, b) => (a.fav_rank ?? 1e9) - (b.fav_rank ?? 1e9))
    const me = ref.current.find(g => g.id === id)
    if (!me) return null
    const order = on ? [...top, me] : top
    const rank = new Map(order.map((g, i) => [g.id, i + 1]))
    const changed = []
    const next = ref.current.map(g => {
      const fav = g.id === id ? on : g.favorite
      const r = fav ? rank.get(g.id) : null
      if (g.favorite === fav && g.fav_rank === r) return g
      const n = { ...g, favorite: fav, fav_rank: r }
      changed.push(n)
      return n
    })
    saveGames(next)
    remote(() => supabase.from('user_games').update({ favorite: on }).eq('id', id).eq('user_id', userId))
    saveRanks(changed)
    return on ? rank.get(id) : null
  }, [saveGames, saveRanks, remote, userId])

  /** Nouvel ordre de « Mon top » (liste des ids, du premier au dernier). */
  const reorderTop = useCallback(ids => {
    const rank = new Map(ids.map((id, i) => [id, i + 1]))
    const changed = []
    const next = ref.current.map(g => {
      if (!rank.has(g.id) || g.fav_rank === rank.get(g.id)) return g
      const n = { ...g, fav_rank: rank.get(g.id) }
      changed.push(n)
      return n
    })
    saveGames(next)
    saveRanks(changed)
  }, [saveGames, saveRanks])

  /**
   * Le PC à notre goût : fond d'écran ({ url, name, app_id } ou null pour le fond Maruchime) et
   * couleur des lumières de la tour et du clavier ('rainbow' ou une couleur « #rrggbb »).
   */
  const setSetup = useCallback(patch => {
    setupRef.current = { ...setupRef.current, ...patch }
    setSetupState(setupRef.current)
    lsSet(SETUP_KEY(userId), setupRef.current)
    if (local.current || !setupCol.current) return
    supabase.from('user_wallet').upsert({ user_id: userId, pc_setup: setupRef.current })
      .then(({ error }) => { if (error) setupCol.current = false }, () => { setupCol.current = false })
  }, [userId])
  const setWallpaper = useCallback(w => setSetup({ wallpaper: w }), [setSetup])

  /** Le jeu du catalogue est-il déjà chez nous ? */
  const findGame = useCallback(item => ref.current.find(g => (item.igdb_id && g.igdb_id === item.igdb_id) || (item.app_id && g.app_id === item.app_id)) || null, [])

  /** Ajouter un jeu du catalogue à notre bibliothèque (une fiche du catalogue, cf. lib/games). */
  const addGame = useCallback((item, extra = {}) => {
    const have = findGame(item)
    if (have) return have
    const row = normalize({
      igdb_id: item.igdb_id, app_id: item.app_id, name: item.name, img: item.cover || item.coverFallback, hero: item.hero,
      genres: item.genres, platforms: item.platforms, release: item.date || (item.year ? String(item.year) : ''),
      platform: item.platforms?.length === 1 ? item.platforms[0] : null, ...extra,
    })
    saveGames([row, ...ref.current])
    const { fav_rank: _r, ...ins } = row   // eslint-disable-line no-unused-vars
    remote(() => supabase.from('user_games').insert({ ...ins, user_id: userId }))
    return row
  }, [findGame, saveGames, remote, userId])

  const updateGame = useCallback((id, patch) => {
    saveGames(ref.current.map(g => (g.id === id ? normalize({ ...g, ...patch }) : g)))
    remote(() => supabase.from('user_games').update(patch).eq('id', id).eq('user_id', userId))
  }, [saveGames, remote, userId])

  const removeGame = useCallback(id => {
    const g = ref.current.find(x => x.id === id)
    if (g?.favorite) setFavorite(id, false)
    saveGames(ref.current.filter(g => g.id !== id))
    remote(() => supabase.from('user_games').delete().eq('id', id).eq('user_id', userId))
  }, [saveGames, remote, userId, setFavorite])

  return { games, addGame, findGame, updateGame, removeGame, setFavorite, reorderTop, setup, setSetup, wallpaper: setup.wallpaper, setWallpaper }
}
