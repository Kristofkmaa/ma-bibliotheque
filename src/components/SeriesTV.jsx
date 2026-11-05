import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tmdbImg, searchSeries, seriesDetails, year } from '../lib/tmdb'

const SLIDE_MS = 8000

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

/**
 * Nos séries, à l'intérieur de la télé : on a zoomé à bloc, il ne reste que le contour de
 * l'écran. Une série à l'honneur (grand titre, image, note), les affiches qui montent depuis
 * le bas, et la recherche pour en ajouter.
 */
export default function SeriesTV({ series, onAdd, onUpdate, onRemove, onClose }) {
  const list = useMemo(() => [...series].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.added_at || '').localeCompare(a.added_at || '')), [series])
  const [id, setId] = useState(() => list[0]?.id || null)
  const [searching, setSearching] = useState(() => !series.length)
  const [closing, setClosing] = useState(false)
  const [paused, setPaused] = useState(false)
  const idx = Math.max(0, list.findIndex(s => s.id === id))
  const cur = list[idx] || null
  const have = useMemo(() => new Set(series.map(s => s.tmdb_id)), [series])
  const rail = useRef(null)
  const touch = useRef(null)

  useEffect(() => { if (!cur && list.length) setId(list[0].id) }, [cur, list])

  const go = useCallback(d => { if (list.length) setId(list[(idx + d + list.length) % list.length].id) }, [list, idx])

  // défilement automatique, tant qu'on ne touche à rien
  useEffect(() => {
    if (searching || paused || list.length < 2) return
    const t = setTimeout(() => go(1), SLIDE_MS)
    return () => clearTimeout(t)
  }, [go, searching, paused, list.length, id])

  // l'affiche à l'honneur reste visible dans la rangée
  useEffect(() => {
    const r = rail.current, el = r?.querySelector('.stv-poster.on')
    if (r && el) r.scrollTo({ left: el.offsetLeft - (r.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
  }, [id])

  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 320)
  }, [closing, onClose])

  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape') { if (searching && list.length) setSearching(false); else close() }
      else if (!searching && e.key === 'ArrowRight') go(1)
      else if (!searching && e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [searching, list.length, close, go])

  const added = s => { const row = onAdd(s); if (row) setId(row.id); setSearching(false) }

  const onTouchStart = e => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; setPaused(true) }
  const onTouchEnd = e => {
    const s = touch.current; touch.current = null; setPaused(false)
    if (!s) return
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1)
  }

  return createPortal(
    <div className={'stv' + (closing ? ' closing' : '')} role="dialog" aria-label="Nos séries">
      <div className="stv-bezel">
        <div className="stv-screen" onScroll={e => { e.currentTarget.scrollTop = 0 }}>
          <header className="stv-top">
            <p className="stv-kicker">Nos séries{list.length > 0 && <span> · {String(idx + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}</span>}</p>
            <div className="stv-actions">
              {!searching && <button type="button" className="stv-btn" onClick={() => setSearching(true)}><span aria-hidden="true">+</span> Ajouter</button>}
              {searching && list.length > 0 && <button type="button" className="stv-btn" onClick={() => setSearching(false)}>Nos séries</button>}
              <button type="button" className="stv-x" onClick={close} aria-label="Revenir au salon">×</button>
            </div>
          </header>

          {searching ? (
            <SeriesSearch have={have} onAdd={added} />
          ) : cur ? (
            <>
              <section className="stv-hero" key={cur.id} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
                onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
                <div className="stv-media">
                  {(cur.backdrop_path || cur.poster_path) && <img src={tmdbImg(cur.backdrop_path || cur.poster_path, 'w1280')} alt="" />}
                </div>
                <div className="stv-text">
                  <Rise as="h2" className="stv-title" text={cur.name} delay={0.1} />
                  {meta(cur) && <p className="stv-meta">{meta(cur)}</p>}
                  <Stars value={cur.rating} onChange={r => onUpdate(cur.id, { rating: r })} />
                  {cur.overview && <p className="stv-over">{cur.overview}</p>}
                  <button type="button" className="stv-remove" onClick={() => { onRemove(cur.id); go(1) }}>Retirer de nos séries</button>
                </div>
              </section>
              <nav className="stv-rail" ref={rail} aria-label="Toutes nos séries">
                {list.map((s, i) => (
                  <button key={s.id} type="button" className={'stv-poster' + (s.id === cur.id ? ' on' : '')} style={{ '--d': `${0.25 + Math.min(i, 10) * 0.06}s`, '--h': `${(i * 37) % 3}` }}
                    onClick={() => setId(s.id)} aria-label={s.name} aria-current={s.id === cur.id}>
                    {s.poster_path ? <img src={tmdbImg(s.poster_path, 'w342')} alt="" loading="lazy" /> : <span className="stv-noimg">{s.name}</span>}
                  </button>
                ))}
              </nav>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
