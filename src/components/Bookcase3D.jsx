import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toRoman, titleKey, authorKey, toDisplay } from '../lib/bookUtils'
import { cursor } from '../lib/cursorState'
import { resolveSkin, DEFAULT_SKIN } from '../lib/skins'
import {
  PH, effectiveShelves, previewDrag, moveBook, createShelf,
  renameShelf, setShelfSkin, applySkinToAll, moveShelf, deleteShelf, adoptLoose,
} from '../lib/shelfOps'
import { BookcaseScene, worldLayout, RH, PT } from '../three/BookcaseScene'
import Caption from './Caption'
import ShelfEditor from './ShelfEditor'
import { useLayer } from '../lib/nav'

const CLOSE_MS = 700
const PH_BOOK = { id: PH, placeholder: true }
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`

/**
 * Tous les rayons du mur : les étagères (rangement manuel) ou la liste triée (autres tris).
 * Les rayons libres (bas du mur) ne reçoivent pas de livres : on ne crée une étagère que
 * depuis « Mes étagères ».
 */
function buildRows({ manual, shelves, autoBooks, byId, visible, canEdit, perRow, minRows }) {
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
      // (j * Infinity vaut NaN pour j = 0 : une étagère d'une seule rangée commence à 0)
      for (let j = 0; j < n; j++) rows.push({ key: `${s.id}:${j}`, shelf: s, start: j ? j * perRow : 0, books: n === 1 ? list : list.slice(j * perRow, (j + 1) * perRow), cont: j > 0 })
    }
  } else {
    const n = Math.ceil(autoBooks.length / perRow)
    for (let j = 0; j < n; j++) rows.push({ key: `a${j}`, auto: j, books: autoBooks.slice(j * perRow, (j + 1) * perRow) })
  }
  while (rows.length < minRows) rows.push({ key: `free${rows.length}`, free: true, books: [] })
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
 * La bibliothèque en vraie 3D : un seul grand mur qu'on parcourt en défilant, avec une vue
 * d'ensemble, un sommaire et une réglette de position. Le dessin et les ressorts sont dans
 * BookcaseScene ; ici : les étagères, les portes, le glisser-déposer, l'interface autour.
 */
export default function Bookcase3D({
  books, allBooks, sort, viewKey, manual, canEdit, shelves, commitShelves, newShelfSignal,
  onOpen, locked, focusId, onFocused, emptyText, apiRef, aside, onShelfClick, topBooks, onTopPlaque, show,
}) {
  const caseRef = useRef(null)
  const sceneRef = useRef(null)
  const [size, setSize] = useState({ w: 1200, h: 520, mobile: false })
  const [hovered, setHovered] = useState(null)
  const [spot, setSpot] = useState(null)
  const [dragView, setDragView] = useState(null)
  const [bornId, setBornId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [centerRow, setCenterRow] = useState(0)
  const [zoomedOut, setZoomedOut] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  useLayoutEffect(() => {
    const el = caseRef.current
    const measure = () => setSize(prev => {
      const next = { w: el.clientWidth, h: el.clientHeight, mobile: window.innerWidth <= 767 }
      return prev.w === next.w && prev.h === next.h && prev.mobile === next.mobile ? prev : next
    })
    measure()
    let t = null
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(measure, 220) })
    ro.observe(el)
    return () => { clearTimeout(t); ro.disconnect() }
  }, [])

  const L = useMemo(() => worldLayout(size.w, size.h, size.mobile), [size])
  // rangement à la main : une étagère tient toujours sur sa rangée (les livres se serrent) ;
  // poser un livre ne fait jamais passer les autres sur une autre rangée
  const shelfRow = manual ? Infinity : L.perRow

  // ---- Données --------------------------------------------------------------------------
  const byId = useMemo(() => new Map(allBooks.map(b => [b.id, b])), [allBooks])
  const visible = useMemo(() => new Set(books.map(b => b.id)), [books])
  const eff = useMemo(() => (manual ? effectiveShelves(shelves, allBooks) : []), [manual, shelves, allBooks])
  const display = useMemo(
    () => (manual && dragView ? previewDrag(eff, dragView.id, dragView.target) : eff),
    [manual, eff, dragView],
  )
  const rowsAll = useMemo(
    () => buildRows({ manual, shelves: display, autoBooks: books, byId, visible, canEdit, perRow: shelfRow, minRows: L.rows }),
    [manual, display, books, byId, visible, canEdit, shelfRow, L.rows],
  )

  // ---- Portes : elles ne se ferment que pour changer de tri ou de vue -----------------------
  const key = `${viewKey}|${sort}`
  const [shownKey, setShownKey] = useState(key)
  const [frozen, setFrozen] = useState(null)
  const [doorsOpen, setDoorsOpen] = useState(false)
  const introDone = useRef(false)
  const lastRows = useRef(rowsAll)
  const displayRows = frozen || rowsAll

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
      sceneRef.current?.scrollToTop()
    }, CLOSE_MS + 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useLayoutEffect(() => { lastRows.current = displayRows })

  // ---- Scène 3D -------------------------------------------------------------------------------
  const dataRef = useRef(null)
  dataRef.current = { displayRows, eff, manual, canEdit, onOpen, onShelfClick, onTopPlaque }
  const commitRef = useRef(commitShelves)
  commitRef.current = commitShelves
  const pendingNew = useRef(null)
  const labelEls = useRef([])
  const thumbRef = useRef(null)
  const lastExt = useRef(null)

  useEffect(() => {
    const scene = new BookcaseScene(caseRef.current, {
      onHover: b => { setHovered(b); cursor.state = b ? 'open' : 'default' },
      onOpen: (b, el) => dataRef.current.onOpen(b, el),
      isLocked: () => lockedRef.current,
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
          if (base.free) return { ...v, target: null }   // pas de nouvelle étagère en lâchant un livre
          return { ...v, target: { shelfId: base.shelf.id, index: base.start + t.index } }
        })
      },
      onDragEnd: (id, t) => {
        setDragView(v => {
          if (t && v?.target) {
            const res = moveBook(dataRef.current.eff, id, v.target.shelfId, v.target.index)
            commitRef.current?.(res.list)
            if (res.createdId) pendingNew.current = res.createdId
          }
          return null
        })
      },
      onAutoScroll: () => { const x = lastExt.current; if (x) apiRef?.current?.previewExternal(x.id, x.x, x.y) },
      onCenter: r => setCenterRow(r),
      onZoom: z => setZoomedOut(z < 0.5),
      onSpot: b => setSpot(b),
      onView: v => {
        const el = thumbRef.current
        if (el) { el.style.top = `${(v.top * 100).toFixed(2)}%`; el.style.height = `${Math.max(4, (v.bottom - v.top) * 100).toFixed(2)}%` }
      },
      // la plaque de l'étagère d'honneur ouvre « Ranger mon top »
      onTopPlaque: () => dataRef.current.onTopPlaque?.(),
      // la plaque d'une étagère ouvre ses réglages
      onPlaque: r => {
        const meta = dataRef.current.displayRows[r]
        if (meta?.shelf && !meta.shelf.pseudo && !meta.shelf.preview && dataRef.current.manual) dataRef.current.onShelfClick?.(meta.shelf.id)
      },
    })
    sceneRef.current = scene
    if (location.search.includes('debug')) window.__bookcase = scene // tests automatisés
    return () => { scene.dispose(); sceneRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // notre top 5, de face sur l'étagère d'honneur en haut du meuble
  useEffect(() => { sceneRef.current?.setTop(topBooks || []) }, [topBooks])
  useEffect(() => { sceneRef.current?.setFilter(show || null) }, [show])

  // tous les rayons sans le livre déplacé (pour viser l'emplacement)
  dataRef.current.rowsWithout = id => buildRows({ manual: true, shelves: previewDrag(eff, id, null), autoBooks: [], byId, visible, canEdit: true, perRow: shelfRow, minRows: L.rows })

  // ---- Livres venus du panier : on vise une étagère, un emplacement s'ouvre -----------------
  const extTarget = useRef(null)
  useLayoutEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      scene: () => sceneRef.current,   // le salon en fait une copie fidèle
      // rangement guidé : aller jusqu'à une étagère, et la place de son prochain livre
      showShelf: shelfId => {
        let r = -1
        dataRef.current.displayRows.forEach((row, i) => { if (row.shelf?.id === shelfId) r = i })
        if (r >= 0) sceneRef.current?.scrollToRow(r)
        return r
      },
      slotRect: shelfId => {
        let r = -1
        dataRef.current.displayRows.forEach((row, i) => { if (row.shelf?.id === shelfId) r = i })
        return r >= 0 ? sceneRef.current?.slotRect(r) || null : null
      },
      previewExternal: (id, x, y) => {
        const d = dataRef.current
        const sc = sceneRef.current
        if (!sc || !d.manual || !d.canEdit) return null
        lastExt.current = { id, x, y }
        sc.setExternalPointer(x, y)
        const t = sc.targetAt(x, y)
        let target = null
        if (t) {
          const base = d.rowsWithout(id)[t.row]
          if (base && !base.free) target = { shelfId: base.shelf.id, index: base.start + t.index }
        }
        if (JSON.stringify(target) !== JSON.stringify(extTarget.current)) {
          extTarget.current = target
          setDragView(target ? { id, target } : null)
        }
        return target
      },
      endExternal: () => {
        sceneRef.current?.setExternalPointer(null)
        lastExt.current = null
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
    // nom gravé sur la plaque de l'étagère
    label: manual ? (meta.shelf ? (meta.cont ? `${meta.shelf.name} · suite` : meta.shelf.name) : '') : (meta.free ? '' : autoLabel(meta.books, meta.auto, sort)),
    palette: meta.shelf ? resolveSkin(meta.shelf) : manual ? fallbackSkin : resolveSkin(shelves[0] || DEFAULT_SKIN),
    born: !!meta.shelf && meta.shelf.id === bornId && !meta.cont,
  })), [displayRows, manual, fallbackSkin, shelves, bornId, sort])

  useEffect(() => { sceneRef.current?.setRows(rowsForScene) }, [rowsForScene])
  useEffect(() => { sceneRef.current?.setDoors(doorsOpen) }, [doorsOpen])
  useLayoutEffect(() => { sceneRef.current?.refreshOverlay() })

  // Aller à un livre (après un ajout, ou depuis la recherche)
  useEffect(() => {
    if (!focusId) return
    if (!rowsAll.some(r => r.books.some(b => b.id === focusId))) return
    const t = setTimeout(() => { sceneRef.current?.focusBook(focusId); onFocused?.() }, 80)
    return () => clearTimeout(t)
  }, [focusId, rowsAll, onFocused])

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

  const shelfLabelRefs = useRef({})
  const openEditorFor = useCallback((id, selectName) => {
    const el = shelfLabelRefs.current[id]
    if (el) setEditing({ shelfId: id, rect: el.getBoundingClientRect(), selectName, openId: performance.now() })
  }, [])

  // Une étagère vient d'être créée (livre lâché dans le rayon libre) : on y va, elle se construit
  useEffect(() => {
    const id = pendingNew.current
    if (!id) return
    const idx = rowsAll.findIndex(r => r.shelf?.id === id)
    if (idx < 0) return
    pendingNew.current = null
    sceneRef.current?.scrollToRow(idx)
    setTimeout(() => {
      setBornId(id)
      setTimeout(() => openEditorFor(id, true), 1000)
      setTimeout(() => setBornId(b => (b === id ? null : b)), 1800)
    }, 500)
  }, [rowsAll, openEditorFor])

  const editShelf = editing ? eff.find(s => s.id === editing.shelfId) : null
  const realIndex = editShelf ? realShelves.findIndex(s => s.id === editShelf.id) : -1
  const run = (res, keepEditing = true) => {
    commitShelves(res.list)
    if (keepEditing && res.id && editing && res.id !== editing.shelfId) setEditing(e => e && { ...e, shelfId: res.id })
  }

  // ---- Clavier : parcourir le mur ----------------------------------------------------------------
  useEffect(() => {
    const onKey = e => {
      const sc = sceneRef.current
      if (!sc || lockedRef.current || document.body.classList.contains('is-dragging')) return
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      const map = { ArrowDown: () => sc.scrollBy(1), ArrowUp: () => sc.scrollBy(-1), PageDown: () => sc.scrollBy(L.rows), PageUp: () => sc.scrollBy(-L.rows), Home: () => sc.scrollToTop(), End: () => sc.scrollToBottom() }
      if (map[e.key]) { e.preventDefault(); map[e.key]() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [L.rows])

  // ---- Sommaire : une entrée par étagère (ou par rayon dans les autres tris) -----------------
  const sections = useMemo(() => {
    const out = []
    displayRows.forEach((m, i) => {
      if (m.free) return
      if (manual) {
        if (!m.shelf || m.shelf.preview) return
        const last = out[out.length - 1]
        if (m.cont && last && last.key === m.shelf.id) { last.last = i; last.count += m.books.length; return }
        out.push({ key: m.shelf.id, label: m.shelf.name, row: i, last: i, count: m.books.length, pseudo: !!m.shelf.pseudo })
      } else {
        out.push({ key: m.key, label: autoLabel(m.books, m.auto, sort), row: i, last: i, count: m.books.length })
      }
    })
    return out
  }, [displayRows, manual, sort])
  const currentSection = sections.find(s => centerRow >= s.row && centerRow <= s.last) || sections[0]
  const totalRows = Math.max(displayRows.length, L.rows)

  // fermer le sommaire en cliquant ailleurs
  useEffect(() => {
    if (!tocOpen) return
    const onDown = e => { if (!e.target.closest?.('.toc')) setTocOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [tocOpen])

  // ---- Plein écran (téléphone) : plus d'interface, on se promène et on zoome dans les étagères ----
  const [free, setFree] = useState(false)
  useEffect(() => {
    document.body.classList.toggle('immersive', free)
    sceneRef.current?.setFree(free)
    if (!free) return
    return () => { document.body.classList.remove('immersive') }
  }, [free])
  useLayer(free, '/bibliotheque/tout-voir', () => setFree(false))
  useEffect(() => { if (!size.mobile) setFree(false) }, [size.mobile])

  // ---- Rendu --------------------------------------------------------------------------------
  const shown = spot || hovered
  const hd = shown ? toDisplay(shown) : null
  const hint = zoomedOut
    ? 'Touche une étagère pour t’en approcher'
    : size.mobile ? 'Glisse pour parcourir · pince pour tout voir' : 'Molette pour parcourir · clique un livre pour l’ouvrir'
  const caption = hd
    ? { title: hd.title, subtitle: hd.authors.join(', '), year: [hd.year, hd.pageCount ? `${hd.pageCount} pages` : null].filter(Boolean).join(' / ') || ' ' }
    : books.length || (manual && canEdit)
      ? {
        title: zoomedOut ? `${plural(sections.length, 'étagère')}` : currentSection?.label || 'Ma bibliothèque',
        subtitle: zoomedOut
          ? `${plural(books.length, 'livre')} en tout`
          : currentSection ? `${plural(currentSection.count, 'livre')} · étagère ${sections.indexOf(currentSection) + 1} sur ${sections.length}` : plural(books.length, 'livre'),
        year: hint,
      }
      : { title: emptyText, subtitle: 'Ajoute un livre avec le bouton en haut', year: ' ' }

  return (
    <>
      <div className="case-row">
      <div className={'case3d webgl' + (manual && canEdit ? ' editable' : '') + (zoomedOut ? ' overview' : '')} ref={caseRef}>
        {/* les noms des étagères sont gravés sur des plaques, dans la scène 3D */}

        {/* réglette : où l'on est dans le mur ; un clic sur un repère y amène */}
        {sections.length > 1 && (
          <div className="wall-rail" aria-hidden="true">
            <span className="rail-track" />
            {sections.map(s => (
              <button
                key={s.key} type="button" tabIndex={-1}
                className={'rail-tick' + (s === currentSection ? ' on' : '')}
                style={{ top: `${((s.row * (RH + PT) + PT) / (totalRows * (RH + PT) + PT)) * 100}%` }}
                title={s.label}
                onClick={() => sceneRef.current?.scrollToRow(s.row)}
              />
            ))}
            <span className="rail-thumb" ref={thumbRef} />
          </div>
        )}
      </div>
      {aside}
      </div>

      {free && (
        <>
          <button type="button" className="free-exit" onClick={() => setFree(false)} aria-label="Quitter le plein écran">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <p className="free-hint">Glisse pour te promener · pince pour zoomer</p>
        </>
      )}

      <div className="scene-bottom">
        <div className="toc">
          <button type="button" className={'lbl box toc-btn' + (tocOpen ? ' on' : '')} onClick={() => setTocOpen(o => !o)} aria-expanded={tocOpen} aria-label="Sommaire">
            <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true"><path d="M0 1h12M0 5h12M0 9h12" stroke="currentColor" /></svg>
            <span className="zl">Sommaire</span>
          </button>
          {tocOpen && (
            <div className="toc-pop grain" role="menu">
              <div className="lbl toc-head">{plural(sections.length, 'étagère')} · {plural(books.length, 'livre')}</div>
              <div className="toc-list">
                {sections.map((s, i) => (
                  <button
                    key={s.key} type="button" role="menuitem"
                    className={'toc-item' + (s === currentSection ? ' on' : '')}
                    onClick={() => { sceneRef.current?.scrollToRow(s.row); setTocOpen(false) }}
                  >
                    <span className="toc-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="toc-name">{s.label}</span>
                    <span className="toc-count">{s.count}</span>
                  </button>
                ))}
                {!sections.length && <p className="se-note">Aucune étagère pour le moment.</p>}
              </div>
            </div>
          )}
        </div>
        <Caption className="scene-caption" title={caption.title} subtitle={caption.subtitle} year={caption.year} dir={1} />
        <button type="button" className={'lbl box zoom-btn' + (zoomedOut ? ' on' : '')} onClick={() => (size.mobile ? setFree(true) : sceneRef.current?.setZoom(zoomedOut))} aria-label={size.mobile ? 'Plein écran' : zoomedOut ? 'Se rapprocher' : 'Tout voir'}>
          {zoomedOut ? (
            <><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M1 4V1h3M10 4V1H7M1 7v3h3M10 7v3H7" stroke="currentColor" fill="none" /></svg> <span className="zl">Se rapprocher</span></>
          ) : (
            <><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M4 1H1v3M7 1h3v3M4 10H1V7M7 10h3V7" stroke="currentColor" fill="none" /></svg> <span className="zl">Tout voir</span></>
          )}
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
