import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLibrary, STATUSES, bookHasStatus } from './hooks/useLibrary'
import { isDemoMode } from './lib/supabase'
import { toDisplay, sortBooks, SORTS } from './lib/bookUtils'
import Bookcase from './components/Bookcase'
import Caption from './components/Caption'
import StatusTabs from './components/StatusTabs'
import DetailSheet from './components/DetailSheet'
import SearchPanel from './components/SearchPanel'
import LoginPage from './components/LoginPage'
import Cursor from './components/Cursor'

const Scanner = lazy(() => import('./components/Scanner'))

const TITLES = {
  tous: ['Tous les', 'livres'],
  en_cours: ['En cours de', 'lecture'],
  lu: ['Les livres', 'lus'],
  possede: ['Sur les', 'rayons'],
  souhaite: ['La liste', "d'envies"],
}

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())

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
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [detail, setDetail] = useState(null)        // { book, mode, rect }
  const [detailOpen, setDetailOpen] = useState(false)
  const [search, setSearch] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scanner, setScanner] = useState(false)
  const pendingFocus = useRef(null)

  const setSort = v => { setSortState(v); writePref('levana.sort', v) }

  const filtered = useMemo(() => {
    let list = filter === 'tous' ? books : books.filter(b => bookHasStatus(b, filter))
    const q = query.trim().toLowerCase()
    if (q) list = list.filter(b => (b.title || '').toLowerCase().includes(q) || (b.authors || []).some(a => (a || '').toLowerCase().includes(q)))
    return sortBooks(list, sort)
  }, [books, filter, query, sort])

  const tabs = useMemo(() => [
    { id: 'tous', label: 'Tous', count: books.length },
    ...STATUSES.map(s => ({ id: s.id, label: s.label, count: books.filter(b => bookHasStatus(b, s.id)).length })),
  ], [books])

  const stats = useMemo(() => {
    const read = books.filter(b => bookHasStatus(b, 'lu'))
    return [
      { label: 'Livres', value: books.length },
      { label: 'Lus', value: read.length },
      { label: 'En cours', value: books.filter(b => bookHasStatus(b, 'en_cours')).length },
      { label: 'Pages lues', value: read.reduce((s, b) => s + (b.page_count || 0), 0).toLocaleString('fr-FR') },
    ]
  }, [books])

  // En-tête collant : une règle apparaît dès qu'on fait défiler
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Pas de défilement de la page derrière une fiche ou la recherche
  const overlay = !!detail || search || scanner
  useEffect(() => {
    document.documentElement.style.overflow = overlay ? 'hidden' : ''
    return () => { document.documentElement.style.overflow = '' }
  }, [overlay])

  // Après un ajout : faire défiler jusqu'au nouveau livre et le signaler
  useEffect(() => {
    const id = pendingFocus.current
    if (!id || overlay) return
    const el = document.querySelector(`.spine[data-id="${id}"]`)
    if (!el) return
    pendingFocus.current = null
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
    const t = setTimeout(() => setHighlightId(null), 2600)
    return () => clearTimeout(t)
  }, [filtered, overlay])

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

  // L'encart garde le dernier livre survolé pendant qu'il se referme
  const lastHovered = useRef(null)
  if (hovered) lastHovered.current = hovered
  const hd = lastHovered.current ? toDisplay(lastHovered.current) : null
  const caption = hd
    ? { title: hd.title, subtitle: hd.authors.join(', '), year: [hd.year, hd.pageCount ? `${hd.pageCount} pages` : null, 'Cliquer pour ouvrir'].filter(Boolean).join(' / ') }
    : { title: ' ', subtitle: ' ', year: ' ' }

  const [t1, t2] = TITLES[filter]
  const emptyText = query
    ? `Aucun livre ne répond à « ${query} ».`
    : filter === 'tous' ? 'Le premier rayon attend son livre.' : 'Rien sur ce rayon pour le moment.'

  return (
    <>
      <header className={'top-bar grain' + (scrolled ? ' scrolled' : '')}>
        <div className="top-left">
          <button type="button" className="lbl box" onClick={openSearch}>+ Ajouter un livre</button>
        </div>
        <Logo />
        <div className="top-right">
          <span className="lbl count-lbl">{user.email}</span>
          <button type="button" className="lbl box muted" onClick={onSignOut}>Déconnexion</button>
        </div>
      </header>

      <main className="lib">
        <section className="lib-head">
          <div className="lib-head-main">
            <div className="lbl lib-kicker">Catalogue personnel · {MONTH}</div>
            <h1 className="lib-title"><span key={filter}>{t1} <em>{t2}</em></span></h1>
          </div>
          <dl className="lib-stats">
            {stats.map(s => (
              <div key={s.label} className="stat">
                <dt className="lbl">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="lib-controls">
          <StatusTabs tabs={tabs} value={filter} onChange={setFilter} />
          <div className="lib-tools">
            <input
              className="lib-filter" type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Retrouver un livre…" aria-label="Filtrer mes livres" spellCheck="false"
            />
            <label className="lbl lib-sort">
              <span>Ranger par</span>
              <select value={sort} onChange={e => setSort(e.target.value)}>
                {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {loading && !books.length ? (
          <p className="lib-loading lbl">Ouverture des rayons…</p>
        ) : (
          <Bookcase
            key={`${filter}|${sort}`} books={filtered} sort={sort}
            onOpen={openBook} onHover={setHovered} highlightId={highlightId} emptyText={emptyText}
          />
        )}

        {!books.length && !loading && (
          <div className="lib-empty-cta">
            <button type="button" className="lbl box cobalt" onClick={openSearch}>Ajouter un premier livre</button>
          </div>
        )}

        <div className="lib-legend">
          <span className="lbl"><i className="lg-ribbon" /> Ruban : en cours de lecture</span>
          <span className="lbl"><i className="lg-wish" /> Pointillés : souhaité, pas encore sur l'étagère</span>
          <span className="lbl">Initiales : l'auteur</span>
        </div>
      </main>

      <footer className="footer-bar">
        <div className="lbl">© Bibliothèque Levana{isDemoMode ? ' · Mode démo' : ''}</div>
        <div className="lbl">{books.length} {books.length > 1 ? 'volumes' : 'volume'}</div>
      </footer>

      <Caption className={'hover-caption' + (hovered && !overlay ? ' on' : '')} title={caption.title} subtitle={caption.subtitle} year={caption.year} dir={1} />

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
              pendingFocus.current = saved?.id || null
              setFilter('tous')
              setQuery('')
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
      {loading
        ? <div className="loading-screen"><Logo /><span className="lbl">Ouverture de la bibliothèque…</span></div>
        : (user ? <Library user={user} onSignOut={signOut} /> : <LoginPage onSignIn={signInWithGoogle} />)}
      <Cursor />
    </>
  )
}
