import { useState, useMemo } from 'react'
import { searchBooks } from '../lib/googleBooks'
import { IconSparkle, IconRefresh, IconHeart, IconUser, IconTag } from './Icons'

function getMostCommon(arr, n = 5) {
  const freq = {}
  arr.forEach(x => { if (x && typeof x === 'string' && x.length > 2) freq[x] = (freq[x] || 0) + 1 })
  return Object.entries(freq).sort(([, a], [, b]) => b - a).slice(0, n).map(([k]) => k)
}

function extractBaseTitle(title) {
  if (!title) return ''
  return title
    .replace(/[,:\s-]+\s*(tome|vol\.?|volume|t\.|#|book|part|ep\.?|chapter|saison|season)\s*\d+.*/i, '')
    .replace(/[,:\s]+\d+\s*$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim().toLowerCase()
}

function SuggestionCard({ book, onSelect }) {
  const cover = book.cover || book.cover_url
  const title = book.title || 'Sans titre'
  const author = (book.authors || [])[0] || ''
  return (
    <div onClick={() => onSelect(book)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'transform 0.18s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
      <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '6px 10px 10px 6px', overflow: 'hidden', boxShadow: '-4px 6px 18px rgba(0,0,0,0.65)', background: 'linear-gradient(145deg, #4A1A6B, #2d1040)' }}>
        {cover
          ? <img src={cover} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <span style={{ fontFamily: "'Playfair Display', serif", color: '#E8C8FF', fontSize: '10px', textAlign: 'center', lineHeight: 1.4 }}>{title}</span>
            </div>
        }
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'rgba(237,233,248,0.85)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.35 }}>{title}</p>
        {author && <p style={{ margin: '2px 0 0', fontSize: '9.5px', color: 'rgba(237,233,248,0.35)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{author}</p>}
      </div>
    </div>
  )
}

function hasStatusFn(book, status) {
  const s = book.statuses?.length ? book.statuses : (book.status ? [book.status] : [])
  return s.includes(status)
}

function bookWeight(book) {
  if (book.rating === 1) return 0
  let w = 1
  if (hasStatusFn(book, 'prefere')) w += 4
  if (book.rating === 5) w += 3
  else if (book.rating === 3) w += 1
  return w
}

const SKIP_GENRES = new Set(['juvenile fiction', "children's fiction", "children's", 'fiction', 'general fiction', 'literary fiction', 'nonfiction', 'non-fiction', 'books', 'general', 'literature'])

function genreToQuery(raw) {
  const key = raw.toLowerCase().trim()
  const MAP = {
    'comics & graphic novels': 'manga seinen', 'comics and graphic novels': 'manga seinen',
    'graphic novels': 'manga graphic novel', 'manga': 'manga',
    'fantasy': 'dark fantasy novel', 'dark fantasy': 'dark fantasy novel',
    'epic fantasy': 'epic fantasy novel', 'science fiction': 'science fiction novel',
    'mystery': 'roman policier mystery', 'thriller': 'thriller suspense',
    'horror': 'horror novel', 'romance': 'roman romance',
    'historical fiction': 'roman historique historical fiction',
    'biography': 'biographie biography', 'young adult': 'young adult fantasy',
  }
  if (MAP[key]) return MAP[key]
  if (SKIP_GENRES.has(key)) return null
  return raw
}

const MODES = [
  { id: 'smart',  label: 'Pour toi',     Icon: IconSparkle, color: '#c084fc', desc: 'Bases sur tes gouts et favoris' },
  { id: 'author', label: 'Par auteur',   Icon: IconUser,    color: '#f472b6', desc: 'Autres oeuvres de tes auteurs preferes' },
  { id: 'genre',  label: 'Par genre',    Icon: IconTag,     color: '#818cf8', desc: 'Decouverte dans tes genres favoris' },
]

export default function AIRecommendations({ books, onBookSelect }) {
  const [mode, setMode]       = useState('smart')
  const [recs, setRecs]       = useState([])
  const [loading, setLoading] = useState(false)
  const [generated, setGen]   = useState(false)
  const [error, setError]     = useState(null)
  const [selectedAuthor, setSelectedAuthor] = useState(null)
  const [selectedGenre,  setSelectedGenre]  = useState(null)

  const readBooks = useMemo(() => books.filter(b => hasStatusFn(b, 'lu') || hasStatusFn(b, 'prefere')), [books])
  const lovedBooks = useMemo(() => readBooks.filter(b => hasStatusFn(b, 'prefere') || b.rating === 5 || b.rating === 3), [readBooks])
  const dislikedBooks = useMemo(() => readBooks.filter(b => b.rating === 1), [readBooks])

  const topAuthors = useMemo(() => {
    const weighted = readBooks.flatMap(b => Array(bookWeight(b)).fill(b.authors || []).flat())
    return getMostCommon(weighted, 8).filter(a => a.trim().split(' ').length >= 2)
  }, [readBooks])

  const topGenres = useMemo(() => {
    const weighted = readBooks.flatMap(b => Array(bookWeight(b)).fill(b.categories || []).flat())
    return getMostCommon(weighted, 8).filter(g => !SKIP_GENRES.has(g.toLowerCase()))
  }, [readBooks])

  const libraryIds = useMemo(() => new Set(books.map(b => b.google_id || b.googleId).filter(Boolean)), [books])
  const libraryBaseTitles = useMemo(() => new Set(books.map(b => extractBaseTitle(b.title || '')).filter(t => t.length > 2)), [books])
  const dislikedAuthors = useMemo(() => new Set(dislikedBooks.flatMap(b => b.authors || [])), [dislikedBooks])

  function filterResults(flat) {
    const seen = new Set()
    return flat.filter(b => {
      if (!b.googleId || seen.has(b.googleId) || libraryIds.has(b.googleId)) return false
      const base = extractBaseTitle(b.title || '')
      if (base.length > 2 && libraryBaseTitles.has(base)) return false
      if ((b.authors || []).some(a => dislikedAuthors.has(a))) return false
      seen.add(b.googleId)
      return true
    })
  }

  const generate = async () => {
    setLoading(true); setError(null)
    try {
      let queries = []

      if (mode === 'smart') {
        const authorCount = {}
        books.forEach(b => (b.authors || []).forEach(a => { authorCount[a] = (authorCount[a] || 0) + 1 }))
        const saturated = new Set(Object.entries(authorCount).filter(([, n]) => n >= 2).map(([a]) => a))
        const usedAuthors = new Set()
        lovedBooks.forEach(b => {
          const a = (b.authors || [])[0]
          if (!a || usedAuthors.has(a) || saturated.has(a) || dislikedAuthors.has(a)) return
          if (a.trim().split(' ').length < 2) return
          usedAuthors.add(a)
          queries.push('inauthor:"' + a + '"')
        })
        topGenres.slice(0, 3).forEach(g => { const q = genreToQuery(g); if (q) queries.push('subject:' + q) })
        lovedBooks.slice(0, 2).forEach(b => {
          const g = (b.categories || [])[0]
          const q = g ? genreToQuery(g) : null
          if (q) queries.push(q + ' bestseller')
        })
        if (queries.length === 0) queries.push('roman populaire')

      } else if (mode === 'author') {
        const author = selectedAuthor || topAuthors[0]
        if (!author) { setError('Aucun auteur trouve dans ta bibliotheque.'); setLoading(false); return }
        queries = ['inauthor:"' + author + '"', author + ' oeuvres completes']

      } else if (mode === 'genre') {
        const genre = selectedGenre || topGenres[0]
        if (!genre) { setError('Aucun genre trouve dans ta bibliotheque.'); setLoading(false); return }
        const q = genreToQuery(genre) || genre
        queries = [q, q + ' popular', q + ' bestseller']
      }

      const finalQueries = [...new Set(queries)].slice(0, 8)
      const results = await Promise.all(finalQueries.map(q => searchBooks(q, { maxResults: 10 }).catch(() => [])))
      const filtered = filterResults(results.flat())
      setRecs(filtered.slice(0, 24))
      setGen(true)
    } catch {
      setError('Erreur lors de la generation.')
    } finally {
      setLoading(false)
    }
  }

  const handleModeChange = (m) => {
    setMode(m)
    setRecs([])
    setGen(false)
    setError(null)
  }

  const currentMode = MODES.find(m => m.id === mode)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconSparkle size={20} color="#c084fc" />
        </div>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#EDE9F8' }}>Suggestions IA</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(237,233,248,0.4)' }}>Livres deja lus et series connues exclus</p>
        </div>
      </div>

      {readBooks.length === 0 ? (
        <div style={{ padding: '40px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(192,132,252,0.2)', borderRadius: '14px', textAlign: 'center' }}>
          <IconSparkle size={32} color="rgba(192,132,252,0.3)" />
          <p style={{ color: 'rgba(237,233,248,0.35)', margin: '12px 0 0', fontSize: '14px' }}>Marque quelques livres comme lus pour recevoir des suggestions !</p>
        </div>
      ) : (
        <>
          {/* Choix du mode */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => handleModeChange(m.id)} style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 16px', borderRadius: '12px', cursor: 'pointer',
                background: mode === m.id ? `${m.color}20` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${mode === m.id ? m.color + '60' : 'rgba(255,255,255,0.08)'}`,
                color: mode === m.id ? m.color : 'rgba(237,233,248,0.45)',
                fontSize: '13px', fontWeight: mode === m.id ? 600 : 400,
                transition: 'all 0.18s',
              }}>
                <m.Icon size={14} color={mode === m.id ? m.color : 'rgba(237,233,248,0.3)'} />
                {m.label}
              </button>
            ))}
          </div>

          {/* Selecteur auteur */}
          {mode === 'author' && topAuthors.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(237,233,248,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Choisir un auteur</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {topAuthors.map(a => (
                  <button key={a} onClick={() => { setSelectedAuthor(a); setRecs([]); setGen(false) }} style={{
                    padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px',
                    background: selectedAuthor === a ? 'rgba(244,114,182,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedAuthor === a ? 'rgba(244,114,182,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: selectedAuthor === a ? '#f472b6' : 'rgba(237,233,248,0.5)',
                    transition: 'all 0.15s',
                  }}>{a}</button>
                ))}
              </div>
            </div>
          )}

          {/* Selecteur genre */}
          {mode === 'genre' && topGenres.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(237,233,248,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Choisir un genre</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {topGenres.map(g => (
                  <button key={g} onClick={() => { setSelectedGenre(g); setRecs([]); setGen(false) }} style={{
                    padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px',
                    background: selectedGenre === g ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedGenre === g ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: selectedGenre === g ? '#818cf8' : 'rgba(237,233,248,0.5)',
                    transition: 'all 0.15s',
                  }}>{g}</button>
                ))}
              </div>
            </div>
          )}

          {/* Description du mode actif */}
          <div style={{ padding: '12px 16px', background: `${currentMode.color}0d`, border: `1px solid ${currentMode.color}25`, borderRadius: '10px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <currentMode.Icon size={14} color={currentMode.color} />
            <span style={{ fontSize: '12px', color: 'rgba(237,233,248,0.5)' }}>{currentMode.desc}
              {mode === 'author' && (selectedAuthor || topAuthors[0]) && <strong style={{ color: currentMode.color }}> — {selectedAuthor || topAuthors[0]}</strong>}
              {mode === 'genre'  && (selectedGenre  || topGenres[0])  && <strong style={{ color: currentMode.color }}> — {selectedGenre  || topGenres[0]}</strong>}
            </span>
          </div>

          {/* Bouton */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
            <button onClick={generate} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px',
              background: loading ? 'rgba(192,132,252,0.15)' : 'linear-gradient(135deg, #7c3aed, #c084fc)',
              border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(124,58,237,0.4)', transition: 'all 0.2s',
            }}>
              {loading
                ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Recherche...</>
                : <><IconRefresh size={16} color="#fff" /> {generated ? 'Actualiser' : 'Generer'}</>
              }
            </button>
            {generated && !loading && <span style={{ fontSize: '13px', color: 'rgba(237,233,248,0.35)' }}>{recs.length} suggestions</span>}
          </div>

          {error && <div style={{ padding: '12px 16px', background: 'rgba(200,50,50,0.1)', border: '1px solid rgba(200,50,50,0.2)', borderRadius: '10px', color: '#f87171', fontSize: '13px', marginBottom: '20px' }}>{error}</div>}

          {recs.length > 0 && (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'rgba(237,233,248,0.4)' }}>Clique sur un livre pour l'ajouter a ta bibliotheque</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '16px' }}>
                {recs.map(book => <SuggestionCard key={book.googleId} book={book} onSelect={onBookSelect} />)}
              </div>
            </div>
          )}

          {!generated && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(237,233,248,0.2)', fontSize: '13px' }}>
              Choisis un mode et appuie sur Generer
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
