import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MATERIALS, WALLS, DOOR_STYLES, resolveSkin, skinVars } from '../lib/skins'
import { LOOSE, createShelf, renameShelf, setShelfSkin, applySkinToAll, moveShelf, deleteShelf, adoptLoose } from '../lib/shelfOps'

const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`

/**
 * « Mes étagères » : le meuble vu à plat (une étagère par compartiment, sans les livres),
 * et à côté le réglage de l'étagère choisie : nom, matière, fond, portes, ordre, suppression.
 * Chaque changement s'applique en direct à la bibliothèque 3D derrière.
 */
export default function MyShelves({ eff, commit, onClose, initialId }) {
  const real = eff.filter(s => !s.pseudo)
  const loose = eff.find(s => s.id === LOOSE)
  const [sel, setSel] = useState(() => (initialId && real.some(s => s.id === initialId) ? initialId : real[0]?.id || null))
  const shelf = real.find(s => s.id === sel) || null
  const [name, setName] = useState(shelf?.name || '')
  const [confirm, setConfirm] = useState(false)
  const [fresh, setFresh] = useState(null)
  const [leaving, setLeaving] = useState(null)
  const [closing, setClosing] = useState(false)
  const nameRef = useRef(null)
  const caseRef = useRef(null)
  const flip = useRef(null)

  // la sélection suit l'étagère (y compris quand l'étagère par défaut reçoit un vrai identifiant)
  useEffect(() => {
    if (!shelf && real.length) setSel(real[0].id)
  }, [shelf, real])
  useEffect(() => { setName(shelf?.name || ''); setConfirm(false) }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  // FLIP : les étagères glissent vers leur nouvelle place quand on change l'ordre
  const remember = () => {
    const m = new Map()
    caseRef.current?.querySelectorAll('[data-id]').forEach(el => m.set(el.dataset.id, el.getBoundingClientRect().top))
    flip.current = m
  }
  useLayoutEffect(() => {
    const prev = flip.current
    if (!prev) return
    flip.current = null
    caseRef.current?.querySelectorAll('[data-id]').forEach(el => {
      const before = prev.get(el.dataset.id)
      if (before == null) return
      const dy = before - el.getBoundingClientRect().top
      if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.3, 1.25, .45, 1)' })
    })
  })

  const run = (res, { anim = false } = {}) => {
    if (anim) remember()
    commit(res.list)
    if (res.id) setSel(res.id)
  }

  const saveName = () => {
    if (!shelf) return
    const v = name.trim()
    if (v && v !== shelf.name) run(renameShelf(eff, shelf.id, v))
    else if (!v) setName(shelf.name)
  }

  const close = () => {
    saveName()
    setClosing(true)
    setTimeout(onClose, 300)
  }
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const add = () => {
    const res = createShelf(eff, 'Nouvelle étagère')
    run(res)
    setFresh(res.id)
    setTimeout(() => setFresh(f => (f === res.id ? null : f)), 1200)
    setTimeout(() => {
      caseRef.current?.querySelector(`[data-id="${res.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      nameRef.current?.focus(); nameRef.current?.select()
    }, 420)
  }

  const remove = () => {
    if (!shelf || real.length < 2) return
    if (!confirm) { setConfirm(true); return }
    const i = real.findIndex(s => s.id === shelf.id)
    const next = real[i + 1] || real[i - 1]
    setLeaving(shelf.id)
    setTimeout(() => {
      commit(deleteShelf(eff, shelf.id).list)
      setLeaving(null)
      setSel(next?.id || null)
    }, 320)
  }

  const index = shelf ? real.findIndex(s => s.id === shelf.id) : -1

  return (
    <div className={'ms-backdrop' + (closing ? ' closing' : '')} onPointerDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className="ms-panel grain" role="dialog" aria-modal="true" aria-label="Mes étagères">
        <div className="ms-head">
          <div className="ms-title">Mes étagères <span className="lbl">{plural(real.length, 'étagère')}</span></div>
          <button type="button" className="lbl box" onClick={close}>Fermer</button>
        </div>

        <div className="ms-body">
          {/* le meuble, à plat */}
          <div className="ms-case-col">
            <div className="ms-case" ref={caseRef}>
              <span className="ms-crown" style={real[0] ? skinVars(resolveSkin(real[0])) : undefined} aria-hidden="true" />
              {real.map(s => {
                const pal = resolveSkin(s)
                const on = s.id === sel
                return (
                  <button
                    key={s.id} type="button" data-id={s.id}
                    className={`ms-row d-${pal.doors}` + (on ? ' on' : '') + (fresh === s.id ? ' fresh' : '') + (leaving === s.id ? ' leaving' : '')}
                    style={skinVars(pal)}
                    onClick={() => { if (s.id !== sel) { saveName(); setSel(s.id) } }}
                    aria-pressed={on}
                  >
                    <span className="ms-cell">
                      <span className="ms-count">{plural(s.book_ids.length, 'livre')}</span>
                      <span className="ms-door"><span className="ms-pull" /></span>
                    </span>
                    <span className="ms-plank"><span className="ms-label">{s.id === sel ? name || s.name : s.name}</span></span>
                  </button>
                )
              })}
              {loose && (
                <div className="ms-row ms-loose" data-id={LOOSE}>
                  <span className="ms-cell">
                    <span className="ms-loose-text">{plural(loose.book_ids.length, 'livre')} sans étagère</span>
                    <button type="button" className="lbl box" onClick={() => run(adoptLoose(eff))}>En faire une étagère</button>
                  </span>
                  <span className="ms-plank"><span className="ms-label">À ranger</span></span>
                </div>
              )}
              <span className="ms-foot" aria-hidden="true" />
            </div>
            <button type="button" className="ms-add" onClick={add}>
              <span className="ms-add-plus" aria-hidden="true">+</span> Nouvelle étagère
            </button>
          </div>

          {/* réglages de l'étagère choisie */}
          <div className="ms-edit" key={sel}>
            {shelf ? (
              <>
                <label className="se-field">
                  <span className="lbl se-lbl">Nom</span>
                  <input
                    ref={nameRef} className="se-name" value={name} maxLength={40} spellCheck="false"
                    onChange={e => setName(e.target.value)} onBlur={saveName}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveName(); e.currentTarget.blur() } }}
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
                        onClick={() => run(setShelfSkin(eff, shelf.id, { material: m.id }))}
                      ><span>{m.label}</span></button>
                    ))}
                  </div>
                </div>

                <div className="se-field">
                  <span className="lbl se-lbl">Couleur du fond</span>
                  <div className="se-dots">
                    {WALLS.map(w => (
                      <button
                        key={w.id} type="button" title={w.label} aria-label={w.label}
                        className={'se-dot' + (shelf.wall === w.id ? ' on' : '')} style={{ background: w.color }}
                        onClick={() => run(setShelfSkin(eff, shelf.id, { wall: w.id }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="se-field">
                  <span className="lbl se-lbl">Portes</span>
                  <div className="toggle-row">
                    {DOOR_STYLES.map(d => (
                      <button key={d.id} type="button" className={'lbl toggle' + (shelf.doors === d.id ? ' on' : '')}
                        onClick={() => run(setShelfSkin(eff, shelf.id, { doors: d.id }))}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ms-actions">
                  <button type="button" className="lbl box" disabled={index <= 0} onClick={() => run(moveShelf(eff, shelf.id, -1), { anim: true })}>↑ Monter</button>
                  <button type="button" className="lbl box" disabled={index < 0 || index >= real.length - 1} onClick={() => run(moveShelf(eff, shelf.id, 1), { anim: true })}>↓ Descendre</button>
                  <button type="button" className="lbl box" onClick={() => run(applySkinToAll(eff, shelf.id))}>Ce style partout</button>
                </div>
                <div className="ms-danger">
                  <button
                    type="button" className={'lbl box ' + (confirm ? 'danger' : 'muted')}
                    disabled={real.length < 2} onClick={remove}
                    title={real.length < 2 ? 'Il faut garder au moins une étagère' : undefined}
                  >
                    {confirm ? 'Oui, supprimer' : 'Supprimer cette étagère'}
                  </button>
                  {confirm && <p className="se-note">Ses {plural(shelf.book_ids.length, 'livre')} iront dans « À ranger ».</p>}
                  {real.length < 2 && <p className="se-note">Il faut garder au moins une étagère.</p>}
                </div>
              </>
            ) : (
              <p className="se-note">Choisis une étagère dans le meuble.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
