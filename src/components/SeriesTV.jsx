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

// Les tranches : des couleurs de vieilles cassettes, choisies d'après le nom de la série
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

/** Une cassette vue de face : l'affiche dans son boîtier, l'usure, le petit logo VHS. */
function VhsFront({ show, size = 'w500' }) {
  return (
    <span className="vx-front">
      {show.poster_path ? <img src={tmdbImg(show.poster_path, size)} alt="" draggable="false" /> : <span className="vx-front-name">{show.name}</span>}
      <span className="vx-wear" aria-hidden="true" />
      <span className="vx-badge" aria-hidden="true">VHS</span>
    </span>
  )
}

/** Une cassette vue de côté : la tranche, le titre écrit de haut en bas. */
function VhsSpine({ show }) {
  const [bg, fg] = spineOf(show)
  return (
    <span className="vx-spine" style={{ background: bg, color: fg }}>
      <span className="vx-spine-year">{year(show) || '—'}</span>
      <span className="vx-spine-rule" />
      <span className="vx-spine-name">{show.name}</span>
      <span className="vx-spine-rule" />
      <span className="vx-spine-vhs">VHS</span>
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

/**
 * L'étagère courbe : les cassettes sur un arc, celle du milieu de face, les autres de tranche,
 * de plus en plus loin. On la fait tourner au doigt, à la molette, aux flèches.
 */
function Shelf({ list, pos, dragging, onPick, onOpen, onPlay, canPlay, stageRef, size }) {
  const { H, W } = size
  const frontH = clamp(Math.min(H * 0.84, W * 0.5 / 0.62), 120, 560)
  const frontW = frontH * 0.62, spineH = frontH * 0.84, spineW = frontH * 0.15, gap = frontH * 0.028
  const R = Math.max(W * 0.4, frontH * 1.45)          // rayon de l'arc : plus il est petit, plus l'étagère se courbe
  const near = frontW / 2 + spineW / 2 + gap, step = spineW + gap
  const active = Math.round(pos)
  const out = []
  for (let i = Math.max(0, active - 14); i <= Math.min(list.length - 1, active + 14); i++) {
    const d = i - pos, ad = Math.abs(d)
    const w = clamp(1 - ad, 0, 1)                       // 1 : de face, 0 : de tranche
    const arc = ad < 1 ? d * near : Math.sign(d) * (near + (ad - 1) * step)
    const a = arc / R
    const x = R * Math.sin(a), z = R * (Math.cos(a) - 1)
    const width = spineW + (frontW - spineW) * w, height = spineH + (frontH - spineH) * w
    const s = list[i]
    out.push(
      <div key={s.id} className={'vx-tape' + (i === active ? ' on' : '')}
        style={{ width, height, zIndex: 100 - Math.round(ad * 2), transform: `translate3d(${x - width / 2}px, ${-height / 2}px, ${z}px) rotateY(${a}rad)`, transition: dragging ? 'none' : undefined }}>
        <button type="button" className="vx-tape-btn" onClick={() => (i === active ? onOpen() : onPick(i))} aria-label={i === active ? `Voir la fiche de ${s.name}` : s.name} tabIndex={ad > 6 ? -1 : 0}>
          <span className="vx-face" style={{ opacity: w }}><VhsFront show={s} /></span>
          <span className="vx-face" style={{ opacity: 1 - w }}><VhsSpine show={s} /></span>
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
 * Nos séries, à l'intérieur de la télé : on a zoomé à bloc, il ne reste que le contour de
 * l'écran. Nos séries rangées comme des cassettes VHS sur une étagère courbe, par année ;
 * celle du milieu se retourne de face, on la touche pour sa fiche (et son générique).
 */
export default function SeriesTV({ series, onAdd, onUpdate, onRemove, onClose }) {
  const list = useMemo(() => [...series].sort((a, b) => (a.first_air_date || '9999').localeCompare(b.first_air_date || '9999') || a.name.localeCompare(b.name)), [series])
  const [id, setId] = useState(() => list[Math.floor((list.length - 1) / 2)]?.id || null)
  const [view, setView] = useState(() => (series.length ? 'shelf' : 'search'))   // shelf | detail | search
  const [closing, setClosing] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [videos, setVideos] = useState({})     // tmdb_id → vidéos (générique d'abord)
  const [drag, setDrag] = useState(null)       // { x0, p0, p }
  const [size, setSize] = useState({ W: 800, H: 400 })
  const stageRef = useRef(null)
  const wheel = useRef(0)
  const idx = Math.max(0, list.findIndex(s => s.id === id))
  const cur = list[idx] || null
  const have = useMemo(() => new Set(series.map(s => s.tmdb_id)), [series])
  const pos = drag ? drag.p : idx

  useEffect(() => { if (!cur && list.length) setId(list[0].id) }, [cur, list])
  useEffect(() => { if (!list.length && view !== 'search') setView('search') }, [list.length, view])

  // taille de la scène (l'étagère s'adapte à l'écran)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }))
    ro.observe(el)
    setSize({ W: el.clientWidth, H: el.clientHeight })
    return () => ro.disconnect()
  }, [view])

  // les vidéos de la série au milieu (et de ses voisines, pour que le bouton soit prêt)
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

  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 320)
  }, [closing, onClose])

  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape') {
        if (playing) setPlaying(false)
        else if (view === 'detail' || (view === 'search' && list.length)) setView('shelf')
        else close()
      } else if (playing || view === 'search') return
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Enter' && view === 'shelf') setView('detail')
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [view, playing, list.length, close, go])

  // on fait tourner l'étagère au doigt (ou à la souris)
  const step = () => { const H = size.H; const fh = clamp(Math.min(H * 0.84, size.W * 0.5 / 0.62), 120, 560); return fh * 0.178 }
  const onDown = e => {
    if (e.button > 0) return
    setDrag({ x0: e.clientX, p0: idx, p: idx, moved: false, id: e.pointerId })
  }
  const onMove = e => {
    if (!drag || drag.id !== e.pointerId) return
    const dx = e.clientX - drag.x0
    if (!drag.moved && Math.abs(dx) < 6) return
    if (!drag.moved) e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ ...drag, moved: true, p: clamp(drag.p0 - dx / step(), -0.4, list.length - 0.6) })
  }
  const onUp = e => {
    if (!drag || drag.id !== e.pointerId) return
    const d = drag
    setDrag(null)
    if (d.moved) pick(Math.round(d.p))
  }
  const onClickCapture = e => { if (drag?.moved) { e.stopPropagation(); e.preventDefault() } }
  const onWheel = e => {
    const v = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    wheel.current += v
    if (Math.abs(wheel.current) > 60) { go(wheel.current > 0 ? 1 : -1); wheel.current = 0 }
  }

  const added = s => { const row = onAdd(s); if (row) setId(row.id); setView('shelf') }
  const playLabel = curVideos.length ? (isOpening(curVideos[0]) ? 'Le générique' : 'La bande-annonce') : ''

  return createPortal(
    <div className={'stv vhs' + (closing ? ' closing' : '')} role="dialog" aria-label="Nos séries">
      <div className="stv-bezel">
        <div className="stv-screen" onScroll={e => { e.currentTarget.scrollTop = 0 }}>
          <header className="vx-top">
            <p className="vx-brand">Nos séries <i /> Archive VHS</p>
            <nav className="vx-nav">
              {view === 'detail' && <button type="button" className="vx-navbtn" onClick={() => setView('shelf')}>Les cassettes</button>}
              {view === 'shelf' && <button type="button" className="vx-navbtn" onClick={() => setView('search')}>+ Ajouter</button>}
              {view === 'search' && list.length > 0 && <button type="button" className="vx-navbtn" onClick={() => setView('shelf')}>Les cassettes</button>}
              <button type="button" className="vx-close" onClick={close} aria-label="Revenir au salon">×</button>
            </nav>
          </header>

          {view === 'search' && <SeriesSearch have={have} onAdd={added} />}

          {view === 'shelf' && cur && (
            <>
              <div className="vx-shelfwrap" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={onClickCapture} onWheel={onWheel}>
                <Shelf list={list} pos={pos} dragging={!!drag?.moved} onPick={pick} onOpen={() => setView('detail')}
                  onPlay={() => setPlaying(true)} canPlay={curVideos.length > 0} stageRef={stageRef} size={size} />
              </div>
              <div className="vx-caption">
                <button type="button" className="vx-arrow" onClick={() => go(-1)} disabled={idx === 0} aria-label="Cassette précédente">←</button>
                <div className="vx-cap-mid" key={cur.id}>
                  <h2 className="vx-title">{cur.name}</h2>
                  <p className="vx-meta">{[year(cur), cur.seasons ? `${cur.seasons} saison${cur.seasons > 1 ? 's' : ''}` : '', cur.networks?.[0]].filter(Boolean).join('  ·  ')}</p>
                </div>
                <button type="button" className="vx-arrow" onClick={() => go(1)} disabled={idx >= list.length - 1} aria-label="Cassette suivante">→</button>
              </div>
              <Timeline list={list} idx={idx} onPick={pick} />
              <footer className="vx-foot"><span>Archive personnelle · touche la cassette du milieu</span><span>N° {pad(idx + 1)} / {pad(list.length)}</span></footer>
            </>
          )}

          {view === 'detail' && cur && (
            <section className="vx-detail" key={cur.id}>
              <div className="vx-d-text">
                <p className="vx-kicker">Fiche n° {pad(idx + 1)} <i /> {year(cur) || '—'}</p>
                <h2 className="vx-d-title">{cur.name}</h2>
                <p className="vx-d-meta">{[cur.seasons ? `${cur.seasons} saison${cur.seasons > 1 ? 's' : ''}` : '', cur.genres?.slice(0, 2).join(', '), cur.networks?.[0]].filter(Boolean).join('  ·  ')}</p>
                {cur.overview && <p className="vx-d-over">{cur.overview}</p>}
                <Stars value={cur.rating} onChange={r => onUpdate(cur.id, { rating: r })} />
                <div className="vx-d-actions">
                  {playLabel && <button type="button" className="vx-btn" onClick={() => setPlaying(true)}><span className="vx-btn-ic" aria-hidden="true" />{playLabel}</button>}
                  <button type="button" className="vx-btn ghost" onClick={() => setView('shelf')}>← Les cassettes</button>
                </div>
                <button type="button" className="vx-remove" onClick={() => { onRemove(cur.id); go(idx < list.length - 1 ? 1 : -1); setView('shelf') }}>Retirer de nos séries</button>
              </div>
              <div className="vx-d-tape"><VhsFront show={cur} size="w780" /></div>
            </section>
          )}

          {playing && cur && curVideos.length > 0 && <Player show={cur} videos={curVideos} onDone={stopVideo} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}
