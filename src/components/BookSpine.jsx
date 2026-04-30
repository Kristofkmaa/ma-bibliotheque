import { memo } from 'react'

// CSS injecté une seule fois — uniquement transform et opacity (GPU natif, jamais filter)
if (typeof document !== 'undefined' && !document.getElementById('book-spine-styles')) {
  const s = document.createElement('style')
  s.id = 'book-spine-styles'
  s.textContent = `
    @keyframes spineIn {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .book-spine-wrap {
      cursor: pointer;
      transition: transform 0.15s ease;
    }
    .book-spine-wrap:hover {
      transform: translateY(-4px);
    }
    .book-spine-wrap:hover .spine-hover-overlay {
      opacity: 0;
    }
  `
  document.head.appendChild(s)
}

const SPINE_COLORS = [
  { bg: '#8B2635', text: '#FFD6DA', accent: '#C4414F' },
  { bg: '#2D1B69', text: '#D4C8FF', accent: '#6557A0' },
  { bg: '#2D6A4F', text: '#C8F0D8', accent: '#40A072' },
  { bg: '#7B4F12', text: '#FFE4B5', accent: '#A8720A' },
  { bg: '#4A1A6B', text: '#E8C8FF', accent: '#7B3FAA' },
  { bg: '#1A5C6B', text: '#C0EEF8', accent: '#2A8BA0' },
  { bg: '#6B3030', text: '#FFD0C0', accent: '#9C4040' },
  { bg: '#2B4A1E', text: '#D0F0C0', accent: '#4A7A2A' },
  { bg: '#5C4A1A', text: '#FFF0C0', accent: '#8C7020' },
  { bg: '#1A2B5C', text: '#C0D0FF', accent: '#2A4A9C' },
]

function getSpineColor(title = '', googleId = '') {
  const seed = (title + googleId).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return SPINE_COLORS[seed % SPINE_COLORS.length]
}

function getSpineWidth(pageCount) {
  if (!pageCount) return 32
  if (pageCount < 100) return 22
  if (pageCount < 250) return 28
  if (pageCount < 400) return 35
  if (pageCount < 600) return 42
  return 52
}

const BookSpine = memo(function BookSpine({ book, onClick, index = 0, height = 220 }) {
  const scale  = height / 220
  const color  = getSpineColor(book.title, book.google_id || book.googleId)
  const width  = Math.round(getSpineWidth(book.page_count || book.pageCount) * scale)
  const title  = book.title || 'Sans titre'
  const author = (book.authors || [])[0] || ''

  const PRIORITY = ['prefere', 'lu', 'en_cours', 'possede', 'souhaite']
  const STATUS_COLORS = { en_cours: '#a78bfa', possede: '#818cf8', souhaite: '#fb923c', lu: '#4ade80', prefere: '#f472b6' }
  const bookStatuses = book.statuses?.length ? book.statuses : [book.status]
  const primaryStatus = PRIORITY.find(s => bookStatuses.includes(s)) || bookStatuses[0]
  const statusBorderColor = STATUS_COLORS[primaryStatus] || 'transparent'

  const cover    = book.cover || book.cover_url
  const hasCover = !!cover

  return (
    <div
      className="book-spine-wrap"
      style={{
        width,
        height,
        flexShrink: 0,
        animation: 'spineIn 0.3s ease-out both',
        animationDelay: `${Math.min(index * 0.02, 0.4)}s`,
      }}
      onClick={() => onClick(book)}
      title={`${title}${author ? ' — ' + author : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(book)}
    >
      <div
        style={{
          height: '100%',
          position: 'relative',
          // Pas de filter — on utilise backgroundImage directement
          ...(hasCover ? {
            backgroundImage: `url(${cover})`,
            backgroundSize: `${width * 5}px ${height}px`,
            backgroundPosition: 'left center',
            backgroundRepeat: 'no-repeat',
          } : {
            background: `linear-gradient(160deg, ${color.accent} 0%, ${color.bg} 40%, ${color.bg} 100%)`,
          }),
          // Box-shadow simplifié : 1 seule ombre externe (moins de repaint)
          boxShadow: '2px 0 8px rgba(0,0,0,0.5)',
          borderBottom: `3px solid ${statusBorderColor}`,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '1px',
          overflow: 'hidden',
        }}
      >
        {/* Assombrissement couverture : overlay rgba au lieu de filter (cheap) */}
        {hasCover && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.28)',
            zIndex: 0,
          }} />
        )}

        {/* Overlay hover : disparaît au survol via CSS class (opacity seule = GPU) */}
        <div
          className="spine-hover-overlay"
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.18)',
            transition: 'opacity 0.15s',
            zIndex: 1,
          }}
        />

        {/* Reflet gauche */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 60%)',
          zIndex: 2,
        }} />

        {/* Texte */}
        <div
          className="spine-text"
          style={{
            color: hasCover ? '#fff' : color.text,
            width: '100%',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <span style={{
            fontWeight: 700,
            fontSize: Math.max(9, Math.min(13, width * 0.32)) + 'px',
            letterSpacing: '0.02em',
            textShadow: '0 1px 4px rgba(0,0,0,0.95)',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}>
            {title}
          </span>
          {author && width >= 26 && (
            <span style={{
              fontSize: Math.max(7, Math.min(10, width * 0.25)) + 'px',
              opacity: 0.82,
              letterSpacing: '0.05em',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              textShadow: '0 1px 4px rgba(0,0,0,0.95)',
            }}>
              {author}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

export default BookSpine
