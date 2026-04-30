import { useState, useEffect, useMemo, memo } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'

// ── Config statuts ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  en_cours: { label: 'En cours',     color: '#a78bfa', tagColor: '#ede9fe', inkColor: '#3b1f82' },
  possede:  { label: 'Possedes',     color: '#818cf8', tagColor: '#daeaf5', inkColor: '#1a2e4a' },
  souhaite: { label: 'WishList',     color: '#fb923c', tagColor: '#fde8d8', inkColor: '#7a2e0e' },
  lu:       { label: 'Deja lu',      color: '#4ade80', tagColor: '#d4edda', inkColor: '#1a4a28' },
  prefere:  { label: 'Mes preferes', color: '#f472b6', tagColor: '#fde7f4', inkColor: '#7a1040' },
}

const EMPTY_MSGS = {
  en_cours: 'Aucune lecture en cours',
  possede:  'Ma bibliotheque est vide',
  souhaite: 'Aucun livre en wishlist',
  lu:       'Pas encore de livres lus',
  prefere:  'Aucun favori pour l instant',
}

const STATUS_ORDER = ['en_cours', 'possede', 'souhaite', 'lu', 'prefere']

const sortAlpha = arr =>
  [...arr].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' }))

const hasStatus = (book, status) => {
  const s = book.statuses?.length ? book.statuses : [book.status]
  return s.includes(status)
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Planche neon ──────────────────────────────────────────────────────────────
function ShelfPlank({ thin = false }) {
  return (
    <div style={{
      height: 0,
      borderTop: thin ? '1px solid rgba(160,130,220,0.6)' : '2px solid rgba(160,130,220,0.85)',
      boxShadow: thin
        ? '0 0 8px 1px rgba(129,110,187,0.45), 0 0 18px rgba(129,110,187,0.2)'
        : '0 0 14px 2px rgba(129,110,187,0.65), 0 0 32px rgba(129,110,187,0.3)',
    }} />
  )
}

// ── Etat vide elegant ────────────────────────────────────────────────────────
function EmptyShelf({ color, message, isMobile }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? '22px 16px 0' : '28px 20px 0',
      gap: 10,
    }}>
      {/* Icone livres fantomes */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 4 : 5, opacity: 0.18 }}>
        {[0.75, 1, 0.88, 0.62, 0.82].map((h, i) => (
          <div key={i} style={{
            width: isMobile ? 12 : 16,
            height: (isMobile ? 44 : 58) * h,
            borderRadius: '2px 4px 4px 2px',
            background: ('linear-gradient(180deg, ' + color + ' 0%, ' + color + '66 100%)'),
            flexShrink: 0,
          }} />
        ))}
      </div>
      {/* Texte */}
      <p style={{
        margin: 0,
        fontFamily: "'Playfair Display', serif",
        fontSize: isMobile ? 12 : 13,
        color: 'rgba(237,233,248,0.3)',
        fontStyle: 'italic',
        letterSpacing: '0.02em',
        textAlign: 'center',
      }}>{message}</p>
      <div style={{ width: '100%', marginTop: 8 }}><ShelfPlank /></div>
    </div>
  )
}

