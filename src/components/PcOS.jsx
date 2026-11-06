import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { featuredGames, searchGames, gameDetails, fmtPrice } from '../lib/steam'

/**
 * Le PC du bureau gamer : « Maruchime OS », pensé comme une console de salon — la même
 * interface au doigt et à la souris. Un écran d'accueil (notre n°1, de grosses tuiles, les
 * derniers jeux), des applis en plein écran avec un seul bouton « Retour », une barre
 * d'onglets en bas (Accueil, Magasin, Mes jeux, Personnaliser). Le porte-monnaie et la
 * banque montent du bas, en panneaux.
 * L'argent est pour de faux : la « Banque Maruchime » a un solde illimité, on vire ce qu'on
 * veut vers son porte-monnaie Stim en faisant glisser un curseur (aucune vraie carte).
 */

const plain = html => { try { return new DOMParser().parseFromString(html, 'text/html').body.textContent || '' } catch { return html } }
/** Un solde : « 0,00 € » (jamais « Gratuit »). */
const money = v => `${(v || 0).toFixed(2).replace('.', ',')} €`
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return '' } }

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
function BankGlyph() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="7" y="13" width="34" height="23" rx="4" fill="currentColor" />
      <rect x="7" y="18" width="34" height="4.5" fill="#132018" />
      <rect x="12" y="27" width="9" height="4" rx="1" fill="#132018" opacity="0.6" />
    </svg>
  )
}
const Star = ({ on }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.7 6.6 19.7l1.2-6L3.3 9.5l6.1-.7z" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
const Back = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
const Wallet = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" fill="none" stroke="currentColor" strokeWidth="1.8" /><rect x="4" y="8" width="16.5" height="11" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="16.5" cy="13.5" r="1.3" fill="currentColor" /></svg>

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



/* -------------------------------------------------------------------------- */
/* Stim : les pages de jeux                                                   */
/* -------------------------------------------------------------------------- */

function PriceTag({ price, original, discount }) {
  if (price == null) return <span className="st-price none">—</span>
  const d = discount || (original && original > price ? Math.round((1 - price / original) * 100) : 0)
  return (
    <span className="st-price">
      {d > 0 && <b className="st-disc">−{d}%</b>}
      {d > 0 && original ? <s>{fmtPrice(original)}</s> : null}
      <span>{fmtPrice(price)}</span>
    </span>
  )
}

function GameCard({ g, owned, onOpen, wide }) {
  return (
    <button type="button" className={'st-card' + (wide ? ' wide' : '')} onClick={() => onOpen(g.id)}>
      <span className="st-card-img">{g.img && <img src={g.img} alt="" loading="lazy" onError={e => { e.currentTarget.style.opacity = 0 }} />}</span>
      <span className="st-card-name">{g.name}</span>
      <span className="st-card-foot">{owned ? <span className="st-owned">Dans ta bibliothèque</span> : <PriceTag price={g.price} original={g.original} discount={g.discount} />}</span>
    </button>
  )
}

function Row({ title, list, owned, onOpen }) {
  if (!list?.length) return null
  return (
    <section className="st-row">
      <h3>{title}</h3>
      <div className="st-row-track">{list.map(g => <GameCard key={g.id} g={g} owned={owned(g.id)} onOpen={onOpen} />)}</div>
    </section>
  )
}

function Hero({ list, owned, onOpen }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    if (!list?.length) return
    const t = setInterval(() => setK(n => (n + 1) % list.length), 6000)
    return () => clearInterval(t)
  }, [list])
  if (!list?.length) return null
  const g = list[k % list.length]
  return (
    <section className="st-hero">
      <button type="button" className="st-hero-main" onClick={() => onOpen(g.id)} key={g.id}>
        <img src={g.img} alt="" />
        <span className="st-hero-info">
          <span className="st-kicker">À la une</span>
          <span className="st-hero-name">{g.name}</span>
          {owned(g.id) ? <span className="st-owned">Dans ta bibliothèque</span> : <PriceTag price={g.price} original={g.original} discount={g.discount} />}
        </span>
      </button>
      <div className="st-dots">{list.map((x, i) => <button type="button" key={x.id} className={i === k % list.length ? 'on' : ''} onClick={() => setK(i)} aria-label={x.name} />)}</div>
    </section>
  )
}

