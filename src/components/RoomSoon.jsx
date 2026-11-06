import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'

/**
 * Une pièce qu'on peut déjà visiter (le garage, la chambre), mais dont les outils viendront plus
 * tard (voir A_FAIRE_PLUS_TARD.md) : la maquette, son titre, et ce qui y arrivera bientôt.
 */
const ROOMS = {
  garage: {
    title: 'Le garage', kicker: 'Bientôt dans le garage',
    soon: ['Les rappels du contrôle technique', 'L’entretien : vidange, pneus, révision', 'L’assurance et les papiers de la voiture'],
    hint: { mobile: 'Glisse pour tourner le garage', desk: 'Fais glisser pour tourner le garage' },
  },
  chambre: {
    title: 'La chambre', kicker: 'Bientôt dans le dressing',
    soon: ['Tous nos vêtements, rangés par catégorie', 'Les tenues qu’on aime, prêtes à porter', 'Les saisons, le linge à laver, à donner'],
    hint: { mobile: 'Glisse pour tourner la chambre', desk: 'Fais glisser pour tourner la chambre' },
  },
}
const Back = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>

export default function RoomSoon({ id, scene, onClose }) {
  const R = ROOMS[id]
  const mobile = useIsMobile()
  const rootRef = useRef(null)
  const [chip, setChip] = useState(null)
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    scene.cb = { onHover: (label, x, y) => setChip(label ? { label, x, y } : null), onTap: () => setPulse(n => n + 1) }
    rootRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' })
    return () => { scene.cb = {} }
  }, [scene])
  const leave = () => {
    const el = rootRef.current
    if (!el?.animate) { onClose(); return }
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished.then(onClose, onClose)
  }
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') leave() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!R) return null
  return (
    <div className="kitchen room-soon" ref={rootRef}>
      <header className="kt-top">
        <button type="button" className="kt-back" onClick={leave}><Back /><span>Le salon</span></button>
        <div className="kt-title"><b>{R.title}</b><span>Maruchime</span></div>
        <span className="kt-top-r" />
      </header>
      {chip && !mobile && <div className="salon-chip lbl" style={{ transform: `translate(${chip.x + 14}px, ${chip.y + 16}px)` }}>{chip.label}</div>}
      <section className="rs-card" key={pulse} aria-label={R.kicker}>
        <p className="kt-kicker">{R.kicker}</p>
        <ul>{R.soon.map(t => <li key={t}>{t}</li>)}</ul>
      </section>
      <p className="kt-hint rs-hint">{mobile ? R.hint.mobile : R.hint.desk}</p>
    </div>
  )
}
