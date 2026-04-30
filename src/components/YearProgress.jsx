import { useState, useMemo } from 'react'
import { IconChevronRight, IconTarget, IconBookOpen, IconClock, IconStar, IconFlame, IconCalendar, IconMask, IconBarChart, IconBook, IconPencil, IconArrowLeft, IconArrowUp } from './Icons'

const CURRENT_YEAR  = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() // 0-11

const MONTH_LABELS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc']
const MONTH_FULL   = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function useLocalGoal(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v !== null ? Number(v) : defaultValue }
    catch { return defaultValue }
  })
  const set = (v) => { setValue(v); try { localStorage.setItem(key, String(v)) } catch {} }
  return [value, set]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(raw) {
  if (!raw) return ''
  const d = new Date(raw)
  return `${d.getDate()} ${MONTH_FULL[d.getMonth()].slice(0, 3).toLowerCase()}`
}

function StarRow({ rating, size = 12 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: size, color: i <= Math.round(rating) ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}>★</span>
      ))}
    </div>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data, 1)
  const BAR_MAX = 60
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
      {data.map((val, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 8, color: val > 0 ? 'rgba(237,233,248,0.6)' : 'transparent', lineHeight: 1, minHeight: 10 }}>{val || ''}</span>
          <div style={{
            width: '100%',
            height: val ? Math.max(6, Math.round((val / max) * BAR_MAX)) : 3,
            background: val ? 'rgba(129,110,187,0.8)' : 'rgba(255,255,255,0.06)',
            borderRadius: '3px 3px 3px 3px',
          }} />
          <span style={{ fontSize: 7, color: 'rgba(237,233,248,0.25)', whiteSpace: 'nowrap' }}>{MONTH_LABELS[i]}</span>
        </div>
      ))}
    </div>
  )
}

// ── Donut chart genres ────────────────────────────────────────────────────────
const GENRE_COLORS = ['#816EBB','#ef4444','#f97316','#22c55e','#eab308','#a78bfa','#6366f1','#ec4899']

function DonutChart({ segments }) {
  if (!segments.length) return null
  let cumulative = 0
  const parts = segments.map(({ pct, color }) => {
    const from = cumulative
    cumulative += pct * 100
    return `${color} ${from.toFixed(1)}% ${cumulative.toFixed(1)}%`
  })
  return (
    <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
      <div style={{
        width: 90, height: 90, borderRadius: '50%',
        background: `conic-gradient(${parts.join(', ')})`,
        WebkitMask: 'radial-gradient(transparent 26px, black 26px)',
        mask: 'radial-gradient(transparent 26px, black 26px)',
      }} />
    </div>
  )
}

