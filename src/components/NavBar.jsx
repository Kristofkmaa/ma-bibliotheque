import { useIsMobile } from '../hooks/useIsMobile'
import {
  IconBook, IconCamera, IconLogOut, IconTrendingUp, IconSparkle,
  IconCheck, IconHome, IconPlay, IconHeart, IconList, IconUser, IconTag,
  IconUsers, IconSettings,
} from './Icons'
import { BibliSyLogoHorizontal, BibliSyIcon } from './BibliSyLogo'

const GOLD = '#816EBB'

// STATUS_NAV conservé pour les filter-chips de la page principale
export const STATUS_NAV = [
  { id: 'en_cours', label: 'En cours',     Icon: IconPlay,  color: '#a78bfa' },
  { id: 'possede',  label: 'Possédés',     Icon: IconHome,  color: '#818cf8' },
  { id: 'souhaite', label: 'WishList',     Icon: IconList,  color: '#fb923c' },
  { id: 'lu',       label: 'Déjà lu',      Icon: IconCheck, color: '#4ade80' },
  { id: 'prefere',  label: 'Mes préférés', Icon: IconHeart, color: '#f472b6' },
]

// ── Item de navigation ────────────────────────────────────────────────────────
function NavItem({ label, Icon, color = GOLD, count, badge, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '9px',
        width: '100%', padding: '8px 16px',
        background: active ? `${color}18` : 'none',
        border: 'none',
        borderLeft: active ? `2px solid ${color}` : '2px solid transparent',
        color: active ? color : 'rgba(237,233,248,0.45)',
        cursor: 'pointer', fontSize: '13px',
        fontWeight: active ? 600 : 400,
        textAlign: 'left', transition: 'all 0.18s',
        borderRadius: '0 8px 8px 0',
        marginRight: '8px',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(129,110,187,0.06)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none' }}
    >
      <Icon size={14} color={active ? color : 'rgba(237,233,248,0.35)'} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count !== undefined && (
        <span style={{
          fontSize: '10px', minWidth: '20px', textAlign: 'center',
          background: active ? `${color}22` : 'rgba(255,255,255,0.06)',
          color: active ? color : 'rgba(237,233,248,0.25)',
          padding: '1px 6px', borderRadius: '10px',
        }}>{count}</span>
      )}
      {badge > 0 && <Badge count={badge} />}
    </button>
  )
}

// ── Séparateur de section ─────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
      color: 'rgba(129,110,187,0.3)', textTransform: 'uppercase',
      padding: '14px 18px 4px', userSelect: 'none',
    }}>{children}</div>
  )
}

// ── Badge notif ───────────────────────────────────────────────────────────────
function Badge({ count }) {
  if (!count) return null
  return (
    <span style={{
      minWidth: 17, height: 17, borderRadius: 9,
      background: '#f87171', color: '#fff',
      fontSize: 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 4px', lineHeight: 1,
    }}>{count > 9 ? '9+' : count}</span>
  )
}

