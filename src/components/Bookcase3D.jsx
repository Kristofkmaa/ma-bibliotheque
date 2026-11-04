import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toRoman, titleKey, authorKey, toDisplay } from '../lib/bookUtils'
import { cursor } from '../lib/cursorState'
import { resolveSkin, DEFAULT_SKIN } from '../lib/skins'
import {
  PH, NEWSHELF, effectiveShelves, previewDrag, moveBook, createShelf,
  renameShelf, setShelfSkin, applySkinToAll, moveShelf, deleteShelf, adoptLoose,
} from '../lib/shelfOps'
import { BookcaseScene, worldLayout } from '../three/BookcaseScene'
import Caption from './Caption'
import ShelfEditor from './ShelfEditor'

const CLOSE_MS = 700
const PH_BOOK = { id: PH, placeholder: true }

/** Découpe en rayons : les étagères (rangement manuel) ou la liste triée (autres tris). */
function buildRows({ manual, shelves, autoBooks, byId, visible, canEdit, perRow, rowsPerPage }) {
  const rows = []
  if (manual) {
    for (const s of shelves) {
      const list = []
      for (const id of s.book_ids) {
        if (id === PH) list.push(PH_BOOK)
        else { const b = byId.get(id); if (b && visible.has(id)) list.push(b) }
      }
      if (!list.length && !canEdit) continue
      const n = Math.max(1, Math.ceil(list.length / perRow))
      for (let j = 0; j < n; j++) rows.push({ key: `${s.id}:${j}`, shelf: s, start: j * perRow, books: list.slice(j * perRow, (j + 1) * perRow), cont: j > 0 })
    }
  } else {
    const n = Math.ceil(autoBooks.length / perRow)
    for (let j = 0; j < n; j++) rows.push({ key: `a${j}`, auto: j, books: autoBooks.slice(j * perRow, (j + 1) * perRow) })
  }
  const pad = rows.length ? (rowsPerPage - (rows.length % rowsPerPage)) % rowsPerPage : rowsPerPage
  for (let i = 0; i < pad; i++) rows.push({ key: `free${i}`, free: true, books: [] })
  return rows
}

function autoLabel(row, n, sort) {
  const name = `Rayon ${toRoman(n + 1)}`
  if (!row.length) return name
  if (sort === 'title' || sort === 'author') {
    const key = sort === 'title' ? titleKey : authorKey
    const a = (key(row[0])[0] || '?').toUpperCase()
    const b = (key(row[row.length - 1])[0] || '?').toUpperCase()
    return `${name} · ${a === b ? a : `${a} – ${b}`}`
  }
  if (sort === 'year') {
    const ys = row.map(b => parseInt(b.published_date)).filter(Boolean)
    if (ys.length) {
      const a = Math.min(...ys), b = Math.max(...ys)
      return `${name} · ${a === b ? a : `${a} – ${b}`}`
    }
  }
  return `${name} · ${row.length} vol.`
}

/**
 * Bibliothèque en vraie 3D, vue de trois quarts (Three.js).
 * Toute la logique (étagères, pages, portes, éditeur, glisser-déposer) est ici ;
 * le dessin et les ressorts sont dans BookcaseScene.
 */
