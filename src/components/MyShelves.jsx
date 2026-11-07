import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MATERIALS, WALLS, DOOR_STYLES, resolveSkin, skinVars } from '../lib/skins'
import { LOOSE, createShelf, renameShelf, setShelfSkin, applySkinToAll, moveShelf, deleteShelf, deleteShelfMoving } from '../lib/shelfOps'
import { useLayer } from '../lib/nav'

const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`

/**
 * « Mes étagères » : le meuble vu à plat (une étagère par compartiment, sans les livres),
 * et à côté le réglage de l'étagère choisie : nom, matière, fond, portes, ordre, suppression.
 * Chaque changement s'applique en direct à la bibliothèque 3D derrière.
 */
export default function MyShelves({ eff, commit, onClose, initialId, onDeleteBooks }) {
  const real = eff.filter(s => !s.pseudo)
  const loose = eff.find(s => s.id === LOOSE)
  const [sel, setSel] = useState(() => (initialId && real.some(s => s.id === initialId) ? initialId : real[0]?.id || null))
  const shelf = real.find(s => s.id === sel) || null
  const [name, setName] = useState(shelf?.name || '')
  const [del, setDel] = useState(null)        // null | 'ask' (que faire des livres ?) | 'purge' (confirmer)
  const [dest, setDest] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [fresh, setFresh] = useState(null)
  const [leaving, setLeaving] = useState(null)
  const [closing, setClosing] = useState(false)
  const nameRef = useRef(null)
  const caseRef = useRef(null)
  const panelRef = useRef(null)
  const flip = useRef(null)

  // la sélection suit l'étagère (y compris quand l'étagère par défaut reçoit un vrai identifiant)
  useEffect(() => {
    if (!shelf && real.length) setSel(real[0].id)
  }, [shelf, real])
  useEffect(() => {
    setName(shelf?.name || ''); setDel(null); setErr('')
    // suppression demandée par un balayage sur une autre étagère : on la lance une fois sélectionnée
    if (pendingDel.current && pendingDel.current === sel) { pendingDel.current = null; askDelete(true) }
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

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
  useLayer(true, '/bibliotheque/etageres', () => closeRef.current(), { modal: true })

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

  // voisine (en dessous, sinon au-dessus) : destination proposée pour les livres
  const neighbour = () => {
    const i = real.findIndex(s => s.id === shelf?.id)
    return real[i + 1] || real[i - 1] || null
  }

  const askDelete = (scroll = false) => {
    if (!shelf || real.length < 2) return
    setErr('')
    setDest(neighbour()?.id || '')
    setDel('ask')
    if (scroll) setTimeout(() => panelRef.current?.querySelector('.ms-danger')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80)
  }

  // ---- Balayer une étagère vers la gauche (comme sur iPhone) : « Supprimer » apparaît ----------
  const REVEAL = 92
  const [swiped, setSwiped] = useState(null)
  const swipeMoved = useRef(false)
  const pendingDel = useRef(null)
  const rowEls = useRef({})
  const swipeDelete = id => {
    setSwiped(null)
    if (real.length < 2) return
    if (id === sel) askDelete(true)
    else { saveName(); pendingDel.current = id; setSel(id) }
  }
  const startSwipe = (e, id) => {
    if (e.button > 0) return
    const el = rowEls.current[id]
    if (!el) return
    const x0 = e.clientX, y0 = e.clientY
    const base = swiped === id ? -REVEAL : 0
    let dragging = false, dead = false
    const done = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    const move = ev => {
      if (dead) return
      const dx = ev.clientX - x0, dy = ev.clientY - y0
      if (!dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { dead = true; return }     // on fait défiler la liste
        if (Math.abs(dx) < 8) return
        dragging = true; swipeMoved.current = true
        el.style.transition = 'none'
        el.parentElement?.classList.add('dragging')
        if (swiped && swiped !== id) setSwiped(null)
      }
      ev.preventDefault()
      let x = base + dx
      if (x > 0) x *= 0.25
      if (x < -REVEAL) x = -REVEAL + (x + REVEAL) * 0.45
      el.style.transform = `translateX(${x}px)`
    }
    const up = ev => {
      done()
      if (!dragging) return
      el.parentElement?.classList.remove('dragging')
      el.style.transition = ''
      el.style.transform = ''
      const x = base + (ev.clientX - x0)
      if (x < -REVEAL * 1.8 && real.length >= 2) { swipeDelete(id); return }   // grand balayage : on demande tout de suite
      setSwiped(x < -REVEAL / 2 ? id : null)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // l'étagère se replie, puis on enregistre
  const leaveThen = fn => {
    const id = shelf.id
    setBusy(true)
    setLeaving(id)
    setTimeout(async () => {
      try {
        await fn(id)
        setDel(null)
      } catch (e) {
        setErr("Ça n'a pas marché : " + (e?.message || e))
      } finally {
        setLeaving(null)
        setBusy(false)
      }
    }, 320)
  }

  const deleteEmpty = () => leaveThen(id => {
    const next = neighbour()
    commit(deleteShelf(eff, id).list)
    setSel(next?.id || null)
  })

  const deleteAndMove = () => leaveThen(id => {
    const res = deleteShelfMoving(eff, id, dest || neighbour()?.id)
    commit(res.list)
    if (res.id) setSel(res.id)
  })

  const deleteWithBooks = () => leaveThen(async id => {
    const next = neighbour()
    const ids = [...shelf.book_ids]
    if (onDeleteBooks) await onDeleteBooks(ids)
    commit(deleteShelf(eff, id).list)
    setSel(next?.id || null)
  })

  const index = shelf ? real.findIndex(s => s.id === shelf.id) : -1

  return (
    <div className={'ms-backdrop' + (closing ? ' closing' : '')} onPointerDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className="ms-panel grain" ref={panelRef} role="dialog" aria-modal="true" aria-label="Mes étagères">
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
                  <div key={s.id} data-id={s.id} className={'ms-swipe' + (swiped === s.id ? ' open' : '') + (leaving === s.id ? ' leaving' : '')}>
                  <button
                    type="button" className="ms-swipe-act" tabIndex={swiped === s.id ? 0 : -1} disabled={real.length < 2}
                    onClick={() => swipeDelete(s.id)} aria-label={`Supprimer l’étagère ${s.name}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" /></svg>
                    <span>{real.length < 2 ? 'Dernière' : 'Supprimer'}</span>
                  </button>
                  <button
                    type="button" ref={el => { rowEls.current[s.id] = el }}
                    className={`ms-row d-${pal.doors}` + (on ? ' on' : '') + (fresh === s.id ? ' fresh' : '')}
                    style={skinVars(pal)}
                    onPointerDown={e => startSwipe(e, s.id)}
                    onClick={() => {
                      if (swipeMoved.current) { swipeMoved.current = false; return }
                      if (swiped) { setSwiped(null); return }
                      if (s.id !== sel) { saveName(); setSel(s.id) }
                    }}
                    aria-pressed={on}
                  >
                    <span className="ms-cell">
                      <span className="ms-count">{plural(s.book_ids.length, 'livre')}</span>
                      <span className="ms-door"><span className="ms-pull" /></span>
                    </span>
                    <span className="ms-plank"><span className="ms-label">{s.id === sel ? name || s.name : s.name}</span></span>
                  </button>
                  </div>
                )
              })}
              {loose && (
                <div className="ms-row ms-loose" data-id={LOOSE}>
                  <span className="ms-cell">
                    <span className="ms-loose-text">{plural(loose.book_ids.length, 'livre')} sans étagère</span>
                  </span>
                  <span className="ms-plank"><span className="ms-label">À ranger</span></span>
                </div>
              )}
              <span className="ms-foot" aria-hidden="true" />
            </div>
            <button type="button" className="ms-add" onClick={add}>
              <span className="ms-add-plus" aria-hidden="true">+</span> Nouvelle étagère
            </button>
            {real.length > 1 && <p className="ms-swipe-hint">Astuce : fais glisser une étagère vers la gauche pour la supprimer.</p>}
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
                <div className={'ms-danger' + (del ? ' open' : '')}>
                  {!del && (
                    <button
                      type="button" className="lbl box muted"
                      disabled={real.length < 2} onClick={askDelete}
                      title={real.length < 2 ? 'Il faut garder au moins une étagère' : undefined}
                    >
                      Supprimer cette étagère
                    </button>
                  )}
                  {real.length < 2 && <p className="se-note">Il faut garder au moins une étagère.</p>}

                  {del && !shelf.book_ids.length && (
                    <div className="ms-del">
                      <p className="ms-del-q">Supprimer « {shelf.name} » ? Elle est vide.</p>
                      <div className="ms-del-row">
                        <button type="button" className="lbl box danger" disabled={busy} onClick={deleteEmpty}>Oui, supprimer</button>
                        <button type="button" className="lbl box" disabled={busy} onClick={() => setDel(null)}>Annuler</button>
                      </div>
                    </div>
                  )}

                  {del === 'ask' && shelf.book_ids.length > 0 && (
                    <div className="ms-del">
                      <p className="ms-del-q">Que faire de ses {plural(shelf.book_ids.length, 'livre')} ?</p>
                      <label className="ms-del-dest">
                        <span className="lbl se-lbl">Les ranger sur</span>
                        <select value={dest} onChange={e => setDest(e.target.value)} disabled={busy}>
                          {real.filter(s => s.id !== shelf.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </label>
                      <div className="ms-del-row">
                        <button type="button" className="lbl box danger" disabled={busy} onClick={deleteAndMove}>Ranger et supprimer l'étagère</button>
                        <button type="button" className="lbl box" disabled={busy} onClick={() => setDel(null)}>Annuler</button>
                      </div>
                      {onDeleteBooks && (
                        <button type="button" className="ms-del-purge" disabled={busy} onClick={() => setDel('purge')}>
                          … ou supprimer aussi ses livres de ma bibliothèque
                        </button>
                      )}
                    </div>
                  )}

                  {del === 'purge' && shelf.book_ids.length > 0 && (
                    <div className="ms-del">
                      <p className="ms-del-q">Supprimer l'étagère <em>et</em> ses {plural(shelf.book_ids.length, 'livre')} ? On ne pourra pas revenir en arrière.</p>
                      <div className="ms-del-row">
                        <button type="button" className="lbl box danger" disabled={busy} onClick={deleteWithBooks}>Oui, tout supprimer</button>
                        <button type="button" className="lbl box" disabled={busy} onClick={() => setDel('ask')}>Retour</button>
                      </div>
                    </div>
                  )}
                  {err && <p className="se-note ms-err">{err}</p>}
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
