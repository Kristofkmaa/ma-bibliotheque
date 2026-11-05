import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tmdbImg, searchSeries, seriesDetails, seriesVideos, seriesImages, year, isMovie, workKey, runtimeLabel } from '../lib/tmdb'

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

// ---- L'étagère 3D courbe (les boîtiers) -------------------------------------------------
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
const CASE = 0.7                       // largeur / hauteur d'un boîtier, vu de face

/** Un boîtier vu de face, fin comme un Blu-ray : le bandeau bleu en haut, l'affiche, le reflet. */
function CaseFront({ show, size = 'w500' }) {
  return (
    <span className="bx-front">
      <span className="bx-band"><b>{isMovie(show) ? 'Film' : 'Série'}</b><i>{year(show) || ''}</i></span>
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

/** Derrière l'étagère : l'image du film ou de la série du milieu, qui change en fondu. */
function ShelfBackdrop({ show }) {
  const path = show?.backdrop_path || show?.poster_path || null
  const [layers, setLayers] = useState(() => (path ? [path] : []))
  useEffect(() => {
    if (!path) return
    setLayers(l => (l[l.length - 1] === path ? l : [...l.slice(-1), path]))
  }, [path])
  return (
    <div className="sx-shelf-bg" aria-hidden="true">
      {layers.map((p, i) => <img key={p} src={tmdbImg(p, 'w1280')} alt="" className={i === layers.length - 1 ? 'top' : ''} />)}
      <div className="sx-shelf-bg-shade" />
    </div>
  )
}

/** Les grandes images d'une œuvre, qui défilent en fondu (avec un lent mouvement de caméra). */
function Slideshow({ s }) {
  const [imgs, setImgs] = useState(() => [s.backdrop_path || s.poster_path].filter(Boolean))
  const [k, setK] = useState(0)
  useEffect(() => {
    let live = true
    seriesImages(s.tmdb_id, s.media).then(list => {
      if (!live || !list.length) return
      const first = s.backdrop_path
      setImgs([first, ...list.filter(x => x !== first)].filter(Boolean).slice(0, 8))
    })
    return () => { live = false }
  }, [s.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (imgs.length < 2) return
    const t = setInterval(() => setK(n => (n + 1) % imgs.length), 5200)
    return () => clearInterval(t)
  }, [imgs.length])
  return (
    <div className="sx-slides" aria-hidden="true">
      {imgs.map((p, n) => (
        <img key={p} src={tmdbImg(p, 'w1280')} alt="" className={n === k ? 'on' : n === (k + imgs.length - 1) % imgs.length ? 'prev' : ''} style={{ '--dx': n % 2 ? '-2%' : '2%' }} />
      ))}
    </div>
  )
}

/**
 * La page d'un titre, en plein écran : ses images défilent derrière le grand titre, puis sa
 * bande-annonce démarre sans le son ; en dessous, le résumé, la note, la catégorie.
 */
function DetailPage({ s, videos, allCats, onBack, onPlay, onUpdate, onRemove }) {
  const [late, setLate] = useState(false)
  useEffect(() => { setLate(false); const t = setTimeout(() => setLate(true), 6000); return () => clearTimeout(t) }, [s.id])
  const v = videos?.[0]
  return (
    <div className="sx-page" role="dialog" aria-label={s.name}>
      <div className="sx-page-scroll">
        <section className="sx-page-hero">
          <Slideshow s={s} />
          {late && v && <HeroVideo videoKey={v.key} />}
          <div className="sx-page-shade" />
          <button type="button" className="sx-back" onClick={onBack}><span aria-hidden="true">←</span> Notre liste</button>
          <div className="sx-page-head">
            <p className="sx-kicker">{kindLabel(s)} <i /> {categoryOf(s)}</p>
            <h2 className="sx-page-title">{s.name}</h2>
            <p className="sx-page-meta">{[year(s), lengthLabel(s), (s.genres || []).slice(0, 2).join(', ')].filter(Boolean).join('   ·   ')}</p>
            {s.rating ? <p className="sx-page-stars" aria-label={`${s.rating} étoiles sur 5`}>{'★'.repeat(s.rating)}<i>{'★'.repeat(5 - s.rating)}</i></p> : null}
            <div className="sx-actions">
              {v && <button type="button" className="sx-btn play" onClick={onPlay}><span className="sx-tri" aria-hidden="true" />{isOpening(v) ? 'Générique' : 'Bande-annonce'}</button>}
            </div>
          </div>
        </section>
        <section className="sx-page-body">
          {s.overview && <p className="sx-page-over">{s.overview}</p>}
          {byLabel(s) && <p className="sx-page-by">{isMovie(s) ? 'Réalisation' : 'Chaîne'} · <b>{isMovie(s) ? s.networks?.[0] : byLabel(s)}</b></p>}
          <div className="sx-page-block">
            <p className="sx-page-label">Notre note</p>
            <Stars value={s.rating} onChange={r => onUpdate(s.id, { rating: r })} />
          </div>
          <div className="sx-page-block">
            <CategoryPicker value={categoryOf(s)} all={allCats} onChange={c => onUpdate(s.id, { category: c })} />
          </div>
          <button type="button" className="sx-remove" onClick={onRemove}>Retirer {isMovie(s) ? 'ce film' : 'cette série'} de notre liste</button>
        </section>
      </div>
    </div>
  )
}

/** Une ligne de notre liste : la petite affiche, le titre, puis tout ce qu'il faut savoir. */
function ListRow({ s, onOpen }) {
  const genres = (s.genres || []).slice(0, 2).join(', ')
  return (
    <li>
      <button type="button" className="sx-li" onClick={() => onOpen(s)}>
        <span className="sx-li-img">
          {s.poster_path ? <img src={tmdbImg(s.poster_path, 'w185')} alt="" loading="lazy" draggable="false" /> : null}
        </span>
        <span className="sx-li-body">
          <span className="sx-li-title">{s.name}</span>
          <span className="sx-li-meta">
            <span className={'sx-li-kind ' + (isMovie(s) ? 'm' : 't')}>{kindLabel(s)}</span>
            {[year(s), lengthLabel(s)].filter(Boolean).join(' · ')}
          </span>
          <span className="sx-li-sub">
            {genres && <span>{genres}</span>}
            {s.rating ? <span className="sx-li-stars" aria-label={`${s.rating} étoiles sur 5`}>{'★'.repeat(s.rating)}<i>{'★'.repeat(5 - s.rating)}</i></span> : <span className="sx-li-norate">Pas encore notée</span>}
          </span>
        </span>
        <span className="sx-li-chev" aria-hidden="true">›</span>
      </button>
    </li>
  )
}

/** L'intertitre d'une catégorie ; ✎ pour la renommer. */
function SectionTitle({ name, count, onRename }) {
  const [edit, setEdit] = useState(false)
  if (edit) {
    return (
      <input className="sx-rename sx-sec-input" defaultValue={name} autoFocus aria-label="Nouveau nom de la catégorie"
        onBlur={e => { const t = e.target.value.trim(); setEdit(false); if (t && t !== name) onRename(t) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEdit(false) }} />
    )
  }
  return (
    <h3 className="sx-sec-title">{name}<span>{count}</span>
      <button type="button" className="sx-sec-edit" onClick={() => setEdit(true)} aria-label={`Renommer ${name}`}>✎</button>
    </h3>
  )
}

const SORTS = [['cat', 'Par catégorie'], ['added', 'Ajout récent'], ['rating', 'Mieux notés'], ['az', 'A → Z'], ['year', 'Année']]
const sorters = {
  cat: (a, b) => a.name.localeCompare(b.name, 'fr'),
  added: (a, b) => (b.added_at || '').localeCompare(a.added_at || ''),
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.added_at || '').localeCompare(a.added_at || ''),
  az: (a, b) => a.name.localeCompare(b.name, 'fr'),
  year: (a, b) => (b.first_air_date || '').localeCompare(a.first_air_date || ''),
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

/**
 * Nos films et séries, à l'intérieur de l'image projetée : un menu de plateforme de streaming,
 * à notre façon (fond sombre, la grande affiche, des rangées par catégorie, la fiche) ; et la
 * recherche pour en ajouter.
 */
export default function SeriesTV({ series, initialId = null, fromRect = null, onAdd, onUpdate, onRemove, onRenameCategory, onClose }) {
  const [kind, setKind] = useState('all')     // notre liste (tout), séries ou films
  const [sort, setSortState] = useState(() => { try { return localStorage.getItem('levana.series.tri') || 'cat' } catch { return 'cat' } })
  const setSort = v => { setSortState(v); try { localStorage.setItem('levana.series.tri', v) } catch { /* ignore */ } }
  const shown = useMemo(() => (kind === 'all' ? series : series.filter(s => (kind === 'movie') === isMovie(s))), [series, kind])
  const byAdded = (a, b) => (b.added_at || '').localeCompare(a.added_at || '')
  const groups = useMemo(() => {
    const m = new Map()
    for (const s of shown) { const c = categoryOf(s); if (!m.has(c)) m.set(c, []); m.get(c).push(s) }
    return [...m].map(([name, items]) => ({ name, items: items.sort(byAdded) }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name))
  }, [shown])
  const allCats = useMemo(() => [...new Set(series.map(categoryOf))].sort((a, b) => a.localeCompare(b)), [series])
  const [id, setId] = useState(initialId)     // la fiche ouverte
  const [view, setView] = useState(() => (series.length ? 'home' : 'search'))   // home | search
  const [closing, setClosing] = useState(false)
  const [playing, setPlaying] = useState(null)   // l'œuvre dont on regarde la vidéo
  const [videos, setVideos] = useState({})     // œuvre → vidéos (générique d'abord)
  const homeRef = useRef(null)
  // l'étagère 3D (par défaut) ou la liste
  const [layout, setLayoutState] = useState(() => { try { return localStorage.getItem('levana.series.vue3d') || '3d' } catch { return '3d' } })
  const setLayout = v => { setLayoutState(v); try { localStorage.setItem('levana.series.vue3d', v) } catch { /* ignore */ } }
  const [shelfId, setShelfId] = useState(null)
  const [drag, setDrag] = useState(null)        // on fait tourner l'étagère au doigt
  const [size, setSize] = useState({ W: 800, H: 400 })
  const stageRef = useRef(null)
  const wheel = useRef(0)
  const [scrolled, setScrolled] = useState(false)   // l'en-tête prend un fond dès qu'on descend
  const cur = series.find(s => s.id === id) || null
  const have = useMemo(() => new Set(series.map(workKey)), [series])

  useEffect(() => { if (!series.length && view !== 'search') setView('search') }, [series.length, view])


  // les vidéos de ce qu'on regarde (l'affiche, la fiche)
  const want = [cur].filter(Boolean)
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

  // l'étagère 3D : nos titres dans l'ordre du tri (par catégorie : catégorie après catégorie)
  const shelfList = useMemo(() => (sort === 'cat'
    ? groups.flatMap(g => [...g.items].sort(sorters.cat))
    : [...shown].sort(sorters[sort] || sorters.added)), [groups, shown, sort])
  const sIdx = Math.max(0, shelfList.findIndex(x => x.id === shelfId))
  const shelfCur = shelfList[sIdx] || null
  const pos = drag ? drag.p : sIdx
  const pick = useCallback(i => { const x = shelfList[clamp(i, 0, shelfList.length - 1)]; if (x) setShelfId(x.id) }, [shelfList])
  useEffect(() => { if (shelfList.length && !shelfList.some(x => x.id === shelfId)) setShelfId(shelfList[Math.floor((shelfList.length - 1) / 2)].id) }, [shelfList, shelfId])
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }))
    ro.observe(el)
    setSize({ W: el.clientWidth, H: el.clientHeight })
    return () => ro.disconnect()
  }, [view, layout, shelfList.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps
  const step = () => { const m = shelfMetrics(size.W, size.H, 1); return m.spineW + m.gap }
  const onDown = e => { if (e.button > 0) return; setDrag({ x0: e.clientX, p0: sIdx, p: sIdx, moved: false, id: e.pointerId }) }
  const onMove = e => {
    if (!drag || drag.id !== e.pointerId) return
    const dx = e.clientX - drag.x0
    if (!drag.moved && Math.abs(dx) < 6) return
    if (!drag.moved) e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ ...drag, moved: true, p: clamp(drag.p0 - dx / (step() * 1.6), -0.4, shelfList.length - 0.6) })
  }
  const onUp = e => { if (!drag || drag.id !== e.pointerId) return; const d = drag; setDrag(null); if (d.moved) pick(Math.round(d.p)) }
  const onClickCapture = e => { if (drag?.moved) { e.stopPropagation(); e.preventDefault() } }
  const onWheel = e => {
    const v = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    wheel.current += v
    if (Math.abs(wheel.current) > 40) { pick(sIdx + (wheel.current > 0 ? 1 : -1)); wheel.current = 0 }
  }
  const stopVideo = useCallback(() => setPlaying(null), [])

  // comme une vidéo qui passe en plein écran : le menu s'ouvre depuis l'image projetée
  const rootRef = useRef(null)
  const rectInset = useCallback(() => {
    const r = fromRect
    if (!r || !(r.w > 0)) return null
    const W = window.innerWidth, H = window.innerHeight
    return `inset(${Math.max(0, r.y)}px ${Math.max(0, W - r.x - r.w)}px ${Math.max(0, H - r.y - r.h)}px ${Math.max(0, r.x)}px round 6px)`
  }, [fromRect])
  useEffect(() => {
    const el = rootRef.current, from = rectInset()
    if (!el?.animate || !from) return
    el.animate([{ clipPath: from, opacity: 0.6 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }],
      { duration: 650, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'both' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    const el = rootRef.current, to = rectInset()
    if (el?.animate && to) {
      el.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }, { clipPath: to, opacity: 0.4 }],
        { duration: 420, easing: 'cubic-bezier(.5, 0, .8, .4)', fill: 'forwards' }).finished.then(onClose, onClose)
    } else setTimeout(onClose, 320)
  }, [closing, onClose, rectInset])

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

  return createPortal(
    <div ref={rootRef} className={'stv sx' + (closing ? ' closing' : '') + (fromRect ? ' from-rect' : '')} role="dialog" aria-label="Nos films et séries">
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

          {view === 'home' && (<>
            {layout === '3d' && shelfCur && <ShelfBackdrop show={drag?.moved ? shelfList[clamp(Math.round(drag.p), 0, shelfList.length - 1)] : shelfCur} />}
            <div className="sx-home sx-home-list" ref={homeRef} onScroll={e => setScrolled(e.currentTarget.scrollTop > 10)}>
              <section className="sx-list" aria-label="Notre liste">
                <header className="sx-list-head">
                  <div>
                    <h2 className="sx-list-title">{kind === 'tv' ? 'Nos séries' : kind === 'movie' ? 'Nos films' : 'Notre liste'}</h2>
                    <p className="sx-list-count">
                      {kind === 'all'
                        ? `${nTv} série${nTv > 1 ? 's' : ''} · ${nMovie} film${nMovie > 1 ? 's' : ''}`
                        : `${shown.length} titre${shown.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="sx-tools">
                  <div className="sx-view" role="tablist" aria-label="Affichage">
                    <button type="button" role="tab" aria-selected={layout === '3d'} className={layout === '3d' ? 'on' : ''} onClick={() => setLayout('3d')} aria-label="L'étagère en 3D">3D</button>
                    <button type="button" role="tab" aria-selected={layout === 'list'} className={layout === 'list' ? 'on' : ''} onClick={() => setLayout('list')} aria-label="En liste">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><rect x="3.5" y="4.5" width="3" height="3" rx="0.6" /><rect x="3.5" y="10.5" width="3" height="3" rx="0.6" /><rect x="3.5" y="16.5" width="3" height="3" rx="0.6" /></svg>
                    </button>
                  </div>
                  {shown.length > 1 && (
                    <label className="sx-sort">
                      <span className="sr-only">Trier</span>
                      <select value={sort} onChange={e => setSort(e.target.value)}>
                        {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                  )}
                  </div>
                </header>
                {!shown.length && <p className="sx-empty">Rien ici pour l’instant : ajoute {kind === 'movie' ? 'un film' : kind === 'tv' ? 'une série' : 'un film ou une série'}.</p>}
                {layout === '3d' && shelfList.length > 0 ? (
                  <div className="sx-shelf3d">
                    <div className="vx-shelfwrap" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={onClickCapture} onWheel={onWheel}>
                      <Shelf list={shelfList} pos={pos} dragging={!!drag?.moved} onPick={pick} onOpen={() => shelfCur && setId(shelfCur.id)}
                        onPlay={() => shelfCur && setPlaying(shelfCur)} canPlay={false} stageRef={stageRef} size={size} zoom={1} />
                    </div>
                    {shelfCur && (
                      <div className="vx-caption">
                        <button type="button" className="vx-arrow" onClick={() => pick(sIdx - 1)} disabled={sIdx === 0} aria-label="Précédent">←</button>
                        <button type="button" className="vx-cap-mid" key={shelfCur.id} onClick={() => setId(shelfCur.id)}>
                          <h3 className="vx-title">{shelfCur.name}</h3>
                          <p className="vx-meta">{[kindLabel(shelfCur), year(shelfCur), lengthLabel(shelfCur), categoryOf(shelfCur)].filter(Boolean).join('  ·  ')}</p>
                        </button>
                        <button type="button" className="vx-arrow" onClick={() => pick(sIdx + 1)} disabled={sIdx >= shelfList.length - 1} aria-label="Suivant">→</button>
                      </div>
                    )}
                    <Timeline list={shelfList} idx={sIdx} onPick={pick} />
                    <p className="sx-shelf-hint">Glisse pour faire défiler · touche le boîtier du milieu pour l’ouvrir</p>
                  </div>
                ) : (() => {
                  // rangée par catégorie : un intertitre par catégorie ; sinon une seule suite
                  const sections = sort === 'cat'
                    ? groups.map(g => ({ g, name: g.name, items: [...g.items].sort(sorters.cat) }))
                    : [{ name: null, items: [...shown].sort(sorters[sort] || sorters.added) }]
                  return sections.map(sec => (
                    <div className="sx-sec" key={sec.name || 'all'}>
                      {sec.name && <SectionTitle name={sec.name} count={sec.items.length} onRename={to => renameGroup(sec.g, to)} />}
                      <ul className="sx-ul">{sec.items.map(x => <ListRow key={x.id} s={x} onOpen={o => setId(o.id)} />)}</ul>
                    </div>
                  ))
                })()}
              </section>
            </div>
          </>)}

          {cur && (
            <DetailPage key={cur.id} s={cur} videos={curVideos} allCats={allCats} onBack={() => setId(null)} onPlay={() => setPlaying(cur)}
              onUpdate={onUpdate} onRemove={() => { onRemove(cur.id); setId(null) }} />
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
