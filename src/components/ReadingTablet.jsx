import { useEffect, useMemo, useRef, useState } from 'react'
import { toDisplay, spineColors } from '../lib/bookUtils'
import { BOOK_STATES, toggleState, isOwned, isWish, isReading, isRead, isLoved, inPal, readingDays, daysSince, daysFr, dateFr, dateShort, readYear, challenge } from '../lib/reading'

/**
 * La tablette de lecture, posée à côté de la bibliothèque : nos statuts (J'ai, Wishlist, Je lis,
 * J'ai lu, J'aime), la pile à lire, les dates de lecture et le défi de l'année.
 *   <ReadingDock> : la petite tablette, à côté du meuble ; <ReadingTablet> : la tablette ouverte.
 */
const SECTIONS = [
  { id: 'defi', label: 'Mon défi', icon: 'trophy' },
  { id: 'lis', label: 'Je lis', icon: 'bookmark', test: isReading },
  { id: 'pal', label: 'Ma PAL', icon: 'stack', test: inPal, hint: 'pile à lire' },
  { id: 'lu', label: 'J’ai lu', icon: 'check', test: isRead },
  { id: 'wish', label: 'Wishlist', icon: 'star', test: isWish },
  { id: 'aime', label: 'J’aime', icon: 'heart', test: isLoved },
  { id: 'ai', label: 'J’ai', icon: 'chart', test: isOwned },
]
const ICON = {
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4" /></>,
  bookmark: <path d="M7 4h10v16l-5-4-5 4z" />,
  stack: <><rect x="4" y="15" width="16" height="4" rx="1" /><rect x="6" y="10" width="13" height="4" rx="1" /><rect x="5" y="5" width="14" height="4" rx="1" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  star: <path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  chart: <path d="M6 19V11M10 19V6M14 19v-9M18 19v-5" />,
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  shelf: <path d="M4 4v16M20 4v16M4 9h16M4 14.5h16M4 20h16M7 9V6M9 9V5.5M12 14.5v-3.5M14.5 14.5v-3" />,
}
const Ico = ({ n }) => <svg viewBox="0 0 24 24" aria-hidden="true">{ICON[n]}</svg>
const STATE_ICON = { possede: 'chart', souhaite: 'star', en_cours: 'bookmark', lu: 'check', aime: 'heart' }

function Cover({ book, w = 64 }) {
  const d = toDisplay(book)
  const [bg, ink] = spineColors(d)
  const [bad, setBad] = useState(false)
  return (
    <span className="rt-cover" style={{ width: w, background: bg, color: ink }}>
      {d.cover && !bad ? <img src={d.cover} alt="" loading="lazy" onError={() => setBad(true)} /> : <em>{d.title}</em>}
    </span>
  )
}

