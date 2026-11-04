import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { spineColors } from '../lib/bookUtils'

/** Petit panier en osier ; les livres qu'il contient dépassent du bord. */
export function BasketIcon({ items, size = 46 }) {
  const peek = items.slice(-3)
  const xs = [15.5, 21.5, 27.5]
  return (
    <svg className="basket-svg" width={size} height={size * 44 / 48} viewBox="0 0 48 44" aria-hidden="true">
      <path d="M11.5 19 C 11.5 3.5, 36.5 3.5, 36.5 19" fill="none" stroke="#8A6235" strokeWidth="2.6" strokeLinecap="round" />
      {peek.map((b, i) => {
        const [bg] = spineColors({ google_id: b.googleId, title: b.title })
        const h = [11, 13, 9.5][i]
        return <rect key={b.googleId} className="basket-book" x={xs[i]} y={20 - h} width="5.2" height={h + 4} rx="0.8" fill={bg} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
      })}
      <path d="M6 19.5 H42 L38.2 37.6 Q37.7 40 35.4 40 H12.6 Q10.3 40 9.8 37.6 Z" fill="#D9A866" stroke="#8A6235" strokeWidth="1.4" />
      <path d="M8 26 H40 M9.2 32 H38.8" stroke="#A97A42" strokeWidth="1.2" />
      {[12, 17, 22, 27, 32, 37].map(x => <path key={x} d={`M${x} 21.5 V38.5`} stroke="#B98950" strokeWidth="0.9" strokeDasharray="2.2 2.2" />)}
      <rect x="4.5" y="17" width="39" height="4.2" rx="2.1" fill="#C48A45" stroke="#8A6235" strokeWidth="1.2" />
    </svg>
  )
}

/** Bouton du panier, en haut à droite (visible aussi par-dessus la recherche). */
export function BasketButton({ items, onClick, bump }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!bump || !ref.current) return
    ref.current.animate([
      { transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.18, 0.86) rotate(-6deg)', offset: 0.25 },
      { transform: 'scale(0.94, 1.08) rotate(5deg)', offset: 0.55 }, { transform: 'scale(1) rotate(0)' },
    ], { duration: 520, easing: 'cubic-bezier(.3, 1.4, .5, 1)' })
  }, [bump])
  return (
    <button type="button" className={'basket-fab' + (items.length ? ' full' : '')} onClick={onClick} aria-label={`Mon panier, ${items.length} livre${items.length > 1 ? 's' : ''}`}>
      <span className="basket-wrap" ref={ref}><BasketIcon items={items} /></span>
      {items.length > 0 && <span className="basket-badge" key={items.length}>{items.length}</span>}
    </button>
  )
}

/**
 * Le panier ouvert, en bas de l'écran : on glisse chaque livre sur l'étagère voulue
 * (un emplacement s'ouvre dans la rangée), ou on range tout d'un coup.
 */
