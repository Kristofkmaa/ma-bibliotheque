import { useEffect, useRef, useState } from 'react'
import { toDisplay, spineColors } from '../lib/bookUtils'
import { toggleState } from '../lib/reading'

const EASE = 'cubic-bezier(.2, .8, .2, 1)'
const EASE_SHEET = 'cubic-bezier(.76, 0, .18, 1)'
const BLOBS = [
  { cx: 150, cy: 330, delay: 0 }, { cx: 420, cy: 600, delay: 120 }, { cx: 300, cy: 120, delay: 220 },
  { cx: 90, cy: 760, delay: 300 }, { cx: 520, cy: 250, delay: 360 }, { cx: 320, cy: 860, delay: 420 },
  { cx: 280, cy: 470, delay: 180 },
]

function insetFrom(rect) {
  const W = window.innerWidth, H = window.innerHeight
  return `inset(${Math.max(0, rect.top)}px ${Math.max(0, W - rect.right)}px ${Math.max(0, H - rect.bottom)}px ${Math.max(0, rect.left)}px round 3px)`
}

/** Mettre le livre dans notre top 5 (s'il est plein : choisir lequel il remplace), ou l'en retirer. */
function TopControl({ top }) {
  const [pick, setPick] = useState(false)
  if (top.rank > 0) {
    return (
      <div className="toggle-row top-row">
        <span className={'top-medal r' + top.rank}>N° {top.rank}</span>
        <button type="button" className="lbl toggle" onClick={top.arrange}>Ranger mon top</button>
        <button type="button" className="lbl toggle" onClick={top.remove}>Retirer du top</button>
      </div>
    )
  }
  if (top.list.length < top.max) {
    return (
      <div className="toggle-row top-row">
        <button type="button" className="lbl toggle top-add" onClick={() => top.add()}>★ Mettre dans mon top <span>· n° {top.list.length + 1}</span></button>
      </div>
    )
  }
  return (
    <div className="top-full">
      {!pick
        ? <button type="button" className="lbl toggle top-add" onClick={() => setPick(true)}>★ Mettre dans mon top…</button>
        : <>
          <p className="top-full-q">Ton top est complet : à la place de quel livre ?</p>
          <div className="top-full-list">
            {top.list.map((b, i) => (
              <button type="button" key={b.id} className="lbl toggle" onClick={() => { top.add(b.id); setPick(false) }}>
                <span className={'top-medal r' + (i + 1)}>{i + 1}</span> {b.title}
              </button>
            ))}
          </div>
        </>}
    </div>
  )
}

function Line({ children, className = '' }) {
  return (
    <div className="detail-mask">
      <div className={'detail-line-inner ' + className}>{children}</div>
    </div>
  )
}

/**
 * Fiche d'un livre : une feuille de papier qui grandit depuis la jaquette,
 * l'encre qui s'étale sur la couverture, chaque ligne de texte qui monte de son masque.
 * mode = 'edit' (livre de la bibliothèque) ou 'add' (résultat de recherche).
 */
