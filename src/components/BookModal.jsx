import { useState } from 'react'
import { motion } from 'framer-motion'
import { IconX, IconTrash, IconSave, IconCheck, IconHome, IconPlay, IconHeart, IconList } from './Icons'
import { useIsMobile } from '../hooks/useIsMobile'

import { IconThumbDown, IconThumbUp, IconSparkle } from './Icons'

// prefere géré via le bouton Favoris dans l'onglet Notes
const STATUS_OPTIONS = [
  { value: 'en_cours', label: 'En cours', Icon: IconPlay,  color: '#a78bfa' },
  { value: 'possede',  label: 'Possédé',  Icon: IconHome,  color: '#818cf8' },
  { value: 'souhaite', label: 'WishList', Icon: IconList,  color: '#fb923c' },
  { value: 'lu',       label: 'Déjà lu',  Icon: IconCheck, color: '#4ade80' },
]

// ── Notation j'aime / j'aime pas / j'adore ───────────────────────────────────
// rating: 1 = j'aime pas, 3 = j'aime, 5 = j'adore, null = non noté
const REACTIONS = [
  { value: 1, Icon: IconThumbDown, label: "J'aime pas", color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  { value: 3, Icon: IconThumbUp,   label: "J'aime",     color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' },
  { value: 5, Icon: IconSparkle,   label: "J'adore",    color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
]

function ReactionRating({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {REACTIONS.map(r => {
        const active = value === r.value
        return (
          <button
            key={r.value}
            onClick={() => onChange(active ? null : r.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px', borderRadius: '12px',
              border: '1px solid ' + (active ? r.border : 'rgba(255,255,255,0.1)'),
              background: active ? r.bg : 'rgba(255,255,255,0.03)',
              color: active ? r.color : 'rgba(237,233,248,0.4)',
              cursor: 'pointer', fontSize: '13px', fontWeight: active ? 600 : 400,
              transition: 'all 0.18s',
              transform: active ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <r.Icon size={18} color={active ? r.color : 'rgba(237,233,248,0.4)'} />
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Marketplace ───────────────────────────────────────────────────────────────
function MarketplaceSection({ book }) {
  const isbn  = book.isbn || ''
  const query = encodeURIComponent(`${book.title} ${(book.authors || [])[0] || ''}`.trim())

  const stores = [
    {
      name: 'Amazon.fr', color: '#FF9900', bg: 'rgba(255,153,0,0.08)', border: 'rgba(255,153,0,0.25)',
      url: isbn ? `https://www.amazon.fr/s?k=${isbn}` : `https://www.amazon.fr/s?k=${query}`,
      description: 'Neuf · Occasion · eBook Kindle',
      logo: <svg width="22" height="22" viewBox="0 0 48 48" fill="none"><text y="36" fontSize="36" fontWeight="800" fill="#FF9900">a</text><path d="M8 38c8 4 24 5 32 0" stroke="#FF9900" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>,
    },
    {
      name: 'Google Play Livres', color: '#4285F4', bg: 'rgba(66,133,244,0.08)', border: 'rgba(66,133,244,0.25)',
      url: book.buyLink || `https://play.google.com/store/search?q=${query}&c=books`,
      description: 'eBook · Lecture dans le navigateur',
      logo: <svg width="22" height="22" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#4285F4"/><text x="10" y="33" fontSize="22" fontWeight="900" fill="#fff" fontFamily="Arial">G</text></svg>,
    },
  ]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {book.price && (
        <div style={{ padding: '14px 18px', background: 'rgba(129,110,187,0.07)', border: '1px solid rgba(129,110,187,0.18)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(237,233,248,0.55)', fontSize: '13px' }}>Prix Google Books</span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 700, color: '#816EBB' }}>
            {book.price.amount.toFixed(2)} {book.price.currency === 'EUR' ? '€' : book.price.currency}
          </span>
        </div>
      )}
      {isbn && <p style={{ fontSize: '11px', color: 'rgba(237,233,248,0.2)', margin: 0, textAlign: 'center' }}>ISBN : {isbn}</p>}
      {stores.map(store => (
        <a
          key={store.name} href={store.url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', background: store.bg, border: `1px solid ${store.border}`, borderRadius: '12px', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = store.bg.replace('0.08', '0.15'); e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = store.bg; e.currentTarget.style.transform = 'none' }}
        >
          <div style={{ flexShrink: 0 }}>{store.logo}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: store.color, marginBottom: '3px' }}>{store.name}</div>
            <div style={{ fontSize: '12px', color: 'rgba(237,233,248,0.4)' }}>{store.description}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(237,233,248,0.2)" strokeWidth="2" strokeLinecap="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
        </a>
      ))}
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function BookModal({ book, onClose, onSave, onRemove, isInLibrary }) {
  const initStatuses = () => {
    if (book.statuses?.length) return book.statuses
    if (book.status) return [book.status]
    return ['souhaite']
  }
  const [statuses,   setStatuses]  = useState(initStatuses)
  const [rating,     setRating]    = useState(book.rating || 0)
  const [notes,      setNotes]     = useState(book.notes || '')
  const [saving,     setSaving]    = useState(false)
  const [activeTab,  setActiveTab] = useState('couverture')
  const isMobile = useIsMobile()

  const cover    = book.cover || book.cover_url
  const synopsis = book.description || ''

  const toggleStatus = (val) => {
    setStatuses(prev =>
      prev.includes(val)
        ? prev.length > 1 ? prev.filter(s => s !== val) : prev  // au moins 1 requis
        : [...prev, val]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try { await onSave({ statuses, rating: rating > 0 ? rating : null, notes }) }
    finally { setSaving(false) }
  }

  const TABS = [
    { id: 'couverture', label: 'Couverture' },
    { id: 'synopsis',   label: 'Synopsis'   },
    { id: 'acheter',    label: 'Acheter'    },
    { id: 'notes',      label: 'Mes notes'  },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
        zIndex: 1000, display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : '20px',
      }}
    >
      <motion.div
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.93, y: 24 }}
        animate={isMobile ? { y: 0 }      : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobile    ? { y: '100%' } : { opacity: 0, scale: 0.93 }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(150deg, #0E0B1A 0%, #130F22 50%, #0E0B1A 100%)',
          border: '1px solid rgba(129,110,187,0.18)',
          borderRadius: isMobile ? '16px 16px 0 0' : '18px',
          width: '100%', maxWidth: isMobile ? '100%' : '680px',
          maxHeight: isMobile ? '95dvh' : '92vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Poignée mobile */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(129,110,187,0.25)' }} />
          </div>
        )}
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? '12px' : '18px', padding: isMobile ? '14px 16px' : '22px 24px', borderBottom: '1px solid rgba(129,110,187,0.1)', background: 'rgba(129,110,187,0.03)', flexShrink: 0 }}>
          <div style={{ width: isMobile ? 60 : 80, height: isMobile ? 88 : 118, flexShrink: 0, borderRadius: '5px', overflow: 'hidden', boxShadow: '-3px 3px 14px rgba(0,0,0,0.6)' }}>
            {cover
              ? <img src={cover} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2D1B69, #1A0F3A)' }} />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 700, color: '#EDE9F8', margin: '0 0 5px', lineHeight: 1.3 }}>
              {book.title}
            </h2>
            <p style={{ color: 'rgba(237,233,248,0.55)', margin: '0 0 10px', fontSize: '14px' }}>
              {(book.authors || []).join(', ')}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {book.publishedDate && (
                <span style={{ fontSize: '12px', padding: '2px 9px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', color: 'rgba(237,233,248,0.45)' }}>
                  {book.publishedDate?.slice(0, 4)}
                </span>
              )}
              {(book.pageCount || book.page_count) && (
                <span style={{ fontSize: '12px', padding: '2px 9px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', color: 'rgba(237,233,248,0.45)' }}>
                  {book.pageCount || book.page_count} pages
                </span>
              )}
              {(book.categories || [])[0] && (
                <span style={{ fontSize: '12px', padding: '2px 9px', background: 'rgba(101,87,160,0.25)', borderRadius: '4px', color: '#a78bfa' }}>
                  {book.categories[0]}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px', width: 32, height: 32, color: 'rgba(237,233,248,0.5)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          ><IconX size={14} /></button>
        </div>

        {/* ── Onglets ── */}
        <div style={{ display: 'flex', padding: isMobile ? '0 12px' : '0 24px', borderBottom: '1px solid rgba(129,110,187,0.1)', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', flexShrink: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #816EBB' : '2px solid transparent',
                color: activeTab === tab.id ? '#816EBB' : 'rgba(237,233,248,0.35)',
                padding: isMobile ? '10px 14px' : '12px 18px',
                cursor: 'pointer', fontSize: isMobile ? '12px' : '13px',
                fontWeight: activeTab === tab.id ? 600 : 400, transition: 'all 0.2s',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* ── Contenu ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '28px 24px' }}>

          {/* Couverture */}
          {activeTab === 'couverture' && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 0' }}>
              {cover ? (
                <div style={{
                  borderRadius: '8px 14px 14px 8px', overflow: 'hidden',
                  boxShadow: '-10px 16px 50px rgba(0,0,0,0.8), 4px 0 18px rgba(0,0,0,0.4)',
                }}>
                  <img
                    src={cover} alt={book.title}
                    style={{ display: 'block', maxHeight: '70vh', width: 'auto', maxWidth: '100%', minHeight: '300px' }}
                  />
                </div>
              ) : (
                <div style={{
                  width: 260, height: 380,
                  borderRadius: '8px 14px 14px 8px',
                  background: 'linear-gradient(145deg, #2D1B69, #1A0F3A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
                  boxShadow: '-10px 16px 50px rgba(0,0,0,0.8)',
                }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", color: '#D4C8FF', fontSize: '20px', fontWeight: 700, textAlign: 'center', lineHeight: 1.4 }}>
                    {book.title}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Synopsis */}
          {activeTab === 'synopsis' && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              {synopsis ? (
                <p style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '14.5px', lineHeight: 1.9,
                  color: 'rgba(237,233,248,0.82)',
                  margin: 0, whiteSpace: 'pre-line',
                }}>
                  {synopsis}
                </p>
              ) : (
                <p style={{ color: 'rgba(237,233,248,0.25)', fontSize: '14px', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
                  Aucun synopsis disponible pour ce livre.
                </p>
              )}
            </div>
          )}

          {/* Acheter */}
          {activeTab === 'acheter' && <MarketplaceSection book={book} />}

          {/* Notes */}
          {activeTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '500px', margin: '0 auto' }}>

              {/* Reaction */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(237,233,248,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '12px' }}>Mon avis</label>
                <ReactionRating value={rating} onChange={setRating} />
              </div>

              {/* Favoris */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(237,233,248,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '12px' }}>Favoris</label>
                <button
                  onClick={() => {
                    const isFav = statuses.includes('prefere')
                    setStatuses(isFav
                      ? statuses.filter(s => s !== 'prefere')
                      : [...statuses.filter(s => s !== 'prefere'), 'prefere']
                    )
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '11px 20px', borderRadius: '12px',
                    border: '1px solid ' + (statuses.includes('prefere') ? 'rgba(244,114,182,0.5)' : 'rgba(255,255,255,0.1)'),
                    background: statuses.includes('prefere') ? 'rgba(244,114,182,0.15)' : 'rgba(255,255,255,0.03)',
                    color: statuses.includes('prefere') ? '#f472b6' : 'rgba(237,233,248,0.4)',
                    cursor: 'pointer', fontSize: '14px', fontWeight: statuses.includes('prefere') ? 600 : 400,
                    transition: 'all 0.18s',
                    transform: statuses.includes('prefere') ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  <IconHeart size={20} filled={statuses.includes('prefere')} color={statuses.includes('prefere') ? '#f472b6' : 'rgba(237,233,248,0.4)'} />
                  {statuses.includes('prefere') ? 'Dans mes favoris' : 'Ajouter aux favoris'}
                </button>
              </div>

              {/* Notes texte */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(237,233,248,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '10px' }}>Notes personnelles</label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Impressions, citations, anecdotes…" rows={5}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(129,110,187,0.18)', borderRadius: '10px', padding: '14px', color: '#EDE9F8', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, outline: 'none' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: isMobile ? '12px 16px' : '16px 24px', borderTop: '1px solid rgba(129,110,187,0.1)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '10px' : '10px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '6px', flex: 1, flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map(({ value, label, Icon, color }) => {
              const active = statuses.includes(value)
              return (
                <button
                  key={value} onClick={() => toggleStatus(value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '20px',
                    border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
                    background: active ? `${color}22` : 'transparent',
                    color: active ? color : 'rgba(237,233,248,0.35)',
                    fontSize: '12px', cursor: 'pointer', transition: 'all 0.18s',
                    fontWeight: active ? 600 : 400,
                    boxShadow: active ? `0 0 8px ${color}33` : 'none',
                  }}
                >
                  {/* Petite coche si actif */}
                  {active
                    ? <IconCheck size={11} color={color} />
                    : <Icon size={11} color="rgba(237,233,248,0.3)" />
                  }
                  {label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
            {isInLibrary && onRemove && (
              <button
                onClick={onRemove}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(200,50,50,0.1)', border: '1px solid rgba(200,50,50,0.2)', color: '#f87171', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', flex: isMobile ? 1 : 'none' }}
              >
                <IconTrash size={14} color="#f87171" /> Retirer
              </button>
            )}
            <button
              onClick={handleSave} disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                background: saving ? 'rgba(101,87,160,0.3)' : 'linear-gradient(135deg, #6557A0, #816EBB)',
                border: 'none', borderRadius: '8px', padding: '8px 20px',
                color: '#fff', fontSize: '13px', fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: saving ? 'none' : '0 4px 14px rgba(101,87,160,0.4)',
                transition: 'all 0.2s',
                flex: isMobile ? 2 : 'none',
              }}
            >
              <IconSave size={14} color="#fff" />
              {saving ? 'Sauvegarde…' : isInLibrary ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