// ── Sidebar desktop ───────────────────────────────────────────────────────────
function DesktopSidebar({ user, books, activeView, onViewChange, onScannerOpen, onSignOut, notifCount = 0 }) {
  return (
    <nav style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: '220px',
      background: 'linear-gradient(180deg, #0C0A15 0%, #110D1E 60%, #0C0A15 100%)',
      borderRight: '1px solid rgba(129,110,187,0.1)',
      zIndex: 100, display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Logo Biblisy */}
      <div style={{ overflow: 'hidden', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src="/logo.png"
          alt="Biblisy"
          style={{ width: '360px', mixBlendMode: 'screen', display: 'block', flexShrink: 0 }}
        />
      </div>

      <div style={{ borderTop: '1px solid rgba(129,110,187,0.08)', margin: '0 12px' }} />

      {/* Ma collection */}
      <SectionLabel>Ma collection</SectionLabel>
      <NavItem
        label="Tous les livres" Icon={IconBook} color={GOLD}
        count={books.length}
        active={activeView === 'library'}
        onClick={() => onViewChange('library')}
      />

      <div style={{ borderTop: '1px solid rgba(129,110,187,0.08)', margin: '8px 12px' }} />

      {/* Explorer */}
      <SectionLabel>Explorer</SectionLabel>
      <NavItem
        label="Progression" Icon={IconTrendingUp} color="#a78bfa"
        active={activeView === 'progress'}
        onClick={() => onViewChange('progress')}
      />
      <NavItem
        label="Genres" Icon={IconTag} color="#818cf8"
        active={activeView === 'genres'}
        onClick={() => onViewChange('genres')}
      />
      <NavItem
        label="Suggestions IA" Icon={IconSparkle} color="#c084fc"
        active={activeView === 'ai'}
        onClick={() => onViewChange('ai')}
      />

      <div style={{ borderTop: '1px solid rgba(129,110,187,0.08)', margin: '8px 12px' }} />

      <SectionLabel>Social</SectionLabel>
      <NavItem
        label="Communaute" Icon={IconUsers} color="#818cf8"
        active={activeView === 'community'}
        onClick={() => onViewChange('community')}
      />
      <NavItem
        label="Mon compte" Icon={IconSettings} color={GOLD}
        active={activeView === 'account'}
        onClick={() => onViewChange('account')}
      />

      <div style={{ borderTop: '1px solid rgba(129,110,187,0.08)', margin: '8px 12px' }} />

      <NavItem
        label="Scanner un livre" Icon={IconCamera} color={GOLD}
        onClick={onScannerOpen}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Profil */}
      <div style={{ borderTop: '1px solid rgba(129,110,187,0.08)', margin: '0 12px', padding: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 16px 10px' }}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="Avatar"
              style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(129,110,187,0.3)', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(129,110,187,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconUser size={14} color={GOLD} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(237,233,248,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Lecteur'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(237,233,248,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {books.length} livre{books.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <button
          onClick={onSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            width: 'calc(100% - 24px)', margin: '0 12px',
            padding: '7px 12px',
            background: 'rgba(200,50,50,0.08)', border: '1px solid rgba(200,50,50,0.15)',
            borderRadius: '8px', color: 'rgba(237,233,248,0.35)',
            cursor: 'pointer', fontSize: '12px', transition: 'all 0.18s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,50,50,0.15)'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,50,50,0.08)'; e.currentTarget.style.color = 'rgba(237,233,248,0.35)' }}
        >
          <IconLogOut size={13} color="currentColor" /> Déconnexion
        </button>
      </div>
    </nav>
  )
}

// ── Bottom tabs mobile ─────────────────────────────────────────────────────────
function MobileBottomNav({ activeView, onViewChange, onScannerOpen, notifCount = 0 }) {
  const TABS = [
    { id: 'library',   Icon: IconHome,   view: 'library',   label: 'Accueil'    },
    { id: 'genres',    Icon: IconBook,   view: 'genres',    label: 'Bibliothèque' },
    { id: 'scanner',   Icon: IconCamera, special: true,     label: 'Scan'       },
    { id: 'community', Icon: IconUsers,  view: 'community', label: 'Communauté' },
    { id: 'account',   Icon: IconUser,   view: 'account',   label: 'Profil'     },
  ]

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: '60px',
      background: 'rgba(12,10,21,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(129,110,187,0.12)',
      display: 'flex', alignItems: 'center',
      zIndex: 200,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(({ id, Icon, view, special, label }) => {
        const active = !special && activeView === view
        return (
          <button
            key={id}
            onClick={() => special ? onScannerOpen() : onViewChange(view)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, position: 'relative',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {special ? (
              <div style={{
                width: 48, height: 48, borderRadius: '16px',
                background: 'linear-gradient(135deg, #6557A0, #816EBB)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(129,110,187,0.4)',
                transform: 'translateY(-8px)',
              }}>
                <Icon size={22} color="#fff" />
              </div>
            ) : (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Icon size={20} color={active ? GOLD : 'rgba(237,233,248,0.28)'} />
                <span style={{ fontSize: 9, color: active ? GOLD : 'rgba(237,233,248,0.28)', fontWeight: active ? 600 : 400, lineHeight: 1 }}>{label}</span>
                {/* Indicateur actif */}
                <div style={{
                  position: 'absolute', bottom: -4,
                  width: active ? 16 : 3, height: 3, borderRadius: 2,
                  background: active ? GOLD : 'transparent',
                  boxShadow: active ? ('0 0 8px ' + GOLD) : 'none',
                  transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                }} />
                {id === 'community' && notifCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -2, right: -5,
                    minWidth: 15, height: 15, borderRadius: 8,
                    background: '#f87171', color: '#fff',
                    fontSize: 8, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px', lineHeight: 1,
                  }}>{notifCount > 9 ? '9+' : notifCount}</span>
                )}
              </div>
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ── Export principal ───────────────────────────────────────────────────────────
export default function NavBar({ notifCount = 0, ...props }) {
  const isMobile = useIsMobile()
  return isMobile
    ? <MobileBottomNav notifCount={notifCount} {...props} />
    : <DesktopSidebar notifCount={notifCount} {...props} />
}
