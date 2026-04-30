import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'
import { IconGlobe, IconShare, IconCheck, IconEdit, IconX, IconUser, IconBookOpen, IconCheckCircle, IconStar, IconUsers, IconClock, IconFlame, IconTrendingUp, IconCalendar, IconTrophy, IconBook, IconCrown, IconPencil, IconArrowDown, IconMoreH } from './Icons'
import { useIsMobile } from '../hooks/useIsMobile'

const GOLD  = '#816EBB'
const RATIO = 3.2
const CURRENT_YEAR = new Date().getFullYear()

// ─────────────────────────────────────────────────────────────────────────────
// CROP MODAL
// ─────────────────────────────────────────────────────────────────────────────
function CropModal({ file, onConfirm, onCancel }) {
  const [src,   setSrc]   = useState('')
  const [ox,    setOx]    = useState(0)
  const [oy,    setOy]    = useState(0)
  const [props, setProps] = useState({ nw: 0, nh: 0, sc: 1 })
  const [ready, setReady] = useState(false)

  const imgRef  = useRef(null)
  const boxRef  = useRef(null)
  const stRef   = useRef({})
  const dragRef = useRef(null)

  const cw = Math.min(window.innerWidth - 48, 520)
  const ch = Math.round(cw / RATIO)
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

  useEffect(() => {
    const r = new FileReader()
    r.onload = e => setSrc(e.target.result)
    r.readAsDataURL(file)
  }, [file])

  useEffect(() => { stRef.current = { ox, oy, ...props, cw, ch } }, [ox, oy, props, cw, ch])

  const onLoad = () => {
    const img = imgRef.current
    if (!img) return
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    const sc = Math.max(cw / nw, ch / nh)
    setProps({ nw, nh, sc })
    setOx((cw - nw * sc) / 2)
    setOy((ch - nh * sc) / 2)
    setReady(true)
  }

  useEffect(() => {
    const el = boxRef.current
    if (!el || !ready) return
    const onTS = e => {
      e.preventDefault()
      dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onTM = e => {
      e.preventDefault()
      if (!dragRef.current) return
      const dx = e.touches[0].clientX - dragRef.current.x
      const dy = e.touches[0].clientY - dragRef.current.y
      dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      const { nw, nh, sc, cw, ch } = stRef.current
      setOx(p => clamp(p + dx, cw - nw * sc, 0))
      setOy(p => clamp(p + dy, ch - nh * sc, 0))
    }
    const onTE = () => { dragRef.current = null }
    el.addEventListener('touchstart', onTS, { passive: false })
    el.addEventListener('touchmove',  onTM, { passive: false })
    el.addEventListener('touchend',   onTE)
    return () => {
      el.removeEventListener('touchstart', onTS)
      el.removeEventListener('touchmove',  onTM)
      el.removeEventListener('touchend',   onTE)
    }
  }, [ready])

  const onMouseDown = e => {
    e.preventDefault()
    dragRef.current = { x: e.clientX, y: e.clientY }
    const move = e => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.x
      const dy = e.clientY - dragRef.current.y
      dragRef.current = { x: e.clientX, y: e.clientY }
      const { nw, nh, sc, cw, ch } = stRef.current
      setOx(p => clamp(p + dx, cw - nw * sc, 0))
      setOy(p => clamp(p + dy, ch - nh * sc, 0))
    }
    const up = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const confirm = () => {
    const img = new Image()
    img.onload = () => {
      const { sc } = props
      const sX = -ox / sc, sY = -oy / sc
      const sW = cw / sc,  sH = ch / sc
      const outW = Math.min(1600, Math.round(sW))
      const outH = Math.round(sH * outW / sW)
      const canvas = document.createElement('canvas')
      canvas.width = outW; canvas.height = outH
      canvas.getContext('2d').drawImage(img, sX, sY, sW, sH, 0, 0, outW, outH)
      canvas.toBlob(b => onConfirm(new File([b], 'cover.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.93)
    }
    img.src = src
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(7,5,15,0.97)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <p style={{ color: 'rgba(237,233,248,0.5)', fontSize: 13, margin: '0 0 16px', textAlign: 'center' }}>
        Fais glisser l'image pour cadrer la couverture
      </p>
      <div
        ref={boxRef}
        onMouseDown={ready ? onMouseDown : undefined}
        style={{
          width: cw, height: ch, position: 'relative',
          overflow: 'hidden', borderRadius: 10, flexShrink: 0,
          border: '2px solid ' + GOLD,
          cursor: ready ? 'grab' : 'default',
          background: '#0C0A15', userSelect: 'none', touchAction: 'none',
        }}
      >
        {src && (
          <img ref={imgRef} src={src} onLoad={onLoad} draggable={false} alt=""
            style={{
              position: 'absolute', left: ox, top: oy,
              width:  props.nw * props.sc,
              height: props.nh * props.sc,
              pointerEvents: 'none', display: 'block',
            }}
          />
        )}
        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, border: '2px solid rgba(129,110,187,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'ap-spin 0.8s linear infinite' }} />
          </div>
        )}
        {ready && [1/3, 2/3].map(f => (
          <div key={f + 'h'} style={{ position: 'absolute', left: 0, right: 0, top: (f * 100) + '%', height: 1, background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        ))}
        {ready && [1/3, 2/3].map(f => (
          <div key={f + 'v'} style={{ position: 'absolute', top: 0, bottom: 0, left: (f * 100) + '%', width: 1, background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button onClick={onCancel}
          style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(129,110,187,0.25)', background: 'none', color: 'rgba(237,233,248,0.5)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          Annuler
        </button>
        <button onClick={confirm} disabled={!ready}
          style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: ready ? 'linear-gradient(135deg,#6557A0,#816EBB)' : 'rgba(129,110,187,0.12)', color: ready ? '#fff' : 'rgba(237,233,248,0.2)', fontSize: 14, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          Utiliser cette photo
        </button>
      </div>
      <style>{'@keyframes ap-spin { to { transform: rotate(360deg); } }'}</style>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL PANEL
// ─────────────────────────────────────────────────────────────────────────────
function SocialAvatar({ url, name, size }) {
  size = size || 42
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(129,110,187,0.25)', flexShrink: 0 }} />
  const ini = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#6557A0,#816EBB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {ini}
    </div>
  )
}

function SocialCard({ profile, isFollowing, onFollow, onUnfollow, onViewProfile }) {
  const name = profile.display_name || profile.username || 'Utilisateur'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(129,110,187,0.07)' }}>
      <div onClick={() => onViewProfile && onViewProfile(profile)} style={{ cursor: 'pointer' }}>
        <SocialAvatar url={profile.avatar_url} name={name} size={44} />
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onViewProfile && onViewProfile(profile)}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        {profile.username && <div style={{ fontSize: 12, color: 'rgba(237,233,248,0.35)' }}>@{profile.username}</div>}
        {profile.bio && <div style={{ fontSize: 12, color: 'rgba(237,233,248,0.45)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.bio}</div>}
      </div>
      {isFollowing !== undefined && (
        <button
          onClick={() => isFollowing ? onUnfollow(profile.id) : onFollow(profile.id)}
          style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, background: isFollowing ? 'rgba(129,110,187,0.1)' : 'linear-gradient(135deg,#6557A0,#816EBB)', border: isFollowing ? '1px solid rgba(129,110,187,0.3)' : 'none', color: isFollowing ? GOLD : '#fff', transition: 'all 0.15s' }}>
          {isFollowing ? 'Abonné' : 'Suivre'}
        </button>
      )}
    </div>
  )
}

function SocialPanel({ initialTab, followers, followingProfiles, isFollowing, follow, unfollow, onViewProfile, onClose }) {
  const [tab, setTab] = useState(initialTab || 'following')
  const list = tab === 'following'
    ? followingProfiles
    : followers.map(f => f.profile).filter(Boolean)

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(7,5,15,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 560, background: 'linear-gradient(180deg,#110D1E,#0C0A15)', border: '1px solid rgba(129,110,187,0.15)', borderBottom: 'none', borderRadius: '20px 20px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(129,110,187,0.25)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 20px 0', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'following', label: followingProfiles.length + ' abonnements' },
              { id: 'followers', label: followers.length + ' abonnés' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 14, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#EDE9F8' : 'rgba(237,233,248,0.35)', borderBottom: tab === t.id ? ('2px solid ' + GOLD) : '2px solid transparent', transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(237,233,248,0.5)' }}>
            <IconX size={14} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 20px 32px', flex: 1 }}>
          {list.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><IconUsers size={32} color="rgba(237,233,248,0.15)" /></div>
              <div style={{ fontSize: 13, color: 'rgba(237,233,248,0.25)' }}>
                {tab === 'following' ? 'Tu ne suis personne encore' : 'Personne ne te suit encore'}
              </div>
            </div>
          ) : (
            list.map((p, i) => (
              <SocialCard
                key={p.id || i}
                profile={p}
                isFollowing={isFollowing && isFollowing(p.id)}
                onFollow={follow}
                onUnfollow={unfollow}
                onViewProfile={p => { onViewProfile && onViewProfile(p); onClose() }}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS PROFIL
// ─────────────────────────────────────────────────────────────────────────────
function MonthlyBarChart({ data }) {
  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const max = Math.max(...data, 1)
  const BAR_MAX = 52
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, paddingTop: 6 }}>
      {data.map((val, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 8, color: val > 0 ? 'rgba(237,233,248,0.55)' : 'transparent', lineHeight: 1, minHeight: 10 }}>{val || ''}</span>
          <div style={{
            width: '100%',
            height: val ? Math.max(6, Math.round((val / max) * BAR_MAX)) : 3,
            background: val ? 'rgba(129,110,187,0.75)' : 'rgba(255,255,255,0.06)',
            borderRadius: '3px 3px 3px 3px',
          }} />
          <span style={{ fontSize: 7, color: 'rgba(237,233,248,0.25)', whiteSpace: 'nowrap' }}>{MONTHS[i]}</span>
        </div>
      ))}
    </div>
  )
}

function StarRow({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 1, marginTop: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: 10, color: i <= Math.round(rating) ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}>★</span>
      ))}
    </div>
  )
}

const BADGES_DEF = [
  { id: 'premiers_pas',  name: 'Premiers pas',  desc: '5 livres lus',       Icon: IconBook,         color: '#816EBB', bg: 'rgba(101,87,160,0.3)',  check: (r) => r >= 5  },
  { id: 'regulier',      name: 'Régulier',       desc: '7 jours de suite',   Icon: IconCheckCircle,  color: '#22c55e', bg: 'rgba(34,197,94,0.25)',  check: ()  => false   },
  { id: 'devoreur',      name: 'Dévoreur',       desc: '20 livres lus',      Icon: IconStar,         color: '#f59e0b', bg: 'rgba(245,158,11,0.25)', check: (r) => r >= 20 },
  { id: 'marathonien',   name: 'Marathonien',    desc: '10h de lecture',     Icon: IconClock,        color: '#6366f1', bg: 'rgba(99,102,241,0.25)', check: ()  => false   },
  { id: 'collectionneur',name: 'Collectionneur', desc: '15 livres possédés', Icon: IconCrown,        color: '#ef4444', bg: 'rgba(239,68,68,0.25)',  check: (r, b) => b >= 15 },
]

function BadgeChip({ badge, earned }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: '0 0 auto', opacity: earned ? 1 : 0.3 }}>
      <div style={{
        width: 58, height: 58, borderRadius: '50%',
        background: earned ? badge.bg : 'rgba(255,255,255,0.04)',
        border: `2px solid ${earned ? badge.color : 'rgba(255,255,255,0.08)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: earned ? `0 0 16px ${badge.color}44` : 'none',
      }}>
        <badge.Icon size={26} color={earned ? badge.color : 'rgba(255,255,255,0.2)'} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#EDE9F8', whiteSpace: 'nowrap' }}>{badge.name}</div>
        <div style={{ fontSize: 9, color: 'rgba(237,233,248,0.35)', whiteSpace: 'nowrap' }}>{badge.desc}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT FORM
// ─────────────────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(129,110,187,0.2)',
  borderRadius: 10, color: '#EDE9F8', fontSize: 14, outline: 'none',
  fontFamily: "'Inter','Helvetica Neue',sans-serif", transition: 'border 0.15s',
}

function Field({ label, hint, hintColor, children }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(237,233,248,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: hintColor || 'rgba(237,233,248,0.3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AccountPage({ user, books, followers, followingProfiles, follow, unfollow, isFollowing, onViewProfile, onProgressClick }) {
  followers = followers || []
  followingProfiles = followingProfiles || []

  const isMobile = useIsMobile()
  const { profile, loading, saving, save, checkUsername } = useProfile(user && user.id)

  const [username,        setUsername]        = useState('')
  const [displayName,     setDisplayName]     = useState('')
  const [bio,             setBio]             = useState('')
  const [avatarUrl,       setAvatarUrl]       = useState('')
  const [coverUrl,        setCoverUrl]        = useState('')
  const [isPublic,        setIsPublic]        = useState(false)
  const [usernameOk,      setUsernameOk]      = useState(null)
  const [checkingUser,    setCheckingUser]    = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [editMode,        setEditMode]        = useState(false)
  const [socialPanel,     setSocialPanel]     = useState(null)
  const [cropFile,        setCropFile]        = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover,  setUploadingCover]  = useState(false)
  const [coverHovered,    setCoverHovered]    = useState(false)
  const [avatarHovered,   setAvatarHovered]   = useState(false)

  const avatarInputRef = useRef(null)
  const coverInputRef  = useRef(null)

  useEffect(() => {
    if (!profile) return
    setUsername(profile.username || '')
    setDisplayName(profile.display_name || '')
    setBio(profile.bio || '')
    setAvatarUrl(profile.avatar_url || (user && user.user_metadata && user.user_metadata.avatar_url) || '')
    setCoverUrl(profile.cover_url || '')
    setIsPublic(profile.is_public || false)
  }, [profile, user])

  useEffect(() => {
    if (!editMode) return
    if (!username || username.length < 3) { setUsernameOk(null); return }
    const t = setTimeout(async () => {
      setCheckingUser(true)
      const ok = await checkUsername(username)
      setUsernameOk(ok)
      setCheckingUser(false)
    }, 500)
    return () => clearTimeout(t)
  }, [username, editMode])

  const uploadFile = async (file, bucket) => {
    const ext  = (file.name.split('.').pop()) || 'jpg'
    const path = user.id + '/' + bucket + '_' + Date.now() + '.' + ext
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  const handleAvatarUpload = async e => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    try { setAvatarUrl(await uploadFile(file, 'avatars')) }
    catch (err) { console.error(err) }
    finally { setUploadingAvatar(false); e.target.value = '' }
  }

  const handleCoverUpload = e => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    e.target.value = ''
    setCropFile(file)
  }

  const handleCropConfirm = async croppedFile => {
    setCropFile(null)
    setUploadingCover(true)
    try { setCoverUrl(await uploadFile(croppedFile, 'covers')) }
    catch (err) { console.error(err) }
    finally { setUploadingCover(false) }
  }

  const handleSave = async () => {
    if (usernameOk === false) return
    await save({
      username:     username     || null,
      display_name: displayName  || null,
      bio,
      avatar_url:   avatarUrl,
      cover_url:    coverUrl,
      is_public:    isPublic,
    })
    setSaved(true)
    setTimeout(() => { setSaved(false); setEditMode(false) }, 1800)
  }

  const cancelEdit = () => {
    if (profile) {
      setUsername(profile.username || '')
      setDisplayName(profile.display_name || '')
      setBio(profile.bio || '')
      setAvatarUrl(profile.avatar_url || (user && user.user_metadata && user.user_metadata.avatar_url) || '')
      setCoverUrl(profile.cover_url || '')
      setIsPublic(profile.is_public || false)
    }
    setUsernameOk(null)
    setEditMode(false)
  }

  const shareUrl = profile && profile.username ? window.location.origin + '/u/' + profile.username : null
  const copyLink = () => {
    const url = shareUrl || window.location.href
    navigator.clipboard.writeText(url)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const bookCount   = books.length
  const readCount   = books.filter(b => (b.statuses?.length ? b.statuses : [b.status]).includes('lu') || (b.statuses?.length ? b.statuses : [b.status]).includes('prefere')).length
  const favCount    = books.filter(b => (b.statuses?.length ? b.statuses : [b.status]).includes('prefere')).length
  const enCours     = books.filter(b => (b.statuses?.length ? b.statuses : [b.status]).includes('en_cours')).length

  const ratedBooks  = books.filter(b => b.rating && b.rating > 0)
  const avgRating   = ratedBooks.length
    ? (ratedBooks.reduce((s, b) => s + b.rating, 0) / ratedBooks.length).toFixed(1)
    : 0

  const readingMin  = readCount * 150
  const readingH    = Math.floor(readingMin / 60)
  const readingM    = readingMin % 60
  const readingTime = readingH > 0 ? `${readingH}h${readingM > 0 ? ` ${readingM}m` : ''}` : `${readingM}m`

  // Objectif annuel
  const goal = useMemo(() => {
    try { return Number(localStorage.getItem(`reading_goal_${CURRENT_YEAR}`)) || 12 } catch { return 12 }
  }, [])
  const pct       = Math.min(readCount / Math.max(goal, 1), 1)
  const remaining = Math.max(0, goal - readCount)
  const monthsLeft = Math.max(1, 12 - new Date().getMonth())
  const perMonth  = remaining > 0 ? (remaining / monthsLeft).toFixed(1) : 0

  // Données mensuelles (par updated_at des livres lus)
  const monthlyData = useMemo(() => {
    const arr = Array(12).fill(0)
    books.forEach(b => {
      const s = b.statuses?.length ? b.statuses : [b.status]
      if (s.includes('lu') || s.includes('prefere')) {
        const raw = b.updated_at || b.created_at
        if (!raw) return
        const d = new Date(raw)
        if (d.getFullYear() === CURRENT_YEAR) arr[d.getMonth()]++
      }
    })
    return arr
  }, [books])

  const shownName = displayName || username || 'Mon profil'
  const pad = isMobile ? '16px' : '20px'

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(129,110,187,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'ap-spin 0.8s linear infinite' }} />
      <style>{'@keyframes ap-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 100 }}>
      <style>{`
        @keyframes ap-spin { to { transform: rotate(360deg); } }
        .ap-btn-edit:hover { opacity: 0.85 !important; }
        .ap-btn-share:hover { opacity: 0.85 !important; }
      `}</style>

      {cropFile && <CropModal file={cropFile} onConfirm={handleCropConfirm} onCancel={() => setCropFile(null)} />}
      {socialPanel && (
        <SocialPanel
          initialTab={socialPanel}
          followers={followers}
          followingProfiles={followingProfiles}
          isFollowing={isFollowing}
          follow={follow}
          unfollow={unfollow}
          onViewProfile={onViewProfile}
          onClose={() => setSocialPanel(null)}
        />
      )}

      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
      <input ref={coverInputRef}  type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />

      {/* ── COVER ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 200,
          background: coverUrl
            ? (`url(${coverUrl}) center/cover no-repeat`)
            : 'linear-gradient(135deg,#1E1535 0%,#2D1B69 40%,#110D1E 100%)',
          cursor: editMode ? 'pointer' : 'default',
          overflow: 'hidden',
        }}
        onClick={() => { if (editMode) coverInputRef.current && coverInputRef.current.click() }}
        onMouseEnter={() => setCoverHovered(true)}
        onMouseLeave={() => setCoverHovered(false)}
      >
        {/* Gradient overlay bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(0deg, rgba(12,10,21,0.85) 0%, transparent 100%)', pointerEvents: 'none' }} />

        {editMode && (
          <div style={{ position: 'absolute', inset: 0, background: coverHovered ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
            {uploadingCover ? (
              <div style={{ width: 28, height: 28, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ap-spin 0.7s linear infinite' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,0.5)', padding: '7px 16px', borderRadius: 20, backdropFilter: 'blur(6px)' }}>
                <IconEdit size={14} color="rgba(255,255,255,0.9)" />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                  {coverUrl ? 'Changer la couverture' : 'Ajouter une couverture'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Boutons cover (haut droite) */}
        {!editMode && (
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
            <button onClick={copyLink}
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IconShare size={15} color="#EDE9F8" />
            </button>
            <button onClick={() => setEditMode(true)}
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IconMoreH size={15} color="#EDE9F8" />
            </button>
          </div>
        )}
        {editMode && (
          <div style={{ position: 'absolute', top: 12, right: 12 }} onClick={e => e.stopPropagation()}>
            <button onClick={cancelEdit}
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '6px 14px', color: 'rgba(237,233,248,0.7)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* ── AVATAR + BOUTONS ACTION ── */}
      <div style={{ position: 'relative', padding: `0 ${pad}` }}>
        {/* Avatar */}
        <div
          style={{ position: 'absolute', top: -44, left: pad, zIndex: 10, cursor: editMode ? 'pointer' : 'default' }}
          onClick={() => { if (editMode && avatarInputRef.current) avatarInputRef.current.click() }}
          onMouseEnter={() => setAvatarHovered(true)}
          onMouseLeave={() => setAvatarHovered(false)}
        >
          <div style={{ position: 'relative', width: 88, height: 88, borderRadius: '50%' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={shownName} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid #0C0A15', display: 'block' }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#6557A0,#816EBB)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #0C0A15' }}>
                <IconUser size={32} color="#fff" />
              </div>
            )}
            {editMode && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: (avatarHovered || uploadingAvatar) ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                {uploadingAvatar ? (
                  <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ap-spin 0.7s linear infinite' }} />
                ) : (
                  <IconEdit size={16} color="#fff" />
                )}
              </div>
            )}
            {/* Pastille édition */}
            {editMode && (
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0C0A15' }}>
                <IconEdit size={11} color="#fff" />
              </div>
            )}
          </div>
        </div>

        {/* Boutons Modifier / Partager */}
        <div style={{ paddingTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {!editMode ? (
            <>
              <button
                className="ap-btn-edit"
                onClick={() => setEditMode(true)}
                style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(237,233,248,0.25)', background: 'rgba(255,255,255,0.04)', color: '#EDE9F8', fontSize: 13, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(6px)', transition: 'opacity 0.15s' }}>
                Modifier le profil
              </button>
              <button
                className="ap-btn-share"
                onClick={() => setSocialPanel('followers')}
                style={{ padding: '8px 18px', borderRadius: 20, border: 'none', background: 'linear-gradient(135deg,#6557A0,#816EBB)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s' }}>
                Suivre
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ── NOM + BIO ── */}
      <div style={{ padding: `48px ${pad} 0` }}>
        {!editMode ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#EDE9F8', lineHeight: 1.2 }}>{shownName}</div>
            {profile?.username && (
              <div style={{ fontSize: 13, color: 'rgba(237,233,248,0.4)', marginTop: 3 }}>@{profile.username}</div>
            )}
            {profile?.bio && (
              <p style={{ fontSize: 14, color: 'rgba(237,233,248,0.65)', margin: '8px 0 0', lineHeight: 1.65 }}>{profile.bio}</p>
            )}
            {!profile?.bio && !profile?.username && (
              <p style={{ fontSize: 13, color: 'rgba(237,233,248,0.2)', marginTop: 6, fontStyle: 'italic' }}>
                Complète ton profil en cliquant sur "Modifier le profil"
              </p>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: GOLD, letterSpacing: '0.03em', marginBottom: 2 }}>
              <IconPencil size={13} color={GOLD} /> Mode édition
            </div>

            <Field label="Pseudo (@)"
              hint={checkingUser ? 'Vérification...' : usernameOk === true ? '✓ Disponible' : usernameOk === false ? '✗ Déjà pris' : ''}
              hintColor={usernameOk === true ? '#4ade80' : '#f87171'}>
              <input value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="Mon_Pseudo" maxLength={30} style={inputStyle} />
            </Field>

            <Field label="Prénom / Nom" hint="optionnel" hintColor="rgba(237,233,248,0.25)">
              <input value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Ton nom ou surnom" maxLength={60} style={inputStyle} />
            </Field>

            <Field label="Biographie">
              <textarea value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Parle de tes gouts litteraires..." rows={3} maxLength={300}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
            </Field>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.15)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <IconGlobe size={20} color={isPublic ? '#4ade80' : 'rgba(237,233,248,0.3)'} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(237,233,248,0.85)' }}>Profil {isPublic ? 'public' : 'prive'}</div>
                <div style={{ fontSize: 12, color: 'rgba(237,233,248,0.35)', marginTop: 2 }}>{isPublic ? 'Visible par tous les utilisateurs' : 'Visible uniquement par toi'}</div>
              </div>
              <button onClick={() => setIsPublic(!isPublic)}
                style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: isPublic ? GOLD : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 3, left: isPublic ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
              </button>
            </div>

            <button onClick={handleSave} disabled={saving || usernameOk === false}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: saved ? 'rgba(74,222,128,0.15)' : (saving || usernameOk === false) ? 'rgba(129,110,187,0.12)' : 'linear-gradient(135deg,#6557A0,#816EBB)', color: saved ? '#4ade80' : (saving || usernameOk === false) ? 'rgba(237,233,248,0.25)' : '#fff', fontSize: 14, fontWeight: 700, cursor: (saving || usernameOk === false) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
              {saved ? 'Sauvegardé !' : saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            <button onClick={cancelEdit}
              style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid rgba(129,110,187,0.2)', background: 'none', color: 'rgba(237,233,248,0.4)', fontSize: 14, cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* ── STATS ROW ── (seulement en mode affichage) */}
      {!editMode && (
        <>
          <div style={{ display: 'flex', padding: `16px ${pad}`, gap: 4, borderBottom: '1px solid rgba(129,110,187,0.08)' }}>
            {[
              { val: bookCount,        label: 'Livres',  StatIcon: IconBookOpen,    onClick: null },
              { val: readCount,        label: 'Lus',     StatIcon: IconCheckCircle, onClick: null },
              { val: favCount,         label: 'Favoris', StatIcon: IconStar,        onClick: null },
              { val: followers.length, label: 'Abonnés', StatIcon: IconUsers,       onClick: () => setSocialPanel('followers') },
            ].map((s, i) => (
              <button
                key={i}
                onClick={s.onClick}
                style={{ flex: 1, background: 'none', border: 'none', cursor: s.onClick ? 'pointer' : 'default', padding: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><s.StatIcon size={12} color="rgba(237,233,248,0.4)" /></div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#EDE9F8', lineHeight: 1.1 }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'rgba(237,233,248,0.35)' }}>{s.label}</div>
              </button>
            ))}
          </div>

          {/* ── CARTE PROGRESSION ── */}
          <div
            onClick={onProgressClick}
            style={{
              margin: `14px ${pad}`,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(129,110,187,0.15)',
              borderRadius: 16,
              padding: '16px',
              cursor: onProgressClick ? 'pointer' : 'default',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { if (onProgressClick) e.currentTarget.style.borderColor = 'rgba(129,110,187,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(129,110,187,0.15)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconTrendingUp size={16} color={GOLD} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8' }}>Progression {CURRENT_YEAR}</div>
                  <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.4)' }}>Ton objectif de lecture annuel</div>
                </div>
              </div>
              {onProgressClick && (
                <span style={{ fontSize: 12, color: GOLD, fontWeight: 600, whiteSpace: 'nowrap' }}>Voir détails →</span>
              )}
            </div>

            <div style={{ fontSize: 26, fontWeight: 800, color: '#EDE9F8', marginBottom: 8 }}>
              {readCount} <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(237,233,248,0.4)' }}>/ {goal} livres</span>
            </div>

            {/* Barre de progression */}
            <div style={{ height: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%',
                width: `${Math.round(pct * 100)}%`,
                background: pct >= 1 ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#6557A0,#816EBB)',
                borderRadius: 6,
                transition: 'width 0.8s ease',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.4)' }}>
                {remaining > 0
                  ? `• encore ${remaining} à lire  •  ~${perMonth}/mois pour atteindre ton objectif`
                  : 'Objectif atteint !'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: pct >= 1 ? '#4ade80' : GOLD }}>
                {Math.round(pct * 100)} %
              </div>
            </div>
          </div>

          {/* ── 3 MINI STATS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: `0 ${pad}` }}>
            {/* Temps de lecture */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 14, padding: '14px 10px' }}>
              <div style={{ marginBottom: 4 }}><IconClock size={18} color="#a78bfa" /></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#EDE9F8', lineHeight: 1 }}>{readingTime}</div>
              <div style={{ fontSize: 9, color: 'rgba(237,233,248,0.4)', marginTop: 4, lineHeight: 1.3 }}>Temps de lecture</div>
              {readCount > 0 && <div style={{ fontSize: 9, color: '#4ade80', marginTop: 4, fontWeight: 600 }}>estimé</div>}
            </div>

            {/* Note moyenne */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 14, padding: '14px 10px' }}>
              <div style={{ marginBottom: 4 }}><IconStar size={18} color="#fbbf24" /></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#EDE9F8', lineHeight: 1 }}>{avgRating > 0 ? avgRating : '--'}</div>
              <div style={{ fontSize: 9, color: 'rgba(237,233,248,0.4)', marginTop: 4, lineHeight: 1.3 }}>Note moyenne</div>
              {avgRating > 0 && <StarRow rating={parseFloat(avgRating)} />}
            </div>

            {/* Séries suivies */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 14, padding: '14px 10px' }}>
              <div style={{ marginBottom: 4 }}><IconFlame size={18} color="#f97316" /></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#EDE9F8', lineHeight: 1 }}>{enCours}</div>
              <div style={{ fontSize: 9, color: 'rgba(237,233,248,0.4)', marginTop: 4, lineHeight: 1.3 }}>Séries suivies</div>
              {enCours > 0 && <div style={{ fontSize: 9, color: '#f97316', marginTop: 4, fontWeight: 600 }}>En cours</div>}
            </div>
          </div>

          {/* ── LECTURE PAR MOIS ── */}
          <div style={{ margin: `14px ${pad}`, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 16, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IconCalendar size={15} color={GOLD} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#EDE9F8' }}>Lecture par mois</span>
              </div>
              <span style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>{CURRENT_YEAR}</span>
            </div>
            <MonthlyBarChart data={monthlyData} />
          </div>

          {/* ── BADGES ── */}
          <div style={{ margin: `0 ${pad} 14px` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IconTrophy size={15} color="#fbbf24" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#EDE9F8' }}>Badges obtenus</span>
              </div>
              <span style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>Voir tous →</span>
            </div>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
              {BADGES_DEF.map(badge => (
                <BadgeChip
                  key={badge.id}
                  badge={badge}
                  earned={badge.check(readCount, bookCount)}
                />
              ))}
            </div>
          </div>

          {/* ── BOUTONS BAS DE PAGE ── */}
          <div style={{
            position: 'fixed',
            bottom: isMobile ? 60 : 0,
            left: isMobile ? 0 : '220px',
            right: 0,
            display: 'flex', zIndex: 50,
            background: 'rgba(12,10,21,0.95)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(129,110,187,0.1)',
          }}>
            <button
              onClick={() => setEditMode(true)}
              style={{ flex: 1, padding: '14px', border: 'none', background: 'none', color: '#EDE9F8', fontSize: 15, fontWeight: 700, cursor: 'pointer', borderRight: '1px solid rgba(129,110,187,0.1)' }}>
              Modifier
            </button>
            <button
              onClick={copyLink}
              style={{ flex: 1, padding: '14px', border: 'none', background: 'none', color: GOLD, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {saved ? 'Lien copié !' : 'Partager'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
