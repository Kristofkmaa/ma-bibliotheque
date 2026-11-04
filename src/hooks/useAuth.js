import { useState, useEffect } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'

const DEMO_USER = { id: 'demo', email: 'demo@levana.local', demo: true }

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) return
    let done = false
    const finish = session => {
      if (done) return
      done = true
      setUser(session?.user ?? null)
      setLoading(false)
    }
    supabase.auth.getSession()
      .then(({ data: { session } }) => finish(session))
      .catch(err => { console.error('Session Supabase illisible :', err); finish(null) })
    // Si Supabase ne répond pas (projet en pause, réseau), on n'attend pas indéfiniment :
    // la page de connexion s'affiche et la session sera reprise par onAuthStateChange.
    const timer = setTimeout(() => finish(null), 6000)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => { clearTimeout(timer); subscription.unsubscribe() }
  }, [])

  const signInWithGoogle = async () => {
    if (isDemoMode) { setUser(DEMO_USER); return }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    if (isDemoMode) { setUser(null); return }
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { user, loading, signInWithGoogle, signOut }
}
