import { useEffect, useMemo, useRef, useState } from 'react'
import { LivingRoomScene, dayMode } from '../three/LivingRoomScene'
import { useIsMobile } from '../hooks/useIsMobile'
import SeriesTV from './SeriesTV'
import TvBackdrop from './TvBackdrop'

const store = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}
const BUBBLE_KEY = 'levana.series.bulle'

const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`

function greeting(hour) {
  if (hour >= 5 && hour < 18) return 'Bonjour'
  return 'Bonsoir'
}

/**
 * L'accueil : le salon. La bibliothèque du salon mène au mur de livres ;
 * la télé passe nos séries (on la touche : on entre dedans) ; le panier sur la table basse
 * ouvre la recherche, ou, s'il reste des livres dedans, le rangement guidé.
 */
export default function LivingRoom({ books, shelves, basketItems, series, onAddSeries, onUpdateSeries, onRemoveSeries, onRenameCategory, from, onEntered, onOpenBook, onAddBooks, getLibrary, onSignOut }) {
  const rootRef = useRef(null)
  const hostRef = useRef(null)
  const topRef = useRef(null)
  const bottomRef = useRef(null)
  const sceneRef = useRef(null)
  const [hover, setHover] = useState(null)
  const [going, setGoing] = useState(from === 'back')
  const [tv, setTv] = useState(false)           // zoom sur la télé (en cours ou fini)
  const [inside, setInside] = useState(false)   // zoom fini : on est dans la télé
  const [bubbleOff, setBubbleOff] = useState(() => store.get(BUBBLE_KEY) === 'off')
  const tvVideo = useRef(null)
  const [sound, setSound] = useState(false)      // le son de la télé (coupé à l'arrivée)
  const [onAir, setOnAir] = useState(false)      // un générique passe
  const count = basketItems?.length || 0
  const mobile = useIsMobile()
  const cb = useRef({})
  const hour = useMemo(() => {
    const q = new URLSearchParams(location.search).get('heure')
    const d = new Date()
    return q != null && !isNaN(+q) ? +q : d.getHours() + d.getMinutes() / 60
  }, [])
  const mode = dayMode(hour)

  // entrer : la caméra rejoint la vue exacte de la bibliothèque, le salon s'efface autour
  const go = next => {
    const s = sceneRef.current
    if (!s || cb.current.going) return
    cb.current.going = true
    setGoing(true)
    setHover(null)
    s.enter(() => {
      const el = rootRef.current
      const done = () => cb.current.onEntered?.(typeof next === 'string' ? next : null)
      if (!el?.animate) { done(); return }
      // les deux vues sont identiques : on retire simplement le salon (les menus apparaissent)
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in-out', fill: 'forwards' }).finished.then(done, done)
    })
  }
  cb.current.go = go
  cb.current.onEntered = onEntered
  cb.current.onOpenBook = onOpenBook
  cb.current.onAddBooks = onAddBooks
  cb.current.getLibrary = getLibrary
  cb.current.count = count
  cb.current.bubbleOn = !bubbleOff

  useEffect(() => {
    const host = hostRef.current
    const s = new LivingRoomScene(host, {
      onHover: setHover,
      onEnter: () => cb.current.go(),
      // panier : s'il reste des livres, on entre et on les range ; sinon on en cherche
      onBasket: () => (cb.current.count > 0 ? cb.current.go('guide') : cb.current.onAddBooks?.()),
      onTvZoom: on => { setTv(on); if (on) { store.set(BUBBLE_KEY, 'off'); setBubbleOff(true) } },
      onTvInside: setInside,
      tvVideo: () => tvVideo.current,
      tvBubble: () => cb.current.bubbleOn,
      onTvBubbleClose: () => { store.set(BUBBLE_KEY, 'off'); setBubbleOff(true) },
      getLibrary: () => cb.current.getLibrary?.(),
      margins: () => {
        const h = host.clientHeight || 1
        return {
          top: ((topRef.current?.offsetHeight || 90) + 6) / h,
          bottom: ((bottomRef.current?.offsetHeight || 110) + 6) / h,
          side: 0.012,
        }
      },
    })
    sceneRef.current = s
    if (import.meta.env.DEV || location.search.includes('debug')) window.__salon = s
    let t
    if (from === 'back') {
      s.arriveFromLibrary()
      rootRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-in-out' })
      t = setTimeout(() => setGoing(false), 1100)
    }
    return () => { clearTimeout(t); s.dispose(); sceneRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sceneRef.current?.setTvBubble(!bubbleOff) }, [bubbleOff])

  // nos séries sur l'écran : les mieux notées d'abord
  const tvSeries = useMemo(() => [...(series || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.added_at || '').localeCompare(a.added_at || '')), [series])
  useEffect(() => { sceneRef.current?.setSeries(tvSeries) }, [tvSeries])

  // Échap pendant le zoom : on ressort (une fois dans la télé, c'est le module qui s'en charge)
  useEffect(() => {
    if (!tv || inside) return
    const onKey = e => { if (e.key === 'Escape') sceneRef.current?.unzoomTv() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tv, inside])

  // les livres, dans l'ordre des étagères ; l'habillage de la première étagère
  const byId = useMemo(() => new Map(books.map(b => [b.id, b])), [books])
  const ordered = useMemo(() => shelves.flatMap(s => s.book_ids).map(id => byId.get(id)).filter(Boolean), [shelves, byId])
  const firstSkin = shelves.find(s => !s.pseudo) || null
  const reading = useMemo(() => books.filter(b => (b.statuses || []).includes('en_cours')), [books])

  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.setShelfSkin(firstSkin && { material: firstSkin.material, wall: firstSkin.wall })
    s.setBooks(ordered)
  }, [ordered, firstSkin?.material, firstSkin?.wall]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sceneRef.current?.setBasket(basketItems || []) }, [basketItems])

  // la place des marges change avec la taille de l'écran
  useEffect(() => { sceneRef.current?.resize() }, [mobile])

  const sub = books.length
    ? `${plural(books.length, 'livre')} sur les étagères${reading.length ? ` · ${reading.length} en cours` : ''}`
    : 'Ta bibliothèque t’attend'

  return (
    <div className={`salon mood-${mode}` + (going || tv ? ' going' : '') + (tv ? ' tv-mode' : '')} ref={rootRef}>
      <div className="salon-stage" ref={hostRef} />
      {/* les génériques, en fond sur la télé (posés sur l'écran 3D par la scène) */}
      <div className="tv-video" ref={tvVideo} aria-hidden="true">
        {!tv && !going && tvSeries.length > 0 && <TvBackdrop series={tvSeries} sound={sound} onPlaying={setOnAir} />}
      </div>
      {onAir && !tv && !going && (
        <button type="button" className={'tv-sound' + (sound ? ' on' : '')} onClick={() => setSound(v => !v)}
          aria-pressed={sound} aria-label={sound ? 'Couper le son de la télé' : 'Mettre le son de la télé'}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
            {sound
              ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              : <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
          </svg>
          <span>{sound ? 'Son' : 'Muet'}</span>
        </button>
      )}

      {/* on a zoomé à bloc sur la télé : nos séries, il ne reste que le contour de l'écran */}
      {inside && (
        <SeriesTV series={series || []} onAdd={onAddSeries} onUpdate={onUpdateSeries} onRemove={onRemoveSeries} onRenameCategory={onRenameCategory}
          onClose={() => sceneRef.current?.unzoomTv()} />
      )}

      <div className="salon-top" ref={topRef}>
        <div className="logo">
          <div className="logo-name">Levana</div>
          <div className="logo-sub">Bibliothèque</div>
        </div>
        <p className="salon-hello"><span>{greeting(hour)}.</span></p>
        <p className="lbl salon-sub">{sub}</p>
        {mobile && onSignOut && <button type="button" className="lbl salon-out salon-out-top" onClick={onSignOut}>Déconnexion</button>}
      </div>

      {hover && hover.x != null && (
        <div className="salon-chip lbl" style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 16}px)` }}>{hover.label}</div>
      )}

      {mobile ? (
        /* téléphone : le menu du bas propose les deux « pièces » du salon */
        <nav className={'tabbar salon-tabs' + (going || tv ? ' away' : '')} ref={bottomRef} aria-label="Où aller">
          <button type="button" className="tab" onClick={go} disabled={going}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v16M20 4v16M4 9h16M4 14.5h16M4 20h16M7 9V6M9 9V5.5M12 14.5v-3.5M14.5 14.5v-3" /></svg>
            <span>Ma bibliothèque</span>
          </button>
          <p className="salon-tabs-hint">Glisse pour tourner la pièce</p>
          <button type="button" className="tab" onClick={() => sceneRef.current?.zoomTv()} disabled={going}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="1.5" /><path d="M8.5 20h7M10.5 9l4 2-4 2z" /></svg>
            <span>Nos séries</span>
          </button>
        </nav>
      ) : (
        <div className="salon-bottom" ref={bottomRef}>
          <div className="salon-go-row">
            <button type="button" className="lbl box cobalt salon-go" onClick={go} disabled={going}>
              Entrer dans ma bibliothèque <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="lbl box salon-go" onClick={() => sceneRef.current?.zoomTv()} disabled={going}>
              Nos séries <span aria-hidden="true">▶</span>
            </button>
          </div>
          <p className="salon-hint">Fais glisser pour regarder autour, clique sur les objets</p>
          {onSignOut && <button type="button" className="lbl salon-out" onClick={onSignOut}>Déconnexion</button>}
        </div>
      )}
    </div>
  )
}
