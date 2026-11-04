import { useEffect, useMemo, useRef, useState } from 'react'
import { LivingRoomScene, dayMode } from '../three/LivingRoomScene'
import { useIsMobile } from '../hooks/useIsMobile'

const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`

function greeting(hour) {
  if (hour >= 5 && hour < 18) return 'Bonjour'
  return 'Bonsoir'
}

/**
 * L'accueil : le salon. La bibliothèque du salon mène au mur de livres ;
 * la télé montre les lectures en cours, le panier sur la table basse ouvre la recherche.
 */
export default function LivingRoom({ books, shelves, basketItems, from, onEntered, onOpenBook, onAddBooks, getLibrary }) {
  const rootRef = useRef(null)
  const hostRef = useRef(null)
  const topRef = useRef(null)
  const bottomRef = useRef(null)
  const sceneRef = useRef(null)
  const [hover, setHover] = useState(null)
  const [going, setGoing] = useState(from === 'back')
  const mobile = useIsMobile()
  const cb = useRef({})
  const hour = useMemo(() => {
    const q = new URLSearchParams(location.search).get('heure')
    const d = new Date()
    return q != null && !isNaN(+q) ? +q : d.getHours() + d.getMinutes() / 60
  }, [])
  const mode = dayMode(hour)

  // entrer : la caméra rejoint la vue exacte de la bibliothèque, le salon s'efface autour
  const go = () => {
    const s = sceneRef.current
    if (!s || cb.current.going) return
    cb.current.going = true
    setGoing(true)
    setHover(null)
    s.enter(() => {
      const el = rootRef.current
      const done = () => cb.current.onEntered?.()
      if (!el?.animate) { done(); return }
      // les deux vues sont identiques : on retire simplement le salon (les menus apparaissent)
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished.then(done, done)
    })
  }
  cb.current.go = go
  cb.current.onEntered = onEntered
  cb.current.onOpenBook = onOpenBook
  cb.current.onAddBooks = onAddBooks
  cb.current.getLibrary = getLibrary

  useEffect(() => {
    const host = hostRef.current
    const s = new LivingRoomScene(host, {
      onHover: setHover,
      onEnter: () => cb.current.go(),
      onTv: b => cb.current.onOpenBook?.(b),
      onBasket: () => cb.current.onAddBooks?.(),
      getLibrary: () => cb.current.getLibrary?.(),
      margins: () => {
        const h = host.clientHeight || 1
        return {
          top: ((topRef.current?.offsetHeight || 90) + 6) / h,
          bottom: ((bottomRef.current?.offsetHeight || 110) + 6) / h,
          side: 0.035,
        }
      },
    })
    sceneRef.current = s
    if (import.meta.env.DEV || location.search.includes('debug')) window.__salon = s
    let t
    if (from === 'back') {
      s.arriveFromLibrary()
      rootRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' })
      t = setTimeout(() => setGoing(false), 1100)
    }
    return () => { clearTimeout(t); s.dispose(); sceneRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // les livres, dans l'ordre des étagères ; l'habillage de la première étagère
  const byId = useMemo(() => new Map(books.map(b => [b.id, b])), [books])
  const ordered = useMemo(() => shelves.flatMap(s => s.book_ids).map(id => byId.get(id)).filter(Boolean), [shelves, byId])
  const firstSkin = shelves.find(s => !s.pseudo) || null
  const reading = useMemo(() => books.filter(b => (b.statuses || []).includes('en_cours')), [books])
  const recent = useMemo(() => [...books].sort((a, b) => (b.added_at || '').localeCompare(a.added_at || '')).slice(0, 3), [books])

  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.setShelfSkin(firstSkin && { material: firstSkin.material, wall: firstSkin.wall })
    s.setBooks(ordered)
  }, [ordered, firstSkin?.material, firstSkin?.wall]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    sceneRef.current?.setTvBooks(reading.length ? reading.slice(0, 6) : recent, reading.length ? 'en_cours' : 'recent')
  }, [reading, recent])
  useEffect(() => { sceneRef.current?.setBasket(basketItems || []) }, [basketItems])

  // la place des marges change avec la taille de l'écran
  useEffect(() => { sceneRef.current?.resize() }, [mobile])

  const sub = books.length
    ? `${plural(books.length, 'livre')} sur les étagères${reading.length ? ` · ${reading.length} en cours` : ''}`
    : 'Ta bibliothèque t’attend'

  return (
    <div className={`salon mood-${mode}` + (going ? ' going' : '')} ref={rootRef}>
      <div className="salon-stage" ref={hostRef} />

      <div className="salon-top" ref={topRef}>
        <div className="logo">
          <div className="logo-name">Levana</div>
          <div className="logo-sub">Bibliothèque</div>
        </div>
        <p className="salon-hello"><span>{greeting(hour)}.</span></p>
        <p className="lbl salon-sub">{sub}</p>
      </div>

      {hover && hover.x != null && (
        <div className="salon-chip lbl" style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 16}px)` }}>{hover.label}</div>
      )}

      <div className="salon-bottom" ref={bottomRef}>
        <button type="button" className="lbl box cobalt salon-go" onClick={go} disabled={going}>
          Entrer dans ma bibliothèque <span aria-hidden="true">→</span>
        </button>
        <p className="salon-hint">
          {mobile ? 'Glisse le doigt pour regarder autour, touche les objets' : 'Fais glisser pour regarder autour, clique sur les objets'}
        </p>
      </div>
    </div>
  )
}
