import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNav, goSection } from '../lib/nav'

/**
 * La barre de la maison : la même partout (salon, bibliothèque, films, jeux, cuisine), toujours
 * en bas. Sur téléphone, toute la largeur, comme une appli ; sur ordinateur, une pilule qui flotte.
 * Le module où l'on est s'allume ; un toucher emmène dans un autre (en refermant ce qui est
 * ouvert), ou ramène à l'accueil du module où l'on est déjà.
 * Elle s'efface quand un panneau couvre l'écran (une fiche, la recherche, le frigo…).
 */
const ITEMS = [
  { id: 'salon', label: 'Salon', icon: <path d="M3.5 11.2L12 4l8.5 7.2M6 9.8V20h12V9.8M10 20v-5.5h4V20" /> },
  { id: 'bibliotheque', label: 'Livres', icon: <path d="M4 4v16M20 4v16M4 9h16M4 14.5h16M4 20h16M7 9V6M9 9V5.5M12 14.5v-3.5M14.5 14.5v-3" /> },
  { id: 'films', label: 'Films', icon: <><rect x="3" y="5" width="18" height="12" rx="1.5" /><path d="M8.5 20h7M10.5 9l4 2-4 2z" /></> },
  { id: 'jeux', label: 'Jeux', icon: <><path d="M7.5 8.5h9a4 4 0 0 1 3.9 4.8l-.8 3.6a2.2 2.2 0 0 1-3.7 1.1L13.8 16h-3.6l-2.1 2a2.2 2.2 0 0 1-3.7-1.1l-.8-3.6A4 4 0 0 1 7.5 8.5zM8 11.2v3M6.5 12.7h3" /><circle cx="15.8" cy="12" r=".6" /><circle cx="17.3" cy="13.8" r=".6" /></> },
  { id: 'cuisine', label: 'Cuisine', icon: <path d="M7 3v7.5a2 2 0 0 0 2 2M11 3v7.5a2 2 0 0 1-2 2V21M9 3v6M16.5 21V3c-2 1.4-3 4-3 7.5h3" /> },
]
const DARK = new Set(['films', 'jeux'])

export default function HouseBar() {
  const { section, pending, modal } = useNav()
  const on = pending || section
  const shown = !modal
  // les modules laissent la place à la barre (--house-h) tant qu'elle est là
  useEffect(() => {
    document.body.classList.toggle('house-on', shown)
    return () => document.body.classList.remove('house-on')
  }, [shown])
  return createPortal(
    <nav className={'house-bar' + (shown ? '' : ' hidden') + (DARK.has(section) ? ' dark' : '')} aria-label="La maison" aria-hidden={!shown}>
      <span className="house-thumb" style={{ '--i': Math.max(0, ITEMS.findIndex(x => x.id === on)) }} data-none={ITEMS.some(x => x.id === on) ? undefined : ''} aria-hidden="true" />
      {ITEMS.map(it => (
        <button type="button" key={it.id} className={'house-item' + (it.id === on ? ' on' : '')} aria-current={it.id === on ? 'page' : undefined}
          tabIndex={shown ? 0 : -1} onClick={e => { e.currentTarget.blur(); goSection(it.id) }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{it.icon}</svg>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>,
    document.body,
  )
}
