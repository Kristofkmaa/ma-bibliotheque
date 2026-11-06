import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { featuredGames, searchGames, gameDetails, fmtPrice } from '../lib/steam'

/**
 * Le PC du bureau gamer : « Maruchime OS ». Un fond d'écran, deux icônes (Mes jeux, Stim),
 * une barre des tâches (horloge, porte-monnaie, bouton pour éteindre). Les fenêtres se
 * déplacent à la souris ; sur téléphone, elles prennent tout l'écran.
 * L'argent est pour de faux : la « Banque Maruchime » a un solde illimité, et on vire ce
 * qu'on veut vers son porte-monnaie Stim (des boutons seulement, aucune vraie carte).
 */

const APPS = {
  stim: { title: 'Stim', w: 1120, h: 740 },
  games: { title: 'Mes jeux', w: 960, h: 640 },
  bank: { title: 'Banque Maruchime', w: 520, h: 680 },
}

/** Le texte d'un petit morceau de HTML de la boutique (entités comprises), sans l'interpréter. */
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

const ICONS = { stim: StimGlyph, games: GamesGlyph, bank: BankGlyph }

/* -------------------------------------------------------------------------- */
/* Une fenêtre                                                                */
/* -------------------------------------------------------------------------- */

function Win({ win, active, mobile, onFocus, onClose, onMin, onMax, onMove, children }) {
  const drag = useRef(null)
  const down = e => {
    if (mobile || win.max || e.button !== 0 || e.target.closest('button')) return
    onFocus()
    drag.current = { x: e.clientX - win.x, y: e.clientY - win.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = e => {
    if (!drag.current) return
    const W = window.innerWidth, H = window.innerHeight
    onMove(Math.max(-win.w + 120, Math.min(W - 120, e.clientX - drag.current.x)), Math.max(0, Math.min(H - 110, e.clientY - drag.current.y)))
  }
  const up = () => { drag.current = null }
  const full = mobile || win.max
  const Icon = ICONS[win.app]
  return (
    <section className={`pc-win pc-win-${win.app}` + (active ? ' active' : '') + (full ? ' max' : '') + (win.min ? ' min' : '')}
      style={full ? { zIndex: win.z } : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDown={onFocus} role="dialog" aria-label={APPS[win.app].title}>
      <header className="pc-win-bar" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={() => !mobile && onMax()}>
        <span className="pc-win-ico"><Icon /></span>
        <span className="pc-win-title">{APPS[win.app].title}</span>
        <span className="pc-win-btns">
          {!mobile && <button type="button" onClick={onMin} aria-label="Réduire"><svg viewBox="0 0 12 12"><path d="M2 6.5h8" /></svg></button>}
          {!mobile && <button type="button" onClick={onMax} aria-label={win.max ? 'Restaurer' : 'Agrandir'}><svg viewBox="0 0 12 12">{win.max ? <><rect x="2" y="3.5" width="6.5" height="6.5" rx="1" /><path d="M4 3.5V2h6v6H8.5" /></> : <rect x="2" y="2" width="8" height="8" rx="1.2" />}</svg></button>}
          <button type="button" className="x" onClick={onClose} aria-label="Fermer"><svg viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg></button>
        </span>
      </header>
      <div className="pc-win-body">{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Stim : la boutique                                                         */
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

function Media({ g }) {
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

function GamePage({ id, owned, balance, onBuy, onPlay, onFunds }) {
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
          <Media g={g} />
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
            ? <button type="button" className="st-btn go" onClick={() => onPlay(g.id)}>Jouer</button>
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

function Stim({ games, balance, buy, onFunds, onPlay, route, setRoute }) {
  const [feat, setFeat] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [hist, setHist] = useState([])
  const bodyRef = useRef(null)
  const ownedIds = useMemo(() => new Set(games.map(g => g.app_id)), [games])
  const owned = useCallback(id => ownedIds.has(id), [ownedIds])
  useEffect(() => { featuredGames().then(setFeat, e => setErr(e.message)) }, [])
  const go = useCallback(r => { setHist(h => [...h, route]); setRoute(r); bodyRef.current?.scrollTo?.(0, 0) }, [route, setRoute])
  const back = () => { setRoute(hist[hist.length - 1] || { view: 'store' }); setHist(hist.slice(0, -1)) }
  const open = id => go({ view: 'game', id })
  const search = e => {
    e.preventDefault()
    const t = q.trim()
    if (t) go({ view: 'search', q: t })
  }
  useEffect(() => {
    if (route.view !== 'search') return
    let live = true
    setResults(null)
    searchGames(route.q).then(r => { if (live) setResults(r) }, () => { if (live) setResults([]) })
    return () => { live = false }
  }, [route.view, route.q])
  const view = route.view
  const tab = view === 'library' ? 'library' : view === 'wallet' ? 'wallet' : 'store'
  const spent = games.reduce((s, g) => s + (g.price_paid || 0), 0)
  return (
    <div className="st">
      <nav className="st-nav">
        <button type="button" className="st-back" onClick={back} disabled={!hist.length} aria-label="Retour"><Back /></button>
        <div className="st-tabs">
          {[['store', 'Magasin'], ['library', 'Bibliothèque'], ['wallet', 'Porte-monnaie']].map(([k, t]) => (
            <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => go({ view: k })}>{t}</button>
          ))}
        </div>
        <button type="button" className="st-bal" onClick={() => go({ view: 'wallet' })} title="Mon porte-monnaie"><Wallet /> {money(balance)}</button>
      </nav>
      <div className="st-body" ref={bodyRef}>
        {(view === 'store' || view === 'search') && (
          <form className="st-search" onSubmit={search} role="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20 20" /></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un jeu…" enterKeyHint="search" aria-label="Chercher un jeu" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Effacer">×</button>}
          </form>
        )}
        {view === 'store' && (
          err ? <div className="st-empty"><p>{err}</p><button type="button" className="st-btn ghost" onClick={() => { setErr(null); featuredGames().then(setFeat, e => setErr(e.message)) }}>Réessayer</button></div>
            : !feat ? <div className="st-loading"><span /></div>
              : <>
                <Hero list={(feat.top || []).slice(0, 6)} owned={owned} onOpen={open} />
                <Row title="Promotions" list={feat.specials} owned={owned} onOpen={open} />
                <Row title="Les plus vendus" list={feat.top} owned={owned} onOpen={open} />
                <Row title="Nouveautés" list={feat.news} owned={owned} onOpen={open} />
              </>
        )}
        {view === 'search' && (
          <section className="st-results">
            <h3>Résultats pour « {route.q} »</h3>
            {!results ? <div className="st-loading"><span /></div>
              : !results.length ? <div className="st-empty"><p>Aucun jeu trouvé.</p></div>
                : <div className="st-grid">{results.map(g => <GameCard key={g.id} g={g} owned={owned(g.id)} onOpen={open} wide />)}</div>}
          </section>
        )}
        {view === 'game' && <GamePage id={route.id} owned={owned} balance={balance} onBuy={buy} onPlay={onPlay} onFunds={onFunds} />}
        {view === 'library' && (
          <section className="st-results">
            <h3>Ma bibliothèque · {games.length} jeu{games.length > 1 ? 'x' : ''}</h3>
            {!games.length ? <div className="st-empty"><p>Aucun jeu pour l’instant.</p><button type="button" className="st-btn buy" onClick={() => go({ view: 'store' })}>Aller au magasin</button></div>
              : <div className="st-grid">{games.map(g => <GameCard key={g.id} g={{ id: g.app_id, name: g.name, img: g.img }} owned onOpen={open} wide />)}</div>}
          </section>
        )}
        {view === 'wallet' && (
          <section className="st-wallet">
            <div className="st-wallet-card">
              <span className="st-kicker">Porte-monnaie Stim</span>
              <span className="st-wallet-sum">{money(balance)}</span>
              <button type="button" className="st-btn buy" onClick={onFunds}>Ajouter des fonds</button>
            </div>
            <h3>Mes achats</h3>
            {!games.length ? <p className="st-muted">Aucun achat pour l’instant.</p> : (
              <ul className="st-history">
                {games.map(g => <li key={g.id}><span>{g.name}<em>{fmtDate(g.added_at)}</em></span><b>{g.price_paid ? '− ' + fmtPrice(g.price_paid) : 'Gratuit'}</b></li>)}
                <li className="tot"><span>Total dépensé</span><b>{fmtPrice(spent)}</b></li>
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* La Banque Maruchime (pour de faux)                                         */
/* -------------------------------------------------------------------------- */

const AMOUNTS = [5, 10, 20, 50, 100, 250]

function Bank({ holder, balance, addFunds, onDone }) {
  const [amount, setAmount] = useState(50)
  const [step, setStep] = useState('pick')       // pick → confirm (le téléphone) → sending → ok
  const [log, setLog] = useState([])
  const send = () => {
    setStep('sending')
    setTimeout(() => {
      addFunds(amount)
      setLog(l => [{ amount, at: new Date() }, ...l].slice(0, 6))
      setStep('ok')
    }, 1400)
  }
  return (
    <div className="bk">
      <header className="bk-head">
        <span className="bk-logo"><BankGlyph /></span>
        <span><b>Banque Maruchime</b><em>Mon espace</em></span>
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
        <h4>Virer vers mon porte-monnaie Stim</h4>
        <p className="bk-to">Porte-monnaie Stim · solde actuel <b>{money(balance)}</b></p>
        <div className="bk-amounts">
          {AMOUNTS.map(a => <button type="button" key={a} className={a === amount ? 'on' : ''} onClick={() => { setAmount(a); if (step === 'ok') setStep('pick') }}>{a} €</button>)}
        </div>
        <button type="button" className="bk-send" onClick={() => setStep('confirm')} disabled={step === 'sending'}>Virer {fmtPrice(amount)}</button>
        {log.length > 0 && (
          <ul className="bk-log">
            {log.map((l, i) => <li key={i}><span>Virement vers Stim<em>{l.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</em></span><b>− {fmtPrice(l.amount)}</b></li>)}
          </ul>
        )}
        <p className="bk-note">Banque imaginaire : l’argent n’existe pas, rien n’est jamais débité.</p>
      </div>

      {step !== 'pick' && (
        <div className="bk-over" role="dialog" aria-label="Validation du virement">
          {step === 'confirm' && (
            <div className="bk-phone">
              <span className="bk-phone-notch" />
              <span className="bk-phone-app"><BankGlyph /> Banque Maruchime</span>
              <b>Valider ce virement ?</b>
              <span className="bk-phone-sum">{fmtPrice(amount)}</span>
              <span className="bk-phone-to">vers Porte-monnaie Stim</span>
              <button type="button" className="bk-send" onClick={send}>Valider</button>
              <button type="button" className="bk-cancel" onClick={() => setStep('pick')}>Refuser</button>
            </div>
          )}
          {step === 'sending' && <div className="bk-wait"><span className="bk-spin" /><b>Virement en cours…</b></div>}
          {step === 'ok' && (
            <div className="bk-wait ok">
              <div className="st-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
              <b>Virement effectué</b>
              <span>{fmtPrice(amount)} ajoutés à ton porte-monnaie Stim.</span>
              <div className="bk-ok-act">
                <button type="button" className="bk-cancel" onClick={() => setStep('pick')}>Autre virement</button>
                <button type="button" className="bk-send" onClick={onDone}>Retour à Stim</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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

function MyGames({ games, updateGame, removeGame, openStore, openGame, playId, setPlayId }) {
  const [filter, setFilter] = useState('all')
  const [sel, setSel] = useState(null)
  const list = useMemo(() => {
    const l = filter === 'fav' ? games.filter(g => g.favorite) : games
    return [...l].sort((a, b) => (b.favorite - a.favorite) || (b.rating || 0) - (a.rating || 0) || b.added_at.localeCompare(a.added_at))
  }, [games, filter])
  const cur = games.find(g => g.id === sel) || null
  const playing = games.find(g => g.app_id === playId) || null
  if (!games.length) {
    return (
      <div className="gm gm-empty">
        <span className="gm-empty-ico"><GamesGlyph /></span>
        <b>Aucun jeu pour l’instant</b>
        <p>Va faire un tour dans Stim : les jeux que tu achètes arrivent ici.</p>
        <button type="button" className="st-btn buy" onClick={openStore}>Ouvrir Stim</button>
      </div>
    )
  }
  const nFav = games.filter(g => g.favorite).length
  return (
    <div className="gm">
      <div className="gm-bar-top">
        <div className="st-tabs">
          <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Tous · {games.length}</button>
          <button type="button" className={filter === 'fav' ? 'on' : ''} onClick={() => setFilter('fav')}>Mes préférés · {nFav}</button>
        </div>
      </div>
      {filter === 'fav' && !list.length && <div className="st-empty"><p>Touche l’étoile d’un jeu pour l’ajouter à tes préférés.</p></div>}
      <div className="gm-grid">
        {list.map(g => (
          <div key={g.id} className={'gm-tile' + (g.favorite ? ' fav' : '')}>
            <button type="button" className="gm-tile-img" onClick={() => setSel(g.id)}>
              {g.img && <img src={g.img} alt="" loading="lazy" />}
              <span className="gm-tile-name">{g.name}</span>
            </button>
            <button type="button" className={'gm-star' + (g.favorite ? ' on' : '')} onClick={() => updateGame(g.id, { favorite: !g.favorite })} aria-pressed={g.favorite} aria-label={g.favorite ? 'Retirer des préférés' : 'Ajouter aux préférés'}><Star on={g.favorite} /></button>
            <button type="button" className="gm-play" onClick={() => setPlayId(g.app_id)} aria-label={`Jouer à ${g.name}`}>▶</button>
          </div>
        ))}
      </div>

      {cur && (
        <div className="gm-detail" role="dialog" aria-label={cur.name}>
          <div className="gm-detail-hero" style={cur.img ? { backgroundImage: `url("${cur.img}")` } : null}>
            <button type="button" className="st-back" onClick={() => setSel(null)} aria-label="Retour"><Back /></button>
          </div>
          <div className="gm-detail-body">
            <h3>{cur.name}</h3>
            <p className="st-muted">{[cur.genres?.slice(0, 2).join(', '), cur.release].filter(Boolean).join(' · ')}</p>
            <div className="gm-detail-act">
              <button type="button" className="st-btn go" onClick={() => setPlayId(cur.app_id)}>▶ Jouer</button>
              <button type="button" className={'st-btn ghost gm-fav' + (cur.favorite ? ' on' : '')} onClick={() => updateGame(cur.id, { favorite: !cur.favorite })}><Star on={cur.favorite} /> {cur.favorite ? 'Dans mes préférés' : 'Ajouter aux préférés'}</button>
            </div>
            <div className="gm-rate" role="group" aria-label="Ma note">
              <span>Ma note</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button type="button" key={n} className={(cur.rating || 0) >= n ? 'on' : ''} onClick={() => updateGame(cur.id, { rating: cur.rating === n ? null : n })} aria-label={`${n} sur 5`}><Star on={(cur.rating || 0) >= n} /></button>
              ))}
            </div>
            <p className="st-muted">Acheté le {fmtDate(cur.added_at)} · {cur.price_paid ? fmtPrice(cur.price_paid) : 'gratuit'}</p>
            <div className="gm-detail-links">
              <button type="button" className="gm-link" onClick={() => openGame(cur.app_id)}>Voir la page dans Stim</button>
              <button type="button" className="gm-link danger" onClick={() => { removeGame(cur.id); setSel(null) }}>Retirer de mes jeux</button>
            </div>
          </div>
        </div>
      )}
      {playing && <Launch game={playing} onQuit={() => setPlayId(null)} />}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Le bureau                                                                  */
/* -------------------------------------------------------------------------- */

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

export default function PcOS({ games, balance, addFunds, buy, updateGame, removeGame, holder, fromRect, onClose }) {
  const mobile = useIsMobile()
  const rootRef = useRef(null)
  const [wins, setWins] = useState([])
  const [menu, setMenu] = useState(false)
  const [closing, setClosing] = useState(false)
  const [stimRoute, setStimRoute] = useState({ view: 'store' })
  const [playId, setPlayId] = useState(null)
  const zTop = useRef(10)

  // comme le reste du salon : l'écran s'agrandit depuis le moniteur 3D
  const rectInset = useCallback(() => {
    const r = fromRect
    if (!r || !(r.w > 0)) return null
    const W = window.innerWidth, H = window.innerHeight
    return `inset(${Math.max(0, r.y)}px ${Math.max(0, W - r.x - r.w)}px ${Math.max(0, H - r.y - r.h)}px ${Math.max(0, r.x)}px round 4px)`
  }, [fromRect])
  useEffect(() => {
    const el = rootRef.current, from = rectInset()
    if (!el?.animate || !from) return
    el.animate([{ clipPath: from, opacity: 0.7 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'both' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const close = useCallback(() => {
    if (closing) return
    setClosing(true); setMenu(false)
    const el = rootRef.current, to = rectInset()
    if (el?.animate && to) el.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }, { clipPath: to, opacity: 0.5 }], { duration: 420, easing: 'cubic-bezier(.5, 0, .8, .4)', fill: 'forwards' }).finished.then(onClose, onClose)
    else setTimeout(onClose, 300)
  }, [closing, onClose, rectInset])

  const openApp = useCallback(app => {
    setMenu(false)
    setWins(ws => {
      const z = ++zTop.current
      const have = ws.find(w => w.app === app)
      if (have) return ws.map(w => (w.app === app ? { ...w, z, min: false } : w))
      const W = window.innerWidth, H = window.innerHeight - 52
      const w = Math.min(APPS[app].w, W - 40), h = Math.min(APPS[app].h, H - 30)
      const off = ws.length * 28
      return [...ws, { app, z, w, h, x: Math.max(10, (W - w) / 2 + off - 28), y: Math.max(10, (H - h) / 2 + off - 20), max: false, min: false }]
    })
  }, [])
  const patch = (app, p) => setWins(ws => ws.map(w => (w.app === app ? { ...w, ...p } : w)))
  const focus = app => setWins(ws => {
    const top = ws.reduce((m, w) => (w.min ? m : Math.max(m, w.z)), 0)
    const me = ws.find(w => w.app === app)
    if (!me || (me.z === top && !me.min)) return ws
    const z = ++zTop.current
    return ws.map(w => (w.app === app ? { ...w, z, min: false } : w))
  })
  const closeWin = app => setWins(ws => ws.filter(w => w.app !== app))
  const visible = wins.filter(w => !w.min)
  const activeApp = visible.length ? visible.reduce((a, b) => (b.z > a.z ? b : a)).app : null

  // depuis Mes jeux : « Jouer » ; depuis Stim : la page d'un jeu
  const play = id => { setPlayId(id); openApp('games') }
  const showGame = id => { setStimRoute({ view: 'game', id }); openApp('stim') }
  const funds = () => openApp('bank')

  useEffect(() => {
    const k = e => {
      if (e.key !== 'Escape' || e.target?.tagName === 'INPUT') return
      if (menu) { setMenu(false); return }
      if (playId) { setPlayId(null); return }
      if (activeApp) { closeWin(activeApp); return }
      close()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [menu, playId, activeApp, close])

  const content = app => {
    if (app === 'stim') return <Stim games={games} balance={balance} buy={buy} onFunds={funds} onPlay={play} route={stimRoute} setRoute={setStimRoute} />
    if (app === 'games') return <MyGames games={games} updateGame={updateGame} removeGame={removeGame} openStore={() => openApp('stim')} openGame={showGame} playId={playId} setPlayId={setPlayId} />
    return <Bank holder={holder} balance={balance} addFunds={addFunds} onDone={() => { closeWin('bank'); openApp('stim') }} />
  }

  return (
    <div ref={rootRef} className={'pcos' + (closing ? ' closing' : '') + (mobile ? ' mobile' : '')} role="application" aria-label="Le PC">
      <div className="pc-wall" aria-hidden="true"><i /><i /><i /><span>Maruchime OS</span></div>
      <div className="pc-icons" onPointerDown={() => setMenu(false)}>
        {[['games', 'Mes jeux'], ['stim', 'Stim']].map(([app, label]) => {
          const Icon = ICONS[app]
          return (
            <button type="button" key={app} className={'pc-icon pc-icon-' + app} onClick={() => openApp(app)}>
              <span className="pc-icon-tile"><Icon /></span>
              <span className="pc-icon-name">{label}</span>
            </button>
          )
        })}
      </div>

      {wins.map(w => (
        <Win key={w.app} win={w} active={w.app === activeApp} mobile={mobile} onFocus={() => focus(w.app)}
          onClose={() => closeWin(w.app)} onMin={() => patch(w.app, { min: true })} onMax={() => patch(w.app, { max: !w.max })} onMove={(x, y) => patch(w.app, { x, y })}>
          {content(w.app)}
        </Win>
      ))}

      {menu && (
        <div className="pc-menu" role="menu">
          <div className="pc-menu-head"><span className="pc-orb" /><span><b>{holder || 'Joueur'}</b><em>Maruchime OS</em></span></div>
          <button type="button" role="menuitem" onClick={() => openApp('games')}><span className="pc-menu-ico games"><GamesGlyph /></span>Mes jeux</button>
          <button type="button" role="menuitem" onClick={() => openApp('stim')}><span className="pc-menu-ico stim"><StimGlyph /></span>Stim</button>
          <button type="button" role="menuitem" onClick={() => openApp('bank')}><span className="pc-menu-ico bank"><BankGlyph /></span>Banque Maruchime</button>
          <button type="button" role="menuitem" className="pc-menu-off" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v8M7 6.5a7.5 7.5 0 1 0 10 0" /></svg> Éteindre et revenir au salon
          </button>
        </div>
      )}

      <footer className="pc-task">
        <button type="button" className={'pc-start' + (menu ? ' on' : '')} onClick={() => setMenu(v => !v)} aria-label="Menu" aria-expanded={menu}><span className="pc-orb" /></button>
        <div className="pc-task-apps">
          {wins.map(w => {
            const Icon = ICONS[w.app]
            return (
              <button type="button" key={w.app} className={'pc-task-app' + (w.app === activeApp ? ' on' : '') + (w.min ? ' min' : '')}
                onClick={() => (w.app === activeApp ? patch(w.app, { min: true }) : focus(w.app))} title={APPS[w.app].title}>
                <span className={'pc-task-ico ' + w.app}><Icon /></span><span className="pc-task-name">{APPS[w.app].title}</span>
              </button>
            )
          })}
        </div>
        <button type="button" className="pc-task-bal" onClick={() => { setStimRoute({ view: 'wallet' }); openApp('stim') }} title="Porte-monnaie Stim"><Wallet /> {money(balance)}</button>
        {!mobile && <Clock />}
        <button type="button" className="pc-off" onClick={close} aria-label="Éteindre le PC" title="Éteindre et revenir au salon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v8M7 6.5a7.5 7.5 0 1 0 10 0" /></svg>
        </button>
      </footer>
    </div>
  )
}
