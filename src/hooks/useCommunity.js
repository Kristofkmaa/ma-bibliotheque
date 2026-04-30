import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useCommunity(userId) {
  const [feed,             setFeed]             = useState([])
  const [following,        setFollowing]        = useState([])       // IDs
  const [followingProfiles,setFollowingProfiles] = useState([])      // profils complets
  const [followers,        setFollowers]        = useState([])       // gens qui me suivent
  const [newFollowers,     setNewFollowers]     = useState([])       // nouveaux
  const [loading,          setLoading]          = useState(false)

  const fetchFollowing = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
    const ids = (data || []).map(f => f.following_id)
    setFollowing(ids)
    // Récupère aussi les profils complets des abonnements
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, is_public')
        .in('id', ids)
      setFollowingProfiles(profiles || [])
    } else {
      setFollowingProfiles([])
    }
  }, [userId])

  const fetchFollowers = useCallback(async () => {
    if (!userId) return

    // Récupère les gens qui me suivent + leur profil
    const { data: followData } = await supabase
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })

    if (!followData?.length) { setFollowers([]); setNewFollowers([]); return }

    // Récupère mon profil pour savoir quand j'ai vu les notifs
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('notifications_seen_at')
      .eq('id', userId)
      .single()

    const seenAt = myProfile?.notifications_seen_at
      ? new Date(myProfile.notifications_seen_at)
      : null

    // Récupère les profils des followers
    const ids = followData.map(f => f.follower_id)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, is_public')
      .in('id', ids)

    const profileMap = {}
    ;(profileData || []).forEach(p => { profileMap[p.id] = p })

    const enriched = followData.map(f => ({
      ...f,
      profile: profileMap[f.follower_id] || null,
      isNew: seenAt ? new Date(f.created_at) > seenAt : true,
    }))

    setFollowers(enriched)
    setNewFollowers(enriched.filter(f => f.isNew))
  }, [userId])

  const fetchFeed = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data: followData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    const ids = (followData || []).map(f => f.following_id)
    if (ids.length === 0) { setFeed([]); setLoading(false); return }

    const { data: activityData } = await supabase
      .from('activity')
      .select('*')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(60)

    // Enrichit avec les profils
    if (activityData?.length) {
      const uids = [...new Set(activityData.map(a => a.user_id))]
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', uids)
      const pm = {}
      ;(profileData || []).forEach(p => { pm[p.id] = p })
      setFeed(activityData.map(a => ({ ...a, profiles: pm[a.user_id] || null })))
    } else {
      setFeed([])
    }
    setLoading(false)
  }, [userId])

  // Marque les notifications comme vues
  const markNotificationsSeen = useCallback(async () => {
    if (!userId || !newFollowers.length) return
    await supabase
      .from('profiles')
      .update({ notifications_seen_at: new Date().toISOString() })
      .eq('id', userId)
    setNewFollowers([])
  }, [userId, newFollowers])

  // Chargement initial
  useEffect(() => {
    fetchFollowing()
    fetchFollowers()
    fetchFeed()
  }, [fetchFollowing, fetchFollowers, fetchFeed])

  // Temps réel : nouveau follower → mise à jour des notifs
  useEffect(() => {
    if (!userId) return
    const sub = supabase
      .channel('follows-realtime-' + userId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'follows',
        filter: 'following_id=eq.' + userId,
      }, () => {
        fetchFollowers()
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId, fetchFollowers])

  // Temps réel : nouvelle activité d'un abonnement → mise à jour du feed
  useEffect(() => {
    if (!userId) return
    const sub = supabase
      .channel('activity-realtime-' + userId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity',
      }, () => {
        fetchFeed()
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId, fetchFeed])

  const follow = async (targetId) => {
    if (!userId || userId === targetId) return
    await supabase.from('follows').insert({ follower_id: userId, following_id: targetId })
    fetchFollowing()
    fetchFollowers()
  }

  const unfollow = async (targetId) => {
    if (!userId) return
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', userId)
      .eq('following_id', targetId)
    fetchFollowing()
    fetchFollowers()
  }

  const isFollowing = (targetId) => following.includes(targetId)

  const searchUsers = async (query) => {
    if (!query || query.length < 2) return []
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, is_public')
      .or('username.ilike.%' + query + '%,display_name.ilike.%' + query + '%')
      .eq('is_public', true)
      .neq('id', userId)
      .limit(15)
    return data || []
  }

  const logActivity = async ({ action, book, rating, notes }) => {
    if (!userId || !book) return
    await supabase.from('activity').insert({
      user_id: userId,
      action,
      book_title:  book.title  || book.volumeInfo?.title  || null,
      book_author: (book.authors || book.volumeInfo?.authors || []).join(', ') || null,
      book_cover:  book.cover   || book.cover_url           || book.volumeInfo?.imageLinks?.thumbnail || null,
      book_google_id: book.googleId || book.google_id       || null,
      rating: rating || null,
      notes:  notes  || null,
    })
  }

  const refresh = () => {
    fetchFollowing()
    fetchFollowers()
    fetchFeed()
  }

  return {
    feed, following, followingProfiles, followers, newFollowers, loading,
    follow, unfollow, isFollowing, searchUsers, logActivity,
    markNotificationsSeen, refresh,
  }
}
