import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { searchCatalog, featuredCatalog, catalogGame, catalogSource, STATUSES, statusLabel } from '../lib/games'

/**
 * Le PC du bureau gamer : notre ludothèque, dans l'esprit d'un logiciel de jeux. Une barre en
 * haut (← →, Découvrir, Bibliothèque, Personnaliser) ; la bibliothèque : la liste de nos jeux à
 * gauche, à droite notre top ou la fiche du jeu choisi. Le catalogue vient d'IGDB (toutes les
 * plateformes ; Steam en attendant ses clés). Pas d'argent : on ajoute un jeu à sa
 * bibliothèque comme un livre ou un film, avec où on en est (à jouer, en cours, terminé…).
 */

const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return '' } }
const steamArt = (id, f) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/${f}`
const refOf = g => ({ igdb_id: g.igdb_id || null, app_id: g.app_id || null })

/* -------------------------------------------------------------------------- */
/* Icônes                                                                     */
/* -------------------------------------------------------------------------- */

function GamesGlyph() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M14 17h20a8 8 0 0 1 7.8 9.6l-1.6 7.4a4.5 4.5 0 0 1-7.6 2.2L28.5 32h-9l-4.1 4.2a4.5 4.5 0 0 1-7.6-2.2l-1.6-7.4A8 8 0 0 1 14 17z" fill="currentColor" />
      <path d="M15 22.5v6M12 25.5h6" stroke="#1d1430" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="32" cy="23.5" r="1.9" fill="#1d1430" /><circle cx="35.5" cy="27.5" r="1.9" fill="#1d1430" />
    </svg>
  )
}
function StimGlyph() {
  // un nuage de vapeur et une flèche : la boutique
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M14 33a7 7 0 0 1-.8-13.95A10 10 0 0 1 32.6 16a8.5 8.5 0 0 1 1.4 16.9" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M24 22v14M18.5 30.5L24 36l5.5-5.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
const Star = ({ on }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.7 6.6 19.7l1.2-6L3.3 9.5l6.1-.7z" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
const Back = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
function PictureGlyph() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="7" y="10" width="34" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <circle cx="17" cy="19" r="3.4" fill="currentColor" />
      <path d="M9 34l10-9 6 5 7-8 9 10" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
    </svg>
  )
}

function LightGlyph() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 7a12 12 0 0 0-7 21.8V33h14v-4.2A12 12 0 0 0 24 7z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M18.5 38h11M20.5 42.5h7" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}



const PowerGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v8M7 6.5a7.5 7.5 0 1 0 10 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
const SearchGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20 20" /></svg>
const PlayGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
const PlusGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
const CheckGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/** La grande image d'un jeu : celle de Steam s'il y est, sinon celle du catalogue, sinon sa jaquette. */
function Art({ g, className }) {
  const srcs = useMemo(() => [...new Set([g.app_id ? steamArt(g.app_id, 'library_hero.jpg') : null, g.hero, g.heroFallback, g.img || g.cover].filter(Boolean))], [g.app_id, g.hero, g.heroFallback, g.img, g.cover])
  const [k, setK] = useState(0)
  useEffect(() => setK(0), [srcs.join()])  // eslint-disable-line react-hooks/exhaustive-deps
  if (!srcs[k]) return <span className={className + ' art-none'} />
  return <img className={className} key={srcs[k]} src={srcs[k]} alt="" onError={() => setK(v => v + 1)} />
}

/** La jaquette verticale (celle de Steam, plus grande, sinon celle du catalogue). */
function Cover({ g, className = '' }) {
  const srcs = [...new Set([g.app_id ? steamArt(g.app_id, 'library_600x900.jpg') : null, g.img || g.cover, g.coverFallback].filter(Boolean))]
  const [k, setK] = useState(0)
  const src = srcs[k]
  return (
    <span className={'ld-cover ' + className + (!src || (g.app_id && k > 0 && !g.igdb_id) ? ' flat' : '')}>
      {src && <img src={src} alt="" loading="lazy" draggable="false" onError={() => setK(v => v + 1)} />}
      {(!src || (g.app_id && k > 0 && !g.igdb_id)) && <b>{g.name}</b>}
    </span>
  )
}

/** Le logo du jeu (Steam, sans fond), sinon son nom en grand. */
function Logo({ g }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [g.app_id])
  return bad || !g.app_id ? <h2 className="ld-logo-txt">{g.name}</h2>
    : <img className="ld-logo" src={steamArt(g.app_id, 'logo.png')} alt={g.name} onError={() => setBad(true)} />
}

const Platforms = ({ list, max = 6 }) => (list?.length ? <span className="pf-list">{list.slice(0, max).map(p => <i key={p}>{p}</i>)}{list.length > max && <i>+{list.length - max}</i>}</span> : null)
const Score = ({ n }) => (n ? <span className={'pf-score' + (n >= 80 ? ' hi' : n >= 60 ? ' mid' : '')}>{n}</span> : null)

/* -------------------------------------------------------------------------- */
/* La bande-annonce                                                           */
/* -------------------------------------------------------------------------- */

function Trailer({ t, onClose }) {
  const v = t.videos[t.k || 0]
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [onClose])
  return (
    <div className="tr-back" role="dialog" aria-label={`Bande-annonce de ${t.name}`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tr-box">
        <div className="tr-head"><b>{t.name}</b><button type="button" onClick={onClose} aria-label="Fermer">×</button></div>
        <div className="tr-frame">
          {v.yt
            ? <iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.yt)}?autoplay=1&playsinline=1&rel=0&modestbranding=1&cc_load_policy=1&cc_lang_pref=fr&hl=fr`} title={`Bande-annonce de ${t.name}`} allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
            : <video src={v.mp4 || v.webm} poster={v.thumb} controls autoPlay playsInline />}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Découvrir : le catalogue                                                   */
/* -------------------------------------------------------------------------- */

function CatalogCard({ g, mine, onOpen }) {
  return (
    <button type="button" className="ct-card" onClick={() => onOpen(g)}>
      <Cover g={g} />
      {mine && <span className="ct-mine" title="Dans ma bibliothèque"><CheckGlyph /></span>}
      <span className="ct-name">{g.name}</span>
      <span className="ct-meta">{[g.year, g.platforms?.slice(0, 3).join(' · ')].filter(Boolean).join('  —  ')}</span>
    </button>
  )
}

function CatalogRow({ title, list, mine, onOpen }) {
  if (!list?.length) return null
  return (
    <section className="ct-sec">
      <h3 className="cs-h3">{title}</h3>
      <div className="ld-row ct-row">{list.map(g => <CatalogCard key={g.key} g={g} mine={mine(g)} onOpen={onOpen} />)}</div>
    </section>
  )
}

