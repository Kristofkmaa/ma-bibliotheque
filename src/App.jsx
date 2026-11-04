import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLibrary, STATUSES, bookHasStatus } from './hooks/useLibrary'
import { isDemoMode } from './lib/supabase'
import { toDisplay } from './lib/bookUtils'
import Shelf from './components/Shelf'
import Caption from './components/Caption'
import StatusTabs from './components/StatusTabs'
import DetailSheet from './components/DetailSheet'
import SearchPanel from './components/SearchPanel'
import LoginPage from './components/LoginPage'
import Cursor from './components/Cursor'

const Scanner = lazy(() => import('./components/Scanner'))

const ArrowLeft = () => (
  <svg viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M5 1 L1 5 L5 9 M1 5 L17 5" /></svg>
)
const ArrowRight = () => (
  <svg viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M13 1 L17 5 L13 9 M17 5 L1 5" /></svg>
)

function Logo({ sub = 'Bibliothèque' }) {
  return (
    <div className="logo">
      <div className="logo-name">Levana</div>
      <div className="logo-sub">{sub}</div>
    </div>
  )
}

function Library({ user, onSignOut }) {
  const { books, addBook, updateBook, removeBook, isInLibrary } = useLibrary(user.id)
  const [filter, setFilter] = useState('tous')
  const [active, setActive] = useState({ index: 0, dir: 1 })
  const [detail, setDetail] = useState(null)        // { book, mode, rect }
  const [detailOpen, setDetailOpen] = useState(false)
  const [search, setSearch] = useState(false)       // monté
  const [searchOpen, setSearchOpen] = useState(false)
  const [scanner, setScanner] = useState(false)
  const shelfRef = useRef(null)
  const pendingFocus = useRef(null)

  const filtered = useMemo(
    () => (filter === 'tous' ? books : books.filter(b => bookHasStatus(b, filter))),
    [books, filter]
  )

  const tabs = useMemo(() => [
    { id: 'tous', label: 'Tous', count: books.length },
    ...STATUSES.map(s => ({ id: s.id, label: s.label, count: books.filter(b => bookHasStatus(b, s.id)).length })),
  ], [books])

  // Après un ajout, amener le nouveau livre au centre
  useEffect(() => {
    if (!pendingFocus.current) return
    const idx = filtered.findIndex(b => b.id === pendingFocus.current || b.google_id === pendingFocus.current)
    if (idx >= 0) { pendingFocus.current = null; setTimeout(() => shelfRef.current?.goTo(idx), 50) }
  }, [filtered])

  const onActiveChange = useCallback((index, dir) => setActive({ index, dir }), [])

  const openActive = useCallback(() => {
    const idx = shelfRef.current?.getActiveBookIndex() ?? -1
    const book = filtered[idx]
    if (!book) return
    setDetail({ book, mode: 'edit', rect: shelfRef.current.getActiveCoverRect() })
    setDetailOpen(true)
  }, [filtered])

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

  // Échap : ferme la couche la plus haute
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

  const locked = detailOpen || searchOpen || scanner || !!detail || search

  const current = toDisplay(filtered[active.index] || filtered[0])
  const caption = current
    ? { title: current.title, subtitle: current.authors.join(', '), year: [current.year, current.categories[0]].filter(Boolean).join(' / ') || '—' }
    : { title: filter === 'tous' ? 'Ton étagère est vide' : 'Rien ici pour le moment', subtitle: 'Ajoute un livre avec le bouton en haut à gauche', year: '' }

  return (
    <>
      <header className="top-bar">
        <div className="top-left">
          <button type="button" className="lbl box" onClick={openSearch}>+ Ajouter un livre</button>
        </div>
        <Logo />
        <div className="top-right">
          <span className="lbl count-lbl">Collection · {books.length} {books.length > 1 ? 'livres' : 'livre'}</span>
        </div>
      </header>

      <StatusTabs tabs={tabs} value={filter} onChange={setFilter} />

      {filtered.length > 0 ? (
        <Shelf ref={shelfRef} books={filtered} onActiveChange={onActiveChange} onOpen={openActive} locked={locked} />
      ) : (
        <div className="empty-shelf">
          <div className="ghosts" aria-hidden="true">
            {[72, 58, 84, 64, 90, 56, 78, 66, 88, 60].map((h, i) => <div key={i} className="ghost" style={{ height: `${h}%` }} />)}
          </div>
          <h2>{caption.title}</h2>
          <p>{filter === 'tous' ? 'Cherche un titre, scanne un code-barres, et les livres viendront se ranger ici.' : 'Change de rayon, ou ajoute un livre avec ce statut.'}</p>
          {filter === 'tous' && <button type="button" className="lbl box cobalt" onClick={openSearch}>Ajouter un premier livre</button>}
        </div>
      )}

      {filtered.length > 0 && (
        <>
          <button type="button" className="nav-arrow prev" aria-label="Livre précédent" onClick={() => shelfRef.current?.prev()}><ArrowLeft /></button>
          <button type="button" className="nav-arrow next" aria-label="Livre suivant" onClick={() => shelfRef.current?.next()}><ArrowRight /></button>
          <Caption title={caption.title} subtitle={caption.subtitle} year={caption.year} dir={active.dir} />
        </>
      )}

      <footer className="footer-bar">
        <div className="lbl footer-copy">© Bibliothèque Levana{isDemoMode ? ' · Mode démo' : ''}</div>
        <div className="lbl footer-links">
          <span style={{ color: 'var(--muted)' }}>{user.email}</span>
          <span>/</span>
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
              pendingFocus.current = saved?.id || detail.book.googleId
              setFilter('tous')
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
    </>
  )
}

export default function App() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()

  return (
    <>
      {!loading && (user ? <Library user={user} onSignOut={signOut} /> : <LoginPage onSignIn={signInWithGoogle} />)}
      <div className="paper-grain" aria-hidden="true" />
      <Cursor />
    </>
  )
}
