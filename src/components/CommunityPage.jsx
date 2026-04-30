import { useState, useCallback, useEffect } from 'react'
import { fetchPublicBooks } from '../hooks/useProfile'
import { IconUsers, IconSearch, IconBookOpen, IconThumbUp, IconThumbDown, IconSparkle } from './Icons'
import { useIsMobile } from '../hooks/useIsMobile'

const GOLD = '#816EBB'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1)  return "à l'instant"
  if (m < 60) return 'il y a ' + m + ' min'
  if (h < 24) return 'il y a ' + h + 'h'
  if (d < 7)  return 'il y a ' + d + ' j'
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function actionLabel(action) {
  if (action === 'added')     return 'a ajouté un livre'
  if (action === 'favorited') return 'a mis en favori'
  if (action === 'read')      return 'a fini de lire'
  if (action === 'en_cours')  return 'est en train de lire'
  if (action === 'rated')     return 'a noté'
  return 'a mis à jour'
}

function ratingInfo(rating) {
  if (rating === 5) return { Icon: IconSparkle,   label: "J'adore !",    color: '#fbbf24' }
  if (rating === 3) return { Icon: IconThumbUp,   label: "J'aime",       color: '#4ade80' }
  if (rating === 1) return { Icon: IconThumbDown, label: "Pas pour moi", color: '#f87171' }
  return null
}

