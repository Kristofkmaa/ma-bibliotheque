import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useProfile(userId) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)

  const fetch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || null)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const save = async (updates) => {
    if (!userId) return
    setSaving(true)
    const payload = { ...updates, id: userId, updated_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()
    setSaving(false)
    if (error) throw error
    setProfile(data)
    return data
  }

  const checkUsername = async (username) => {
    if (!username || username.length < 3) return false
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', userId)
      .single()
    return !data // true = disponible
  }

  return { profile, loading, saving, save, refresh: fetch, checkUsername }
}

export async function fetchPublicProfile(username) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .eq('is_public', true)
    .single()
  return data
}

export async function fetchPublicBooks(userId) {
  const { data } = await supabase
    .from('user_books')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  return data || []
}