export default function DetailSheet({ book, mode, originRect, open, onClosed, onSave, onRemove, onAdd, inLibrary, shelfOptions = [], defaultShelf = null, top = null, readingApi = null }) {
  const d = toDisplay(book)
  const [bg, ink] = spineColors(d)
  const sheetRef = useRef(null)
  const blobRefs = useRef([])
  const [shelfId, setShelfId] = useState(defaultShelf || shelfOptions[0]?.id || null)
  const [rating, setRating] = useState(d.rating || 0)
  const [reading, setReading] = useState(() => (d.statuses.includes('lu') ? 'lu' : d.statuses.includes('en_cours') ? 'en_cours' : null))
  const [stampKey, setStampKey] = useState(0)

  // « En cours » ou « Lu » : enregistré tout de suite (les autres statuts éventuels sont gardés)
  const setReadingState = async next => {
    const value = reading === next ? null : next
    setReading(value)
    if (value === 'lu') setStampKey(k => k + 1)
    // les dates de lecture suivent (début avec « En cours », fin avec « Lu » : le défi de l'année)
    if (readingApi && book.id) {
      const r = toggleState({ statuses: d.statuses }, next, readingApi.datesOf(book.id))
      if (r.dates) readingApi.setDates(book.id, r.dates)
      try { await onSave({ statuses: r.statuses }) } catch (e) { setFeedback('Erreur : ' + (e.message || e)) }
      return
    }
    const others = (d.statuses || []).filter(s => s !== 'lu' && s !== 'en_cours')
    try { await onSave({ statuses: value ? [value, ...others] : (others.length ? others : ['possede']) }) }
    catch (e) { setFeedback('Erreur : ' + (e.message || e)) }
  }
  const [notes, setNotes] = useState(d.notes)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [inkDone, setInkDone] = useState(false)
  const openedOnce = useRef(false)

  // Ouverture
  useEffect(() => {
    if (!open || openedOnce.current) return
    openedOnce.current = true
    const sheet = sheetRef.current
    const rect = originRect || { left: innerWidth / 2 - 120, top: innerHeight / 2 - 180, right: innerWidth / 2 + 120, bottom: innerHeight / 2 + 180 }
    sheet.style.transformOrigin = `${(rect.left + rect.right) / 2}px ${(rect.top + rect.bottom) / 2}px`
    const grow = sheet.animate(
      [{ clipPath: insetFrom(rect), transform: 'rotate(-4.5deg)' }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' }],
      { duration: 1050, easing: EASE_SHEET, fill: 'backwards' }
    )
    grow.onfinish = () => grow.cancel()
    sheet.querySelectorAll('.detail-line-inner').forEach((line, i) => {
      line.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0%)' }],
        { duration: 900, delay: 620 + i * 60, easing: EASE, fill: 'both' })
    })
    // Encre
    let raf = 0
    const start = performance.now()
    const run = now => {
      const t = now - start - 520
      let done = true
      BLOBS.forEach((b, i) => {
        const el = blobRefs.current[i]
        if (!el) return
        const lt = t - b.delay
        if (lt <= 0) { el.setAttribute('r', '0'); done = false }
        else if (lt >= 1250) el.setAttribute('r', '900')
        else { done = false; const p = lt / 1250; el.setAttribute('r', ((1 - Math.pow(1 - p, 3)) * 900).toFixed(1)) }
      })
      if (!done) raf = requestAnimationFrame(run)
      else setInkDone(true) // l'encre a tout couvert : on retire le masque filtré (coûteux)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [open, originRect])

  // Fermeture
  useEffect(() => {
    if (open || !openedOnce.current) return
    const sheet = sheetRef.current
    const rect = originRect || { left: innerWidth / 2 - 120, top: innerHeight / 2 - 180, right: innerWidth / 2 + 120, bottom: innerHeight / 2 + 180 }
    const a = sheet.animate(
      [{ clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' }, { clipPath: insetFrom(rect), transform: 'rotate(-4.5deg)' }],
      { duration: 850, easing: EASE_SHEET, fill: 'both' }
    )
    a.onfinish = () => onClosed?.()
  }, [open, originRect, onClosed])


  const handleSave = async () => {
    setBusy(true); setFeedback('')
    try {
      await onSave({ rating: rating > 0 ? rating : null, notes })
      setFeedback('Enregistré')
      setTimeout(() => setFeedback(''), 1800)
    } catch (e) { setFeedback('Erreur : ' + (e.message || e)) }
    finally { setBusy(false) }
  }

  const handleAdd = async () => {
    setBusy(true); setFeedback('')
    try { await onAdd(shelfId) }
    catch (e) { setFeedback('Erreur : ' + (e.message || e)); setBusy(false) }
  }

  const handleRemove = async () => {
    if (!confirmRemove) { setConfirmRemove(true); return }
    setBusy(true)
    try { await onRemove() } catch (e) { setFeedback('Erreur : ' + (e.message || e)); setBusy(false) }
  }

  const meta = [d.year, d.categories[0], d.pageCount ? `${d.pageCount} pages` : null].filter(Boolean).join(' / ')
  const longText = d.description.length > 520

  return (
    <div className="detail grain" ref={sheetRef} role="dialog" aria-modal="true">
      <div className="detail-top-logo"><div className="logo"><div className="logo-name">Maruchime</div><div className="logo-sub">Bibliothèque</div></div></div>
      <div className="detail-scroll">
        <div className="detail-grid">
          <div className="detail-left">
            <Line className="detail-subtitle">{d.authors.join(', ')}{mode === 'add' && inLibrary ? ' / Déjà dans la bibliothèque' : ''}</Line>
            <Line><h1 className="detail-title">{d.title}</h1></Line>
            {mode === 'edit' && reading === 'lu' && (
              <span className="read-stamp" key={stampKey} aria-label="Livre lu">
                <span className="rs-top">Lu</span><span className="rs-bot">Bibliothèque Maruchime</span>
              </span>
            )}
            {meta && <Line className="detail-meta">{meta}</Line>}
            <Line>
              <p className={'detail-synopsis' + (longText && !expanded ? ' clamped' : '')}>
                {d.description || 'Aucun résumé disponible pour ce livre.'}
              </p>
              {longText && (
                <button type="button" className="detail-more" onClick={() => setExpanded(v => !v)}>
                  {expanded ? 'Réduire' : 'Lire la suite'}
                </button>
              )}
            </Line>
            {d.isbn && <Line className="detail-credit">ISBN {d.isbn}</Line>}

            {mode === 'add' && !inLibrary && shelfOptions.length > 1 && (
              <Line>
                <div className="detail-field-label">Ranger sur l'étagère</div>
                <div className="toggle-row">
                  {shelfOptions.map(s => (
                    <button key={s.id} type="button" className={'lbl toggle' + (shelfId === s.id ? ' on' : '')} onClick={() => setShelfId(s.id)}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </Line>
            )}

            {mode === 'edit' && (
              <>
                <Line>
                  <div className="detail-field-label">Ma lecture</div>
                  <div className="toggle-row">
                    <button type="button" className={'lbl toggle reading-toggle' + (reading === 'en_cours' ? ' on' : '')} onClick={() => setReadingState('en_cours')}>
                      <span className="mini-mark" aria-hidden="true" /> En cours
                    </button>
                    <button type="button" className={'lbl toggle' + (reading === 'lu' ? ' on' : '')} onClick={() => setReadingState('lu')}>
                      ✓ Lu
                    </button>
                  </div>
                </Line>
                {top && (
                  <Line>
                    <div className="detail-field-label">Mon top {top.max}</div>
                    <TopControl top={top} />
                  </Line>
                )}
                <Line>
                  <div className="detail-field-label">Note</div>
                  <div className="stars" role="radiogroup" aria-label="Note sur cinq">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button key={v} type="button" className={'star' + (rating >= v ? ' on' : '')} onClick={() => setRating(rating === v ? 0 : v)} aria-label={`${v} sur 5`}>★</button>
                    ))}
                  </div>
                </Line>
                <Line>
                  <div className="detail-field-label">Mes notes</div>
                  <textarea className="notes-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Une impression, une citation, la page où tu t'es arrêtée…" rows={3} />
                </Line>
                <Line>
                  <div className="detail-actions">
                    <button type="button" className="lbl box cobalt" onClick={handleSave} disabled={busy}>Enregistrer</button>
                    <button type="button" className={'lbl box ' + (confirmRemove ? 'danger' : 'muted')} onClick={handleRemove} disabled={busy}>
                      {confirmRemove ? 'Confirmer le retrait ?' : 'Retirer'}
                    </button>
                    {feedback && <span className="detail-feedback">{feedback}</span>}
                  </div>
                </Line>
              </>
            )}

            {mode === 'add' && (
              <Line>
                <div className="detail-actions">
                  <button type="button" className="lbl box cobalt" onClick={handleAdd} disabled={busy}>
                    {inLibrary ? 'Mettre à jour' : 'Ajouter à la bibliothèque'}
                  </button>
                  {feedback && <span className="detail-feedback">{feedback}</span>}
                </div>
              </Line>
            )}
          </div>

          <div className="detail-right">
            <svg className="poster-svg" viewBox="0 0 600 900" aria-hidden="true">
              <defs>
                {!inkDone && <>
                <filter id="ink-filter" x="-50%" y="-50%" width="200%" height="200%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="7" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="120" xChannelSelector="R" yChannelSelector="G" />
                </filter>
                <mask id="ink-mask" maskUnits="userSpaceOnUse" x="-300" y="-300" width="1200" height="1500">
                  <rect x="-300" y="-300" width="1200" height="1500" fill="black" />
                  <g filter="url(#ink-filter)">
                    {BLOBS.map((b, i) => <circle key={i} ref={el => { blobRefs.current[i] = el }} cx={b.cx} cy={b.cy} r="0" fill="white" />)}
                  </g>
                </mask>
                </>}
                <clipPath id="poster-clip"><rect x="0" y="0" width="600" height="900" rx="3" /></clipPath>
                <linearGradient id="worn" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
                  <stop offset="0.08" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.92" stopColor="#000" stopOpacity="0" />
                  <stop offset="1" stopColor="#000" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <g clipPath="url(#poster-clip)" mask={inkDone ? undefined : 'url(#ink-mask)'}>
                <rect x="0" y="0" width="600" height="900" fill={bg} />
                {d.cover && !imgError ? (
                  <image href={d.cover} x="0" y="0" width="600" height="900" preserveAspectRatio="xMidYMid slice" onError={() => setImgError(true)} />
                ) : (
                  <g fill={ink} textAnchor="middle" fontFamily="Newsreader, Georgia, serif">
                    <text x="300" y="120" fontSize="20" letterSpacing="6" fontFamily="Inter Tight, sans-serif" fontWeight="600">BIBLIOTHÈQUE MARUCHIME</text>
                    {d.title.split(' ').reduce((lines, w) => { const l = lines[lines.length - 1]; if (l && (l + ' ' + w).length < 16) lines[lines.length - 1] = l + ' ' + w; else lines.push(w); return lines }, []).slice(0, 5).map((line, i) => (
                      <text key={i} x="300" y={380 + i * 70} fontSize="64" fontWeight="500">{line.toUpperCase()}</text>
                    ))}
                    <text x="300" y="800" fontSize="28" fontStyle="italic">{d.authors.join(', ')}</text>
                  </g>
                )}
                <rect x="0" y="0" width="600" height="900" fill="url(#worn)" opacity="0.18" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
