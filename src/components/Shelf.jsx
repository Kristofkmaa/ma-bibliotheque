import { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import { spineColors, toDisplay, smoothstep } from '../lib/bookUtils'
import { cursor } from '../lib/cursorState'

const MIN_SLOTS = 24
const VISIBLE = 16

function wrap(r, N) {
  r = r % N
  if (r > N / 2) r -= N
  if (r < -N / 2) r += N
  return r
}

/** Décalage horizontal des voisins pour laisser la place à la jaquette ouverte (C¹-continu). */
function B(r) {
  if (Math.abs(r) < 1) return (r + Math.sin(Math.PI * r) / Math.PI) / 2
  return r > 0 ? 0.5 : -0.5
}

function Spine({ d }) {
  const [bg, ink] = spineColors(d)
  return (
    <div className="face sp" style={{ '--spine-bg': bg, '--spine-ink': ink }}>
      <div className="sp-inner">
        <div className="sp-art">{d.cover && <img src={d.cover} alt="" loading="lazy" draggable="false" />}</div>
        <div className="sp-title">{d.title}</div>
        <div className="sp-author">{(d.authors[0] || '').split(' ').pop()}</div>
        <div className="sp-badge">Livre</div>
      </div>
    </div>
  )
}

function Cover({ d }) {
  const [bg, ink] = spineColors(d)
  return (
    <div className="face cv" style={{ '--spine-bg': bg, '--spine-ink': ink }}>
      {d.cover ? (
        <img className="cv-img" src={d.cover} alt={d.title} draggable="false" />
      ) : (
        <div className="cv-fallback">
          <div className="cv-top">Bibliothèque Levana</div>
          <div className="cv-title">{d.title}</div>
          <div className="cv-author">{d.authors.join(', ')}</div>
        </div>
      )}
      <div className="cv-worn" />
    </div>
  )
}

/**
 * Étagère 3D : une boucle continue de livres debout, côte à côte.
 * Le livre actif s'avance, s'incline et pivote de 90° pour montrer sa jaquette.
 */
const Shelf = forwardRef(function Shelf({ books, onActiveChange, onOpen, locked }, ref) {
  const n = books.length
  const copies = Math.max(3, Math.ceil(MIN_SLOTS / Math.max(n, 1)))
  const N = n * copies

  const slots = useMemo(
    () => Array.from({ length: N }, (_, v) => ({ v, book: books[v % n], d: toDisplay(books[v % n]) })),
    [books, N, n]
  )

  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const probeRef = useRef(null)
  const ringRef = useRef(null)
  const tapeEls = useRef([])
  const spEls = useRef([])
  const cvEls = useRef([])

  const st = useRef({
    s: 0, T: 0, N: 0, n: 0, H: 0, ws: 0, d: 0, gap: 0,
    lifts: [], hovered: -1, lastActiveV: -1, lastRound: 0,
    tiltX: 0, tiltY: 0, tiltXT: 0, tiltYT: 0,
    down: false, dragging: false, suppress: false, dragX: 0, dragY: 0, dragT: 0,
    locked: false, onCover: false, activeBookId: null,
  }).current

  st.locked = !!locked
  st.N = N; st.n = n
  const cbs = useRef({ onActiveChange, onOpen })
  cbs.current = { onActiveChange, onOpen }

  // Position de départ : copie du milieu, en conservant le livre actif si possible.
  useEffect(() => {
    if (!n) return
    const mid = n * Math.floor(copies / 2)
    let idx = books.findIndex(b => b.id === st.activeBookId)
    if (idx < 0) idx = 0
    st.s = st.T = mid + idx
    st.lastRound = Math.round(st.s)
    st.lastActiveV = -1
    st.lifts = new Array(N).fill(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, N, n, copies])

  const measure = () => {
    const H = probeRef.current?.offsetHeight || Math.min(window.innerHeight * 0.46, window.innerWidth * 0.31)
    st.H = H
    st.ws = H * 0.165
    st.d = H * (2 / 3)
    st.gap = H * 0.03
    const stage = stageRef.current
    if (stage) {
      stage.style.setProperty('--ws', `${st.ws}px`)
      stage.style.setProperty('--d', `${st.d}px`)
    }
  }

  const F = r => r * (st.ws + st.gap) + (st.d - st.ws + 1.6 * st.gap) * B(r)

  const activeV = () => ((Math.round(st.s) % st.N) + st.N) % st.N
  const activeOpenness = () => 1 - smoothstep(Math.abs(wrap(activeV() - st.s, st.N)))

  useImperativeHandle(ref, () => ({
    next: () => { if (!st.N) return; st.T = Math.round(st.T) + 1 },
    prev: () => { if (!st.N) return; st.T = Math.round(st.T) - 1 },
    goTo: bookIndex => {
      if (!st.n) return
      const cur = ((Math.round(st.s) % st.n) + st.n) % st.n
      let diff = bookIndex - cur
      if (diff > st.n / 2) diff -= st.n
      if (diff < -st.n / 2) diff += st.n
      st.T = Math.round(st.s) + diff
    },
    getActiveBookIndex: () => (st.n ? activeV() % st.n : -1),
    getActiveCoverRect: () => {
      const el = cvEls.current[activeV()]
      const r = el?.getBoundingClientRect()
      if (r && r.width > 0) return r
      const W = window.innerWidth, Hw = window.innerHeight
      return { left: W / 2 - st.d / 2, top: Hw / 2 - st.H / 2, right: W / 2 + st.d / 2, bottom: Hw / 2 + st.H / 2, width: st.d, height: st.H }
    },
  }))

  // Boucle de rendu + entrées utilisateur
  useEffect(() => {
    if (!N) return
    measure()
    let raf = 0
    let last = performance.now()
    let wheelTimer = null

    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const k = st.dragging ? 18 : 5.2
      st.s += (st.T - st.s) * (1 - Math.exp(-k * dt))
      if (Math.abs(st.T - st.s) < 0.0004) st.s = st.T
      const ft = 1 - Math.exp(-8 * dt)
      st.tiltX += (st.tiltXT - st.tiltX) * ft
      st.tiltY += (st.tiltYT - st.tiltY) * ft

      const round = Math.round(st.s)
      const av = ((round % N) + N) % N
      if (av !== st.lastActiveV) {
        const dir = round >= st.lastRound ? 1 : -1
        st.lastActiveV = av
        st.lastRound = round
        st.activeBookId = books[av % n]?.id ?? null
        cbs.current.onActiveChange?.(av % n, dir)
      }

      const { H, ws, d, gap } = st
      const fl = 1 - Math.exp(-12 * dt)
      for (let v = 0; v < N; v++) {
        const el = tapeEls.current[v]
        if (!el) continue
        if (!spEls.current[v] || spEls.current[v].parentNode !== el) {
          spEls.current[v] = el.firstElementChild
          cvEls.current[v] = el.lastElementChild
        }
        const r = wrap(v - st.s, N)
        if (Math.abs(r) > VISIBLE) { if (el.style.display !== 'none') el.style.display = 'none'; continue }
        if (el.style.display === 'none') el.style.display = ''
        const open = 1 - smoothstep(Math.abs(r))
        const x = F(r)
        const liftT = st.hovered === v && open < 0.5 ? 1 : 0
        st.lifts[v] += (liftT - st.lifts[v]) * fl
        const y = -st.lifts[v] * 0.05 * H - open * 0.015 * H
        const z = open * 0.18 * H
        const ry = -90 * open + st.tiltY * open
        const rx = st.tiltX * open
        const rz = -4.5 * open
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateZ(${rz.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
        spEls.current[v]?.style.setProperty('--shade', (0.04 + 0.5 * open + 0.06 * Math.min(1, Math.abs(r) / 10)).toFixed(3))
        cvEls.current[v]?.style.setProperty('--shade', (0.58 * (1 - open)).toFixed(3))
      }

      // Anneau "ouvrir" sous la jaquette active
      const ring = ringRef.current
      const cv = cvEls.current[av]
      if (ring && cv) {
        const o = activeOpenness()
        const rect = cv.getBoundingClientRect()
        ring.style.left = `${rect.left + 6}px`
        ring.style.top = `${rect.top + rect.height * 0.86}px`
        ring.style.transform = `translate(-50%, -50%) scale(${(st.locked ? 0 : o).toFixed(3)})`
      }
      void gap; void ws; void d
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onResize = () => measure()
    const onKey = e => {
      if (st.locked) return
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowLeft') st.T = Math.round(st.T) - 1
      else if (e.key === 'ArrowRight') st.T = Math.round(st.T) + 1
      else if (e.key === 'Enter') cbs.current.onOpen?.()
    }
    const onWheel = e => {
      if (st.locked) return
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      st.T += (delta / (st.ws + st.gap)) * 0.5
      clearTimeout(wheelTimer)
      wheelTimer = setTimeout(() => { st.T = Math.round(st.T) }, 160)
    }
    const onMove = e => {
      const W = window.innerWidth, Hw = window.innerHeight
      st.tiltYT = ((e.clientX - W / 2) / W) * 10
      st.tiltXT = -((e.clientY - Hw / 2) / Hw) * 8
      if (st.down) {
        const dx = e.clientX - st.dragX, dy = e.clientY - st.dragY
        if (!st.dragging && Math.hypot(dx, dy) > 16) { st.dragging = true; st.suppress = true }
        if (st.dragging) st.T = st.dragT - dx / (st.ws + st.gap)
      }
    }
    const onUp = () => {
      if (!st.down) return
      st.down = false
      if (st.dragging) {
        st.dragging = false
        st.T = Math.round(st.T)
        setTimeout(() => { st.suppress = false }, 80)
      } else st.suppress = false
    }
    const onCancel = () => { st.down = false; st.dragging = false; st.T = Math.round(st.T) }

    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(wheelTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N, n, books])


  const onPointerDown = e => {
    if (st.locked) return
    st.down = true; st.dragging = false; st.suppress = false
    st.dragX = e.clientX; st.dragY = e.clientY; st.dragT = st.T
  }

  const onTapeClick = v => {
    if (st.locked || st.suppress) return
    const r = wrap(v - st.s, N)
    if (Math.abs(r) < 0.5) cbs.current.onOpen?.()
    else st.T = Math.round(st.T + r)
  }

  const onTapeEnter = v => {
    st.hovered = v
    const r = wrap(v - st.s, N)
    cursor.state = Math.abs(r) < 0.5 ? 'open' : 'spine'
  }
  const onTapeLeave = v => {
    if (st.hovered === v) st.hovered = -1
    cursor.state = 'default'
  }

  return (
    <>
      <div ref={probeRef} style={{ position: 'absolute', visibility: 'hidden', height: 'var(--H)', pointerEvents: 'none' }} />
      <section className="shelf-section" ref={sectionRef} aria-label="Étagère" onPointerDown={onPointerDown}>
        <div className="stage" ref={stageRef}>
          {slots.map(({ v, book, d }) => (
            <div
              key={`${book.id}-${v}`} className="tape" data-v={v}
              ref={el => { tapeEls.current[v] = el }}
              onClick={() => onTapeClick(v)}
              onPointerEnter={() => onTapeEnter(v)}
              onPointerLeave={() => onTapeLeave(v)}
            >
              <Spine d={d} />
              <Cover d={d} />
            </div>
          ))}
        </div>
      </section>
      <button type="button" className="play-ring" ref={ringRef} aria-label="Ouvrir le livre" onClick={() => !st.locked && cbs.current.onOpen?.()}>
        <div className="play-ring-icon" aria-hidden="true" />
      </button>
    </>
  )
})

export default Shelf
