import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MATERIALS, WALLS, DOOR_STYLES } from '../lib/skins'
import { LOOSE } from '../lib/shelfOps'

/**
 * Carte d'édition d'une étagère, ouverte depuis son étiquette :
 * nom, matière, couleur du fond, style des portes, ordre, suppression.
 * Les changements d'apparence s'appliquent en direct (les couleurs se fondent).
 */
export default function ShelfEditor({ shelf, anchor, selectName, canUp, canDown, onClose, onRename, onSkin, onApplyAll, onMove, onDelete, onAdopt }) {
  const ref = useRef(null)
  const input = useRef(null)
  const [name, setName] = useState(shelf.name)
  const [confirm, setConfirm] = useState(false)
  const [pos, setPos] = useState(null)
  const loose = shelf.id === LOOSE

  // Placement : au-dessus de l'étiquette si possible, sinon en dessous ; feuille en bas sur téléphone
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.innerWidth <= 767) { setPos({ sheet: true }); return }
    const w = el.offsetWidth, h = el.offsetHeight
    const left = Math.max(12, Math.min(anchor.left - 8, window.innerWidth - w - 12))
    let top = anchor.top - h - 12
    if (top < 12) top = Math.min(anchor.bottom + 12, window.innerHeight - h - 12)
    setPos({ left, top })
  }, [anchor])

  // Le champ ne peut prendre le focus qu'une fois la carte placée (visible)
  useEffect(() => {
    if (pos && selectName && input.current) { input.current.focus(); input.current.select() }
  }, [pos, selectName])

  const save = () => { if (!loose && name.trim() && name.trim() !== shelf.name) onRename(name.trim()) }
  const close = () => { save(); onClose() }
  const closeRef = useRef(close)
  closeRef.current = close

  // Fermer en cliquant ailleurs ou avec Échap
  useEffect(() => {
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) closeRef.current() }
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current() } }
    const t = setTimeout(() => window.addEventListener('pointerdown', onDown), 0)
    window.addEventListener('keydown', onKey, true)
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey, true) }
  }, [])

  const style = !pos ? { visibility: 'hidden', left: 0, top: 0 } : pos.sheet ? {} : { left: pos.left, top: pos.top }

  return (
    <div className={'shelf-editor grain' + (pos?.sheet ? ' sheet' : '')} ref={ref} style={style} role="dialog" aria-label="Modifier l'étagère">
      {loose ? (
        <>
          <div className="se-title">À ranger</div>
          <p className="se-note">Ces livres ne sont sur aucune étagère. Glisse-les où tu veux, ou fais-en une étagère.</p>
          <div className="se-actions">
            <button type="button" className="lbl box cobalt" onClick={() => { onAdopt(); onClose() }}>Créer une étagère avec ces livres</button>
          </div>
        </>
      ) : (
        <>
          <label className="se-field">
            <span className="lbl se-lbl">Nom de l'étagère</span>
            <input
              ref={input} className="se-name" value={name} maxLength={40} spellCheck="false"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); close() } }}
            />
          </label>

          <div className="se-field">
            <span className="lbl se-lbl">Matière</span>
            <div className="se-swatches">
              {MATERIALS.map(m => (
                <button
                  key={m.id} type="button" title={m.label} aria-label={m.label}
                  className={'se-wood' + (shelf.material === m.id ? ' on' : '')}
                  style={{ background: `linear-gradient(180deg, ${m.hi}, ${m.mid} 55%, ${m.lo})` }}
                  onClick={() => onSkin({ material: m.id })}
                ><span>{m.label}</span></button>
              ))}
            </div>
          </div>

          <div className="se-field">
            <span className="lbl se-lbl">Fond</span>
            <div className="se-dots">
              {WALLS.map(w => (
                <button
                  key={w.id} type="button" title={w.label} aria-label={w.label}
                  className={'se-dot' + (shelf.wall === w.id ? ' on' : '')} style={{ background: w.color }}
                  onClick={() => onSkin({ wall: w.id })}
                />
              ))}
            </div>
          </div>

          <div className="se-field">
            <span className="lbl se-lbl">Portes</span>
            <div className="toggle-row">
              {DOOR_STYLES.map(d => (
                <button key={d.id} type="button" className={'lbl toggle' + (shelf.doors === d.id ? ' on' : '')} onClick={() => onSkin({ doors: d.id })}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="se-actions">
            <button type="button" className="lbl box" onClick={onApplyAll}>Ce style partout</button>
            <button type="button" className="lbl box" disabled={!canUp} onClick={() => onMove(-1)} aria-label="Monter l'étagère">↑</button>
            <button type="button" className="lbl box" disabled={!canDown} onClick={() => onMove(1)} aria-label="Descendre l'étagère">↓</button>
            <button
              type="button" className={'lbl box ' + (confirm ? 'danger' : 'muted')}
              onClick={() => { if (!confirm) { setConfirm(true); return } onDelete(); onClose() }}
            >
              {confirm ? 'Confirmer' : 'Supprimer'}
            </button>
            <button type="button" className="lbl box cobalt se-ok" onClick={close}>OK</button>
          </div>
          {confirm && <p className="se-note">Les livres de cette étagère iront dans « À ranger ».</p>}
        </>
      )}
    </div>
  )
}