function Discover({ mine, onOpen, onSearch }) {
  const [feat, setFeat] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const load = () => { setErr(null); featuredCatalog().then(setFeat, e => setErr(e.message)) }
  useEffect(load, [])
  const igdb = catalogSource() === 'igdb'
  const lead = feat?.hot?.[0]
  return (
    <div className="ct">
      <form className="st-search cs-search ct-search" onSubmit={e => { e.preventDefault(); if (q.trim()) onSearch(q.trim()) }} role="search">
        <SearchGlyph />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un jeu, sur toutes les plateformes…" enterKeyHint="search" aria-label="Chercher un jeu" />
        {q && <button type="button" onClick={() => setQ('')} aria-label="Effacer">×</button>}
      </form>
      {err ? <div className="st-empty"><p>{err}</p><button type="button" className="st-btn ghost" onClick={load}>Réessayer</button></div>
        : !feat ? <div className="st-loading"><span /></div>
          : <>
            {lead && (
              <button type="button" className="ct-lead" onClick={() => onOpen(lead)}>
                <Art g={lead} className="ct-lead-art" />
                <span className="ct-lead-txt">
                  <span className="cs-hero-kick">{igdb ? 'Le plus suivi en ce moment' : 'À la une'}</span>
                  <b>{lead.name}</b>
                  <span className="ct-lead-meta"><Platforms list={lead.platforms} max={5} /><Score n={lead.rating} /></span>
                </span>
              </button>
            )}
            <CatalogRow title={igdb ? 'Populaires en ce moment' : 'Les plus joués'} list={feat.hot?.slice(lead ? 1 : 0)} mine={mine} onOpen={onOpen} />
            <CatalogRow title={igdb ? 'Les mieux notés de tous les temps' : 'En vedette'} list={feat.best} mine={mine} onOpen={onOpen} />
            <CatalogRow title={igdb ? 'Bientôt' : 'Nouveautés'} list={feat.soon} mine={mine} onOpen={onOpen} />
            {!igdb && <p className="ct-note">Catalogue Steam (PC) pour l’instant : avec les clés IGDB dans Vercel, toutes les plateformes arrivent.</p>}
          </>}
    </div>
  )
}

function CatalogSearch({ q, mine, onOpen }) {
  const [res, setRes] = useState(null)
  useEffect(() => {
    let live = true
    setRes(null)
    searchCatalog(q).then(r => { if (live) setRes(r) }, () => { if (live) setRes([]) })
    return () => { live = false }
  }, [q])
  return (
    <section className="ct">
      <h3 className="cs-h3">Résultats pour « {q} »</h3>
      {!res ? <div className="st-loading"><span /></div>
        : !res.length ? <div className="st-empty"><p>Aucun jeu trouvé.</p></div>
          : <div className="ld-grid ct-grid">{res.map(g => <CatalogCard key={g.key} g={g} mine={mine(g)} onOpen={onOpen} />)}</div>}
    </section>
  )
}

