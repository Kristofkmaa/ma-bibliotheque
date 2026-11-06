import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { uid } from '../lib/shelfOps'

const GAMES_KEY = id => `levana.games.${id}`
const WALLET_KEY = id => `levana.wallet.${id}`

const normalize = g => ({
  id: g.id || uid(),
  app_id: g.app_id,
  name: g.name || '',
  img: g.img || null,
  genres: Array.isArray(g.genres) ? g.genres : [],
  release: g.release || '',
  price_paid: Number(g.price_paid) || 0,
  favorite: !!g.favorite,
  rating: g.rating ?? null,
  added_at: g.added_at || new Date().toISOString(),
})

const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

/**
 * Nos jeux (achetés dans Stim, avec de l'argent pour de faux) et le solde du porte-monnaie.
 * Tables Supabase `user_games` et `user_wallet` ; tant qu'elles n'existent pas (ou en mode
 * démo), tout est gardé dans ce navigateur.
 */
export function useGames(userId) {
  const [games, setGames] = useState([])
  const [balance, setBalance] = useState(0)
  const ref = useRef([])
  const bal = useRef(0)
  const local = useRef(isDemoMode)

  useEffect(() => {
    if (!userId) return
    let live = true
    const fromLocal = () => {
      ref.current = lsGet(GAMES_KEY(userId), []).map(normalize); setGames(ref.current)
      bal.current = lsGet(WALLET_KEY(userId), 0); setBalance(bal.current)
    }
    if (isDemoMode) { fromLocal(); return }
    Promise.all([
      supabase.from('user_games').select('*').eq('user_id', userId).order('added_at', { ascending: false }),
      supabase.from('user_wallet').select('balance').eq('user_id', userId).maybeSingle(),
    ]).then(([g, w]) => {
      if (!live) return
      if (g.error || w.error) { local.current = true; fromLocal(); return }
      ref.current = (g.data || []).map(normalize); setGames(ref.current)
      bal.current = Number(w.data?.balance) || 0; setBalance(bal.current)
    })
    return () => { live = false }
  }, [userId])

  const saveGames = useCallback(next => { ref.current = next; setGames(next); if (local.current) lsSet(GAMES_KEY(userId), next) }, [userId])
  const saveBalance = useCallback(v => {
    bal.current = Math.round(v * 100) / 100; setBalance(bal.current)
    if (local.current) { lsSet(WALLET_KEY(userId), bal.current); return }
    supabase.from('user_wallet').upsert({ user_id: userId, balance: bal.current }).then(({ error }) => { if (error) { local.current = true; lsSet(WALLET_KEY(userId), bal.current) } })
  }, [userId])
  const remote = useCallback(async fn => {
    if (local.current) return
    try { const { error } = await fn(); if (error) throw error } catch { local.current = true; lsSet(GAMES_KEY(userId), ref.current) }
  }, [userId])

  /** Ajouter des fonds (virement de la fausse banque). */
  const addFunds = useCallback(amount => saveBalance(bal.current + amount), [saveBalance])

  /** Acheter un jeu : false si le solde ne suffit pas. */
  const buy = useCallback(game => {
    if (ref.current.some(g => g.app_id === game.id)) return true
    const price = game.price || 0
    if (price > bal.current + 1e-9) return false
    saveBalance(bal.current - price)
    const row = normalize({ app_id: game.id, name: game.name, img: game.img, genres: game.genres, release: game.release, price_paid: price })
    saveGames([row, ...ref.current])
    remote(() => supabase.from('user_games').insert({ ...row, user_id: userId }))
    return true
  }, [saveBalance, saveGames, remote, userId])

  const updateGame = useCallback((id, patch) => {
    saveGames(ref.current.map(g => (g.id === id ? normalize({ ...g, ...patch }) : g)))
    remote(() => supabase.from('user_games').update(patch).eq('id', id).eq('user_id', userId))
  }, [saveGames, remote, userId])

  const removeGame = useCallback(id => {
    saveGames(ref.current.filter(g => g.id !== id))
    remote(() => supabase.from('user_games').delete().eq('id', id).eq('user_id', userId))
  }, [saveGames, remote, userId])

  return { games, balance, addFunds, buy, updateGame, removeGame }
}
