import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './hooks/useAuth'
import { useLibrary } from './hooks/useLibrary'
import { useCommunity } from './hooks/useCommunity'
import { useProfile } from './hooks/useProfile'
import { useIsMobile } from './hooks/useIsMobile'
import NavBar, { STATUS_NAV } from './components/NavBar'
import Bookshelf from './components/Bookshelf'
import BookModal from './components/BookModal'
import SearchBar from './components/SearchBar'
import Scanner from './components/Scanner'
import YearProgress from './components/YearProgress'
import AIRecommendations from './components/AIRecommendations'
import CommunityPage from './components/CommunityPage'
import AccountPage from './components/AccountPage'
import GenresPage from './components/GenresPage'
import LoginPage from './components/LoginPage'
import NotificationBell from './components/NotificationBell'
import { IconBook } from './components/Icons'
import { BibliSyIcon, BibliSyLogoHorizontal } from './components/BibliSyLogo'
import './index.css'

// ── Vue Genres ─────────────────────────────────────────────────────────────────
function GenresView({ books, onBookSelect, isMobile }) {
  const genreMap = {}
  books.forEach(book => {
    // Utilise categories (champ reel) et filtre les generiques
    const cats = book.categories?.length ? book.categories : []
    const genres = cats.filter(g => g && g.length > 2)
    const list = genres.length > 0 ? genres : ['Sans categorie']
    list.forEach(g => {
      if (!genreMap[g]) genreMap[g] = []
      if (!genreMap[g].find(b => b.id === book.id)) genreMap[g].push(book)
    })
  })
  const sorted = Object.entries(genreMap)
    .filter(([g]) => g !== 'Sans categorie')
    .sort((a, b) => b[1].length - a[1].length)

  const BOOK_W = isMobile ? 68 : 90
  const BOOK_H = Math.round(BOOK_W * 1.52)

  if (sorted.length === 0) return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📚</div>
      <p style={{ color: 'rgba(237,233,248,0.3)', fontSize: '14px', margin: 0 }}>
        Aucun genre trouve — assure-toi que tes livres ont des categories
      </p>
    </div>
  )

  return (
    <div style={{ paddingBottom: '40px' }}>
      {sorted.map(([genre, gbooks], idx) => {
        const hue = [192, 168, 144, 120, 216, 200][idx % 6]
        const color = `hsl(${hue}, 60%, 70%)`
        return (
          <div key={genre} style={{ marginBottom: '8px' }}>
            {/* Label section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: isMobile ? '14px 16px 10px' : '16px 28px 10px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}88` }} />
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'rgba(237,233,248,0.92)' }}>{genre}</span>
              <span style={{ fontSize: '11px', color: 'rgba(237,233,248,0.28)' }}>{gbooks.length} livre{gbooks.length > 1 ? 's' : ''}</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(129,110,187,0.08)' }} />
            </div>

            {/* Livres en scroll horizontal */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(129,110,187,0.06)', borderBottom: '1px solid rgba(129,110,187,0.04)', padding: isMobile ? '14px 16px' : '16px 28px' }}>
              <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', alignItems: 'flex-end', paddingBottom: '4px' }}>
                {gbooks.map(book => {
                  const cover = book.cover || book.cover_url
                  const title = book.title || 'Sans titre'
                  return (
                    <div key={book.id} onClick={() => onBookSelect(book)}
                      style={{ flexShrink: 0, width: BOOK_W, height: BOOK_H, cursor: 'pointer', transition: 'transform 0.16s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-8px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                    >
                      <div style={{ width: '100%', height: '100%', borderRadius: '3px 7px 7px 3px', overflow: 'hidden', background: 'linear-gradient(145deg, #2D1B69, #1A0F3A)', boxShadow: `-3px 6px 18px rgba(0,0,0,0.7)`, borderBottom: `3px solid ${color}` }}>
                        {cover
                          ? <img src={cover} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
                              <span style={{ fontFamily: "'Playfair Display', serif", color: '#D4C8FF', fontSize: '9px', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>{title}</span>
                            </div>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
// ──────────────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const { books, loading: booksLoading, addBook, updateBook, removeBook, isInLibrary } = useLibrary(user?.id)
  const {
    feed, following, followingProfiles, followers, newFollowers, loading: communityLoading,
    follow, unfollow, isFollowing, searchUsers, logActivity, markNotificationsSeen, refresh: refreshFeed,
  } = useCommunity(user?.id)
  const isMobile = useIsMobile()
  const { profile: myProfile } = useProfile(user?.id)

  const [selectedBook,     setSelectedBook]     = useState(null)
  const [showScanner,      setShowScanner]      = useState(false)
  const [filter,           setFilter]           = useState('all')
  const [activeView,       setActiveView]       = useState('library')
  const [loginLoading,     setLoginLoading]     = useState(false)
  const [toast,            setToast]            = useState(null)
  const [communityProfile, setCommunityProfile] = useState(null) // profil à afficher dans community

  // ── Gestion du swipe retour arrière mobile ──────────────────────────────────
  // On stocke l'état courant dans un ref pour éviter les stale closures
  const navStateRef = useRef(null)
  useEffect(() => {
    navStateRef.current = { selectedBook, activeView, filter, showScanner }
  }, [selectedBook, activeView, filter, showScanner])

  useEffect(() => {
    // Pousse un état "sentinelle" dès le départ — sans lui, la première navigation
    // arrière quitterait l'app directement
    history.pushState({ app: true }, '')

    const onPopState = () => {
      const s = navStateRef.current || {}
      // Repousse immédiatement un état pour rester sur la page
      history.pushState({ app: true }, '')
      // Priorité : scanner > modale livre > vue secondaire > filtre actif
      if (s.showScanner)              { setShowScanner(false);                       return }
      if (s.selectedBook)             { setSelectedBook(null);                       return }
      if (s.activeView !== 'library') { setActiveView('library'); setFilter('all'); return }
      if (s.filter !== 'all')         { setFilter('all');                            return }
      // Déjà à la racine → on ne fait rien (évite de quitter l'app)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // une seule fois au montage
  // ────────────────────────────────────────────────────────────────────────────

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleLogin = async () => {
    setLoginLoading(true)
    try { await signInWithGoogle() }
    catch { showToast('Erreur de connexion', 'error') }
    finally { setLoginLoading(false) }
  }

  const handleBookSelect = (book) => {
    const existing = books.find(b => b.google_id === (book.googleId || book.google_id))
    setSelectedBook(existing ? { ...book, ...existing, cover: book.cover || existing.cover_url } : book)
  }

  const handleSaveBook = async ({ statuses, rating, notes }) => {
    try {
      const bookId = selectedBook?.id
      if (bookId) {
        await updateBook(bookId, { statuses, rating, notes })
        showToast('Mis a jour')
        // Log activite : notation
        if (rating) logActivity({ action: 'rated', book: selectedBook, rating, notes })
        // Log favoris
        if (statuses.includes('prefere')) logActivity({ action: 'favorited', book: selectedBook })
        // Log lu
        if (statuses.includes('lu')) logActivity({ action: 'read', book: selectedBook })
        // Log en cours
        if (statuses.includes('en_cours')) logActivity({ action: 'en_cours', book: selectedBook })
      } else {
        await addBook(selectedBook, statuses)
        showToast('Ajoute a ta bibliotheque')
        logActivity({ action: 'added', book: selectedBook })
      }
      setSelectedBook(null)
    } catch (e) {
      showToast(e.message || 'Erreur lors de la sauvegarde', 'error')
    }
  }

  const handleRemoveBook = async () => {
    if (!selectedBook?.id) return
    try {
      await removeBook(selectedBook.id)
      showToast('Livre retire')
      setSelectedBook(null)
    } catch (e) {
      showToast('Erreur lors de la suppression', 'error')
    }
  }

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter)
    setActiveView('library')
  }

  const goBack = () => {
    setFilter('all')
  }

  const hasStatus = (book, status) => {
    const s = book.statuses?.length ? book.statuses : [book.status]
    return s.includes(status)
  }

  const filteredBooks = useMemo(() => {
    if (filter === 'all') return books
    return books.filter(b => hasStatus(b, filter))
  }, [books, filter])

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', background: '#0C0A15' }}>
      <BibliSyIcon size={64} light={true} />
      <div style={{ width: 24, height: 24, border: '2px solid rgba(155,127,212,0.2)', borderTopColor: '#9B7FD4', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!user) return <LoginPage onLogin={handleLogin} loading={loginLoading} />

  const currentStatusLabel = STATUS_NAV.find(s => s.id === filter)?.label
  const viewTitle = activeView === 'progress' ? null
    : activeView === 'ai' ? 'Suggestions IA'
    : activeView === 'genres' ? 'Genres'
    : activeView === 'community' ? 'Communauté'
    : activeView === 'account' ? null
    : filter !== 'all' ? currentStatusLabel || 'Biblisy'
    : null // null = on affiche le logo

  const GOLD = '#816EBB'

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>

      <NavBar
        user={user}
        books={books}
        activeView={activeView}
        notifCount={newFollowers?.length || 0}
        onViewChange={(view) => {
          setActiveView(view)
          if (view === 'library') setFilter('all')
        }}
        onScannerOpen={() => setShowScanner(true)}
        onSignOut={signOut}
      />

      <div style={{ marginLeft: isMobile ? 0 : '220px', minHeight: '100vh', paddingBottom: isMobile ? '80px' : '40px' }}>

        {/* Header mobile — masqué pour profil et progression (ont leur propre header) */}
        {isMobile && activeView !== 'account' && activeView !== 'progress' && (
          <header style={{
            position: 'sticky', top: 0, zIndex: 100,
            background: 'linear-gradient(180deg, rgba(12,10,21,0.98) 0%, rgba(12,10,21,0.9) 100%)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(129,110,187,0.1)',
            padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              {activeView === 'library' && filter !== 'all' && (
                <button onClick={goBack} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: GOLD, fontSize: '18px', padding: '0 4px 0 0', lineHeight: 1, flexShrink: 0,
                }}>&#8592;</button>
              )}
              <>
                <BibliSyIcon size={26} light={true} />
                <h1 style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif", fontSize: '1rem', fontWeight: 700, color: '#EDE9F8', margin: 0, flex: 1 }}>
                  {viewTitle ?? 'Bibliothèque'}
                </h1>
              </>
              <NotificationBell
                newFollowers={newFollowers}
                allFollowers={followers}
                markNotificationsSeen={markNotificationsSeen}
                onViewProfile={(profile) => { setActiveView('community'); setCommunityProfile(profile) }}
              />
              {/* Avatar → compte + badge % lus */}
              <button
                onClick={() => setActiveView('account')}
                style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
              >
                {(myProfile?.avatar_url || user.user_metadata?.avatar_url)
                  ? <img src={myProfile?.avatar_url || user.user_metadata?.avatar_url} alt="Avatar" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(129,110,187,0.35)', display: 'block' }} />
                  : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(129,110,187,0.2)', border: '2px solid rgba(129,110,187,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 13, color: GOLD, fontWeight: 700 }}>
                        {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                      </span>
                    </div>
                }
                {/* Badge % livres lus */}
                {books.length > 0 && (
                  <div style={{
                    position: 'absolute', bottom: -4, right: -8,
                    background: 'linear-gradient(135deg, #6557A0, #816EBB)',
                    color: '#fff', fontSize: 8, fontWeight: 700,
                    borderRadius: 8, padding: '2px 5px',
                    border: '1.5px solid #0C0A15',
                    lineHeight: 1.3, whiteSpace: 'nowrap',
                  }}>
                    {Math.round(books.filter(b => (b.statuses?.length ? b.statuses : [b.status]).includes('lu')).length / books.length * 100)}%
                  </div>
                )}
              </button>
            </div>
            <SearchBar onBookSelect={handleBookSelect} />
          </header>
        )}

        {/* Cloche desktop — fixe en haut à droite */}
        {!isMobile && (
          <div style={{ position: 'fixed', top: 14, right: 20, zIndex: 500 }}>
            <NotificationBell
              newFollowers={newFollowers}
              allFollowers={followers}
              markNotificationsSeen={markNotificationsSeen}
              onViewProfile={(profile) => { setActiveView('community'); setCommunityProfile(profile) }}
            />
          </div>
        )}

        {/* Desktop header */}
        {!isMobile && activeView === 'library' && (
          <div style={{ padding: '22px 28px 0', display: 'flex', alignItems: 'center', gap: '14px' }}>
            {filter !== 'all' && (
              <button onClick={goBack} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(129,110,187,0.08)', border: '1px solid rgba(129,110,187,0.2)',
                borderRadius: '8px', padding: '6px 12px',
                color: GOLD, cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                flexShrink: 0, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,110,187,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,110,187,0.08)' }}
              >
                &#8592; Retour
              </button>
            )}
            <div style={{ flex: 1, maxWidth: 440 }}>
              <SearchBar onBookSelect={handleBookSelect} />
            </div>
            <span style={{ color: 'rgba(237,233,248,0.2)', fontSize: '13px', flexShrink: 0 }}>
              {filteredBooks.length} livre{filteredBooks.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Vue bibliotheque */}
        {activeView === 'library' && (
          <main style={{ paddingTop: isMobile ? '12px' : '20px' }}>
            {booksLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <BibliSyIcon size={48} light={true} />
                <div style={{ width: 20, height: 20, border: '2px solid rgba(129,110,187,0.2)', borderTopColor: '#816EBB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <Bookshelf books={books} onBookClick={handleBookSelect} filter={filter} onFilterChange={handleFilterChange} isMobile={isMobile} />
            )}
          </main>
        )}

        {/* Progression */}
        {activeView === 'progress' && (
          <YearProgress
            books={books}
            onBookSelect={handleBookSelect}
            onBack={() => setActiveView('account')}
          />
        )}

        {/* Genres */}
        {activeView === 'genres' && (
          <GenresPage books={books} onBookSelect={handleBookSelect} isMobile={isMobile} />
        )}

        {/* Suggestions IA */}
        {activeView === 'ai' && (
          <div style={{ padding: isMobile ? '16px 14px' : '24px 28px' }}>
            <AIRecommendations books={books} />
          </div>
        )}

        {/* Communauté */}
        {activeView === 'community' && (
          <CommunityPage
            userId={user?.id}
            feed={feed}
            following={following}
            loading={communityLoading}
            follow={follow}
            unfollow={unfollow}
            isFollowing={isFollowing}
            searchUsers={searchUsers}
            initialProfile={communityProfile}
            onProfileConsumed={() => setCommunityProfile(null)}
          />
        )}

        {/* Mon compte */}
        {activeView === 'account' && (
          <AccountPage
            user={user}
            books={books}
            followers={followers}
            followingProfiles={followingProfiles}
            follow={follow}
            unfollow={unfollow}
            isFollowing={isFollowing}
            onViewProfile={(profile) => { setActiveView('community'); setCommunityProfile(profile) }}
            onSignOut={signOut}
            onProgressClick={() => setActiveView('progress')}
          />
        )}

      </div>

      {/* Modale livre */}
      <AnimatePresence>
        {selectedBook && (
          <BookModal
            book={selectedBook}
            isInLibrary={isInLibrary(selectedBook?.googleId || selectedBook?.google_id)}
            onClose={() => setSelectedBook(null)}
            onSave={handleSaveBook}
            onRemove={handleRemoveBook}
          />
        )}
      </AnimatePresence>

      {/* Scanner */}
      <AnimatePresence>
        {showScanner && (
          <Scanner
            onBookFound={handleBookSelect}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{
              position: 'fixed',
              bottom: isMobile ? '76px' : '24px',
              left: '50%', transform: 'translateX(-50%)',
              background: toast.type === 'error' ? 'rgba(200,50,50,0.95)' : 'rgba(101,87,160,0.95)',
              color: '#fff', padding: '10px 20px',
              borderRadius: '24px', fontSize: '13px', fontWeight: 600,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 9999, backdropFilter: 'blur(12px)',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}