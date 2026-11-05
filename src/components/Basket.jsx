import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { spineColors, hashString } from '../lib/bookUtils'
import { webglAvailable } from '../three/webgl'
import { basketScale, MAX_BASKET } from '../lib/basketSize'
import { suggestShelf } from '../lib/suggestShelf'
import { resolveSkin } from '../lib/skins'

// Le panier 3D (Three.js) est chargé à part, comme la bibliothèque
const Basket3D = lazy(() => import('./Basket3D'))

const HAS_WEBGL = typeof window !== 'undefined' && webglAvailable()

const colorOf = b => spineColors({ google_id: b.googleId, title: b.title })[0]

/**
 * Un vrai panier en osier, en grand. Les livres sont debout dedans, un peu de travers,
 * le bas caché par la vannerie. Au survol un livre sort un peu ; on peut le toucher (fiche),
 * le retirer (×) ou, à côté de la bibliothèque, l'attraper pour le poser sur une étagère.
 */
export function BigBasket({ items, width = 280, bump, onBookDown, onBookClick, onRemove, dragging }) {
  const ref = useRef(null)
  const W = width
  const H = Math.round(W * 0.95)
  const rimY = W * 0.475

  useEffect(() => {
    if (!bump || !ref.current) return
    ref.current.animate([
      { transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-2.5deg) scale(1.03, 0.97)', offset: 0.25 },
      { transform: 'rotate(2deg) scale(0.99, 1.02)', offset: 0.55 }, { transform: 'rotate(0) scale(1)' },
    ], { duration: 560, easing: 'cubic-bezier(.3, 1.3, .5, 1)' })
  }, [bump])

  // Place de chaque livre dans l'ouverture du panier (deux rangs quand il se remplit)
  const placed = useMemo(() => {
    const n = items.length
    const bw = W * 0.19, bh = bw * 1.48
    const left = W * 0.13, inner = W * 0.74
    const rows = n > 7 ? [items.slice(0, Math.ceil(n / 2)), items.slice(Math.ceil(n / 2))] : [[], items]
    const out = []
    rows.forEach((row, ri) => {
      const k = row.length
      if (!k) return
      const step = k > 1 ? Math.min(bw * 0.82, (inner - bw) / (k - 1)) : 0
      const span = step * (k - 1) + bw
      const x0 = left + (inner - span) / 2
      row.forEach((b, i) => {
        const h = hashString(b.googleId)
        const rot = ((h % 17) - 8) * 1.1
        const lift = (h >> 5) % 9
        const back = ri === 0 && rows[0].length
        out.push({
          b, rot,
          x: x0 + i * step,
          y: rimY + bh * 0.42 - bh - lift - (back ? W * 0.07 : 0),
          w: bw * (back ? 0.92 : 1), h: bh * (back ? 0.92 : 1),
          z: back ? 1 : 2,
        })
      })
    })
    return out
  }, [items, W, rimY])

  return (
    <div className="big-basket" ref={ref} style={{ width: W, height: H }}>
      {/* arrière : anse et fond du panier */}
      <svg className="bb-back" viewBox="0 0 100 95" width={W} height={H} aria-hidden="true">
        <path d="M15 48 C 15 2, 85 2, 85 48" fill="none" stroke="#8A5E31" strokeWidth="5.2" strokeLinecap="round" />
        <path d="M15 48 C 15 2, 85 2, 85 48" fill="none" stroke="#C48A45" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="3 2.2" />
        <ellipse cx="50" cy="48.5" rx="41" ry="7.5" fill="#5E3E1F" />
        <ellipse cx="50" cy="49.5" rx="37" ry="5.5" fill="#3E2914" />
      </svg>
      <span className="bb-target" style={{ left: W * 0.3, top: rimY - W * 0.1, width: W * 0.4, height: W * 0.12 }} />

      {/* les livres, debout dans le panier */}
      {placed.map(({ b, x, y, w, h, rot, z }) => (
        <div
          key={b.googleId}
          className={'bb-book' + (dragging === b.googleId ? ' out' : '')}
          style={{ left: x, top: y, width: w, height: h, zIndex: z, '--rot': `${rot}deg`, background: colorOf(b) }}
          onPointerDown={onBookDown ? e => onBookDown(e, b) : undefined}
          onClick={!onBookDown && onBookClick ? () => onBookClick(b) : undefined}
          title={b.title}
        >
          {b.cover ? <img src={b.cover} alt="" draggable="false" /> : <span className="bb-book-title">{b.title}</span>}
          {onRemove && (
            <button type="button" className="bb-remove" aria-label={`Retirer ${b.title} du panier`}
              onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRemove(b.googleId) }}>×</button>
          )}
        </div>
      ))}

      {/* avant : vannerie, bord tressé, étiquette */}
      <svg className="bb-front" viewBox="0 0 100 95" width={W} height={H} aria-hidden="true">
        <defs>
          <pattern id="bb-weave" width="8" height="6" patternUnits="userSpaceOnUse">
            <rect width="8" height="6" fill="#D9A866" />
            <path d="M0 1.5 Q2 0 4 1.5 T8 1.5" fill="none" stroke="#B9844A" strokeWidth="1.1" />
            <path d="M0 4.5 Q2 6 4 4.5 T8 4.5" fill="none" stroke="#E7BF83" strokeWidth="1.1" />
          </pattern>
          <linearGradient id="bb-shade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity="0.22" />
            <stop offset="0.25" stopColor="#000" stopOpacity="0" />
            <stop offset="0.75" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        <path d="M9 49 Q50 60 91 49 L83.5 89 Q82.5 93.5 78 93.5 H22 Q17.5 93.5 16.5 89 Z" fill="url(#bb-weave)" stroke="#8A5E31" strokeWidth="0.9" />
        <path d="M9 49 Q50 60 91 49 L83.5 89 Q82.5 93.5 78 93.5 H22 Q17.5 93.5 16.5 89 Z" fill="url(#bb-shade)" />
        {[22, 32, 42, 50, 58, 68, 78].map(x => <path key={x} d={`M${x} ${x < 50 ? 55 + (50 - x) * 0.12 : 55 + (x - 50) * 0.12} L${x + (x - 50) * -0.12} 92`} stroke="#A8743C" strokeWidth="0.8" opacity="0.6" />)}
        <path d="M7.5 47.5 Q50 59 92.5 47.5 L92.5 52 Q50 63.5 7.5 52 Z" fill="#B57A3D" stroke="#8A5E31" strokeWidth="0.8" />
        <path d="M7.5 49.8 Q50 61.3 92.5 49.8" fill="none" stroke="#E2B272" strokeWidth="0.9" strokeDasharray="2.4 1.6" />
        <path d="M12 89 Q50 97 88 89" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="2.5" />
      </svg>
      <div className="bb-tag" style={{ left: W * 0.38, top: rimY + W * 0.13 }}>
        {items.length ? `${items.length} livre${items.length > 1 ? 's' : ''}` : 'vide'}
      </div>
    </div>
  )
}