/** La fiche d'un jeu du catalogue : l'ajouter à notre bibliothèque, à notre top, voir sa bande-annonce. */
function CatalogPage({ item, games, findGame, addGame, updateGame, setFavorite, onTrailer, quickWall, openMine, notify }) {
  const [g, setG] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    let live = true
    setG(null); setErr(null)
    catalogGame(item).then(d => { if (live) setG({ ...item, ...d }) }, e => { if (live) setErr(e.message) })
    return () => { live = false }
  }, [item.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const cur = g || item
  const row = findGame(cur) && games.find(x => x.id === findGame(cur).id)
  const add = (extra = {}) => { const r = addGame(cur, extra); notify(`${cur.name} ajouté à ta bibliothèque`); return r }
  const top = () => {
    const r = row || add()
    const n = setFavorite(r.id, !r.favorite)
    notify(n ? `${cur.name} entre dans ton top · n°${n}` : `${cur.name} sort de ton top`)
  }
  const summary = cur.summaryFr || cur.summary
  return (
    <div className="ct-page">
      <div className="ld-hero ct-hero">
        <Art g={cur} className="ld-hero-art" />
        <div className="ct-hero-in">
          <Cover g={cur} className="ct-hero-cover" />
          <div className="ct-hero-txt">
            <h2 className="ld-logo-txt">{cur.name}</h2>
            <p>{[cur.date || cur.year, cur.genres?.slice(0, 3).join(' · ')].filter(Boolean).join('  —  ')}</p>
            <span className="ct-lead-meta"><Platforms list={cur.platforms} max={8} /><Score n={cur.rating} /></span>
          </div>
        </div>
      </div>
      <div className="ld-bar ct-bar">
        {row
          ? <>
            <span className="ct-owned"><CheckGlyph /> Dans ma bibliothèque</span>
            <StatusPick value={row.status} onChange={s => updateGame(row.id, { status: s })} />
            <button type="button" className="st-btn ghost" onClick={() => openMine(row.id)}>Voir dans ma bibliothèque</button>
          </>
          : <>
            <button type="button" className="st-btn buy ld-play" onClick={() => add()}><PlusGlyph /> Ajouter à ma bibliothèque</button>
            <button type="button" className="st-btn ghost" onClick={() => add({ status: 'en_cours' })}>J’y joue en ce moment</button>
          </>}
        <div className="ld-bar-act">
          <button type="button" className={'ld-icon' + (row?.favorite ? ' on' : '')} onClick={top} title={row?.favorite ? 'Retirer de mon top' : 'Ajouter à mon top'} aria-label="Mon top"><Star on={!!row?.favorite} /></button>
          {g?.videos?.length > 0 && <button type="button" className="ld-icon" onClick={() => onTrailer({ name: cur.name, videos: g.videos })} title="Bande-annonce" aria-label="Bande-annonce"><PlayGlyph /></button>}
        </div>
      </div>
      {err && <div className="st-empty"><p>{err}</p></div>}
      {!g && !err && <div className="st-loading"><span /></div>}
      {g && (
        <div className="ld-cols">
          <div className="ld-col-main">
            {g.videos?.length > 0 && (
              <section className="ld-box">
                <h3 className="cs-h3">Vidéos</h3>
                <div className="ct-vids">
                  {g.videos.map((v, k) => (
                    <button type="button" key={k} className="ct-vid" onClick={() => onTrailer({ name: cur.name, videos: g.videos, k })}>
                      <img src={v.yt ? `https://i.ytimg.com/vi/${v.yt}/hqdefault.jpg` : v.thumb} alt="" loading="lazy" />
                      <span><PlayGlyph /></span><em>{v.name || 'Bande-annonce'}</em>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {summary && <section className="ld-box"><h3 className="cs-h3">À propos</h3><p className="ld-about">{summary}</p>{!g.summaryFr && <p className="ct-en">Résumé en anglais (le catalogue n’a pas de traduction).</p>}</section>}
            {g.shots?.length > 0 && <Shots list={g.shots} name={cur.name} g={cur} quickWall={quickWall} />}
          </div>
          <aside className="ld-col-side">
            <Facts g={g} />
          </aside>
        </div>
      )}
    </div>
  )
}

function Facts({ g, row }) {
  return (
    <section className="ld-box">
      <h3 className="cs-h3">Infos</h3>
      <dl className="st-facts">
        {g.platforms?.length > 0 && <><dt>Plateformes</dt><dd>{g.platforms.join(', ')}</dd></>}
        {g.genres?.length > 0 && <><dt>Genres</dt><dd>{g.genres.slice(0, 4).join(', ')}</dd></>}
        {(g.date || g.year) && <><dt>Sortie</dt><dd>{g.date || g.year}</dd></>}
        {g.developers?.length > 0 && <><dt>Studio</dt><dd>{g.developers.join(', ')}</dd></>}
        {g.publishers?.length > 0 && <><dt>Éditeur</dt><dd>{g.publishers.join(', ')}</dd></>}
        {g.rating ? <><dt>Note</dt><dd><Score n={g.rating} /> sur 100{g.votes ? ` · ${g.votes} avis` : ''}</dd></> : null}
        {row && <><dt>Ajouté le</dt><dd>{fmtDate(row.added_at)}</dd></>}
      </dl>
    </section>
  )
}

function Shots({ list, name, g, quickWall }) {
  return (
    <section className="ld-box">
      <h3 className="cs-h3">Images</h3>
      <div className="ld-shots">
        {list.slice(0, 8).map(u => (
          <figure key={u} className="ld-shot">
            <img src={u} alt="" loading="lazy" />
            <button type="button" className="st-wallbtn" onClick={() => quickWall({ url: u, name, app_id: g.app_id || null, igdb_id: g.igdb_id || null })}><PictureGlyph /> En fond d’écran</button>
          </figure>
        ))}
      </div>
    </section>
  )
}

/** Où on en est : à jouer, en cours, terminé, abandonné. */
function StatusPick({ value, onChange }) {
  return (
    <div className="ld-status" role="radiogroup" aria-label="Où j’en suis">
      {STATUSES.map(([k, t]) => <button type="button" key={k} role="radio" aria-checked={value === k} className={'s-' + k + (value === k ? ' on' : '')} onClick={() => onChange(k)}>{t}</button>)}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Mon top                                                                    */
/* -------------------------------------------------------------------------- */

const byRank = (a, b) => (a.fav_rank ?? 1e9) - (b.fav_rank ?? 1e9) || a.added_at.localeCompare(b.added_at)
const Stars = ({ n }) => <span className="gm-stars" aria-label={n ? `${n} sur 5` : 'Pas de note'}>{[1, 2, 3, 4, 5].map(k => <Star key={k} on={(n || 0) >= k} />)}</span>
const Grip = () => <svg viewBox="0 0 24 24" aria-hidden="true">{[7, 12, 17].flatMap(y => [9, 15].map(x => <circle key={x + '-' + y} cx={x} cy={y} r="1.6" fill="currentColor" />))}</svg>

/**
 * « Mon top » : nos jeux préférés, classés. Au doigt, on garde le doigt appuyé sur un jeu
 * (il se soulève, petite vibration) puis on le déplace ; à la souris, on tire la poignée.
 */
function TopList({ top, onOpen, onPlay, onRemove, reorder }) {
  const [drag, setDrag] = useState(null)          // { id, from, dy, h, y0 }
  const dragRef = useRef(null)
  dragRef.current = drag
  const rows = useRef(new Map())
  const press = useRef(null)
  const suppress = useRef(false)
  const listRef = useRef(null)
  // pendant qu'un jeu est soulevé, la page ne défile pas
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const tm = e => { if (dragRef.current) e.preventDefault() }
    el.addEventListener('touchmove', tm, { passive: false })
    return () => el.removeEventListener('touchmove', tm)
  }, [])
  const target = drag ? clampInt(drag.from + Math.round(drag.dy / drag.h), 0, top.length - 1) : -1
  const lift = (id, i, y, el, pointerId) => {
    const h = (rows.current.get(id)?.offsetHeight || 76) + 8
    try { el.setPointerCapture(pointerId) } catch { /* ignore */ }
    navigator.vibrate?.(12)
    suppress.current = true
    setDrag({ id, from: i, dy: 0, h, y0: y })
  }
  const down = (e, g, i) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target.closest('.gm-mini')) return
    const el = e.currentTarget
    if (e.target.closest('.gm-grip')) { e.preventDefault(); lift(g.id, i, e.clientY, el, e.pointerId); return }
    const p = { x: e.clientX, y: e.clientY }
    p.t = setTimeout(() => { press.current = null; lift(g.id, i, p.y, el, e.pointerId) }, 380)
    press.current = p
  }
  const move = e => {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) { clearTimeout(p.t); press.current = null }
    if (dragRef.current) setDrag(d => ({ ...d, dy: e.clientY - d.y0 }))
  }
  const up = () => {
    if (press.current) { clearTimeout(press.current.t); press.current = null }
    if (!drag) return
    if (target !== drag.from) {
      const ids = top.map(g => g.id)
      const [m] = ids.splice(drag.from, 1)
      ids.splice(target, 0, m)
      reorder(ids)
      navigator.vibrate?.(8)
    }
    setDrag(null)
    setTimeout(() => { suppress.current = false }, 60)
  }
  const step = (i, d) => {
    const ids = top.map(g => g.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorder(ids)
  }
  return (
    <ol className={'gm-top' + (drag ? ' dragging' : '')} ref={listRef}>
      {top.map((g, i) => {
        let ty = 0
        if (drag) {
          if (g.id === drag.id) ty = drag.dy
          else if (drag.from < target && i > drag.from && i <= target) ty = -drag.h
          else if (drag.from > target && i < drag.from && i >= target) ty = drag.h
        }
        const rank = drag && g.id === drag.id ? target + 1 : drag ? i + 1 + (ty < 0 ? -1 : ty > 0 ? 1 : 0) : i + 1
        return (
          <li key={g.id} ref={el => (el ? rows.current.set(g.id, el) : rows.current.delete(g.id))}
            className={'gm-top-row' + (rank <= 3 ? ' r' + rank : '') + (drag?.id === g.id ? ' lifted' : '')}
            style={ty ? { transform: `translateY(${ty}px)${drag?.id === g.id ? ' scale(1.02)' : ''}` } : null}
            onPointerDown={e => down(e, g, i)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={e => e.preventDefault()}>
            <span className="gm-grip" aria-hidden="true" title="Glisser pour changer l’ordre"><Grip /></span>
            <span className="gm-rank">{rank}</span>
            <button type="button" className="gm-top-main" onClick={() => { if (!suppress.current) onOpen(g.id) }}>
              <span className="gm-top-img">{g.img && <img src={g.img} alt="" loading="lazy" draggable="false" />}</span>
              <span className="gm-top-txt">
                <b>{g.name}</b>
                <em>{g.genres?.slice(0, 2).join(' · ') || 'Jeu'}</em>
                <Stars n={g.rating} />
              </span>
            </button>
            <span className="gm-top-act">
              <button type="button" className="gm-mini arrow" onClick={() => step(i, -1)} disabled={i === 0} aria-label="Monter">▲</button>
              <button type="button" className="gm-mini arrow" onClick={() => step(i, 1)} disabled={i === top.length - 1} aria-label="Descendre">▼</button>
              <button type="button" className="gm-mini play" onClick={() => onPlay(g)} aria-label={`Bande-annonce de ${g.name}`}><PlayGlyph /></button>
              <button type="button" className="gm-mini" onClick={() => onRemove(g.id)} aria-label="Retirer de mon top">✕</button>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function clampInt(v, a, b) { return Math.max(a, Math.min(b, v)) }


function TopCarousel({ items, ranked = true, onPlay, onGame, strip: showStrip = false }) {
  const n = items.length
  const [k, setK] = useState(0)
  const [hold, setHold] = useState(false)
  const drag = useRef(null)
  const strip = useRef(null)
  const cur = Math.min(k, n - 1)
  const g = items[cur]
  useEffect(() => { if (k >= n) setK(0) }, [n, k])
  useEffect(() => {
    if (hold || n < 2) return
    const t = setTimeout(() => setK(v => (v + 1) % n), 7000)
    return () => clearTimeout(t)
  }, [k, hold, n])
  // la vignette active reste visible dans la rangée
  useEffect(() => { strip.current?.children[cur]?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' }) }, [cur])
  const go = d => setK(v => (v + d + n) % n)   // le minuteur repart de zéro à chaque changement
  const label = i => (ranked ? `N°${i + 1}` : i === 0 ? 'Dernier ajouté' : 'Récent')
  return (
    <section className="cs-car" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      <div className="cs-hero cs-car-stage"
        onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY } }}
        onPointerUp={e => {
          const d = drag.current; drag.current = null
          if (!d) return
          const dx = e.clientX - d.x
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - d.y)) go(dx < 0 ? 1 : -1)
        }}>
        {items.map((x, i) => (Math.abs(i - cur) <= 1 || (cur === 0 && i === n - 1) || (cur === n - 1 && i === 0)) && (
          <div key={x.id} className={'cs-car-slide' + (i === cur ? ' on' : '')} aria-hidden={i !== cur}>
            <Art g={x} className="cs-hero-art" />
          </div>
        ))}
        <div className="cs-hero-txt" key={g.id}>
          <span className="cs-hero-kick">{ranked ? (cur === 0 ? 'Ton n°1' : `N°${cur + 1} de ton top`) : 'Ajouté récemment'}</span>
          <Logo g={g} />
          <span className="cs-car-meta">
            {g.rating ? <Stars n={g.rating} /> : null}
            <em>{[statusLabel(g.status), g.platform || g.platforms?.[0], g.genres?.slice(0, 2).join(' · ')].filter(Boolean).join('  ·  ')}</em>
          </span>
          <span className="cs-hero-act">
            <button type="button" className="st-btn buy big" onClick={() => onGame(g.id)}>Voir le jeu</button>
            <button type="button" className="st-btn ghost" onClick={() => onPlay(g)}><PlayGlyph /> Bande-annonce</button>
          </span>
        </div>
        {n > 1 && <>
          <button type="button" className="cs-car-arrow prev" onClick={() => go(-1)} aria-label="Jeu précédent"><Back /></button>
          <button type="button" className="cs-car-arrow next" onClick={() => go(1)} aria-label="Jeu suivant"><Back /></button>
          <span className="cs-car-count">{cur + 1} / {n}</span>
          {!hold && <span className="cs-car-timer" key={'t' + cur} />}
        </>}
      </div>
      {n > 1 && showStrip && (
        <div className="cs-car-strip" ref={strip} role="tablist" aria-label={ranked ? 'Mon top' : 'Mes jeux'}>
          {items.map((x, i) => (
            <button type="button" key={x.id} role="tab" aria-selected={i === cur} className={'cs-car-thumb' + (i === cur ? ' on' : '') + (ranked && i < 3 ? ' r' + (i + 1) : '')}
              onClick={() => setK(i)}>
              {x.img && <img src={x.img} alt="" loading="lazy" draggable="false" />}
              <span className="cs-car-rank">{ranked ? i + 1 : ''}</span>
              <span className="cs-car-name">{x.name}<em>{label(i)}</em></span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}


/* -------------------------------------------------------------------------- */
/* La bibliothèque : liste à gauche ; à droite notre top ou la fiche du jeu    */
/* -------------------------------------------------------------------------- */

function CoverCard({ g, rank, onOpen, onPlay, onFav }) {
  return (
    <div className={'ld-card' + (rank ? ' ranked' : '') + (rank && rank <= 3 ? ' r' + rank : '')}>
      <button type="button" className="ld-card-btn" onClick={() => onOpen(g.id)} aria-label={g.name}><Cover g={g} /></button>
      {rank ? <span className="ld-card-rank">{rank}</span> : null}
      {g.status && g.status !== 'a_jouer' && <span className={'ld-card-status s-' + g.status}>{statusLabel(g.status)}</span>}
      <span className="ld-card-hover">
        <button type="button" className="ld-card-play" onClick={() => onPlay(g)} aria-label={`Bande-annonce de ${g.name}`}><PlayGlyph /></button>
        <button type="button" className={'ld-card-star' + (g.favorite ? ' on' : '')} onClick={() => onFav(g, !g.favorite)} aria-label={g.favorite ? 'Retirer de mon top' : 'Ajouter à mon top'}><Star on={g.favorite} /></button>
      </span>
      <span className="ld-card-name">{g.name}</span>
    </div>
  )
}

const FILTERS = [['all', 'Tous'], ...STATUSES]

function LudoHome({ games, top, onOpen, onPlay, fav, reorderTop, openStore, filter, setFilter }) {
  const [sort, setSort] = useState('top')
  const [ranking, setRanking] = useState(false)
  const playingNow = useMemo(() => games.filter(g => g.status === 'en_cours'), [games])
  const all = useMemo(() => {
    const by = {
      top: (a, b) => (b.favorite - a.favorite) || (a.fav_rank ?? 1e9) - (b.fav_rank ?? 1e9) || a.name.localeCompare(b.name, 'fr'),
      recent: (a, b) => b.added_at.localeCompare(a.added_at),
      name: (a, b) => a.name.localeCompare(b.name, 'fr'),
      rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name, 'fr'),
    }[sort]
    return games.filter(g => filter === 'all' || g.status === filter).sort(by)
  }, [games, sort, filter])
  if (!games.length) {
    return (
      <div className="gm-empty ld-empty">
        <span className="gm-empty-ico"><GamesGlyph /></span>
        <b>Ta ludothèque est vide</b>
        <p>Cherche tes jeux dans Découvrir — sur toutes les plateformes — et ajoute-les à ta bibliothèque, comme tes livres et tes films.</p>
        <button type="button" className="st-btn buy" onClick={openStore}>Découvrir des jeux</button>
      </div>
    )
  }
  return (
    <div className="ld-home">
      {top.length > 0 ? (
        <TopCarousel items={top} onPlay={onPlay} onGame={onOpen} />
      ) : (
        <section className="ld-banner empty">
          <div className="ld-banner-txt">
            <span className="cs-hero-kick">Mon top</span>
            <h2 className="ld-logo-txt">Classe tes jeux préférés</h2>
            <p>Touche l’étoile <Star on={false} /> d’un jeu : il entre dans ton top, que tu ranges ensuite comme tu veux.</p>
          </div>
        </section>
      )}

      {top.length > 0 && (
        <section className="ld-sec">
          <div className="ld-sec-head">
            <h3 className="cs-h3">Mon top <em>{top.length}</em></h3>
            <button type="button" className={'st-btn ghost ld-rank-btn' + (ranking ? ' on' : '')} onClick={() => setRanking(r => !r)}>{ranking ? 'Terminé' : 'Ranger mon top'}</button>
          </div>
          {ranking
            ? <TopList top={top} onOpen={onOpen} onPlay={onPlay} onRemove={id => fav(games.find(g => g.id === id), false)} reorder={reorderTop} />
            : <div className="ld-row">{top.map((g, i) => <CoverCard key={g.id} g={g} rank={i + 1} onOpen={onOpen} onPlay={onPlay} onFav={fav} />)}</div>}
        </section>
      )}

      {playingNow.length > 0 && (
        <section className="ld-sec">
          <div className="ld-sec-head"><h3 className="cs-h3">En cours <em>{playingNow.length}</em></h3></div>
          <div className="ld-row">{playingNow.map(g => <CoverCard key={g.id} g={g} rank={g.favorite ? g.fav_rank : null} onOpen={onOpen} onPlay={onPlay} onFav={fav} />)}</div>
        </section>
      )}

      <section className="ld-sec">
        <div className="ld-sec-head">
          <h3 className="cs-h3">Toute ma collection <em>{games.length}</em></h3>
          <div className="gm-sort" role="group" aria-label="Trier">
            {[['top', 'Top d’abord'], ['recent', 'Récents'], ['name', 'Nom'], ['rating', 'Ma note']].map(([k, t]) => <button type="button" key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{t}</button>)}
          </div>
        </div>
        <div className="ld-filters" role="group" aria-label="Où j’en suis">
          {FILTERS.map(([k, t]) => {
            const n = k === 'all' ? games.length : games.filter(g => g.status === k).length
            return <button type="button" key={k} className={'s-' + k + (filter === k ? ' on' : '')} onClick={() => setFilter(k)} disabled={!n && k !== 'all'}>{t} <b>{n}</b></button>
          })}
        </div>
        {!all.length ? <p className="st-muted">Aucun jeu ici pour l’instant.</p>
          : <div className="ld-grid">{all.map(g => <CoverCard key={g.id} g={g} rank={g.favorite ? g.fav_rank : null} onOpen={onOpen} onPlay={onPlay} onFav={fav} />)}</div>}
      </section>
    </div>
  )
}

/** La fiche d'un de nos jeux : sa grande image, où on en est, notre note, ses images, ses infos. */
function LudoGame({ g, onPlay, fav, updateGame, removeGame, onWallpaper, onCatalog, onGone, quickWall }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    if (!g) return
    let live = true
    setD(null)
    catalogGame(refOf(g)).then(x => { if (live) setD(x) }, () => { if (live) setD(false) })
    return () => { live = false }
  }, [g?.igdb_id, g?.app_id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return <div className="st-empty"><p>Ce jeu n’est plus dans ta liste.</p></div>
  const platforms = g.platforms?.length ? g.platforms : d?.platforms || []
  const summary = d ? d.summaryFr || d.summary : ''
  return (
    <div className="ld-game" key={g.id}>
      <div className="ld-hero">
        <Art g={{ ...g, heroFallback: d?.hero }} className="ld-hero-art" />
        <div className="ld-hero-logo"><Logo g={g} /></div>
      </div>
      <div className="ld-bar">
        <StatusPick value={g.status} onChange={s => updateGame(g.id, { status: s })} />
        <dl className="ld-stats">
          {platforms.length > 0 && (
            <div><dt>J’y joue sur</dt><dd>
              <select className="ld-select" value={g.platform || ''} onChange={e => updateGame(g.id, { platform: e.target.value || null })} aria-label="Plateforme">
                <option value="">—</option>
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </dd></div>
          )}
          <div><dt>Dans mon top</dt><dd>{g.favorite ? `N°${g.fav_rank}` : '—'}</dd></div>
          <div className="ld-stats-rate"><dt>Ma note</dt><dd>
            {[1, 2, 3, 4, 5].map(n => (
              <button type="button" key={n} className={(g.rating || 0) >= n ? 'on' : ''} onClick={() => updateGame(g.id, { rating: g.rating === n ? null : n })} aria-label={`${n} sur 5`}><Star on={(g.rating || 0) >= n} /></button>
            ))}
          </dd></div>
        </dl>
        <div className="ld-bar-act">
          <button type="button" className={'ld-icon' + (g.favorite ? ' on' : '')} onClick={() => fav(g, !g.favorite)} title={g.favorite ? 'Retirer de mon top' : 'Ajouter à mon top'} aria-label="Mon top"><Star on={g.favorite} /></button>
          <button type="button" className="ld-icon" onClick={() => onPlay(g)} title="Bande-annonce" aria-label="Bande-annonce"><PlayGlyph /></button>
          <button type="button" className="ld-icon" onClick={() => onWallpaper(g)} title="Fond d’écran" aria-label="Choisir un fond d’écran de ce jeu"><PictureGlyph /></button>
          <button type="button" className="ld-icon" onClick={() => onCatalog(g)} title="Fiche du catalogue" aria-label="Fiche du catalogue"><StimGlyph /></button>
        </div>
      </div>
      <div className="ld-cols">
        <div className="ld-col-main">
          {summary && <section className="ld-box"><h3 className="cs-h3">À propos</h3><p className="ld-about">{summary}</p></section>}
          {d?.shots?.length > 0 && <Shots list={d.shots} name={g.name} g={g} quickWall={quickWall} />}
          {d === null && <div className="st-loading"><span /></div>}
        </div>
        <aside className="ld-col-side">
          <Facts g={{ ...(d || {}), platforms, genres: d?.genres?.length ? d.genres : g.genres, date: d?.date || g.release }} row={g} />
          <button type="button" className="gm-link danger" onClick={() => { removeGame(g.id); onGone() }}>Retirer de ma bibliothèque</button>
        </aside>
      </div>
    </div>
  )
}

function Ludo({ games, top, selId, onSelect, onHome, mobile, setFavorite, reorderTop, updateGame, removeGame, onPlay, onWallpaper, onCatalog, quickWall, openStore, notify }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const mainRef = useRef(null)
  useEffect(() => { mainRef.current?.scrollTo?.(0, 0) }, [selId])
  const fav = (g, on) => { const r = setFavorite(g.id, on); notify(on ? `${g.name} entre dans ton top · n°${r}` : `${g.name} sort de ton top`) }
  const t = q.trim().toLowerCase()
  const match = g => !t || g.name.toLowerCase().includes(t)
  const rest = useMemo(() => [...games].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [games])
  const sel = selId ? games.find(g => g.id === selId) : null
  const main = sel || selId
    ? <LudoGame g={sel} onPlay={onPlay} fav={fav} updateGame={updateGame} removeGame={id => { removeGame(id); notify(`${sel?.name} retiré de ta bibliothèque`) }} onWallpaper={onWallpaper} onCatalog={onCatalog} onGone={onHome} quickWall={quickWall} />
    : <LudoHome games={games} top={top} onOpen={onSelect} onPlay={onPlay} fav={fav} reorderTop={reorderTop} openStore={openStore} filter={filter} setFilter={setFilter} />
  if (mobile) return <div className="ld ld-mobile">{main}</div>
  const row = (g, rank) => (
    <button type="button" key={g.id} className={'ld-item' + (g.id === selId ? ' on' : '')} onClick={() => onSelect(g.id)}>
      <span className="ld-item-img">{g.img && <img src={g.img} alt="" loading="lazy" />}</span>
      <span className="ld-item-name">{g.name}{g.platform && <em>{g.platform}</em>}</span>
      {rank ? <span className={'ld-item-rank' + (rank <= 3 ? ' r' + rank : '')}>{rank}</span> : g.status === 'en_cours' ? <span className="ld-item-dot" title="En cours" /> : null}
    </button>
  )
  const topShown = top.filter(match), nowShown = games.filter(g => g.status === 'en_cours' && match(g)), allShown = rest.filter(match)
  return (
    <div className="ld">
      <aside className="ld-side">
        <button type="button" className={'ld-home-btn' + (!selId ? ' on' : '')} onClick={onHome}><GamesGlyph /> Ma ludothèque</button>
        <label className="gm-find ld-find">
          <SearchGlyph />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Retrouver un jeu…" aria-label="Retrouver un jeu" />
        </label>
        <div className="ld-list">
          {topShown.length > 0 && <><h4>Mon top <em>{top.length}</em></h4>{topShown.map(g => row(g, g.fav_rank))}</>}
          {nowShown.length > 0 && <><h4>En cours <em>{nowShown.length}</em></h4>{nowShown.map(g => row(g, null))}</>}
          <h4>Tous mes jeux <em>{games.length}</em></h4>
          {allShown.map(g => row(g, null))}
          {!allShown.length && <p className="st-muted ld-none">{games.length ? 'Aucun jeu ne correspond.' : 'Aucun jeu pour l’instant.'}</p>}
        </div>
      </aside>
      <div className="ld-main" ref={mainRef}>
        <div className="ld-main-in" key={selId || 'home'}>{main}</div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Fond d'écran                                                               */
/* -------------------------------------------------------------------------- */

function Wallpapers({ games, wallpaper, setWallpaper, request }) {
  const first = request || (wallpaper?.name ? { name: wallpaper.name, igdb_id: wallpaper.igdb_id, app_id: wallpaper.app_id } : games[0] || null)
  const [game, setGame] = useState(first ? { name: first.name, ...refOf(first) } : null)
  const [pending, setPending] = useState(wallpaper)
  const [imgs, setImgs] = useState(null)
  const [bad, setBad] = useState(() => new Set())
  const [q, setQ] = useState('')
  const [found, setFound] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (request) setGame({ name: request.name, ...refOf(request) }) }, [request])
  useEffect(() => {
    if (!game) return
    let live = true
    setImgs(null)
    const steam = game.app_id ? [steamArt(game.app_id, 'library_hero.jpg')] : []
    catalogGame(game).then(d => { if (live) setImgs([...new Set([...steam, ...(d.art || []), d.hero].filter(Boolean))]) }, () => { if (live) setImgs(steam) })
    return () => { live = false }
  }, [game?.igdb_id, game?.app_id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 2200); return () => clearTimeout(t) }, [saved])
  const search = e => {
    e.preventDefault()
    const t = q.trim()
    if (!t) return
    setFound([])
    searchCatalog(t).then(r => setFound(r.slice(0, 12)), () => setFound([]))
  }
  const apply = w => { setWallpaper(w); setPending(w); setSaved(true) }
  const same = (pending?.url || null) === (wallpaper?.url || null)
  const list = (imgs || []).filter(u => !bad.has(u))
  const isOn = g => game && ((g.igdb_id && g.igdb_id === game.igdb_id) || (!g.igdb_id && g.app_id && g.app_id === game.app_id))
  const chip = (g, i) => (
    <button type="button" key={(g.key || g.id) + '-' + i} className={'wp-chip' + (isOn(g) ? ' on' : '')} onClick={() => setGame({ name: g.name, ...refOf(g) })}>
      {(g.img || g.cover) && <img src={g.img || g.cover} alt="" loading="lazy" />}<span>{g.name}</span>
    </button>
  )
  const wall = u => ({ url: u, name: game.name, ...refOf(game) })
  return (
    <div className="wp">
      <div className="wp-left">
        <div className="wp-preview">
          {pending?.url ? <img key={pending.url} src={pending.url} alt="" /> : <span className="wp-default" />}
          <span className="wp-fake-bar top" aria-hidden="true" />
        </div>
        <p className="wp-cap">{pending?.url ? <>Image de <b>{pending.name}</b></> : 'Fond Maruchime (par défaut)'}</p>
        <div className="wp-act">
          <button type="button" className="st-btn buy" disabled={same} onClick={() => apply(pending)}>{same ? 'Fond actuel' : 'Appliquer'}</button>
          <button type="button" className="st-btn ghost" disabled={!pending && !wallpaper} onClick={() => apply(null)}>Fond Maruchime</button>
        </div>
        {saved && <p className="wp-ok">Fond d’écran appliqué ✓</p>}
      </div>
      <div className="wp-right">
        {games.length > 0 && <>
          <h4>Mes jeux</h4>
          <div className="wp-chips">{games.map(chip)}</div>
        </>}
        <form className="st-search wp-search" onSubmit={search} role="search">
          <SearchGlyph />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Un autre jeu…" enterKeyHint="search" aria-label="Chercher un jeu" />
        </form>
        {found && (found.length ? <div className="wp-chips">{found.map(chip)}</div> : <p className="st-muted">Recherche…</p>)}
        {game && <>
          <h4>Images de {game.name}</h4>
          {!imgs ? <div className="st-loading"><span /></div> : !list.length ? <p className="st-muted">Pas d’image pour ce jeu.</p> : (
            <div className="wp-grid">
              {list.map(u => (
                <button type="button" key={u} className={'wp-img' + (pending?.url === u ? ' on' : '')} onClick={() => setPending(wall(u))} onDoubleClick={() => apply(wall(u))}>
                  <img src={u} alt="" loading="lazy" onError={() => setBad(b => new Set(b).add(u))} />
                </button>
              ))}
            </div>
          )}
        </>}
        {!game && <p className="st-muted">Choisis un jeu pour voir ses images.</p>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Lumières RGB : la tour et le clavier                                       */
/* -------------------------------------------------------------------------- */

const COLORS = [
  ['rainbow', 'Arc-en-ciel'], ['#7A5CFF', 'Violet'], ['#2F7BFF', 'Bleu'], ['#22D3EE', 'Cyan'], ['#34E07A', 'Vert'],
  ['#F6B93B', 'Or'], ['#FF7A1A', 'Orange'], ['#FF3B4E', 'Rouge'], ['#FF5FC8', 'Rose'], ['#F2F2FF', 'Blanc'],
]
const RAINBOW = 'conic-gradient(#FF3B4E, #F6B93B, #34E07A, #22D3EE, #2F7BFF, #7A5CFF, #FF5FC8, #FF3B4E)'

function Swatches({ value, onPick, label }) {
  return (
    <div className="lt-sw" role="radiogroup" aria-label={label}>
      {COLORS.map(([c, name]) => (
        <button type="button" key={c} role="radio" aria-checked={value === c} className={value === c ? 'on' : ''} title={name} aria-label={name}
          style={{ background: c === 'rainbow' ? RAINBOW : c, '--c': c === 'rainbow' ? '#fff' : c }} onClick={() => onPick(c)} />
      ))}
    </div>
  )
}

function Lights({ setup, setSetup }) {
  const pc = setup?.pc || 'rainbow', kb = setup?.kb || 'rainbow'
  const name = c => COLORS.find(x => x[0] === c)?.[1] || ''
  const glow = c => (c === 'rainbow' ? undefined : c)
  return (
    <div className="lt">
      <div className={'lt-scene' + (pc === 'rainbow' ? ' rb-pc' : '') + (kb === 'rainbow' ? ' rb-kb' : '')} style={{ '--pc': glow(pc), '--kb': glow(kb) }} aria-hidden="true">
        <span className="lt-glow" />
        <span className="lt-tower"><i /><i /><i /></span>
        <span className="lt-kb">{Array.from({ length: 36 }, (_, i) => <i key={i} />)}</span>
        <span className="lt-strip" />
      </div>
      <section>
        <h4>Le PC <em>tour, ventilateurs et bandeau du bureau · {name(pc)}</em></h4>
        <Swatches value={pc} onPick={c => setSetup({ pc: c })} label="Couleur du PC" />
      </section>
      <section>
        <h4>Le clavier <em>{name(kb)}</em></h4>
        <Swatches value={kb} onPick={c => setSetup({ kb: c })} label="Couleur du clavier" />
      </section>
      <button type="button" className="st-btn ghost lt-same" onClick={() => setSetup({ kb: pc })} disabled={pc === kb}>Clavier assorti au PC</button>
      <p className="st-muted">Les lumières changent aussi sur le bureau du salon.</p>
    </div>
  )
}

function Custom({ tab, setTab, ...p }) {
  return (
    <div className="cu">
      <div className="gm-bar-top cu-tabs">
        <div className="st-tabs">
          <button type="button" className={tab === 'wall' ? 'on' : ''} onClick={() => setTab('wall')}>Fond d’écran</button>
          <button type="button" className={tab === 'lights' ? 'on' : ''} onClick={() => setTab('lights')}>Lumières RGB</button>
        </div>
      </div>
      {tab === 'wall' ? <Wallpapers {...p} /> : <Lights setup={p.setup} setSetup={p.setSetup} />}
    </div>
  )
}

function Clock() {
  const [d, setD] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setD(new Date()), 15000); return () => clearInterval(t) }, [])
  return (
    <span className="pc-clock">
      <b>{d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</b>
      <em>{d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</em>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Le logiciel : une barre en haut (← →, Découvrir, Bibliothèque, Personnaliser) */
/* -------------------------------------------------------------------------- */

const NAV = [['stim', 'Découvrir'], ['games', 'Bibliothèque'], ['custom', 'Personnaliser']]
const ROOT = { stim: { v: 'store' }, games: { v: 'list' }, custom: { v: 'main' } }
const Fwd = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
const entryKey = e => (e.item ? e.v + ':' + e.item.key : JSON.stringify(e))

export default function PcOS({ games, addGame, findGame, updateGame, removeGame, setFavorite, reorderTop, wallpaper, setWallpaper, setup, setSetup, holder, fromRect, onClose }) {
  const mobile = useIsMobile()
  const rootRef = useRef(null)
  const [closing, setClosing] = useState(false)
  // où l'on est, et l'historique (les flèches ← →), comme un navigateur
  const [nav, setNav] = useState({ cur: { tab: 'games', e: ROOT.games }, past: [], future: [] })
  const [last, setLast] = useState({ ...ROOT })        // le dernier écran vu dans chaque onglet
  const [dir, setDir] = useState('tab')
  const [trailer, setTrailer] = useState(null)
  const [toast, setToast] = useState(null)
  const [customTab, setCustomTab] = useState('wall')
  const [wallFor, setWallFor] = useState(null)
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t) }, [toast])

  // l'écran s'agrandit depuis le moniteur 3D (et s'y range en partant)
  const rectInset = useCallback(r => {
    if (!r || !(r.w > 0)) return null
    const W = window.innerWidth, H = window.innerHeight
    return `inset(${Math.max(0, r.y)}px ${Math.max(0, W - r.x - r.w)}px ${Math.max(0, H - r.y - r.h)}px ${Math.max(0, r.x)}px round 14px)`
  }, [])
  useEffect(() => {
    const el = rootRef.current, from = rectInset(fromRect)
    if (!el?.animate || !from) return
    el.animate([{ clipPath: from, opacity: 0.7 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'both' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    const el = rootRef.current, to = rectInset(fromRect)
    if (el?.animate && to) el.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }, { clipPath: to, opacity: 0.5 }], { duration: 420, easing: 'cubic-bezier(.5, 0, .8, .4)', fill: 'forwards' }).finished.then(onClose, onClose)
    else setTimeout(onClose, 300)
  }, [closing, onClose, rectInset, fromRect])

  const top = useMemo(() => games.filter(g => g.favorite).sort(byRank), [games])
  const mine = useCallback(item => !!findGame(item), [findGame, games]) // eslint-disable-line react-hooks/exhaustive-deps
  const { tab, e: cur } = nav.cur

  const navigate = (t, e, d = 'fwd') => {
    setDir(d)
    setNav(n => ({ cur: { tab: t, e }, past: [...n.past, n.cur].slice(-40), future: [] }))
    setLast(l => ({ ...l, [t]: e }))
  }
  const goTab = t => navigate(t, t === tab ? ROOT[t] : last[t] || ROOT[t], 'tab')
  const back = useCallback(() => {
    if (trailer) { setTrailer(null); return true }
    if (!nav.past.length) return false
    setDir('back')
    setNav(n => { const p = n.past[n.past.length - 1]; setLast(l => ({ ...l, [p.tab]: p.e })); return { cur: p, past: n.past.slice(0, -1), future: [n.cur, ...n.future] } })
    return true
  }, [trailer, nav.past.length])
  const forward = () => {
    if (!nav.future.length) return
    setDir('fwd')
    setNav(n => { const f = n.future[0]; setLast(l => ({ ...l, [f.tab]: f.e })); return { cur: f, past: [...n.past, n.cur], future: n.future.slice(1) } })
  }
  // la bande-annonce d'un jeu (de notre bibliothèque ou du catalogue)
  const playTrailer = g => {
    catalogGame(refOf(g)).then(d => {
      if (d.videos?.length) setTrailer({ name: g.name, videos: d.videos })
      else setToast(`Pas de bande-annonce pour ${g.name}`)
    }, () => setToast('Le catalogue ne répond pas'))
  }
  const openGame = id => navigate('games', { v: 'game', id })
  const openItem = item => navigate('stim', { v: 'game', item })
  const toCatalog = g => openItem({ key: g.igdb_id ? 'igdb:' + g.igdb_id : 'steam:' + g.app_id, ...refOf(g), name: g.name, cover: g.img, hero: g.hero, platforms: g.platforms, genres: g.genres })
  const chooseWall = g => { setWallFor(g ? { name: g.name, ...refOf(g) } : null); setCustomTab('wall'); navigate('custom', { v: 'main', k: Date.now() }) }
  const quickWall = w => { setWallpaper(w); setToast(`Nouveau fond d’écran : ${w.name}`) }

  useEffect(() => {
    const k = e => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT') return
      if (e.key === 'Escape') { if (!back()) close() }
      else if (e.altKey && e.key === 'ArrowLeft') back()
      else if (e.altKey && e.key === 'ArrowRight') forward()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // au doigt : glisser depuis le bord gauche = Retour
  const touch = useRef(null)
  const onTouchStart = e => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, edge: t.clientX < 24 } }
  const onTouchEnd = e => {
    const s = touch.current; touch.current = null
    if (!s) return
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y
    if (s.edge && dx > 70 && Math.abs(dy) < 60) back()
  }

  const ld = tab === 'games' && !mobile
  let body = null
  if (tab === 'stim') {
    if (cur.v === 'store') body = <Discover mine={mine} onOpen={openItem} onSearch={q => navigate('stim', { v: 'search', q })} />
    else if (cur.v === 'search') body = <CatalogSearch q={cur.q} mine={mine} onOpen={openItem} />
    else body = <CatalogPage item={cur.item} games={games} findGame={findGame} addGame={addGame} updateGame={updateGame} setFavorite={setFavorite}
      onTrailer={setTrailer} quickWall={quickWall} openMine={openGame} notify={setToast} />
  } else if (tab === 'games') {
    body = <Ludo games={games} top={top} selId={cur.v === 'game' ? cur.id : null} onSelect={openGame} onHome={() => navigate('games', ROOT.games, 'back')} mobile={mobile}
      setFavorite={setFavorite} reorderTop={reorderTop} updateGame={updateGame} removeGame={removeGame} onPlay={playTrailer} onWallpaper={chooseWall} onCatalog={toCatalog} quickWall={quickWall} openStore={() => goTab('stim')} notify={setToast} />
  } else {
    body = <Custom tab={customTab} setTab={setCustomTab} games={games} wallpaper={wallpaper} setWallpaper={setWallpaper} request={wallFor} setup={setup} setSetup={setSetup} />
  }

  return (
    <div ref={rootRef} className={'pcos cs cl in-app' + (closing ? ' closing' : '') + (mobile ? ' mobile' : '')} role="application" aria-label="Le PC"
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="cs-bg" aria-hidden="true">
        {wallpaper?.url ? <img key={wallpaper.url} src={wallpaper.url} alt="" /> : <div className="pc-wall"><i /><i /><i /></div>}
      </div>

      <header className="cl-top">
        <div className="cl-arrows">
          <button type="button" onClick={back} disabled={!nav.past.length && !trailer} aria-label="Retour" title="Retour"><Back /></button>
          <button type="button" onClick={forward} disabled={!nav.future.length} aria-label="Suivant" title="Suivant"><Fwd /></button>
        </div>
        <nav className="cl-nav" aria-label="Maruchime OS">
          {NAV.map(([k, label]) => (
            <button type="button" key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => goTab(k)}>{label}</button>
          ))}
        </nav>
        <div className="cl-right">
          {!mobile && <Clock />}
          {!mobile && holder && <span className="cl-user"><span className="pc-orb" />{holder.split(' ')[0]}</span>}
          <button type="button" className="cl-power" onClick={close} aria-label="Éteindre et revenir au salon" title="Éteindre et revenir au salon"><PowerGlyph /></button>
        </div>
      </header>

      <main className="cl-main">
        <div className={'cs-body st-body ' + (ld ? 'ld-body enter-tab' : 'enter-' + dir)} key={ld ? 'games' : tab + ':' + entryKey(cur)}>{body}</div>
      </main>

      {trailer && <Trailer t={trailer} onClose={() => setTrailer(null)} />}
      {toast && <div className="pc-toast cs-toast" role="status">{toast}</div>}
    </div>
  )
}
