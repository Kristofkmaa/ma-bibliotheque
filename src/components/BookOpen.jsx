import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { clothOf, authorOf, yearOf, pagesOf, coverOf, statusesOf, verdictOf, prefersReducedMotion } from '../lib/exlibris'
import '../exlibris.css'

const STATUS_LABEL = { en_cours: 'En cours', possede: 'Possédé', souhaite: 'WishList', lu: 'Déjà lu', prefere: 'Favori' }

// Le livre sort de l'étagère, se retourne, s'ouvre, puis se feuillette :
// 1. la fiche, 2. ton avis, 3. que faire de ce livre.
export default function BookOpen({ book, fromEl, ownerName, onClose, onEdit, onSetStatuses, onRemove }) {
  const bookRef = useRef(null)
  const [show, setShow] = useState(prefersReducedMotion)
  const [page, setPage] = useState(() => (prefersReducedMotion() ? 1 : 0))
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const closing = useRef(false)
  const swipeX = useRef(null)

  const st = statusesOf(book)
  const cover = coverOf(book)
  const author = authorOf(book)
  const year = yearOf(book)
  const pages = pagesOf(book)
  const genre = (book.categories || [])[0]
  const added = book.added_at ? new Date(book.added_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  // Position de départ : le dos (ou la couverture) sur lequel on a touché
  const flyFrom = useCallback(() => {
    const b3 = bookRef.current
    if (!b3 || !fromEl || !fromEl.isConnected) return 'scale(.3) rotateY(80deg)'
    const r = fromEl.getBoundingClientRect(), br = b3.getBoundingClientRect()
    const s = Math.max(0.08, r.height / br.height)
    return `translate(${r.left + r.width / 2 - (br.left + br.width / 2)}px, ${r.top + r.height / 2 - (br.top + br.height / 2)}px) scale(${s}) rotateY(80deg)`
  }, [fromEl])

  useLayoutEffect(() => {
    const b3 = bookRef.current
    if (prefersReducedMotion()) return
    b3.style.transition = 'none'
    b3.style.transform = flyFrom()
    void b3.offsetWidth
    const raf = requestAnimationFrame(() => { b3.style.transition = ''; b3.style.transform = ''; setShow(true) })
    const t = setTimeout(() => setPage(p => (p === 0 ? 1 : p)), 720)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [flyFrom])

  const go = useCallback((p) => setPage(cur => Math.max(cur === 0 ? 0 : 1, Math.min(3, p))), [])

  const close = useCallback((then) => {
    if (closing.current) return
    closing.current = true
    const finish = () => { onClose(); if (typeof then === 'function') then() }
    if (then || prefersReducedMotion()) { finish(); return }
    const b3 = bookRef.current
    const wait = page > 0 ? 520 : 0
    setPage(0)
    setTimeout(() => {
      if (b3) b3.style.transform = flyFrom()
      setShow(false)
      setTimeout(finish, 600)
    }, wait)
  }, [onClose, flyFrom, page])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') go(page + 1)
      if (e.key === 'ArrowLeft') go(page - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, go, page])

  const onPointerDown = (e) => { swipeX.current = e.clientX }
  const onPointerUp = (e) => {
    if (swipeX.current == null) return
    const dx = e.clientX - swipeX.current
    swipeX.current = null
    if (Math.abs(dx) > 40) { go(page + (dx < 0 ? 1 : -1)); return }
    if (e.target.closest('button')) return
    const r = bookRef.current.getBoundingClientRect()
    go(page + (e.clientX > r.left + r.width * 0.35 ? 1 : -1))
  }

  // Action suivante selon où en est le livre
  const nextStep = st.includes('en_cours') ? 'finish'
    : st.includes('souhaite') && !st.includes('possede') ? 'bought'
    : st.includes('possede') && !st.includes('lu') ? 'start'
    : null
  const NEXT_LABEL = { finish: "Je l'ai fini", bought: "Je l'ai acheté", start: 'Je commence' }

  const update = async (statuses) => {
    setBusy(true)
    try { await onSetStatuses(book, statuses); close() } finally { setBusy(false) }
  }
  const runNext = () => {
    if (nextStep === 'finish') close(() => onEdit({ ...book, statuses: [...st.filter(s => s !== 'en_cours'), 'lu'] }, 'notes'))
    else if (nextStep === 'bought') update([...st.filter(s => s !== 'souhaite'), 'possede'])
    else if (nextStep === 'start') update([...st, 'en_cours'])
  }

  const leaf = (i, z, front, back) => (
    <div className={`xl-leaf${i < page ? ' turned' : ''}`} style={{ '--z': `${z}px` }}>
      {front}
      {back}
    </div>
  )
  const verso = <div className="xl-face back"><div className="xl-pg verso" /></div>

  const rating = +book.rating || 0
  const pageTwo = st.includes('lu') || rating ? (
    <>
      <h3>Ton avis</h3>
      {rating ? <div className="xl-verdict">{verdictOf(rating)}</div> : <p className="xl-quiet">Pas encore noté.</p>}
      {book.notes ? <blockquote>{book.notes}</blockquote> : <p className="xl-quiet">Aucune note écrite pour l'instant.</p>}
    </>
  ) : (
    <>
      <h3>En attendant</h3>
      <p className="xl-quiet">{st.includes('en_cours') ? 'Lecture en cours.' : st.includes('souhaite') ? 'Sur ta WishList.' : 'Sur la pile à lire.'} L'avis viendra une fois le livre refermé.</p>
      {book.notes && <blockquote>{book.notes}</blockquote>}
    </>
  )

  return createPortal(
    <div className={`xl-stage${show ? ' show' : ''}`} role="dialog" aria-modal="true" aria-label={`${book.title}, livre ouvert`}
      onClick={e => { if (e.target === e.currentTarget) close() }}>
      <button className="xl-close" onClick={() => close()}>Fermer</button>

      <div ref={bookRef} className="xl-book" style={{ '--cloth': clothOf(book) }} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div className="xl-bedge" />
        <div className="xl-bspine"><span>{book.title}</span></div>

        {/* Dernière page : les actions */}
        <div className="xl-base">
          <div className="xl-pg">
            <div className="xl-rh">{book.title}</div>
            <h3>Et maintenant ?</h3>
            <div className="xl-pacts">
              {nextStep && <button className="xl-pbtn solid" disabled={busy} onClick={runNext}>{NEXT_LABEL[nextStep]}</button>}
              <button className="xl-pbtn" onClick={() => close(() => onEdit(book, 'notes'))}>Modifier statut et avis</button>
              {!confirm
                ? <button className="xl-pbtn del" onClick={() => setConfirm(true)}>Retirer de la bibliothèque</button>
                : <div>
                    <p className="xl-quiet" style={{ margin: '4px 0 8px' }}>Retirer « {book.title} » ?</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="xl-pbtn" style={{ flex: 1 }} onClick={() => setConfirm(false)}>Garder</button>
                      <button className="xl-pbtn del" style={{ flex: 1 }} disabled={busy}
                        onClick={async () => { setBusy(true); try { await onRemove(book); close(() => {}) } finally { setBusy(false) } }}>Retirer</button>
                    </div>
                  </div>}
            </div>
            <div className="xl-folio">3</div>
          </div>
        </div>

        {leaf(2, 11,
          <div className="xl-face"><div className="xl-pg">
            <div className="xl-rh">Ton avis</div>
            {pageTwo}
            {added && <p className="xl-quiet" style={{ marginTop: 'auto' }}>Entré dans la bibliothèque le {added}</p>}
            <div className="xl-folio">2</div>
          </div></div>, verso)}

        {leaf(1, 12,
          <div className="xl-face"><div className="xl-pg">
            <div className="xl-rh">{author || 'Fiche'}</div>
            <h3>{book.title}</h3>
            {author && <div className="xl-by">{author}</div>}
            <div className="xl-orn">· ❦ ·</div>
            <dl>
              {year && <><dt>Parution</dt><dd>{year}</dd></>}
              {genre && <><dt>Genre</dt><dd>{genre}</dd></>}
              {pages > 0 && <><dt>Pages</dt><dd>{pages}</dd></>}
              <dt>Statut</dt><dd>{st.map(s => STATUS_LABEL[s] || s).join(', ') || '—'}</dd>
            </dl>
            {book.description && <p className="xl-res">{book.description}</p>}
            <div className="xl-folio">1</div>
          </div></div>, verso)}

        {leaf(0, 13,
          <div className={`xl-face xl-cover${cover ? ' has-img' : ''}`}>
            {cover
              ? <><img className="xl-cover-img" src={cover} alt="" /><div className="xl-hinge" /></>
              : <><div className="ct">{book.title}</div><div className="orn">❦</div><div className="ca">{author}</div></>}
          </div>,
          <div className="xl-face back xl-endp"><div className="xl-stamp"><i>Ex-libris</i>{ownerName || 'Ma bibliothèque'}</div></div>)}
      </div>

      <div className="xl-nav">
        <button onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Page précédente">‹</button>
        <div className="xl-dots">{[1, 2, 3].map(n => <i key={n} className={page === n ? 'on' : ''} />)}</div>
        <button onClick={() => go(page + 1)} disabled={page >= 3} aria-label="Page suivante">›</button>
      </div>
      <div className="xl-hint">Touche la page ou fais-la glisser pour tourner</div>
    </div>,
    document.body
  )
}