// ── Mini couverture ───────────────────────────────────────────────────────────
function MiniBook({ book, onClick }) {
  const cover = book.cover || book.cover_url
  const title = book.title || '?'
  const rating = book.rating || 0
  const dateStr = formatDate(book.updated_at || book.created_at)

  return (
    <div
      onClick={() => onClick?.(book)}
      style={{ flexShrink: 0, width: 90, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{
        width: 90, height: 130,
        borderRadius: '4px 8px 8px 4px', overflow: 'hidden',
        boxShadow: '-3px 5px 16px rgba(0,0,0,0.6)',
        background: 'linear-gradient(145deg, #2D1B69, #1A0F3A)',
        marginBottom: 6,
        transition: 'transform 0.18s',
        position: 'relative',
      }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
      >
        {cover
          ? <img src={cover} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
              <span style={{ fontFamily: "'Playfair Display', serif", color: '#D4C8FF', fontSize: '8px', textAlign: 'center', lineHeight: 1.3 }}>{title}</span>
            </div>
        }
        {/* Badge étoile */}
        {rating > 0 && (
          <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 9, color: '#fbbf24' }}>★</span>
            <span style={{ fontSize: 9, color: '#EDE9F8', fontWeight: 700 }}>{rating}</span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.75)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      {dateStr && <div style={{ fontSize: 10, color: 'rgba(237,233,248,0.35)', marginTop: 2 }}>{dateStr}</div>}
    </div>
  )
}

// ── Répartition circle ────────────────────────────────────────────────────────
function RepartitionCircle({ terminated, inProgress, toStart }) {
  const total = terminated + inProgress + toStart || 1
  const pct = terminated / total
  const r = 34
  const circ = 2 * Math.PI * r
  const dash = pct * circ

  return (
    <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
      <svg width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        <circle cx={45} cy={45} r={r} fill="none" stroke="#816EBB" strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#EDE9F8', lineHeight: 1 }}>{terminated + inProgress + toStart}</span>
        <span style={{ fontSize: 9, color: 'rgba(237,233,248,0.4)', marginTop: 2 }}>Livres</span>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function YearProgress({ books, onBookSelect, onBack }) {
  const [goal, setGoal]        = useLocalGoal(`reading_goal_${CURRENT_YEAR}`, 12)
  const [editingGoal, setEdit] = useState(false)
  const [tmpGoal, setTmpGoal]  = useState(goal)

  const getStatuses = (b) => b.statuses?.length ? b.statuses : [b.status]

  const readBooks   = useMemo(() => books.filter(b => { const s = getStatuses(b); return s.includes('lu') || s.includes('prefere') }), [books])
  const nextBooks   = useMemo(() => books.filter(b => { const s = getStatuses(b); return s.includes('en_cours') || s.includes('souhaite') }), [books])
  const enCoursBooks = useMemo(() => books.filter(b => getStatuses(b).includes('en_cours')), [books])

  const readCount   = readBooks.length
  const pct         = Math.min(readCount / Math.max(goal, 1), 1)
  const remaining   = Math.max(0, goal - readCount)
  const monthsLeft  = Math.max(1, 12 - CURRENT_MONTH)
  const perMonth    = remaining > 0 ? (remaining / monthsLeft).toFixed(1) : 0

  const ratedBooks  = readBooks.filter(b => b.rating && b.rating > 0)
  const avgRating   = ratedBooks.length
    ? (ratedBooks.reduce((s, b) => s + b.rating, 0) / ratedBooks.length).toFixed(1)
    : 0

  const readingH    = Math.floor(readCount * 2.5)
  const readingM    = Math.round((readCount * 2.5 % 1) * 60)

  // Données mensuelles
  const monthlyData = useMemo(() => {
    const arr = Array(12).fill(0)
    readBooks.forEach(b => {
      const raw = b.updated_at || b.created_at
      if (!raw) return
      const d = new Date(raw)
      if (d.getFullYear() === CURRENT_YEAR) arr[d.getMonth()]++
    })
    return arr
  }, [readBooks])

  // Genres
  const genreData = useMemo(() => {
    const map = {}
    books.forEach(b => {
      const cats = b.categories?.filter(g => g && g.length > 2) || []
      const list = cats.length ? cats.slice(0, 2) : []
      list.forEach(g => { map[g] = (map[g] || 0) + 1 })
    })
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count], i) => ({ name, count, pct: count / total, color: GENRE_COLORS[i] }))
  }, [books])

  // Répartition
  const terminated  = readBooks.length
  const inProgress  = enCoursBooks.length
  const toStart     = books.filter(b => getStatuses(b).includes('souhaite')).length

  // Livres lus triés par date desc
  const recentReads = useMemo(() =>
    [...readBooks].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)).slice(0, 6),
    [readBooks]
  )

  const saveGoal = () => {
    const v = Math.max(1, Math.min(365, Number(tmpGoal) || 12))
    setGoal(v); setEdit(false)
  }

  const GOLD = '#816EBB'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 0 60px' }}>

      {/* ── HEADER ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'linear-gradient(180deg, rgba(12,10,21,0.97) 0%, rgba(12,10,21,0.9) 100%)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(129,110,187,0.1)',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {onBack && (
          <button onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <IconArrowLeft size={18} color="#EDE9F8" />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#EDE9F8' }}>Progression {CURRENT_YEAR}</div>
          <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.4)' }}>Ton objectif de lecture annuel</div>
        </div>
        <button style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconArrowUp size={16} color="#EDE9F8" />
        </button>
      </div>

      <div style={{ padding: '20px' }}>

        {/* ── OBJECTIF ANNUEL ── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(129,110,187,0.15)',
          borderRadius: 16, padding: '18px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconTarget size={16} color="#fbbf24" />
              <span style={{ fontSize: 13, color: 'rgba(237,233,248,0.7)' }}>Objectif annuel</span>
            </div>
            {editingGoal ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number" value={tmpGoal} min={1} max={365}
                  onChange={e => setTmpGoal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveGoal()}
                  autoFocus
                  style={{ width: 60, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 8, padding: '5px 8px', color: '#EDE9F8', fontSize: 15, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                />
                <span style={{ color: 'rgba(237,233,248,0.5)', fontSize: 13 }}>livres</span>
                <button onClick={saveGoal} style={{ background: '#fbbf24', border: 'none', borderRadius: 7, padding: '5px 12px', color: '#110D1E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>OK</button>
              </div>
            ) : (
              <button onClick={() => { setTmpGoal(goal); setEdit(true) }} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)',
                borderRadius: 8, padding: '5px 12px', color: '#fbbf24', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                {goal} <span style={{ fontSize: 11, opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: 3 }}>livres <IconPencil size={10} color="#fbbf24" /></span>
              </button>
            )}
          </div>

          {/* Barre */}
          <div style={{ height: 12, background: 'rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%', width: `${Math.round(pct * 100)}%`,
              background: pct >= 1 ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)',
              borderRadius: 8, transition: 'width 0.8s ease',
              boxShadow: pct >= 1 ? '0 0 12px rgba(74,222,128,0.4)' : '0 0 10px rgba(251,191,36,0.3)',
            }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'rgba(237,233,248,0.5)' }}>
              <strong style={{ fontSize: 20, color: '#EDE9F8', fontWeight: 800 }}>{readCount}</strong>
              <span style={{ marginLeft: 4 }}>/ {goal} livres</span>
              {remaining > 0 && (
                <span style={{ marginLeft: 10, color: 'rgba(237,233,248,0.4)' }}>
                  · encore <strong style={{ color: '#EDE9F8' }}>{remaining}</strong> à lire
                  · <strong style={{ color: '#fbbf24' }}>~{perMonth}/mois</strong> pour finir l'année
                </span>
              )}
              {remaining === 0 && <span style={{ marginLeft: 8, color: '#4ade80' }}>Objectif atteint !</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: pct >= 1 ? '#4ade80' : '#fbbf24' }}>{Math.round(pct * 100)}%</div>
          </div>
        </div>

        {/* ── 4 MINI STATS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {/* Livres lus */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 14, padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <IconBookOpen size={20} color="#a78bfa" />
              <span style={{ fontSize: 22, fontWeight: 800, color: '#EDE9F8' }}>{readCount}</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.45)' }}>Livres lus</div>
            {readCount >= 5 && <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 3, fontWeight: 600 }}>Bravo !</div>}
          </div>

          {/* Temps de lecture */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 14, padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <IconClock size={20} color="#a78bfa" />
              <span style={{ fontSize: 22, fontWeight: 800, color: '#EDE9F8' }}>{readingH > 0 ? `${readingH}h` : `${readingM}m`}</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.45)' }}>Temps de lecture</div>
            {readCount > 0 && <div style={{ fontSize: 10, color: '#4ade80', marginTop: 3, fontWeight: 600 }}>estimé</div>}
          </div>

          {/* Note moyenne */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 14, padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <IconStar size={20} color="#fbbf24" />
              <span style={{ fontSize: 22, fontWeight: 800, color: '#EDE9F8' }}>{avgRating > 0 ? avgRating : '--'}</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.45)' }}>Note moyenne</div>
            {avgRating > 0 && (
              <div style={{ marginTop: 3 }}>
                <StarRow rating={parseFloat(avgRating)} size={10} />
              </div>
            )}
          </div>

          {/* Séries */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 14, padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <IconFlame size={20} color="#f97316" />
              <span style={{ fontSize: 22, fontWeight: 800, color: '#EDE9F8' }}>{enCoursBooks.length}</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.45)' }}>Séries suivies</div>
            {enCoursBooks.length > 0 && <div style={{ fontSize: 10, color: '#f97316', marginTop: 3, fontWeight: 600 }}>En cours</div>}
          </div>
        </div>

        {/* ── PROGRESSION PAR MOIS ── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 16, padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <IconCalendar size={15} color={GOLD} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#EDE9F8' }}>Progression par mois</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(129,110,187,0.15)', borderRadius: 8, padding: '4px 10px' }}>
              <span style={{ fontSize: 11, color: 'rgba(237,233,248,0.6)', fontWeight: 600 }}>Livres lus</span>
              <span style={{ fontSize: 10, color: 'rgba(237,233,248,0.3)' }}>▾</span>
            </div>
          </div>
          <BarChart data={monthlyData} />
        </div>

        {/* ── GENRES + RÉPARTITION ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {/* Genres préférés */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 16, padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <IconMask size={14} color={GOLD} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#EDE9F8' }}>Genres préférés</span>
            </div>
            {genreData.length > 0 ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <DonutChart segments={genreData} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {genreData.slice(0, 4).map(({ name, pct, color }) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: 'rgba(237,233,248,0.65)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      <span style={{ fontSize: 9, color: 'rgba(237,233,248,0.4)', flexShrink: 0 }}>{Math.round(pct * 100)}%</span>
                    </div>
                  ))}
                  {genreData.length > 4 && (
                    <div style={{ fontSize: 9, color: 'rgba(237,233,248,0.3)', marginTop: 2 }}>+{genreData.length - 4} autres</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.2)', textAlign: 'center', padding: '16px 0' }}>
                Aucun genre trouvé
              </div>
            )}
            {genreData.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 10, color: GOLD, fontWeight: 600, cursor: 'pointer' }}>
                Découvre de nouveaux genres ! &gt;
              </div>
            )}
          </div>

          {/* Répartition */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,110,187,0.1)', borderRadius: 16, padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <IconBarChart size={14} color={GOLD} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#EDE9F8' }}>Répartition</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <RepartitionCircle terminated={terminated} inProgress={inProgress} toStart={toStart} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Terminés',      val: terminated, color: GOLD },
                  { label: 'En cours',      val: inProgress, color: '#f97316' },
                  { label: 'À commencer',   val: toStart,    color: 'rgba(237,233,248,0.2)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8', lineHeight: 1 }}>{val}</div>
                      <div style={{ fontSize: 9, color: 'rgba(237,233,248,0.35)' }}>{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── DERNIERS LIVRES LUS ── */}
        {recentReads.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IconBook size={15} color={GOLD} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#EDE9F8' }}>Derniers livres lus</span>
              </div>
              <span style={{ fontSize: 11, color: GOLD, fontWeight: 600, cursor: 'pointer' }}>Voir tout</span>
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
              {recentReads.map((book, i) => (
                <MiniBook key={book.id || i} book={book} onClick={onBookSelect} />
              ))}
            </div>
          </div>
        )}

        {/* ── SÉRIE EN COURS ── */}
        {enCoursBooks.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IconFlame size={15} color="#f97316" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#EDE9F8' }}>Série en cours</span>
              </div>
              <span style={{ fontSize: 11, color: GOLD, fontWeight: 600, cursor: 'pointer' }}>Voir tout</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {enCoursBooks.slice(0, 3).map((book, i) => {
                const cover = book.cover || book.cover_url
                const authors = Array.isArray(book.authors) ? book.authors[0] : book.authors
                return (
                  <div
                    key={book.id || i}
                    onClick={() => onBookSelect?.(book)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(129,110,187,0.1)',
                      borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                      transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,110,187,0.07)'; e.currentTarget.style.borderColor = 'rgba(129,110,187,0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(129,110,187,0.1)' }}
                  >
                    <div style={{ width: 48, height: 68, borderRadius: '3px 7px 7px 3px', overflow: 'hidden', flexShrink: 0, boxShadow: '-2px 3px 10px rgba(0,0,0,0.5)', background: 'linear-gradient(145deg,#2D1B69,#1A0F3A)' }}>
                      {cover ? <img src={cover} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
                      {authors && <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.35)', marginTop: 2 }}>{authors}</div>}
                      {/* Barre de progression fictive */}
                      <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '45%', background: 'linear-gradient(90deg,#6557A0,#816EBB)', borderRadius: 3 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>En cours</span>
                      <IconChevronRight size={14} color="rgba(237,233,248,0.2)" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {readBooks.length === 0 && nextBooks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(237,233,248,0.25)', fontSize: '14px' }}>
            Commence à ajouter des livres pour voir ta progression ici !
          </div>
        )}

      </div>
    </div>
  )
}
