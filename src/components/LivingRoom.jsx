import { useEffect, useMemo, useRef, useState } from 'react'
import { LivingRoomScene, dayMode, SALON_VIEW } from '../three/LivingRoomScene'
import KitchenScene, { KITCHEN_VIEW } from '../three/KitchenScene'
import { RoomCarousel } from '../three/carousel'
import GarageScene, { GARAGE_VIEW } from '../three/GarageScene'
import BedroomScene, { BEDROOM_VIEW } from '../three/BedroomScene'
import RoomSoon from './RoomSoon'
import { useIsMobile } from '../hooks/useIsMobile'
import SeriesTV from './SeriesTV'
import ShowcasePanel from './ShowcasePanel'
import { resolveShowcase } from '../lib/showcase'
import PcOS from './PcOS'
import Kitchen from './Kitchen'
import { applyTheme } from '../lib/theme'
import { useLayer, takeStart, useNav, takePending } from '../lib/nav'

const store = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}
const BUBBLE_KEY = 'levana.series.bulle'

const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`

function SpeakerIcon({ level }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" className="fill" />
      {level <= 0 ? <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
        : <>
          <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
          {level > 40 && <path d="M18.5 7a7 7 0 0 1 0 10" />}
          {level > 75 && <path d="M21 4.5a10.5 10.5 0 0 1 0 15" />}
        </>}
    </svg>
  )
}

const VOL_KEY = 'levana.tv.volume'
/**
 * La barre de volume de la télé : on la monte ou on la baisse du doigt (ou de la souris, des
 * flèches) ; le petit haut-parleur dessous coupe le son ou le remet au dernier niveau.
 */
function VolumePop({ value, onChange, onClose }) {
  const track = useRef(null)
  const box = useRef(null)
  const drag = useRef(false)
  const last = () => { try { return +localStorage.getItem(VOL_KEY) || 60 } catch { return 60 } }
  const set = v => {
    v = Math.round(Math.max(0, Math.min(100, v)))
    onChange(v)
    if (v > 0) { try { localStorage.setItem(VOL_KEY, String(v)) } catch { /* ignore */ } }
  }
  const fromY = y => { const r = track.current.getBoundingClientRect(); set(((r.bottom - y) / r.height) * 100) }
  // un toucher ailleurs ferme la barre
  useEffect(() => {
    const out = e => { if (!box.current?.contains(e.target) && !e.target.closest?.('.salon-vol')) onClose() }
    window.addEventListener('pointerdown', out)
    return () => window.removeEventListener('pointerdown', out)
  }, [onClose])
  return (
    <div className="salon-vol-pop" ref={box}>
      <span className="salon-vol-num">{value}</span>
      <div className="salon-vol-track" ref={track} role="slider" tabIndex={0} aria-label="Volume" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-orientation="vertical"
        onPointerDown={e => { drag.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); fromY(e.clientY) }}
        onPointerMove={e => { if (drag.current) fromY(e.clientY) }}
        onPointerUp={() => { drag.current = false }} onPointerCancel={() => { drag.current = false }}
        onKeyDown={e => {
          const d = { ArrowUp: 10, ArrowRight: 10, ArrowDown: -10, ArrowLeft: -10, PageUp: 25, PageDown: -25 }[e.key]
          if (d) { e.preventDefault(); set(value + d) } else if (e.key === 'Escape') onClose()
        }}>
        <span className="salon-vol-fill" style={{ height: value + '%' }} />
        <span className="salon-vol-knob" style={{ bottom: value + '%' }} />
      </div>
      <button type="button" className="salon-vol-mute" onClick={() => set(value > 0 ? 0 : last())} aria-label={value > 0 ? 'Couper le son' : 'Remettre le son'}>
        <SpeakerIcon level={value > 0 ? 0 : 50} />
      </button>
    </div>
  )
}

function greeting(hour) {
  if (hour >= 5 && hour < 18) return 'Bonjour'
  return 'Bonsoir'
}

/**
 * L'accueil : le salon. La bibliothèque du salon mène au mur de livres ;
 * l'image projetée passe nos films et séries (on la touche : on entre dedans).
 */
const ROOM_NAMES = { salon: 'Le salon', cuisine: 'La cuisine', garage: 'Le garage', chambre: 'La chambre' }
const ROOMS = ['cuisine', 'garage', 'chambre']
// les zooms du salon et leur adresse : la télé (nos films), le meuble télé (la vitrine), le PC
const ZOOM_PATH = { tv: '/films', cab: '/vitrine', pc: '/jeux' }
const ZOOM_TAP = { films: 'tv', vitrine: 'cabinet', jeux: 'pc' }

export default function LivingRoom({ books, shelves, basketItems, series, onAddSeries, onUpdateSeries, onRemoveSeries, onRenameCategory, gamesApi, holder, userId, tv: tvBus, showcase, from, onEntered, onOpenBook, onAddBooks, getLibrary, onSignOut }) {
  // arrivée sur le site par une adresse (« /cuisine/semaine », « /jeux »…) : on y va tout de suite
  const startRef = useRef(undefined)
  if (startRef.current === undefined) startRef.current = takeStart([...ROOMS, ...Object.keys(ZOOM_TAP)])
  const start = startRef.current
  const front0 = ROOMS.includes(start?.[0]) ? start[0] : 'salon'
  const kitchenStart = useRef(start?.[0] === 'cuisine' ? start.slice(1) : null)
  const zoomClose = useRef(null)   // la fermeture animée du module ouvert dans un zoom (la télé, le PC…)
  const [zoomKind, setZoomKind] = useState(null)
  const rootRef = useRef(null)
  const hostRef = useRef(null)
  const topRef = useRef(null)
  const bottomRef = useRef(null)
  const sceneRef = useRef(null)
  const kitchenHostRef = useRef(null)   // la cuisine : une autre maquette, sur le même carrousel
  const kitchenRef = useRef(null)
  const carouselRef = useRef(null)
  const garageHostRef = useRef(null)    // le garage et la chambre : deux autres maquettes du carrousel
  const bedroomHostRef = useRef(null)
  const roomScenes = useRef({})
  const [spots, setSpots] = useState([])   // les pièces du fond, à l'écran (on y va en les touchant)
  const [hover, setHover] = useState(null)
  const [going, setGoing] = useState(from === 'back')
  const [tv, setTv] = useState(false)           // zoom sur la télé (en cours ou fini)
  const [inside, setInside] = useState(false)   // zoom fini : 'tv' (dans l'image projetée), 'cab' (devant la vitrine) ou 'pc' (l'écran du PC)
  const [openWork, setOpenWork] = useState(null) // depuis la vitrine : la fiche ouverte (ou 'list' pour notre liste)
  const [bubbleOff, setBubbleOff] = useState(() => store.get(BUBBLE_KEY) === 'off')
  // la télé (son lecteur vit au-dessus du salon, dans l'appli : il continue quand on part)
  const { el: tvVideo, volume, setVolume, onAir, nowId, setSkip, setWall } = tvBus
  const [volOpen, setVolOpen] = useState(false)
  const [seated, setSeated] = useState(false)    // assis dans le canapé
  // rideaux fermés : tout le salon passe en sombre (mode cinéma)
  const [cinema, setCinema] = useState(() => { try { return localStorage.getItem('levana.salon.rideaux') === '1' } catch { return false } })
  useEffect(() => { applyTheme(cinema) }, [cinema])   // tout le site suit les rideaux
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
    setLeaving(true)
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
  cb.current.bubbleOn = !bubbleOff

  useEffect(() => {
    const host = hostRef.current
    const s = new LivingRoomScene(host, {
      onHover: setHover,
      onEnter: () => cb.current.go(),
      // panier : s'il reste des livres, on entre et on les range ; sinon on en cherche
      onTvZoom: on => { setTv(on); setZoomKind(on ? sceneRef.current?.tvZoom?.kind || 'tv' : null); if (on) { store.set(BUBBLE_KEY, 'off'); setBubbleOff(true) } },
      onTvInside: setInside,
      onCinema: setCinema,
      onSeat: setSeated,
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
    // le carrousel des pièces : le salon devant, la cuisine au fond qui tourne doucement
    const k = new KitchenScene(kitchenHostRef.current, {})
    kitchenRef.current = k
    if (import.meta.env.DEV || location.search.includes('debug')) window.__kitchen = k
    const gar = new GarageScene(garageHostRef.current, {})
    const bed = new BedroomScene(bedroomHostRef.current, {})
    roomScenes.current = { cuisine: k, garage: gar, chambre: bed }
    // les pièces autour du carrousel : à droite la cuisine, au fond le garage, à gauche la chambre
    const car = new RoomCarousel([
      { id: 'salon', scene: s, host, az0: SALON_VIEW.az, el0: SALON_VIEW.el },
      { id: 'cuisine', scene: k, host: kitchenHostRef.current, az0: KITCHEN_VIEW.az, el0: KITCHEN_VIEW.el },
      { id: 'garage', scene: gar, host: garageHostRef.current, az0: GARAGE_VIEW.az, el0: GARAGE_VIEW.el },
      { id: 'chambre', scene: bed, host: bedroomHostRef.current, az0: BEDROOM_VIEW.az, el0: BEDROOM_VIEW.el },
    ], front0)
    carouselRef.current = car
    // une adresse de zoom (« /films », « /jeux », « /vitrine ») : on y va depuis le salon
    const zt = ZOOM_TAP[start?.[0]]
    const tz = zt ? setTimeout(() => s.tap(zt), 650) : 0
    setSpots(car.spots())
    const onResize = () => { car.resize(); setSpots(car.spots()) }
    window.addEventListener('resize', onResize)
    let t
    if (from === 'back') {
      s.arriveFromLibrary()
      rootRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-in-out' })
      t = setTimeout(() => setGoing(false), 1100)
    }
    return () => { clearTimeout(t); clearTimeout(tz); window.removeEventListener('resize', onResize); car.dispose(); k.dispose(); gar.dispose(); bed.dispose(); s.dispose(); sceneRef.current = null; kitchenRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sceneRef.current?.setTvBubble(!bubbleOff) }, [bubbleOff])
  // l'écran du PC, dans la pièce, montre notre fond d'écran
  useEffect(() => { sceneRef.current?.setPcWallpaper?.(gamesApi?.wallpaper?.url || null) }, [gamesApi?.wallpaper?.url])
  useEffect(() => { sceneRef.current?.setPcColors?.({ pc: gamesApi?.setup?.pc, kb: gamesApi?.setup?.kb }) }, [gamesApi?.setup?.pc, gamesApi?.setup?.kb])

  // nos séries sur l'écran : les mieux notées d'abord
  const tvSeries = useMemo(() => [...(series || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.added_at || '').localeCompare(a.added_at || '')), [series])
  useEffect(() => { sceneRef.current?.setSeries(tvSeries) }, [tvSeries])
  // nos médias préférés, debout sur le meuble télé
  const shownMedia = useMemo(() => resolveShowcase(showcase?.items || [], { books, series: series || [], games: gamesApi?.games || [] }), [showcase?.items, books, series, gamesApi?.games])
  useEffect(() => { sceneRef.current?.setShowcase(shownMedia) }, [shownMedia])
  // ce qui passe à la télé : l'image projetée suit, et le lecteur n'a le son que si on voit le mur
  useEffect(() => { sceneRef.current?.setVideoOn(onAir) }, [onAir])
  useEffect(() => { if (nowId) sceneRef.current?.showWork(nowId) }, [nowId])
  // le son de la télé : on le baisse dès qu'on part (vers la bibliothèque, le PC, les films…) et on
  // le remonte dès qu'on revient (pendant l'animation du retour)
  const [leaving, setLeaving] = useState(false)
  // la pièce de devant sur le carrousel ('salon' ou 'cuisine'), et le tour en cours
  const [room, setRoom] = useState(front0)
  const [turning, setTurning] = useState(false)
  const goRoom = id => {
    if (turning || id === room || !carouselRef.current) return
    setTurning(true); setHover(null); setSpots([])
    carouselRef.current.turnTo(id, () => { setRoom(id); setTurning(false); setSpots(carouselRef.current?.spots() || []) })
  }
  const away = room !== 'salon' || turning
  useEffect(() => { setWall(!tv && !leaving && !away) }, [tv, leaving, away]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { setWall(false); tvVideo.current?.setAttribute('data-off', '') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // la barre de la maison : aller dans un module depuis le salon (une fois tout refermé)
  const nav = useNav()
  const [navTick, setNavTick] = useState(0)
  useEffect(() => {
    const p = nav.pending
    const s = sceneRef.current
    if (!p || !s) return
    // la caméra bouge encore (on sort de la télé, du PC…) : on réessaie un peu plus tard
    if (turning || going || tv || s.tvZoom || s.fly) { const t = setTimeout(() => setNavTick(n => n + 1), 200); return () => clearTimeout(t) }
    if (ROOMS.includes(p)) {
      if (nav.depth > (room === 'salon' ? 0 : 1)) return
      takePending()
      if (p !== room) goRoom(p)
      return
    }
    if (room !== 'salon' || nav.depth > 0) return
    takePending()
    if (p === 'bibliotheque') go()
    else if (p === 'films') s.tap('tv')
    else if (p === 'jeux') s.tap('pc')
  }, [nav.pending, nav.depth, navTick, turning, going, tv, room]) // eslint-disable-line react-hooks/exhaustive-deps

  // les zooms ont leur adresse ; le retour referme le module (avec son animation) ou ressort du zoom
  useLayer(tv && !!zoomKind, ZOOM_PATH[zoomKind] || '/films', () => (zoomClose.current ? zoomClose.current() : sceneRef.current?.unzoomTv()), { modal: zoomKind === 'cab' })
  const workClose = useRef(null)
  useLayer(!!openWork, '/vitrine/films', () => (workClose.current ? workClose.current() : setOpenWork(null)), { modal: true })
  useEffect(() => { if (!inside) setOpenWork(null) }, [inside])

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

  // la place des marges change avec la taille de l'écran
  useEffect(() => { sceneRef.current?.resize() }, [mobile])

  const sub = books.length
    ? `${plural(books.length, 'livre')} sur les étagères${reading.length ? ` · ${reading.length} en cours` : ''}`
    : 'Ta bibliothèque t’attend'

  return (
    <div className={`salon mood-${mode}` + (going || tv ? ' going' : '') + (tv ? ' tv-mode' : '') + (cinema ? ' cinema' : '') + (away ? ' room-away' : '')} ref={rootRef}>
      {/* les maquettes, chacune sa toile : celle de devant passe au-dessus (le carrousel s'en charge) */}
      <div className="salon-rooms">
        <div className="salon-stage" ref={hostRef} />
        <div className="salon-stage room-stage" ref={kitchenHostRef} />
        <div className="salon-stage room-stage" ref={garageHostRef} />
        <div className="salon-stage room-stage" ref={bedroomHostRef} />
      </div>
      {/* les pièces du fond : on les touche pour y aller (le carrousel tourne) */}
      {!turning && !going && !tv && spots.map(p => (
        <button type="button" key={p.id} className={'room-pick' + (p.above ? ' above' : '')} onClick={() => goRoom(p.id)} aria-label={`Aller dans ${ROOM_NAMES[p.id].toLowerCase()}`}
          style={{ left: p.x, top: p.y, width: p.size * 0.62, height: p.size * 0.5 }}>
          <span>{ROOM_NAMES[p.id]}</span>
        </button>
      ))}
      {turning && <div className="room-turning" aria-hidden="true" />}
      {/* les génériques, en fond sur la télé (posés sur l'écran 3D par la scène) */}
      {/* assis dans le canapé : un bouton pour se lever */}
      {seated && !tv && !going && (
        <button type="button" className="salon-stand" onClick={() => sceneRef.current?.stand()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" /></svg>
          Se lever
        </button>
      )}

      {/* les commandes du salon : le son, le générique suivant, les rideaux */}
      {!tv && !going && (
        <div className="salon-ctrls" role="toolbar" aria-label="Le salon">
          {onAir && (
            <div className="salon-vol">
              <button type="button" className={'salon-ctrl' + (volume > 0 ? ' on' : '') + (volOpen ? ' open' : '')} onClick={() => setVolOpen(o => !o)}
                aria-expanded={volOpen} aria-label="Volume de la télé" title="Volume de la télé">
                <SpeakerIcon level={volume} />
              </button>
              {volOpen && <VolumePop value={volume} onChange={setVolume} onClose={() => setVolOpen(false)} />}
            </div>
          )}
          {tvSeries.length > 1 && (
            <button type="button" className="salon-ctrl" onClick={() => setSkip(n => n + 1)} aria-label="Générique suivant" title="Générique suivant">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6l8 6-8 6z" className="fill" /><path d="M13 6l6 6-6 6" /><path d="M20 6v12" /></svg>
            </button>
          )}
          <button type="button" className={'salon-ctrl' + (cinema ? ' on' : '')} onClick={() => sceneRef.current?.setCurtains(!cinema)}
            aria-pressed={cinema} aria-label={cinema ? 'Ouvrir les rideaux' : 'Fermer les rideaux'} title={cinema ? 'Ouvrir les rideaux' : 'Fermer les rideaux'}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 4h18" />
              {cinema
                ? <><path d="M5 4v16h7V4" className="fill" /><path d="M19 4v16h-7" className="fill" /></>
                : <><path d="M5 4v16c2-3 3-7 3-16" className="fill" /><path d="M19 4v16c-2-3-3-7-3-16" className="fill" /></>}
            </svg>
          </button>
        </div>
      )}

      {/* on a zoomé à bloc sur la télé : nos séries, il ne reste que le contour de l'écran */}
      {inside === 'tv' && (
        <SeriesTV base="/films" closeRef={zoomClose} series={series || []} fromRect={sceneRef.current?.screenRect?.()} onAdd={onAddSeries} onUpdate={onUpdateSeries} onRemove={onRemoveSeries} onRenameCategory={onRenameCategory}
          onClose={() => sceneRef.current?.unzoomTv()} />
      )}

      {/* devant le meuble télé : la vitrine de nos films et séries */}
      {inside === 'cab' && !openWork && showcase && (
        <ShowcasePanel closeRef={zoomClose} shown={shownMedia} api={showcase} books={books} series={series || []} games={gamesApi?.games || []} onClose={() => sceneRef.current?.unzoomTv()} />
      )}
      {inside === 'cab' && openWork && (
        <SeriesTV base="/vitrine/films" closeRef={workClose} series={series || []} initialId={openWork === 'list' ? null : openWork} onAdd={onAddSeries} onUpdate={onUpdateSeries} onRemove={onRemoveSeries} onRenameCategory={onRenameCategory}
          onClose={() => setOpenWork(null)} />
      )}

      {/* devant le PC du bureau gamer : son écran s'agrandit, on est sur le bureau de Maruchime OS */}
      {inside === 'pc' && gamesApi && (
        <PcOS {...gamesApi} closeRef={zoomClose} holder={holder} fromRect={sceneRef.current?.screenRect?.('pc')} onClose={() => sceneRef.current?.unzoomTv()} />
      )}

      {/* la cuisine : une autre pièce, ouverte par-dessus le salon */}
      {room === 'cuisine' && !turning && kitchenRef.current && <Kitchen userId={userId} scene={kitchenRef.current} start={kitchenStart.current} onStarted={() => { kitchenStart.current = null }} onClose={() => goRoom('salon')} />}
      {(room === 'garage' || room === 'chambre') && !turning && roomScenes.current[room] && <RoomSoon id={room} scene={roomScenes.current[room]} onClose={() => goRoom('salon')} />}

      <div className="salon-top" ref={topRef}>
        <div className="logo">
          <div className="logo-name">Maruchime</div>
          <div className="logo-sub">Bibliothèque</div>
        </div>
        <p className="salon-hello"><span>{greeting(hour)}.</span></p>
        <p className="lbl salon-sub">{sub}</p>
        {mobile && onSignOut && <button type="button" className="lbl salon-out salon-out-top" onClick={onSignOut}>Déconnexion</button>}
      </div>

      {hover && hover.x != null && (
        <div className="salon-chip lbl" style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 16}px)` }}>{hover.label}</div>
      )}

      {/* le bas du salon : l'astuce du moment (la barre de la maison est juste dessous) */}
      <div className="salon-bottom" ref={bottomRef}>
        <p className="salon-hint">{seated
          ? (mobile ? 'Glisse pour tourner la tête' : 'Fais glisser pour tourner la tête · molette en arrière pour te lever')
          : (mobile ? 'Pince pour t’asseoir dans le canapé' : 'Fais glisser pour regarder autour · molette en avant pour t’asseoir dans le canapé')}</p>
        {onSignOut && !mobile && <button type="button" className="lbl salon-out" onClick={onSignOut}>Déconnexion</button>}
      </div>
    </div>
  )
}
