import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { spineColors, authorInitials, toRoman, titleKey, authorKey, toDisplay } from '../lib/bookUtils'
import { cursor } from '../lib/cursorState'
import { resolveSkin, skinVars, DEFAULT_SKIN } from '../lib/skins'
import {
  PH, NEWSHELF, effectiveShelves, previewDrag, moveBook, createShelf,
  renameShelf, setShelfSkin, applySkinToAll, moveShelf, deleteShelf, adoptLoose,
} from '../lib/shelfOps'
import Caption from './Caption'
import ShelfEditor from './ShelfEditor'

const PLANK = 16       // épaisseur de la planche (px)
const ROOM = 34        // espace libre au-dessus des livres (px)
const CHAR = 0.74      // largeur moyenne d'une capitale Newsreader (em)
const TOP = 30         // marge haute réservée à la couronne du meuble (px)
const CLOSE_MS = 640   // durée de fermeture des portes (doit suivre le CSS)
const STAGGER = 80     // décalage entre rayons (ms)
const SPRING = 'cubic-bezier(.3, 1.25, .45, 1)'
const PH_BOOK = { id: PH, placeholder: true }

let lastDragEnd = 0    // pour ne pas ouvrir la fiche juste après avoir lâché un livre

/** Géométrie : nombre de rayons visibles, taille des livres, livres par rayon. */
function computeLayout(w, h, mobile) {
  const minRow = mobile ? 168 : 236
  const rows = Math.max(1, Math.min(4, Math.floor(h / minRow)))
  const rowH = Math.floor(h / rows)
  const H = Math.round(Math.max(96, Math.min(mobile ? 150 : 236, rowH - PLANK - ROOM)))
  const ws = Math.max(22, Math.round(H * 0.17))
  const gap = Math.max(3, Math.round(H * 0.025))
  const D = Math.round(H * 0.62)
  const padX = mobile ? 14 : 26
  const P = 1e7 // vue de face : étagère et livres bien droits (pas de fuite de perspective)
  // Le plan avant (montants, chant des planches) est agrandi par la perspective :
  // on rentre le meuble d'autant pour qu'il reste entièrement dans l'écran.
  const kp = P / (P - (D / 2 + 10))
  const m = Math.ceil((w / 2) * (1 - 1 / kp)) + 6
  const perRow = Math.max(1, Math.floor((w - 2 * m - padX * 2 + gap) / (ws + gap)))
  const kf = P / (P - D / 2)
  return { rows, rowH, H, ws, gap, D, padX, perRow, perPage: rows * perRow, w, P, m, kf }
}

/** Taille du titre sur le dos : une ligne si possible, deux si le livre est assez large. */
function fitTitle(title, ws, H, hasArt) {
  const overhead = (hasArt ? ws * 0.9 : 10) + ws * 0.62 + 16
  const avail = Math.max(30, H - overhead)
  const len = Math.max(4, title.length)
  let fs = Math.min(15, ws * 0.42, avail / (len * CHAR))
  let lines = 1
  if (fs < 10 && ws >= 28) {
    const fs2 = Math.min(13, (ws - 6) / 2.3, (avail * 2) / (len * CHAR * 1.12))
    if (fs2 > fs) { fs = fs2; lines = 2 }
  }
  return { fs: Math.max(7.5, fs), lines }
}



const Book3D = memo(function Book3D({ book, L, side, z, delay, highlight, onOpen, onHover }) {
  const d = toDisplay(book)
  const [bg, ink] = spineColors(book)
  const reading = (book.statuses || [book.status]).includes('en_cours')
  const wish = false
  const hasArt = !!d.cover && L.ws >= 24
  const { fs, lines } = fitTitle(d.title, L.ws, L.H, hasArt)

  // On tire le livre de l'étagère, puis la fiche s'ouvre depuis lui
  const take = e => {
    if (performance.now() - lastDragEnd < 350) return
    const el = e.currentTarget
    const wrap = el.parentElement
    if (wrap.classList.contains('taking')) return
    wrap.classList.add('taking')
    setTimeout(() => onOpen(book, el), 230)
    setTimeout(() => wrap.classList.remove('taking'), 1400)
  }

  return (
    <div
      className={'b3' + (wish ? ' wish' : '') + (highlight ? ' fresh' : '') + (side ? ' ' + side.dir : '')}
      data-id={book.id}
      style={{ '--bg': bg, '--ink': ink, zIndex: z, animationDelay: `${delay}ms` }}
      onPointerEnter={() => { cursor.state = 'open'; onHover(book) }}
      onPointerLeave={() => { cursor.state = 'default'; onHover(null) }}
    >
      {side && !wish && (
        <span
          className="f-side" aria-hidden="true"
          style={{ left: side.left, top: side.top, width: side.width, height: side.height, clipPath: side.clip }}
        />
      )}
      <button
        type="button" className="f-spine" style={{ '--fs': `${fs.toFixed(1)}px` }}
        onClick={take}
        onFocus={() => onHover(book)} onBlur={() => onHover(null)}
        aria-label={`${d.title}, ${d.authors.join(', ')}`}
      >
        {hasArt && <span className="sp-art"><img src={d.cover} alt="" loading="lazy" decoding="async" draggable="false" /></span>}
        <span className={'sp-t' + (lines === 2 ? ' two' : '')}>{d.title}</span>
        <span className="sp-mark" aria-hidden="true">{authorInitials(book)}</span>
      </button>
      {reading && <span className="ribbon" aria-hidden="true" />}
    </div>
  )
})