export default function Bookcase3D({
  books, allBooks, sort, viewKey, manual, canEdit, shelves, commitShelves, newShelfSignal,
  onOpen, onAdd, locked, focusId, onFocused, emptyText, apiRef, aside,
}) {
  const caseRef = useRef(null)
  const sceneRef = useRef(null)
  const [size, setSize] = useState({ w: 1200, h: 520, mobile: false })
  const [page, setPage] = useState(0)
  const [dir, setDir] = useState(1)
  const [hovered, setHovered] = useState(null)
  const [dragView, setDragView] = useState(null)
  const [bornId, setBornId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [overlay, setOverlay] = useState([])
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  useLayoutEffect(() => {
    const el = caseRef.current
    const measure = () => setSize(prev => {
      const next = { w: el.clientWidth, h: el.clientHeight, mobile: window.innerWidth <= 767 }
      return prev.w === next.w && prev.h === next.h && prev.mobile === next.mobile ? prev : next
    })
    measure()
    // on attend que la taille se stabilise (panier qui s'anime à côté) avant de réorganiser les rayons
    let t = null
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(measure, 220) })
    ro.observe(el)
    return () => { clearTimeout(t); ro.disconnect() }
  }, [])

  const L = useMemo(() => worldLayout(size.w, size.h, size.mobile), [size])

  // ---- Données --------------------------------------------------------------------------
  const byId = useMemo(() => new Map(allBooks.map(b => [b.id, b])), [allBooks])
  const visible = useMemo(() => new Set(books.map(b => b.id)), [books])
  const eff = useMemo(() => (manual ? effectiveShelves(shelves, allBooks) : []), [manual, shelves, allBooks])
  const display = useMemo(
    () => (manual && dragView ? previewDrag(eff, dragView.id, dragView.target) : eff),
    [manual, eff, dragView],
  )
  const rowsAll = useMemo(
    () => buildRows({ manual, shelves: display, autoBooks: books, byId, visible, canEdit, perRow: L.perRow, rowsPerPage: L.rows }),
    [manual, display, books, byId, visible, canEdit, L.perRow, L.rows],
  )
  const pages = Math.max(1, rowsAll.length / L.rows)
  const current = Math.min(page, pages - 1)
  const liveRows = useMemo(() => rowsAll.slice(current * L.rows, (current + 1) * L.rows), [rowsAll, current, L.rows])

  const go = useCallback(delta => {
    setPage(p => {
      const next = Math.max(0, Math.min(pages - 1, Math.min(p, pages - 1) + delta))
      if (next !== p) setDir(delta > 0 ? 1 : -1)
      return next
    })
  }, [pages])
  const goRef = useRef(go)
  goRef.current = go

  const listKey = `${viewKey}|${sort}`
  const lastKey = useRef(listKey)
  useEffect(() => {
    if (lastKey.current !== listKey) { lastKey.current = listKey; setPage(0) }
  }, [listKey])

  useEffect(() => {
    if (!focusId) return
    const idx = rowsAll.findIndex(r => r.books.some(b => b.id === focusId))
    if (idx < 0) return
    const target = Math.floor(idx / L.rows)
    setDir(target >= current ? 1 : -1)
    setPage(target)
    onFocused?.()
  }, [focusId, rowsAll, L.rows, current, onFocused])

  // ---- Portes : on ne change de page que portes fermées ----------------------------------
  // Les portes ne se ferment que pour changer de page, de tri ou de vue. Un livre ajouté ou retiré,
  // un changement de taille : les livres glissent et la porte s'ajuste, sans « chargement ».
  const key = `${viewKey}|${sort}|${current}`
  const [shownKey, setShownKey] = useState(key)
  const [frozen, setFrozen] = useState(null)
  const [doorsOpen, setDoorsOpen] = useState(false)
  const introDone = useRef(false)
  const lastRows = useRef(liveRows)
  const displayRows = frozen || liveRows

  useEffect(() => {
    const t = setTimeout(() => { introDone.current = true; setDoorsOpen(true) }, 450)
    return () => clearTimeout(t)
  }, [])

  useLayoutEffect(() => {
    if (key === shownKey) {
      if (frozen) setFrozen(null)
      if (introDone.current) setDoorsOpen(true)
      return
    }
    setFrozen(lastRows.current)
    setDoorsOpen(false)
    const t = setTimeout(() => {
      setFrozen(null)
      setShownKey(key)
      introDone.current = true
      setDoorsOpen(true)
    }, CLOSE_MS + 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useLayoutEffect(() => { lastRows.current = displayRows })

  // ---- Scène 3D -------------------------------------------------------------------------------
  const dataRef = useRef(null)
  dataRef.current = { displayRows, eff, manual, canEdit, onOpen }
  const commitRef = useRef(commitShelves)
  commitRef.current = commitShelves
  const pendingNew = useRef(null)

  useEffect(() => {
    const scene = new BookcaseScene(caseRef.current, {
      onHover: b => { setHovered(b); cursor.state = b ? 'open' : 'default' },
      onOpen: (b, el) => dataRef.current.onOpen(b, el),
      canDrag: () => { const d = dataRef.current; return d.manual && d.canEdit && !lockedRef.current },
      onDragStart: id => {
        const d = dataRef.current
        const from = d.eff.find(s => s.book_ids.includes(id))
        setDragView({ id, target: from ? { shelfId: from.id, index: from.book_ids.indexOf(id) } : null })
      },
      onDragTarget: t => {
        const d = dataRef.current
        setDragView(v => {
          if (!v) return v
          if (!t) return { ...v, target: null }
          const base = d.rowsWithout(v.id)[t.row]
          if (!base) return { ...v, target: null }
          if (base.free) return { ...v, target: { shelfId: NEWSHELF } }
          return { ...v, target: { shelfId: base.shelf.id, index: base.start + t.index } }
        })
      },
      onDragMove: (x, y) => edgeFlip(x, y),
      onDragEnd: (id, t) => {
        clearTimeout(edge.current.timer); edge.current.dir = 0
        setDragView(v => {
          if (t && v?.target) {
            const res = moveBook(dataRef.current.eff, id, v.target.shelfId, v.target.index)
            commitRef.current?.(res.list)
            if (res.createdId) pendingNew.current = res.createdId
          }
          return null
        })
      },
      onOverlay: setOverlay,
    })
    sceneRef.current = scene
    if (location.search.includes('debug')) window.__bookcase = scene // tests automatisés
    return () => { scene.dispose(); sceneRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // rayons de la page courante sans le livre déplacé (pour viser l'emplacement)
  dataRef.current.rowsWithout = id => {
    const lst = buildRows({ manual: true, shelves: previewDrag(eff, id, null), autoBooks: [], byId, visible, canEdit: true, perRow: L.perRow, rowsPerPage: L.rows })
    return lst.slice(current * L.rows, (current + 1) * L.rows)
  }

  // Au bord de l'écran pendant un glisser-déposer : page suivante / précédente
  const edge = useRef({ dir: 0, timer: null })
  const edgeFlip = (x, y) => {
    const rc = caseRef.current.getBoundingClientRect()
    let dirn = 0
    if (x < rc.left + 36) dirn = -1
    else if (x > rc.right - 36) dirn = 1
    document.querySelectorAll('.nav-arrow').forEach((a, i) => {
      const r = a.getBoundingClientRect()
      if (x >= r.left - 10 && x <= r.right + 10 && y >= r.top - 10 && y <= r.bottom + 10) dirn = i === 0 ? -1 : 1
    })
    if (dirn !== edge.current.dir) {
      clearTimeout(edge.current.timer)
      edge.current.dir = dirn
      if (dirn) {
        const tick = () => { goRef.current(dirn); edge.current.timer = setTimeout(tick, 1600) }
        edge.current.timer = setTimeout(tick, 650)
      }
    }
  }

  // ---- Livres venus du panier : on vise une étagère, un emplacement s'ouvre -----------------
  const extTarget = useRef(null)
  useLayoutEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      previewExternal: (id, x, y) => {
        const d = dataRef.current
        const sc = sceneRef.current
        if (!sc || !d.manual || !d.canEdit) return null
        edgeFlip(x, y)
        const t = sc.targetAt(x, y)
        let target = null
        if (t) {
          const base = d.rowsWithout(id)[t.row]
          if (base) target = base.free ? { shelfId: NEWSHELF } : { shelfId: base.shelf.id, index: base.start + t.index }
        }
        if (JSON.stringify(target) !== JSON.stringify(extTarget.current)) {
          extTarget.current = target
          setDragView(target ? { id, target } : null)
        }
        return target
      },
      endExternal: () => {
        clearTimeout(edge.current.timer); edge.current.dir = 0
        const t = extTarget.current
        extTarget.current = null
        setDragView(null)
        return t
      },
    }
  })

  const realShelves = eff.filter(s => !s.pseudo)
  const fallbackSkin = resolveSkin(realShelves[realShelves.length - 1] || shelves[0] || DEFAULT_SKIN)
  const rowsForScene = useMemo(() => displayRows.map(meta => ({
    books: meta.books,
    palette: meta.shelf ? resolveSkin(meta.shelf) : manual ? fallbackSkin : resolveSkin(shelves[0] || DEFAULT_SKIN),
    born: !!meta.shelf && meta.shelf.id === bornId && !meta.cont,
  })), [displayRows, manual, fallbackSkin, shelves, bornId])

  useEffect(() => { sceneRef.current?.setRows(rowsForScene) }, [rowsForScene])
  useEffect(() => { sceneRef.current?.setDoors(doorsOpen) }, [doorsOpen])

  // ---- Opérations sur les étagères ----------------------------------------------------------
  const effRef = useRef(eff)
  effRef.current = eff
  const createNew = useCallback(() => {
    if (!commitRef.current) return
    const { list, id } = createShelf(effRef.current)
    commitRef.current(list)
    pendingNew.current = id
  }, [])

  const lastSignal = useRef(newShelfSignal)
  useEffect(() => {
    if (newShelfSignal !== lastSignal.current) { lastSignal.current = newShelfSignal; createNew() }
  }, [newShelfSignal, createNew])

  const labelRefs = useRef({})
  const openEditorFor = useCallback((id, selectName) => {
    const el = labelRefs.current[id]
    if (el) setEditing({ shelfId: id, rect: el.getBoundingClientRect(), selectName, openId: performance.now() })
  }, [])

  useEffect(() => {
    const id = pendingNew.current
    if (!id) return
    const idx = rowsAll.findIndex(r => r.shelf?.id === id)
    if (idx < 0) return
    pendingNew.current = null
    const target = Math.floor(idx / L.rows)
    const wait = target !== current ? CLOSE_MS + 500 : 0
    if (target !== current) { setDir(target > current ? 1 : -1); setPage(target) }
    setTimeout(() => {
      setBornId(id)
      setTimeout(() => openEditorFor(id, true), 1000)
      setTimeout(() => setBornId(b => (b === id ? null : b)), 1800)
    }, wait)
  }, [rowsAll, L.rows, current, openEditorFor])

  const editShelf = editing ? eff.find(s => s.id === editing.shelfId) : null
  const realIndex = editShelf ? realShelves.findIndex(s => s.id === editShelf.id) : -1
  const run = (res, keepEditing = true) => {
    commitShelves(res.list)
    if (keepEditing && res.id && editing && res.id !== editing.shelfId) setEditing(e => e && { ...e, shelfId: res.id })
  }

  // ---- Changer de page : clavier, molette, glissé du doigt ----------------------------------
  useEffect(() => {
    const el = caseRef.current
    let acc = 0, cool = 0, startX = null
    const busy = () => lockedRef.current || document.body.classList.contains('is-dragging')
    const onKey = e => {
      if (busy() || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
    }
    const onWheel = e => {
      if (busy()) return
      const now = performance.now()
      if (now < cool) return
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(acc) > 90) { go(acc > 0 ? 1 : -1); acc = 0; cool = now + 800 }
    }
    const onDown = e => { startX = e.clientX }
    const onUp = e => {
      if (startX == null || busy()) { startX = null; return }
      const dx = e.clientX - startX
      startX = null
      if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [go])

  // ---- Rendu --------------------------------------------------------------------------------
  const shelfNames = [...new Set(displayRows.filter(r => r.shelf && !r.shelf.preview).map(r => r.shelf.name))]
  const hd = hovered ? toDisplay(hovered) : null
  const hint = manual && canEdit
    ? (size.mobile ? 'Appui long sur un livre pour le déplacer' : 'Glisse un livre pour le ranger, clique pour l’ouvrir')
    : (size.mobile ? 'Touche un livre pour l’ouvrir' : 'Survole un livre, clique pour l’ouvrir')
  const caption = hd
    ? { title: hd.title, subtitle: hd.authors.join(', '), year: [hd.year, hd.pageCount ? `${hd.pageCount} pages` : null].filter(Boolean).join(' / ') || ' ' }
    : books.length || (manual && canEdit)
      ? {
        title: manual && shelfNames.length ? shelfNames.slice(0, 3).join(' · ') : `Étagère ${toRoman(current + 1)}`,
        subtitle: `${books.length} ${books.length > 1 ? 'livres' : 'livre'} · page ${current + 1} sur ${pages}`,
        year: hint,
      }
      : { title: emptyText, subtitle: 'Ajoute un livre avec le bouton en haut', year: ' ' }

  return (
    <>
      <div className="case-row">
      <div className={'case3d webgl' + (manual && canEdit ? ' editable' : '')} ref={caseRef}>
        {overlay.map((o, r) => {
          const meta = displayRows[r]
          if (!meta) return null
          const shelf = meta.shelf
          let label = '', card = null, onCard = null
          if (manual) {
            if (shelf) {
              label = meta.cont ? `${shelf.name} · suite` : shelf.name
              if (canEdit && !shelf.preview) { card = '+ Ajouter un livre'; onCard = () => onAdd(shelf.pseudo || shelf.virtual ? null : shelf.id) }
            } else if (canEdit) { card = '+ Nouvelle étagère'; onCard = createNew }
          } else {
            label = meta.free ? '' : autoLabel(meta.books, meta.auto, sort)
            if (!meta.free) { card = '+ Ajouter un livre'; onCard = () => onAdd(null) }
          }
          const editable = manual && canEdit && !!shelf && !meta.cont && !shelf.preview
          return (
            <div key={r}>
              {label && (editable ? (
                <button
                  type="button" ref={el => { if (shelf) labelRefs.current[shelf.id] = el }}
                  className={'plank-label editable over' + (meta.shelf?.id === bornId ? ' born' : '')}
                  style={{ left: o.label.x, top: o.label.y }}
                  onClick={e => setEditing({ shelfId: shelf.id, rect: e.currentTarget.getBoundingClientRect(), selectName: false, openId: performance.now() })}
                  title="Renommer, changer l'apparence"
                >
                  <span className="pl-name">{label}</span><span className="pl-pen" aria-hidden="true">✎</span>
                </button>
              ) : (
                <span className="plank-label over" style={{ left: o.label.x, top: o.label.y }}>{label}</span>
              ))}
              {card && o.free && doorsOpen && (
                <button type="button" className="door-card over" style={{ left: o.card.x, top: o.card.y }} onClick={onCard}>{card}</button>
              )}
            </div>
          )
        })}
      </div>
      {aside}
      </div>

      <div className="scene-bottom">
        <button type="button" className="nav-arrow" aria-label="Page précédente" onClick={() => go(-1)} disabled={current === 0}>
          <svg viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M5 1 L1 5 L5 9 M1 5 L17 5" /></svg>
        </button>
        <Caption className="scene-caption" title={caption.title} subtitle={caption.subtitle} year={caption.year} dir={dir} />
        <button type="button" className="nav-arrow" aria-label="Page suivante" onClick={() => go(1)} disabled={current >= pages - 1}>
          <svg viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M13 1 L17 5 L13 9 M17 5 L1 5" /></svg>
        </button>
      </div>

      {editing && editShelf && (
        <ShelfEditor
          key={editing.openId}
          shelf={editShelf} anchor={editing.rect} selectName={editing.selectName}
          canUp={realIndex > 0} canDown={realIndex >= 0 && realIndex < realShelves.length - 1}
          onClose={() => setEditing(null)}
          onRename={name => run(renameShelf(eff, editShelf.id, name))}
          onSkin={patch => run(setShelfSkin(eff, editShelf.id, patch))}
          onApplyAll={() => run(applySkinToAll(eff, editShelf.id))}
          onMove={delta => run(moveShelf(eff, editShelf.id, delta))}
          onDelete={() => run(deleteShelf(eff, editShelf.id), false)}
          onAdopt={() => { const res = adoptLoose(eff); commitShelves(res.list); pendingNew.current = res.id }}
        />
      )}
    </>
  )
}
