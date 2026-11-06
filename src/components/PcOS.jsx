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

function MyGames({ games, top, sub, setSub, setFavorite, reorderTop, onOpen, onPlay, openStore, notify }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('recent')
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const l = t ? games.filter(g => g.name.toLowerCase().includes(t)) : games
    const cmp = { recent: (a, b) => b.added_at.localeCompare(a.added_at), name: (a, b) => a.name.localeCompare(b.name, 'fr'), rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name, 'fr') }[sort]
    return [...l].sort(cmp)
  }, [games, q, sort])
  const fav = (g, on) => {
    const r = setFavorite(g.id, on)
    notify(on ? `${g.name} entre dans ton top · n°${r}` : `${g.name} sort de ton top`)
  }
  if (!games.length) {
    return (
      <div className="gm-empty">
        <span className="gm-empty-ico"><GamesGlyph /></span>
        <b>Aucun jeu pour l’instant</b>
        <p>Va faire un tour dans le magasin : les jeux que tu achètes arrivent ici.</p>
        <button type="button" className="st-btn buy" onClick={openStore}>Ouvrir le magasin</button>
      </div>
    )
  }
  const tab = sub || (top.length ? 'top' : 'all')
  return (
    <div className="gm-page">
      <div className="cs-seg" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'top'} className={tab === 'top' ? 'on' : ''} onClick={() => setSub('top')}>Mon top <b>{top.length}</b></button>
        <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : ''} onClick={() => setSub('all')}>Tous mes jeux <b>{games.length}</b></button>
      </div>

      {tab === 'top' && (!top.length ? (
        <div className="gm-top-empty">
          <span className="gm-podium" aria-hidden="true"><i>2</i><i>1</i><i>3</i></span>
          <b>Ton top est vide</b>
          <p>Touche l’étoile <Star on={false} /> d’un jeu pour l’ajouter à ton classement, puis range-les dans l’ordre que tu veux.</p>
          <button type="button" className="st-btn buy" onClick={() => setSub('all')}>Choisir dans mes jeux</button>
        </div>
      ) : <>
        <p className="gm-hint">{coarse() ? 'Garde le doigt appuyé sur un jeu, puis déplace-le pour changer son rang' : <><Grip /> Fais glisser un jeu par sa poignée pour changer son rang</>}</p>
        <TopList top={top} onOpen={onOpen} onPlay={onPlay} onRemove={id => fav(games.find(g => g.id === id), false)} reorder={reorderTop} />
        {top.length < games.length && (
          <section className="gm-add">
            <h4>Ajouter à mon top</h4>
            <div className="gm-add-row">
              {games.filter(g => !g.favorite).map(g => (
                <button type="button" key={g.id} className="gm-add-chip" onClick={() => fav(g, true)}>
                  {g.img && <img src={g.img} alt="" loading="lazy" />}<span>{g.name}</span><b>+</b>
                </button>
              ))}
            </div>
          </section>
        )}
      </>)}

      {tab === 'all' && <>
        <div className="gm-tools">
          <label className="gm-find">
            <SearchGlyph />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Retrouver un jeu…" aria-label="Retrouver un jeu" />
          </label>
          <div className="gm-sort" role="group" aria-label="Trier">
            {SORTS.map(([k, t]) => <button type="button" key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{t}</button>)}
          </div>
        </div>
        {!list.length && <div className="st-empty"><p>Aucun jeu ne correspond.</p></div>}
        <div className="gm-grid">
          {list.map(g => (
            <div key={g.id} className={'gm-tile' + (g.favorite ? ' fav' : '')}>
              <button type="button" className="gm-tile-img" onClick={() => onOpen(g.id)}>
                {g.img && <img src={g.img} alt="" loading="lazy" />}
                <span className="gm-tile-name">{g.name}</span>
              </button>
              {g.favorite && <span className="gm-badge">N°{g.fav_rank}</span>}
              <button type="button" className={'gm-star' + (g.favorite ? ' on' : '')} onClick={() => fav(g, !g.favorite)} aria-pressed={g.favorite} aria-label={g.favorite ? 'Retirer de mon top' : 'Ajouter à mon top'}><Star on={g.favorite} /></button>
              <button type="button" className="gm-play" onClick={() => onPlay(g.app_id)} aria-label={`Jouer à ${g.name}`}>▶</button>
            </div>
          ))}
        </div>
      </>}
    </div>
  )
}