/** Un anneau de progression. */
function Ring({ value, max, size = 120, stroke = 10 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const k = max ? Math.min(1, value / max) : 0
  return (
    <svg className="rt-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="bg" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} className="fg" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - k)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* La petite tablette, à côté du meuble                                      */
/* -------------------------------------------------------------------------- */
export function ReadingDock({ books, reading, onOpen, mobile }) {
  const year = new Date().getFullYear()
  const n = useMemo(() => books.filter(b => readYear(b, reading.datesOf(b.id)) === year).length, [books, reading, year])
  const goal = reading.goalOf(year)
  const now = books.filter(isReading)
  return (
    <button type="button" className={'rt-dock' + (mobile ? ' mobile' : '')} onClick={e => onOpen(e.currentTarget.getBoundingClientRect())} aria-label="Ouvrir la tablette de lecture">
      <span className="rt-dock-screen">
        <span className="rt-dock-ring"><Ring value={n} max={goal || Math.max(n, 1)} size={mobile ? 34 : 46} stroke={mobile ? 4 : 5} /><b>{n}</b></span>
        {!mobile && (
          <span className="rt-dock-txt">
            <i>Défi {year}</i>
            <b>{goal ? `${n} / ${goal} livres` : `${n} lu${n > 1 ? 's' : ''}`}</b>
            <em>{now.length ? `Je lis : ${toDisplay(now[0]).title}` : 'Mes lectures'}</em>
          </span>
        )}
      </span>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* La tablette ouverte                                                        */
/* -------------------------------------------------------------------------- */
export default function ReadingTablet({ books, reading, updateBook, from, mobile, onShow, onClose }) {
  const [sec, setSec] = useState('defi')
  const [openId, setOpenId] = useState(null)
  const [clock, setClock] = useState(() => new Date())
  const ref = useRef(null)
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 20000); return () => clearInterval(t) }, [])
  // elle sort de la petite tablette
  useEffect(() => {
    const el = ref.current, r = from
    if (!el?.animate || !r?.width) return
    const b = el.getBoundingClientRect()
    el.animate([
      { transform: `translate(${r.left - b.left}px, ${r.top - b.top}px) scale(${r.width / b.width}, ${r.height / b.height})`, opacity: 0.6 },
      { transform: 'none', opacity: 1 },
    ], { duration: 560, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => {
    const el = ref.current
    if (!el?.animate) { onClose(); return }
    el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96) translateY(14px)' }], { duration: 240, easing: 'ease-in', fill: 'forwards' }).finished.then(onClose, onClose)
  }
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { if (openId) setOpenId(null); else close() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const counts = useMemo(() => Object.fromEntries(SECTIONS.filter(s => s.test).map(s => [s.id, books.filter(s.test).length])), [books])
  const book = openId && books.find(b => b.id === openId)
  const go = id => { setSec(id); setOpenId(null) }

  return (
    <div className="rt-back" onPointerDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className={'rt-ipad' + (mobile ? ' mobile' : '')} ref={ref} role="dialog" aria-label="Mes lectures">
        {!mobile && <span className="rt-cam" aria-hidden="true" />}
        <div className="rt-screen">
          {!mobile && (
            <div className="rt-status" aria-hidden="true">
              <b>{clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</b>
              <span>{clock.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <i className="rt-batt"><em /></i>
            </div>
          )}
          <aside className="rt-side">
            <div className="rt-brand"><span>📖</span><b>Mes lectures</b></div>
            <nav>
              {SECTIONS.map(s => (
                <button type="button" key={s.id} className={sec === s.id && !book ? 'on' : ''} onClick={() => go(s.id)}>
                  <span className={'rt-si ' + s.icon}><Ico n={s.icon} /></span>
                  <b>{s.label}</b>
                  {s.test && <em>{counts[s.id]}</em>}
                </button>
              ))}
            </nav>
            <button type="button" className="rt-close" onClick={close} aria-label="Ranger la tablette"><Ico n="close" /></button>
          </aside>
          <main className="rt-main" key={book ? 'b' + book.id : sec}>
            {book ? <BookPage book={book} reading={reading} updateBook={updateBook} onBack={() => setOpenId(null)} onShow={() => { onShow(book.id); close() }} />
              : sec === 'defi' ? <Challenge books={books} reading={reading} onOpen={setOpenId} onGo={go} />
                : <List sec={SECTIONS.find(s => s.id === sec)} books={books} reading={reading} onOpen={setOpenId} />}
          </main>
        </div>
      </div>
    </div>
  )
}

function Challenge({ books, reading, onOpen, onGo }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const { read, months, pages, avg } = useMemo(() => challenge(books, reading.datesOf, year), [books, reading, year])
  const goal = reading.goalOf(year)
  const now = books.filter(isReading)
  const max = Math.max(1, ...months)
  const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  // où on en est par rapport au rythme de l'année
  const dayOfYear = (Date.now() - new Date(thisYear, 0, 1)) / 864e5
  const expected = goal && year === thisYear ? Math.round((goal * dayOfYear) / 365) : null
  return (
    <div className="rt-page">
      <header className="rt-h">
        <p className="rt-kicker">Défi lecture</p>
        <div className="rt-year">
          <button type="button" onClick={() => setYear(y => y - 1)} aria-label="Année précédente"><Ico n="back" /></button>
          <h1>{year}</h1>
          <button type="button" onClick={() => setYear(y => Math.min(thisYear, y + 1))} disabled={year >= thisYear} aria-label="Année suivante" className="next"><Ico n="back" /></button>
        </div>
      </header>
      <section className="rt-hero">
        <div className="rt-hero-ring">
          <Ring value={read.length} max={goal || Math.max(read.length, 1)} size={150} stroke={12} />
          <div><b>{read.length}</b><span>{goal ? `sur ${goal}` : `livre${read.length > 1 ? 's' : ''}`}</span></div>
        </div>
        <div className="rt-hero-txt">
          {goal ? (
            <p className="rt-big">{read.length >= goal ? 'Défi réussi ! 🎉' : `Encore ${goal - read.length} livre${goal - read.length > 1 ? 's' : ''}`}</p>
          ) : <p className="rt-big">Fixe-toi un objectif</p>}
          {expected != null && read.length < goal && <p className="rt-sub">{read.length >= expected ? 'Tu es dans les temps' : `${expected - read.length} de retard sur le rythme`}</p>}
          <div className="rt-goal">
            <span>Objectif {year}</span>
            <button type="button" onClick={() => reading.setGoal(year, Math.max(1, (goal || 12) - 1))} aria-label="Un livre de moins">−</button>
            <b>{goal || '—'}</b>
            <button type="button" onClick={() => reading.setGoal(year, (goal || 11) + 1)} aria-label="Un livre de plus">+</button>
          </div>
        </div>
        <div className="rt-stats">
          <div><b>{pages.toLocaleString('fr-FR')}</b><span>pages</span></div>
          <div><b>{avg ? daysFr(avg) : '—'}</b><span>par livre</span></div>
        </div>
      </section>
      <section className="rt-months" aria-label="Livres lus par mois">
        {months.map((n, i) => (
          <div key={i} className={year === thisYear && i === new Date().getMonth() ? 'cur' : ''}><span style={{ height: `${(n / max) * 100}%` }}>{n || ''}</span><em>{MONTHS[i]}</em></div>
        ))}
      </section>
      {now.length > 0 && year === thisYear && (
        <section>
          <h2 className="rt-h2">Je lis <button type="button" onClick={() => onGo('lis')}>Tout voir</button></h2>
          <div className="rt-now">
            {now.slice(0, 4).map(b => {
              const d = reading.datesOf(b.id)
              return (
                <button type="button" key={b.id} onClick={() => onOpen(b.id)}>
                  <Cover book={b} w={70} />
                  <span><b>{toDisplay(b).title}</b><em>{d.start ? `depuis ${daysFr(daysSince(d.start))}` : 'commencé'}</em></span>
                </button>
              )
            })}
          </div>
        </section>
      )}
      <section>
        <h2 className="rt-h2">Lus en {year}</h2>
        {read.length ? (
          <div className="rt-shelf">
            {read.map(b => (
              <button type="button" key={b.id} onClick={() => onOpen(b.id)} title={toDisplay(b).title}>
                <Cover book={b} w={78} />
                <em>{dateShort(reading.datesOf(b.id).end)}</em>
              </button>
            ))}
          </div>
        ) : <p className="rt-empty">Aucun livre fini en {year} pour l’instant. Passe un livre en « Je lis », puis en « J’ai lu » : il compte ici avec son temps de lecture.</p>}
      </section>
    </div>
  )
}

function List({ sec, books, reading, onOpen }) {
  const [q, setQ] = useState('')
  let list = books.filter(sec.test)
  if (q.trim()) { const k = q.trim().toLowerCase(); list = list.filter(b => (b.title + ' ' + (b.authors || []).join(' ')).toLowerCase().includes(k)) }
  // « J'ai lu » : année par année, puis « lus il y a longtemps »
  let groups = [{ title: null, list }]
  if (sec.id === 'lu') {
    const byYear = new Map()
    for (const b of list) { const y = readYear(b, reading.datesOf(b.id)); const k = y || 0; if (!byYear.has(k)) byYear.set(k, []); byYear.get(k).push(b) }
    groups = [...byYear.entries()].sort((a, b) => (b[0] || -1) - (a[0] || -1)).map(([y, l]) => ({ title: y ? `Lus en ${y}` : 'Lus il y a longtemps', list: y ? l.sort((a, b) => reading.datesOf(b.id).end.localeCompare(reading.datesOf(a.id).end)) : l }))
  }
  if (sec.id === 'lis') list.sort((a, b) => (reading.datesOf(b.id).start || '').localeCompare(reading.datesOf(a.id).start || ''))
  return (
    <div className="rt-page">
      <header className="rt-h">
        <p className="rt-kicker">{sec.hint || 'Ma bibliothèque'}</p>
        <h1>{sec.label}</h1>
      </header>
      <label className="rt-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg><input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un titre, un auteur…" /></label>
      {!list.length && <p className="rt-empty">{q ? 'Aucun livre ne correspond.' : EMPTY[sec.id]}</p>}
      {groups.map(g => g.list.length > 0 && (
        <section key={g.title || 'all'}>
          {g.title && <h2 className="rt-h2">{g.title} <em>{g.list.length}</em></h2>}
          <ul className="rt-list">
            {g.list.map(b => {
              const d = toDisplay(b), dt = reading.datesOf(b.id), days = readingDays(dt)
              const meta = isReading(b) && dt.start ? `Commencé le ${dateShort(dt.start)} · depuis ${daysFr(daysSince(dt.start))}`
                : isRead(b) ? (dt.longAgo || !dt.end ? 'Lu il y a longtemps' : `Fini le ${dateFr(dt.end)}${days ? ` · lu en ${daysFr(days)}` : ''}`)
                  : d.pageCount ? `${d.pageCount} pages` : ''
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => onOpen(b.id)}>
                    <Cover book={b} w={52} />
                    <span className="rt-li-txt"><b>{d.title}</b><i>{d.authors.join(', ')}</i>{meta && <em>{meta}</em>}</span>
                    <span className="rt-li-marks">{isLoved(b) && <span className="heart"><Ico n="heart" /></span>}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
const EMPTY = {
  lis: 'Aucun livre en cours. Ouvre un livre et touche « Je lis » : la date de début est notée.',
  pal: 'Ta pile à lire est vide : tous les livres que tu as sont lus ou en cours.',
  lu: 'Aucun livre lu pour l’instant.',
  wish: 'Ta wishlist est vide. Ajoute un livre et touche « Wishlist ».',
  aime: 'Les livres que tu aimes (le cœur) arrivent ici.',
  ai: 'Aucun livre marqué « J’ai ».',
}

function BookPage({ book, reading, updateBook, onBack, onShow }) {
  const d = toDisplay(book)
  const dates = reading.datesOf(book.id)
  const [ask, setAsk] = useState(false)
  const [err, setErr] = useState('')
  const datesRef = useRef(null)
  const st = new Set(book.statuses || (book.status ? [book.status] : []))
  const toggle = async id => {
    const r = toggleState(book, id, dates)
    try {
      if (r.dates) reading.setDates(book.id, r.dates)
      await updateBook(book.id, { statuses: r.statuses })
      if (r.askDates) { setAsk(true); setTimeout(() => datesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60) }
    } catch (e) { setErr('Erreur : ' + (e.message || e)) }
  }
  const days = readingDays(dates)
  const setD = patch => { reading.setDates(book.id, patch); setAsk(false) }
  return (
    <div className="rt-page rt-book">
      <button type="button" className="rt-backbtn" onClick={onBack}><Ico n="back" /><span>Retour</span></button>
      <div className="rt-book-top">
        <Cover book={book} w={130} />
        <div>
          <p className="rt-kicker">{d.authors.join(', ')}</p>
          <h1>{d.title}</h1>
          <p className="rt-sub">{[d.year, d.pageCount ? `${d.pageCount} pages` : '', d.categories[0]].filter(Boolean).join(' · ')}</p>
          <button type="button" className="rt-link" onClick={onShow}><Ico n="shelf" />Le voir sur l’étagère</button>
        </div>
      </div>
      <div className="rt-states" role="group" aria-label="Mes statuts">
        {BOOK_STATES.map(s => (
          <button type="button" key={s.id} className={'rt-state s-' + s.id + (st.has(s.id) ? ' on' : '')} aria-pressed={st.has(s.id)} onClick={() => toggle(s.id)}>
            <span><Ico n={STATE_ICON[s.id]} /></span><em>{s.short}</em>
          </button>
        ))}
      </div>
      {err && <p className="rt-err">{err}</p>}
      {(st.has('en_cours') || st.has('lu')) && (
        <section className={'rt-dates' + (ask ? ' ask' : '')} ref={datesRef}>
          <h2 className="rt-h2">Dates de lecture</h2>
          {ask && <p className="rt-ask">Lu quand ? Donne des dates pour qu’il compte dans ton défi {new Date().getFullYear()}, ou laisse « Lu il y a longtemps ».</p>}
          {st.has('lu') && (
            <label className="rt-switch">
              <span>Lu il y a longtemps</span>
              <input type="checkbox" checked={!!dates.longAgo} onChange={e => setD(e.target.checked ? { longAgo: true, start: null, end: null } : { longAgo: false })} />
              <i aria-hidden="true" />
            </label>
          )}
          {!dates.longAgo && (
            <div className="rt-daterow">
              <label><span>Début</span><input type="date" value={dates.start || ''} max={dates.end || undefined} onChange={e => setD({ start: e.target.value || null })} /></label>
              {st.has('lu') && <label><span>Fin</span><input type="date" value={dates.end || ''} min={dates.start || undefined} onChange={e => setD({ end: e.target.value || null })} /></label>}
            </div>
          )}
          <p className="rt-time">
            {dates.longAgo ? 'Ne compte pas dans le défi de l’année.'
              : st.has('en_cours') && dates.start ? `En cours depuis ${daysFr(daysSince(dates.start))}`
                : days ? <>Temps de lecture : <b>{daysFr(days)}</b>{d.pageCount ? ` · ${Math.round(d.pageCount / days)} pages par jour` : ''}</>
                  : 'Temps de lecture : —'}
          </p>
        </section>
      )}
      {d.description && <p className="rt-desc">{d.description}</p>}
    </div>
  )
}
