import { useEffect, useRef, useState } from 'react'
import { searchBooks } from '../lib/googleBooks'
import { analyzeBookImage } from '../lib/visionApi'
import { searchByISBN } from '../lib/googleBooks'
import { preloadCover, relayUrl } from '../lib/covers'
import { useIsMobile } from '../hooks/useIsMobile'

/** Couverture via le relais (même image que la 3D, déjà en cache), sinon l'adresse directe. */
function CoverImg({ src }) {
  const [fallback, setFallback] = useState(false)
  if (!src) return null
  const https = src.replace('http://', 'https://')
  return fallback
    ? <img src={https} alt="" loading="lazy" draggable="false" />
    : <img src={relayUrl(https)} alt="" crossOrigin="anonymous" draggable="false" onError={() => setFallback(true)} />
}

const EASE_SHEET = 'cubic-bezier(.76, 0, .18, 1)'
const HAS_VISION = !!import.meta.env.VITE_GOOGLE_VISION_API_KEY

/** Panneau de recherche Google Books, plein écran, même papier que la fiche. */
export default function SearchPanel({ open, onClosed, onPick, isInLibrary, onScan, inBasket, onBasket, onBasketDrop, basketSlot, basketFull, basketCount = 0, basketBusy = false }) {
  const suppressClick = useRef(false)
  const mobile = useIsMobile()
  // Téléphone : le panier reste caché en bas ; il monte quand on prend un livre (appui long)
  // ou qu'on touche « + », puis redescend une fois le livre arrivé dedans.
  const [peek, setPeek] = useState(false)
  const [sheet, setSheet] = useState(false)     // ouvert à la main (onglet « Panier »)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (!peek || dragging || basketBusy) return
    const t = setTimeout(() => setPeek(false), 850)
    return () => clearTimeout(t)
  }, [peek, dragging, basketBusy])
  const basketUp = !mobile || peek || sheet

  /**
   * Glisser une couverture des résultats jusqu'à la pile « à ranger » (souris : on tire ; doigt :
   * appui long). Lâchée dessus, elle s'y pose.
   */
  const startDrag = (e, b) => {
    if (e.button > 0 || !onBasketDrop) return
    const cover = e.currentTarget.querySelector('.result-cover')
    const rc = cover.getBoundingClientRect()
    const src = cover.querySelector('img')?.src
    const fx = (e.clientX - rc.left) / rc.width, fy = (e.clientY - rc.top) / rc.height
    const start = { x: e.clientX, y: e.clientY }
    const touch = e.pointerType !== 'mouse'
    let ghost = null, over = false, timer = null, last = start
    const zone = () => document.querySelector('.search-basket')
    const target = () => document.querySelector('.search-basket .bb-target')

    const place = (x, y) => {
      ghost.style.transform = `translate(${x - fx * rc.width}px, ${y - fy * rc.height}px) rotate(-3deg) scale(${over ? 0.92 : 1.05})`
    }
    const begin = () => {
      ghost = document.createElement('div')
      ghost.className = 'drag-cover'
      ghost.style.width = `${rc.width}px`; ghost.style.height = `${rc.height}px`
      if (src) { const img = new Image(); img.src = src; img.alt = ''; ghost.appendChild(img) }
      document.body.appendChild(ghost)
      document.body.classList.add('is-dragging')
      setPeek(true); setDragging(true)
      cover.classList.add('lifted')
      suppressClick.current = true
      navigator.vibrate?.(8)
      place(last.x, last.y)
    }
    const isOver = (x, y) => {
      const t = target()
      if (!t) return false
      const r = t.getBoundingClientRect()
      return x > r.left - 30 && x < r.right + 30 && y > r.top - 40 && y < r.bottom + 30
    }
    const move = ev => {
      last = { x: ev.clientX, y: ev.clientY }
      const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y)
      if (!ghost) {
        if (!touch && dist > 6) begin()
        else if (touch && dist > 10) { finish(null); return }
        if (!ghost) return
      }
      ev.preventDefault()
      const o = isOver(ev.clientX, ev.clientY)
      if (o !== over) { over = o; zone()?.classList.toggle('drop-ready', o) }
      place(ev.clientX, ev.clientY)
    }
    const noScroll = ev => { if (ghost) ev.preventDefault() }
    const finish = ev => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('touchmove', noScroll)
      if (!ghost) return
      setDragging(false)
      document.body.classList.remove('is-dragging')
      zone()?.classList.remove('drop-ready')
      const g = ghost
      ghost = null
      setTimeout(() => { suppressClick.current = false }, 60)
      if (ev && ev.type === 'pointerup' && over) {
        // le livre volant reprend exactement là où on l'a lâché
        const r = g.getBoundingClientRect()
        g.remove()
        cover.classList.remove('lifted')
        onBasketDrop(b, { left: r.left, top: r.top, width: r.width, height: r.height }, src)
      } else {
        g.animate([{ transform: g.style.transform }, { transform: `translate(${rc.left}px, ${rc.top}px) rotate(0deg) scale(1)` }],
          { duration: 380, easing: 'cubic-bezier(.3, 1.25, .5, 1)' }).onfinish = () => { g.remove(); cover.classList.remove('lifted') }
      }
    }
    if (touch) timer = setTimeout(() => { if (!ghost) begin() }, 320)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    window.addEventListener('touchmove', noScroll, { passive: false })
  }

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
        books.forEach(b => preloadCover(b)) // les couvertures sont prêtes avant même le « + »
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
      <div className="detail-top-logo"><div className="logo"><div className="logo-name">Maruchime</div><div className="logo-sub">Bibliothèque</div></div></div>
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
              const draggable = !here && !picked && !basketFull
              return (
                <div key={b.googleId} className={'result-card' + (here ? ' owned' : '') + (draggable ? ' can-drag' : '')}>
                  <button
                    type="button" className="result-open"
                    onPointerDown={draggable ? e => startDrag(e, b) : undefined}
                    onDragStart={e => e.preventDefault()}
                    onClick={e => { if (suppressClick.current) return; onPick(b, e.currentTarget.querySelector('.result-cover')?.getBoundingClientRect()) }}
                  >
                    <div className="result-cover">
                      <CoverImg src={b.cover} />
                      {here && <span className="in-lib">Déjà dans ta bibliothèque</span>}
                    </div>
                    <div className="result-title">{b.title}</div>
                    <div className="result-author">{b.authors.join(', ')}{b.publishedDate ? ` · ${b.publishedDate.slice(0, 4)}` : ''}</div>
                  </button>
                  {!here && (
                    <button
                      type="button" className={'result-plus' + (picked ? ' picked' : '')}
                      aria-label={picked ? `${b.title} est à ranger` : basketFull ? 'Déjà trop de livres à ranger' : `Garder ${b.title} pour le ranger`}
                      title={!picked && basketFull ? 'Range d’abord tes livres (20 au plus)' : undefined}
                      disabled={picked || basketFull}
                      onClick={e => { setPeek(true); onBasket(b, e.currentTarget.parentElement.querySelector('.result-cover')) }}
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
        <aside className={'search-basket' + (mobile ? (basketUp ? ' up' : ' down') : '')}>
          {mobile && (basketCount > 0 || basketUp) && (
            <button type="button" className="sb-tab lbl" onClick={() => { setSheet(v => !(v || peek)); setPeek(false) }} aria-expanded={basketUp}>
              <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><path d="M1 11.5h12M2 11.5V8.5h10v3M3 8.5V5.5h8v3M4.5 5.5V3h5v2.5" stroke="currentColor" fill="none" strokeWidth="1.2" strokeLinejoin="round" /></svg>
              À ranger
              <span className="sb-count" key={basketCount}>{basketCount}</span>
              <span className="sb-chev" aria-hidden="true">{basketUp ? '▾' : '▴'}</span>
            </button>
          )}
          {basketSlot}
        </aside>
        </div>
      </div>
    </div>
  )
}
