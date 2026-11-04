import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLibrary } from './hooks/useLibrary'
import { useShelves } from './hooks/useShelves'
import { effectiveShelves, placeBook, moveBook } from './lib/shelfOps'
import { useBasket } from './hooks/useBasket'
import { SearchBasket, ShelfBasket } from './components/Basket'
import { useIsMobile } from './hooks/useIsMobile'
import { flyTo, flyIntoBasket } from './lib/fly'
import { MAX_BASKET } from './lib/basketSize'
import { preloadCover } from './lib/covers'
import { isDemoMode } from './lib/supabase'
import { sortBooks, SORTS, spineColors } from './lib/bookUtils'
import Shelf3D from './components/Shelf3D'
import { webglAvailable } from './three/webgl'
import DetailSheet from './components/DetailSheet'
import SearchPanel from './components/SearchPanel'
import LoginPage from './components/LoginPage'
import Cursor from './components/Cursor'

const Scanner = lazy(() => import('./components/Scanner'))
// La bibliothèque en vraie 3D (Three.js) est chargée à part ; sans WebGL, étagère dessinée à plat
const Bookcase3D = lazy(() => import('./components/Bookcase3D'))
const HAS_WEBGL = typeof window !== 'undefined' && webglAvailable()
function Bookcase(props) {
  if (!HAS_WEBGL) return <Shelf3D {...props} />
  return (
    <Suspense fallback={<div className="case3d" />}>
      <Bookcase3D {...props} />
    </Suspense>
  )
}

function readPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

function Logo({ sub = 'Bibliothèque' }) {
  return (
    <div className="logo">
      <div className="logo-name">Levana</div>
      <div className="logo-sub">{sub}</div>
    </div>
  )
}

