import { useState, useEffect, useRef } from 'react'
import { searchBooks } from '../lib/googleBooks'
import { IconSearch } from './Icons'

function SearchResult({ book, onClick }) {
  const cover = book.cover || book.cover_url
  return (
    <button
      onClick={() => onClick(book)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        width: '100%', padding: '10px 12px',
        background: 'none', border: 'none',
        cursor: 'pointer', textAlign: 'left',
        borderRadius: '8px', color: '#EDE9F8',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(129,110,187,0.08)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <div style={{
        width: 36, height: 50, flexShrink: 0,
        borderRadius: '3px', overflow: 'hidden',
        background: 'rgba(255,255,255,0.05)',
      }}>
        {cover ? (
          <img src={cover} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2D1B69, #1A0F3A)' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {book.title}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(237,233,248,0.45)', marginTop: '2px' }}>
          {(book.authors || []).join(', ')}
          {book.publishedDate && ` · ${book.publishedDate.slice(0, 4)}`}
        </div>
      </div>
    </button>
  )
}

export default function SearchBar({ onBookSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timeoutRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const books = await searchBooks(query, { maxResults: 8 })
        setResults(books)
        setOpen(true)
      } catch (err) {
        console.error('Erreur recherche:', err)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timeoutRef.current)
  }, [query])

  useEffect(() => {
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (book) => {
    setQuery(''); setResults([]); setOpen(false)
    onBookSelect(book)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: '13px', top: '50%',
          transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4,
        }}>
          <IconSearch size={15} color="#816EBB" />
        </span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Rechercher un livre, auteur, ISBN…"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(129,110,187,0.2)',
            borderRadius: '10px',
            padding: '11px 14px 11px 38px',
            color: '#EDE9F8', fontSize: '14px', outline: 'none',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(129,110,187,0.5)'
            e.target.style.background = 'rgba(255,255,255,0.09)'
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(129,110,187,0.2)'
            e.target.style.background = 'rgba(255,255,255,0.06)'
          }}
        />
        {loading && (
          <div style={{
            position: 'absolute', right: '13px', top: '50%',
            transform: 'translateY(-50%)',
            width: '14px', height: '14px',
            border: '2px solid rgba(129,110,187,0.2)',
            borderTopColor: '#816EBB', borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
          background: 'linear-gradient(145deg, #1e1208, #2a1a0a)',
          border: '1px solid rgba(129,110,187,0.18)',
          borderRadius: '12px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          zIndex: 500, overflow: 'hidden', padding: '6px',
        }}>
          {results.map(book => (
            <SearchResult key={book.googleId} book={book} onClick={handleSelect} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  )
}
