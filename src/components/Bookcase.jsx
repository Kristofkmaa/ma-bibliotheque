import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { spineColors, spineSize, authorInitials, toRoman, titleKey, authorKey } from '../lib/bookUtils'
import { getBookStatuses } from '../hooks/useLibrary'

const GAP = 3
const TIER_PAD_X = 18
const CHAR = 0.74 // largeur moyenne d'une capitale Newsreader (en em, interlettrage compris)

/** Taille du titre sur le dos : une ligne si possible, deux si le livre est assez épais. */
function fitTitle(title, width, height, mobile, hasMark) {
  const overhead = (mobile ? 34 : 44) + (hasMark ? (mobile ? 18 : 22) : 0) + 6
  const avail = Math.max(40, height - overhead)
  const len = Math.max(4, title.length)
  let fs = Math.min(14, width * 0.42, avail / (len * CHAR))
  let lines = 1
  if (fs < 10.5 && width >= (mobile ? 28 : 34)) {
    const fs2 = Math.min(13, (width - 6) / 2.3, (avail * 2) / (len * CHAR * 1.12))
    if (fs2 > fs) { fs = fs2; lines = 2 }
  }
  return { fs: Math.max(mobile ? 7.5 : 8, fs), lines }
}

const Spine = memo(function Spine({ book, scale, delay, onOpen, onHover, highlight }) {
  const [bg, ink] = spineColors(book)
  const { w, hr } = spineSize(book)
  const width = Math.round(w * scale)
  const statuses = getBookStatuses(book)
  const reading = statuses.includes('en_cours')
  const wish = statuses.includes('souhaite') && !statuses.some(s => s === 'possede' || s === 'lu' || s === 'en_cours')
  const author = (book.authors || []).join(', ')
  const mobile = scale < 1
  const hasMark = width >= 26
  const { fs, lines } = fitTitle(book.title || '', width, (mobile ? 150 : 212) * hr, mobile, hasMark)
  return (
    <button
      type="button"
      className={'spine' + (wish ? ' wish' : '') + (highlight ? ' fresh' : '') + (lines === 2 ? ' two' : '')}
      data-id={book.id}
      style={{
        width, height: `calc(var(--book-h) * ${hr})`,
        '--bg': bg, '--ink': ink,
        '--fs': `${fs.toFixed(1)}px`,
        animationDelay: `${delay}ms`,
      }}
      onClick={e => onOpen(book, e.currentTarget)}
      onPointerEnter={() => onHover(book)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(book)}
      onBlur={() => onHover(null)}
      aria-label={`${book.title}${author ? ', ' + author : ''}`}
    >
      {reading && <span className="ribbon" aria-hidden="true" />}
      <span className="sp-band" aria-hidden="true" />
      <span className="sp-t">{book.title}</span>
      {hasMark && <span className="sp-mark" aria-hidden="true">{authorInitials(book)}</span>}
      <span className="sp-band" aria-hidden="true" />
    </button>
  )
})

function rowLabel(row, i, sort) {
  const n = toRoman(i + 1)
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
 * Bibliothèque : les dos se rangent rayon par rayon selon la largeur disponible.
 * Rien ne pivote : survol = le livre se soulève, clic = la fiche s'ouvre depuis le dos.
 */
export default function Bookcase({ books, sort, onOpen, onHover, highlightId, emptyText }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      setWidth(el.clientWidth)
      setScale(window.innerWidth <= 767 ? 0.78 : 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { rows, room } = useMemo(() => {
    const inner = Math.max(180, (width || 900) - TIER_PAD_X * 2)
    const out = [[]]
    let acc = 0
    for (const b of books) {
      const w = Math.round(spineSize(b).w * scale) + GAP
      if (acc + w > inner && out[out.length - 1].length) { out.push([]); acc = 0 }
      out[out.length - 1].push(b)
      acc += w
    }
    if (out.length < 2) out.push([]) // toujours au moins deux rayons : ça reste un meuble
    return { rows: out, room: inner - acc }
  }, [books, width, scale])

  let index = 0
  return (
    <div className="case" ref={ref}>
      {rows.map((row, r) => {
        const last = r === rows.length - 1
        const lastFilled = row.length && (last || !rows[r + 1].length)
        return (
          <div className="tier-wrap" key={r}>
            <div className="tier">
              {row.map(b => {
                const delay = Math.min(index++ * 16, 900)
                return (
                  <Spine
                    key={b.id || b.google_id} book={b} scale={scale} delay={delay}
                    onOpen={onOpen} onHover={onHover} highlight={highlightId && b.id === highlightId}
                  />
                )
              })}
              {lastFilled && room > 26 ? <span className="bookend" aria-hidden="true" /> : null}
              {!books.length && r === 0 && <p className="tier-empty">{emptyText}</p>}
            </div>
            <div className="plank"><span className="plank-label">{rowLabel(row, r, sort)}</span></div>
          </div>
        )
      })}
    </div>
  )
}
