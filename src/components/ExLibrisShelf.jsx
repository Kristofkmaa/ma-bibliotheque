import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
import { clothOf, heightOf, spineWidthOf, statusesOf } from '../lib/exlibris'
import '../exlibris.css'

// Bibliothèque en bois : les dos se rangent rayon par rayon selon la largeur disponible.
// Les livres en cours sont penchés ; un serre-livres doré termine le dernier rayon.
export default function ExLibrisShelf({ books, onOpen, emptyText = 'Le premier rayon attend son livre.' }) {
  const ref = useRef(null)
  const [inner, setInner] = useState(0)
  const [ready, setReady] = useState(true)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setInner(el.clientWidth - 16)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // L'arrivée des livres ne se joue qu'une fois, au premier affichage
  useEffect(() => { const t = setTimeout(() => setReady(false), 1600); return () => clearTimeout(t) }, [])

  const { rows, room } = useMemo(() => {
    const width = inner > 100 ? inner : 320
    const out = [[]]
    let acc = 0
    for (const b of books) {
      const lean = statusesOf(b).includes('en_cours')
      const w = spineWidthOf(b) + 2 + (lean ? 16 : 0)
      if (acc + w > width && out[out.length - 1].length) { out.push([]); acc = 0 }
      out[out.length - 1].push(b)
      acc += w
    }
    return { rows: out, room: acc + 22 <= width }
  }, [books, inner])

  return (
    <div ref={ref} className={`xl-case${ready ? ' ready' : ''}`}>
      {books.length ? rows.map((row, r) => (
        <div key={r}>
          <div className="xl-tier">
            {row.map((b, j) => {
              const lean = statusesOf(b).includes('en_cours')
              const start = rows.slice(0, r).reduce((s, x) => s + x.length, 0)
              const delay = Math.min((start + j) * 40, 800)
              return (
                <button
                  key={b.id || b.google_id}
                  className={`xl-spine${lean ? ' lean' : ''}`}
                  style={{ width: spineWidthOf(b), height: heightOf(b), backgroundColor: clothOf(b), animationDelay: `${delay}ms` }}
                  onClick={e => onOpen(b, e.currentTarget)}
                  aria-label={`Ouvrir ${b.title}`}
                >
                  <span>{b.title}</span>
                </button>
              )
            })}
            {r === rows.length - 1 && room && <span className="xl-bookend" aria-hidden="true" />}
          </div>
          <div className={`xl-plank${r === rows.length - 1 ? ' last' : ''}`} />
        </div>
      )) : (
        <>
          <div className="xl-tier"><div className="xl-empty">{emptyText}</div></div>
          <div className="xl-plank last" />
        </>
      )}
    </div>
  )
}