function Avatar({ url, name, size = 42 }) {
  if (url) return (
    <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(129,110,187,0.25)', flexShrink: 0 }} />
  )
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#6557A0,#816EBB)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(129,110,187,0.25)', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

// ── Card activité style réseau social ─────────────────────────────────────────
function ActivityCard({ item }) {
  const profile = item.profiles
  const name    = profile?.display_name || profile?.username || 'Utilisateur'
  const handle  = profile?.username ? '@' + profile.username : null
  const cover   = item.book_cover
  const authors = Array.isArray(item.book_authors) ? item.book_authors : []
  const ri      = ratingInfo(item.rating)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(129,110,187,0.08)',
      borderRadius: 16,
      padding: '16px',
      marginBottom: 12,
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(129,110,187,0.18)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(129,110,187,0.08)'}
    >
      {/* Header : avatar + nom + temps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar url={profile?.avatar_url} name={name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8' }}>{name}</span>
            {handle && <span style={{ fontSize: 12, color: 'rgba(237,233,248,0.3)' }}>{handle}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(237,233,248,0.35)', marginTop: 1 }}>
            {actionLabel(item.action)} · {timeAgo(item.created_at)}
          </div>
        </div>
      </div>

      {/* Carte livre */}
      <div style={{
        display: 'flex', gap: 14,
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '12px',
        overflow: 'hidden',
      }}>
        {/* Couverture */}
        <div style={{ flexShrink: 0 }}>
          {cover ? (
            <img src={cover} alt={item.book_title} style={{ width: 56, height: 84, objectFit: 'cover', borderRadius: '3px 8px 8px 3px', boxShadow: '-3px 4px 14px rgba(0,0,0,0.6)', display: 'block' }} />
          ) : (
            <div style={{ width: 56, height: 84, borderRadius: '3px 8px 8px 3px', background: 'linear-gradient(145deg,#2D1B69,#1A0F3A)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '-3px 4px 14px rgba(0,0,0,0.6)' }}>
              <IconBookOpen size={22} color="rgba(237,233,248,0.3)" />
            </div>
          )}
        </div>

        {/* Infos livre */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#EDE9F8', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.book_title || 'Sans titre'}
          </div>
          {authors[0] && (
            <div style={{ fontSize: 12, color: 'rgba(237,233,248,0.4)' }}>{authors[0]}</div>
          )}

          {/* Note */}
          {ri && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <ri.Icon size={18} color={ri.color} />
              <span style={{ fontSize: 12, fontWeight: 600, color: ri.color }}>{ri.label}</span>
            </div>
          )}

          {/* Commentaire */}
          {item.notes && (
            <div style={{
              marginTop: 6,
              fontSize: 13,
              color: 'rgba(237,233,248,0.65)',
              fontStyle: 'italic',
              lineHeight: 1.5,
              borderLeft: '2px solid rgba(129,110,187,0.3)',
              paddingLeft: 10,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}>
              "{item.notes}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card utilisateur ───────────────────────────────────────────────────────────
function UserCard({ profile, isFollowing, onFollow, onUnfollow, onViewProfile }) {
  const name = profile.display_name || profile.username || 'Utilisateur'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid rgba(129,110,187,0.07)',
    }}>
      <div onClick={() => onViewProfile(profile)} style={{ cursor: 'pointer' }}>
        <Avatar url={profile.avatar_url} name={name} size={46} />
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onViewProfile(profile)}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        {profile.username && <div style={{ fontSize: 12, color: 'rgba(237,233,248,0.35)' }}>@{profile.username}</div>}
        {profile.bio && <div style={{ fontSize: 12, color: 'rgba(237,233,248,0.45)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.bio}</div>}
      </div>
      <button
        onClick={() => isFollowing ? onUnfollow(profile.id) : onFollow(profile.id)}
        style={{
          padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          background: isFollowing ? 'rgba(129,110,187,0.1)' : 'linear-gradient(135deg,#6557A0,#816EBB)',
          border: isFollowing ? '1px solid rgba(129,110,187,0.3)' : 'none',
          color: isFollowing ? GOLD : '#fff', transition: 'all 0.15s',
        }}>
        {isFollowing ? 'Abonné' : 'Suivre'}
      </button>
    </div>
  )
}

// ── Profil public ──────────────────────────────────────────────────────────────
function PublicProfile({ profile, onBack, userId, isFollowing, onFollow, onUnfollow }) {
  const [books, setBooks] = useState(null)
  const name = profile.display_name || profile.username || 'Utilisateur'

  useState(() => { fetchPublicBooks(profile.id).then(setBooks) })

  return (
    <div>
      <div style={{ height: 130, background: profile.cover_url ? 'none' : 'linear-gradient(135deg,#1a0a04,#5C3D2E)', backgroundImage: profile.cover_url ? `url(${profile.cover_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
        <button onClick={onBack} style={{ position: 'absolute', top: 12, left: 16, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 13, zIndex: 2, backdropFilter: 'blur(8px)' }}>
          ← Retour
        </button>
        <div style={{ position: 'absolute', bottom: -36, left: 20, zIndex: 2 }}>
          <Avatar url={profile.avatar_url} name={name} size={72} />
        </div>
      </div>

      <div style={{ padding: '46px 20px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#EDE9F8' }}>{name}</div>
          {profile.username && <div style={{ fontSize: 13, color: 'rgba(237,233,248,0.4)', marginTop: 2 }}>@{profile.username}</div>}
          {profile.bio && <div style={{ fontSize: 13, color: 'rgba(237,233,248,0.6)', marginTop: 8, lineHeight: 1.6, maxWidth: 340 }}>{profile.bio}</div>}
        </div>
        {profile.id !== userId && (
          <button onClick={() => isFollowing ? onUnfollow(profile.id) : onFollow(profile.id)}
            style={{
              padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              background: isFollowing ? 'rgba(129,110,187,0.1)' : 'linear-gradient(135deg,#6557A0,#816EBB)',
              border: isFollowing ? '1px solid rgba(129,110,187,0.3)' : 'none',
              color: isFollowing ? GOLD : '#fff',
            }}>
            {isFollowing ? 'Abonné' : 'Suivre'}
          </button>
        )}
      </div>

      <div style={{ padding: '8px 20px 40px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,233,248,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Bibliothèque — {books ? books.length + ' livres' : '…'}
        </div>
        {books === null ? (
          <div style={{ color: 'rgba(237,233,248,0.2)', fontSize: 13 }}>Chargement…</div>
        ) : books.length === 0 ? (
          <div style={{ color: 'rgba(237,233,248,0.2)', fontSize: 13 }}>Aucun livre public.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 12 }}>
            {books.map(book => {
              const cover = book.cover_url
              const title = book.title || 'Sans titre'
              return (
                <div key={book.id} title={title}>
                  <div style={{ aspectRatio: '2/3', borderRadius: '4px 8px 8px 4px', overflow: 'hidden', background: 'linear-gradient(145deg,#2D1B69,#1A0F3A)', boxShadow: '-2px 4px 12px rgba(0,0,0,0.6)' }}>
                    {cover
                      ? <img src={cover} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                          <span style={{ fontSize: 9, color: '#D4C8FF', textAlign: 'center', fontWeight: 700, lineHeight: 1.3 }}>{title}</span>
                        </div>
                    }
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(237,233,248,0.45)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function CommunityPage({
  userId,
  feed = [], following = [], loading = false,
  follow, unfollow, isFollowing, searchUsers,
  initialProfile = null, onProfileConsumed,
}) {
  const isMobile = useIsMobile()

  const [tab,           setTab]           = useState('feed')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching,     setSearching]     = useState(false)
  const [viewedProfile, setViewedProfile] = useState(null)

  // Ouvre un profil passé depuis la cloche de notif
  useEffect(() => {
    if (initialProfile) {
      setViewedProfile(initialProfile)
      onProfileConsumed?.()
    }
  }, [initialProfile])

  const handleSearch = useCallback(async (q) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const results = await searchUsers(q)
    setSearchResults(results)
    setSearching(false)
  }, [searchUsers])

  if (viewedProfile) {
    return (
      <PublicProfile
        profile={viewedProfile}
        onBack={() => setViewedProfile(null)}
        userId={userId}
        isFollowing={isFollowing(viewedProfile.id)}
        onFollow={follow}
        onUnfollow={unfollow}
      />
    )
  }

  const px = isMobile ? '16px' : '28px'

  return (
    <div style={{ maxWidth: 660, margin: '0 auto', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '20px 16px 14px' : '28px 28px 18px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconUsers size={20} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#EDE9F8' }}>Communauté</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(237,233,248,0.35)' }}>
            {following.length} abonnement{following.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(129,110,187,0.1)', padding: `0 ${px}`, marginBottom: 4 }}>
        {[
          { id: 'feed',      label: 'Fil d\'actu' },
          { id: 'recherche', label: 'Découvrir'   },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none',
            borderBottom: tab === t.id ? '2px solid #818cf8' : '2px solid transparent',
            color: tab === t.id ? '#818cf8' : 'rgba(237,233,248,0.35)',
            padding: '10px 18px', cursor: 'pointer', fontSize: 13,
            fontWeight: tab === t.id ? 700 : 400, transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: `0 ${px}` }}>

        {/* ── Fil d'actualité ── */}
        {tab === 'feed' && (
          <div style={{ paddingTop: 16 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ width: 28, height: 28, border: '2px solid rgba(129,140,248,0.2)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : feed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <IconUsers size={40} color="rgba(129,140,248,0.15)" />
                <p style={{ color: 'rgba(237,233,248,0.3)', fontSize: 14, marginTop: 14, lineHeight: 1.6 }}>
                  {following.length === 0
                    ? <>Abonne-toi à des lecteurs dans<br />"Découvrir" pour voir leur activité.</>
                    : 'Aucune activité récente de tes abonnements.'}
                </p>
              </div>
            ) : (
              <div>
                {feed.map(item => <ActivityCard key={item.id} item={item} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Découvrir ── */}
        {tab === 'recherche' && (
          <div style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(129,110,187,0.15)', borderRadius: 12, padding: '10px 16px', marginBottom: 20 }}>
              <IconSearch size={15} color="rgba(129,140,248,0.5)" />
              <input
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Chercher par pseudo ou nom..."
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'rgba(237,233,248,0.85)', fontSize: 14, fontFamily: 'inherit' }}
              />
            </div>

            {searching && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(237,233,248,0.3)', fontSize: 13 }}>Recherche…</div>
            )}

            {!searching && searchResults.length > 0 && searchResults.map(p => (
              <UserCard key={p.id} profile={p} isFollowing={isFollowing(p.id)} onFollow={follow} onUnfollow={unfollow} onViewProfile={setViewedProfile} />
            ))}

            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(237,233,248,0.25)', fontSize: 13 }}>
                Aucun lecteur trouvé pour "{searchQuery}"
              </div>
            )}

            {!searchQuery && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <IconSearch size={32} color="rgba(129,140,248,0.12)" />
                <p style={{ color: 'rgba(237,233,248,0.22)', fontSize: 13, marginTop: 10 }}>Tape un pseudo ou un nom</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