/**
 * Un rayon vu en perspective. La 3D est calculée une seule fois (projection), puis dessinée
 * en 2D : fond, côtés, plafond et dessus de planche dans un SVG ; livres (dos + tranche),
 * portes et chant de la planche dans des calques simplement agrandis. Les livres peuvent
 * donc bouger (survol, prise en main, glisser-déposer) sans aucun recalcul de la scène.
 */
const Row = memo(function Row({
  meta, r, L, z, first, label, editable, onLabel, palette, born, highlightId, onOpen, onHover,
  doorsOpen, doorLabel, card, cardKey, onCard,
}) {
  const { w: W, rowH, H, ws, gap, D, padX, P, m } = L
  const row = meta.books
  const ox = W / 2, oy = rowH * 0.22
  const X0 = m, X1 = W - m
  const yp = rowH - PLANK, ytop = yp - H
  const zf = D / 2, zb = -D / 2, zp = D / 2 + 10, zw = -(D / 2 + 10)
  const k = zz => P / (P - zz)
  const pr = (x, y, zz) => { const kk = k(zz); return `${(ox + (x - ox) * kk).toFixed(1)},${(oy + (y - oy) * kk).toFixed(1)}` }
  const poly = pts => pts.join(' ')
  const id = `r${r}`

  // Tranche visible de chaque livre (côté droit à gauche du centre, côté gauche à droite),
  // exprimée dans le repère du livre pour qu'elle le suive quand il bouge.
  // Ordre d'empilement : des bords vers le centre (le plus proche du centre recouvre l'autre).
  const kf = k(zf)
  const toLocal = (x, y, zz, bx) => {
    const kk = k(zz) / kf
    return [ox + (x - ox) * kk - bx, oy + (y - oy) * kk - ytop]
  }
  const books = row.map((b, i) => {
    const bx = X0 + padX + i * (ws + gap)
    const leftOfCenter = bx + ws / 2 < ox
    const ex = leftOfCenter ? bx + ws : bx // arête de la tranche visible
    const pts = [toLocal(ex, ytop, zf, bx), toLocal(ex, ytop, zb, bx), toLocal(ex, yp, zb, bx), toLocal(ex, yp, zf, bx)]
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const width = Math.max(1, Math.max(...xs) - minX), height = Math.max(1, Math.max(...ys) - minY)
    const clip = `polygon(${pts.map(([x, y]) => `${(x - minX).toFixed(1)}px ${(y - minY).toFixed(1)}px`).join(',')})`
    return {
      b, side: { dir: leftOfCenter ? 'l' : 'r', left: minX, top: minY, width, height, clip },
      z: leftOfCenter ? i + 1 : row.length - i + 1,
    }
  })
  const [bx0, by0] = pr(X0, 0, zw).split(',').map(Number)
  const [bx1, by1] = pr(X1, yp, zw).split(',').map(Number)
  const stop = v => ({ stopColor: `var(${v})` })

  return (
    <div className={'row3d' + (born ? ' born' : '')} data-r={r} style={{ ...skinVars(palette), height: rowH, zIndex: z }}>
      <svg className="row-svg" width={W} height={rowH} viewBox={`0 0 ${W} ${rowH}`} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={stop('--wall-1')} /><stop offset="0.35" style={stop('--wall-2')} /><stop offset="1" style={stop('--wall-3')} />
          </linearGradient>
          <linearGradient id={`${id}-top`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style={stop('--top-1')} /><stop offset="1" style={stop('--top-2')} />
          </linearGradient>
          <linearGradient id={`${id}-ceil`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={stop('--ceil-1')} /><stop offset="1" style={stop('--ceil-2')} />
          </linearGradient>
          <linearGradient id={`${id}-sl`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={stop('--side-1')} /><stop offset="1" style={stop('--side-2')} />
          </linearGradient>
          <linearGradient id={`${id}-sr`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" style={stop('--side-1')} /><stop offset="1" style={stop('--side-2')} />
          </linearGradient>
          <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.18" /><stop offset="0.4" stopColor="#000" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} fill={`url(#${id}-wall)`} />
        <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} fill={`url(#${id}-shade)`} />
        <polygon points={poly([pr(X0, 0, zp), pr(X1, 0, zp), pr(X1, 0, zw), pr(X0, 0, zw)])} fill={`url(#${id}-ceil)`} />
        <polygon points={poly([pr(X0, 0, zp), pr(X0, 0, zw), pr(X0, rowH, zw), pr(X0, rowH, zp)])} fill={`url(#${id}-sl)`} />
        <polygon points={poly([pr(X1, 0, zp), pr(X1, 0, zw), pr(X1, rowH, zw), pr(X1, rowH, zp)])} fill={`url(#${id}-sr)`} />
        <polygon points={poly([pr(X0, yp, zp), pr(X1, yp, zp), pr(X1, yp, zw), pr(X0, yp, zw)])} fill={`url(#${id}-top)`} />
        {/* ombre portée des livres sur la planche, vers le fond */}
        {row.length > 0 && (
          <polygon
            points={poly([pr(X0 + padX, yp, zf), pr(X0 + padX + row.length * (ws + gap), yp, zf), pr(X0 + padX + row.length * (ws + gap), yp, zw), pr(X0 + padX, yp, zw)])}
            fill="#000" fillOpacity="0.08"
          />
        )}
      </svg>

      <div className="row-inset" style={{ left: X0, width: X1 - X0, top: 0, height: yp }} />
      <div className="row-floor" style={{ left: X0, width: X1 - X0, top: yp - 10 }} />

      <div className="layer" style={{ transformOrigin: `${ox}px ${oy}px`, transform: `scale(${k(zf).toFixed(4)})` }}>
        <div className="row-books" style={{ left: X0 + padX, top: ytop, height: H }}>
          {books.map(({ b, side, z: zi }, i) => (
            b.placeholder
              ? <div key={PH} className="b3 ph" aria-hidden="true" />
              : (
                <Book3D
                  key={b.id || b.google_id} book={b} L={L} side={null} z={zi} delay={Math.min(r * 60 + i * 14, 700)}
                  highlight={highlightId && b.id === highlightId} onOpen={onOpen} onHover={onHover}
                />
              )
          ))}
        </div>
      </div>

      <Doors
        L={L} r={r} ox={ox} oy={oy} scale={k(zf + 6)} yp={yp} count={row.length} style={palette.doors}
        open={doorsOpen} label={doorLabel} card={card} onCard={() => onCard(cardKey)}
      />

      <div className="layer" style={{ transformOrigin: `${ox}px ${oy}px`, transform: `scale(${k(zp).toFixed(4)})` }}>
        {first && <div className="crown" style={{ top: -PLANK, height: PLANK, left: X0 - 5, right: m - 5 }} />}
        <div className="plank-front" style={{ top: yp, height: PLANK, left: X0, right: m }}>
          {label && (editable ? (
            <button
              type="button" className="plank-label editable" data-shelf={meta.shelf?.id}
              onClick={e => onLabel(meta.shelf.id, e.currentTarget.getBoundingClientRect())}
              title="Renommer, changer l'apparence"
            >
              <span className="pl-name">{label}</span><span className="pl-pen" aria-hidden="true">✎</span>
            </button>
          ) : <span className="plank-label">{label}</span>)}
        </div>
        <div className="row-post" style={{ left: X0 - 5 }} />
        <div className="row-post" style={{ right: m - 5 }} />
      </div>
    </div>
  )
})

/**
 * Portes coulissantes d'un rayon, juste devant les livres.
 * - ouvertes : la porte droite ferme seulement la place vide après le dernier livre ;
 * - fermées : les deux portes se rejoignent au milieu (changement de page, ouverture du site).
 */
function Doors({ L, r, ox, oy, scale, yp, count, style, open, label, card, onCard }) {
  const { w: W, m, padX, ws, gap } = L
  const width = W - 2 * m
  const half = width / 2
  const used = padX + count * (ws + gap) + 12 // fin du dernier livre, plus un souffle
  const empty = count === 0
  const fullyOpen = open && !empty && used > width - 40
  // position du bord d'attaque de chaque porte (en px depuis la gauche du meuble)
  const rightX = !open || empty ? half : fullyOpen ? width + 30 : used
  const leftX = !open || empty ? half : -30
  const showCard = open && card && !fullyOpen && (empty || width - used > 150)
  const delay = r * STAGGER

  return (
    <div className="layer" style={{ transformOrigin: `${ox}px ${oy}px`, transform: `scale(${scale.toFixed(4)})` }}>
      <div className={'doors ' + (open ? 'opening' : 'closing')} style={{ left: m, width, top: 0, height: yp }}>
        <div
          className={`door left s-${style}`} aria-hidden="true"
          style={{ width: half + 1, '--x': `${(leftX - half - 1).toFixed(1)}px`, transitionDelay: `${delay}ms` }}
        >
          <span className="pull" />
        </div>
        <div
          className={`door right s-${style}` + (showCard ? ' free' : '')}
          style={{ width, '--x': `${rightX.toFixed(1)}px`, transitionDelay: `${delay}ms` }}
        >
          <span className="pull" />
          {showCard ? (
            <button type="button" className="door-card" onClick={onCard}>{card}</button>
          ) : (
            label ? <span className="door-card" aria-hidden="true">{label}</span> : null
          )}
        </div>
      </div>
    </div>
  )
}

/** Découpe en rayons : les étagères (rangement manuel) ou la liste triée (autres tris). */
function buildRows({ manual, shelves, autoBooks, byId, visible, canEdit, perRow, rowsPerPage }) {
  const rows = []
  if (manual) {
    for (const s of shelves) {
      const list = []
      for (const id of s.book_ids) {
        if (id === PH) list.push(PH_BOOK)
        else { const b = byId.get(id); if (b && visible.has(id)) list.push(b) }
      }
      if (!list.length && !canEdit) continue
      const n = Math.max(1, Math.ceil(list.length / perRow))
      for (let j = 0; j < n; j++) {
        rows.push({ key: `${s.id}:${j}`, shelf: s, start: j * perRow, books: list.slice(j * perRow, (j + 1) * perRow), cont: j > 0 })
      }
    }
  } else {
    const n = Math.ceil(autoBooks.length / perRow)
    for (let j = 0; j < n; j++) rows.push({ key: `a${j}`, auto: j, books: autoBooks.slice(j * perRow, (j + 1) * perRow) })
  }
  const pad = rows.length ? (rowsPerPage - (rows.length % rowsPerPage)) % rowsPerPage : rowsPerPage
  for (let i = 0; i < pad; i++) rows.push({ key: `free${i}`, free: true, books: [] })
  return rows
}

function autoLabel(row, n, sort) {
  const name = `Rayon ${toRoman(n + 1)}`
  if (!row.length) return name
  if (sort === 'title' || sort === 'author') {
    const key = sort === 'title' ? titleKey : authorKey
    const a = (key(row[0])[0] || '?').toUpperCase()
    const b = (key(row[row.length - 1])[0] || '?').toUpperCase()
    return `${name} · ${a === b ? a : `${a} – ${b}`}`
  }
  if (sort === 'year') {
    const ys = row.map(b => parseInt(b.published_date)).filter(Boolean)
    if (ys.length) {
      const a = Math.min(...ys), b = Math.max(...ys)
      return `${name} · ${a === b ? a : `${a} – ${b}`}`
    }
  }
  return `${name} · ${row.length} vol.`
}

/**
 * La bibliothèque : un meuble vu en perspective, rayon par rayon.
 * - Rangement manuel : les étagères de l'utilisatrice (nommées, habillées), glisser-déposer des livres.
 * - Autres tris : rangement automatique.
 * Les portes coulissantes cachent les places vides et l'échange des livres entre deux pages.
 */
export default function Shelf3D({
  books, allBooks, sort, viewKey, manual, canEdit, shelves, commitShelves, newShelfSignal,
  onOpen, onAdd, locked, highlightId, focusId, onFocused, emptyText, aside,
}) {
  const caseRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0, mobile: false })
  const [page, setPage] = useState(0)
  const [dir, setDir] = useState(1)
  const [hovered, setHovered] = useState(null)
  const [dragView, setDragView] = useState(null)   // { id, target }
  const [bornId, setBornId] = useState(null)
  const [editing, setEditing] = useState(null)     // { shelfId, rect, selectName }
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  useLayoutEffect(() => {
    const el = caseRef.current
    // on réserve TOP px en haut pour la couronne du meuble
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight - TOP, mobile: window.innerWidth <= 767 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const L = useMemo(() => computeLayout(size.w || 1200, size.h || 520, size.mobile), [size])

  // ---- Données --------------------------------------------------------------------------
  const byId = useMemo(() => new Map(allBooks.map(b => [b.id, b])), [allBooks])
  const visible = useMemo(() => new Set(books.map(b => b.id)), [books])
  const eff = useMemo(() => (manual ? effectiveShelves(shelves, allBooks) : []), [manual, shelves, allBooks])
  const display = useMemo(
    () => (manual && dragView ? previewDrag(eff, dragView.id, dragView.target) : eff),
    [manual, eff, dragView],
  )
  const rowsAll = useMemo(
    () => buildRows({ manual, shelves: display, autoBooks: books, byId, visible, canEdit, perRow: L.perRow, rowsPerPage: L.rows }),
    [manual, display, books, byId, visible, canEdit, L.perRow, L.rows],
  )
  const pages = Math.max(1, rowsAll.length / L.rows)
  const current = Math.min(page, pages - 1)
  const liveRows = useMemo(() => rowsAll.slice(current * L.rows, (current + 1) * L.rows), [rowsAll, current, L.rows])

  const go = useCallback(delta => {
    setPage(p => {
      const next = Math.max(0, Math.min(pages - 1, Math.min(p, pages - 1) + delta))
      if (next !== p) setDir(delta > 0 ? 1 : -1)
      return next
    })
  }, [pages])
  const goRef = useRef(go)
  goRef.current = go

  // Nouvelle vue (filtre, tri) : revenir à la première page
  const listKey = `${viewKey}|${sort}`
  const lastKey = useRef(listKey)
  useEffect(() => {
    if (lastKey.current !== listKey) { lastKey.current = listKey; setPage(0) }
  }, [listKey])

  // Aller à la page d'un livre (après un ajout)
  useEffect(() => {
    if (!focusId) return
    const idx = rowsAll.findIndex(r => r.books.some(b => b.id === focusId))
    if (idx < 0) return
    const target = Math.floor(idx / L.rows)
    setDir(target >= current ? 1 : -1)
    setPage(target)
    onFocused?.()
  }, [focusId, rowsAll, L.rows, current, onFocused])

  // ---- Portes : on ne change de page que portes fermées ----------------------------------
  const key = `${viewKey}|${sort}|${current}`
  const [shownKey, setShownKey] = useState(key)
  const [frozen, setFrozen] = useState(null)
  const [doorsOpen, setDoorsOpen] = useState(false)
  const introDone = useRef(false)
  const lastRows = useRef(liveRows)
  const displayRows = frozen || liveRows

  useEffect(() => {
    const t = setTimeout(() => { introDone.current = true; setDoorsOpen(true) }, 420)
    return () => clearTimeout(t)
  }, [])

  useLayoutEffect(() => {
    if (key === shownKey) {
      if (frozen) setFrozen(null)
      if (introDone.current) setDoorsOpen(true)
      return
    }
    setFrozen(lastRows.current)
    setDoorsOpen(false)
    const t = setTimeout(() => {
      setFrozen(null)
      setShownKey(key)
      introDone.current = true
      setDoorsOpen(true)
    }, CLOSE_MS + (L.rows - 1) * STAGGER + 60)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useLayoutEffect(() => { lastRows.current = displayRows })

  // ---- Animation FLIP : les livres glissent vers leur nouvelle place ----------------------
  const flip = useRef(null)
  const measureBooks = () => {
    const map = new Map()
    caseRef.current?.querySelectorAll('.b3[data-id]').forEach(el => map.set(el.dataset.id, el.getBoundingClientRect()))
    return map
  }
  const armFlip = (extra = {}) => { flip.current = { prev: measureBooks(), extra } }
  useLayoutEffect(() => {
    const f = flip.current
    if (!f) return
    flip.current = null
    const kf = L.kf
    caseRef.current?.querySelectorAll('.b3[data-id]').forEach(el => {
      const idb = el.dataset.id
      const from = f.extra[idb] || f.prev.get(idb)
      if (!from) return
      const to = el.getBoundingClientRect()
      const dx = (from.left - to.left) / kf, dy = (from.top - to.top) / kf
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
      const lifted = f.extra[idb]
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)${lifted ? ` rotate(${lifted.tilt || 0}deg) scale(1.08)` : ''}` },
          { transform: 'none' },
        ],
        { duration: lifted ? 560 : 420, easing: SPRING },
      )
    })
  })

  // ---- Opérations sur les étagères ----------------------------------------------------------
  const pendingNew = useRef(null)
  const effRef = useRef(eff)
  effRef.current = eff
  const commitRef = useRef(commitShelves)
  commitRef.current = commitShelves

  const openEditorFor = useCallback((id, selectName) => {
    const el = caseRef.current?.querySelector(`.plank-label[data-shelf="${id}"]`)
    if (el) setEditing({ shelfId: id, rect: el.getBoundingClientRect(), selectName, openId: performance.now() })
  }, [])

  const createNew = useCallback(() => {
    if (!commitRef.current) return
    const { list, id } = createShelf(effRef.current)
    commitRef.current(list)
    pendingNew.current = id
  }, [])

  // « + Étagère » depuis la barre du haut
  const lastSignal = useRef(newShelfSignal)
  useEffect(() => {
    if (newShelfSignal !== lastSignal.current) { lastSignal.current = newShelfSignal; createNew() }
  }, [newShelfSignal, createNew])

  // Une étagère vient d'être créée : on y va, elle se construit, puis on la nomme
  useEffect(() => {
    const id = pendingNew.current
    if (!id) return
    const idx = rowsAll.findIndex(r => r.shelf?.id === id)
    if (idx < 0) return
    pendingNew.current = null
    const target = Math.floor(idx / L.rows)
    const wait = target !== current ? CLOSE_MS + (L.rows - 1) * STAGGER + 260 : 0
    if (target !== current) { setDir(target > current ? 1 : -1); setPage(target) }
    setTimeout(() => {
      setBornId(id)
      setTimeout(() => openEditorFor(id, true), 1050)
      setTimeout(() => setBornId(b => (b === id ? null : b)), 1900)
    }, wait)
  }, [rowsAll, L.rows, current, openEditorFor])

  const onAddRef = useRef(onAdd)
  onAddRef.current = onAdd
  const onCardAction = useCallback(cardKey => {
    if (cardKey === 'new') createNew()
    else onAddRef.current(cardKey.slice(4) || null)
  }, [createNew])
  const onLabelClick = useCallback((id, rect) => setEditing({ shelfId: id, rect, selectName: false, openId: performance.now() }), [])

  const editShelf = editing ? eff.find(s => s.id === editing.shelfId) : null
  const realIndex = editShelf ? eff.filter(s => !s.pseudo).findIndex(s => s.id === editShelf.id) : -1
  const realCount = eff.filter(s => !s.pseudo).length
  const run = (res, keepEditing = true) => {
    commitShelves(res.list)
    if (keepEditing && res.id && editing && res.id !== editing.shelfId) setEditing(e => e && { ...e, shelfId: res.id })
  }

  // ---- Glisser-déposer --------------------------------------------------------------------
  const dataRef = useRef(null)
  dataRef.current = { L, eff, manual, canEdit, current, byId, visible, rowsPerPage: L.rows }

  useEffect(() => {
    const caseEl = caseRef.current
    const dg = { phase: 'idle' }
    let raf = 0

    const baseRows = () => {
      const d = dataRef.current
      if (dg.baseKey === `${d.current}|${d.L.perRow}|${d.eff.length}`) return dg.base
      const all = buildRows({ manual: true, shelves: previewDrag(d.eff, dg.id, null), autoBooks: [], byId: d.byId, visible: d.visible, canEdit: true, perRow: d.L.perRow, rowsPerPage: d.rowsPerPage })
      dg.base = all.slice(d.current * d.rowsPerPage, (d.current + 1) * d.rowsPerPage)
      dg.baseKey = `${d.current}|${d.L.perRow}|${d.eff.length}`
      return dg.base
    }

    const hitTest = (x, y) => {
      const { L: l } = dataRef.current
      const base = baseRows()
      for (const el of caseEl.querySelectorAll('.row3d[data-r]')) {
        const rc = el.getBoundingClientRect()
        if (y < rc.top || y > rc.bottom || x < rc.left || x > rc.right) continue
        const meta = base[+el.dataset.r]
        if (!meta) return null
        if (meta.free) return { shelfId: NEWSHELF }
        const ox = l.w / 2
        const local = ox + (x - rc.left - ox) / l.kf
        const n = meta.books.length
        const idx = Math.max(0, Math.min(n, Math.floor((local - (l.m + l.padX + l.ws / 2)) / (l.ws + l.gap)) + 1))
        return { shelfId: meta.shelf.id, index: meta.start + idx }
      }
      return null
    }

    const placeGhost = () => {
      if (dg.phase !== 'drag') return
      dg.tilt = 0 // le livre reste droit pendant qu'on le déplace
      dg.vx *= 0.85
      dg.ghost.style.transform = `translate(${(dg.x - dg.fx * dg.w).toFixed(1)}px, ${(dg.y - dg.fy * dg.h).toFixed(1)}px) rotate(${dg.tilt.toFixed(2)}deg) scale(${dg.scale})`
      raf = requestAnimationFrame(placeGhost)
    }

    const activate = () => {
      const d = dataRef.current
      const bookEl = dg.bookEl
      const spine = bookEl.querySelector('.f-spine')
      const rc = spine.getBoundingClientRect()
      dg.w = d.L.ws; dg.h = d.L.H
      dg.fx = Math.max(0, Math.min(1, (dg.startX - rc.left) / rc.width))
      dg.fy = Math.max(0, Math.min(1, (dg.startY - rc.top) / rc.height))
      dg.scale = (d.L.kf * 1.08).toFixed(3)
      dg.tilt = 0; dg.vx = 0
      const ghost = document.createElement('div')
      ghost.className = 'drag-ghost'
      ghost.style.cssText = `width:${dg.w}px;height:${dg.h}px;transform-origin:${dg.fx * 100}% ${dg.fy * 100}%;` +
        `--bg:${bookEl.style.getPropertyValue('--bg')};--ink:${bookEl.style.getPropertyValue('--ink')};--ws:${d.L.ws}px;`
      ghost.appendChild(spine.cloneNode(true))
      document.body.appendChild(ghost)
      dg.ghost = ghost
      dg.phase = 'drag'
      dg.x = dg.startX; dg.y = dg.startY
      document.body.classList.add('is-dragging')
      cursor.state = 'grab'
      navigator.vibrate?.(8)
      armFlip()
      dg.target = { shelfId: dg.fromShelf, index: dg.fromIndex }
      setDragView({ id: dg.id, target: dg.target })
      raf = requestAnimationFrame(placeGhost)
    }

    const onDown = e => {
      const d = dataRef.current
      if (!d.manual || !d.canEdit || lockedRef.current || e.button > 0) return
      const bookEl = e.target.closest?.('.b3[data-id]')
      if (!bookEl || !caseEl.contains(bookEl)) return
      const id = bookEl.dataset.id
      const from = d.eff.find(s => s.book_ids.includes(id))
      Object.assign(dg, {
        phase: 'pending', id, bookEl, startX: e.clientX, startY: e.clientY, pointerType: e.pointerType,
        fromShelf: from?.id, fromIndex: from ? from.book_ids.indexOf(id) : 0, baseKey: null,
      })
      if (e.pointerType !== 'mouse') dg.timer = setTimeout(() => { if (dg.phase === 'pending') activate() }, 320)
    }

    const edgeFlip = (x, y) => {
      const rc = caseEl.getBoundingClientRect()
      let dirn = 0
      if (x < rc.left + 34) dirn = -1
      else if (x > rc.right - 34) dirn = 1
      document.querySelectorAll('.nav-arrow').forEach((a, i) => {
        const r = a.getBoundingClientRect()
        if (x >= r.left - 10 && x <= r.right + 10 && y >= r.top - 10 && y <= r.bottom + 10) dirn = i === 0 ? -1 : 1
      })
      if (dirn !== dg.edgeDir) {
        clearTimeout(dg.edgeTimer)
        dg.edgeDir = dirn
        if (dirn) {
          const tick = () => { goRef.current(dirn); dg.baseKey = null; dg.edgeTimer = setTimeout(tick, 1500) }
          dg.edgeTimer = setTimeout(tick, 650)
        }
      }
    }

    const onMove = e => {
      if (dg.phase === 'pending') {
        const dist = Math.hypot(e.clientX - dg.startX, e.clientY - dg.startY)
        if (dg.pointerType === 'mouse' ? dist > 6 : dist > 10) {
          if (dg.pointerType === 'mouse') activate()
          else { clearTimeout(dg.timer); dg.phase = 'idle' }
        }
        if (dg.phase !== 'drag') return
      }
      if (dg.phase !== 'drag') return
      e.preventDefault()
      dg.vx = dg.vx * 0.5 + (e.clientX - dg.x) * 0.5
      dg.x = e.clientX; dg.y = e.clientY
      edgeFlip(e.clientX, e.clientY)
      const t = hitTest(e.clientX, e.clientY)
      if (JSON.stringify(t) !== JSON.stringify(dg.target)) {
        dg.target = t
        armFlip()
        setDragView({ id: dg.id, target: t })
      }
    }

    const finish = commit => {
      clearTimeout(dg.timer); clearTimeout(dg.edgeTimer); dg.edgeDir = 0
      if (dg.phase !== 'drag') { dg.phase = 'idle'; return }
      cancelAnimationFrame(raf)
      lastDragEnd = performance.now()
      const gr = dg.ghost.getBoundingClientRect()
      const extra = { [dg.id]: { left: dg.x - dg.fx * dg.w * dg.scale, top: dg.y - dg.fy * dg.h * dg.scale, tilt: dg.tilt, width: gr.width } }
      dg.ghost.remove()
      document.body.classList.remove('is-dragging')
      cursor.state = 'default'
      armFlip(extra)
      const t = dg.target
      dg.phase = 'idle'
      setDragView(null)
      if (commit && t) {
        const res = moveBook(dataRef.current.eff, dg.id, t.shelfId, t.index)
        commitRef.current?.(res.list)
        if (res.createdId) pendingNew.current = res.createdId
      }
    }

    const onUp = () => finish(true)
    const onCancel = () => finish(false)
    const onKey = e => { if (e.key === 'Escape' && dg.phase === 'drag') finish(false) }

    caseEl.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    return () => {
      finish(false)
      caseEl.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Clavier, molette, glissé du doigt : changer de page -------------------------------
  useEffect(() => {
    const el = caseRef.current
    let acc = 0, cool = 0, startX = null
    const busy = () => lockedRef.current || document.body.classList.contains('is-dragging') || performance.now() - lastDragEnd < 400
    const onKey = e => {
      if (busy()) return
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
    }
    const onWheel = e => {
      if (busy()) return
      const now = performance.now()
      if (now < cool) return
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(acc) > 90) { go(acc > 0 ? 1 : -1); acc = 0; cool = now + 700 }
    }
    const onDown = e => { startX = e.clientX }
    const onUp = e => {
      if (startX == null || busy()) { startX = null; return }
      const dx = e.clientX - startX
      startX = null
      if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [go])

  // ---- Rendu --------------------------------------------------------------------------------
  const realShelves = eff.filter(s => !s.pseudo)
  const fallbackSkin = resolveSkin(realShelves[realShelves.length - 1] || shelves[0] || DEFAULT_SKIN)
  const shelfNames = [...new Set(displayRows.filter(r => r.shelf && !r.shelf.preview).map(r => r.shelf.name))]

  const hd = hovered ? toDisplay(hovered) : null
  const hint = manual && canEdit
    ? (size.mobile ? 'Appui long sur un livre pour le déplacer' : 'Glisse un livre pour le ranger, clique pour l’ouvrir')
    : (size.mobile ? 'Touche un livre pour l’ouvrir' : 'Survole un livre, clique pour l’ouvrir')
  const caption = hd
    ? { title: hd.title, subtitle: hd.authors.join(', '), year: [hd.year, hd.pageCount ? `${hd.pageCount} pages` : null].filter(Boolean).join(' / ') || ' ' }
    : books.length || (manual && canEdit)
      ? {
        title: manual && shelfNames.length ? shelfNames.slice(0, 3).join(' · ') : `Étagère ${toRoman(current + 1)}`,
        subtitle: `${books.length} ${books.length > 1 ? 'livres' : 'livre'} · page ${current + 1} sur ${pages}`,
        year: hint,
      }
      : { title: emptyText, subtitle: 'Ajoute un livre avec le bouton en haut', year: ' ' }

  return (
    <>
      <div className="case-row">
      <div
        className={'case3d' + (manual && canEdit ? ' editable' : '')} ref={caseRef}
        style={{ '--H': `${L.H}px`, '--ws': `${L.ws}px`, '--gap': `${L.gap}px`, '--padx': `${L.padX}px` }}
      >
        <div className="case-page">
          {displayRows.map((meta, r) => {
            const shelf = meta.shelf
            const palette = shelf ? resolveSkin(shelf) : manual ? fallbackSkin : resolveSkin(shelves[0] || DEFAULT_SKIN)
            let label = '', card = null, cardKey = null, doorLabel = ''
            if (manual) {
              if (shelf) {
                label = meta.cont ? `${shelf.name} · suite` : shelf.name
                doorLabel = shelf.name
                if (canEdit && !shelf.preview) {
                  card = '+ Ajouter un livre'
                  cardKey = `add:${shelf.pseudo || shelf.virtual ? '' : shelf.id}`
                }
              } else if (canEdit) {
                card = '+ Nouvelle étagère'
                cardKey = 'new'
                doorLabel = 'Place libre'
              }
            } else {
              const n = current * L.rows + r
              label = meta.free ? '' : autoLabel(meta.books, meta.auto, sort)
              doorLabel = `Rayon ${toRoman(n + 1)}`
              if (!meta.free) { card = '+ Ajouter un livre'; cardKey = 'add:' }
            }
            return (
              <Row
                key={r} meta={meta} r={r} L={L} z={L.rows - r} first={r === 0}
                label={label} editable={manual && canEdit && !!shelf && !meta.cont && !shelf.preview}
                onLabel={onLabelClick}
                palette={palette} born={!!shelf && shelf.id === bornId && !meta.cont}
                highlightId={highlightId} onOpen={onOpen} onHover={setHovered}
                doorsOpen={doorsOpen} doorLabel={doorLabel} card={null} cardKey={cardKey} onCard={onCardAction}
              />
            )
          })}
          {!books.length && !(manual && canEdit) && doorsOpen && <p className="row-empty">{emptyText}</p>}
        </div>
      </div>
      {aside}
      </div>

      <div className="scene-bottom">
        <button type="button" className="nav-arrow" aria-label="Page précédente" onClick={() => go(-1)} disabled={current === 0}>
          <svg viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M5 1 L1 5 L5 9 M1 5 L17 5" /></svg>
        </button>
        <Caption className="scene-caption" title={caption.title} subtitle={caption.subtitle} year={caption.year} dir={dir} />
        <button type="button" className="nav-arrow" aria-label="Page suivante" onClick={() => go(1)} disabled={current >= pages - 1}>
          <svg viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M13 1 L17 5 L13 9 M17 5 L1 5" /></svg>
        </button>
      </div>

      {editing && editShelf && (
        <ShelfEditor
          key={editing.openId}
          shelf={editShelf} anchor={editing.rect} selectName={editing.selectName}
          canUp={realIndex > 0} canDown={realIndex >= 0 && realIndex < realCount - 1}
          onClose={() => setEditing(null)}
          onRename={name => run(renameShelf(eff, editShelf.id, name))}
          onSkin={patch => run(setShelfSkin(eff, editShelf.id, patch))}
          onApplyAll={() => run(applySkinToAll(eff, editShelf.id))}
          onMove={delta => run(moveShelf(eff, editShelf.id, delta))}
          onDelete={() => run(deleteShelf(eff, editShelf.id), false)}
          onAdopt={() => { const res = adoptLoose(eff); commitShelves(res.list); pendingNew.current = res.id }}
        />
      )}
    </>
  )
}

