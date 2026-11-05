import { useEffect, useMemo, useRef, useState } from 'react'
import { spineColors } from '../lib/bookUtils'
import { MAX_BASKET } from '../lib/basketSize'
import { suggestShelf } from '../lib/suggestShelf'
import { resolveSkin } from '../lib/skins'

const colorOf = b => spineColors({ google_id: b.googleId, title: b.title })[0]

/**
 * Les livres à ranger : une petite pile de couvertures (plus de panier en 3D). Les livres
 * choisis s'y envolent ; on les range ensuite un par un sur les étagères.
 */
function AnyBasket({ items, width = 200, onBookClick }) {
  const shown = items.slice(-6)
  const n = items.length
  return (
    <div className={'pend bb-target' + (n ? '' : ' empty')} style={{ '--w': `${width}px` }} onClick={() => n && onBookClick?.(items[n - 1])}>
      <div className="pend-stack">
        {shown.map((b, i) => (
          <span key={b.googleId} className="pend-cover" style={{ background: colorOf(b), '--i': i, '--n': shown.length }}>
            {b.cover && <img src={b.cover.replace('http://', 'https://')} alt="" draggable="false" />}
          </span>
        ))}
        {!n && <span className="pend-ghost" aria-hidden="true" />}
      </div>
      <span className="pend-count">{n ? `${n} livre${n > 1 ? 's' : ''} à ranger` : 'Rien à ranger'}</span>
    </div>
  )
}

/** Les livres choisis dans la Boutique, posés à côté des résultats. */
export function SearchBasket({ items, onBookClick, onDone, mobile }) {
  const full = items.length >= MAX_BASKET
  return (
    <div className="sb">
      <div className="sb-title">À ranger</div>
      <AnyBasket items={items} width={mobile ? 210 : 300} onBookClick={onBookClick} />
      <div className="sb-side">
        {full
          ? <p className="sb-hint">Déjà {MAX_BASKET} livres à ranger : va les poser sur tes étagères.</p>
          : items.length
          ? <p className="sb-hint">Continue tes trouvailles, puis va les ranger sur tes étagères.</p>
          : <p className="sb-hint">Appuie sur <b>+</b>, ou glisse un livre jusqu'ici : il t’attendra pour être rangé.</p>}
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
 * Les livres à ranger, sous la bibliothèque. On les sort : ils se posent en rang
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
            <button type="button" className="lbl box" onClick={onClose}>Plus tard</button>
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
  // téléphone : rien sous le mur (l'onglet « À ranger » ouvre directement la rangée)
  if (bare) return open ? tray : null

  return (
    <aside className={'tray-bar' + (open ? ' is-open' : '')} aria-label="Livres à ranger">
      <div className="tray-basket" onClick={() => !open && onOpen()} role="button" tabIndex={0} aria-label="Ranger mes livres">
        <AnyBasket items={items} width={mobile ? 104 : 170} onBookClick={() => !open && onOpen()} />
      </div>
      <div className="tray-side">
        <p className="tray-count">{n > 1 ? `${n} livres à ranger` : '1 livre à ranger'}</p>
        {/* toujours là (invisible une fois ouvert) : la place du panier ne change pas, le mur ne bouge pas */}
        <button type="button" className="lbl box filled tray-out" style={open ? { visibility: 'hidden' } : undefined} onClick={onOpen}>Les ranger</button>
      </div>

      {open && tray}
    </aside>
  )
}
