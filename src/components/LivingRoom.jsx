import { useEffect, useMemo, useRef, useState } from 'react'
import { LivingRoomScene, dayMode } from '../three/LivingRoomScene'
import { useIsMobile } from '../hooks/useIsMobile'
import SeriesTV from './SeriesTV'
import Vitrine from './Vitrine'
import PcOS from './PcOS'
import { applyTheme } from '../lib/theme'

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
export default function LivingRoom({ books, shelves, basketItems, series, onAddSeries, onUpdateSeries, onRemoveSeries, onRenameCategory, gamesApi, holder, tv: tvBus, from, onEntered, onOpenBook, onAddBooks, getLibrary, onSignOut }) {
  const rootRef = useRef(null)
  const hostRef = useRef(null)
  const topRef = useRef(null)
  const bottomRef = useRef(null)
  const sceneRef = useRef(null)
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
      onTvZoom: on => { setTv(on); if (on) { store.set(BUBBLE_KEY, 'off'); setBubbleOff(true) } },
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
    let t
    if (from === 'back') {
      s.arriveFromLibrary()
      rootRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-in-out' })
      t = setTimeout(() => setGoing(false), 1100)
    }
    return () => { clearTimeout(t); s.dispose(); sceneRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sceneRef.current?.setTvBubble(!bubbleOff) }, [bubbleOff])
  // l'écran du PC, dans la pièce, montre notre fond d'écran
  useEffect(() => { sceneRef.current?.setPcWallpaper?.(gamesApi?.wallpaper?.url || null) }, [gamesApi?.wallpaper?.url])
  useEffect(() => { sceneRef.current?.setPcColors?.({ pc: gamesApi?.setup?.pc, kb: gamesApi?.setup?.kb }) }, [gamesApi?.setup?.pc, gamesApi?.setup?.kb])

  // nos séries sur l'écran : les mieux notées d'abord
  const tvSeries = useMemo(() => [...(series || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.added_at || '').localeCompare(a.added_at || '')), [series])
  useEffect(() => { sceneRef.current?.setSeries(tvSeries) }, [tvSeries])
  // ce qui passe à la télé : l'image projetée suit, et le lecteur n'a le son que si on voit le mur
  useEffect(() => { sceneRef.current?.setVideoOn(onAir) }, [onAir])
  useEffect(() => { if (nowId) sceneRef.current?.showWork(nowId) }, [nowId])
  // le son de la télé : on le baisse dès qu'on part (vers la bibliothèque, le PC, les films…) et on
  // le remonte dès qu'on revient (pendant l'animation du retour)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => { setWall(!tv && !leaving) }, [tv, leaving]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { setWall(false); tvVideo.current?.setAttribute('data-off', '') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Échap pendant le zoom : on ressort (une fois dans la télé, c'est le module qui s'en charge)
  useEffect(() => {
    if (!tv || inside === 'tv' || inside === 'pc' || openWork) return
    const onKey = e => { if (e.key === 'Escape') sceneRef.current?.unzoomTv() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tv, inside, openWork])
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
    <div className={`salon mood-${mode}` + (going || tv ? ' going' : '') + (tv ? ' tv-mode' : '') + (cinema ? ' cinema' : '')} ref={rootRef}>
      <div className="salon-stage" ref={hostRef} />
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
        <SeriesTV series={series || []} fromRect={sceneRef.current?.screenRect?.()} onAdd={onAddSeries} onUpdate={onUpdateSeries} onRemove={onRemoveSeries} onRenameCategory={onRenameCategory}
          onClose={() => sceneRef.current?.unzoomTv()} />
      )}

      {/* devant le meuble télé : la vitrine de nos films et séries */}
      {inside === 'cab' && !openWork && (
        <Vitrine series={series || []} onOpen={w => setOpenWork(w.id)} onList={() => setOpenWork('list')} onClose={() => sceneRef.current?.unzoomTv()} />
      )}
      {inside === 'cab' && openWork && (
        <SeriesTV series={series || []} initialId={openWork === 'list' ? null : openWork} onAdd={onAddSeries} onUpdate={onUpdateSeries} onRemove={onRemoveSeries} onRenameCategory={onRenameCategory}
          onClose={() => setOpenWork(null)} />
      )}

      {/* devant le PC du bureau gamer : son écran s'agrandit, on est sur le bureau de Maruchime OS */}
      {inside === 'pc' && gamesApi && (
        <PcOS {...gamesApi} holder={holder} fromRect={sceneRef.current?.screenRect?.('pc')} onClose={() => sceneRef.current?.unzoomTv()} />
      )}

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

      {mobile ? (
        /* téléphone : le menu du bas propose les deux « pièces » du salon */
        <nav className={'tabbar salon-tabs' + (going || tv ? ' away' : '')} ref={bottomRef} aria-label="Où aller">
          <p className="salon-tabs-hint">{seated ? 'Glisse pour tourner la tête' : 'Pince pour t’asseoir dans le canapé'}</p>
          <button type="button" className="tab" onClick={go} disabled={going}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v16M20 4v16M4 9h16M4 14.5h16M4 20h16M7 9V6M9 9V5.5M12 14.5v-3.5M14.5 14.5v-3" /></svg>
            <span>Ma bibliothèque</span>
          </button>
          <button type="button" className="tab" onClick={() => sceneRef.current?.tap('tv')} disabled={going}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="1.5" /><path d="M8.5 20h7M10.5 9l4 2-4 2z" /></svg>
            <span>Films & séries</span>
          </button>
          <button type="button" className="tab" onClick={() => sceneRef.current?.tap('pc')} disabled={going}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 8.5h9a4 4 0 0 1 3.9 4.8l-.8 3.6a2.2 2.2 0 0 1-3.7 1.1L13.8 16h-3.6l-2.1 2a2.2 2.2 0 0 1-3.7-1.1l-.8-3.6A4 4 0 0 1 7.5 8.5zM8 11.2v3M6.5 12.7h3" /><circle cx="15.8" cy="12" r=".6" /><circle cx="17.3" cy="13.8" r=".6" /></svg>
            <span>Jeux</span>
          </button>
        </nav>
      ) : (
        <div className="salon-bottom" ref={bottomRef}>
          <div className="salon-go-row">
            <button type="button" className="lbl box cobalt salon-go" onClick={go} disabled={going}>
              Entrer dans ma bibliothèque <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="lbl box salon-go" onClick={() => sceneRef.current?.zoomTv()} disabled={going}>
              Films & séries <span aria-hidden="true">▶</span>
            </button>
            <button type="button" className="lbl box salon-go" onClick={() => sceneRef.current?.tap('pc')} disabled={going}>
              Le PC · Jeux <span aria-hidden="true">◆</span>
            </button>
          </div>
          <p className="salon-hint">{seated ? 'Fais glisser pour tourner la tête · molette en arrière pour te lever' : 'Fais glisser pour regarder autour · molette en avant pour t’asseoir dans le canapé'}</p>
          {onSignOut && <button type="button" className="lbl salon-out" onClick={onSignOut}>Déconnexion</button>}
        </div>
      )}
    </div>
  )
}
