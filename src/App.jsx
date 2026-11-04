import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLibrary } from './hooks/useLibrary'
import { useShelves } from './hooks/useShelves'
import { effectiveShelves, placeBook } from './lib/shelfOps'
import { isDemoMode } from './lib/supabase'
import { sortBooks, SORTS } from './lib/bookUtils'
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
        <div className="top-right">
          <span className="lbl count-lbl">Collection · {books.length} {books.length > 1 ? 'livres' : 'livre'}</span>
        </div>
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
          onOpen={openBook} onAdd={openSearch} locked={overlay}
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
          <SearchPanel open={searchOpen} onClosed={onSearchClosed} onPick={onPick} isInLibrary={isInLibrary} onScan={() => setScanner(true)} />
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
