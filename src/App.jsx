import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLibrary } from './hooks/useLibrary'
import { useShelves } from './hooks/useShelves'
import { useSeries } from './hooks/useSeries'
import { useGames } from './hooks/useGames'
import { effectiveShelves, placeBook, moveBook } from './lib/shelfOps'
import { useBasket } from './hooks/useBasket'
import { SearchBasket, BasketTray } from './components/Basket'
import { useIsMobile } from './hooks/useIsMobile'
import { flyTo, flyToRect } from './lib/fly'
import { MAX_BASKET } from './lib/basketSize'
import { preloadCover } from './lib/covers'
import { isDemoMode } from './lib/supabase'
import { sortBooks, SORTS, spineColors } from './lib/bookUtils'
import Shelf3D from './components/Shelf3D'
import MyShelves from './components/MyShelves'
import LibrarySearch from './components/LibrarySearch'
import { webglAvailable } from './three/webgl'
import DetailSheet from './components/DetailSheet'
import SearchPanel from './components/SearchPanel'
import LoginPage from './components/LoginPage'

const Scanner = lazy(() => import('./components/Scanner'))
// La bibliothèque en vraie 3D (Three.js) est chargée à part ; sans WebGL, étagère dessinée à plat
const Bookcase3D = lazy(() => import('./components/Bookcase3D'))
// Le salon d'accueil (3D), chargé à part lui aussi
const LivingRoom = lazy(() => import('./components/LivingRoom'))
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
      <div className="logo-name">Maruchime</div>
      <div className="logo-sub">{sub}</div>
    </div>
  )
}

