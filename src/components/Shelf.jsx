import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { spineColors, toDisplay, smoothstep } from '../lib/bookUtils'
import { cursor } from '../lib/cursorState'

const PERSPECTIVE = 2200
const mod = (a, n) => ((a % n) + n) % n

/** Décalage horizontal des voisins pour laisser la place à la jaquette ouverte (C¹-continu). */
function B(r) {
  if (Math.abs(r) < 1) return (r + Math.sin(Math.PI * r) / Math.PI) / 2
  return r > 0 ? 0.5 : -0.5
}

const Spine = memo(function Spine({ d }) {
  const [bg, ink] = spineColors(d)
  return (
    <div className="face sp" style={{ '--spine-bg': bg, '--spine-ink': ink }}>
      <div className="sp-inner">
        <div className="sp-art">{d.cover && <img src={d.cover} alt="" decoding="async" draggable="false" />}</div>
        <div className="sp-title">{d.title}</div>
        <div className="sp-author">{(d.authors[0] || '').split(' ').pop()}</div>
        <div className="sp-badge">Livre</div>
      </div>
    </div>
  )
})

const Cover = memo(function Cover({ d }) {
  const [bg, ink] = spineColors(d)
  return (
    <div className="face cv" style={{ '--spine-bg': bg, '--spine-ink': ink }}>
      {d.cover ? (
        <img className="cv-img" src={d.cover} alt={d.title} decoding="async" draggable="false" />
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
})

const Tape = memo(function Tape({ v, d, register, onClick, onEnter, onLeave }) {
  return (
    <div
      className="tape" ref={el => register(v, el)}
      onClick={() => onClick(v)} onPointerEnter={() => onEnter(v)} onPointerLeave={() => onLeave(v)}
    >
      <Spine d={d} />
      <Cover d={d} />
    </div>
  )
})

/**
 * Étagère 3D : une boucle infinie de livres debout, côte à côte.
 * Le livre actif s'avance, s'incline et pivote de 90° pour montrer sa jaquette.
 *
 * Performance : seuls les livres visibles sont montés (fenêtre glissante autour du
 * livre actif), et chaque frame n'écrit dans le DOM que les valeurs qui ont changé.
 * Au repos, la boucle ne touche plus au DOM.
 */
const Shelf = forwardRef(function Shelf({ books, onActiveChange, onOpen, locked }, ref) {
  const n = books.length
  const displays = useMemo(() => books.map(toDisplay), [books])

  const probeRef = useRef(null)
  const stageRef = useRef(null)
  const ringRef = useRef(null)
  const els = useRef(new Map())    // v -> { el, sp, cv, t, a, b }
  const lifts = useRef(new Map())  // v -> 0..1

  const st = useRef({
    s: 0, T: 0, H: 0, ws: 0, d: 0, gap: 0, half: 10, W: 0, Hw: 0,
    hovered: null, lastRound: null, activeBookId: null, ringKey: '',
    tiltX: 0, tiltY: 0, tiltXT: 0, tiltYT: 0,
    down: false, dragging: false, suppress: false, dragX: 0, dragY: 0, dragT: 0,
    locked: false,
  }).current
  st.locked = !!locked

  const cbs = useRef(null)
  cbs.current = { onActiveChange, onOpen, books }

  const [center, setCenter] = useState(0)
  const [half, setHalf] = useState(10)

  const F = r => r * (st.ws + st.gap) + (st.d - st.ws + 1.6 * st.gap) * B(r)

  /** Positionne un livre ; n'écrit que si la valeur a changé. */
  const place = (v, e) => {
    const r = v - st.s
    const a = Math.abs(r)
    if (a > st.half + 1.5) {
      if (e.t !== 'none') { e.el.style.visibility = 'hidden'; e.t = 'none' }
      return
    }
    const { H } = st
    const open = 1 - smoothstep(a)
    const lift = lifts.current.get(v) || 0
    const x = F(r)
    const y = -lift * 0.05 * H - open * 0.015 * H
    const z = open * 0.18 * H
    const t = open > 0
      ? `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateZ(${(-4.5 * open).toFixed(2)}deg) rotateX(${(st.tiltX * open).toFixed(2)}deg) rotateY(${(-90 * open + st.tiltY * open).toFixed(2)}deg)`
      : `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0px)`
    if (t !== e.t) {
      if (e.t === 'none') e.el.style.visibility = ''
      e.el.style.transform = t
      e.t = t
    }
    const sa = (0.04 + 0.5 * open + 0.06 * Math.min(1, a / 10)).toFixed(2)
    if (sa !== e.a) { e.sp.style.setProperty('--shade', sa); e.a = sa }
    const sb = (0.58 * (1 - open)).toFixed(2)
    if (sb !== e.b) { e.cv.style.setProperty('--shade', sb); e.b = sb }
  }

  const register = useCallback((v, el) => {
    if (!el) { els.current.delete(v); return }
    const e = { el, sp: el.firstElementChild, cv: el.lastElementChild, t: '', a: '', b: '' }
    els.current.set(v, e)
    place(v, e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const measure = () => {
    const H = probeRef.current?.offsetHeight || Math.min(window.innerHeight * 0.46, window.innerWidth * 0.31)
    st.H = H
    st.ws = H * 0.165
    st.d = H * (2 / 3)
    st.gap = H * 0.03
    st.W = window.innerWidth
    st.Hw = window.innerHeight
    st.half = Math.min(40, Math.ceil((st.W / 2 + st.d) / (st.ws + st.gap)) + 1)
    stageRef.current?.style.setProperty('--ws', `${st.ws}px`)
    stageRef.current?.style.setProperty('--d', `${st.d}px`)
    setHalf(st.half)
    st.ringKey = ''
    els.current.forEach((e, v) => { e.t = ''; e.a = ''; e.b = ''; place(v, e) })
  }

  // Quand la liste change (filtre, ajout…), garder le même livre au centre si possible.
  useLayoutEffect(() => {
    if (!n) return
    let idx = books.findIndex(b => b.id === st.activeBookId)
    if (idx < 0) idx = 0
    const base = Math.round(st.s)
    let diff = idx - mod(base, n)
    if (diff > n / 2) diff -= n
    if (diff < -n / 2) diff += n
    st.s = st.T = base + diff
    st.lastRound = null
    setCenter(st.s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, n])

  useLayoutEffect(() => {
    measure()
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    next: () => { st.T = Math.round(st.T) + 1 },
    prev: () => { st.T = Math.round(st.T) - 1 },
    goTo: bookIndex => {
      const nn = cbs.current.books.length
      if (!nn) return
      const base = Math.round(st.s)
      let diff = bookIndex - mod(base, nn)
      if (diff > nn / 2) diff -= nn
      if (diff < -nn / 2) diff += nn
      st.T = base + diff
    },
    getActiveBookIndex: () => {
      const nn = cbs.current.books.length
      return nn ? mod(Math.round(st.s), nn) : -1
    },
    getActiveCoverRect: () => {
      const r = els.current.get(Math.round(st.s))?.cv.getBoundingClientRect()
      if (r && r.width > 0) return r
      const { W, Hw, d, H } = st
      return { left: W / 2 - d / 2, top: Hw / 2 - H / 2, right: W / 2 + d / 2, bottom: Hw / 2 + H / 2, width: d, height: H }
    },
  }))

  // Boucle d'animation + entrées utilisateur
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let wheelTimer = null

    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const nn = cbs.current.books.length

      const k = st.dragging ? 18 : 5.2
      const diff = st.T - st.s
      if (Math.abs(diff) < 0.0005) st.s = st.T
      else st.s += diff * (1 - Math.exp(-k * dt))

      const ft = 1 - Math.exp(-8 * dt)
      st.tiltX += (st.tiltXT - st.tiltX) * ft
      st.tiltY += (st.tiltYT - st.tiltY) * ft
      if (Math.abs(st.tiltXT - st.tiltX) < 0.005) st.tiltX = st.tiltXT
      if (Math.abs(st.tiltYT - st.tiltY) < 0.005) st.tiltY = st.tiltYT

      const fl = 1 - Math.exp(-12 * dt)
      lifts.current.forEach((val, v) => {
        const target = st.hovered === v && Math.abs(v - st.s) > 0.5 ? 1 : 0
        const nv = val + (target - val) * fl
        if (target === 0 && nv < 0.003) lifts.current.delete(v)
        else lifts.current.set(v, Math.abs(target - nv) < 0.003 ? target : nv)
      })

      const round = Math.round(st.s)
      if (nn && round !== st.lastRound) {
        const dir = st.lastRound == null || round >= st.lastRound ? 1 : -1
        st.lastRound = round
        const bi = mod(round, nn)
        st.activeBookId = cbs.current.books[bi]?.id ?? null
        cbs.current.onActiveChange?.(bi, dir)
        setCenter(round)
      }

      els.current.forEach((e, v) => place(v, e))

      // Anneau "ouvrir", calculé sans lire la mise en page
      const ring = ringRef.current
      if (ring) {
        const r = round - st.s
        const o = 1 - smoothstep(Math.abs(r))
        const kz = PERSPECTIVE / (PERSPECTIVE - o * 0.18 * st.H)
        const left = st.W / 2 + (F(r) - st.d / 2) * kz + 6
        const top = st.Hw / 2 + 0.36 * st.H * kz
        const sc = st.locked ? 0 : o
        const key = `${left.toFixed(1)}|${top.toFixed(1)}|${sc.toFixed(2)}`
        if (key !== st.ringKey) {
          st.ringKey = key
          ring.style.left = `${left.toFixed(1)}px`
          ring.style.top = `${top.toFixed(1)}px`
          ring.style.transform = `translate(-50%, -50%) scale(${sc.toFixed(2)})`
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

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
      st.tiltYT = Math.round(((e.clientX - st.W / 2) / st.W) * 100) / 10
      st.tiltXT = -Math.round(((e.clientY - st.Hw / 2) / st.Hw) * 80) / 10
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

    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(wheelTimer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPointerDown = e => {
    if (st.locked) return
    st.down = true; st.dragging = false; st.suppress = false
    st.dragX = e.clientX; st.dragY = e.clientY; st.dragT = st.T
  }

  const onTapeClick = useCallback(v => {
    if (st.locked || st.suppress) return
    if (Math.abs(v - st.s) < 0.5) cbs.current.onOpen?.()
    else st.T = v
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onTapeEnter = useCallback(v => {
    st.hovered = v
    if (!lifts.current.has(v)) lifts.current.set(v, 0)
    cursor.state = Math.abs(v - st.s) < 0.5 ? 'open' : 'spine'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onTapeLeave = useCallback(v => {
    if (st.hovered === v) st.hovered = null
    cursor.state = 'default'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const slots = useMemo(() => {
    const out = []
    for (let v = center - half; v <= center + half; v++) out.push(v)
    return out
  }, [center, half])

  return (
    <>
      <div ref={probeRef} style={{ position: 'absolute', visibility: 'hidden', height: 'var(--H)', pointerEvents: 'none' }} />
      <div className="shelf-floor" aria-hidden="true" />
      <section className="shelf-section" aria-label="Étagère" onPointerDown={onPointerDown}>
        <div className="stage" ref={stageRef}>
          {n > 0 && slots.map(v => (
            <Tape
              key={v} v={v} d={displays[mod(v, n)]}
              register={register} onClick={onTapeClick} onEnter={onTapeEnter} onLeave={onTapeLeave}
            />
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