export function BasketTray({ items, shelves, defaultShelf, canDrop, api, onDropBook, onPlaceAll, onOpenBook, onRemove, onClear, onClose }) {
  const [target, setTarget] = useState(defaultShelf || shelves[0]?.id || '')
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(null)
  const ref = useRef(null)

  useEffect(() => { if (!shelves.some(s => s.id === target)) setTarget(shelves[0]?.id || '') }, [shelves, target])

  // Le tiroir réserve sa place : la bibliothèque se réduit au-dessus de lui au lieu d'être cachée
  useLayoutEffect(() => {
    const el = ref.current
    const root = document.documentElement
    const set = () => root.style.setProperty('--tray-h', `${Math.ceil(el.offsetHeight)}px`)
    set()
    document.body.classList.add('tray-open')
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => { ro.disconnect(); document.body.classList.remove('tray-open'); root.style.removeProperty('--tray-h') }
  }, [])

  // Glisser un livre du panier vers l'étagère
  const startPress = (e, book) => {
    if (e.button > 0) return
    const item = e.currentTarget
    const start = { x: e.clientX, y: e.clientY }
    let ghost = null, over = null, moved = false
    const cover = item.querySelector('.bt-cover')
    const rc = cover.getBoundingClientRect()
    const fx = (e.clientX - rc.left) / rc.width, fy = (e.clientY - rc.top) / rc.height
    const id = `basket:${book.googleId}`

    const begin = () => {
      ghost = cover.cloneNode(true)
      ghost.className = 'bt-cover bt-ghost'
      ghost.style.width = rc.width + 'px'; ghost.style.height = rc.height + 'px'
      document.body.appendChild(ghost)
      document.body.classList.add('is-dragging')
      setDragging(book.googleId)
      navigator.vibrate?.(8)
    }
    const place = (x, y) => {
      ghost.style.transform = `translate(${x - fx * rc.width}px, ${y - fy * rc.height}px) scale(1.12)`
    }
    const onMove = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y
      if (!ghost) {
        // vers le haut = on attrape le livre ; de côté = on fait défiler le panier
        if (dy < -8 && Math.abs(dy) > Math.abs(dx) * 0.8 && canDrop) begin()
        else if (Math.hypot(dx, dy) > 10) moved = true
        if (!ghost) return
      }
      ev.preventDefault()
      place(ev.clientX, ev.clientY)
      over = api.current?.previewExternal(id, ev.clientX, ev.clientY) || null
      ghost.classList.toggle('on-shelf', !!over)
    }
    const end = async ev => {
      item.removeEventListener('pointermove', onMove)
      item.removeEventListener('pointerup', end)
      item.removeEventListener('pointercancel', end)
      if (!ghost) {
        if (!moved && ev.type === 'pointerup') onOpenBook(book)
        return
      }
      const t = api.current?.endExternal() || null
      document.body.classList.remove('is-dragging')
      setDragging(null)
      if (t && ev.type === 'pointerup') {
        ghost.animate([{ opacity: 1 }, { opacity: 0, transform: ghost.style.transform.replace('scale(1.12)', 'scale(0.6)') }], { duration: 260, easing: 'ease-in' }).onfinish = () => ghost.remove()
        onDropBook(book, t)
      } else {
        const back = item.querySelector('.bt-cover').getBoundingClientRect()
        ghost.animate([{ transform: ghost.style.transform }, { transform: `translate(${back.left}px, ${back.top}px) scale(1)` }], { duration: 380, easing: 'cubic-bezier(.3, 1.2, .5, 1)' }).onfinish = () => ghost.remove()
      }
    }
    item.setPointerCapture(e.pointerId)
    item.addEventListener('pointermove', onMove)
    item.addEventListener('pointerup', end)
    item.addEventListener('pointercancel', end)
  }

  const placeAll = async () => {
    if (!items.length || busy) return
    setBusy(true)
    try { await onPlaceAll(target || null) } finally { setBusy(false) }
  }

  return (
    <div className="basket-tray grain" ref={ref} role="dialog" aria-label="Mon panier">
      <div className="bt-head">
        <BasketIcon items={items} size={34} />
        <div className="bt-title">Mon panier <span>{items.length} {items.length > 1 ? 'livres' : 'livre'}</span></div>
        <div className="bt-head-actions">
          {items.length > 0 && (
            <button type="button" className={'lbl box ' + (confirmClear ? 'danger' : 'muted')}
              onClick={() => { if (!confirmClear) { setConfirmClear(true); return } onClear(); setConfirmClear(false) }}>
              {confirmClear ? 'Vraiment vider ?' : 'Vider'}
            </button>
          )}
          <button type="button" className="lbl box" onClick={onClose}>Fermer</button>
        </div>
      </div>

      {items.length ? (
        <>
          <p className="bt-hint">
            {canDrop ? 'Attrape un livre et pose-le sur l’étagère de ton choix.' : 'Choisis « Mon rangement » pour poser les livres où tu veux, ou range-les tous d’un coup.'}
          </p>
          <div className="bt-items">
            {items.map(b => (
              <div key={b.googleId} className={'bt-item' + (dragging === b.googleId ? ' lifted' : '')} onPointerDown={e => startPress(e, b)} title={b.title}>
                <div className="bt-cover" style={{ background: spineColors({ google_id: b.googleId, title: b.title })[0] }}>
                  {b.cover && <img src={b.cover} alt="" draggable="false" />}
                </div>
                <div className="bt-name">{b.title}</div>
                <button type="button" className="bt-remove" aria-label={`Retirer ${b.title} du panier`}
                  onPointerDown={e => e.stopPropagation()} onClick={() => onRemove(b.googleId)}>×</button>
              </div>
            ))}
          </div>
          <div className="bt-foot">
            {shelves.length > 0 && (
              <label className="lbl bt-select">
                <span>Tout ranger sur</span>
                <select value={target} onChange={e => setTarget(e.target.value)}>
                  {shelves.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <button type="button" className="lbl box cobalt" onClick={placeAll} disabled={busy}>
              {busy ? 'Rangement…' : shelves.length ? 'Ranger tout' : 'Tout ajouter à la bibliothèque'}
            </button>
          </div>
        </>
      ) : (
        <p className="bt-empty">Ton panier est vide. Dans la recherche, appuie sur « + » pour y mettre des livres.</p>
      )}
    </div>
  )
}
