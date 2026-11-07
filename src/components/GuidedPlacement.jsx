import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestShelf } from '../lib/suggestShelf'
import { resolveSkin } from '../lib/skins'
import { relayUrl } from '../lib/covers'
import { spineColors } from '../lib/bookUtils'
import { useLayer } from '../lib/nav'

const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`

function Cover({ book }) {
  const [direct, setDirect] = useState(false)
  const src = (book.cover || '').replace('http://', 'https://')
  const color = spineColors({ google_id: book.googleId, title: book.title })[0]
  return (
    <span className="gp-cover-in" style={{ background: color }}>
      {src && (direct
        ? <img src={src} alt="" draggable="false" />
        : <img src={relayUrl(src)} alt="" crossOrigin="anonymous" draggable="false" onError={() => setDirect(true)} />)}
    </span>
  )
}

/**
 * Ranger les livres un à la fois : le livre sort de la pile « à ranger », on touche l'étagère
 * (une est suggérée), le mur va jusqu'à elle et le livre s'y envole. Puis le suivant.
 */
export default function GuidedPlacement({ items, shelves, books, onPlace, onPlaceRest, onClose }) {
  const real = useMemo(() => shelves.filter(s => !s.pseudo), [shelves])
  const byId = useMemo(() => new Map(books.map(b => [b.id, b])), [books])
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
  const [flying, setFlying] = useState(false)
  const [last, setLast] = useState(null)
  const [closing, setClosing] = useState(false)
  const [total] = useState(items.length)
  const coverRef = useRef(null)
  const idx = items.length ? Math.min(i, items.length - 1) : 0
  const book = items[idx] || null
  const sugg = useMemo(() => (book ? suggestShelf(book, real, byId, last) : null), [book, real, byId, last])
  const ordered = useMemo(() => {
    if (!sugg) return real
    const s = real.find(x => x.id === sugg.shelfId)
    return s ? [s, ...real.filter(x => x.id !== s.id)] : real
  }, [real, sugg])
  const done = total - items.length

  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 380) }
  const closeRef = useRef(close)
  closeRef.current = close
  // tout est rangé : petit moment de satisfaction, puis on referme
  useEffect(() => {
    if (items.length || busy) return
    const t = setTimeout(() => closeRef.current(), 1400)
    return () => clearTimeout(t)
  }, [items.length, busy])
  useLayer(true, '/mur/ranger', () => closeRef.current())

  const place = async shelfId => {
    if (busy || !book) return
    const el = coverRef.current
    const rect = el?.getBoundingClientRect()
    const src = el?.querySelector('img')?.src
    setBusy(true); setLast(shelfId); setFlying(true)
    try { await onPlace(book, shelfId, rect, src) } finally { setFlying(false); setBusy(false) }
  }
  const skip = () => { if (!busy && items.length > 1) setI(k => (k + 1) % items.length) }
  const rest = async () => {
    const target = sugg?.shelfId || last || real[0]?.id
    if (busy || !target) return
    setBusy(true)
    try { await onPlaceRest(target) } finally { setBusy(false) }
  }
  const restName = real.find(s => s.id === (sugg?.shelfId || last || real[0]?.id))?.name

  return (
    <div className={'gp grain' + (closing ? ' closing' : '')} role="dialog" aria-label="Ranger mes livres">
      <div className="gp-head">
        <span className="lbl gp-step">{book ? `Ranger mes livres · ${Math.min(done + 1, total)} / ${total}` : 'Ranger mes livres'}</span>
        <button type="button" className="lbl box" onClick={close}>Fermer</button>
      </div>

      {book ? (
        <>
          <div className="gp-book" key={book.googleId}>
            <span className={'gp-cover' + (flying ? ' away' : '')} ref={coverRef}><Cover book={book} /></span>
            <span className="gp-text">
              <span className="gp-title">{book.title}</span>
              <span className="gp-author">{(book.authors || []).join(', ')}</span>
              <span className="gp-q">Sur quelle étagère ?</span>
            </span>
          </div>

          <div className="gp-shelves" key={'s' + book.googleId}>
            {ordered.map((s, k) => {
              const pal = resolveSkin(s)
              const on = sugg?.shelfId === s.id
              return (
                <button
                  key={s.id} type="button" className={'gp-chip' + (on ? ' sugg' : '')} disabled={busy}
                  style={{ '--wood': pal.mat.mid, '--wall': pal.wall2, animationDelay: `${60 + k * 40}ms` }}
                  onClick={() => place(s.id)}
                >
                  {on && <span className="gp-why">Suggérée · {sugg.reason}</span>}
                  <span className="gp-swatch" aria-hidden="true" />
                  <span className="gp-name">{s.name}</span>
                  <span className="gp-count">{s.book_ids.length}</span>
                </button>
              )
            })}
          </div>

          <div className="gp-foot">
            {items.length > 1 && <button type="button" className="lbl box muted" disabled={busy} onClick={skip}>Plus tard</button>}
            {items.length > 1 && restName && (
              <button type="button" className="lbl box" disabled={busy} onClick={rest}>Les {items.length} sur « {restName} »</button>
            )}
          </div>
        </>
      ) : (
        <p className="gp-done"><span className="gp-tick" aria-hidden="true">✓</span> {total > 1 ? `Tes ${plural(total, 'livre')} sont rangés.` : 'Ton livre est rangé.'}</p>
      )}
    </div>
  )
}
