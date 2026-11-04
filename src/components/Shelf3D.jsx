import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { spineColors, authorInitials, toRoman, titleKey, authorKey, toDisplay } from '../lib/bookUtils'
import { getBookStatuses } from '../hooks/useLibrary'
import { cursor } from '../lib/cursorState'
import Caption from './Caption'

const PLANK = 16       // épaisseur de la planche (px)
const ROOM = 34        // espace libre au-dessus des livres (px)
const CHAR = 0.74      // largeur moyenne d'une capitale Newsreader (em)
const TOP = 30         // marge haute réservée à la couronne du meuble (px)
const CLOSE_MS = 640   // durée de fermeture des portes (doit suivre le CSS)
const STAGGER = 80     // décalage entre rayons (ms)

/** Géométrie : nombre de rayons par étagère, taille des livres, livres par rayon. */
function computeLayout(w, h, mobile) {
  const minRow = mobile ? 168 : 236
  const rows = Math.max(1, Math.min(4, Math.floor(h / minRow)))
  const rowH = Math.floor(h / rows)
  const H = Math.round(Math.max(96, Math.min(mobile ? 150 : 236, rowH - PLANK - ROOM)))
  const ws = Math.max(22, Math.round(H * 0.17))
  const gap = Math.max(3, Math.round(H * 0.025))
  const D = Math.round(H * 0.62)
  const padX = mobile ? 14 : 26
  const P = mobile ? 900 : 1500 // distance de l'œil (perspective)
  // Le plan avant (montants, chant des planches) est agrandi par la perspective :
  // on rentre le meuble d'autant pour qu'il reste entièrement dans l'écran.
  const kp = P / (P - (D / 2 + 10))
  const m = Math.ceil((w / 2) * (1 - 1 / kp)) + 6
  const perRow = Math.max(1, Math.floor((w - 2 * m - padX * 2 + gap) / (ws + gap)))
  return { rows, rowH, H, ws, gap, D, padX, perRow, perPage: rows * perRow, w, P, m }
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
  const statuses = getBookStatuses(book)
  const reading = statuses.includes('en_cours')
  const wish = isWish(statuses)
  const hasArt = !!d.cover && L.ws >= 24
  const { fs, lines } = fitTitle(d.title, L.ws, L.H, hasArt)

  // On tire le livre de l'étagère, puis la fiche s'ouvre depuis lui
  const take = e => {
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

const isWish = statuses => statuses.includes('souhaite') && !statuses.some(s => s === 'possede' || s === 'lu' || s === 'en_cours')

/**
 * Un rayon vu en perspective. La 3D est calculée une seule fois (projection), puis dessinée
 * en 2D : fond, côtés, plafond et dessus de planche dans un SVG statique ; livres (dos +
 * tranche) et chant de la planche dans des calques simplement agrandis. Les livres peuvent
 * donc bouger (survol, prise en main) sans aucun recalcul de la scène.
 * Résultat identique à une vraie scène 3D, sans aucun coût à l'affichage.
 */
const Row = memo(function Row({ row, r, label, L, z, first, highlightId, onOpen, onHover, doorsOpen, doorLabel, onAdd }) {
  const { w: W, rowH, H, ws, gap, D, padX, P, m } = L
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

  return (
    <div className="row3d" style={{ height: rowH, zIndex: z }}>
      <svg className="row-svg" width={W} height={rowH} viewBox={`0 0 ${W} ${rowH}`} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#CFC9BC" /><stop offset="0.35" stopColor="#DDD8CD" /><stop offset="1" stopColor="#D1CBBD" />
          </linearGradient>
          <linearGradient id={`${id}-top`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#E4DAC4" /><stop offset="1" stopColor="#C9BC9E" />
          </linearGradient>
          <linearGradient id={`${id}-ceil`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#B9AC8E" /><stop offset="1" stopColor="#CDC1A6" />
          </linearGradient>
          <linearGradient id={`${id}-sl`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#D8CBAD" /><stop offset="1" stopColor="#C6B897" />
          </linearGradient>
          <linearGradient id={`${id}-sr`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#D8CBAD" /><stop offset="1" stopColor="#C6B897" />
          </linearGradient>
        </defs>
        <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} fill={`url(#${id}-wall)`} />
        <polygon points={poly([pr(X0, 0, zp), pr(X1, 0, zp), pr(X1, 0, zw), pr(X0, 0, zw)])} fill={`url(#${id}-ceil)`} />
        <polygon points={poly([pr(X0, 0, zp), pr(X0, 0, zw), pr(X0, rowH, zw), pr(X0, rowH, zp)])} fill={`url(#${id}-sl)`} />
        <polygon points={poly([pr(X1, 0, zp), pr(X1, 0, zw), pr(X1, rowH, zw), pr(X1, rowH, zp)])} fill={`url(#${id}-sr)`} />
        <polygon points={poly([pr(X0, yp, zp), pr(X1, yp, zp), pr(X1, yp, zw), pr(X0, yp, zw)])} fill={`url(#${id}-top)`} />
        {/* ombre portée des livres sur la planche, vers le fond */}
        {row.length > 0 && (
          <polygon
            points={poly([pr(X0 + padX, yp, zf), pr(X0 + padX + row.length * (ws + gap), yp, zf), pr(X0 + padX + row.length * (ws + gap), yp, zw), pr(X0 + padX, yp, zw)])}
            fill="#000" fillOpacity="0.07"
          />
        )}
      </svg>

      <div className="layer" style={{ transformOrigin: `${ox}px ${oy}px`, transform: `scale(${k(zf).toFixed(4)})` }}>
        <div className="row-books" style={{ left: X0 + padX, top: ytop, height: H }}>
          {books.map(({ b, side, z }, i) => (
            <Book3D
              key={b.id || b.google_id} book={b} L={L} side={side} z={z} delay={Math.min(r * 60 + i * 14, 700)}
              highlight={highlightId && b.id === highlightId} onOpen={onOpen} onHover={onHover}
            />
          ))}
        </div>
      </div>

      <Doors
        L={L} r={r} ox={ox} oy={oy} scale={k(zf + 6)} yp={yp} count={row.length}
        open={doorsOpen} label={doorLabel} onAdd={onAdd}
      />

      <div className="layer" style={{ transformOrigin: `${ox}px ${oy}px`, transform: `scale(${k(zp).toFixed(4)})` }}>
        {first && <div className="crown" style={{ top: -PLANK, height: PLANK, left: X0 - 5, right: m - 5 }} />}
        <div className="plank-front" style={{ top: yp, height: PLANK, left: X0, right: m }}><span className="plank-label">{label}</span></div>
        <div className="row-post" style={{ left: X0 - 5 }} />
        <div className="row-post" style={{ right: m - 5 }} />
      </div>
    </div>
  )
})

/**
 * Portes coulissantes d'un rayon, juste devant les livres.
 * - ouvertes : la porte droite ferme seulement la place vide après le dernier livre ;
 * - fermées : les deux portes se rejoignent au milieu (changement d'étagère, ouverture du site).
 */
function Doors({ L, r, ox, oy, scale, yp, count, open, label, onAdd }) {
  const { w: W, m, padX, ws, gap } = L
  const width = W - 2 * m
  const half = width / 2
  const used = padX + count * (ws + gap) + 12 // fin du dernier livre, plus un souffle
  const empty = count === 0
  const fullyOpen = open && !empty && used > width - 40
  // position du bord d'attaque de chaque porte (en px depuis la gauche du meuble)
  const rightX = !open || empty ? half : fullyOpen ? width + 30 : used
  const leftX = !open || empty ? half : -30
  // la porte propose d'ajouter un livre quand elle cache une vraie place libre (ou un rayon vide)
  const wideFree = open && !fullyOpen && (empty || width - used > 150)
  const delay = r * STAGGER

  return (
    <div className="layer" style={{ transformOrigin: `${ox}px ${oy}px`, transform: `scale(${scale.toFixed(4)})` }}>
      <div className={'doors ' + (open ? 'opening' : 'closing')} style={{ left: m, width, top: 0, height: yp }}>
        <div
          className="door left" aria-hidden="true"
          style={{ width: half + 1, '--x': `${(leftX - half - 1).toFixed(1)}px`, transitionDelay: `${delay}ms` }}
        >
          <span className="pull" />
        </div>
        <div
          className={'door right' + (wideFree ? ' free' : '')}
          style={{ width, '--x': `${rightX.toFixed(1)}px`, transitionDelay: `${delay}ms` }}
        >
          <span className="pull" />
          {wideFree ? (
            <button type="button" className="door-card" onClick={onAdd}>+ Ajouter un livre</button>
          ) : (
            <span className="door-card" aria-hidden="true">{label}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function rowLabel(row, i, page, rows, sort) {
  const n = toRoman(page * rows + i + 1)
  if (!row.length) return `Rayon ${n}`
  if (sort === 'title' || sort === 'author') {
    const key = sort === 'title' ? titleKey : authorKey
    const a = (key(row[0])[0] || '?').toUpperCase()
    const b = (key(row[row.length - 1])[0] || '?').toUpperCase()
    return `Rayon ${n} · ${a === b ? a : `${a} – ${b}`}`
  }
  if (sort === 'year') {
    const ys = row.map(b => parseInt(b.published_date)).filter(Boolean)
    if (ys.length) {
      const a = Math.min(...ys), b = Math.max(...ys)
      return `Rayon ${n} · ${a === b ? a : `${a} – ${b}`}`
    }
  }
  return `Rayon ${n} · ${row.length} vol.`
}

/**
 * Étagère en 3D : les livres sont des volumes posés sur des planches, vus en perspective.
 * Ils ne bougent pas : on change d'étagère avec les flèches (la page se dévoile d'un bloc),
 * on clique un livre pour ouvrir sa fiche.
 */
export default function Shelf3D({ books, sort, viewKey, onOpen, onAdd, locked, highlightId, focusId, onFocused, emptyText }) {
  const caseRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0, mobile: false })
  const [page, setPage] = useState(0)
  const [dir, setDir] = useState(1)
  const [hovered, setHovered] = useState(null)
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
  const pages = Math.max(1, Math.ceil(books.length / L.perPage))
  const current = Math.min(page, pages - 1)

  const go = useCallback(delta => {
    setPage(p => {
      const next = Math.max(0, Math.min(pages - 1, Math.min(p, pages - 1) + delta))
      if (next !== p) setDir(delta > 0 ? 1 : -1)
      return next
    })
  }, [pages])

  // Nouvelle liste (filtre, tri) : revenir à la première étagère
  const listKey = books.length + '|' + sort
  const lastKey = useRef(listKey)
  useEffect(() => {
    if (lastKey.current !== listKey) { lastKey.current = listKey; setPage(0) }
  }, [listKey])

  // Aller à l'étagère d'un livre (après un ajout)
  useEffect(() => {
    if (!focusId) return
    const idx = books.findIndex(b => b.id === focusId)
    if (idx < 0) return
    const target = Math.floor(idx / L.perPage)
    setDir(target >= current ? 1 : -1)
    setPage(target)
    onFocused?.()
  }, [focusId, books, L.perPage, current, onFocused])

  // Ce qui est affiché derrière les portes. On ne change de contenu que portes fermées :
  // fermeture → échange des livres → réouverture. Une simple mise à jour (note, statut)
  // passe directement, sans animation.
  const key = `${viewKey}|${books.length}|${current}|${L.perPage}`
  const [shown, setShown] = useState({ key, books, page: current })
  const [doorsOpen, setDoorsOpen] = useState(false)

  // Ouverture du site : la bibliothèque apparaît portes fermées, puis elles coulissent
  useEffect(() => {
    const t = setTimeout(() => setDoorsOpen(true), 420)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (key === shown.key) {
      if (books !== shown.books) setShown(s => ({ ...s, books }))
      return
    }
    setDoorsOpen(false)
    const t = setTimeout(() => {
      setShown({ key, books, page: current })
      setDoorsOpen(true)
    }, CLOSE_MS + (L.rows - 1) * STAGGER + 60)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, books, current])

  // Clavier, molette, glissé du doigt : changer d'étagère
  useEffect(() => {
    const el = caseRef.current
    let acc = 0, cool = 0, startX = null
    const onKey = e => {
      if (lockedRef.current) return
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
    }
    const onWheel = e => {
      if (lockedRef.current) return
      const now = performance.now()
      if (now < cool) return
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(acc) > 90) { go(acc > 0 ? 1 : -1); acc = 0; cool = now + 700 }
    }
    const onDown = e => { startX = e.clientX }
    const onUp = e => {
      if (startX == null || lockedRef.current) return
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

  const rows = useMemo(() => {
    const start = shown.page * L.perPage
    const slice = shown.books.slice(start, start + L.perPage)
    return Array.from({ length: L.rows }, (_, r) => slice.slice(r * L.perRow, (r + 1) * L.perRow))
  }, [shown, L])

  const hd = hovered ? toDisplay(hovered) : null
  const caption = hd
    ? { title: hd.title, subtitle: hd.authors.join(', '), year: [hd.year, hd.pageCount ? `${hd.pageCount} pages` : null].filter(Boolean).join(' / ') || ' ' }
    : books.length
      ? { title: `Étagère ${toRoman(current + 1)}`, subtitle: `${books.length} ${books.length > 1 ? 'livres' : 'livre'} · étagère ${current + 1} sur ${pages}`, year: size.mobile ? 'Touche un livre pour l’ouvrir' : 'Survole un livre, clique pour l’ouvrir' }
      : { title: emptyText, subtitle: 'Ajoute un livre avec le bouton en haut', year: ' ' }

  return (
    <>
      <div
        className="case3d" ref={caseRef}
        style={{ '--H': `${L.H}px`, '--ws': `${L.ws}px`, '--gap': `${L.gap}px`, '--padx': `${L.padX}px` }}
      >
        <div className="case-page">
          {rows.map((row, r) => (
            <Row
              key={r} row={row} r={r} L={L} z={L.rows - r} first={r === 0}
              label={rowLabel(row, r, shown.page, L.rows, sort)}
              highlightId={highlightId} onOpen={onOpen} onHover={setHovered}
              doorsOpen={doorsOpen} doorLabel={row.length || books.length ? `Étagère ${toRoman(current + 1)}` : 'Bibliothèque Levana'} onAdd={onAdd}
            />
          ))}
          {!shown.books.length && doorsOpen && <p className="row-empty">{emptyText}</p>}
        </div>
      </div>

      <div className="scene-bottom">
        <button type="button" className="nav-arrow" aria-label="Étagère précédente" onClick={() => go(-1)} disabled={current === 0}>
          <svg viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M5 1 L1 5 L5 9 M1 5 L17 5" /></svg>
        </button>
        <Caption className="scene-caption" title={caption.title} subtitle={caption.subtitle} year={caption.year} dir={dir} />
        <button type="button" className="nav-arrow" aria-label="Étagère suivante" onClick={() => go(1)} disabled={current >= pages - 1}>
          <svg viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M13 1 L17 5 L13 9 M17 5 L1 5" /></svg>
        </button>
      </div>
    </>
  )
}
