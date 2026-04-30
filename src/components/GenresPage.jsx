import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  IconBookOpen, IconShield, IconLightning, IconFlower, IconSpiral, IconCoffee,
  IconSword, IconBurst, IconCompass, IconWand, IconRocket, IconSkull, IconHeart,
  IconSearch, IconBrain, IconScroll, IconTrophy, IconSmile, IconMask, IconStar,
  IconUser, IconBook, IconNewspaper, IconBox, IconTrendingUp, IconFlame,
  IconSortArrows,
} from './Icons'

const GOLD = '#816EBB'

// ── Mapping catégories Google Books → labels français + icône + couleur ───────
const CATEGORY_MAP = [
  { keys: ['comics','graphic novel','manga','bande dessinee','bd'],    label: 'Manga / BD',           Icon: IconBookOpen,  color: '#816EBB' },
  { keys: ['seinen'],                                                    label: 'Seinen',               Icon: IconShield,    color: '#a78bfa' },
  { keys: ['shonen','shounen'],                                          label: 'Shōnen',               Icon: IconLightning, color: '#f59e0b' },
  { keys: ['shojo','shoujo'],                                            label: 'Shōjo',                Icon: IconFlower,    color: '#ec4899' },
  { keys: ['isekai'],                                                    label: 'Isekai',               Icon: IconSpiral,    color: '#6366f1' },
  { keys: ['slice of life'],                                             label: 'Slice of Life',        Icon: IconCoffee,    color: '#d97706' },
  { keys: ['action & adventure','action and adventure'],                 label: 'Action & Aventure',    Icon: IconSword,     color: '#ef4444' },
  { keys: ['action'],                                                    label: 'Action',               Icon: IconBurst,     color: '#ef4444' },
  { keys: ['adventure','aventure'],                                      label: 'Aventure',             Icon: IconCompass,   color: '#22c55e' },
  { keys: ['fantasy','fantaisie','fantastique'],                         label: 'Fantasy',              Icon: IconWand,      color: '#f59e0b' },
  { keys: ['science fiction','sci-fi','science-fiction'],                label: 'Science-fiction',      Icon: IconRocket,    color: '#22c55e' },
  { keys: ['horror','horreur'],                                          label: 'Horreur',              Icon: IconSkull,     color: '#f97316' },
  { keys: ['romance','romantique'],                                      label: 'Romance',              Icon: IconHeart,     color: '#ec4899' },
  { keys: ['mystery','mystere','mystère','thriller'],                    label: 'Mystère',              Icon: IconSearch,    color: '#a78bfa' },
  { keys: ['psychological','psychologique'],                             label: 'Psychologique',        Icon: IconBrain,     color: '#8b5cf6' },
  { keys: ['historical','historique'],                                   label: 'Historique',           Icon: IconScroll,    color: '#d97706' },
  { keys: ['sport'],                                                     label: 'Sport',                Icon: IconTrophy,    color: '#22c55e' },
  { keys: ['comedy','comedie','comédie','humor','humour'],               label: 'Comédie',              Icon: IconSmile,     color: '#6366f1' },
  { keys: ['drama','drame'],                                             label: 'Drame',                Icon: IconMask,      color: '#a78bfa' },
  { keys: ['juvenile fiction','young adult','children'],                 label: 'Jeunesse',             Icon: IconStar,      color: '#f59e0b' },
  { keys: ['biography','biographie','autobiography'],                    label: 'Biographie',           Icon: IconUser,      color: '#6b7280' },
  { keys: ['fiction'],                                                   label: 'Fiction',              Icon: IconBook,      color: '#818cf8' },
  { keys: ['nonfiction','non-fiction','documentaire'],                   label: 'Documentaire',         Icon: IconNewspaper, color: '#6b7280' },
]

function normalizeCategory(raw) {
  if (!raw) return null
  const c = raw.toLowerCase().trim()
  for (const entry of CATEGORY_MAP) {
    if (entry.keys.some(k => c.includes(k))) return entry
  }
  return {
    label: raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    Icon: IconBox,
    color: '#6b7280',
  }
}

// ── Calcul genres depuis les livres ──────────────────────────────────────────
function computeGenres(books) {
  const map = {}

  books.forEach(book => {
    const cats = (book.categories || []).filter(g => g && g.length > 2)
    const normalized = cats.length
      ? [...new Map(cats.map(c => { const n = normalizeCategory(c); return [n.label, n] }).filter(([l]) => l)).values()]
      : [{ label: 'Non classé', icon: '📦', color: '#6b7280' }]

    normalized.forEach(cfg => {
      if (!map[cfg.label]) map[cfg.label] = { cfg, books: [], enCours: [] }
      if (!map[cfg.label].books.find(b => b.id === book.id)) {
        map[cfg.label].books.push(book)
        const s = book.statuses?.length ? book.statuses : [book.status]
        if (s.includes('en_cours')) map[cfg.label].enCours.push(book)
      }
    })
  })

  const total = Math.max(books.length, 1)
  return Object.entries(map)
    .map(([label, data]) => ({
      label,
      cfg: data.cfg,
      books: data.books,
      count: data.books.length,
      series: data.enCours.length,
      pct: data.books.length / total,
      cover: data.books.find(b => b.cover || b.cover_url)?.cover
          || data.books.find(b => b.cover_url)?.cover_url
          || null,
    }))
    .sort((a, b) => b.count - a.count)
}

