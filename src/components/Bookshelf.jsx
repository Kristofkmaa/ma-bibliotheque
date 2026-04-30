import { useState, useMemo, memo } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { IconPlay, IconHome, IconList, IconCheck, IconHeart } from './Icons'

const GOLD = '#816EBB'

const STATUS_CONFIG = {
  en_cours: { label: 'En cours',     color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', Icon: IconPlay  },
  possede:  { label: 'Possédés',     color: '#818cf8', bg: 'rgba(129,140,248,0.12)', Icon: IconHome  },
  souhaite: { label: 'WishList',     color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  Icon: IconList  },
  lu:       { label: 'Déjà lu',      color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  Icon: IconCheck },
  prefere:  { label: 'Favoris',      color: '#f472b6', bg: 'rgba(244,114,182,0.12)', Icon: IconHeart },
}

const STATUS_ORDER = ['en_cours', 'possede', 'souhaite', 'lu', 'prefere']

const hasStatus = (book, status) => {
  const s = book.statuses?.length ? book.statuses : [book.status]
  return s.includes(status)
}

const getPrimaryStatus = (book) => {
  const s = book.statuses?.length ? book.statuses : [book.status]
  return STATUS_ORDER.find(st => s.includes(st)) || s[0]
}

const sortAlpha = arr =>
  [...arr].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' }))

// ── Carte livre flat ──────────────────────────────────────────────────────────
const BookCard = memo(function BookCard({ book, onBookClick, showStatus = false }) {
  const cover   = book.cover || book.cover_url
  const title   = book.title || 'Sans titre'
  const author  = (Array.isArray(book.authors) ? book.authors[0] : book.authors) || ''
  const rating  = book.rating || 0
  const primary = getPrimaryStatus(book)
  const cfg     = STATUS_CONFIG[primary] || STATUS_CONFIG['possede']

  return (
    <div
      onClick={() => onBookClick(book)}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', transition: 'all 0.18s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(129,110,187,0.3)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(129,110,187,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
    >
      {/* Cover */}
      <div style={{ aspectRatio: '2/3', background: 'linear-gradient(145deg,#2D1B69,#1A0F3A)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {cover
          ? <img src={cover} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
              <span style={{ fontSize: 10, color: '#D4C8FF', textAlign: 'center', lineHeight: 1.4, fontWeight: 600 }}>{title}</span>
            </div>
        }
        {/* Status badge */}
        {showStatus && (
          <div style={{ position: 'absolute', top: 6, left: 6, background: cfg.bg, border: `1px solid ${cfg.color}55`, borderRadius: 6, padding: '2px 6px', backdropFilter: 'blur(4px)' }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
          </div>
        )}
        {/* Rating badge */}
        {rating > 0 && (
          <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '2px 6px', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 9, color: '#fbbf24' }}>★</span>
            <span style={{ fontSize: 9, color: '#EDE9F8', fontWeight: 700 }}>{rating}</span>
          </div>
        )}
      </div>

      {/* Infos */}
      <div style={{ padding: '10px 10px 12px', flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#EDE9F8', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</div>
        {author && <div style={{ fontSize: 10, color: 'rgba(237,233,248,0.4)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author}</div>}
        {rating > 0 && (
          <div style={{ display: 'flex', gap: 1, marginTop: 6 }}>
            {[1,2,3,4,5].map(i => <span key={i} style={{ fontSize: 9, color: i <= rating ? '#fbbf24' : 'rgba(255,255,255,0.12)' }}>★</span>)}
          </div>
        )}
      </div>
    </div>
  )
})

// ── Section par statut (vue globale) ─────────────────────────────────────────
function StatusSection({ status, books, onBookClick, onSeeAll }) {
  const cfg = STATUS_CONFIG[status]
  if (books.length === 0) return null
  const preview = books.slice(0, 6)
  const extra   = books.length - preview.length

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <cfg.Icon size={13} color={cfg.color} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8' }}>{cfg.label}</span>
          <span style={{ fontSize: 11, color: 'rgba(237,233,248,0.3)', fontWeight: 400 }}>{books.length}</span>
        </div>
        {books.length > 4 && (
          <button onClick={onSeeAll} style={{ background: 'none', border: 'none', color: cfg.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            Voir tout →
          </button>
        )}
      </div>

      {/* Scroll horizontal */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {preview.map((book, i) => (
          <div key={book.id || i} style={{ flexShrink: 0, width: 110 }}>
            <BookCard book={book} onBookClick={onBookClick} />
          </div>
        ))}
        {extra > 0 && (
          <div
            onClick={onSeeAll}
            style={{ flexShrink: 0, width: 110, aspectRatio: '2/3', borderRadius: 14, border: `2px dashed ${cfg.color}44`, background: cfg.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>+{extra}</span>
            <span style={{ fontSize: 10, color: `${cfg.color}AA` }}>livres</span>
          </div>
        )}
      </div>
      <div style={{ height: 1, background: 'rgba(129,110,187,0.07)', marginTop: 20 }} />
    </div>
  )
}

// ── Grille filtrée ────────────────────────────────────────────────────────────
function FilteredGrid({ books, onBookClick, searchQuery, isMobile }) {
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return books
    return books.filter(b =>
      (b.title || '').toLowerCase().includes(q) ||
      (Array.isArray(b.authors) ? b.authors : [b.authors]).some(a => (a || '').toLowerCase().includes(q))
    )
  }, [books, searchQuery])

  if (filtered.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(237,233,248,0.25)', fontSize: 14 }}>
      {searchQuery ? `Aucun résultat pour "${searchQuery}"` : 'Aucun livre dans cette catégorie'}
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)', gap: 12 }}>
      {filtered.map((book, i) => (
        <BookCard key={book.id || i} book={book} onBookClick={onBookClick} />
      ))}
    </div>
  )
}

// ── Barre de recherche ────────────────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(129,110,187,0.15)', borderRadius: 12, padding: '10px 14px' }}>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="rgba(129,110,187,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Rechercher un livre...'}
        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#EDE9F8', fontSize: 14, fontFamily: 'inherit' }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(129,110,187,0.5)', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
      )}
    </div>
  )
}

// ── Chips de filtre ───────────────────────────────────────────────────────────
function FilterChips({ current, counts, onFilterChange }) {
  const chips = [
    { id: 'all', label: 'Tous', color: GOLD },
    ...STATUS_ORDER.map(s => ({ id: s, ...STATUS_CONFIG[s] })),
  ]

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
      {chips.map(c => {
        const count  = c.id === 'all' ? Object.values(counts).reduce((s, v) => s + v, 0) : (counts[c.id] || 0)
        const active = current === c.id
        return (
          <button
            key={c.id}
            onClick={() => onFilterChange(c.id)}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 13px',
              borderRadius: 20,
              border: active ? 'none' : '1px solid rgba(129,110,187,0.15)',
              background: active ? c.color : 'rgba(255,255,255,0.03)',
              color: active ? '#fff' : 'rgba(237,233,248,0.55)',
              fontSize: 12, fontWeight: active ? 700 : 400,
              cursor: 'pointer', transition: 'all 0.18s',
              fontFamily: 'inherit',
            }}
          >
            {c.label}
            <span style={{ fontSize: 10, opacity: 0.75 }}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Bookshelf({ books, onBookClick, filter = 'all', onFilterChange }) {
  const [searchQuery, setSearchQuery] = useState('')
  const isMobile = useIsMobile()

  const counts = useMemo(() =>
    Object.fromEntries(STATUS_ORDER.map(s => [s, books.filter(b => hasStatus(b, s)).length])),
    [books]
  )

  const booksByStatus = useMemo(() =>
    Object.fromEntries(STATUS_ORDER.map(s => [s, sortAlpha(books.filter(b => hasStatus(b, s)))])),
    [books]
  )

  const filteredBooks = useMemo(() =>
    filter === 'all' ? books : sortAlpha(books.filter(b => hasStatus(b, filter))),
    [books, filter]
  )

  const pad = isMobile ? '0 16px' : '0 28px'

  if (books.length === 0) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(237,233,248,0.6)', marginBottom: 8 }}>Ta bibliothèque est vide</div>
      <div style={{ fontSize: 13, color: 'rgba(237,233,248,0.25)' }}>Recherche un livre ou scanne un ISBN pour commencer</div>
    </div>
  )

  return (
    <div style={{ paddingBottom: 60 }}>

      {/* ── FILTRES + RECHERCHE ── */}
      <div style={{ padding: `16px ${isMobile ? '16px' : '28px'} 20px`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FilterChips current={filter} counts={counts} onFilterChange={id => { setSearchQuery(''); onFilterChange(id) }} />
        {filter !== 'all' && (
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={`Rechercher dans ${STATUS_CONFIG[filter]?.label || ''}...`} />
        )}
      </div>

      {/* ── VUE GLOBALE (tous les statuts en sections) ── */}
      {filter === 'all' && (
        <div style={{ padding: pad }}>
          {/* Mini stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 28 }}>
            {STATUS_ORDER.map(s => {
              const cfg = STATUS_CONFIG[s]
              return (
                <div
                  key={s}
                  onClick={() => onFilterChange(s)}
                  style={{ background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: 12, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = `${cfg.color}88`}
                  onMouseLeave={e => e.currentTarget.style.borderColor = `${cfg.color}33`}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{counts[s]}</div>
                  <div style={{ fontSize: 8, color: 'rgba(237,233,248,0.45)', marginTop: 3, lineHeight: 1.2 }}>{cfg.label}</div>
                </div>
              )
            })}
          </div>

          {/* Sections par statut */}
          {STATUS_ORDER.map(s => (
            <StatusSection
              key={s}
              status={s}
              books={booksByStatus[s] || []}
              onBookClick={onBookClick}
              onSeeAll={() => onFilterChange(s)}
            />
          ))}
        </div>
      )}

      {/* ── VUE FILTRÉE (un seul statut) ── */}
      {filter !== 'all' && (
        <div style={{ padding: pad }}>
          <FilteredGrid
            books={filteredBooks}
            onBookClick={onBookClick}
            searchQuery={searchQuery}
            isMobile={isMobile}
          />
        </div>
      )}

    </div>
  )
}