// ── Cadre bibliotheque ────────────────────────────────────────────────────────
function CabinetFrame({ label, color, count, onViewAll, showViewAll = true, isMobile, children }) {
  return (
    <div style={{
      marginBottom: isMobile ? '16px' : '24px',
      borderRadius: '12px',
      border: '2px solid rgba(101,87,160,0.35)',
      overflow: 'hidden',
      boxShadow: [
        '0 10px 48px rgba(0,0,0,0.7)',
        'inset 0 1px 0 rgba(160,130,220,0.13)',
        '0 0 0 1px rgba(129,110,187,0.05)',
      ].join(', '),
      background: '#07050F',
    }}>
      {/* Corniche */}
      <div style={{
        background: 'linear-gradient(180deg, #231A4A 0%, #18102E 100%)',
        borderBottom: '2px solid rgba(101,87,160,0.3)',
        padding: isMobile ? '9px 14px' : '11px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: color,
            boxShadow: ('0 0 9px ' + color + 'BB'),
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: isMobile ? 14 : 16, fontWeight: 700,
            color: 'rgba(237,233,248,0.92)',
          }}>{label}</span>
          <span style={{ fontSize: 11, color: 'rgba(237,233,248,0.3)' }}>
            {count} livre{count !== 1 ? 's' : ''}
          </span>
        </div>
        {showViewAll && count > 0 && onViewAll && (
          <button onClick={onViewAll} style={{
            background: 'none',
            border: ('1px solid ' + color + '44'),
            cursor: 'pointer',
            color,
            fontSize: 11, fontWeight: 600,
            padding: '4px 10px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', gap: 4,
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = color + '1A' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
            Voir tout <span style={{ fontSize: 13 }}>{'→'}</span>
          </button>
        )}
      </div>

      {/* Interieur */}
      <div style={{ display: 'flex' }}>
        {/* Montant gauche */}
        <div style={{
          width: isMobile ? 10 : 14,
          flexShrink: 0,
          background: 'linear-gradient(90deg, #1D1440 0%, #0E0A1E 100%)',
          borderRight: '1px solid rgba(101,87,160,0.2)',
        }} />
        {/* Contenu */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
        </div>
        {/* Montant droit */}
        <div style={{
          width: isMobile ? 10 : 14,
          flexShrink: 0,
          background: 'linear-gradient(270deg, #1D1440 0%, #0E0A1E 100%)',
          borderLeft: '1px solid rgba(101,87,160,0.2)',
        }} />
      </div>
    </div>
  )
}

// ── Livre individuel ──────────────────────────────────────────────────────────
function BookItem({ book, color, onBookClick, searchQuery, index }) {
  const cover  = book.cover || book.cover_url
  const title  = book.title || 'Sans titre'
  const author = (book.authors || [])[0] || ''
  const id     = book.id || book.google_id || String(index)
  const q      = searchQuery?.trim().toLowerCase() || ''
  const isMatch  = q && (title.toLowerCase().includes(q) || author.toLowerCase().includes(q))
  const isDimmed = q && !isMatch

  return (
    <div
      key={id}
      onClick={() => onBookClick(book)}
      title={title}
      style={{
        aspectRatio: '1 / 1.55',
        cursor: 'pointer',
        opacity: isDimmed ? 0.1 : 1,
        transition: 'transform 0.15s ease, opacity 0.2s',
        outline: isMatch ? ('2px solid ' + color) : 'none',
        outlineOffset: 2,
        borderRadius: '2px 6px 6px 2px',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-9px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
    >
      <div style={{
        width: '100%', height: '100%',
        borderRadius: '2px 6px 6px 2px', overflow: 'hidden',
        background: 'linear-gradient(145deg, #2D1B69, #1A0F3A)',
        boxShadow: '-2px 7px 18px rgba(0,0,0,0.85)',
        borderBottom: ('2px solid ' + color),
      }}>
        {cover
          ? <img src={cover} alt={title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              loading="lazy" />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
              <span style={{ fontFamily: "'Playfair Display', serif", color: '#D4C8FF', fontSize: '8px', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>{title}</span>
            </div>
        }
      </div>
    </div>
  )
}

// ── Rangee de livres (grille, sans scroll) ────────────────────────────────────
function ShelfRow({ books, color, onBookClick, searchQuery, isMobile, extra, onViewAll, rowIdx }) {
  const COLS = isMobile ? 4 : 5
  const showExtra = extra > 0 && rowIdx === 0
  // Toujours COLS colonnes pour que le cadre soit identique quel que soit le nombre de livres
  const gridCols = showExtra ? COLS + 1 : COLS

  return (
    <div style={{ padding: isMobile ? '0 8px' : '0 12px' }}>
      {/* Ombre du dessus */}
      <div style={{
        height: rowIdx === 0 ? 16 : 20,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
        marginBottom: 3, pointerEvents: 'none',
      }} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: ('repeat(' + gridCols + ', 1fr)'),
        gap: isMobile ? '5px' : '7px',
        alignItems: 'flex-end',
      }}>
        {books.map((book, i) => (
          <BookItem
            key={book.id || book.google_id || String(rowIdx * COLS + i)}
            book={book} color={color}
            onBookClick={onBookClick}
            searchQuery={searchQuery}
            index={rowIdx * COLS + i}
          />
        ))}
        {showExtra && (
          <div
            onClick={onViewAll}
            style={{
              aspectRatio: '1 / 1.55', cursor: 'pointer',
              borderRadius: '2px 6px 6px 2px',
              border: ('2px dashed ' + color + '55'),
              background: (color + '0D'),
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = color + '1F' }}
            onMouseLeave={e => { e.currentTarget.style.background = color + '0D' }}
          >
            <span style={{ fontSize: isMobile ? 15 : 20, fontWeight: 700, color }}>{'+' + extra}</span>
            <span style={{ fontSize: 9, color: (color + 'AA'), textAlign: 'center' }}>livres</span>
          </div>
        )}
      </div>
      <div style={{ marginTop: 5 }}><ShelfPlank /></div>
    </div>
  )
}

// ── Section apercu (5 livres max + cadre) ─────────────────────────────────────
const PreviewSection = memo(function PreviewSection({ status, books, onBookClick, onViewAll, isMobile }) {
  const { color, tagColor, inkColor, label } = STATUS_CONFIG[status]
  const LIMIT = isMobile ? 4 : 5
  const preview = books.slice(0, LIMIT)
  const extra   = books.length - LIMIT

  return (
    <CabinetFrame
      label={label} color={color} count={books.length}
      onViewAll={onViewAll} showViewAll isMobile={isMobile}
    >
      {books.length === 0 ? (
        <EmptyShelf color={color} message={EMPTY_MSGS[status]} isMobile={isMobile} />
      ) : (
        <div style={{ paddingTop: isMobile ? 0 : 0 }}>
          <ShelfRow
            books={preview} color={color}
            onBookClick={onBookClick}
            searchQuery=""
            isMobile={isMobile}
            extra={extra > 0 ? extra : 0}
            onViewAll={onViewAll}
            rowIdx={0}
          />
          <div style={{ height: isMobile ? 10 : 14 }} />
        </div>
      )}
    </CabinetFrame>
  )
})

// ── Section complete (toutes les rangees) ─────────────────────────────────────
const LibraryShelfSection = memo(function LibraryShelfSection({ status, books, onBookClick, searchQuery, isMobile }) {
  const { color, tagColor, inkColor, label } = STATUS_CONFIG[status]
  const COLS = isMobile ? 4 : 5

  const rows = useMemo(() => {
    const result = []
    for (let i = 0; i < books.length; i += COLS)
      result.push(books.slice(i, i + COLS))
    return result
  }, [books, COLS])

  return (
    <CabinetFrame
      label={label} color={color} count={books.length}
      showViewAll={false} isMobile={isMobile}
    >
      {books.length === 0 ? (
        <EmptyShelf color={color} message={EMPTY_MSGS[status]} isMobile={isMobile} />
      ) : (
        rows.map((rowBooks, rowIdx) => (
          <ShelfRow
            key={rowIdx}
            books={rowBooks} color={color}
            onBookClick={onBookClick}
            searchQuery={searchQuery}
            isMobile={isMobile}
            extra={0}
            onViewAll={null}
            rowIdx={rowIdx}
          />
        ))
      )}
      {books.length > 0 && <div style={{ height: isMobile ? 10 : 14 }} />}
    </CabinetFrame>
  )
})

// ── GENRE_FR ──────────────────────────────────────────────────────────────────
const GENRE_FR = {
  'fiction': 'Fiction',
  'literary fiction': 'Fiction litteraire',
  'general fiction': 'Fiction generale',
  'contemporary fiction': 'Fiction contemporaine',
  'mystery': 'Policier',
  'mystery & detective': 'Policier',
  'mystery and detective': 'Policier',
  'detective': 'Policier',
  'crime': 'Roman policier',
  'crime fiction': 'Roman policier',
  'thriller': 'Thriller',
  'suspense': 'Suspense',
  'noir': 'Roman noir',
  'science fiction': 'Science-fiction',
  'sci-fi': 'Science-fiction',
  'fantasy': 'Fantastique',
  'dark fantasy': 'Dark fantasy',
  'epic fantasy': 'Fantasy epique',
  'high fantasy': 'Fantasy epique',
  'urban fantasy': 'Fantasy urbaine',
  'paranormal': 'Paranormal',
  'horror': 'Horreur',
  'supernatural': 'Surnaturel',
  'romance': 'Romance',
  'historical romance': 'Romance historique',
  'contemporary romance': 'Romance contemporaine',
  'adventure': 'Aventure',
  'action': 'Action',
  'action & adventure': 'Action et aventure',
  'historical fiction': 'Roman historique',
  'historical': 'Historique',
  'history': 'Histoire',
  'drama': 'Drame',
  'juvenile fiction': 'Jeunesse',
  "children's fiction": 'Jeunesse',
  "children's": 'Jeunesse',
  'young adult': 'Young Adult',
  'young adult fiction': 'Young Adult',
  'ya': 'Young Adult',
  'comics & graphic novels': 'BD et graphic novel',
  'graphic novels': 'Graphic novel',
  'comic books': 'Bande dessinee',
  'manga': 'Manga',
  'non-fiction': 'Non-fiction',
  'nonfiction': 'Non-fiction',
  'biography': 'Biographie',
  'biography & autobiography': 'Biographie',
  'autobiography': 'Autobiographie',
  'memoir': 'Memoires',
  'memoirs': 'Memoires',
  'self-help': 'Developpement personnel',
  'personal development': 'Developpement personnel',
  'psychology': 'Psychologie',
  'philosophy': 'Philosophie',
  'politics': 'Politique',
  'political science': 'Sciences politiques',
  'economics': 'Economie',
  'business': 'Business',
  'business & economics': 'Economie et business',
  'science': 'Sciences',
  'technology': 'Technologie',
  'computers': 'Informatique',
  'nature': 'Nature',
  'travel': 'Voyage',
  'cooking': 'Cuisine',
  'health': 'Sante',
  'art': 'Art',
  'music': 'Musique',
  'sports': 'Sport',
  'religion': 'Religion',
  'spirituality': 'Spiritualite',
  'poetry': 'Poesie',
  'essays': 'Essais',
  'short stories': 'Nouvelles',
  'anthologies': 'Anthologie',
  'classics': 'Classiques',
  'literary classics': 'Classiques',
  'humour': 'Humour',
  'humor': 'Humour',
  'satire': 'Satire',
  'dystopian': 'Dystopie',
  'dystopia': 'Dystopie',
  'utopian': 'Utopie',
  'war': 'Guerre',
  'military': 'Militaire',
  'lgbtq+': 'LGBTQ+',
  'lgbtq': 'LGBTQ+',
}

function translateGenre(raw) {
  const key = raw.trim().toLowerCase()
  if (GENRE_FR[key]) return GENRE_FR[key]
  for (const [en, fr] of Object.entries(GENRE_FR)) {
    if (key.includes(en) || en.includes(key)) return fr
  }
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1)
}

// ── Section theme ─────────────────────────────────────────────────────────────
const ThemeSection = memo(function ThemeSection({ theme, books, onBookClick, searchQuery, isMobile }) {
  const GOLD   = '#816EBB'
  const COLS   = isMobile ? 4 : 5
  const PRIORITY = ['prefere', 'lu', 'en_cours', 'possede', 'souhaite']
  const STATUS_COLORS = {
    en_cours: '#a78bfa', possede: '#818cf8', souhaite: '#fb923c', lu: '#4ade80', prefere: '#f472b6',
  }

  const rows = []
  for (let i = 0; i < books.length; i += COLS) rows.push(books.slice(i, i + COLS))

  return (
    <CabinetFrame label={theme} color={GOLD} count={books.length} showViewAll={false} isMobile={isMobile}>
      {books.length === 0 ? (
        <div style={{ padding: '16px 14px 18px' }}>
          <span style={{ fontSize: 11, color: 'rgba(237,233,248,0.3)', fontFamily: 'Georgia, serif' }}>
            Aucun livre dans cette categorie
          </span>
          <div style={{ marginTop: 14 }}><ShelfPlank /></div>
        </div>
      ) : (
        rows.map((rowBooks, rowIdx) => {
          const q = searchQuery?.trim().toLowerCase() || ''
          return (
            <div key={rowIdx} style={{ padding: isMobile ? '0 8px' : '0 12px' }}>
              <div style={{
                height: rowIdx === 0 ? 16 : 20,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
                marginBottom: 3, pointerEvents: 'none',
              }} />
              <div style={{
                display: 'grid',
                gridTemplateColumns: ('repeat(' + COLS + ', 1fr)'),
                gap: isMobile ? '5px' : '7px',
                alignItems: 'flex-end',
              }}>
                {rowBooks.map((book, i) => {
                  const cover    = book.cover || book.cover_url
                  const title    = book.title || 'Sans titre'
                  const author   = (book.authors || [])[0] || ''
                  const id       = book.id || book.google_id || String(rowIdx * COLS + i)
                  const bStatuses = book.statuses?.length ? book.statuses : [book.status]
                  const primary   = PRIORITY.find(s => bStatuses.includes(s)) || bStatuses[0]
                  const bColor    = STATUS_COLORS[primary] || GOLD
                  const isMatch   = q && (title.toLowerCase().includes(q) || author.toLowerCase().includes(q))
                  const isDimmed  = q && !isMatch
                  return (
                    <div key={id} onClick={() => onBookClick(book)} title={title}
                      style={{
                        aspectRatio: '1 / 1.55', cursor: 'pointer',
                        opacity: isDimmed ? 0.1 : 1,
                        transition: 'transform 0.15s, opacity 0.2s',
                        outline: isMatch ? ('2px solid ' + bColor) : 'none',
                        outlineOffset: 2,
                        borderRadius: '2px 6px 6px 2px',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-9px)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
                    >
                      <div style={{
                        width: '100%', height: '100%',
                        borderRadius: '2px 6px 6px 2px', overflow: 'hidden',
                        background: 'linear-gradient(145deg, #2D1B69, #1A0F3A)',
                        boxShadow: '-2px 8px 20px rgba(0,0,0,0.85)',
                        borderBottom: ('2px solid ' + bColor),
                      }}>
                        {cover
                          ? <img src={cover} alt={title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              loading="lazy" />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                              <span style={{ fontFamily: "'Playfair Display', serif", color: '#D4C8FF', fontSize: '8px', fontWeight: 700, textAlign: 'center', lineHeight: 1.4 }}>{title}</span>
                            </div>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 5 }}><ShelfPlank /></div>
            </div>
          )
        })
      )}
      {books.length > 0 && <div style={{ height: isMobile ? 10 : 14 }} />}
    </CabinetFrame>
  )
})

// ── Vue par themes ────────────────────────────────────────────────────────────
function ThemeView({ books, onBookClick, searchQuery, isMobile }) {
  const themes = useMemo(() => {
    const groups = {}
    books.forEach(book => {
      const cats = book.categories?.length ? book.categories : ['Autres']
      cats.forEach(cat => {
        const fr  = translateGenre(cat)
        const key = fr || 'Autres'
        if (!groups[key]) groups[key] = []
        if (!groups[key].find(b => (b.id || b.google_id) === (book.id || book.google_id)))
          groups[key].push(book)
      })
    })
    return Object.entries(groups)
      .map(([theme, bks]) => [theme, sortAlpha(bks)])
      .sort(([a], [b]) => a === 'Autres' ? 1 : b === 'Autres' ? -1 : a.localeCompare(b, 'fr'))
  }, [books])

  if (themes.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(237,233,248,0.25)', fontSize: '14px' }}>
      Aucun livre avec une categorie pour l instant
    </div>
  )

  return (
    <div>
      {themes.map(([theme, themeBooks]) => (
        <ThemeSection
          key={theme} theme={theme} books={themeBooks}
          onBookClick={onBookClick} searchQuery={searchQuery} isMobile={isMobile}
        />
      ))}
    </div>
  )
}

// ── Barre de recherche ────────────────────────────────────────────────────────
function SearchBar({ value, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(129,110,187,0.15)',
      borderRadius: 10, padding: '10px 16px',
    }}>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
        stroke="rgba(129,110,187,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder="Rechercher dans cette categorie..."
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1, background: 'none', border: 'none', outline: 'none',
          color: 'rgba(237,233,248,0.85)', fontSize: 14, fontFamily: 'inherit',
        }}
      />
      {value && (
        <button onClick={() => onChange('')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(129,110,187,0.45)', fontSize: 18, padding: 0, lineHeight: 1,
          }}>
          {'×'}
        </button>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Bookshelf({ books, onBookClick, filter = 'all', viewMode = 'apercu', onFilterChange }) {
  const [rawQuery, setRawQuery] = useState('')
  const searchQuery = useDebounce(rawQuery, 150)
  const isMobile    = useIsMobile()

  const statuses = filter === 'all' ? STATUS_ORDER : [filter]

  const booksByStatus = useMemo(() =>
    Object.fromEntries(statuses.map(s => [s, sortAlpha(books.filter(b => hasStatus(b, s)))])),
    [books, filter] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Apercu general : cadres avec 5 livres max
  if (filter === 'all' && viewMode !== 'theme') {
    return (
      <div style={{ width: '100%', paddingBottom: 40, paddingTop: isMobile ? 8 : 16 }}>
        {STATUS_ORDER.map(status => (
          <PreviewSection
            key={status}
            status={status}
            books={booksByStatus[status] || []}
            onBookClick={onBookClick}
            onViewAll={() => onFilterChange(status)}
            isMobile={isMobile}
          />
        ))}
      </div>
    )
  }

  // Vue par themes/genres
  if (viewMode === 'theme') {
    return (
      <div style={{ width: '100%', paddingBottom: 40, paddingTop: isMobile ? 8 : 16 }}>
        <ThemeView books={books} onBookClick={onBookClick} searchQuery={searchQuery} isMobile={isMobile} />
      </div>
    )
  }

  // Vue complete d une categorie
  return (
    <div style={{ width: '100%', paddingBottom: 40 }}>
      <div style={{ padding: isMobile ? '12px 16px 16px' : '16px 28px 20px' }}>
        <SearchBar value={rawQuery} onChange={setRawQuery} />
      </div>
      {statuses.map(status => (
        <LibraryShelfSection
          key={status}
          status={status}
          books={booksByStatus[status] || []}
          onBookClick={onBookClick}
          searchQuery={searchQuery}
          isMobile={isMobile}
        />
      ))}
    </div>
  )
}