// ── Modal livres du genre ─────────────────────────────────────────────────────
function GenreModal({ genre, onClose, onBookSelect }) {
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(7,5,15,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 640, background: 'linear-gradient(180deg,#1E1535,#0C0A15)', border: '1px solid rgba(129,110,187,0.2)', borderBottom: 'none', borderRadius: '20px 20px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(129,110,187,0.3)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px 14px', borderBottom: '1px solid rgba(129,110,187,0.1)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${genre.cfg.color}22`, border: `1.5px solid ${genre.cfg.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <genre.cfg.Icon size={22} color={genre.cfg.color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#EDE9F8' }}>{genre.label}</div>
            <div style={{ fontSize: 12, color: 'rgba(237,233,248,0.4)' }}>{genre.count} livre{genre.count !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(237,233,248,0.6)', fontSize: 18 }}>
            ×
          </button>
        </div>

        {/* Liste livres */}
        <div style={{ overflowY: 'auto', padding: '12px 20px 32px', flex: 1 }}>
          {genre.books.map((book, i) => {
            const cover  = book.cover || book.cover_url
            const title  = book.title || 'Sans titre'
            const author = (Array.isArray(book.authors) ? book.authors[0] : book.authors) || ''
            const s      = book.statuses?.length ? book.statuses : [book.status]
            const statusColor = s.includes('lu') || s.includes('prefere') ? '#4ade80'
              : s.includes('en_cours') ? '#a78bfa' : '#fb923c'
            const statusLabel = s.includes('lu') || s.includes('prefere') ? 'Lu'
              : s.includes('en_cours') ? 'En cours' : 'WishList'

            return (
              <div
                key={book.id || i}
                onClick={() => { onBookSelect(book); onClose() }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid rgba(129,110,187,0.06)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <div style={{ width: 44, height: 62, borderRadius: '3px 7px 7px 3px', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(145deg,#2D1B69,#1A0F3A)', boxShadow: '-2px 3px 8px rgba(0,0,0,0.5)' }}>
                  {cover && <img src={cover} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#EDE9F8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.4)', marginTop: 2 }}>{author}</div>
                  {book.rating > 0 && (
                    <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 3 }}>{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</div>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, padding: '3px 8px', borderRadius: 8, background: `${statusColor}18`, border: `1px solid ${statusColor}33`, flexShrink: 0 }}>
                  {statusLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Carte genre grille ────────────────────────────────────────────────────────
function GenreCard({ genre, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#110D1E', border: '1px solid rgba(129,110,187,0.1)', cursor: 'pointer', transition: 'transform 0.18s, border-color 0.18s', minHeight: 110 }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = `${genre.cfg.color}66` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(129,110,187,0.1)' }}
    >
      {/* Cover flou en fond */}
      {genre.cover && (
        <img src={genre.cover} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, filter: 'blur(1px)', pointerEvents: 'none' }} />
      )}
      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(12,10,21,0.85) 0%, ${genre.cfg.color}18 100%)`, pointerEvents: 'none' }} />

      {/* Contenu */}
      <div style={{ position: 'relative', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${genre.cfg.color}22`, border: `1.5px solid ${genre.cfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <genre.cfg.Icon size={18} color={genre.cfg.color} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#EDE9F8' }}>{genre.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(237,233,248,0.4)' }}>{genre.count} livre{genre.count !== 1 ? 's' : ''}</div>
              {genre.series > 0 && <div style={{ fontSize: 10, color: 'rgba(237,233,248,0.3)' }}>{genre.series} série{genre.series !== 1 ? 's' : ''}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: genre.cfg.color }}>{Math.round(genre.pct * 100)}%</span>
            <span style={{ fontSize: 14, color: 'rgba(237,233,248,0.25)' }}>›</span>
          </div>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(genre.pct * 100)}%`, background: genre.cfg.color, borderRadius: 2, boxShadow: `0 0 6px ${genre.cfg.color}88` }} />
        </div>
      </div>
    </div>
  )
}

// ── Chip genre favori ─────────────────────────────────────────────────────────
function FavChip({ genre, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ flexShrink: 0, width: 95, background: 'rgba(255,255,255,0.04)', border: `1px solid ${genre.cfg.color}33`, borderRadius: 14, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', transition: 'all 0.18s' }}
      onMouseEnter={e => { e.currentTarget.style.background = `${genre.cfg.color}14`; e.currentTarget.style.borderColor = `${genre.cfg.color}66` }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = `${genre.cfg.color}33` }}
    >
      <genre.cfg.Icon size={26} color={genre.cfg.color} />
      <span style={{ fontSize: 11, fontWeight: 700, color: '#EDE9F8', textAlign: 'center', lineHeight: 1.2 }}>{genre.label}</span>
      <span style={{ fontSize: 11, color: genre.cfg.color, fontWeight: 700 }}>{Math.round(genre.pct * 100)}%</span>
      <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round(genre.pct * 100)}%`, background: genre.cfg.color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function GenresPage({ books, onBookSelect, isMobile }) {
  const [selected, setSelected]   = useState(null)
  const [sortBy,   setSortBy]     = useState('count')
  const [showSort, setShowSort]   = useState(false)

  const genres = useMemo(() => computeGenres(books), [books])

  const sorted = useMemo(() => {
    const list = [...genres]
    if (sortBy === 'alpha')  list.sort((a, b) => a.label.localeCompare(b.label))
    if (sortBy === 'rating') {
      list.sort((a, b) => {
        const avg = arr => arr.filter(b => b.rating > 0).reduce((s, b) => s + b.rating, 0) / (arr.filter(b => b.rating > 0).length || 1)
        return avg(b.books) - avg(a.books)
      })
    }
    return list
  }, [genres, sortBy])

  const topGenres  = genres.slice(0, 6)
  const totalRead  = books.filter(b => { const s = b.statuses?.length ? b.statuses : [b.status]; return s.includes('lu') || s.includes('prefere') }).length
  const totalSeries = books.filter(b => { const s = b.statuses?.length ? b.statuses : [b.status]; return s.includes('en_cours') }).length
  const ratedBooks = books.filter(b => b.rating > 0)
  const avgRating  = ratedBooks.length ? (ratedBooks.reduce((s, b) => s + b.rating, 0) / ratedBooks.length).toFixed(1) : '--'
  const pad        = isMobile ? '16px' : '20px'

  if (books.length === 0) return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><IconMask size={40} color="rgba(237,233,248,0.15)" /></div>
      <p style={{ color: 'rgba(237,233,248,0.3)', fontSize: 14, margin: 0 }}>Ajoute des livres pour voir tes genres ici</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>

      {selected && (
        <GenreModal
          genre={selected}
          onClose={() => setSelected(null)}
          onBookSelect={onBookSelect}
        />
      )}

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `20px ${pad} 16px` }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(129,110,187,0.15)', border: '1px solid rgba(129,110,187,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconBook size={20} color={GOLD} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#EDE9F8' }}>Genres</div>
          <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.4)' }}>Explore tous les univers</div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'flex', gap: 10, padding: `0 ${pad}`, marginBottom: 22 }}>
        {[
          { Icon: IconBook,        val: genres.length,  label: 'Genres',       color: GOLD       },
          { Icon: IconBookOpen,    val: totalRead,       label: 'Livres lus',  color: '#22c55e'  },
          { Icon: IconStar,        val: avgRating,       label: 'Note moy.',   color: '#f59e0b'  },
          { Icon: IconFlame,       val: totalSeries,     label: 'En cours',    color: '#ef4444'  },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 3 }}><s.Icon size={16} color={s.color} /></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 9, color: 'rgba(237,233,248,0.4)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── MES GENRES PRÉFÉRÉS ── */}
      {topGenres.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${pad}`, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconHeart size={15} color={GOLD} filled />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8' }}>Mes genres préférés</span>
            </div>
            <span style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>Gérer mes genres ›</span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingLeft: pad, paddingRight: pad, paddingBottom: 8, scrollbarWidth: 'none' }}>
            {topGenres.map(g => (
              <FavChip key={g.label} genre={g} onClick={() => setSelected(g)} />
            ))}
          </div>
        </div>
      )}

      {/* ── TOUS LES GENRES ── */}
      <div style={{ padding: `0 ${pad}`, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8' }}>Tous les genres</span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSort(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(129,110,187,0.15)', borderRadius: 8, padding: '6px 10px', color: 'rgba(237,233,248,0.7)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <IconSortArrows size={12} color="rgba(237,233,248,0.7)" /> Trier
            </button>
            {showSort && (
              <div style={{ position: 'absolute', top: 36, right: 0, background: '#1E1535', border: '1px solid rgba(129,110,187,0.2)', borderRadius: 10, padding: '6px', zIndex: 50, minWidth: 130 }}>
                {[{ id: 'count', label: 'Par nombre' }, { id: 'alpha', label: 'Alphabétique' }, { id: 'rating', label: 'Par note' }].map(opt => (
                  <button key={opt.id} onClick={() => { setSortBy(opt.id); setShowSort(false) }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', background: sortBy === opt.id ? 'rgba(129,110,187,0.15)' : 'none', border: 'none', borderRadius: 7, color: sortBy === opt.id ? GOLD : 'rgba(237,233,248,0.6)', fontSize: 12, fontWeight: sortBy === opt.id ? 700 : 400, cursor: 'pointer', textAlign: 'left' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {sorted.map(g => (
            <GenreCard key={g.label} genre={g} onClick={() => setSelected(g)} />
          ))}
        </div>
      </div>

    </div>
  )
}
