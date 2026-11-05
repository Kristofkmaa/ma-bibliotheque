import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tmdbImg, searchSeries, seriesDetails, seriesVideos, year } from '../lib/tmdb'

/** Un titre dont les mots montent un à un, comme sortis d'une fente. */
function Rise({ text, as: Tag = 'span', className, delay = 0, step = 0.06 }) {
  const words = (text || '').split(/\s+/).filter(Boolean)
  return (
    <Tag className={'rise ' + (className || '')} aria-label={text}>
      {words.map((w, i) => (
        <span className="rise-w" key={i} aria-hidden="true">
          <span style={{ animationDelay: `${delay + i * step}s` }}>{w}</span>
        </span>
      ))}
    </Tag>
  )
}

function Stars({ value, onChange }) {
  return (
    <div className="stv-stars" role="radiogroup" aria-label="Ta note">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          className={n <= (value || 0) ? 'on' : ''} onClick={() => onChange(value === n ? null : n)}>★</button>
      ))}
    </div>
  )
}

const meta = s => [year(s), s.seasons ? `${s.seasons} saison${s.seasons > 1 ? 's' : ''}` : '', s.genres?.[0], s.networks?.[0]].filter(Boolean).join(' · ')

/** La recherche, dans la télé : on tape un nom, les affiches montent. */
function SeriesSearch({ have, onAdd }) {
  const empty = have.size === 0
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)       // null : rien tapé ; [] : aucun résultat
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(null)
  const input = useRef(null)
  useEffect(() => { const t = setTimeout(() => input.current?.focus(), 350); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRes(null); setErr(''); return }
    let live = true
    setBusy(true)
    const t = setTimeout(() => {
      searchSeries(term)
        .then(r => { if (live) { setRes(r); setErr('') } })
        .catch(e => { if (live) { setRes([]); setErr(e.message) } })
        .finally(() => { if (live) setBusy(false) })
    }, 320)
    return () => { live = false; clearTimeout(t) }
  }, [q])

  const add = async show => {
    if (have.has(show.tmdb_id) || adding) return
    setAdding(show.tmdb_id)
    let full = show
    try { full = { ...show, ...(await seriesDetails(show.tmdb_id)) } } catch { /* la recherche suffit */ }
    setAdding(null)
    onAdd(full)
  }

  return (
    <div className="stv-search">
      {empty ? (
        <div className="stv-empty">
          <Rise as="h2" className="stv-title" text="Nos séries" delay={0.15} />
          <Rise as="p" className="stv-title it" text="préférées" delay={0.3} />
        </div>
      ) : <p className="stv-search-title">Ajouter une série</p>}
      <label className="stv-field">
        <span className="sr-only">Nom de la série</span>
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Friends, Lupin, The Crown…"
          autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
        {busy && <span className="stv-spin" aria-hidden="true" />}
      </label>
      {err && <p className="stv-msg">{/clé|key/i.test(err) ? 'La clé TMDB n’est pas encore réglée sur Vercel.' : 'La recherche ne répond pas, réessaie dans un instant.'}</p>}
      {res && !res.length && !err && <p className="stv-msg">Aucune série trouvée pour « {q.trim()} ».</p>}
      {!res && !err && <p className="stv-msg soft">Tape au moins deux lettres.</p>}
      {res && res.length > 0 && (
        <ul className="stv-results">
          {res.map((s, i) => {
            const got = have.has(s.tmdb_id)
            return (
              <li key={s.tmdb_id} style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}>
                <button type="button" className={'stv-result' + (got ? ' got' : '')} onClick={() => add(s)} disabled={got || adding === s.tmdb_id}>
                  <span className="stv-result-img">
                    {s.poster_path ? <img src={tmdbImg(s.poster_path, 'w185')} alt="" loading="lazy" /> : <span className="stv-noimg">{s.name}</span>}
                    <span className="stv-badge" aria-hidden="true">{got ? '✓' : adding === s.tmdb_id ? '…' : '+'}</span>
                  </span>
                  <span className="stv-result-name">{s.name}</span>
                  <span className="stv-result-year">{year(s) || '—'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="stv-credit">Données et images : TMDB</p>
    </div>
  )
}

const isOpening = v => v?.type === 'Opening Credits'

/**
 * Le générique (ou la bande-annonce) : le lecteur YouTube remplit l'écran de la télé.
 * Si une vidéo refuse d'être lue ici (bloquée, ou interdite hors de YouTube), on passe à la
 * suivante ; à la fin, on revient à la série.
 */
function Player({ show, videos, onDone }) {
  const [i, setI] = useState(0)
  const frame = useRef(null)
  const v = videos[i]
  useEffect(() => {
    const onMsg = e => {
      let host = ''
      try { host = new URL(e.origin).hostname } catch { return }
      if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return
      let d
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data } catch { return }
      if (d?.event === 'onError') { if (i + 1 < videos.length) setI(i + 1); else onDone() }
      else if ((d?.event === 'onStateChange' && d.info === 0) || (d?.event === 'infoDelivery' && d.info?.playerState === 0)) onDone()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [i, videos, onDone])
  // on demande au lecteur de nous prévenir (fin de la vidéo, erreur)
  const listen = () => {
    const w = frame.current?.contentWindow
    if (!w) return
    const send = o => w.postMessage(JSON.stringify({ id: 'stv', channel: 'widget', ...o }), '*')
    send({ event: 'listening' })
    send({ event: 'command', func: 'addEventListener', args: ['onStateChange'] })
    send({ event: 'command', func: 'addEventListener', args: ['onError'] })
  }
  if (!v) return null
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.key)}?autoplay=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1&hl=fr&origin=${encodeURIComponent(location.origin)}`
  return (
    <div className="stv-player">
      <div className="stv-player-top">
        <p className="stv-kicker">{isOpening(v) ? 'Le générique' : 'La bande-annonce'} · <span>{show.name}</span></p>
        <button type="button" className="stv-x light" onClick={onDone} aria-label="Arrêter la vidéo">×</button>
      </div>
      <div className="stv-player-frame">
        <iframe ref={frame} key={v.key} src={src} title={`${isOpening(v) ? 'Générique' : 'Bande-annonce'} de ${show.name}`} onLoad={listen}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    </div>
  )
}

// Les tranches : des couleurs de boîtiers, choisies d'après le nom de la série
const SPINES = [
  ['#1C1A17', '#EDE3CC'], ['#ECE2CB', '#1C1A17'], ['#6E1F1A', '#F1E4C8'], ['#1F3A2E', '#E9DFC9'],
  ['#1E2B4A', '#EBDDB6'], ['#B5832E', '#1C1A17'], ['#5A3B26', '#EADCC0'], ['#3B3A37', '#E4D9C2'],
  ['#C9BFAA', '#2A2620'], ['#8C2F22', '#F3E7CF'],
]
const spineOf = s => {
  let h = 0
  for (const c of s.name || '') h = (h * 31 + c.charCodeAt(0)) >>> 0
  return SPINES[h % SPINES.length]
}
const pad = n => String(n).padStart(2, '0')
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const CASE = 0.7                       // largeur / hauteur d'un boîtier, vu de face
const ZOOM_KEY = 'levana.series.zoom'
const readZoom = () => { try { const z = parseFloat(localStorage.getItem(ZOOM_KEY)); return z > 0 ? clamp(z, 0.55, 1.6) : 1 } catch { return 1 } }

/** La catégorie d'une série : celle qu'on lui a donnée, sinon son genre. */
export const categoryOf = s => s.category || s.genres?.[0] || 'Autres'

/** Un boîtier vu de face, fin comme un Blu-ray : le bandeau bleu en haut, l'affiche, le reflet. */
function CaseFront({ show, size = 'w500' }) {
  return (
    <span className="bx-front">
      <span className="bx-band"><b>Série</b><i>{year(show) || ''}</i></span>
      <span className="bx-art">
        {show.poster_path ? <img src={tmdbImg(show.poster_path, size)} alt="" draggable="false" loading="lazy" /> : <span className="bx-name">{show.name}</span>}
      </span>
      <span className="bx-sheen" aria-hidden="true" />
    </span>
  )
}

/** Un boîtier vu de côté : une tranche fine, le titre écrit de haut en bas. */
function CaseSpine({ show }) {
  const [bg, fg] = spineOf(show)
  return (
    <span className="bx-spine" style={{ background: bg, color: fg }}>
      <span className="bx-spine-cap" />
      <span className="bx-spine-name">{show.name}</span>
      <span className="bx-spine-year">{year(show) || ''}</span>
    </span>
  )
}

/** La frise du bas : un trait par série, les années en dessous. */
function Timeline({ list, idx, onPick }) {
  const n = list.length
  const every = Math.max(1, Math.ceil(n / 7))
  return (
    <div className="vx-time">
      <div className="vx-time-line" />
      {list.map((s, i) => {
        const x = n > 1 ? (i / (n - 1)) * 100 : 50
        const y = year(s)
        const label = i === idx || (i % every === 0 && Math.abs(i - idx) >= every / 2)
        return (
          <button key={s.id} type="button" className={'vx-tick' + (i === idx ? ' on' : '')} style={{ left: `${x}%` }} onClick={() => onPick(i)} aria-label={s.name}>
            <span className="vx-tick-bar" />
            {label && y && <span className="vx-tick-year">{y}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Taille des boîtiers de l'étagère courbe, selon la place et le zoom. */
const shelfMetrics = (W, H, zoom) => {
  const frontH = clamp(Math.min(H * 0.84, W * 0.46 / CASE) * zoom, 90, 600)
  return { frontH, frontW: frontH * CASE, spineH: frontH * 0.97, spineW: frontH * 0.072, gap: frontH * 0.012 }
}

/**
 * L'étagère courbe : les boîtiers sur un arc, celui du milieu de face, les autres de tranche,
 * de plus en plus loin. On la fait tourner au doigt, à la molette, aux flèches.
 */
function Shelf({ list, pos, dragging, onPick, onOpen, onPlay, canPlay, stageRef, size, zoom }) {
  const { H, W } = size
  const { frontH, frontW, spineH, spineW, gap } = shelfMetrics(W, H, zoom)
  const R = Math.max(W * 0.4, frontH * 1.45)          // rayon de l'arc : plus il est petit, plus l'étagère se courbe
  const near = frontW / 2 + spineW / 2 + gap, step = spineW + gap
  const active = Math.round(pos)
  const span = Math.ceil((W / 2) / step) + 4
  const out = []
  for (let i = Math.max(0, active - span); i <= Math.min(list.length - 1, active + span); i++) {
    const d = i - pos, ad = Math.abs(d)
    const w = clamp(1 - ad, 0, 1)                       // 1 : de face, 0 : de tranche
    const arc = ad < 1 ? d * near : Math.sign(d) * (near + (ad - 1) * step)
    const a = arc / R
    if (Math.abs(a) > 1.45) continue
    const x = R * Math.sin(a), z = R * (Math.cos(a) - 1)
    const width = spineW + (frontW - spineW) * w, height = spineH + (frontH - spineH) * w
    const s = list[i]
    out.push(
      <div key={s.id} className={'vx-tape' + (i === active ? ' on' : '')}
        style={{ width, height, zIndex: 1000 - Math.round(ad * 2), transform: `translate3d(${x - width / 2}px, ${-height / 2}px, ${z}px) rotateY(${a}rad)`, transition: dragging ? 'none' : undefined }}>
        <button type="button" className="vx-tape-btn" onClick={() => (i === active ? onOpen() : onPick(i))} aria-label={i === active ? `Voir la fiche de ${s.name}` : s.name} tabIndex={ad > 6 ? -1 : 0}>
          <span className="vx-face" style={{ opacity: w }}><CaseFront show={s} /></span>
          <span className="vx-face" style={{ opacity: 1 - w }}><CaseSpine show={s} /></span>
        </button>
        {i === active && canPlay && !dragging && (
          <button type="button" className="vx-play" onClick={onPlay} aria-label={`Lancer le générique de ${s.name}`}><span /></button>
        )}
      </div>,
    )
  }
  return (
    <div className="vx-stage" ref={stageRef}>
      <div className="vx-glyph l" aria-hidden="true">物語</div>
      <div className="vx-glyph r" aria-hidden="true">連続劇</div>
      <div className="vx-floor" style={{ width: Math.min(W * 0.9, frontH * 3.2), top: `calc(50% + ${frontH / 2 - 4}px)` }} />
      <div className="vx-ring">{out}</div>
    </div>
  )
}

/**
 * Une rangée du catalogue : les boîtiers debout sur une planche ; ils pivotent un peu selon
 * leur place dans la rangée (comme une étagère qu'on regarde en passant devant).
 */
function Row({ items, onOpen }) {
  const track = useRef(null)
  useEffect(() => {
    const el = track.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect(), mid = r.left + r.width / 2
      for (const c of el.children) {
        const b = c.getBoundingClientRect()
        const o = clamp((b.left + b.width / 2 - mid) / (r.width / 2), -1.2, 1.2)
        c.style.setProperty('--o', o.toFixed(3))
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const ro = new ResizeObserver(onScroll); ro.observe(el)
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); ro.disconnect(); cancelAnimationFrame(raf) }
  }, [items.length])
  return (
    <div className="ct-shelf">
      <div className="ct-track" ref={track}>
        {items.map((s, i) => (
          <button key={s.id} type="button" className="ct-case" style={{ '--d': `${Math.min(i, 12) * 0.04}s` }} onClick={() => onOpen(s)} aria-label={s.name}>
            <CaseFront show={s} size="w342" />
            {s.rating >= 4 && <span className="ct-heart" aria-hidden="true">★</span>}
          </button>
        ))}
      </div>
      <div className="ct-plank" aria-hidden="true" />
    </div>
  )
}

/** Le titre d'une rangée, qu'on peut renommer. */
function RowHead({ name, count, onShelf, onRename }) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(name)
  const done = () => { setEdit(false); const t = v.trim(); if (t && t !== name) onRename(t); else setV(name) }
  return (
    <header className="ct-head">
      {edit ? (
        <input className="ct-rename" value={v} autoFocus onChange={e => setV(e.target.value)} onBlur={done}
          onKeyDown={e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { setV(name); setEdit(false) } }} aria-label="Nom de la catégorie" />
      ) : (
        <h3 className="ct-name">{name}<button type="button" className="ct-edit" onClick={() => { setV(name); setEdit(true) }} aria-label={`Renommer ${name}`}>✎</button></h3>
      )}
      <span className="ct-count">{pad(count)}</span>
      <span className="ct-rule" />
      <button type="button" className="ct-more" onClick={onShelf}>L’étagère →</button>
    </header>
  )
}

/** Le catalogue : une étagère par catégorie, les unes sous les autres. On zoome pour en voir plus. */
function Catalog({ groups, zoom, onOpen, onShelf, onRename, onZoom }) {
  const box = useRef(null)
  const pinch = useRef(null)
  // pincer pour zoomer (deux doigts), ou ctrl + molette (pavé tactile)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const ts = e => { if (e.touches.length === 2) pinch.current = { d: dist(e.touches), z: zoomRef.current } }
    const tm = e => {
      if (e.touches.length !== 2 || !pinch.current) return
      e.preventDefault()
      onZoomRef.current(clamp(pinch.current.z * dist(e.touches) / pinch.current.d, 0.55, 1.6))
    }
    const te = e => { if (e.touches.length < 2) pinch.current = null }
    const wh = e => { if (!e.ctrlKey) return; e.preventDefault(); onZoomRef.current(clamp(zoomRef.current * Math.exp(-e.deltaY * 0.01), 0.55, 1.6)) }
    el.addEventListener('touchstart', ts, { passive: true })
    el.addEventListener('touchmove', tm, { passive: false })
    el.addEventListener('touchend', te)
    el.addEventListener('wheel', wh, { passive: false })
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('wheel', wh) }
  }, [])
  const zoomRef = useRef(zoom); zoomRef.current = zoom
  const onZoomRef = useRef(onZoom); onZoomRef.current = onZoom
  return (
    <div className="ct" ref={box} style={{ '--z': zoom }}>
      {groups.map(g => (
        <section className="ct-row" key={g.name}>
          <RowHead name={g.name} count={g.items.length} onShelf={() => onShelf(g.name)} onRename={to => onRename(g, to)} />
          <Row items={g.items} onOpen={onOpen} />
        </section>
      ))}
      <p className="ct-hint">Pince pour zoomer · touche un boîtier pour sa fiche</p>
    </div>
  )
}

/** Choisir la catégorie d'une série (ou en créer une). */
function CategoryPicker({ value, all, onChange }) {
  const [adding, setAdding] = useState(false)
  const [v, setV] = useState('')
  const add = () => { const t = v.trim(); if (t) onChange(t); setAdding(false); setV('') }
  return (
    <div className="vx-cats">
      <p className="vx-cats-label">Catégorie</p>
      <div className="vx-chips">
        {all.map(c => (
          <button key={c} type="button" className={'vx-chip' + (c === value ? ' on' : '')} onClick={() => onChange(c)}>{c}</button>
        ))}
        {adding ? (
          <input className="vx-chip-input" value={v} autoFocus placeholder="Nouvelle catégorie" onChange={e => setV(e.target.value)}
            onBlur={add} onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setV('') } }} />
        ) : (
          <button type="button" className="vx-chip add" onClick={() => setAdding(true)}>+ Nouvelle</button>
        )}
      </div>
    </div>
  )
}

/** Le zoom : moins de boîtiers mais plus grands, ou une vue d'ensemble. */
function ZoomBar({ zoom, onZoom }) {
  return (
    <div className="vx-zoom" role="group" aria-label="Zoom">
      <button type="button" onClick={() => onZoom(clamp(zoom / 1.25, 0.55, 1.6))} disabled={zoom <= 0.56} aria-label="Dézoomer (voir plus de séries)">−</button>
      <input type="range" min="0.55" max="1.6" step="0.01" value={zoom} onChange={e => onZoom(+e.target.value)} aria-label="Taille des boîtiers" />
      <button type="button" onClick={() => onZoom(clamp(zoom * 1.25, 0.55, 1.6))} disabled={zoom >= 1.59} aria-label="Zoomer (boîtiers plus grands)">+</button>
    </div>
  )
}

/**
 * Nos séries, à l'intérieur de la télé : on a zoomé à bloc, il ne reste que le contour de
 * l'écran. Le catalogue (une étagère par catégorie), l'étagère courbe d'une catégorie, la fiche
 * d'une série (et son générique), la recherche pour en ajouter.
 */
export default function SeriesTV({ series, onAdd, onUpdate, onRemove, onRenameCategory, onClose }) {
  const byYear = (a, b) => (a.first_air_date || '9999').localeCompare(b.first_air_date || '9999') || a.name.localeCompare(b.name)
  const groups = useMemo(() => {
    const m = new Map()
    for (const s of series) { const c = categoryOf(s); if (!m.has(c)) m.set(c, []); m.get(c).push(s) }
    return [...m].map(([name, items]) => ({ name, items: items.sort(byYear) }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name))
  }, [series])
  const allCats = useMemo(() => groups.map(g => g.name).sort((a, b) => a.localeCompare(b)), [groups])
  const [cat, setCat] = useState(null)          // l'étagère courbe : une catégorie (null : toutes)
  const list = useMemo(() => (cat ? series.filter(s => categoryOf(s) === cat) : [...series]).sort(byYear), [series, cat])
  const [id, setId] = useState(() => null)
  const [view, setView] = useState(() => (series.length ? 'catalog' : 'search'))   // catalog | shelf | detail | search
  const [back, setBack] = useState('catalog')   // d'où vient-on, pour la fiche
  const [closing, setClosing] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [videos, setVideos] = useState({})     // tmdb_id → vidéos (générique d'abord)
  const [drag, setDrag] = useState(null)       // { x0, p0, p }
  const [size, setSize] = useState({ W: 800, H: 400 })
  const [zoom, setZoomState] = useState(readZoom)
  const setZoom = useCallback(z => { setZoomState(z); try { localStorage.setItem(ZOOM_KEY, String(z)) } catch { /* ignore */ } }, [])
  const stageRef = useRef(null)
  const wheel = useRef(0)
  const cur = series.find(s => s.id === id) || null
  const idx = Math.max(0, list.findIndex(s => s.id === id))
  const have = useMemo(() => new Set(series.map(s => s.tmdb_id)), [series])
  const pos = drag ? drag.p : idx

  useEffect(() => { if (view === 'shelf' && !list.some(s => s.id === id) && list.length) setId(list[Math.floor((list.length - 1) / 2)].id) }, [view, list, id])
  useEffect(() => { if (!series.length && view !== 'search') setView('search') }, [series.length, view])
  useEffect(() => { if (view === 'shelf' && cat && !list.length) setCat(null) }, [view, cat, list.length])

  // taille de la scène (l'étagère s'adapte à l'écran)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }))
    ro.observe(el)
    setSize({ W: el.clientWidth, H: el.clientHeight })
    return () => ro.disconnect()
  }, [view])

  // les vidéos de la série choisie (et de ses voisines sur l'étagère)
  useEffect(() => {
    if (!cur) return
    let live = true
    for (const s of [cur, list[idx + 1], list[idx - 1]].filter(Boolean)) {
      if (!s.tmdb_id || videos[s.tmdb_id]) continue
      seriesVideos(s.tmdb_id).then(v => { if (live) setVideos(m => ({ ...m, [s.tmdb_id]: v })) })
    }
    return () => { live = false }
  }, [cur?.tmdb_id]) // eslint-disable-line react-hooks/exhaustive-deps
  const curVideos = (cur && videos[cur.tmdb_id]) || []
  const stopVideo = useCallback(() => setPlaying(false), [])

  const pick = useCallback(i => { const s = list[clamp(i, 0, list.length - 1)]; if (s) setId(s.id) }, [list])
  const go = useCallback(d => pick(idx + d), [pick, idx])
  const openDetail = (s, from) => { setId(s.id); setBack(from); setView('detail') }
  const openShelf = name => { setCat(name); setId(null); setView('shelf') }

  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 320)
  }, [closing, onClose])

  useEffect(() => {
    const k = e => {
      if (e.target?.tagName === 'INPUT') return
      if (e.key === 'Escape') {
        if (playing) setPlaying(false)
        else if (view === 'detail') setView(back)
        else if (view === 'shelf' || (view === 'search' && series.length)) setView('catalog')
        else close()
      } else if (playing || view !== 'shelf') return
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Enter' && cur) openDetail(cur, 'shelf')
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // on fait tourner l'étagère au doigt (ou à la souris)
  const step = () => { const m = shelfMetrics(size.W, size.H, zoom); return m.spineW + m.gap }
  const onDown = e => {
    if (e.button > 0) return
    setDrag({ x0: e.clientX, p0: idx, p: idx, moved: false, id: e.pointerId })
  }
  const onMove = e => {
    if (!drag || drag.id !== e.pointerId) return
    const dx = e.clientX - drag.x0
    if (!drag.moved && Math.abs(dx) < 6) return
    if (!drag.moved) e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ ...drag, moved: true, p: clamp(drag.p0 - dx / (step() * 1.6), -0.4, list.length - 0.6) })
  }
  const onUp = e => {
    if (!drag || drag.id !== e.pointerId) return
    const d = drag
    setDrag(null)
    if (d.moved) pick(Math.round(d.p))
  }
  const onClickCapture = e => { if (drag?.moved) { e.stopPropagation(); e.preventDefault() } }
  const onWheel = e => {
    if (e.ctrlKey) { setZoom(clamp(zoom * Math.exp(-e.deltaY * 0.01), 0.55, 1.6)); return }
    const v = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    wheel.current += v
    if (Math.abs(wheel.current) > 40) { go(wheel.current > 0 ? 1 : -1); wheel.current = 0 }
  }

  const added = s => { const row = onAdd(s); if (row) openDetail(row, 'catalog'); else setView('catalog') }
  const renameGroup = (g, to) => onRenameCategory?.(g.name, to, g.items.map(s => s.id))
  const playLabel = curVideos.length ? (isOpening(curVideos[0]) ? 'Le générique' : 'La bande-annonce') : ''

  return createPortal(
    <div className={'stv vhs' + (closing ? ' closing' : '')} role="dialog" aria-label="Nos séries">
      <div className="stv-bezel">
        <div className={'stv-screen vx-v-' + view} onScroll={e => { e.currentTarget.scrollTop = 0 }}>
          <header className="vx-top">
            <p className="vx-brand">Nos séries <i /> Vidéothèque</p>
            <nav className="vx-nav">
              {view !== 'catalog' && series.length > 0 && <button type="button" className="vx-navbtn" onClick={() => setView('catalog')}>Catalogue</button>}
              {view !== 'search' && <button type="button" className="vx-navbtn" onClick={() => setView('search')}>+ Ajouter</button>}
              <button type="button" className="vx-close" onClick={close} aria-label="Revenir au salon">×</button>
            </nav>
          </header>

          {view === 'search' && <SeriesSearch have={have} onAdd={added} />}

          {view === 'catalog' && (
            <>
              <Catalog groups={groups} zoom={zoom} onZoom={setZoom} onOpen={s => openDetail(s, 'catalog')} onShelf={openShelf} onRename={renameGroup} />
              <ZoomBar zoom={zoom} onZoom={setZoom} />
            </>
          )}

          {view === 'shelf' && list.length > 0 && (
            <>
              <div className="vx-chipsbar">
                <button type="button" className={'vx-chip' + (!cat ? ' on' : '')} onClick={() => setCat(null)}>Toutes</button>
                {allCats.map(c => <button key={c} type="button" className={'vx-chip' + (c === cat ? ' on' : '')} onClick={() => { setCat(c); setId(null) }}>{c}</button>)}
              </div>
              <div className="vx-shelfwrap" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={onClickCapture} onWheel={onWheel}>
                <Shelf list={list} pos={pos} dragging={!!drag?.moved} onPick={pick} onOpen={() => cur && openDetail(cur, 'shelf')}
                  onPlay={() => setPlaying(true)} canPlay={curVideos.length > 0} stageRef={stageRef} size={size} zoom={zoom} />
              </div>
              {cur && (
                <div className="vx-caption">
                  <button type="button" className="vx-arrow" onClick={() => go(-1)} disabled={idx === 0} aria-label="Série précédente">←</button>
                  <div className="vx-cap-mid" key={cur.id}>
                    <h2 className="vx-title">{cur.name}</h2>
                    <p className="vx-meta">{[year(cur), cur.seasons ? `${cur.seasons} saison${cur.seasons > 1 ? 's' : ''}` : '', categoryOf(cur)].filter(Boolean).join('  ·  ')}</p>
                  </div>
                  <button type="button" className="vx-arrow" onClick={() => go(1)} disabled={idx >= list.length - 1} aria-label="Série suivante">→</button>
                </div>
              )}
              <Timeline list={list} idx={idx} onPick={pick} />
              <footer className="vx-foot"><span>{cat || 'Toutes nos séries'} · touche le boîtier du milieu</span><span>N° {pad(idx + 1)} / {pad(list.length)}</span></footer>
              <ZoomBar zoom={zoom} onZoom={setZoom} />
            </>
          )}

          {view === 'detail' && cur && (
            <section className="vx-detail" key={cur.id}>
              <div className="vx-d-text">
                <p className="vx-kicker">{categoryOf(cur)} <i /> {year(cur) || '—'}</p>
                <h2 className="vx-d-title">{cur.name}</h2>
                <p className="vx-d-meta">{[cur.seasons ? `${cur.seasons} saison${cur.seasons > 1 ? 's' : ''}` : '', cur.genres?.slice(0, 2).join(', '), cur.networks?.[0]].filter(Boolean).join('  ·  ')}</p>
                {cur.overview && <p className="vx-d-over">{cur.overview}</p>}
                <Stars value={cur.rating} onChange={r => onUpdate(cur.id, { rating: r })} />
                <CategoryPicker value={categoryOf(cur)} all={allCats} onChange={c => onUpdate(cur.id, { category: c })} />
                <div className="vx-d-actions">
                  {playLabel && <button type="button" className="vx-btn" onClick={() => setPlaying(true)}><span className="vx-btn-ic" aria-hidden="true" />{playLabel}</button>}
                  <button type="button" className="vx-btn ghost" onClick={() => setView(back)}>← {back === 'shelf' ? 'L’étagère' : 'Le catalogue'}</button>
                </div>
                <button type="button" className="vx-remove" onClick={() => { onRemove(cur.id); setView(back) }}>Retirer de nos séries</button>
              </div>
              <div className="vx-d-tape"><CaseFront show={cur} size="w780" /></div>
            </section>
          )}

          {playing && cur && curVideos.length > 0 && <Player show={cur} videos={curVideos} onDone={stopVideo} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}
