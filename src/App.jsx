import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLibrary, STATUSES, bookHasStatus } from './hooks/useLibrary'
import { isDemoMode } from './lib/supabase'
import { sortBooks, SORTS } from './lib/bookUtils'
import Shelf3D from './components/Shelf3D'
import StatusTabs from './components/StatusTabs'
import DetailSheet from './components/DetailSheet'
import SearchPanel from './components/SearchPanel'
import LoginPage from './components/LoginPage'
import Cursor from './components/Cursor'

const Scanner = lazy(() => import('./components/Scanner'))

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
  const [filter, setFilter] = useState('tous')
  const [sort, setSortState] = useState(() => readPref('levana.sort', 'recent'))
  const [highlightId, setHighlightId] = useState(null)
  const [focusId, setFocusId] = useState(null)
  const [detail, setDetail] = useState(null)        // { book, mode, rect }
  const [detailOpen, setDetailOpen] = useState(false)
  const [search, setSearch] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scanner, setScanner] = useState(false)

  const setSort = v => { setSortState(v); writePref('levana.sort', v) }

  const filtered = useMemo(() => {
    const list = filter === 'tous' ? books : books.filter(b => bookHasStatus(b, filter))
    return sortBooks(list, sort)
  }, [books, filter, sort])

  const tabs = useMemo(() => [
    { id: 'tous', label: 'Tous', count: books.length },
    ...STATUSES.map(s => ({ id: s.id, label: s.label, count: books.filter(b => bookHasStatus(b, s.id)).length })),
  ], [books])

  const overlay = !!detail || search || scanner

  const openBook = useCallback((book, el) => {
    setDetail({ book, mode: 'edit', rect: el?.getBoundingClientRect() || null })
    setDetailOpen(true)
  }, [])

  const closeDetail = useCallback(() => setDetailOpen(false), [])
  const onDetailClosed = useCallback(() => setDetail(null), [])

  const openSearch = () => { setSearch(true); setSearchOpen(true) }
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

  const emptyText = filter === 'tous' ? 'Le premier rayon attend son livre' : 'Rien sur ce rayon pour le moment'

  return (
    <div className="scene">
      <header className="top-bar">
        <div className="top-left">
          <button type="button" className="lbl box" onClick={openSearch}>+ Ajouter un livre</button>
        </div>
        <Logo />
        <div className="top-right">
          <span className="lbl count-lbl">Collection · {books.length} {books.length > 1 ? 'livres' : 'livre'}</span>
        </div>
      </header>

      <div className="scene-tabs">
        <StatusTabs tabs={tabs} value={filter} onChange={setFilter} />
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
        <Shelf3D
          books={filtered} sort={sort} onOpen={openBook} locked={overlay}
          highlightId={highlightId} focusId={focusId} onFocused={onFocused} emptyText={emptyText}
        />
      )}

      <footer className="footer-bar">
        <div className="lbl footer-copy">© Bibliothèque Levana{isDemoMode ? ' · Mode démo' : ''}</div>
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
            onClosed={onDetailClosed}
            inLibrary={detail.mode === 'add' && isInLibrary(detail.book.googleId)}
            onSave={async updates => { await updateBook(detail.book.id, updates) }}
            onRemove={async () => { await removeBook(detail.book.id); closeDetail() }}
            onAdd={async statuses => {
              const saved = await addBook(detail.book, statuses)
              setFilter('tous')
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