function Library({ user, onSignOut }) {
  const { books, loading, addBook, updateBook, removeBook, isInLibrary } = useLibrary(user.id)
  const { shelves, commit: commitShelves, storage } = useShelves(user.id)
  const [sort, setSortState] = useState(() => readPref('levana.sort2', 'manual'))
  const [newShelfSignal, setNewShelfSignal] = useState(0)
  const [addTarget, setAddTarget] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [focusId, setFocusId] = useState(null)
  const [detail, setDetail] = useState(null)        // { book, mode, rect }
  const [detailOpen, setDetailOpen] = useState(false)
  const [search, setSearch] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scanner, setScanner] = useState(false)
  const basket = useBasket(user.id)
  const mobile = useIsMobile()
  const [bump, setBump] = useState(0)
  const [flying, setFlying] = useState(() => new Set())
  const bookcaseApi = useRef(null)
  const searchBasketApi = useRef(null)
  const shelvesRef = useRef(shelves); shelvesRef.current = shelves
  const booksRef = useRef(books); booksRef.current = books

  const setSort = v => { setSortState(v); writePref('levana.sort2', v) }
  const manual = sort === 'manual'
  const canEdit = manual

  const filtered = useMemo(() => {
    return sortBooks(books, sort)
  }, [books, sort])

  const overlay = !!detail || search || scanner

  const openBook = useCallback((book, el) => {
    setDetail({ book, mode: 'edit', rect: el?.getBoundingClientRect() || null })
    setDetailOpen(true)
  }, [])

  const closeDetail = useCallback(() => setDetailOpen(false), [])
  const onDetailClosed = useCallback(() => setDetail(null), [])

  const openSearch = useCallback((target = null) => {
    setAddTarget(typeof target === 'string' ? target : null)
    setSearch(true); setSearchOpen(true)
  }, [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const onSearchClosed = useCallback(() => setSearch(false), [])

  // Précharge les couvertures de la bibliothèque et du panier dès l'ouverture
  useEffect(() => { books.forEach(b => preloadCover(b)) }, [books])
  useEffect(() => { basket.items.forEach(b => preloadCover(b)) }, [basket.items])

  // « + » dans la recherche : la couverture vole jusqu'au panier
  // un livre en vol est déjà dans le panier (version 3D) : on compte chaque livre une seule fois
  const basketCount = new Set([...basket.items.map(b => b.googleId), ...flying]).size
  const basketFull = basketCount >= MAX_BASKET
  const addToBasket = useCallback((book, coverEl, dropRect, dropSrc) => {
    if (basketFull) return
    preloadCover(book)
    const img = coverEl?.querySelector('img')
    const from = dropRect || coverEl?.getBoundingClientRect()
    const srcUrl = dropSrc || img?.src
    const color = spineColors({ google_id: book.googleId, title: book.title })[0]
    const done = () => setFlying(f => { const n = new Set(f); n.delete(book.googleId); return n })
    setFlying(f => new Set(f).add(book.googleId))
    const api = searchBasketApi.current
    if (api) {
      // envol continu : la couverture devient le livre 3D au-dessus du panier, puis il tombe dedans
      api.expect(book.googleId)
      basket.add(book)
      flyIntoBasket({
        from, src: srcUrl, color,
        target: () => api.startRect(book.googleId),
        ready: () => api.ready(book.googleId),
        onLand: () => api.reveal(book.googleId),
        onDone: done,
      })
    } else {
      // panier dessiné (sans 3D)
      flyTo(from, srcUrl, document.querySelector('.search-basket .bb-target'), () => {
        basket.add(book); done(); setBump(n => n + 1)
      }, color)
    }
  }, [basket, basketFull])
  const inBasket = useCallback(id => basket.has(id) || flying.has(id), [basket, flying])

  // Un livre du panier posé sur une étagère
  const dropFromBasket = useCallback(async (book, target) => {
    basket.remove(book.googleId)
    try {
      const saved = await addBook(book, ['possede'])
      if (saved?.id && target) commitShelves(moveBook(effectiveShelves(shelvesRef.current, booksRef.current), saved.id, target.shelfId, target.index).list)
    } catch (e) {
      console.error(e)
      basket.add(book)
    }
  }, [basket, addBook, commitShelves])

  // « Ranger tout » : tous les livres du panier à la fin d'une étagère
  const placeAllFromBasket = useCallback(async shelfId => {
    const ids = []
    for (const b of basket.items) {
      try { const saved = await addBook(b, ['possede']); if (saved?.id) ids.push(saved.id) } catch (e) { console.error(e) }
    }
    if (ids.length && shelvesRef.current.length) {
      let list = effectiveShelves(shelvesRef.current, booksRef.current)
      for (const id of ids) list = placeBook(list, id, shelfId).list
      commitShelves(list)
    }
    basket.clear()
    if (ids.length) setFocusId(ids[ids.length - 1])
  }, [basket, addBook, commitShelves])

  const onPick = useCallback((book, rect) => {
    setScanner(false)
    setDetail({ book, mode: 'add', rect: rect || null })
    setDetailOpen(true)
  }, [])
  const onScanFound = useCallback(book => onPick(book, null), [onPick])

  // Après un ajout : aller à l'étagère du nouveau livre et le signaler
  const onFocused = useCallback(() => {
    setHighlightId(focusId)
    setFocusId(null)
    setTimeout(() => setHighlightId(null), 2800)
  }, [focusId])

  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return
      if (scanner) setScanner(false)
      else if (detailOpen) closeDetail()
      else if (searchOpen) closeSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scanner, detailOpen, searchOpen, closeDetail, closeSearch])

  const emptyText = 'Le premier rayon attend son livre'

  return (
    <div className="scene">
      <header className="top-bar">
        <div className="top-left">
          <button type="button" className="lbl box" onClick={() => openSearch()}>+ Ajouter un livre</button>
        </div>
        <Logo />
        <div className="top-right" />
      </header>

      <div className="scene-tabs">
        {canEdit && (
          <button type="button" className="lbl box cobalt" onClick={e => { e.currentTarget.blur(); setNewShelfSignal(n => n + 1) }}>+ Étagère</button>
        )}
        <label className="lbl scene-sort">
          <span>Ranger par</span>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {loading && !books.length ? (
        <p className="scene-loading lbl">Ouverture des rayons…</p>
      ) : (
        <Bookcase
          books={filtered} allBooks={books} sort={sort} viewKey="all" manual={manual} canEdit={canEdit}
          shelves={shelves} commitShelves={commitShelves} newShelfSignal={newShelfSignal}
          onOpen={openBook} onAdd={openSearch} locked={overlay} apiRef={bookcaseApi}
          aside={basket.items.length > 0 ? (
            <ShelfBasket
              items={basket.items} shelves={shelves.map(s => ({ id: s.id, name: s.name }))} defaultShelf={addTarget}
              canDrop={HAS_WEBGL && manual} api={bookcaseApi} mobile={mobile}
              onDropBook={dropFromBasket} onPlaceAll={placeAllFromBasket}
              onOpenBook={b => onPick(b, null)} onRemove={basket.remove} onClear={basket.clear}
            />
          ) : null}
          highlightId={highlightId} focusId={focusId} onFocused={onFocused} emptyText={emptyText}
        />
      )}

      <footer className="footer-bar">
        <div className="lbl footer-copy">
          © Bibliothèque Levana{isDemoMode ? ' · Mode démo' : ''}
          {!isDemoMode && storage === 'local' && shelves.length > 0 && <span className="footer-note"> · Rangement gardé sur cet appareil</span>}
        </div>
        <div className="lbl footer-links">
          <span className="footer-mail">{user.email}</span>
          <span aria-hidden="true">/</span>
          <button type="button" onClick={onSignOut}>Déconnexion</button>
        </div>
      </footer>

      {search && (
        <>
          <SearchPanel open={searchOpen} onClosed={onSearchClosed} onPick={onPick} isInLibrary={isInLibrary} onScan={() => setScanner(true)} inBasket={inBasket} onBasket={addToBasket} basketFull={basketFull}
            onBasketDrop={(b, rect, src) => addToBasket(b, null, rect, src)}
            basketSlot={<SearchBasket items={basket.items} bump={bump} mobile={mobile} apiRef={searchBasketApi} onBookClick={b => onPick(b, null)} onRemove={basket.remove} onDone={closeSearch} />} />
          <button type="button" className="lbl box search-close-btn" style={{ zIndex: 59, position: 'fixed' }} onClick={closeSearch}>Fermer</button>
        </>
      )}

      {detail && (
        <>
          <DetailSheet
            key={detail.book.id || detail.book.googleId}
            book={detail.book} mode={detail.mode} originRect={detail.rect} open={detailOpen}
            shelfOptions={shelves.map(s => ({ id: s.id, name: s.name }))} defaultShelf={addTarget}
            onClosed={onDetailClosed}
            inLibrary={detail.mode === 'add' && isInLibrary(detail.book.googleId)}
            onSave={async updates => { await updateBook(detail.book.id, updates) }}
            onRemove={async () => { await removeBook(detail.book.id); closeDetail() }}
            onAdd={async shelfId => {
              const saved = await addBook(detail.book, ['possede'])
              basket.remove(detail.book.googleId)
              if (saved?.id && shelves.length) commitShelves(placeBook(effectiveShelves(shelves, books), saved.id, shelfId || addTarget).list)
              if (saved?.id) setFocusId(saved.id)
              closeDetail()
              closeSearch()
            }}
          />
          <button type="button" className="lbl box detail-close-btn" style={{ zIndex: 61, position: 'fixed' }} onClick={closeDetail}>
            {detail.mode === 'add' ? 'Retour' : 'Fermer'}
          </button>
        </>
      )}

      {scanner && <Suspense fallback={null}><Scanner onBookFound={onScanFound} onClose={() => setScanner(false)} /></Suspense>}
    </div>
  )
}

export default function App() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()

  return (
    <>
      {loading
        ? <div className="loading-screen"><Logo /><span className="lbl">Ouverture de la bibliothèque…</span></div>
        : (user ? <Library user={user} onSignOut={signOut} /> : <LoginPage onSignIn={signInWithGoogle} />)}
      <Cursor />
    </>
  )
}