/** Le panier en 3D si possible, sinon le panier dessiné. */
function AnyBasket({ width, ...props }) {
  if (HAS_WEBGL) {
    const height = Math.round(width * 0.95)
    return (
      <Suspense fallback={<div style={{ width, height }} />}>
        <Basket3D width={width} height={height} {...props} />
      </Suspense>
    )
  }
  return <BigBasket width={Math.round(width * (1 + (basketScale(props.items.length) - 1) * 0.85))} {...props} onBookDown={props.onBookDown ? (e, b) => props.onBookDown(e, b, e.currentTarget.getBoundingClientRect()) : undefined} />
}

/** Le panier dans la recherche, posé à côté des résultats. */
export function SearchBasket({ items, bump, onBookClick, onRemove, onDone, mobile, apiRef }) {
  const full = items.length >= MAX_BASKET
  return (
    <div className="sb">
      <div className="sb-title">Mon panier</div>
      <AnyBasket items={items} width={mobile ? 210 : 360} bump={bump} onBookClick={onBookClick} onRemove={mobile ? null : onRemove} apiRef={apiRef} />
      <div className="sb-side">
        {full
          ? <p className="sb-hint">Ton panier est plein ({MAX_BASKET} livres) : va les ranger sur tes étagères.</p>
          : items.length
          ? <p className="sb-hint">Continue tes trouvailles, puis va les ranger sur tes étagères.</p>
          : <p className="sb-hint">Appuie sur <b>+</b>, ou glisse un livre jusqu'ici pour le mettre dans le panier.</p>}
        {items.length > 0 && (
          <button type="button" className="lbl box cobalt sb-go" onClick={onDone}>
            {items.length > 1 ? `Ranger mes ${items.length} livres` : 'Ranger mon livre'} →
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Le panier posé à côté de la bibliothèque : on attrape un livre et on le pose sur une étagère
 * (un emplacement s'ouvre dans la rangée), ou on range tout d'un coup.
 */
export function ShelfBasket({ items, shelves, defaultShelf, canDrop, api, mobile, onDropBook, onPlaceAll, onOpenBook, onRemove, onClear, onGuide }) {
  const [target, setTarget] = useState(defaultShelf || shelves[0]?.id || '')
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(null)

  useEffect(() => { if (!shelves.some(s => s.id === target)) setTarget(shelves[0]?.id || '') }, [shelves, target])

  const startPress = (e, book, rect) => {
    if (e.button > 0) return
    const el = e.currentTarget || e.target
    const start = { x: e.clientX, y: e.clientY }
    const rc = rect || el.getBoundingClientRect()
    const fx = (e.clientX - rc.left) / rc.width, fy = (e.clientY - rc.top) / rc.height
    const id = `basket:${book.googleId}`
    let ghost = null

    const begin = () => {
      ghost = document.createElement('div')
      ghost.className = 'bb-ghost'
      ghost.style.cssText = `width:${rc.width}px;height:${rc.height}px;background:${colorOf(book)}`
      if (book.cover) { const img = new Image(); img.src = book.cover; img.alt = ''; ghost.appendChild(img) }
      document.body.appendChild(ghost)
      document.body.classList.add('is-dragging')
      setDragging(book.googleId)
      navigator.vibrate?.(8)
    }
    const onMove = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6 && canDrop) begin()
        if (!ghost) return
      }
      ev.preventDefault()
      ghost.style.transform = `translate(${ev.clientX - fx * rc.width}px, ${ev.clientY - fy * rc.height}px) scale(1.1)`
      const over = api.current?.previewExternal(id, ev.clientX, ev.clientY)
      ghost.classList.toggle('on-shelf', !!over)
    }
    const end = ev => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      if (!ghost) {
        if (ev.type === 'pointerup') onOpenBook(book)
        return
      }
      const t = api.current?.endExternal() || null
      document.body.classList.remove('is-dragging')
      setDragging(null)
      if (t && ev.type === 'pointerup') {
        ghost.animate([{ opacity: 1 }, { opacity: 0, transform: ghost.style.transform.replace('scale(1.1)', 'scale(0.55)') }], { duration: 240, easing: 'ease-in' }).onfinish = () => ghost.remove()
        onDropBook(book, t)
      } else {
        // pas d'étagère sous le doigt : le livre retombe dans le panier
        ghost.animate([{ transform: ghost.style.transform }, { transform: `translate(${rc.left}px, ${rc.top}px) scale(1)` }], { duration: 420, easing: 'cubic-bezier(.3, 1.25, .5, 1)' }).onfinish = () => ghost.remove()
      }
    }
    el.setPointerCapture(e.pointerId)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  const placeAll = async () => {
    if (!items.length || busy) return
    setBusy(true)
    try { await onPlaceAll(target || null) } finally { setBusy(false) }
  }

  return (
    <aside className="shelf-basket" aria-label="Mon panier">
      <p className="sh-hint">{canDrop ? 'Attrape un livre et pose-le sur une étagère' : 'Range-les tous d’un coup'}</p>
      <AnyBasket
        items={items} width={mobile ? 160 : 320} dragging={dragging}
        onBookDown={startPress} onRemove={mobile ? null : onRemove}
      />
      <div className="sh-controls">
        {onGuide && shelves.length > 0 && (
          <button type="button" className="lbl box filled sh-guide" onClick={onGuide}>Ranger un par un →</button>
        )}
        {shelves.length > 0 && (
          <select className="sh-select" value={target} onChange={e => setTarget(e.target.value)} aria-label="Étagère où tout ranger">
            {shelves.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <button type="button" className="lbl box cobalt" onClick={placeAll} disabled={busy}>{busy ? 'Rangement…' : 'Tout ranger'}</button>
        <button type="button" className={'lbl box ' + (confirmClear ? 'danger' : 'muted')}
          onClick={() => { if (!confirmClear) { setConfirmClear(true); return } onClear(); setConfirmClear(false) }}>
          {confirmClear ? 'Vraiment ?' : 'Vider'}
        </button>
      </div>
    </aside>
  )
}

/**
 * Le panier sous la bibliothèque. On le touche : les livres en sortent et se posent en rang
 * en bas de l'écran. On glisse un livre sur une étagère (une place s'ouvre), ou on touche son
 * « + » pour choisir l'étagère (la plus probable en premier).
 */
export function BasketTray({ items, shelves, books, api, mobile, canDrop, open, onOpen, onClose, onDropBook, onPlace, onOpenBook, bare = false }) {
  const real = useMemo(() => shelves.filter(s => !s.pseudo), [shelves])
  const byId = useMemo(() => new Map(books.map(b => [b.id, b])), [books])
  const [picker, setPicker] = useState(null)        // livre dont on choisit l'étagère
  const [dragging, setDragging] = useState(null)
  const [busy, setBusy] = useState(null)
  const [last, setLast] = useState(null)
  const coverEls = useRef({})
  const n = items.length

  useEffect(() => { if (picker && !items.some(b => b.googleId === picker.googleId)) setPicker(null) }, [items, picker])
  useEffect(() => { if (!open) setPicker(null) }, [open])

  const startPress = (e, book) => {
    if (e.button > 0 || busy) return
    const el = e.currentTarget
    const rc = el.getBoundingClientRect()
    const start = { x: e.clientX, y: e.clientY }
    const fx = (e.clientX - rc.left) / rc.width, fy = (e.clientY - rc.top) / rc.height
    const touch = e.pointerType !== 'mouse'
    const id = `basket:${book.googleId}`
    let ghost = null, timer = null, dead = false
    const src = el.querySelector('img')?.src
    // le rang défile à la main (le navigateur ne doit pas voler le geste quand on monte en biais)
    const rowEl = el.closest('.tray-row'), scroll0 = rowEl?.scrollLeft || 0

    const begin = () => {
      if (ghost || dead || !canDrop) return
      ghost = document.createElement('div')
      ghost.className = 'bb-ghost'
      ghost.style.cssText = `width:${rc.width}px;height:${rc.height}px;background:${colorOf(book)}`
      if (src) { const img = new Image(); img.src = src; img.alt = ''; ghost.appendChild(img) }
      ghost.style.transform = `translate(${rc.left}px, ${rc.top}px) scale(1.08)`
      document.body.appendChild(ghost)
      document.body.classList.add('is-dragging')
      setDragging(book.googleId)
      setPicker(null)
      navigator.vibrate?.(8)
    }
    const onMove = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y
      if (dead) { if (rowEl) rowEl.scrollLeft = scroll0 - dx; return }
      if (!ghost) {
        if (Math.hypot(dx, dy) < 7) return
        // doigt : vers le haut (même en biais) on prend le livre ; sur le côté on fait défiler le rang
        if (!touch || (dy < 0 && Math.abs(dy) > Math.abs(dx) * 0.5)) begin()
        else { dead = true; clearTimeout(timer); return }
        if (!ghost) return
      }
      ev.preventDefault()
      ghost.style.transform = `translate(${ev.clientX - fx * rc.width}px, ${ev.clientY - fy * rc.height}px) scale(1.12) rotate(-3deg)`
      const over = api.current?.previewExternal(id, ev.clientX, ev.clientY)
      ghost.classList.toggle('on-shelf', !!over)
    }
    const end = ev => {
      clearTimeout(timer)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      if (!ghost) {
        if (ev.type === 'pointerup' && !dead && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 7) onOpenBook(book)
        return
      }
      const t = api.current?.endExternal() || null
      document.body.classList.remove('is-dragging')
      setDragging(null)
      const g = ghost
      if (t && ev.type === 'pointerup') {
        g.animate([{ opacity: 1 }, { opacity: 0, transform: g.style.transform.replace(/scale\([^)]*\)/, 'scale(0.5)') }], { duration: 260, easing: 'ease-in' }).onfinish = () => g.remove()
        setLast(t.shelfId)
        onDropBook(book, t)
      } else {
        // pas d'étagère sous le doigt : le livre revient à sa place dans la rangée
        g.animate([{ transform: g.style.transform }, { transform: `translate(${rc.left}px, ${rc.top}px) scale(1)` }], { duration: 420, easing: 'cubic-bezier(.3, 1.25, .5, 1)' }).onfinish = () => g.remove()
      }
    }
    if (touch) timer = setTimeout(begin, 380)     // appui long : on le prend aussi
    el.setPointerCapture(e.pointerId)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  const choose = async (book, shelfId) => {
    const el = coverEls.current[book.googleId]
    setPicker(null); setBusy(book.googleId); setLast(shelfId)
    try { await onPlace(book, shelfId, el?.getBoundingClientRect(), el?.querySelector('img')?.src) } finally { setBusy(null) }
  }

  const sugg = picker ? suggestShelf(picker, real, byId, last) : null
  const ordered = sugg ? [real.find(s => s.id === sugg.shelfId), ...real.filter(s => s.id !== sugg.shelfId)].filter(Boolean) : real

  const tray = (
        <div className="tray grain" role="dialog" aria-label="Livres à ranger">
          <div className="tray-head">
            <p className="tray-hint">{canDrop ? 'Glisse un livre sur une étagère, ou touche +' : 'Touche + pour choisir l’étagère'}</p>
            <button type="button" className="lbl box" onClick={onClose}>Remettre au panier</button>
          </div>
          <div className="tray-row">
            {items.map((b, k) => (
              <div key={b.googleId} className={'tray-book' + (dragging === b.googleId || busy === b.googleId ? ' away' : '')} style={{ animationDelay: `${80 + k * 70}ms` }}>
                <span className="tray-cover" ref={el => { coverEls.current[b.googleId] = el }} style={{ background: colorOf(b) }} onPointerDown={e => startPress(e, b)} onDragStart={e => e.preventDefault()}>
                  {b.cover && <img src={b.cover.replace('http://', 'https://')} alt="" draggable="false" />}
                </span>
                <button type="button" className={'tray-plus' + (picker?.googleId === b.googleId ? ' on' : '')} aria-label={`Choisir l’étagère de ${b.title}`} onClick={() => setPicker(p => (p?.googleId === b.googleId ? null : b))}>+</button>
                <span className="tray-title">{b.title}</span>
              </div>
            ))}
          </div>
          {picker && (
            <div className="tray-picker" key={picker.googleId}>
              <p className="tray-q"><em>{picker.title}</em> · sur quelle étagère ?</p>
              <div className="gp-shelves">
                {ordered.map((s, k) => {
                  const pal = resolveSkin(s)
                  const on = sugg?.shelfId === s.id
                  return (
                    <button key={s.id} type="button" className={'gp-chip' + (on ? ' sugg' : '')} style={{ '--wood': pal.mat.mid, '--wall': pal.wall2, animationDelay: `${40 + k * 35}ms` }} onClick={() => choose(picker, s.id)}>
                      {on && <span className="gp-why">Suggérée · {sugg.reason}</span>}
                      <span className="gp-swatch" aria-hidden="true" />
                      <span className="gp-name">{s.name}</span>
                      <span className="gp-count">{s.book_ids.length}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
  )
  // téléphone : pas de panier sous le mur (l'onglet « Panier » ouvre directement la rangée)
  if (bare) return open ? tray : null

  return (
    <aside className={'tray-bar' + (open ? ' is-open' : '')} aria-label="Mon panier">
      <div className="tray-basket" onClick={() => !open && onOpen()} role="button" tabIndex={0} aria-label="Sortir les livres du panier">
        <AnyBasket items={items} width={mobile ? 104 : 190} onBookClick={() => !open && onOpen()} />
      </div>
      <div className="tray-side">
        <p className="tray-count">{n > 1 ? `${n} livres à ranger` : '1 livre à ranger'}</p>
        {/* toujours là (invisible une fois ouvert) : la place du panier ne change pas, le mur ne bouge pas */}
        <button type="button" className="lbl box filled tray-out" style={open ? { visibility: 'hidden' } : undefined} onClick={onOpen}>Sortir les livres</button>
      </div>

      {open && tray}
    </aside>
  )
}
