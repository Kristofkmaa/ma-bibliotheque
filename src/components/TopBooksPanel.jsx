import { useState } from 'react'
import { toDisplay, spineColors } from '../lib/bookUtils'
import { useLayer } from '../lib/nav'

/** La couverture (sinon la couleur de la tranche du livre). */
function Cover({ book, src }) {
  const [bad, setBad] = useState(false)
  const [bg] = spineColors(book)
  return <span className="topb-cover" style={{ background: bg }}>{src && !bad ? <img src={src} alt="" onError={() => setBad(true)} /> : null}</span>
}

/**
 * « Ranger mon top » : nos 5 livres préférés, du n°1 au n°5 ; on les monte, on les descend,
 * on les retire. On en ajoute depuis la fiche d'un livre (« Mettre dans mon top »).
 */
export default function TopBooksPanel({ list, max, onMove, onRemove, onOpen, onClose }) {
  useLayer(true, '/mur/top', onClose, { modal: true })
  return (
    <div className="topb-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="topb" role="dialog" aria-label="Mon top">
        <header className="topb-head">
          <span className="lbl">Mes incontournables</span>
          <h2>Mon top {max}</h2>
          <button type="button" className="lbl box topb-close" onClick={onClose}>Fermer</button>
        </header>
        {!list.length
          ? <p className="topb-empty">Ton top est vide. Ouvre la fiche d’un livre et touche « Mettre dans mon top » : il prendra place sur l’étagère d’honneur, en haut de ta bibliothèque.</p>
          : (
            <ol className="topb-list">
              {list.map((b, i) => {
                const d = toDisplay(b)
                const src = d.cover
                return (
                  <li key={b.id} className={'topb-row r' + (i + 1)}>
                    <span className="topb-rank">{i + 1}</span>
                    <button type="button" className="topb-book" onClick={() => onOpen(b)}>
                      <Cover book={b} src={src} />
                      <span className="topb-txt"><b>{d.title}</b><em>{d.authors.join(', ')}</em></span>
                    </button>
                    <span className="topb-act">
                      <button type="button" className="lbl box" onClick={() => onMove(b.id, -1)} disabled={i === 0} aria-label="Monter">↑</button>
                      <button type="button" className="lbl box" onClick={() => onMove(b.id, 1)} disabled={i === list.length - 1} aria-label="Descendre">↓</button>
                      <button type="button" className="lbl box" onClick={() => onRemove(b.id)} aria-label="Retirer du top">✕</button>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        {list.length > 0 && list.length < max && <p className="topb-hint">Encore {max - list.length} place{max - list.length > 1 ? 's' : ''} : ajoute un livre depuis sa fiche.</p>}
      </div>
    </div>
  )
}
