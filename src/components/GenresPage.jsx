import { useState, useMemo } from 'react'

const GOLD = '#816EBB'

// ── Config genres ──────────────────────────────────────────────────────────────
const GENRE_CONFIG = {
  'Seinen':          { icon: '👺', color: '#816EBB', desc: 'Manga pour adultes'       },
  'Shonen':          { icon: '⚡', color: '#f59e0b', desc: 'Action & aventure'        },
  'Shojo':           { icon: '🌸', color: '#ec4899', desc: 'Romance & émotions'       },
  'Action':          { icon: '⚔️', color: '#ef4444', desc: 'Combat & batailles'       },
  'Fantasy':         { icon: '🧙', color: '#f59e0b', desc: 'Magie & mondes'           },
  'Aventure':        { icon: '🧭', color: '#22c55e', desc: 'Exploration & quêtes'     },
  'Comédie':         { icon: '😊', color: '#6366f1', desc: 'Humour & légèreté'        },
  'Drame':           { icon: '🎭', color: '#a78bfa', desc: 'Émotions & profondeur'    },
  'Romance':         { icon: '💝', color: '#ec4899', desc: 'Amour & relations'        },
  'Horreur':         { icon: '💀', color: '#f97316', desc: 'Peur & suspense'          },
  'Science-fiction': { icon: '🚀', color: '#22c55e', desc: 'Futur & technologie'      },
  'Mystère':         { icon: '🔍', color: '#a78bfa', desc: 'Énigmes & suspense'       },
  'Slice of Life':   { icon: '☕', color: '#d97706', desc: 'Vie quotidienne'          },
  'Psychologique':   { icon: '🧠', color: '#8b5cf6', desc: "Explore l'esprit humain"  },
  'Historique':      { icon: '📜', color: '#d97706', desc: 'Voyage dans le temps'     },
  'Sport':           { icon: '🏆', color: '#22c55e', desc: 'Dépasse tes limites'      },
  'Thriller':        { icon: '🔪', color: '#ef4444', desc: 'Suspense & tension'       },
  'Isekai':          { icon: '🌀', color: '#6366f1', desc: 'Autre monde'              },
  'Autre':           { icon: '📦', color: '#6b7280', desc: 'Autres genres'            },
}

const DISCOVER_GENRES = ['Psychologique', 'Historique', 'Sport', 'Thriller', 'Isekai', 'Shojo', 'Horreur', 'Science-fiction']

// ── Mapping catégorie → genre français ────────────────────────────────────────
function mapCategory(cat) {
  if (!cat) return null
  const c = cat.toLowerCase()
  if (c.includes('seinen'))                                      return 'Seinen'
  if (c.includes('shonen') || c.includes('shounen'))            return 'Shonen'
  if (c.includes('shojo')  || c.includes('shoujo'))             return 'Shojo'
  if (c.includes('isekai'))                                      return 'Isekai'
  if (c.includes('slice of life') || c.includes('slice-of-life')) return 'Slice of Life'
  if (c.includes('psychological') || c.includes('psychologique')) return 'Psychologique'
  if (c.includes('historical') || c.includes('historique'))     return 'Historique'
  if (c.includes('sport'))                                       return 'Sport'
  if (c.includes('thriller'))                                    return 'Thriller'
  if (c.includes('horror') || c.includes('horreur'))            return 'Horreur'
  if (c.includes('romance') || c.includes('romantique'))        return 'Romance'
  if (c.includes('comedy') || c.includes('comédie') || c.includes('comedie')) return 'Comédie'
  if (c.includes('drama') || c.includes('drame'))               return 'Drame'
  if (c.includes('action'))                                      return 'Action'
  if (c.includes('fantasy') || c.includes('fantaisie') || c.includes('fantastique')) return 'Fantasy'
  if (c.includes('adventure') || c.includes('aventure'))        return 'Aventure'
  if (c.includes('science fiction') || c.includes('sci-fi') || c.includes('science-fiction')) return 'Science-fiction'
  if (c.includes('mystery') || c.includes('mystère') || c.includes('mystere')) return 'Mystère'
  return null
}

// ── Calcul des données genres ─────────────────────────────────────────────────
function computeGenres(books) {
  const map = {} // genreName → { books: [], enCours: [] }

  books.forEach(book => {
    const cats = book.categories?.filter(g => g && g.length > 2) || []
    const mapped = [...new Set(cats.map(mapCategory).filter(Boolean))]
    const genres = mapped.length > 0 ? mapped : ['Autre']

    genres.forEach(g => {
      if (!map[g]) map[g] = { books: [], enCours: [] }
      if (!map[g].books.find(b => b.id === book.id)) {
        map[g].books.push(book)
        const s = book.statuses?.length ? book.statuses : [book.status]
        if (s.includes('en_cours')) map[g].enCours.push(book)
      }
    })
  })

  const total = Math.max(books.length, 1)
  return Object.entries(map)
    .map(([name, data]) => ({
      name,
      books: data.books,
      count: data.books.length,
      series: data.enCours.length,
      pct: data.books.length / total,
      config: GENRE_CONFIG[name] || GENRE_CONFIG['Autre'],
      cover: data.books.find(b => b.cover || b.cover_url)?.cover || data.books.find(b => b.cover || b.cover_url)?.cover_url || null,
    }))
    .sort((a, b) => b.count - a.count)
}