/** La page d'un de nos jeux. */
function GameDetail({ g, onPlay, setFavorite, updateGame, removeGame, onWallpaper, onStore, onGone, notify }) {
  if (!g) return <div className="st-empty"><p>Ce jeu n’est plus dans ta liste.</p></div>
  const fav = on => { const r = setFavorite(g.id, on); notify(on ? `${g.name} entre dans ton top · n°${r}` : `${g.name} sort de ton top`) }
  return (
    <div className="gd">
      <div className="gd-hero">
        <Art appId={g.app_id} fallback={g.img} className="gd-art" />
        <div className="gd-hero-txt">
          {g.favorite && <span className="gm-top-crown">N°{g.fav_rank} de mon top</span>}
          <h2>{g.name}</h2>
          <p>{[g.genres?.slice(0, 3).join(' · '), g.release].filter(Boolean).join('  —  ')}</p>
          <div className="gd-act">
            <button type="button" className="st-btn go big" onClick={() => onPlay(g.app_id)}>▶ Jouer</button>
            <button type="button" className={'st-btn ghost gm-fav' + (g.favorite ? ' on' : '')} onClick={() => fav(!g.favorite)}><Star on={g.favorite} /> {g.favorite ? 'Dans mon top' : 'Ajouter à mon top'}</button>
          </div>
        </div>
      </div>
      <div className="gd-body">
        <div className="gm-rate" role="group" aria-label="Ma note">
          <span>Ma note</span>
          {[1, 2, 3, 4, 5].map(n => (
            <button type="button" key={n} className={(g.rating || 0) >= n ? 'on' : ''} onClick={() => updateGame(g.id, { rating: g.rating === n ? null : n })} aria-label={`${n} sur 5`}><Star on={(g.rating || 0) >= n} /></button>
          ))}
        </div>
        <div className="gd-cards">
          <button type="button" className="gd-card" onClick={() => onWallpaper(g)}><PictureGlyph /><span><b>Fond d’écran</b><em>Choisir une image de ce jeu</em></span></button>
          <button type="button" className="gd-card" onClick={() => onStore(g.app_id)}><StimGlyph /><span><b>Page du magasin</b><em>Images, bande-annonce, description</em></span></button>
        </div>
        <p className="st-muted">Acheté le {fmtDate(g.added_at)} · {g.price_paid ? fmtPrice(g.price_paid) : 'gratuit'}</p>
        <button type="button" className="gm-link danger" onClick={() => { removeGame(g.id); notify(`${g.name} retiré de tes jeux`); onGone() }}>Retirer de mes jeux</button>
      </div>
    </div>
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
/* L'accueil                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * La grande fenêtre de l'accueil : notre top, un jeu après l'autre (toutes les 7 s, ou au doigt,
 * aux flèches), et en dessous la rangée de tout le classement pour y sauter directement.
 */
function TopCarousel({ items, ranked, onPlay, onGame }) {
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
          <b>{g.name}</b>
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
      {n > 1 && (
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

function greeting() { const h = new Date().getHours(); return h >= 5 && h < 18 ? 'Bonjour' : 'Bonsoir' }

function Home({ holder, games, top, balance, onPlay, onGame, go, openWallet }) {
  const star = top[0] || [...games].sort((a, b) => b.added_at.localeCompare(a.added_at))[0] || null
  const recent = useMemo(() => [...games].sort((a, b) => b.added_at.localeCompare(a.added_at)).slice(0, 10), [games])
  const first = (holder || '').split(' ')[0]
  const tile = (key, label, sub, Icon, onClick) => (
    <button type="button" className={'cs-tile ' + key} onClick={e => onClick(e.currentTarget.getBoundingClientRect())}>
      <span className="cs-tile-ico"><Icon /></span>
      <span className="cs-tile-txt"><b>{label}</b><em>{sub}</em></span>
    </button>
  )
  return (
    <div className="cs-home">
      <p className="cs-hello">{greeting()}{first ? `, ${first}` : ''}.</p>
      {star ? (
        <TopCarousel items={top.length ? top : recent.slice(0, 6)} ranked={top.length > 0} onPlay={onPlay} onGame={onGame} />
      ) : (
        <section className="cs-hero empty">
          <div className="cs-hero-txt">
            <span className="cs-hero-kick">Bienvenue sur Maruchime OS</span>
            <b>Ta ludothèque t’attend</b>
            <span className="cs-hero-sub">Ajoute des fonds, choisis tes jeux dans le magasin, puis range-les dans ton top.</span>
            <span className="cs-hero-act">
              <button type="button" className="st-btn buy big" onClick={() => go('stim')}>Ouvrir le magasin</button>
              <button type="button" className="st-btn ghost" onClick={openWallet}>Ajouter des fonds</button>
            </span>
          </div>
        </section>
      )}
      <div className="cs-tiles">
        {tile('games', 'Mes jeux', `${games.length} jeu${games.length > 1 ? 'x' : ''}${top.length ? ` · top ${top.length}` : ''}`, GamesGlyph, r => go('games', r))}
        {tile('stim', 'Magasin', 'Promos et nouveautés', StimGlyph, r => go('stim', r))}
        {tile('custom', 'Personnaliser', 'Fond d’écran, lumières', PictureGlyph, r => go('custom', r))}
        {tile('wallet', 'Porte-monnaie', money(balance), BankGlyph, openWallet)}
      </div>
      {recent.length > 0 && (
        <section className="cs-recent">
          <h3 className="cs-h3">Ajoutés récemment</h3>
          <div className="cs-recent-row">
            {recent.map(g => (
              <button type="button" key={g.id} className="cs-recent-card" onClick={() => onGame(g.id)}>
                {g.img && <img src={g.img} alt="" loading="lazy" />}
                <span>{g.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* La console                                                                 */
/* -------------------------------------------------------------------------- */

const TABS = [['home', 'Accueil', HomeGlyph], ['stim', 'Magasin', StimGlyph], ['games', 'Mes jeux', GamesGlyph], ['custom', 'Personnaliser', PictureGlyph]]
const ROOT = { stim: { v: 'store' }, games: { v: 'list' }, custom: { v: 'main' } }

export default function PcOS({ games, balance, addFunds, buy, updateGame, removeGame, setFavorite, reorderTop, wallpaper, setWallpaper, setup, setSetup, holder, fromRect, onClose }) {
  const mobile = useIsMobile()
  const rootRef = useRef(null)
  const appRef = useRef(null)
  const [closing, setClosing] = useState(false)
  const [tab, setTab] = useState('home')
  const [stacks, setStacks] = useState({ stim: [ROOT.stim], games: [ROOT.games], custom: [ROOT.custom] })
  const [dir, setDir] = useState('tab')           // l'animation d'entrée : 'fwd', 'back' ou 'tab'
  const [sheet, setSheet] = useState(null)        // 'wallet' | 'bank'
  const [playId, setPlayId] = useState(null)
  const [toast, setToast] = useState(null)
  const [gamesSub, setGamesSub] = useState(null)
  const [customTab, setCustomTab] = useState('wall')
  const [wallFor, setWallFor] = useState(null)
  const [openFrom, setOpenFrom] = useState(null)
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

  // la navigation : une pile d'écrans par onglet, un seul « Retour »
  const top = useMemo(() => games.filter(g => g.favorite).sort(byRank), [games])
  const ownedIds = useMemo(() => new Set(games.map(g => g.app_id)), [games])
  const owned = useCallback(id => ownedIds.has(id), [ownedIds])
  const cur = tab === 'home' ? null : stacks[tab][stacks[tab].length - 1]
  const depth = tab === 'home' ? 0 : stacks[tab].length
  const go = (t, rect) => { setDir('tab'); if (rect) setOpenFrom(rect); setTab(t) }
  const push = (t, entry) => { setDir('fwd'); setStacks(s => ({ ...s, [t]: [...s[t], entry] })); setTab(t) }
  const goTab = t => {
    setDir('tab')
    if (t === tab && t !== 'home') setStacks(s => ({ ...s, [t]: [ROOT[t]] }))
    setTab(t)
  }
  const back = useCallback(() => {
    if (sheet) { setSheet(null); return true }
    if (playId) { setPlayId(null); return true }
    if (tab === 'home') return false
    setDir('back')
    if (stacks[tab].length > 1) setStacks(s => ({ ...s, [tab]: s[tab].slice(0, -1) }))
    else setTab('home')
    return true
  }, [sheet, playId, tab, stacks])
  const play = id => { setPlayId(id) }
  const openGame = id => push('games', { v: 'game', id })
  const openStoreGame = id => push('stim', { v: 'game', id })
  const chooseWall = g => { setWallFor(g ? { app_id: g.app_id, name: g.name } : null); setCustomTab('wall'); push('custom', { v: 'main', k: Date.now() }) }
  const quickWall = w => { setWallpaper(w); setToast(`Nouveau fond d’écran : ${w.name}`) }

  useEffect(() => {
    const k = e => {
      if (e.key !== 'Escape' || e.target?.tagName === 'INPUT') return
      if (!back()) close()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [back, close])

  // une appli s'ouvre en grandissant depuis sa tuile
  useLayoutEffect(() => {
    const el = appRef.current
    if (!openFrom || !el?.animate) return
    const r = el.getBoundingClientRect()
    const ins = `inset(${Math.max(0, openFrom.top - r.top)}px ${Math.max(0, r.right - openFrom.right)}px ${Math.max(0, r.bottom - openFrom.bottom)}px ${Math.max(0, openFrom.left - r.left)}px round 18px)`
    el.animate([{ clipPath: ins, opacity: 0.6 }, { clipPath: 'inset(0px 0px 0px 0px round 18px)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' })
    setOpenFrom(null)
  }, [tab, openFrom])

  // au doigt : glisser depuis le bord gauche = Retour ; sur l'accueil, glisser vers le bas = éteindre
  const touch = useRef(null)
  const onTouchStart = e => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, edge: t.clientX < 24 } }
  const onTouchEnd = e => {
    const s = touch.current; touch.current = null
    if (!s) return
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y
    if (s.edge && dx > 70 && Math.abs(dy) < 60) back()
    else if (tab === 'home' && !sheet && dy > 150 && Math.abs(dx) < 60 && (appRef.current?.scrollTop || 0) <= 0 && s.y < window.innerHeight * 0.5) close()
  }

  const title = tab === 'stim' ? (cur.v === 'search' ? 'Recherche' : 'Magasin') : tab === 'games' ? (cur.v === 'game' ? 'Mes jeux' : 'Mes jeux') : tab === 'custom' ? 'Personnaliser' : ''
  const curGame = tab === 'games' && cur.v === 'game' ? games.find(g => g.id === cur.id) : null
  const playing = playId ? games.find(g => g.app_id === playId) : null

  let body = null
  if (tab === 'stim') {
    if (cur.v === 'store') body = <StoreHome owned={owned} onOpen={openStoreGame} onSearch={q => push('stim', { v: 'search', q })} />
    else if (cur.v === 'search') body = <StoreSearch q={cur.q} owned={owned} onOpen={openStoreGame} />
    else body = <GamePage id={cur.id} owned={owned} balance={balance} onBuy={buy} onPlay={play} onFunds={() => setSheet('bank')} onWallpaper={quickWall}
      favOf={appId => games.find(x => x.app_id === appId)} onFav={appId => { const r = games.find(x => x.app_id === appId); if (r) { const n = setFavorite(r.id, !r.favorite); setToast(n ? `${r.name} entre dans ton top · n°${n}` : `${r.name} sort de ton top`) } }} />
  } else if (tab === 'games') {
    if (cur.v === 'game') body = <GameDetail g={curGame} onPlay={play} setFavorite={setFavorite} updateGame={updateGame} removeGame={removeGame} onWallpaper={chooseWall} onStore={openStoreGame} onGone={back} notify={setToast} />
    else body = <MyGames games={games} top={top} sub={gamesSub} setSub={setGamesSub} setFavorite={setFavorite} reorderTop={reorderTop} onOpen={openGame} onPlay={play} openStore={() => go('stim')} notify={setToast} />
  } else if (tab === 'custom') {
    body = <Custom tab={customTab} setTab={setCustomTab} games={games} wallpaper={wallpaper} setWallpaper={setWallpaper} request={wallFor} setup={setup} setSetup={setSetup} />
  }

  return (
    <div ref={rootRef} className={'pcos cs' + (closing ? ' closing' : '') + (mobile ? ' mobile' : '') + (tab === 'home' ? ' at-home' : ' in-app')} role="application" aria-label="Le PC"
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="cs-bg" aria-hidden="true">
        {wallpaper?.url ? <img key={wallpaper.url} src={wallpaper.url} alt="" /> : <div className="pc-wall"><i /><i /><i /></div>}
      </div>

      <header className="cs-status">
        <button type="button" className="cs-power" onClick={close} aria-label="Éteindre et revenir au salon" title="Éteindre et revenir au salon"><PowerGlyph /><span>Éteindre</span></button>
        <span className="cs-brand"><span className="pc-orb" />Maruchime OS</span>
        <span className="cs-status-r">
          {!mobile && <Clock />}
          <button type="button" className="pc-task-bal" onClick={() => setSheet('wallet')} title="Porte-monnaie Stim"><Wallet /> {money(balance)}</button>
        </span>
      </header>

      <main className="cs-main" ref={tab === 'home' ? appRef : null}>
        {tab === 'home' && <Home holder={holder} games={games} top={top} balance={balance} onPlay={play} onGame={openGame} go={go} openWallet={() => setSheet('wallet')} />}
        {tab !== 'home' && (
          <section className="cs-app" ref={appRef}>
            <div className="cs-head">
              <button type="button" className="cs-back" onClick={back} aria-label="Retour"><Back /><span>Retour</span></button>
              <h2>{title}</h2>
            </div>
            <div className={'cs-body st-body enter-' + dir} key={tab + ':' + depth + ':' + (cur.id || cur.q || cur.k || '')}>{body}</div>
          </section>
        )}
      </main>

      <nav className="cs-tabs" aria-label="Maruchime OS">
        {TABS.map(([k, label, Icon]) => (
          <button type="button" key={k} className={'cs-tab ' + k + (tab === k ? ' on' : '')} aria-current={tab === k ? 'page' : undefined} onClick={() => goTab(k)}>
            <span className="cs-tab-ico"><Icon /></span><span className="cs-tab-lbl">{label}</span>
          </button>
        ))}
      </nav>

      {sheet === 'wallet' && <WalletSheet games={games} balance={balance} onFunds={() => setSheet('bank')} onClose={() => setSheet(null)} />}
      {sheet === 'bank' && <BankSheet holder={holder} balance={balance} addFunds={addFunds} onClose={() => setSheet(null)} />}
      {playing && <Launch game={playing} onQuit={() => setPlayId(null)} />}
      {toast && <div className="pc-toast cs-toast" role="status">{toast}</div>}
    </div>
  )
}
