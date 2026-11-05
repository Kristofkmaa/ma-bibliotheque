import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tmdbImg, searchSeries, seriesDetails, seriesVideos, year, isMovie, workKey, runtimeLabel } from '../lib/tmdb'

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

const seasonsLabel = s => (s.seasons ? `${s.seasons} saison${s.seasons > 1 ? 's' : ''}` : '')
/** Le détail d'une œuvre : saisons et chaîne pour une série, durée et cinéaste pour un film. */
const lengthLabel = s => (isMovie(s) ? runtimeLabel(s.runtime) : seasonsLabel(s))
const byLabel = s => (isMovie(s) ? (s.networks?.[0] ? `de ${s.networks[0]}` : '') : s.networks?.[0])

/** La recherche, dans la télé : on tape un nom, les affiches montent. */
function SeriesSearch({ have, onAdd }) {
  const empty = have.size === 0
  const [media, setMedia] = useState('tv')
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
      searchSeries(term, media)
        .then(r => { if (live) { setRes(r); setErr('') } })
        .catch(e => { if (live) { setRes([]); setErr(e.message) } })
        .finally(() => { if (live) setBusy(false) })
    }, 320)
    return () => { live = false; clearTimeout(t) }
  }, [q, media])

  const add = async show => {
    if (have.has(workKey(show)) || adding) return
    setAdding(show.tmdb_id)
    let full = show
    try { full = { ...show, ...(await seriesDetails(show.tmdb_id, show.media)) } } catch { /* la recherche suffit */ }
    setAdding(null)
    onAdd(full)
  }

  return (
    <div className="stv-search">
      {empty ? (
        <div className="stv-empty">
          <Rise as="h2" className="stv-title" text="Nos films" delay={0.15} />
          <Rise as="p" className="stv-title it" text="& séries" delay={0.3} />
        </div>
      ) : <p className="stv-search-title">Ajouter {media === 'movie' ? 'un film' : 'une série'}</p>}
      <div className="vx-seg" role="tablist" aria-label="Chercher">
        <button type="button" role="tab" aria-selected={media === 'tv'} className={media === 'tv' ? 'on' : ''} onClick={() => setMedia('tv')}>Séries</button>
        <button type="button" role="tab" aria-selected={media === 'movie'} className={media === 'movie' ? 'on' : ''} onClick={() => setMedia('movie')}>Films</button>
      </div>
      <label className="stv-field">
        <span className="sr-only">{media === 'movie' ? 'Titre du film' : 'Nom de la série'}</span>
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder={media === 'movie' ? 'Amélie, Inception, Le Parrain…' : 'Friends, Lupin, The Crown…'}
          autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
        {busy && <span className="stv-spin" aria-hidden="true" />}
      </label>
      {err && <p className="stv-msg">{/clé|key/i.test(err) ? 'La clé TMDB n’est pas encore réglée sur Vercel.' : 'La recherche ne répond pas, réessaie dans un instant.'}</p>}
      {res && !res.length && !err && <p className="stv-msg">{media === 'movie' ? 'Aucun film trouvé' : 'Aucune série trouvée'} pour « {q.trim()} ».</p>}
      {!res && !err && <p className="stv-msg soft">Tape au moins deux lettres.</p>}
      {res && res.length > 0 && (
        <ul className="stv-results">
          {res.map((s, i) => {
            const got = have.has(workKey(s))
            return (
              <li key={s.tmdb_id} style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}>
                <button type="button" className={'stv-result' + (got ? ' got' : '')} onClick={() => add(s)} disabled={got || adding === s.tmdb_id}>
                  <span className="stv-result-img">
                    {s.poster_path ? <img src={tmdbImg(s.poster_path, 'w185')} alt="" loading="lazy" /> : <span className="stv-noimg">{s.name}</span>}
                    <span className="stv-badge" aria-hidden="true">{got ? '✓' : adding === s.tmdb_id ? '…' : '+'}</span>
                    {got && <span className="stv-inlist">Dans notre liste</span>}
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
  const [started, setStarted] = useState(false)
  const [late, setLate] = useState(false)
  useEffect(() => { setStarted(false); setLate(false); const t = setTimeout(() => setLate(true), 2500); return () => clearTimeout(t) }, [i])
  const frame = useRef(null)
  const v = videos[i]
  useEffect(() => {
    const onMsg = e => {
      let host = ''
      try { host = new URL(e.origin).hostname } catch { return }
      if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return
      let d
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data } catch { return }
      if ((d?.event === 'onStateChange' && d.info === 1) || (d?.event === 'infoDelivery' && d.info?.playerState === 1)) setStarted(true)
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
        {late && !started && <p className="stv-tap">Touche la vidéo pour la lancer</p>}
      </div>
    </div>
  )
}

const pad = n => String(n).padStart(2, '0')
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ZOOM_KEY = 'levana.series.zoom'
const readZoom = () => { try { const z = parseFloat(localStorage.getItem(ZOOM_KEY)); return z > 0 ? clamp(z, 0.55, 1.6) : 1 } catch { return 1 } }
const HERO_MS = 14000

/** La catégorie d'une œuvre : celle qu'on lui a donnée, sinon son genre. */
export const categoryOf = s => s.category || s.genres?.[0] || 'Autres'
const kindLabel = s => (isMovie(s) ? 'Film' : 'Série')

/**
 * La bande-annonce (ou le générique) qui démarre sans le son derrière la grande affiche,
 * comme sur les plateformes ; elle n'apparaît que quand elle tourne vraiment.
 */
function HeroVideo({ videoKey }) {
  const [on, setOn] = useState(false)
  const frame = useRef(null)
  useEffect(() => {
    setOn(false)
    const onMsg = e => {
      if (e.source !== frame.current?.contentWindow) return
      let d
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data } catch { return }
      const st = d?.event === 'onStateChange' ? d.info : d?.event === 'infoDelivery' ? d.info?.playerState : undefined
      if (st === 1) setOn(true)
      else if (st === 0 || d?.event === 'onError') setOn(false)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [videoKey])
  const listen = () => {
    const w = frame.current?.contentWindow
    if (!w) return
    const send = o => w.postMessage(JSON.stringify({ id: 'hero', channel: 'widget', ...o }), '*')
    send({ event: 'listening' })
    send({ event: 'command', func: 'addEventListener', args: ['onStateChange'] })
    send({ event: 'command', func: 'addEventListener', args: ['onError'] })
    send({ event: 'command', func: 'mute' })
  }
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoKey)}?autoplay=1&mute=1&playsinline=1&controls=0&disablekb=1&fs=0&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`
  return (
    <div className={'sx-hero-video' + (on ? ' on' : '')} aria-hidden="true">
      <iframe ref={frame} src={src} title="" tabIndex={-1} onLoad={listen} allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  )
}

/** La grande affiche du haut : l'image de l'œuvre, son titre, deux boutons. */
function Hero({ item, videos, onPlay, onInfo, n, i, onDot }) {
  const [late, setLate] = useState(false)
  useEffect(() => { setLate(false); const t = setTimeout(() => setLate(true), 2600); return () => clearTimeout(t) }, [item.id])
  const v = videos?.[0]
  return (
    <section className="sx-hero" key={item.id}>
      <div className="sx-hero-img">
        {(item.backdrop_path || item.poster_path) && <img src={tmdbImg(item.backdrop_path || item.poster_path, 'w1280')} alt="" />}
        {late && v && <HeroVideo videoKey={v.key} />}
      </div>
      <div className="sx-hero-shade" />
      <div className="sx-hero-text">
        <p className="sx-kicker">{kindLabel(item)} <i /> {categoryOf(item)}</p>
        <h2 className="sx-hero-title">{item.name}</h2>
        <p className="sx-meta">
          {item.rating ? <span className="sx-stars">{'★'.repeat(item.rating)}</span> : null}
          {[year(item), lengthLabel(item), byLabel(item)].filter(Boolean).join('  ·  ')}
        </p>
        {item.overview && <p className="sx-hero-over">{item.overview}</p>}
        <div className="sx-actions">
          {v && <button type="button" className="sx-btn play" onClick={onPlay}><span className="sx-tri" aria-hidden="true" />{isOpening(v) ? 'Générique' : 'Bande-annonce'}</button>}
          <button type="button" className="sx-btn" onClick={onInfo}><span className="sx-i" aria-hidden="true">i</span>Infos</button>
        </div>
      </div>
      {n > 1 && (
        <div className="sx-dots" role="tablist" aria-label="À l'affiche">
          {Array.from({ length: n }, (_, k) => <button key={k} type="button" className={k === i ? 'on' : ''} onClick={() => onDot(k)} aria-label={`Affiche ${k + 1}`} />)}
        </div>
      )}
    </section>
  )
}

/** Une carte : l'image en large, le titre dessus. */
function Card({ s, onOpen, rank }) {
  const img = s.backdrop_path || s.poster_path
  return (
    <button type="button" className="sx-card" onClick={() => onOpen(s)} aria-label={s.name}>
      <span className="sx-card-img">
        {img ? <img src={tmdbImg(img, 'w780')} alt="" loading="lazy" draggable="false" /> : null}
        <span className="sx-card-shade" />
        <span className="sx-card-name">{s.name}</span>
        <span className={'sx-card-kind ' + (isMovie(s) ? 'm' : 't')}>{kindLabel(s)}</span>
        {rank != null && <span className="sx-rank">{rank}</span>}
      </span>
      <span className="sx-card-meta">{[year(s), lengthLabel(s)].filter(Boolean).join(' · ')}{s.rating ? <b> {'★'.repeat(s.rating)}</b> : null}</span>
    </button>
  )
}

/** Une affiche de notre liste : l'image en hauteur, la note, le titre dessous. */
function Poster({ s, onOpen }) {
  return (
    <button type="button" className="sx-poster" onClick={() => onOpen(s)} aria-label={s.name}>
      <span className="sx-poster-img">
        {s.poster_path ? <img src={tmdbImg(s.poster_path, 'w342')} alt="" loading="lazy" draggable="false" /> : <span className="sx-poster-name">{s.name}</span>}
        <span className={'sx-card-kind ' + (isMovie(s) ? 'm' : 't')}>{kindLabel(s)}</span>
        {s.rating ? <span className="sx-poster-rate">★ {s.rating}</span> : null}
      </span>
      <span className="sx-poster-title">{s.name}</span>
      <span className="sx-poster-meta">{[year(s), categoryOf(s)].filter(Boolean).join(' · ')}</span>
    </button>
  )
}

const SORTS = [['added', 'Ajout récent'], ['rating', 'Mieux notés'], ['az', 'A → Z'], ['year', 'Année']]
const sorters = {
  added: (a, b) => (b.added_at || '').localeCompare(a.added_at || ''),
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.added_at || '').localeCompare(a.added_at || ''),
  az: (a, b) => a.name.localeCompare(b.name, 'fr'),
  year: (a, b) => (b.first_air_date || '').localeCompare(a.first_air_date || ''),
}

/** Une rangée qui défile de côté, avec ses flèches sur ordinateur. */
function CardRow({ title, items, onOpen, onRename, ranked }) {
  const track = useRef(null)
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(title)
  const scrollBy = d => { const el = track.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.85, behavior: 'smooth' }) }
  const done = () => { setEdit(false); const t = v.trim(); if (t && t !== title) onRename?.(t); else setV(title) }
  return (
    <section className="sx-row">
      <header className="sx-row-head">
        {edit ? (
          <input className="sx-rename" value={v} autoFocus onChange={e => setV(e.target.value)} onBlur={done}
            onKeyDown={e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { setV(title); setEdit(false) } }} aria-label="Nom de la catégorie" />
        ) : (
          <h3>{title}{onRename && <button type="button" className="sx-edit" onClick={() => { setV(title); setEdit(true) }} aria-label={`Renommer ${title}`}>✎</button>}</h3>
        )}
        <span className="sx-count">{items.length}</span>
      </header>
      <div className="sx-row-wrap">
        <button type="button" className="sx-arrow l" onClick={() => scrollBy(-1)} aria-label="Précédents">‹</button>
        <div className="sx-track" ref={track}>
          {items.map((s, i) => <Card key={s.id} s={s} onOpen={onOpen} rank={ranked ? i + 1 : null} />)}
        </div>
        <button type="button" className="sx-arrow r" onClick={() => scrollBy(1)} aria-label="Suivants">›</button>
      </div>
    </section>
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
 * Nos films et séries, à l'intérieur de l'image projetée : un menu de plateforme de streaming,
 * à notre façon (fond sombre, la grande affiche, des rangées par catégorie, la fiche) ; et la
 * recherche pour en ajouter.
 */
export default function SeriesTV({ series, initialId = null, onAdd, onUpdate, onRemove, onRenameCategory, onClose }) {
  const [kind, setKind] = useState('all')     // notre liste (tout), séries ou films
  const [sort, setSortState] = useState(() => { try { return localStorage.getItem('levana.series.tri') || 'added' } catch { return 'added' } })
  const setSort = v => { setSortState(v); try { localStorage.setItem('levana.series.tri', v) } catch { /* ignore */ } }
  const [catFilter, setCatFilter] = useState(null)   // une catégorie, ou toutes
  const [renaming, setRenaming] = useState(false)
  const shown = useMemo(() => (kind === 'all' ? series : series.filter(s => (kind === 'movie') === isMovie(s))), [series, kind])
  const byAdded = (a, b) => (b.added_at || '').localeCompare(a.added_at || '')
  const groups = useMemo(() => {
    const m = new Map()
    for (const s of shown) { const c = categoryOf(s); if (!m.has(c)) m.set(c, []); m.get(c).push(s) }
    return [...m].map(([name, items]) => ({ name, items: items.sort(byAdded) }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name))
  }, [shown])
  const allCats = useMemo(() => [...new Set(series.map(categoryOf))].sort((a, b) => a.localeCompare(b)), [series])
  const loved = useMemo(() => shown.filter(s => (s.rating || 0) >= 4).sort((a, b) => b.rating - a.rating || byAdded(a, b)), [shown])
  const recent = useMemo(() => [...shown].sort(byAdded).slice(0, 15), [shown])
  // à l'affiche : nos coups de cœur d'abord, sinon les derniers ajoutés
  const featured = useMemo(() => (loved.length ? loved : recent).slice(0, 6), [loved, recent])
  const [hi, setHi] = useState(0)
  const hero = featured[hi % Math.max(1, featured.length)] || null
  const [id, setId] = useState(initialId)     // la fiche ouverte
  const [view, setView] = useState(() => (series.length ? 'home' : 'search'))   // home | search
  const [closing, setClosing] = useState(false)
  const [playing, setPlaying] = useState(null)   // l'œuvre dont on regarde la vidéo
  const [videos, setVideos] = useState({})     // œuvre → vidéos (générique d'abord)
  const [zoom, setZoomState] = useState(readZoom)
  const setZoom = useCallback(z => { setZoomState(z); try { localStorage.setItem(ZOOM_KEY, String(z)) } catch { /* ignore */ } }, [])
  const homeRef = useRef(null)
  const [scrolled, setScrolled] = useState(false)   // l'en-tête prend un fond dès qu'on descend
  const cur = series.find(s => s.id === id) || null
  const have = useMemo(() => new Set(series.map(workKey)), [series])

  useEffect(() => { if (!series.length && view !== 'search') setView('search') }, [series.length, view])
  useEffect(() => { setHi(0); setCatFilter(null) }, [kind])
  useEffect(() => { if (catFilter && !groups.some(g => g.name === catFilter)) setCatFilter(null) }, [groups, catFilter])

  // la grande affiche change toute seule (pas pendant une fiche ou une vidéo)
  useEffect(() => {
    if (view !== 'home' || cur || playing || featured.length < 2) return
    const t = setTimeout(() => setHi(k => (k + 1) % featured.length), HERO_MS)
    return () => clearTimeout(t)
  }, [hi, view, cur, playing, featured.length])

  // les vidéos de ce qu'on regarde (l'affiche, la fiche)
  const want = [hero, cur].filter(Boolean)
  const wantKey = want.map(workKey).join(',')
  useEffect(() => {
    let live = true
    for (const s of want) {
      if (videos[workKey(s)]) continue
      seriesVideos(s.tmdb_id, s.media).then(v => { if (live) setVideos(m => ({ ...m, [workKey(s)]: v })) })
    }
    return () => { live = false }
  }, [wantKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const vidsOf = s => (s && videos[workKey(s)]) || []
  const stopVideo = useCallback(() => setPlaying(null), [])

  // pincer pour zoomer sur l'accueil (deux doigts), ou ctrl + molette
  const zoomRef = useRef(zoom); zoomRef.current = zoom
  useEffect(() => {
    const el = homeRef.current
    if (!el) return
    let p0 = null
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const ts = e => { if (e.touches.length === 2) p0 = { d: dist(e.touches), z: zoomRef.current } }
    const tm = e => { if (e.touches.length !== 2 || !p0) return; e.preventDefault(); setZoom(clamp(p0.z * dist(e.touches) / p0.d, 0.55, 1.6)) }
    const te = e => { if (e.touches.length < 2) p0 = null }
    const wh = e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(clamp(zoomRef.current * Math.exp(-e.deltaY * 0.01), 0.55, 1.6)) }
    el.addEventListener('touchstart', ts, { passive: true })
    el.addEventListener('touchmove', tm, { passive: false })
    el.addEventListener('touchend', te)
    el.addEventListener('wheel', wh, { passive: false })
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('wheel', wh) }
  }, [view, setZoom])

  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 320)
  }, [closing, onClose])

  useEffect(() => {
    const k = e => {
      if (e.target?.tagName === 'INPUT' || e.key !== 'Escape') return
      if (playing) setPlaying(null)
      else if (cur) setId(null)
      else if (view === 'search' && series.length) setView('home')
      else close()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [playing, cur, view, series.length, close])

  const goKind = k => { setKind(k); setId(null); setView('home'); homeRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' }) }
  const added = s => { const row = onAdd(s); setView('home'); if (row) setId(row.id) }
  const renameGroup = (g, to) => onRenameCategory?.(g.name, to, g.items.map(s => s.id))
  const curVideos = vidsOf(cur)
  const tabs = [['all', 'Notre liste'], ['tv', 'Séries'], ['movie', 'Films']]
  const nTv = series.filter(x => !isMovie(x)).length, nMovie = series.length - nTv
  const listItems = [...(catFilter ? shown.filter(x => categoryOf(x) === catFilter) : shown)].sort(sorters[sort] || sorters.added)
  const catGroup = catFilter ? groups.find(g => g.name === catFilter) : null

  return createPortal(
    <div className={'stv sx' + (closing ? ' closing' : '')} role="dialog" aria-label="Nos films et séries">
      <div className="stv-bezel">
        <div className={'stv-screen sx-screen sx-v-' + view} onScroll={e => { e.currentTarget.scrollTop = 0 }}>
          <header className={'sx-top' + (scrolled || view !== 'home' ? ' solid' : '')}>
            <p className="sx-logo">Maruchime<span>films & séries</span></p>
            <nav className="sx-tabs" aria-label="Rayons">
              {tabs.map(([k, l]) => <button key={k} type="button" className={view === 'home' && kind === k ? 'on' : ''} onClick={() => goKind(k)}>{l}</button>)}
            </nav>
            <div className="sx-right">
              <button type="button" className={'sx-add' + (view === 'search' ? ' on' : '')} onClick={() => setView('search')}><span aria-hidden="true">+</span> Ajouter</button>
              <button type="button" className="sx-close" onClick={close} aria-label="Revenir au salon">×</button>
            </div>
          </header>

          {view === 'search' && <SeriesSearch have={have} onAdd={added} />}

          {view === 'home' && (
            <div className="sx-home" ref={homeRef} style={{ '--z': zoom }} onScroll={e => setScrolled(e.currentTarget.scrollTop > 40)}>
              {hero ? (
                <Hero item={hero} videos={vidsOf(hero)} onPlay={() => setPlaying(hero)} onInfo={() => setId(hero.id)}
                  n={featured.length} i={hi % Math.max(1, featured.length)} onDot={setHi} />
              ) : (
                <p className="sx-empty">Rien ici pour l’instant : ajoute {kind === 'movie' ? 'un film' : kind === 'tv' ? 'une série' : 'un film ou une série'}.</p>
              )}
              {loved.length > 0 && (
                <div className="sx-rows">
                  <CardRow title="Nos coups de cœur" items={loved} onOpen={s => setId(s.id)} ranked />
                </div>
              )}
              {/* notre liste : toutes nos affiches, qu'on trie et qu'on filtre */}
              {shown.length > 0 && (
                <section className="sx-list" aria-label="Notre liste">
                  <header className="sx-list-head">
                    <div>
                      <h2 className="sx-list-title">{kind === 'tv' ? 'Nos séries' : kind === 'movie' ? 'Nos films' : 'Notre liste'}</h2>
                      <p className="sx-list-count">
                        {kind === 'all'
                          ? `${series.length} titre${series.length > 1 ? 's' : ''} · ${nTv} série${nTv > 1 ? 's' : ''} · ${nMovie} film${nMovie > 1 ? 's' : ''}`
                          : `${shown.length} titre${shown.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <label className="sx-sort">
                      <span className="sr-only">Trier</span>
                      <select value={sort} onChange={e => setSort(e.target.value)}>
                        {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                  </header>
                  {groups.length > 1 && (
                    <div className="sx-chips" role="tablist" aria-label="Catégories">
                      <button type="button" role="tab" aria-selected={!catFilter} className={!catFilter ? 'on' : ''} onClick={() => setCatFilter(null)}>Toutes</button>
                      {groups.map(g => (
                        <button key={g.name} type="button" role="tab" aria-selected={catFilter === g.name} className={catFilter === g.name ? 'on' : ''} onClick={() => { setCatFilter(g.name); setRenaming(false) }}>
                          {g.name} <span>{g.items.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {catGroup && (
                    renaming ? (
                      <input className="sx-rename sx-rename-cat" defaultValue={catGroup.name} autoFocus aria-label="Nouveau nom de la catégorie"
                        onBlur={e => { const t = e.target.value.trim(); setRenaming(false); if (t && t !== catGroup.name) { renameGroup(catGroup, t); setCatFilter(t) } }}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(false) }} />
                    ) : (
                      <button type="button" className="sx-renamebtn" onClick={() => setRenaming(true)}>✎ Renommer « {catGroup.name} »</button>
                    )
                  )}
                  <div className="sx-grid">
                    {listItems.map(x => <Poster key={x.id} s={x} onOpen={o => setId(o.id)} />)}
                  </div>
                </section>
              )}
              <ZoomBar zoom={zoom} onZoom={setZoom} />
            </div>
          )}

          {cur && (
            <div className="sx-modal" role="dialog" aria-label={cur.name} onClick={e => { if (e.target === e.currentTarget) setId(null) }}>
              <section className="sx-sheet" key={cur.id}>
                <div className="sx-sheet-img">
                  {(cur.backdrop_path || cur.poster_path) && <img src={tmdbImg(cur.backdrop_path || cur.poster_path, 'w1280')} alt="" />}
                  <div className="sx-hero-shade" />
                  <button type="button" className="sx-close sx-sheet-x" onClick={() => setId(null)} aria-label="Fermer la fiche">×</button>
                  <div className="sx-sheet-head">
                    <p className="sx-kicker">{kindLabel(cur)} <i /> {categoryOf(cur)}</p>
                    <h2 className="sx-sheet-title">{cur.name}</h2>
                    <div className="sx-actions">
                      {curVideos.length > 0 && <button type="button" className="sx-btn play" onClick={() => setPlaying(cur)}><span className="sx-tri" aria-hidden="true" />{isOpening(curVideos[0]) ? 'Générique' : 'Bande-annonce'}</button>}
                    </div>
                  </div>
                </div>
                <div className="sx-sheet-body">
                  <p className="sx-meta">{[year(cur), lengthLabel(cur), cur.genres?.slice(0, 2).join(', '), byLabel(cur)].filter(Boolean).join('  ·  ')}</p>
                  {cur.overview && <p className="sx-sheet-over">{cur.overview}</p>}
                  <Stars value={cur.rating} onChange={r => onUpdate(cur.id, { rating: r })} />
                  <CategoryPicker value={categoryOf(cur)} all={allCats} onChange={c => onUpdate(cur.id, { category: c })} />
                  <button type="button" className="sx-remove" onClick={() => { onRemove(cur.id); setId(null) }}>Retirer {isMovie(cur) ? 'ce film' : 'cette série'}</button>
                </div>
              </section>
            </div>
          )}

          {/* téléphone : le menu du bas de la projection */}
          <nav className="tabbar stv-tabs" aria-label="Menu">
            <button type="button" className="tab" onClick={close}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.2L12 4l8.5 7.2M6 9.8V20h12V9.8M10 20v-5.5h4V20" /></svg>
              <span>Salon</span>
            </button>
            <button type="button" className={'tab' + (view === 'home' && kind === 'all' ? ' on' : '')} onClick={() => goKind('all')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="11" rx="1.5" /><path d="M7 19h10" /></svg>
              <span>Notre liste</span>
            </button>
            <button type="button" className="tab tab-shop" onClick={() => setView('search')} aria-label="Ajouter un film ou une série">
              <span className="tab-shop-bubble"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></span>
              <span>Ajouter</span>
            </button>
            <button type="button" className={'tab' + (view === 'home' && kind === 'tv' ? ' on' : '')} onClick={() => goKind('tv')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="11" rx="1.5" /><path d="M9 3.5l3 2.5 3-2.5M8 20h8" /></svg>
              <span>Séries</span>
            </button>
            <button type="button" className={'tab' + (view === 'home' && kind === 'movie' ? ' on' : '')} onClick={() => goKind('movie')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4" /></svg>
              <span>Films</span>
            </button>
          </nav>
          {playing && vidsOf(playing).length > 0 && <Player show={playing} videos={vidsOf(playing)} onDone={stopVideo} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}