// ── Composants UI ─────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }) {
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(129,110,187,0.12)',
      borderRadius: 14, padding: '14px 10px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: color || '#EDE9F8', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 9, color: 'rgba(237,233,248,0.4)', lineHeight: 1.3 }}>{label}</span>
    </div>
  )
}

function FavGenreChip({ genre, pct, onClick }) {
  const cfg = genre.config
  return (
    <div
      onClick={onClick}
      style={{
        flexShrink: 0, width: 100,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${cfg.color}33`,
        borderRadius: 14, padding: '14px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        cursor: 'pointer', transition: 'all 0.18s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${cfg.color}18`; e.currentTarget.style.borderColor = `${cfg.color}66` }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = `${cfg.color}33` }}
    >
      <span style={{ fontSize: 28 }}>{cfg.icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#EDE9F8' }}>{genre.name}</span>
      <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{Math.round(pct * 100)}%</span>
      {/* Barre */}
      <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: cfg.color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function GenreCard({ genre, totalBooks, onClick }) {
  const cfg = genre.config
  const pct = Math.round(genre.pct * 100)

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative', borderRadius: 16, overflow: 'hidden',
        background: '#110D1E',
        border: '1px solid rgba(129,110,187,0.1)',
        cursor: 'pointer', transition: 'transform 0.18s, border-color 0.18s',
        minHeight: 110,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = `${cfg.color}55` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(129,110,187,0.1)' }}
    >
      {/* Cover en arrière-plan */}
      {genre.cover && (
        <img
          src={genre.cover}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', opacity: 0.18, filter: 'blur(2px)',
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Overlay gradient */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(12,10,21,0.85) 0%, ${cfg.color}22 100%)`, pointerEvents: 'none' }} />

      {/* Contenu */}
      <div style={{ position: 'relative', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `${cfg.color}22`,
              border: `1.5px solid ${cfg.color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              {cfg.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8' }}>{genre.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(237,233,248,0.4)' }}>{genre.count} livre{genre.count !== 1 ? 's' : ''}</div>
              {genre.series > 0 && (
                <div style={{ fontSize: 10, color: 'rgba(237,233,248,0.35)' }}>{genre.series} série{genre.series !== 1 ? 's' : ''}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{pct}%</span>
            <span style={{ fontSize: 14, color: 'rgba(237,233,248,0.3)' }}>›</span>
          </div>
        </div>

        {/* Barre de progression */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: cfg.color,
            borderRadius: 2,
            boxShadow: `0 0 8px ${cfg.color}88`,
          }} />
        </div>
      </div>
    </div>
  )
}

function DiscoverCard({ name, onClick, userCount }) {
  const cfg = GENRE_CONFIG[name] || GENRE_CONFIG['Autre']
  return (
    <div
      onClick={onClick}
      style={{
        flexShrink: 0, width: 150, height: 110,
        borderRadius: 14, overflow: 'hidden',
        background: `linear-gradient(135deg, #110D1E, ${cfg.color}33)`,
        border: `1px solid ${cfg.color}33`,
        cursor: 'pointer', position: 'relative',
        transition: 'all 0.18s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${cfg.color}88` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${cfg.color}33` }}
    >
      <div style={{ padding: '14px' }}>
        <div style={{ fontSize: 22, marginBottom: 4 }}>{cfg.icon}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#EDE9F8', marginBottom: 2 }}>{name} ›</div>
        <div style={{ fontSize: 10, color: 'rgba(237,233,248,0.5)', marginBottom: 6 }}>{cfg.desc}</div>
        {userCount > 0 && (
          <div style={{ fontSize: 9, color: cfg.color, fontWeight: 600 }}>{userCount} livre{userCount > 1 ? 's' : ''}</div>
        )}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function GenresPage({ books, onBookSelect, isMobile }) {
  const [sortBy, setSortBy] = useState('count')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const genres = useMemo(() => computeGenres(books), [books])

  const sorted = useMemo(() => {
    const list = [...genres]
    if (sortBy === 'alpha')  list.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'rating') {
      list.sort((a, b) => {
        const avgA = a.books.filter(b => b.rating > 0).reduce((s, b) => s + b.rating, 0) / (a.books.filter(b => b.rating > 0).length || 1)
        const avgB = b.books.filter(b => b.rating > 0).reduce((s, b) => s + b.rating, 0) / (b.books.filter(b => b.rating > 0).length || 1)
        return avgB - avgA
      })
    }
    return list
  }, [genres, sortBy])

  const topGenres   = genres.slice(0, 6)
  const totalBooks  = books.length
  const totalRead   = books.filter(b => { const s = b.statuses?.length ? b.statuses : [b.status]; return s.includes('lu') || s.includes('prefere') }).length
  const totalSeries = books.filter(b => { const s = b.statuses?.length ? b.statuses : [b.status]; return s.includes('en_cours') }).length
  const ratedBooks  = books.filter(b => b.rating > 0)
  const avgRating   = ratedBooks.length ? (ratedBooks.reduce((s, b) => s + b.rating, 0) / ratedBooks.length).toFixed(1) : '--'

  const discoverList = DISCOVER_GENRES.map(name => ({
    name,
    count: genres.find(g => g.name === name)?.count || 0,
  }))

  const pad = isMobile ? '16px' : '20px'

  if (books.length === 0) return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🎭</div>
      <p style={{ color: 'rgba(237,233,248,0.3)', fontSize: 14, margin: 0 }}>
        Ajoute des livres pour voir tes genres ici
      </p>
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: `20px ${pad} 0`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(129,110,187,0.15)', border: '1px solid rgba(129,110,187,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            📚
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#EDE9F8' }}>Genres</div>
            <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.4)' }}>Explore tous les univers</div>
          </div>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(129,110,187,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#EDE9F8' }}>
          🔍
        </button>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'flex', gap: 10, padding: `0 ${pad}`, marginBottom: 20 }}>
        <StatCard icon="📚" value={genres.length}  label="Genres disponibles"    color={GOLD} />
        <StatCard icon="📖" value={totalRead}       label="Livres lus tous genres" color="#22c55e" />
        <StatCard icon="⭐" value={avgRating}       label="Note moyenne globale"  color="#f59e0b" />
        <StatCard icon="🔥" value={totalSeries}     label="Séries suivies"        color="#ef4444" />
      </div>

      {/* ── MES GENRES PRÉFÉRÉS ── */}
      {topGenres.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${pad}`, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>💜</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8' }}>Mes genres préférés</span>
            </div>
            <span style={{ fontSize: 11, color: GOLD, fontWeight: 600, cursor: 'pointer' }}>Gérer mes genres ›</span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingLeft: pad, paddingRight: pad, paddingBottom: 8, scrollbarWidth: 'none' }}>
            {topGenres.map(genre => (
              <FavGenreChip
                key={genre.name}
                genre={genre}
                pct={genre.pct}
                onClick={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── TOUS LES GENRES ── */}
      <div style={{ padding: `0 ${pad}`, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#EDE9F8' }}>Tous les genres</span>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <button
              onClick={() => setShowSortMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(129,110,187,0.15)', borderRadius: 8, padding: '6px 10px', color: 'rgba(237,233,248,0.7)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              ↑↓ Trier ▾
            </button>
            {showSortMenu && (
              <div style={{ position: 'absolute', top: 36, right: 0, background: '#1E1535', border: '1px solid rgba(129,110,187,0.2)', borderRadius: 10, padding: '6px', zIndex: 50, minWidth: 130 }}>
                {[
                  { id: 'count', label: 'Par nombre' },
                  { id: 'alpha', label: 'Alphabétique' },
                  { id: 'rating', label: 'Par note' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => { setSortBy(opt.id); setShowSortMenu(false) }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', background: sortBy === opt.id ? 'rgba(129,110,187,0.15)' : 'none', border: 'none', borderRadius: 7, color: sortBy === opt.id ? GOLD : 'rgba(237,233,248,0.6)', fontSize: 12, fontWeight: sortBy === opt.id ? 700 : 400, cursor: 'pointer', textAlign: 'left' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {sorted.map(genre => (
            <GenreCard
              key={genre.name}
              genre={genre}
              totalBooks={totalBooks}
              onClick={() => {}}
            />
          ))}
        </div>
      </div>

      {/* ── DÉCOUVRIR DE NOUVEAUX GENRES ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${pad}`, marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8' }}>Découvrir de nouveaux genres</span>
          <span style={{ fontSize: 11, color: GOLD, fontWeight: 600, cursor: 'pointer' }}>Voir tous les genres</span>
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingLeft: pad, paddingRight: pad, paddingBottom: 8, scrollbarWidth: 'none' }}>
          {discoverList.map(({ name, count }) => (
            <DiscoverCard key={name} name={name} userCount={count} onClick={() => {}} />
          ))}
        </div>
      </div>

    </div>
  )
}