function Media({ g, onWallpaper }) {
  const movies = useMemo(() => {
    const hlsOk = typeof document !== 'undefined' && document.createElement('video').canPlayType('application/vnd.apple.mpegurl')
    return (g.movies || []).filter(m => m.mp4 || m.webm || (m.hls && hlsOk))
  }, [g])
  const items = useMemo(() => [...movies.slice(0, 1).map(m => ({ kind: 'video', ...m })), ...(g.screenshots || []).map(src => ({ kind: 'img', src }))], [movies, g])
  const [k, setK] = useState(0)
  const cur = items[k]
  if (!items.length) return g.img ? <div className="st-media"><div className="st-media-main"><img src={g.img} alt="" /></div></div> : null
  return (
    <div className="st-media">
      <div className="st-media-main">
        {cur.kind === 'video'
          ? <video key={cur.mp4 || cur.hls} poster={cur.thumb} controls autoPlay muted playsInline onEnded={() => setK(1 % items.length)}>
              {cur.webm && <source src={cur.webm} type="video/webm" />}
              {cur.mp4 && <source src={cur.mp4} type="video/mp4" />}
              {cur.hls && <source src={cur.hls} type="application/vnd.apple.mpegurl" />}
            </video>
          : <img key={cur.src} src={cur.src} alt="" />}
        {cur.kind === 'img' && onWallpaper && (
          <button type="button" className="st-wallbtn" onClick={() => onWallpaper({ url: cur.src, name: g.name, app_id: g.id })}><PictureGlyph /> Mettre en fond d’écran</button>
        )}
      </div>
      <div className="st-thumbs">
        {items.map((it, i) => (
          <button type="button" key={i} className={i === k ? 'on' : ''} onClick={() => setK(i)} aria-label={it.kind === 'video' ? 'Bande-annonce' : `Image ${i}`}>
            <img src={it.kind === 'video' ? it.thumb : it.src} alt="" loading="lazy" />
            {it.kind === 'video' && <span className="st-play">▶</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function GamePage({ id, owned, balance, onBuy, onPlay, onFunds, onWallpaper, favOf, onFav }) {
  const [g, setG] = useState(null)
  const [err, setErr] = useState(null)
  const [ask, setAsk] = useState(false)       // la fenêtre de confirmation d'achat
  const [done, setDone] = useState(false)
  useEffect(() => {
    let live = true
    setG(null); setErr(null); setAsk(false); setDone(false)
    gameDetails(id).then(d => { if (live) setG(d) }, e => { if (live) setErr(e.message) })
    return () => { live = false }
  }, [id])
  if (err) return <div className="st-empty"><p>{err}</p></div>
  if (!g) return <div className="st-loading"><span /></div>
  const price = g.free ? 0 : g.price ?? 0
  const have = owned(g.id)
  const short = balance + 1e-9 < price
  const buy = () => { if (onBuy({ ...g, price })) { setAsk(false); setDone(true) } }
  return (
    <div className="st-game">
      {g.background && <div className="st-game-bg" style={{ backgroundImage: `url("${g.background}")` }} aria-hidden="true" />}
      <div className="st-game-inner">
        <h2 className="st-game-name">{g.name}</h2>
        <div className="st-game-top">
          <Media g={g} onWallpaper={onWallpaper} />
          <aside className="st-game-side">
            {g.img && <img className="st-game-cap" src={g.img} alt="" />}
            {g.short && <p className="st-game-short">{plain(g.short)}</p>}
            <dl className="st-facts">
              {g.release && <><dt>Sortie</dt><dd>{g.release}</dd></>}
              {g.developers?.length > 0 && <><dt>Studio</dt><dd>{g.developers.join(', ')}</dd></>}
              {g.publishers?.length > 0 && <><dt>Éditeur</dt><dd>{g.publishers.join(', ')}</dd></>}
              {g.metacritic && <><dt>Critiques</dt><dd><span className="st-meta">{g.metacritic}</span> sur 100</dd></>}
            </dl>
            {g.genres?.length > 0 && <div className="st-tags">{g.genres.map(x => <span key={x}>{x}</span>)}</div>}
          </aside>
        </div>
        <div className="st-buy">
          <div className="st-buy-txt">
            <span className="st-buy-title">{have ? `${g.name} est dans ta bibliothèque` : `Acheter ${g.name}`}</span>
            {!have && <span className="st-buy-sub">{g.platforms?.length ? g.platforms.map(p => ({ windows: 'Windows', mac: 'macOS', linux: 'Linux' })[p] || p).join(' · ') : 'PC'}</span>}
          </div>
          {have
            ? <div className="st-buy-act own">
                {favOf(g.id) && <button type="button" className={'st-btn ghost gm-fav' + (favOf(g.id).favorite ? ' on' : '')} onClick={() => onFav(g.id)}><Star on={favOf(g.id).favorite} /> {favOf(g.id).favorite ? `N°${favOf(g.id).fav_rank} de mon top` : 'Ajouter à mon top'}</button>}
                <button type="button" className="st-btn go" onClick={() => onPlay(g.id)}>Jouer</button>
              </div>
            : <div className="st-buy-act"><PriceTag price={price} original={g.original} discount={g.discount} /><button type="button" className="st-btn buy" onClick={() => setAsk(true)}>{price === 0 ? 'Ajouter à ma bibliothèque' : 'Acheter'}</button></div>}
        </div>
      </div>

      {ask && (
        <div className="st-modal" role="dialog" aria-label="Confirmer l'achat" onClick={e => { if (e.target === e.currentTarget) setAsk(false) }}>
          <div className="st-modal-box">
            <h3>{short ? 'Solde insuffisant' : 'Confirmer l’achat'}</h3>
            <div className="st-modal-game">{g.img && <img src={g.img} alt="" />}<span><b>{g.name}</b><em>{fmtPrice(price)}</em></span></div>
            <dl className="st-modal-sum">
              <dt>Porte-monnaie Stim</dt><dd>{money(balance)}</dd>
              <dt>Prix</dt><dd>− {fmtPrice(price)}</dd>
              <dt className="tot">{short ? 'Il manque' : 'Après l’achat'}</dt><dd className={'tot' + (short ? ' neg' : '')}>{money(Math.abs(Math.round((balance - price) * 100) / 100) || 0)}</dd>
            </dl>
            <div className="st-modal-act">
              <button type="button" className="st-btn ghost" onClick={() => setAsk(false)}>Annuler</button>
              {short
                ? <button type="button" className="st-btn buy" onClick={() => { setAsk(false); onFunds() }}>Ajouter des fonds</button>
                : <button type="button" className="st-btn buy" onClick={buy}>Payer {fmtPrice(price)}</button>}
            </div>
          </div>
        </div>
      )}
      {done && (
        <div className="st-modal" role="dialog" aria-label="Achat réussi">
          <div className="st-modal-box ok">
            <div className="st-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
            <h3>Merci pour ton achat !</h3>
            <p>{g.name} t’attend dans <b>Mes jeux</b>.</p>
            <div className="st-modal-act">
              <button type="button" className="st-btn ghost" onClick={() => setDone(false)}>Continuer mes achats</button>
              <button type="button" className="st-btn go" onClick={() => { setDone(false); onPlay(g.id) }}>Jouer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const HomeGlyph = () => <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 22L24 9l16 13v17a2 2 0 0 1-2 2h-9V30h-10v11h-9a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" /></svg>
const PowerGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v8M7 6.5a7.5 7.5 0 1 0 10 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
const SearchGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20 20" /></svg>
const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const heroOf = id => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_hero.jpg`

/** La grande illustration d'un jeu (sans texte), sinon son image de couverture. */
function Art({ appId, fallback, className }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [appId])
  const src = !bad && appId ? heroOf(appId) : fallback
  if (!src) return <span className={className} />
  return <img className={className} key={src} src={src} alt="" onError={() => (bad ? null : setBad(true))} />
}

/* -------------------------------------------------------------------------- */
/* Stim (le magasin)                                                          */
/* -------------------------------------------------------------------------- */

function StoreHome({ owned, onOpen, onSearch }) {
  const [feat, setFeat] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const load = () => { setErr(null); featuredGames().then(setFeat, e => setErr(e.message)) }
  useEffect(load, [])
  return (
    <>
      <form className="st-search cs-search" onSubmit={e => { e.preventDefault(); if (q.trim()) onSearch(q.trim()) }} role="search">
        <SearchGlyph />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un jeu…" enterKeyHint="search" aria-label="Chercher un jeu" />
        {q && <button type="button" onClick={() => setQ('')} aria-label="Effacer">×</button>}
      </form>
      {err ? <div className="st-empty"><p>{err}</p><button type="button" className="st-btn ghost" onClick={load}>Réessayer</button></div>
        : !feat ? <div className="st-loading"><span /></div>
          : <>
            <Hero list={(feat.top || []).slice(0, 6)} owned={owned} onOpen={onOpen} />
            <Row title="Promotions" list={feat.specials} owned={owned} onOpen={onOpen} />
            <Row title="Les plus vendus" list={feat.top} owned={owned} onOpen={onOpen} />
            <Row title="Nouveautés" list={feat.news} owned={owned} onOpen={onOpen} />
          </>}
    </>
  )
}

function StoreSearch({ q, owned, onOpen }) {
  const [res, setRes] = useState(null)
  useEffect(() => {
    let live = true
    setRes(null)
    searchGames(q).then(r => { if (live) setRes(r) }, () => { if (live) setRes([]) })
    return () => { live = false }
  }, [q])
  return (
    <section className="st-results">
      <h3>Résultats pour « {q} »</h3>
      {!res ? <div className="st-loading"><span /></div>
        : !res.length ? <div className="st-empty"><p>Aucun jeu trouvé.</p></div>
          : <div className="st-grid">{res.map(g => <GameCard key={g.id} g={g} owned={owned(g.id)} onOpen={onOpen} wide />)}</div>}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Porte-monnaie et Banque Maruchime : des panneaux qui montent du bas         */
/* -------------------------------------------------------------------------- */

function Sheet({ onClose, label, className = '', children }) {
  const [out, setOut] = useState(false)
  const close = () => { setOut(true); setTimeout(onClose, 240) }
  // glisser le panneau vers le bas pour le fermer
  const drag = useRef(null)
  const [dy, setDy] = useState(0)
  return (
    <div className={'cs-sheet-back' + (out ? ' out' : '')} onPointerDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className={'cs-sheet ' + className + (out ? ' out' : '')} role="dialog" aria-label={label} style={dy ? { transform: `translate(-50%, ${dy}px)`, transition: 'none' } : null}>
        <div className="cs-grab"
          onPointerDown={e => { drag.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId) }}
          onPointerMove={e => { if (drag.current != null) setDy(Math.max(0, e.clientY - drag.current)) }}
          onPointerUp={() => { if (dy > 90) close(); drag.current = null; setDy(0) }}
          onPointerCancel={() => { drag.current = null; setDy(0) }}>
          <i />
        </div>
        <button type="button" className="cs-sheet-x" onClick={close} aria-label="Fermer">×</button>
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>
  )
}

function WalletSheet({ games, balance, onFunds, onClose }) {
  const spent = games.reduce((s, g) => s + (g.price_paid || 0), 0)
  return (
    <Sheet onClose={onClose} label="Porte-monnaie" className="cs-wallet">
      <div className="st-wallet-card">
        <span className="st-kicker">Porte-monnaie Stim</span>
        <span className="st-wallet-sum">{money(balance)}</span>
        <button type="button" className="st-btn buy" onClick={onFunds}>Ajouter des fonds</button>
      </div>
      <h3 className="cs-h3">Mes achats</h3>
      {!games.length ? <p className="st-muted">Aucun achat pour l’instant.</p> : (
        <ul className="st-history">
          {games.map(g => <li key={g.id}><span>{g.name}<em>{fmtDate(g.added_at)}</em></span><b>{g.price_paid ? '− ' + fmtPrice(g.price_paid) : 'Gratuit'}</b></li>)}
          <li className="tot"><span>Total dépensé</span><b>{fmtPrice(spent)}</b></li>
        </ul>
      )}
    </Sheet>
  )
}

/** « Glisse pour valider » : on pousse la pastille jusqu'au bout (ou Entrée au clavier). */
function SlideConfirm({ label, onConfirm }) {
  const track = useRef(null)
  const [x, setX] = useState(0)
  const [hold, setHold] = useState(false)
  const start = useRef(0)
  const max = () => Math.max(1, (track.current?.clientWidth || 300) - 60)
  const done = () => { setX(max()); navigator.vibrate?.(20); onConfirm() }
  return (
    <div className="slide" ref={track}>
      <span className="slide-fill" style={{ width: x + 56, transition: hold ? 'none' : undefined }} />
      <span className="slide-label" style={{ opacity: 1 - x / max() }}>{label}</span>
      <button type="button" className="slide-knob" style={{ transform: `translateX(${x}px)`, transition: hold ? 'none' : undefined }} aria-label={label}
        onPointerDown={e => { start.current = e.clientX - x; setHold(true); e.currentTarget.setPointerCapture?.(e.pointerId) }}
        onPointerMove={e => { if (hold) setX(Math.max(0, Math.min(max(), e.clientX - start.current))) }}
        onPointerUp={() => { setHold(false); if (x > max() * 0.82) done(); else setX(0) }}
        onPointerCancel={() => { setHold(false); setX(0) }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done() } }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
      </button>
    </div>
  )
}

const AMOUNTS = [5, 10, 20, 50, 100, 250]

function BankSheet({ holder, balance, addFunds, onClose }) {
  const [amount, setAmount] = useState(50)
  const [step, setStep] = useState('pick')        // pick → sending → ok
  const [n, setN] = useState(0)                   // pour remettre le curseur à zéro
  const send = () => {
    setStep('sending')
    setTimeout(() => { addFunds(amount); setStep('ok') }, 1300)
  }
  return (
    <Sheet onClose={onClose} label="Banque Maruchime" className="bk cs-bank">
      {close => <>
        <header className="bk-head">
          <span className="bk-logo"><BankGlyph /></span>
          <span><b>Banque Maruchime</b><em>Virement vers Stim</em></span>
        </header>
        <div className="bk-body">
          <div className="bk-card" aria-label="Carte bancaire factice">
            <span className="bk-card-bank">Maruchime</span>
            <span className="bk-card-chip" aria-hidden="true" />
            <svg className="bk-card-nfc" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8a6 6 0 0 1 0 8M11.5 5.5a10 10 0 0 1 0 13M15 3a14 14 0 0 1 0 18" /></svg>
            <span className="bk-card-num">•••• •••• •••• 2048</span>
            <span className="bk-card-foot"><span><em>Titulaire</em>{(holder || 'Joueur Maruchime').toUpperCase()}</span><span><em>Expire</em>12/99</span></span>
            <span className="bk-card-brand" aria-hidden="true"><i /><i /></span>
          </div>
          <div className="bk-acc">
            <span><em>Compte courant</em><b>Solde disponible</b></span>
            <span className="bk-inf">∞ €</span>
          </div>
          <p className="bk-to">Porte-monnaie Stim · solde actuel <b>{money(balance)}</b></p>
          <div className="bk-amounts">
            {AMOUNTS.map(a => <button type="button" key={a} className={a === amount ? 'on' : ''} onClick={() => { setAmount(a); setN(k => k + 1) }}>{a} €</button>)}
          </div>
          <SlideConfirm key={amount + '-' + n} label={`Glisse pour virer ${money(amount)}`} onConfirm={send} />
          <p className="bk-note">Banque imaginaire : l’argent n’existe pas, rien n’est jamais débité.</p>
        </div>
        {step !== 'pick' && (
          <div className="bk-over" role="status">
            {step === 'sending'
              ? <div className="bk-wait"><span className="bk-spin" /><b>Virement en cours…</b></div>
              : <div className="bk-wait ok">
                <div className="st-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
                <b>Virement effectué</b>
                <span>{money(amount)} ajoutés à ton porte-monnaie Stim.</span>
                <div className="bk-ok-act">
                  <button type="button" className="bk-cancel" onClick={() => { setStep('pick'); setN(k => k + 1) }}>Autre virement</button>
                  <button type="button" className="bk-send" onClick={close}>Terminé</button>
                </div>
              </div>}
          </div>
        )}
      </>}
    </Sheet>
  )
}

/* -------------------------------------------------------------------------- */
/* Mes jeux                                                                   */
/* -------------------------------------------------------------------------- */

function Launch({ game, onQuit }) {
  const [p, setP] = useState(0)
  const [shots, setShots] = useState([])
  useEffect(() => { gameDetails(game.app_id).then(d => setShots(d.screenshots || []), () => {}) }, [game.app_id])
  useEffect(() => {
    if (p >= 100) return
    const t = setTimeout(() => setP(v => Math.min(100, v + 4 + Math.random() * 9)), 90)
    return () => clearTimeout(t)
  }, [p])
  const bg = shots[0] || game.img
  return (
    <div className="gm-launch">
      {bg && <div className="gm-launch-bg" style={{ backgroundImage: `url("${bg}")` }} />}
      <div className="gm-launch-box">
        {game.img && <img src={game.img} alt="" />}
        {p < 100 ? <>
          <b>Lancement de {game.name}…</b>
          <span className="gm-bar"><i style={{ width: p + '%' }} /></span>
        </> : <>
          <b>Bon jeu !</b>
          <span className="gm-launch-note">C’est pour de faux : le jeu ne se lance pas vraiment.</span>
        </>}
        <button type="button" className="st-btn ghost" onClick={onQuit}>Quitter le jeu</button>
      </div>
    </div>
  )
}

const SORTS = [['recent', 'Récents'], ['name', 'Nom'], ['rating', 'Ma note']]
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
              <button type="button" className="gm-mini play" onClick={() => onPlay(g.app_id)} aria-label={`Jouer à ${g.name}`}>▶</button>
              <button type="button" className="gm-mini" onClick={() => onRemove(g.id)} aria-label="Retirer de mon top">✕</button>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function clampInt(v, a, b) { return Math.max(a, Math.min(b, v)) }

/* -------------------------------------------------------------------------- */
/* Fond d'écran                                                               */
/* -------------------------------------------------------------------------- */

/** Les grandes images d'un jeu, de la plus « fond d'écran » à la moins. */
const artOf = (id, d) => {
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/`
  return [...new Set([base + 'library_hero.jpg', d?.background, ...(d?.screenshots || []), d?.img].filter(Boolean))]
}

function Wallpapers({ games, wallpaper, setWallpaper, request }) {
  const [game, setGame] = useState(() => request || (wallpaper?.app_id ? { app_id: wallpaper.app_id, name: wallpaper.name } : games[0] ? { app_id: games[0].app_id, name: games[0].name } : null))
  const [pending, setPending] = useState(wallpaper)
  const [imgs, setImgs] = useState(null)
  const [bad, setBad] = useState(() => new Set())
  const [q, setQ] = useState('')
  const [found, setFound] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (request) setGame(request) }, [request])
  useEffect(() => {
    if (!game) return
    let live = true
    setImgs(null)
    gameDetails(game.app_id).then(d => { if (live) setImgs(artOf(game.app_id, d)) }, () => { if (live) setImgs(artOf(game.app_id, null)) })
    return () => { live = false }
  }, [game?.app_id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 2200); return () => clearTimeout(t) }, [saved])
  const search = e => {
    e.preventDefault()
    const t = q.trim()
    if (!t) return
    setFound([])
    searchGames(t).then(r => setFound(r.slice(0, 12)), () => setFound([]))
  }
  const apply = w => { setWallpaper(w); setPending(w); setSaved(true) }
  const same = (pending?.url || null) === (wallpaper?.url || null)
  const list = (imgs || []).filter(u => !bad.has(u))
  const pick = (g, i) => (
    <button type="button" key={g.app_id + '-' + i} className={'wp-chip' + (game?.app_id === g.app_id ? ' on' : '')} onClick={() => setGame({ app_id: g.app_id, name: g.name })}>
      {g.img && <img src={g.img} alt="" loading="lazy" />}<span>{g.name}</span>
    </button>
  )
  return (
    <div className="wp">
      <div className="wp-left">
        <div className="wp-preview">
          {pending?.url ? <img key={pending.url} src={pending.url} alt="" /> : <span className="wp-default" />}
          <span className="wp-fake" aria-hidden="true"><i className="g" /><i className="s" /></span>
          <span className="wp-fake-bar" aria-hidden="true" />
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
          <div className="wp-chips">{games.map((g, i) => pick({ app_id: g.app_id, name: g.name, img: g.img }, i))}</div>
        </>}
        <form className="st-search wp-search" onSubmit={search} role="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20 20" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Un autre jeu…" enterKeyHint="search" aria-label="Chercher un jeu" />
        </form>
        {found && (found.length ? <div className="wp-chips">{found.map((g, i) => pick({ app_id: g.id, name: g.name, img: g.img }, i))}</div> : <p className="st-muted">Recherche…</p>)}
        {game && <>
          <h4>Images de {game.name}</h4>
          {!imgs ? <div className="st-loading"><span /></div> : (
            <div className="wp-grid">
              {list.map(u => (
                <button type="button" key={u} className={'wp-img' + (pending?.url === u ? ' on' : '')} onClick={() => setPending({ url: u, name: game.name, app_id: game.app_id })} onDoubleClick={() => apply({ url: u, name: game.name, app_id: game.app_id })}>
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
/* Mes jeux : la ludothèque (liste à gauche, à droite notre top ou la fiche)   */
/* -------------------------------------------------------------------------- */

const steamArt = (id, f) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/${f}`

/** La jaquette verticale d'un jeu (sinon son image de couverture, recadrée, avec son nom). */
function Cover({ g, className = '' }) {
  const [bad, setBad] = useState(false)
  return (
    <span className={'ld-cover ' + className + (bad ? ' flat' : '')}>
      {!bad ? <img src={steamArt(g.app_id, 'library_600x900.jpg')} alt="" loading="lazy" draggable="false" onError={() => setBad(true)} />
        : <>{g.img && <img src={g.img} alt="" loading="lazy" draggable="false" />}<b>{g.name}</b></>}
    </span>
  )
}

/** Le logo du jeu (sans fond), sinon son nom en grand. */
function Logo({ g }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [g.app_id])
  return bad ? <h2 className="ld-logo-txt">{g.name}</h2>
    : <img className="ld-logo" src={steamArt(g.app_id, 'logo.png')} alt={g.name} onError={() => setBad(true)} />
}

function CoverCard({ g, rank, onOpen, onPlay, onFav }) {
  return (
    <div className={'ld-card' + (rank ? ' ranked' : '') + (rank && rank <= 3 ? ' r' + rank : '')}>
      <button type="button" className="ld-card-btn" onClick={() => onOpen(g.id)} aria-label={g.name}><Cover g={g} /></button>
      {rank ? <span className="ld-card-rank">{rank}</span> : null}
      <span className="ld-card-hover">
        <button type="button" className="ld-card-play" onClick={() => onPlay(g.app_id)} aria-label={`Jouer à ${g.name}`}>▶</button>
        <button type="button" className={'ld-card-star' + (g.favorite ? ' on' : '')} onClick={() => onFav(g, !g.favorite)} aria-label={g.favorite ? 'Retirer de mon top' : 'Ajouter à mon top'}><Star on={g.favorite} /></button>
      </span>
      <span className="ld-card-name">{g.name}</span>
    </div>
  )
}

function LudoHome({ games, top, onOpen, onPlay, fav, reorderTop, openStore }) {
  const [sort, setSort] = useState('top')
  const [ranking, setRanking] = useState(false)
  const all = useMemo(() => {
    const by = {
      top: (a, b) => (b.favorite - a.favorite) || (a.fav_rank ?? 1e9) - (b.fav_rank ?? 1e9) || a.name.localeCompare(b.name, 'fr'),
      recent: (a, b) => b.added_at.localeCompare(a.added_at),
      name: (a, b) => a.name.localeCompare(b.name, 'fr'),
      rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name, 'fr'),
    }[sort]
    return [...games].sort(by)
  }, [games, sort])
  if (!games.length) {
    return (
      <div className="gm-empty ld-empty">
        <span className="gm-empty-ico"><GamesGlyph /></span>
        <b>Aucun jeu pour l’instant</b>
        <p>Va faire un tour dans le magasin : les jeux que tu achètes arrivent ici.</p>
        <button type="button" className="st-btn buy" onClick={openStore}>Ouvrir le magasin</button>
      </div>
    )
  }
  const first = top[0]
  return (
    <div className="ld-home">
      {first ? (
        <TopCarousel items={top} ranked onPlay={onPlay} onGame={onOpen} strip={false} />
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

      <section className="ld-sec">
        <div className="ld-sec-head">
          <h3 className="cs-h3">Toute ma collection <em>{games.length}</em></h3>
          <div className="gm-sort" role="group" aria-label="Trier">
            {[['top', 'Top d’abord'], ['recent', 'Récents'], ['name', 'Nom'], ['rating', 'Ma note']].map(([k, t]) => <button type="button" key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{t}</button>)}
          </div>
        </div>
        <div className="ld-grid">{all.map(g => <CoverCard key={g.id} g={g} rank={g.favorite ? g.fav_rank : null} onOpen={onOpen} onPlay={onPlay} onFav={fav} />)}</div>
      </section>
    </div>
  )
}

/** La fiche d'un jeu : la grande image et son logo, Jouer, nos infos, ses images, sa description. */
function LudoGame({ g, onPlay, fav, updateGame, removeGame, onWallpaper, onStore, onGone, quickWall }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    if (!g) return
    let live = true
    setD(null)
    gameDetails(g.app_id).then(x => { if (live) setD(x) }, () => { if (live) setD(false) })
    return () => { live = false }
  }, [g?.app_id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return <div className="st-empty"><p>Ce jeu n’est plus dans ta liste.</p></div>
  return (
    <div className="ld-game" key={g.id}>
      <div className="ld-hero">
        <Art appId={g.app_id} fallback={d?.background || g.img} className="ld-hero-art" />
        <div className="ld-hero-logo"><Logo g={g} /></div>
      </div>
      <div className="ld-bar">
        <button type="button" className="st-btn go ld-play" onClick={() => onPlay(g.app_id)}>▶ Jouer</button>
        <dl className="ld-stats">
          <div><dt>Dans mon top</dt><dd>{g.favorite ? `N°${g.fav_rank}` : '—'}</dd></div>
          <div><dt>Acheté le</dt><dd>{fmtDate(g.added_at)}</dd></div>
          <div><dt>Payé</dt><dd>{g.price_paid ? fmtPrice(g.price_paid) : 'Gratuit'}</dd></div>
          <div className="ld-stats-rate"><dt>Ma note</dt><dd>
            {[1, 2, 3, 4, 5].map(n => (
              <button type="button" key={n} className={(g.rating || 0) >= n ? 'on' : ''} onClick={() => updateGame(g.id, { rating: g.rating === n ? null : n })} aria-label={`${n} sur 5`}><Star on={(g.rating || 0) >= n} /></button>
            ))}
          </dd></div>
        </dl>
        <div className="ld-bar-act">
          <button type="button" className={'ld-icon' + (g.favorite ? ' on' : '')} onClick={() => fav(g, !g.favorite)} title={g.favorite ? 'Retirer de mon top' : 'Ajouter à mon top'} aria-label={g.favorite ? 'Retirer de mon top' : 'Ajouter à mon top'}><Star on={g.favorite} /></button>
          <button type="button" className="ld-icon" onClick={() => onWallpaper(g)} title="Fond d’écran" aria-label="Choisir un fond d’écran de ce jeu"><PictureGlyph /></button>
          <button type="button" className="ld-icon" onClick={() => onStore(g.app_id)} title="Page du magasin" aria-label="Page du magasin"><StimGlyph /></button>
        </div>
      </div>
      <div className="ld-cols">
        <div className="ld-col-main">
          {d?.short && <section className="ld-box"><h3 className="cs-h3">À propos</h3><p className="ld-about">{plain(d.short)}</p></section>}
          {d?.screenshots?.length > 0 && (
            <section className="ld-box">
              <h3 className="cs-h3">Images</h3>
              <div className="ld-shots">
                {d.screenshots.slice(0, 8).map(u => (
                  <figure key={u} className="ld-shot">
                    <img src={u} alt="" loading="lazy" />
                    <button type="button" className="st-wallbtn" onClick={() => quickWall({ url: u, name: g.name, app_id: g.app_id })}><PictureGlyph /> En fond d’écran</button>
                  </figure>
                ))}
              </div>
            </section>
          )}
          {d === null && <div className="st-loading"><span /></div>}
        </div>
        <aside className="ld-col-side">
          <section className="ld-box">
            <h3 className="cs-h3">Infos</h3>
            <dl className="st-facts">
              {(d?.genres?.length || g.genres?.length) ? <><dt>Genres</dt><dd>{(d?.genres || g.genres).slice(0, 3).join(', ')}</dd></> : null}
              {(d?.release || g.release) && <><dt>Sortie</dt><dd>{d?.release || g.release}</dd></>}
              {d?.developers?.length > 0 && <><dt>Studio</dt><dd>{d.developers.join(', ')}</dd></>}
              {d?.metacritic && <><dt>Critiques</dt><dd><span className="st-meta">{d.metacritic}</span> sur 100</dd></>}
            </dl>
          </section>
          <button type="button" className="gm-link danger" onClick={() => { removeGame(g.id); onGone() }}>Retirer de mes jeux</button>
        </aside>
      </div>
    </div>
  )
}

function Ludo({ games, top, selId, onSelect, onHome, mobile, setFavorite, reorderTop, updateGame, removeGame, onPlay, onWallpaper, onStore, quickWall, openStore, notify }) {
  const [q, setQ] = useState('')
  const mainRef = useRef(null)
  useEffect(() => { mainRef.current?.scrollTo?.(0, 0) }, [selId])
  const fav = (g, on) => { const r = setFavorite(g.id, on); notify(on ? `${g.name} entre dans ton top · n°${r}` : `${g.name} sort de ton top`) }
  const t = q.trim().toLowerCase()
  const match = g => !t || g.name.toLowerCase().includes(t)
  const rest = useMemo(() => [...games].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [games])
  const sel = selId ? games.find(g => g.id === selId) : null
  const main = sel || selId
    ? <LudoGame g={sel} onPlay={onPlay} fav={fav} updateGame={updateGame} removeGame={id => { removeGame(id); notify(`${sel?.name} retiré de tes jeux`) }} onWallpaper={onWallpaper} onStore={onStore} onGone={onHome} quickWall={quickWall} />
    : <LudoHome games={games} top={top} onOpen={onSelect} onPlay={onPlay} fav={fav} reorderTop={reorderTop} openStore={openStore} />
  if (mobile) return <div className="ld ld-mobile">{main}</div>
  const row = (g, rank) => (
    <button type="button" key={g.id} className={'ld-item' + (g.id === selId ? ' on' : '')} onClick={() => onSelect(g.id)}>
      <span className="ld-item-img">{g.img && <img src={g.img} alt="" loading="lazy" />}</span>
      <span className="ld-item-name">{g.name}</span>
      {rank ? <span className={'ld-item-rank' + (rank <= 3 ? ' r' + rank : '')}>{rank}</span> : g.favorite ? <span className="ld-item-star"><Star on /></span> : null}
    </button>
  )
  const topShown = top.filter(match), allShown = rest.filter(match)
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
          <h4>Tous mes jeux <em>{games.length}</em></h4>
          {allShown.map(g => row(g, null))}
          {!allShown.length && <p className="st-muted ld-none">Aucun jeu ne correspond.</p>}
        </div>
      </aside>
      <div className="ld-main" ref={mainRef}>
        <div className="ld-main-in" key={selId || 'home'}>{main}</div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* L'accueil                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * La grande fenêtre de l'accueil : notre top, un jeu après l'autre (toutes les 7 s, ou au doigt,
 * aux flèches), et en dessous la rangée de tout le classement pour y sauter directement.
 */
function TopCarousel({ items, ranked, onPlay, onGame, strip: showStrip = true }) {
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
            <Art appId={x.app_id} fallback={x.img} className="cs-hero-art" />
          </div>
        ))}
        <div className="cs-hero-txt" key={g.id}>
          <span className="cs-hero-kick">{ranked ? (cur === 0 ? 'Ton n°1' : `N°${cur + 1} de ton top`) : 'Ajouté récemment'}</span>
          <Logo g={g} />
          <span className="cs-car-meta">
            {g.rating ? <Stars n={g.rating} /> : null}
            <em>{g.genres?.slice(0, 2).join(' · ')}</em>
          </span>
          <span className="cs-hero-act">
            <button type="button" className="st-btn go big" onClick={() => onPlay(g.app_id)}>▶ Jouer</button>
            <button type="button" className="st-btn ghost" onClick={() => onGame(g.id)}>Voir le jeu</button>
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
/* Le logiciel : une barre en haut (← →, Magasin, Bibliothèque, Personnaliser)  */
/* -------------------------------------------------------------------------- */

const NAV = [['stim', 'Magasin'], ['games', 'Bibliothèque'], ['custom', 'Personnaliser']]
const ROOT = { stim: { v: 'store' }, games: { v: 'list' }, custom: { v: 'main' } }
const Fwd = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>

export default function PcOS({ games, balance, addFunds, buy, updateGame, removeGame, setFavorite, reorderTop, wallpaper, setWallpaper, setup, setSetup, holder, fromRect, onClose }) {
  const mobile = useIsMobile()
  const rootRef = useRef(null)
  const [closing, setClosing] = useState(false)
  // où l'on est, et l'historique (les flèches ← →), comme un navigateur
  const [nav, setNav] = useState({ cur: { tab: 'games', e: ROOT.games }, past: [], future: [] })
  const [last, setLast] = useState({ ...ROOT })        // le dernier écran vu dans chaque onglet
  const [dir, setDir] = useState('tab')
  const [sheet, setSheet] = useState(null)              // 'wallet' | 'bank'
  const [playId, setPlayId] = useState(null)
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
  const ownedIds = useMemo(() => new Set(games.map(g => g.app_id)), [games])
  const owned = useCallback(id => ownedIds.has(id), [ownedIds])
  const { tab, e: cur } = nav.cur

  const navigate = (t, e, d = 'fwd') => {
    setDir(d)
    setNav(n => ({ cur: { tab: t, e }, past: [...n.past, n.cur].slice(-40), future: [] }))
    setLast(l => ({ ...l, [t]: e }))
  }
  const goTab = t => navigate(t, t === tab ? ROOT[t] : last[t] || ROOT[t], 'tab')
  const back = useCallback(() => {
    if (sheet) { setSheet(null); return true }
    if (playId) { setPlayId(null); return true }
    if (!nav.past.length) return false
    setDir('back')
    setNav(n => { const p = n.past[n.past.length - 1]; setLast(l => ({ ...l, [p.tab]: p.e })); return { cur: p, past: n.past.slice(0, -1), future: [n.cur, ...n.future] } })
    return true
  }, [sheet, playId, nav.past.length])
  const forward = () => {
    if (!nav.future.length) return
    setDir('fwd')
    setNav(n => { const f = n.future[0]; setLast(l => ({ ...l, [f.tab]: f.e })); return { cur: f, past: [...n.past, n.cur], future: n.future.slice(1) } })
  }
  const play = id => setPlayId(id)
  const openGame = id => navigate('games', { v: 'game', id })
  const openStoreGame = id => navigate('stim', { v: 'game', id })
  const chooseWall = g => { setWallFor(g ? { app_id: g.app_id, name: g.name } : null); setCustomTab('wall'); navigate('custom', { v: 'main', k: Date.now() }) }
  const quickWall = w => { setWallpaper(w); setToast(`Nouveau fond d’écran : ${w.name}`) }

  useEffect(() => {
    const k = e => {
      if (e.target?.tagName === 'INPUT') return
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

  const playing = playId ? games.find(g => g.app_id === playId) : null
  const ld = tab === 'games' && !mobile
  let body = null
  if (tab === 'stim') {
    if (cur.v === 'store') body = <StoreHome owned={owned} onOpen={openStoreGame} onSearch={q => navigate('stim', { v: 'search', q })} />
    else if (cur.v === 'search') body = <StoreSearch q={cur.q} owned={owned} onOpen={openStoreGame} />
    else body = <GamePage id={cur.id} owned={owned} balance={balance} onBuy={buy} onPlay={play} onFunds={() => setSheet('bank')} onWallpaper={quickWall}
      favOf={appId => games.find(x => x.app_id === appId)} onFav={appId => { const r = games.find(x => x.app_id === appId); if (r) { const n = setFavorite(r.id, !r.favorite); setToast(n ? `${r.name} entre dans ton top · n°${n}` : `${r.name} sort de ton top`) } }} />
  } else if (tab === 'games') {
    body = <Ludo games={games} top={top} selId={cur.v === 'game' ? cur.id : null} onSelect={openGame} onHome={() => navigate('games', ROOT.games, 'back')} mobile={mobile}
      setFavorite={setFavorite} reorderTop={reorderTop} updateGame={updateGame} removeGame={removeGame} onPlay={play} onWallpaper={chooseWall} onStore={openStoreGame} quickWall={quickWall} openStore={() => goTab('stim')} notify={setToast} />
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
          <button type="button" onClick={back} disabled={!nav.past.length && !sheet && !playId} aria-label="Retour" title="Retour"><Back /></button>
          <button type="button" onClick={forward} disabled={!nav.future.length} aria-label="Suivant" title="Suivant"><Fwd /></button>
        </div>
        <nav className="cl-nav" aria-label="Maruchime OS">
          {NAV.map(([k, label]) => (
            <button type="button" key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => goTab(k)}>{label}</button>
          ))}
        </nav>
        <div className="cl-right">
          {!mobile && <Clock />}
          <button type="button" className="pc-task-bal" onClick={() => setSheet('wallet')} title="Porte-monnaie Stim"><Wallet /> {money(balance)}</button>
          {!mobile && holder && <span className="cl-user"><span className="pc-orb" />{holder.split(' ')[0]}</span>}
          <button type="button" className="cl-power" onClick={close} aria-label="Éteindre et revenir au salon" title="Éteindre et revenir au salon"><PowerGlyph /></button>
        </div>
      </header>

      <main className="cl-main">
        <div className={'cs-body st-body ' + (ld ? 'ld-body enter-tab' : 'enter-' + dir)} key={ld ? 'games' : tab + ':' + JSON.stringify(cur)}>{body}</div>
      </main>

      {sheet === 'wallet' && <WalletSheet games={games} balance={balance} onFunds={() => setSheet('bank')} onClose={() => setSheet(null)} />}
      {sheet === 'bank' && <BankSheet holder={holder} balance={balance} addFunds={addFunds} onClose={() => setSheet(null)} />}
      {playing && <Launch game={playing} onQuit={() => setPlayId(null)} />}
      {toast && <div className="pc-toast cs-toast" role="status">{toast}</div>}
    </div>
  )
}