function Library({ user, onSignOut }) {
  const { books, loading, addBook, updateBook, removeBook, removeBooks, isInLibrary } = useLibrary(user.id)
  const { shelves, commit: commitShelves, storage } = useShelves(user.id)
  const { series, addSeries, updateSeries, removeSeries, renameCategory } = useSeries(user.id)
  const gamesApi = useGames(user.id)
  const [sort, setSortState] = useState(() => readPref('levana.sort2', 'manual'))
  const [newShelfSignal] = useState(0)
  const [shelvesOpen, setShelvesOpen] = useState(null)   // null : fermé ; sinon { id } de l'étagère à montrer
  const [addTarget, setAddTarget] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [focusId, setFocusId] = useState(null)
  const [detail, setDetail] = useState(null)        // { book, mode, rect }
  const [detailOpen, setDetailOpen] = useState(false)
  const [search, setSearch] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scanner, setScanner] = useState(false)
  const [findOpen, setFindOpen] = useState(false)   // téléphone : « Chercher » (retrouver un livre, ranger par)
  const [guide, setGuide] = useState(false)     // livres du panier sortis en bas de l'écran, prêts à ranger
  // salon d'accueil : on y arrive toujours en ouvrant le site ('first'), 'back' quand on y
  // retourne, null dans la bibliothèque
  const [salon, setSalon] = useState(() => (HAS_WEBGL ? 'first' : null))
  const basket = useBasket(user.id)
  const mobile = useIsMobile()
  const [flying, setFlying] = useState(() => new Set())
  const bookcaseApi = useRef(null)
  const shelvesRef = useRef(shelves); shelvesRef.current = shelves
  const booksRef = useRef(books); booksRef.current = books

  const setSort = v => { setSortState(v); writePref('levana.sort2', v) }
  const manual = sort === 'manual'
  const canEdit = manual

  const filtered = useMemo(() => {
    return sortBooks(books, sort)
  }, [books, sort])

  const overlay = !!detail || search || scanner || !!shelvesOpen || !!salon
  const effShelves = useMemo(() => effectiveShelves(shelves, books), [shelves, books])

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
    // la couverture s'envole jusqu'à la pile des livres à ranger
    const target = document.querySelector('.search-basket.up .bb-target, .search-basket:not(.down) .bb-target') || document.querySelector('.search-basket .sb-tab')
    flyTo(from, srcUrl, target, () => { basket.add(book); done() }, color)
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

  // Rangement guidé : le mur va jusqu'à l'étagère, la couverture s'y envole, le livre s'y pose
  const placeGuided = useCallback(async (book, shelfId, fromRect, src) => {
    const api = bookcaseApi.current
    const r = api?.showShelf?.(shelfId) ?? -1
    if (r >= 0) await new Promise(res => setTimeout(res, 560))
    const to = r >= 0 ? api.slotRect(shelfId) : null
    preloadCover(book)
    const ghost = await flyToRect(fromRect, src, to, spineColors({ google_id: book.googleId, title: book.title })[0])
    await dropFromBasket(book, { shelfId, index: Infinity })
    if (ghost) setTimeout(() => { ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).onfinish = () => ghost.remove() }, 420)
  }, [dropFromBasket])

  // panier vidé : on referme la rangée
  useEffect(() => { if (!basket.items.length) setGuide(false) }, [basket.items.length])

  // Retour au salon : la bibliothèque remonte d'abord en haut (dans la bibliothèque), puis la
  // caméra sort par là — rien ne passe devant pendant le trajet
  const goSalon = useCallback(() => {
    const sc = bookcaseApi.current?.scene?.()
    if (!sc?.scroll) { setSalon('back'); return }
    const atTop = () => Math.abs(sc.scroll.v - sc._clampScroll(Infinity)) < 0.01 && Math.abs(sc.zoom.v - 1) < 0.01 && sc.scroll.done && sc.zoom.done
    if (atTop()) { setSalon('back'); return }
    sc.setZoom(true); sc.scrollToTop()
    const t0 = performance.now()
    const wait = () => (atTop() || performance.now() - t0 > 1400 ? setTimeout(() => setSalon('back'), 120) : requestAnimationFrame(wait))
    requestAnimationFrame(wait)
  }, [])

  const openGuide = useCallback(() => {
    if (salon) setSalon(null)
    setGuide(true)
  }, [salon])

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
          <button type="button" className="lbl box add-btn" onClick={() => openSearch()}>+ <span className="add-long">Ajouter un livre</span><span className="add-short">Ajouter</span></button>
        </div>
        <Logo />
        <div className="top-right">
          {HAS_WEBGL && (
            <button type="button" className="lbl box salon-btn" onClick={e => { e.currentTarget.blur(); goSalon() }} aria-label="Retour au salon">
              <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden="true"><path d="M1 6L6.5 1.2 12 6M2.6 4.8V11h7.8V4.8" stroke="currentColor" fill="none" strokeWidth="1.1" /></svg>
              <span className="salon-btn-l">Salon</span>
            </button>
          )}
        </div>
      </header>

      <div className="scene-tabs">
        <button type="button" className="lbl box cobalt ms-open" onClick={e => { e.currentTarget.blur(); setShelvesOpen({ id: null }) }}>
          <svg width="13" height="11" viewBox="0 0 13 11" aria-hidden="true"><path d="M0.5 0.5h12M0.5 5.5h12M0.5 10.5h12M0.5 0.5v10M12.5 0.5v10" stroke="currentColor" fill="none" /></svg>
          <span><span className="ms-my">Mes </span>étagères</span>
        </button>
        <LibrarySearch books={books} shelves={effShelves} onPick={id => setFocusId(id)} />
        <label className="lbl scene-sort" aria-label="Ranger par">
          <span>Ranger par</span>
          <svg className="sort-ico" width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><path d="M1 2h12M3 6h8M5.5 10h3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" /></svg>
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
          onShelfClick={id => setShelvesOpen({ id })}
          aside={basket.items.length > 0 && !mobile ? (
            <BasketTray
              items={basket.items} shelves={effShelves} books={books} api={bookcaseApi} mobile={mobile}
              canDrop={HAS_WEBGL && manual} open={guide} onOpen={() => setGuide(true)} onClose={() => setGuide(false)}
              onDropBook={dropFromBasket} onPlace={placeGuided} onOpenBook={b => onPick(b, null)}
            />
          ) : null}
          highlightId={highlightId} focusId={focusId} onFocused={onFocused} emptyText={emptyText}
        />
      )}

      {/* Téléphone : le panier s'ouvre depuis l'onglet « Panier » (pas de panier sous le mur) */}
      {mobile && basket.items.length > 0 && (
        <BasketTray
          bare items={basket.items} shelves={effShelves} books={books} api={bookcaseApi} mobile
          canDrop={HAS_WEBGL && manual} open={guide} onOpen={() => setGuide(true)} onClose={() => setGuide(false)}
          onDropBook={dropFromBasket} onPlace={placeGuided} onOpenBook={b => onPick(b, null)}
        />
      )}

      {/* Téléphone : menu en bas, comme une appli (pas dans le salon, qui a le sien) */}
      {mobile && !salon && (
        <>
          {findOpen && (
            <div className="find-sheet grain" onPointerDown={e => e.stopPropagation()}>
              <LibrarySearch books={books} shelves={effShelves} autoFocus up onPick={id => { setFindOpen(false); setFocusId(id) }} />
              <label className="lbl find-sort">
                <span>Ranger par</span>
                <select value={sort} onChange={e => setSort(e.target.value)}>
                  {SORTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            </div>
          )}
          {findOpen && <div className="find-backdrop" onPointerDown={() => setFindOpen(false)} />}
          <nav className="tabbar" aria-label="Menu">
            {HAS_WEBGL && (
              <button type="button" className="tab" onClick={() => { setFindOpen(false); setGuide(false); goSalon() }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.2L12 4l8.5 7.2M6 9.8V20h12V9.8M10 20v-5.5h4V20" /></svg>
                <span>Salon</span>
              </button>
            )}
            <button type="button" className={'tab' + (findOpen ? ' on' : '')} onClick={() => setFindOpen(o => !o)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></svg>
              <span>Chercher</span>
            </button>
            <button type="button" className="tab tab-shop" onClick={() => { setFindOpen(false); openSearch() }} aria-label="Boutique : ajouter des livres">
              <span className="tab-shop-bubble">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2L5 8zM9 8V6.5a3 3 0 016 0V8" /><path d="M12 11.5v5M9.5 14h5" /></svg>
              </span>
              <span>Boutique</span>
            </button>
            <button type="button" className={'tab' + (shelvesOpen ? ' on' : '')} onClick={() => { setFindOpen(false); setShelvesOpen({ id: null }) }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v16M20 4v16M4 9h16M4 14.5h16M4 20h16M7 9V6M9 9V5.5M12 14.5v-3.5M14.5 14.5v-3" /></svg>
              <span>Étagères</span>
            </button>
            <button type="button" className={'tab' + (guide ? ' on' : '')} onClick={() => { setFindOpen(false); if (basket.items.length) setGuide(g => !g); else openSearch() }}>
              <span className="tab-ico">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5h16M5.5 19.5v-4h13v4M6.5 15.5v-4h11v4M8 11.5V8h8v3.5M12 4v4" /></svg>
                {basket.items.length > 0 && <span className="tab-badge" key={basket.items.length}>{basket.items.length}</span>}
              </span>
              <span>À ranger</span>
            </button>
          </nav>
        </>
      )}

      <footer className="footer-bar">
        <div className="lbl footer-copy">
          © Bibliothèque Maruchime{isDemoMode ? ' · Mode démo' : ''}
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
          <SearchPanel open={searchOpen} onClosed={onSearchClosed} onPick={onPick} isInLibrary={isInLibrary} onScan={() => setScanner(true)} inBasket={inBasket} onBasket={addToBasket} basketFull={basketFull} basketCount={basket.items.length} basketBusy={flying.size > 0}
            onBasketDrop={(b, rect, src) => addToBasket(b, null, rect, src)}
            basketSlot={<SearchBasket items={basket.items} mobile={mobile} onBookClick={b => onPick(b, null)} onDone={() => { closeSearch(); if (manual && effShelves.some(s => !s.pseudo)) openGuide() }} />} />
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
            onSave={async updates => { await updateBook(detail.book.id, updates); setDetail(dt => dt && { ...dt, book: { ...dt.book, ...updates } }) }}
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

      {shelvesOpen && (
        <MyShelves eff={effShelves} commit={commitShelves} onDeleteBooks={removeBooks} initialId={shelvesOpen.id} onClose={() => setShelvesOpen(null)} />
      )}

      {salon && (
        <Suspense fallback={<div className="salon" />}>
          <LivingRoom
            from={salon} books={books} shelves={effShelves} basketItems={basket.items}
            series={series} onAddSeries={addSeries} onUpdateSeries={updateSeries} onRemoveSeries={removeSeries} onRenameCategory={renameCategory}
            gamesApi={gamesApi} holder={user.user_metadata?.full_name || user.user_metadata?.name || ''}
            onEntered={next => { setSalon(null); if (next === 'guide' && manual && basket.items.length) setGuide(true) }}
            onOpenBook={b => (b ? openBook(b, null) : openSearch())}
            onAddBooks={() => openSearch()}
            onSignOut={onSignOut}
            getLibrary={() => bookcaseApi.current?.scene?.()}
          />
        </Suspense>
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
    </>
  )
}
