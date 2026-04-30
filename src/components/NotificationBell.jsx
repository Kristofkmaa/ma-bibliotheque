import { useState, useEffect, useRef } from 'react'
import { IconBell } from './Icons'

const GOLD = '#816EBB'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1)  return "à l'instant"
  if (m < 60) return m + ' min'
  if (h < 24) return h + 'h'
  if (d < 7)  return d + 'j'
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function MiniAvatar({ url, name, size = 36 }) {
  if (url) return (
    <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(129,110,187,0.25)' }} />
  )
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#6557A0,#816EBB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

export default function NotificationBell({ newFollowers = [], allFollowers = [], markNotificationsSeen, onViewProfile }) {
  const [open, setOpen] = useState(false)
  const ref  = useRef(null)
  const count = newFollowers.length

  // Ferme en cliquant dehors
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && count > 0) markNotificationsSeen?.()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>

      {/* Bouton cloche */}
      <button
        onClick={handleToggle}
        title="Notifications"
        style={{
          position: 'relative',
          width: 38, height: 38, borderRadius: '50%',
          background: open ? 'rgba(129,110,187,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(129,110,187,0.35)' : 'rgba(255,255,255,0.08)'}`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', flexShrink: 0,
        }}
      >
        <IconBell size={17} color={count > 0 ? GOLD : 'rgba(237,233,248,0.5)'} />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 17, height: 17, borderRadius: 9,
            background: '#f87171', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', border: '2px solid #0C0A15',
            lineHeight: 1,
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'fixed',
          top: 58, right: 12,
          width: 'min(310px, calc(100vw - 24px))',
          maxHeight: '65vh', overflowY: 'auto',
          background: 'rgba(12,10,21,0.98)',
          border: '1px solid rgba(129,110,187,0.18)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          zIndex: 2000,
        }}>
          <div style={{
            padding: '13px 16px 11px',
            borderBottom: '1px solid rgba(129,110,187,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#EDE9F8', letterSpacing: '0.01em' }}>Notifications</span>
            {count > 0 && (
              <span style={{ fontSize: 10, background: '#f87171', color: '#fff', borderRadius: 8, padding: '2px 7px', fontWeight: 700 }}>
                {count} nouveau{count > 1 ? 'x' : ''}
              </span>
            )}
          </div>

          {allFollowers.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔔</div>
              <div style={{ fontSize: 13, color: 'rgba(237,233,248,0.25)' }}>Personne ne te suit encore</div>
            </div>
          ) : (
            allFollowers.map(f => {
              if (!f.profile) return null
              const name = f.profile.display_name || f.profile.username || 'Utilisateur'
              const isNew = newFollowers.some(n => n.follower_id === f.follower_id)
              return (
                <div
                  key={f.follower_id}
                  onClick={() => { setOpen(false); onViewProfile?.(f.profile) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '11px 16px',
                    borderBottom: '1px solid rgba(129,110,187,0.05)',
                    cursor: 'pointer',
                    background: isNew ? 'rgba(248,113,113,0.04)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(129,110,187,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = isNew ? 'rgba(248,113,113,0.04)' : 'transparent'}
                >
                  <div style={{ position: 'relative' }}>
                    <MiniAvatar url={f.profile.avatar_url} name={name} size={38} />
                    {isNew && (
                      <span style={{ position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#f87171', border: '2px solid #0C0A15' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#EDE9F8', lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600, color: isNew ? GOLD : 'rgba(237,233,248,0.9)' }}>{name}</span>
                      {' '}te suit 👋
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.3)', marginTop: 2 }}>{timeAgo(f.created_at)}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
