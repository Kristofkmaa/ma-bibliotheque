import { useEffect, useRef, useState } from 'react'
import { searchBooks } from '../lib/googleBooks'
import { analyzeBookImage } from '../lib/visionApi'
import { searchByISBN } from '../lib/googleBooks'

const EASE_SHEET = 'cubic-bezier(.76, 0, .18, 1)'
const HAS_VISION = !!import.meta.env.VITE_GOOGLE_VISION_API_KEY

/** Panneau de recherche Google Books, plein écran, même papier que la fiche. */
export default function SearchPanel({ open, onClosed, onPick, isInLibrary, onScan, inBasket, onBasket, basketSlot }) {
  const panel = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('')
  const openedOnce = useRef(false)

  useEffect(() => {
    if (!open || openedOnce.current) return
    openedOnce.current = true
    const a = panel.current.animate(
      [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }],
      { duration: 800, easing: EASE_SHEET, fill: 'backwards' }
    )
    a.onfinish = () => a.cancel()
    setTimeout(() => inputRef.current?.focus(), 450)
  }, [open])

  useEffect(() => {
    if (open || !openedOnce.current) return
    const a = panel.current.animate(
      [{ clipPath: 'inset(0 0 0% 0)' }, { clipPath: 'inset(0 0 100% 0)' }],
      { duration: 650, easing: EASE_SHEET, fill: 'both' }
    )
    a.onfinish = () => onClosed?.()
  }, [open, onClosed])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setStatus(''); return }
    const t = setTimeout(async () => {
      setStatus('Recherche…')
      try {
        const books = await searchBooks(query, { maxResults: 24 })
        setResults(books)
        setStatus(books.length ? `${books.length} résultats` : 'Aucun résultat')
      } catch (e) {
        setStatus('Erreur de recherche')
        console.error(e)
      }
    }, 380)
    return () => clearTimeout(t)
  }, [query])

  const onPhoto = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('Analyse de la photo…')
    try {
      const res = await analyzeBookImage(file)
      if (res.isbn) {
        const book = await searchByISBN(res.isbn)
        if (book) { onPick(book, null); return }
      }
      const guess = res.detectedLines.slice(0, 2).join(' ')
      if (guess) setQuery(guess)
      else setStatus('Rien de lisible sur la photo')
    } catch (err) {
      setStatus('Analyse impossible : ' + (err.message || err))
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="search-panel grain" ref={panel} role="dialog" aria-modal="true" aria-label="Ajouter un livre">
      <div className="detail-top-logo"><div className="logo"><div className="logo-name">Levana</div><div className="logo-sub">Bibliothèque</div></div></div>
      <div className="search-inner">
        <div className="search-layout">
        <div className="search-main">
        <div className="search-head">
          <input
            ref={inputRef} className="search-input" type="search" value={query}
            onChange={e => setQuery(e.target.value)} placeholder="Un titre, une autrice, un ISBN…"
            autoComplete="off" spellCheck="false"
          />
          <div className="search-tools">
            <button type="button" className="lbl box" onClick={onScan}>Scanner un code-barres</button>
            {HAS_VISION && (
              <>
                <button type="button" className="lbl box" onClick={() => fileRef.current?.click()}>Photo de la couverture</button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
              </>
            )}
            {status && <span className="search-status">{status}</span>}
          </div>
        </div>

        {results.length > 0 ? (
          <div className="results-grid">
            {results.map(b => {
              const here = isInLibrary(b.googleId)
              const picked = inBasket(b.googleId)
              return (
                <div key={b.googleId} className="result-card">
                  <button type="button" className="result-open" onClick={e => onPick(b, e.currentTarget.querySelector('.result-cover')?.getBoundingClientRect())}>
                    <div className="result-cover">
                      {b.cover ? <img src={b.cover} alt="" loading="lazy" /> : null}
                      {here && <span className="in-lib">Déjà là</span>}
                    </div>
                    <div className="result-title">{b.title}</div>
                    <div className="result-author">{b.authors.join(', ')}{b.publishedDate ? ` · ${b.publishedDate.slice(0, 4)}` : ''}</div>
                  </button>
                  {!here && (
                    <button
                      type="button" className={'result-plus' + (picked ? ' picked' : '')}
                      aria-label={picked ? `${b.title} est dans le panier` : `Mettre ${b.title} dans le panier`}
                      disabled={picked}
                      onClick={e => onBasket(b, e.currentTarget.parentElement.querySelector('.result-cover'))}
                    >{picked ? '✓' : '+'}</button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          !query.trim() && <p className="search-empty">Cherche dans des millions de livres, ou scanne le code-barres au dos d'un livre.</p>
        )}
        </div>
        <aside className="search-basket">{basketSlot}</aside>
        </div>
      </div>
    </div>
  )
}
