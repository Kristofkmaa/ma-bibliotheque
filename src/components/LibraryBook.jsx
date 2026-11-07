import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toDisplay, spineColors, titleKey, authorKey } from '../lib/bookUtils'
import {
  BOOK_STATES, toggleState, isOwned, isWish, isReading, isRead, isLoved, inPal,
  readingDays, daysSince, daysFr, dateFr, dateShort, readYear, challenge, today,
} from '../lib/reading'
import { effectiveShelves, moveBook, createShelf, renameShelf, deleteShelf, LOOSE } from '../lib/shelfOps'
import { searchBooks } from '../lib/googleBooks'
import { preloadCover } from '../lib/covers'
import { useSharpCover } from '../hooks/useSharpCover'
import { useLayer } from '../lib/nav'
import BackButton from './BackButton'

/**
 * La bibliothèque, dans un livre : on touche l'étagère du salon, un livre en sort, vient devant
 * nous et s'ouvre. À gauche le sommaire (nos lectures, nos livres, nos collections), à droite le
 * chapitre ouvert ; un livre s'ouvre sur une double page (sa couverture, sa fiche). On tourne les
 * pages pour passer d'un chapitre à l'autre. Sur téléphone, une page à la fois.
 * (Tout ce que faisait la tablette de lecture est ici : statuts, dates, défi de l'année.)
 */
const LISTS = [
  { id: 'lis', path: 'je-lis', label: 'Je lis', test: isReading, empty: 'Aucun livre en cours. Ouvre un livre et touche « Je lis » : la date de début est notée.' },
  { id: 'pile', path: 'ma-pile', label: 'Ma pile', kicker: 'Pile à lire', test: inPal, empty: 'Ta pile est vide : tous les livres que tu as sont lus ou en cours.' },
  { id: 'lu', path: 'lus', label: 'J’ai lu', test: isRead, empty: 'Aucun livre lu pour l’instant.' },
  { id: 'wish', path: 'wishlist', label: 'Wishlist', kicker: 'Envies', test: isWish, empty: 'Ta wishlist est vide. Ajoute un livre et touche « Wishlist ».' },
  { id: 'aime', path: 'aime', label: 'J’aime', kicker: 'Coups de cœur', test: isLoved, empty: 'Les livres que tu aimes (le cœur) arrivent ici.' },
  { id: 'ai', path: 'possedes', label: 'J’ai', kicker: 'Dans nos étagères', test: isOwned, empty: 'Aucun livre marqué « J’ai ».' },
  { id: 'tous', path: 'tous', label: 'Tous nos livres', kicker: 'Toute la bibliothèque', test: () => true, empty: 'La bibliothèque est vide : ajoute ton premier livre.' },
]
const LIST_OF = Object.fromEntries(LISTS.map(l => [l.id, l]))
const PATH_OF = { defi: 'defi', top: 'top', ajouter: 'ajouter', ...Object.fromEntries(LISTS.map(l => [l.id, l.path])) }
const CHAP_OF = Object.fromEntries(Object.entries(PATH_OF).map(([k, v]) => [v, k]))
const chapPath = c => (c.startsWith('col:') ? 'collection/' + c.slice(4) : PATH_OF[c] || 'je-lis')
const SORTS = [['recent', 'Ajout récent'], ['title', 'Titre'], ['author', 'Auteur'], ['rating', 'Ma note']]
const coll = new Intl.Collator('fr')
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']

const Ico = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>
const STATE_ICON = {
  possede: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" />,
  souhaite: <path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" />,
  en_cours: <path d="M7 4h10v16l-5-4-5 4z" />,
  lu: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  aime: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
}

/** Une couverture (sinon la couleur de la tranche et le titre). */
function Cover({ book, sharp = false, className = '' }) {
  const d = toDisplay(book)
  const [bg, ink] = spineColors(d)
  const [bad, setBad] = useState(false)
  const big = useSharpCover(sharp ? book : null, 900)
  const src = (sharp && big) || d.cover
  return (
    <span className={'lb-cover ' + className} style={{ background: bg, color: ink }}>
      {src && !bad ? <img src={src.replace('http://', 'https://')} alt="" loading="lazy" draggable="false" onError={() => setBad(true)} /> : <em>{d.title}</em>}
    </span>
  )
}

function Ring({ value, max, size = 120, stroke = 10 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const k = max ? Math.min(1, value / max) : 0
  return (
    <svg className="lb-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="bg" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} className="fg" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - k)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Le livre                                                                    */
/* -------------------------------------------------------------------------- */
export default function LibraryBook({ api, from, start, mobile, incoming, onIncomingDone, onScan, onWall, onClose }) {
  const { books, reading, shelves, commitShelves } = api
  // arrivée par une adresse : « /bibliotheque/ma-pile », « /bibliotheque/livre/42 »…
  const st0 = start || []
  const [chap, setChap] = useState(() => (st0[1] === 'collection' && st0[2] ? 'col:' + st0[2] : (mobile && st0[1] === 'ajouter') ? 'lis' : CHAP_OF[st0[1]] || 'lis'))
  const [addOpen, setAddOpen] = useState(() => mobile && st0[1] === 'ajouter')   // téléphone : la page « Ajouter »
  // téléphone : l'accueil (toutes les listes en tuiles), ou une liste ouverte
  const [listOpen, setListOpen] = useState(() => mobile && !!st0[1] && !['livre', 'ajouter'].includes(st0[1]))
  const [openId, setOpenId] = useState(null)       // la fiche d'un de nos livres
  const [addItem, setAddItem] = useState(null)     // la fiche d'un livre trouvé (à ajouter)
  const wantId = useRef(st0[1] === 'livre' ? st0[2] : null)
  useEffect(() => {
    if (!wantId.current || !books.length) return
    const b = books.find(x => String(x.id) === wantId.current)
    wantId.current = null
    if (b) setOpenId(b.id)
  }, [books])
  // un livre trouvé ailleurs (le scanner) : sa fiche s'ouvre ici
  useEffect(() => { if (incoming) { setAddItem(incoming); onIncomingDone?.() } }, [incoming]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- L'ouverture : le livre sort de l'étagère, vient devant nous, sa couverture s'ouvre
  const rootRef = useRef(null), bookRef = useRef(null), coverRef = useRef(null)
  const [phase, setPhase] = useState('opening')
  useEffect(() => {
    const book = bookRef.current, cover = coverRef.current, root = rootRef.current
    // téléphone : une appli, qui monte depuis le bas
    if (mobile && root?.animate) {
      root.animate([{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2, .9, .3, 1)' }).finished.then(() => setPhase('open'), () => setPhase('open'))
      return
    }
    if (!book?.animate) { setPhase('open'); return }
    const b = book.getBoundingClientRect()
    // fermé, le livre ne montre que sa couverture (la moitié droite de la double page)
    const half = mobile ? 0 : b.width / 4
    const r = from && from.w > 0 ? from : { x: innerWidth / 2 - 40, y: innerHeight * 0.4, w: 80, h: 120 }
    const s = Math.max(0.08, Math.min(r.h / b.height, 0.5))
    const dx = r.x + r.w / 2 - (b.left + b.width / 2 + half), dy = r.y + r.h / 2 - (b.top + b.height / 2)
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' })
    const fly = book.animate([
      { transform: `translate(${dx - half}px, ${dy}px) scale(${s}) rotate(-6deg)`, offset: 0 },
      { transform: `translate(${-half}px, -10px) scale(1) rotate(0deg)`, offset: 0.55 },
      { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', offset: 1 },
    ], { duration: 1150, easing: 'cubic-bezier(.3, .9, .3, 1)', fill: 'both' })
    const open = cover.animate([
      { transform: 'rotateY(0deg)', offset: 0 }, { transform: 'rotateY(0deg)', offset: 0.42 },
      { transform: 'rotateY(-178deg)', offset: 1 },
    ], { duration: 1150, easing: 'cubic-bezier(.55, 0, .25, 1)', fill: 'both' })
    open.finished.then(() => { fly.cancel(); open.cancel(); setPhase('open') }, () => {})
    return () => { fly.cancel(); open.cancel() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const closing = useRef(false)
  const close = () => {
    if (closing.current) return
    closing.current = true
    setPhase('closing')
    // (on ferme à coup sûr, même si l'animation ne va pas au bout)
    let done = false
    const finish = () => { if (!done) { done = true; onClose() } }
    const book = bookRef.current, cover = coverRef.current, root = rootRef.current
    if (mobile && root?.animate) { root.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(26px)' }], { duration: 260, easing: 'ease-in', fill: 'both' }).finished.then(finish, finish); setTimeout(finish, 420); return }
    if (!book?.animate) { finish(); return }
    const b = book.getBoundingClientRect()
    const half = mobile ? 0 : b.width / 4
    const r = from && from.w > 0 ? from : { x: innerWidth / 2 - 40, y: innerHeight * 0.4, w: 80, h: 120 }
    const s = Math.max(0.08, Math.min(r.h / b.height, 0.5))
    const dx = r.x + r.w / 2 - (b.left + b.width / 2 + half), dy = r.y + r.h / 2 - (b.top + b.height / 2)
    cover.animate([{ transform: 'rotateY(-178deg)' }, { transform: 'rotateY(0deg)' }], { duration: 520, easing: 'cubic-bezier(.5, 0, .5, 1)', fill: 'both' })
    book.animate([
      { transform: 'translate(0px, 0px) scale(1)', offset: 0 },
      { transform: `translate(${-half}px, 0px) scale(1)`, offset: 0.45 },
      { transform: `translate(${dx - half}px, ${dy}px) scale(${s}) rotate(-6deg)`, offset: 1 },
    ], { duration: 980, easing: 'cubic-bezier(.6, 0, .4, 1)', fill: 'both' })
    root.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 980, fill: 'both' }).finished.then(finish, finish)
    setTimeout(finish, 1300)
  }

  // ---- Tourner les pages
  const [turn, setTurn] = useState(0)
  const flip = fn => { fn(); setTurn(t => t + 1) }
  const goChap = c => {
    if (mobile && c === 'ajouter') { flip(() => setAddOpen(true)); return }
    flip(() => { setChap(c); setOpenId(null); setAddItem(null); if (mobile) setListOpen(true) })
  }
  const openBook = id => flip(() => { setOpenId(id); setAddItem(null) })

  // ---- La navigation (retour du navigateur, du téléphone, Échap, bouton)
  useLayer(true, '/bibliotheque' + (mobile ? '' : '/' + chapPath(chap)), close)
  useLayer(mobile && listOpen, '/bibliotheque/' + chapPath(chap), () => flip(() => setListOpen(false)))
  useLayer(mobile && addOpen, '/bibliotheque/ajouter', () => flip(() => setAddOpen(false)))
  useLayer(!!openId, '/bibliotheque/livre/' + openId, () => flip(() => setOpenId(null)))
  useLayer(!!addItem, '/bibliotheque/ajouter/livre', () => flip(() => setAddItem(null)))

  // ---- Les collections (nos étagères d'avant)
  const eff = useMemo(() => effectiveShelves(shelves, books), [shelves, books])
  const cols = eff.filter(s => !s.pseudo && !s.virtual)
  const colOf = id => cols.find(s => s.book_ids.includes(id)) || null
  const commit = res => { commitShelves(res.list); return res }

  const counts = useMemo(() => Object.fromEntries(LISTS.map(l => [l.id, books.filter(l.test).length])), [books])
  const year = new Date().getFullYear()
  const readThisYear = useMemo(() => books.filter(b => readYear(b, reading.datesOf(b.id)) === year).length, [books, reading, year])
  const goal = reading.goalOf(year)
  const book = openId && books.find(b => b.id === openId)

  const listLabel = c => (c.startsWith('col:') ? cols.find(s => s.id === c.slice(4))?.name || 'Collection' : c === 'defi' ? 'Mon défi' : c === 'top' ? 'Mon top 5' : c === 'ajouter' ? 'Ajouter' : LIST_OF[c]?.label || '')

  const ctx = { api, cols, colOf, commit, eff, openBook, goChap, onScan, setAddItem: it => flip(() => setAddItem(it)), mobile }

  // les deux pages (ordinateur) ou la page du moment (téléphone)
  let left, right, spread = null
  const sommaire = (
    <Sommaire chap={chap} counts={counts} cols={cols} books={books} ctx={ctx} readThisYear={readThisYear} goal={goal} year={year} onWall={onWall} />
  )
  const chapter = <Chapter key={chap} chap={chap} ctx={ctx} />
  if (book) spread = <BookSpread book={book} ctx={ctx} back={listLabel(chap)} onBack={() => history.back()} />
  else if (addItem) spread = <AddSpread item={addItem} ctx={ctx} onBack={() => history.back()} onOpenMine={id => { setAddItem(null); setOpenId(id) }} />
  else { left = sommaire; right = chapter }

  if (mobile) {
    return createPortal(
      <PhoneShelf chap={chap} ctx={ctx} counts={counts} cols={cols} readThisYear={readThisYear} goal={goal}
        book={book} addItem={addItem} addOpen={addOpen} listOpen={listOpen} turn={turn} rootRef={rootRef} listLabel={listLabel}
        onOpenMine={id => { setAddItem(null); setOpenId(id) }} />,
      document.body,
    )
  }
  return createPortal(
    <div className={'lb' + (mobile ? ' mobile' : '') + ' ph-' + phase} ref={rootRef} role="dialog" aria-label="Ma bibliothèque">
      <div className="lb-back" onPointerDown={e => { if (e.target === e.currentTarget) history.back() }} />
      <BackButton label="Le salon" className="float lb-salon" />
      <div className="lb-book" ref={bookRef}>
        <div className="lb-spine" aria-hidden="true" />
        {spread ? (
          <div className="lb-pages lb-spread" key={'s' + turn}>{spread}</div>
        ) : (
          <div className="lb-pages">
            <div className="lb-page lb-left"><div className="lb-pagein">{left}</div></div>
            <div className="lb-page lb-right"><div className="lb-pagein" key={turn}>{right}</div></div>
          </div>
        )}
        {/* la page qui tourne */}
        {turn > 0 && <span className="lb-leaf" key={'leaf' + turn} aria-hidden="true" />}
        {/* la couverture (elle s'ouvre à l'arrivée, se referme au départ) */}
        <div className="lb-coverboard" ref={coverRef} aria-hidden="true">
          <div className="lb-cb-front"><span className="lb-cb-frame"><i>Maruchime</i><b>Ma bibliothèque</b><em>{books.length} livres</em></span></div>
          <div className="lb-cb-inside" />
        </div>
        <span className="lb-ribbon" aria-hidden="true" />
      </div>
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */
/* Sur téléphone : pas d'objet livre, une appli simple dans ses couleurs        */
/* -------------------------------------------------------------------------- */
function PhoneShelf({ chap, ctx, counts, cols, readThisYear, goal, book, addItem, addOpen, listOpen, turn, rootRef, listLabel, onOpenMine }) {
  const [newCol, setNewCol] = useState(null)
  const colBusy = useRef(false)     // (Entrée puis la perte du focus : une seule collection)
  const detail = book || addItem
  const home = !detail && !addOpen && !listOpen
  const back = book ? (listOpen ? listLabel(chap) : 'Mes livres') : addItem ? 'Ajouter' : addOpen || listOpen ? 'Mes livres' : 'Le salon'
  // une seule page qui défile : on remonte en haut à chaque changement ; l'en-tête reste collé en
  // haut, et prend son fond (verre dépoli) et le petit titre dès qu'on descend
  const [bar, setBar] = useState(0)        // 0 : en haut ; 1 : on a un peu défilé ; 2 : le grand titre est passé
  useEffect(() => { rootRef.current?.scrollTo?.(0, 0); setBar(0) }, [turn]) // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = e => {
    const y = e.currentTarget.scrollTop
    const v = y > 64 ? 2 : y > 4 ? 1 : 0
    if (v !== bar) setBar(v)
  }
  const small = book ? toDisplay(book).title : addItem ? addItem.title : addOpen ? 'Ajouter un livre' : listOpen ? listLabel(chap) : 'Mes livres'
  const addCol = e => {
    e.preventDefault()
    if (colBusy.current) return
    colBusy.current = true
    setTimeout(() => { colBusy.current = false }, 300)
    const v = (newCol || '').trim()
    setNewCol(null)
    if (!v) return
    const res = ctx.commit(createShelf(ctx.eff, v))
    if (res.id) ctx.goChap('col:' + res.id)
  }
  const byId = useMemo(() => new Map(ctx.api.books.map(b => [b.id, b])), [ctx.api.books])
  const coversOf = id => {
    if (id.startsWith('col:')) return (cols.find(c => c.id === id.slice(4))?.book_ids || []).map(x => byId.get(x)).filter(Boolean)
    if (id === 'top') return ctx.api.topBooks
    return ctx.api.books.filter(LIST_OF[id].test)
  }
  const Tile = ({ id, label, n }) => (
    <button type="button" className="lba-tile" onClick={() => ctx.goChap(id)}>
      <span className="lba-tile-txt"><b>{label}</b><em>{n}</em></span>
      <span className="lba-fan" aria-hidden="true">{coversOf(id).slice(0, 3).map(b => <Cover key={b.id} book={b} />)}</span>
    </button>
  )
  let content
  if (book) content = <BookSpread book={book} ctx={ctx} back={listLabel(chap)} onBack={() => history.back()} />
  else if (addItem) content = <AddSpread item={addItem} ctx={ctx} onBack={() => history.back()} onOpenMine={onOpenMine} />
  else if (addOpen) content = <AddPage ctx={ctx} />
  else if (listOpen) content = <Chapter key={chap} chap={chap} ctx={ctx} />
  else content = (
    <div className="lba-home">
      <h1 className="lba-h">Mes livres</h1>
      <p className="lb-som-sub">{ctx.api.books.length} livre{ctx.api.books.length > 1 ? 's' : ''} · {readThisYear} lu{readThisYear > 1 ? 's' : ''} en {new Date().getFullYear()}</p>
      <button type="button" className="lb-defi" onClick={() => ctx.goChap('defi')}>
        <span className="lb-defi-ring"><Ring value={readThisYear} max={goal || Math.max(readThisYear, 1)} size={52} stroke={5} /><b>{readThisYear}</b></span>
        <span><i>Mon défi {new Date().getFullYear()}</i><b>{goal ? `${readThisYear} sur ${goal} livres` : 'Fixe-toi un objectif'}</b></span>
      </button>
      <h2 className="lb-toc-h">Mes lectures</h2>
      <div className="lba-tiles">{['lis', 'pile', 'lu', 'wish', 'aime'].map(id => <Tile key={id} id={id} label={LIST_OF[id].label} n={counts[id]} />)}</div>
      <h2 className="lb-toc-h">Mes livres</h2>
      <div className="lba-tiles">
        <Tile id="tous" label="Tous nos livres" n={counts.tous} />
        <Tile id="ai" label="J’ai" n={counts.ai} />
        <Tile id="top" label="Mon top 5" n={ctx.api.topBooks.length} />
      </div>
      <h2 className="lb-toc-h">Mes collections</h2>
      <div className="lba-tiles">
        {cols.map(c => <Tile key={c.id} id={'col:' + c.id} label={c.name} n={c.book_ids.length} />)}
        {newCol == null
          ? <button type="button" className="lba-tile new" onClick={() => setNewCol('')}><span className="lba-tile-txt"><b>＋ Nouvelle collection</b></span></button>
          : <form className="lba-tile new" onSubmit={addCol}><input autoFocus value={newCol} onChange={e => setNewCol(e.target.value)} onBlur={addCol} placeholder="Son nom" aria-label="Nom de la nouvelle collection" maxLength={40} /></form>}
      </div>
    </div>
  )
  return (
    <div className="lb lba" ref={rootRef} role="dialog" aria-label="Mes livres" onScroll={onScroll}>
      <header className={'lba-top' + (bar ? ' stuck' : '') + (bar > 1 ? ' titled' : '')}>
        <BackButton label={back} />
        <span className="lba-small" aria-hidden={bar < 2}>{small}</span>
        <span className="lba-right">
          {home && (
            <button type="button" className="lba-add" onClick={() => ctx.goChap('ajouter')} aria-label="Ajouter un livre">
              <Ico d={<path d="M12 5v14M5 12h14" />} />
            </button>
          )}
        </span>
      </header>
      <main className={'lba-main' + (home ? '' : ' is-detail')} key={turn}>{content}</main>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Le sommaire                                                                 */
/* -------------------------------------------------------------------------- */
function Sommaire({ chap, counts, cols, books, ctx, readThisYear, goal, year, onWall }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const Row = ({ id, label, n, sub }) => (
    <li>
      <button type="button" className={'lb-toc' + (chap === id ? ' on' : '')} onClick={() => ctx.goChap(id)} aria-current={chap === id ? 'true' : undefined}>
        <span className="lb-toc-l">{label}{sub && <i>{sub}</i>}</span><span className="lb-dots" aria-hidden="true" /><span className="lb-toc-n">{n}</span>
      </button>
    </li>
  )
  const busy = useRef(false)      // (Entrée puis la perte du focus : une seule collection)
  const addCol = e => {
    e.preventDefault()
    if (busy.current) return
    busy.current = true
    setTimeout(() => { busy.current = false }, 300)
    const v = name.trim()
    if (!v) { setAdding(false); return }
    const res = ctx.commit(createShelf(ctx.eff, v))
    setName(''); setAdding(false)
    if (res.id) ctx.goChap('col:' + res.id)
  }
  return (
    <div className="lb-som">
      <header className="lb-som-head">
        <p className="lb-kicker">Maruchime</p>
        <h1>Ma bibliothèque</h1>
        <p className="lb-som-sub">{books.length} livre{books.length > 1 ? 's' : ''} · {readThisYear} lu{readThisYear > 1 ? 's' : ''} en {year}</p>
      </header>
      <button type="button" className={'lb-defi' + (chap === 'defi' ? ' on' : '')} onClick={() => ctx.goChap('defi')}>
        <span className="lb-defi-ring"><Ring value={readThisYear} max={goal || Math.max(readThisYear, 1)} size={52} stroke={5} /><b>{readThisYear}</b></span>
        <span><i>Mon défi {year}</i><b>{goal ? `${readThisYear} sur ${goal} livres` : 'Fixe-toi un objectif'}</b></span>
      </button>
      <h2 className="lb-toc-h">Mes lectures</h2>
      <ol className="lb-tocs">
        {['lis', 'pile', 'lu', 'wish', 'aime'].map(id => <Row key={id} id={id} label={LIST_OF[id].label} n={counts[id]} />)}
      </ol>
      <h2 className="lb-toc-h">Mes livres</h2>
      <ol className="lb-tocs">
        <Row id="tous" label="Tous nos livres" n={counts.tous} />
        <Row id="ai" label="J’ai" n={counts.ai} />
        <Row id="top" label="Mon top 5" n={ctx.api.topBooks.length} />
      </ol>
      <h2 className="lb-toc-h">Mes collections</h2>
      <ol className="lb-tocs">
        {cols.map(s => <Row key={s.id} id={'col:' + s.id} label={s.name} n={s.book_ids.length} />)}
        <li>
          {adding ? (
            <form className="lb-newcol" onSubmit={addCol}>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} onBlur={addCol} placeholder="Le nom de la collection" aria-label="Nom de la nouvelle collection" maxLength={40} />
            </form>
          ) : <button type="button" className="lb-toc add" onClick={() => setAdding(true)}><span className="lb-toc-l">＋ Nouvelle collection</span></button>}
        </li>
      </ol>
      <button type="button" className={'lb-addbtn' + (chap === 'ajouter' ? ' on' : '')} onClick={() => ctx.goChap('ajouter')}>
        <Ico d={<path d="M12 5v14M5 12h14" />} /><span>Ajouter un livre</span>
      </button>
      {onWall && <button type="button" className="lb-wall" onClick={onWall}>Voir l’ancien mur de livres en 3D</button>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Un chapitre                                                                 */
/* -------------------------------------------------------------------------- */
function Chapter({ chap, ctx }) {
  if (chap === 'defi') return <Defi ctx={ctx} />
  if (chap === 'top') return <TopPage ctx={ctx} />
  if (chap === 'ajouter') return <AddPage ctx={ctx} />
  if (chap.startsWith('col:')) {
    const col = ctx.cols.find(s => s.id === chap.slice(4))
    if (!col) return <ListPage list={LIST_OF.tous} ctx={ctx} />
    return <ListPage col={col} ctx={ctx} />
  }
  return <ListPage list={LIST_OF[chap] || LIST_OF.lis} ctx={ctx} />
}

function ListPage({ list, col, ctx }) {
  const { books, reading } = ctx.api
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(() => { try { return localStorage.getItem('levana.livre.tri') || 'recent' } catch { return 'recent' } })
  const setSortP = v => { setSort(v); try { localStorage.setItem('levana.livre.tri', v) } catch { /* ignore */ } }
  const [view, setView] = useState(() => { try { return localStorage.getItem('levana.livre.vue') || 'grid' } catch { return 'grid' } })
  const setViewP = v => { setView(v); try { localStorage.setItem('levana.livre.vue', v) } catch { /* ignore */ } }
  const [renaming, setRenaming] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const byId = useMemo(() => new Map(books.map(b => [b.id, b])), [books])

  let items = col ? col.book_ids.map(id => byId.get(id)).filter(Boolean) : books.filter(list.test)
  if (q.trim()) { const k = q.trim().toLowerCase(); items = items.filter(b => (b.title + ' ' + (b.authors || []).join(' ')).toLowerCase().includes(k)) }
  const sorters = {
    recent: (a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0),
    title: (a, b) => coll.compare(titleKey(a), titleKey(b)),
    author: (a, b) => coll.compare(authorKey(a), authorKey(b)) || coll.compare(titleKey(a), titleKey(b)),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
  }
  const id = list?.id
  if (!col || sort !== 'recent') items = [...items].sort(sorters[sort] || sorters.recent)
  if (id === 'lis') items.sort((a, b) => (reading.datesOf(b.id).start || '').localeCompare(reading.datesOf(a.id).start || ''))
  // « J'ai lu » : année par année, puis « lus il y a longtemps »
  let groups = [{ title: null, list: items }]
  if (id === 'lu' && sort === 'recent') {
    const byYear = new Map()
    for (const b of items) { const y = readYear(b, reading.datesOf(b.id)) || 0; if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(b) }
    groups = [...byYear.entries()].sort((a, b) => (b[0] || -1) - (a[0] || -1)).map(([y, l]) => ({
      title: y ? `Lus en ${y}` : 'Lus il y a longtemps',
      list: y ? l.sort((a, b) => (reading.datesOf(b.id).end || '').localeCompare(reading.datesOf(a.id).end || '')) : l,
    }))
  }
  const metaOf = b => {
    const dt = reading.datesOf(b.id), days = readingDays(dt)
    if (isReading(b) && dt.start) return `depuis ${daysFr(daysSince(dt.start))}`
    if (isRead(b) && dt.end && !dt.longAgo) return `fini le ${dateShort(dt.end)}${days ? ` · ${daysFr(days)}` : ''}`
    return ''
  }
  const total = col ? col.book_ids.length : books.filter(list.test).length
  const n = ROMAN[(LISTS.findIndex(l => l.id === id) + 1) || 0] || ''
  return (
    <div className="lb-chap">
      <header className="lb-chap-head">
        <p className="lb-kicker">{col ? 'Collection' : (n ? `Chapitre ${n} · ` : '') + (list.kicker || 'Mes lectures')}</p>
        {col && renaming ? (
          <form onSubmit={e => { e.preventDefault(); ctx.commit(renameShelf(ctx.eff, col.id, e.currentTarget.elements.n.value)); setRenaming(false) }}>
            <input name="n" className="lb-rename" defaultValue={col.name} autoFocus onBlur={e => { ctx.commit(renameShelf(ctx.eff, col.id, e.target.value)); setRenaming(false) }} maxLength={40} aria-label="Nom de la collection" />
          </form>
        ) : <h1>{col ? col.name : list.label}</h1>}
        <p className="lb-count">{total} livre{total > 1 ? 's' : ''}</p>
        {col && !renaming && (
          <div className="lb-colacts">
            <button type="button" onClick={() => setRenaming(true)}>Renommer</button>
            <button type="button" className={confirmDel ? 'danger' : ''} onClick={() => { if (!confirmDel) { setConfirmDel(true); return } ctx.commit(deleteShelf(ctx.eff, col.id)); ctx.goChap('tous') }}>
              {confirmDel ? 'Supprimer la collection ? (les livres restent)' : 'Supprimer'}
            </button>
          </div>
        )}
      </header>
      {total > 0 && (
        <div className="lb-tools">
          <label className="lb-search"><Ico d={<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Un titre, un auteur…" aria-label="Chercher dans ce chapitre" /></label>
          <label className="lb-sort"><span className="sr-only">Trier</span>
            <select value={sort} onChange={e => setSortP(e.target.value)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <div className="lb-view" role="group" aria-label="Affichage">
            <button type="button" className={view === 'grid' ? 'on' : ''} onClick={() => setViewP('grid')} aria-label="En couvertures"><Ico d={<><rect x="4" y="4" width="6.5" height="7" rx="1" /><rect x="13.5" y="4" width="6.5" height="7" rx="1" /><rect x="4" y="13" width="6.5" height="7" rx="1" /><rect x="13.5" y="13" width="6.5" height="7" rx="1" /></>} /></button>
            <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setViewP('list')} aria-label="En liste"><Ico d={<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1" />} /></button>
          </div>
        </div>
      )}
      {!items.length && <p className="lb-empty">{q ? 'Aucun livre ne correspond.' : col ? 'Cette collection est vide : ouvre un livre et choisis-la dans sa fiche.' : list.empty}</p>}
      {groups.map(g => g.list.length > 0 && (
        <section key={g.title || 'all'}>
          {g.title && <h2 className="lb-h2">{g.title} <em>{g.list.length}</em></h2>}
          {view === 'grid' ? (
            <ul className="lb-grid">
              {g.list.map(b => (
                <li key={b.id}>
                  <button type="button" onClick={() => ctx.openBook(b.id)}>
                    <Cover book={b} />
                    {isLoved(b) && <span className="lb-heart" aria-label="J’aime">♥</span>}
                    <b>{toDisplay(b).title}</b>
                    {metaOf(b) ? <em>{metaOf(b)}</em> : <i>{toDisplay(b).authors[0]}</i>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="lb-rows">
              {g.list.map(b => {
                const d = toDisplay(b)
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => ctx.openBook(b.id)}>
                      <Cover book={b} />
                      <span><b>{d.title}</b><i>{d.authors.join(', ')}</i>{metaOf(b) && <em>{metaOf(b)}</em>}</span>
                      {b.rating > 0 && <span className="lb-stars" aria-label={`${b.rating} sur 5`}>{'★'.repeat(Math.round(b.rating))}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Mon défi                                                                    */
/* -------------------------------------------------------------------------- */
function Defi({ ctx }) {
  const { books, reading } = ctx.api
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const { read, months, pages, avg } = useMemo(() => challenge(books, reading.datesOf, year), [books, reading, year])
  const goal = reading.goalOf(year)
  const now = books.filter(isReading)
  const max = Math.max(1, ...months)
  const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  const dayOfYear = (Date.now() - new Date(thisYear, 0, 1)) / 864e5
  const expected = goal && year === thisYear ? Math.round((goal * dayOfYear) / 365) : null
  return (
    <div className="lb-chap lb-defipage">
      <header className="lb-chap-head">
        <p className="lb-kicker">Défi lecture</p>
        <div className="lb-year">
          <button type="button" onClick={() => setYear(y => y - 1)} aria-label="Année précédente">‹</button>
          <h1>{year}</h1>
          <button type="button" onClick={() => setYear(y => Math.min(thisYear, y + 1))} disabled={year >= thisYear} aria-label="Année suivante">›</button>
        </div>
      </header>
      <section className="lb-defi-hero">
        <div className="lb-defi-big"><Ring value={read.length} max={goal || Math.max(read.length, 1)} size={132} stroke={10} /><div><b>{read.length}</b><span>{goal ? `sur ${goal}` : `livre${read.length > 1 ? 's' : ''}`}</span></div></div>
        <div className="lb-defi-txt">
          <p className="lb-big">{goal ? (read.length >= goal ? 'Défi réussi !' : `Encore ${goal - read.length} livre${goal - read.length > 1 ? 's' : ''}`) : 'Fixe-toi un objectif'}</p>
          {expected != null && read.length < goal && <p className="lb-sub">{read.length >= expected ? 'Tu es dans les temps' : `${expected - read.length} de retard sur le rythme`}</p>}
          <div className="lb-goal">
            <span>Objectif</span>
            <button type="button" onClick={() => reading.setGoal(year, Math.max(1, (goal || 12) - 1))} aria-label="Un livre de moins">−</button>
            <b>{goal || '—'}</b>
            <button type="button" onClick={() => reading.setGoal(year, (goal || 11) + 1)} aria-label="Un livre de plus">+</button>
          </div>
          <p className="lb-defi-stats"><b>{pages.toLocaleString('fr-FR')}</b> pages · <b>{avg ? daysFr(avg) : '—'}</b> par livre</p>
        </div>
      </section>
      <section className="lb-months" aria-label="Livres lus par mois">
        {months.map((n, i) => (
          <div key={i} className={year === thisYear && i === new Date().getMonth() ? 'cur' : ''}><span style={{ height: `${(n / max) * 100}%` }}>{n || ''}</span><em>{MONTHS[i]}</em></div>
        ))}
      </section>
      {now.length > 0 && year === thisYear && (
        <section>
          <h2 className="lb-h2">Je lis</h2>
          <ul className="lb-rows">
            {now.slice(0, 4).map(b => {
              const d = reading.datesOf(b.id)
              return <li key={b.id}><button type="button" onClick={() => ctx.openBook(b.id)}><Cover book={b} /><span><b>{toDisplay(b).title}</b><em>{d.start ? `depuis ${daysFr(daysSince(d.start))}` : 'commencé'}</em></span></button></li>
            })}
          </ul>
        </section>
      )}
      <section>
        <h2 className="lb-h2">Lus en {year}</h2>
        {read.length ? (
          <ul className="lb-grid small">
            {read.map(b => <li key={b.id}><button type="button" onClick={() => ctx.openBook(b.id)}><Cover book={b} /><em>{dateShort(reading.datesOf(b.id).end)}</em></button></li>)}
          </ul>
        ) : <p className="lb-empty">Aucun livre fini en {year} pour l’instant. Passe un livre en « Je lis », puis en « J’ai lu » : il compte ici avec son temps de lecture.</p>}
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Mon top 5                                                                   */
/* -------------------------------------------------------------------------- */
function TopPage({ ctx }) {
  const { topBooks, top } = ctx.api
  return (
    <div className="lb-chap">
      <header className="lb-chap-head">
        <p className="lb-kicker">Mes incontournables</p>
        <h1>Mon top {top.max}</h1>
        <p className="lb-count">Du n° 1 au n° {top.max} : on les monte, on les descend. On en ajoute depuis la fiche d’un livre.</p>
      </header>
      {!topBooks.length && <p className="lb-empty">Ton top est vide. Ouvre la fiche d’un livre et touche « Mettre dans mon top ».</p>}
      <ol className="lb-top">
        {topBooks.map((b, i) => (
          <li key={b.id}>
            <span className="lb-top-n">{i + 1}</span>
            <button type="button" className="lb-top-b" onClick={() => ctx.openBook(b.id)}><Cover book={b} /><span><b>{toDisplay(b).title}</b><i>{toDisplay(b).authors[0]}</i></span></button>
            <span className="lb-top-acts">
              <button type="button" onClick={() => top.move(b.id, -1)} disabled={i === 0} aria-label="Monter">↑</button>
              <button type="button" onClick={() => top.move(b.id, 1)} disabled={i === topBooks.length - 1} aria-label="Descendre">↓</button>
              <button type="button" onClick={() => top.remove(b.id)} aria-label="Retirer du top">×</button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Ajouter un livre                                                            */
/* -------------------------------------------------------------------------- */
function AddPage({ ctx }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [status, setStatus] = useState('')
  useEffect(() => {
    if (!q.trim()) { setRes([]); setStatus(''); return }
    let live = true
    const t = setTimeout(async () => {
      setStatus('Recherche…')
      try {
        const list = await searchBooks(q, { maxResults: 24 })
        if (!live) return
        setRes(list); list.forEach(b => preloadCover(b))
        setStatus(list.length ? '' : 'Aucun résultat')
      } catch { if (live) setStatus('La recherche ne répond pas') }
    }, 380)
    return () => { live = false; clearTimeout(t) }
  }, [q])
  return (
    <div className="lb-chap">
      <header className="lb-chap-head">
        <p className="lb-kicker">Nouveau livre</p>
        <h1>Ajouter un livre</h1>
      </header>
      <div className="lb-addsearch">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Un titre, une autrice, un ISBN…" aria-label="Chercher un livre" autoFocus={!ctx.mobile} enterKeyHint="search" />
        {ctx.onScan && <button type="button" onClick={ctx.onScan}><Ico d={<path d="M4 7V5h3M17 5h3v2M20 17v2h-3M7 19H4v-2M8 8v8M11 8v8M14 8v8M16.5 8v8" />} />Code-barres</button>}
      </div>
      {status && <p className="lb-empty">{status}</p>}
      {!q.trim() && <p className="lb-empty">Cherche dans des millions de livres, ou scanne le code-barres au dos d’un livre.</p>}
      <ul className="lb-grid">
        {res.map(b => {
          const here = ctx.api.isInLibrary(b.googleId)
          return (
            <li key={b.googleId}>
              <button type="button" onClick={() => ctx.setAddItem(b)}>
                <Cover book={b} />
                {here && <span className="lb-here">Déjà là</span>}
                <b>{b.title}</b><i>{b.authors[0]}{b.publishedDate ? ` · ${b.publishedDate.slice(0, 4)}` : ''}</i>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** La fiche d'un livre trouvé : on l'ajoute (J'ai, Je lis, Wishlist), dans une collection. */
function AddSpread({ item, ctx, onBack, onOpenMine }) {
  const { addBook, books, isInLibrary, reading } = ctx.api
  const d = toDisplay(item)
  const mine = books.find(b => b.google_id === item.googleId)
  const [col, setCol] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const add = async statuses => {
    setBusy(true); setMsg('')
    try {
      const saved = await addBook(item, statuses)
      if (saved?.id) {
        if (statuses.includes('en_cours')) reading.setDates(saved.id, { start: today(), end: null, longAgo: false })
        if (col) ctx.commit(moveBook(effectiveShelves(ctx.api.shelves, [...books, saved]), saved.id, col, Infinity))
        onOpenMine(saved.id)
      }
    } catch (e) { setMsg('Erreur : ' + (e.message || e)); setBusy(false) }
  }
  const head = (
    <>
        <p className="lb-kicker">{d.authors.join(', ')}</p>
        <h1 className="lb-title">{d.title}</h1>
        <p className="lb-meta">{[d.year, d.pageCount ? `${d.pageCount} pages` : '', d.categories[0]].filter(Boolean).join(' · ')}</p>
    </>
  )
  const rest = (
    <>
        {mine || isInLibrary(item.googleId) ? (
          <div className="lb-addacts"><p>Déjà dans ta bibliothèque.</p>{mine && <button type="button" className="lb-btn main" onClick={() => onOpenMine(mine.id)}>Ouvrir sa fiche</button>}</div>
        ) : (
          <>
            <div className="lb-addacts">
              <button type="button" className="lb-btn main" disabled={busy} onClick={() => add(['possede'])}>J’ai ce livre</button>
              <button type="button" className="lb-btn" disabled={busy} onClick={() => add(['en_cours', 'possede'])}>Je le lis</button>
              <button type="button" className="lb-btn" disabled={busy} onClick={() => add(['souhaite'])}>Wishlist</button>
            </div>
            {ctx.cols.length > 0 && (
              <label className="lb-field"><span>Collection</span>
                <select value={col} onChange={e => setCol(e.target.value)}>
                  <option value="">Aucune</option>
                  {ctx.cols.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
          </>
        )}
        {msg && <p className="lb-err">{msg}</p>}
        <Resume text={d.description} />
    </>
  )
  if (ctx.mobile) {
    return (
      <div className="lba-fiche">
        <div className="lba-hero"><Cover book={item} sharp className="big" /><div>{head}</div></div>
        {rest}
      </div>
    )
  }
  return (
    <>
      <div className="lb-page lb-left"><div className="lb-pagein lb-fiche-l">
        <button type="button" className="lb-crumb" onClick={onBack}><Ico d={<path d="M15 5l-7 7 7 7" />} />Ajouter</button>
        <Cover book={item} sharp className="big" />
      </div></div>
      <div className="lb-page lb-right"><div className="lb-pagein lb-fiche-r">
        {head}
        {rest}
      </div></div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* La fiche d'un de nos livres : une double page                               */
/* -------------------------------------------------------------------------- */
function BookSpread({ book, ctx, back, onBack }) {
  const { updateBook, removeBook, reading, top, topBooks } = ctx.api
  const d = toDisplay(book)
  const dates = reading.datesOf(book.id)
  const st = new Set(book.statuses || (book.status ? [book.status] : []))
  const [ask, setAsk] = useState(false)
  const [err, setErr] = useState('')
  const [notes, setNotes] = useState(book.notes || '')
  const [saved, setSaved] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const datesRef = useRef(null)
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 1600); return () => clearTimeout(t) }, [saved])
  const toggle = async id => {
    const r = toggleState(book, id, dates)
    try {
      if (r.dates) reading.setDates(book.id, r.dates)
      await updateBook(book.id, { statuses: r.statuses })
      if (r.askDates) { setAsk(true); setTimeout(() => datesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60) }
    } catch (e) { setErr('Erreur : ' + (e.message || e)) }
  }
  const setD = patch => { reading.setDates(book.id, patch); setAsk(false) }
  const rate = async v => { try { await updateBook(book.id, { rating: book.rating === v ? null : v }) } catch (e) { setErr('Erreur : ' + (e.message || e)) } }
  const saveNotes = async () => { if ((book.notes || '') === notes) return; try { await updateBook(book.id, { notes }); setSaved(true) } catch (e) { setErr('Erreur : ' + (e.message || e)) } }
  const days = readingDays(dates)
  const rank = topBooks.findIndex(b => b.id === book.id) + 1
  const col = ctx.colOf(book.id)
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    try { await removeBook(book.id); onBack() } catch (e) { setErr('Erreur : ' + (e.message || e)) }
  }
  const side = (
    <div className="lb-side">
      <button type="button" className={'lb-chip' + (rank ? ' on' : '')} onClick={() => (rank ? top.remove(book.id) : top.add(book.id, topBooks.length >= top.max ? topBooks[topBooks.length - 1].id : undefined))}>
        ★ {rank ? `N° ${rank} de mon top` : topBooks.length >= top.max ? `Remplacer le n° ${top.max} de mon top` : 'Mettre dans mon top'}
      </button>
      {ctx.cols.length > 0 && (
        <label className="lb-field"><span>Collection</span>
          <select value={col?.id || ''} onChange={e => ctx.commit(moveBook(ctx.eff, book.id, e.target.value || LOOSE, Infinity))}>
            <option value="">Aucune</option>
            {ctx.cols.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      <button type="button" className={'lb-remove' + (confirmDel ? ' danger' : '')} onClick={remove}>{confirmDel ? 'Retirer ce livre de la bibliothèque ?' : 'Retirer de la bibliothèque'}</button>
    </div>
  )
  const head = (
    <>
        <p className="lb-kicker">{d.authors.join(', ')}</p>
        <h1 className="lb-title">{d.title}</h1>
        <p className="lb-meta">{[d.year, d.pageCount ? `${d.pageCount} pages` : '', d.categories[0]].filter(Boolean).join(' · ')}</p>
    </>
  )
  const body = (
    <>
        <div className="lb-states" role="group" aria-label="Mes statuts">
          {BOOK_STATES.map(s => (
            <button type="button" key={s.id} className={'lb-state s-' + s.id + (st.has(s.id) ? ' on' : '')} aria-pressed={st.has(s.id)} onClick={() => toggle(s.id)}>
              <span><Ico d={STATE_ICON[s.id]} /></span><em>{s.short}</em>
            </button>
          ))}
        </div>
        {(st.has('en_cours') || st.has('lu')) && (
          <section className={'lb-dates' + (ask ? ' ask' : '')} ref={datesRef}>
            {ask && <p className="lb-ask">Lu quand ? Donne des dates pour qu’il compte dans ton défi {new Date().getFullYear()}, ou laisse « Lu il y a longtemps ».</p>}
            {st.has('lu') && (
              <label className="lb-switch">
                <span>Lu il y a longtemps</span>
                <input type="checkbox" checked={!!dates.longAgo} onChange={e => setD(e.target.checked ? { longAgo: true, start: null, end: null } : { longAgo: false })} />
                <i aria-hidden="true" />
              </label>
            )}
            {!dates.longAgo && (
              <div className="lb-daterow">
                <label><span>Début</span><input type="date" value={dates.start || ''} max={dates.end || undefined} onChange={e => setD({ start: e.target.value || null })} /></label>
                {st.has('lu') && <label><span>Fin</span><input type="date" value={dates.end || ''} min={dates.start || undefined} onChange={e => setD({ end: e.target.value || null })} /></label>}
              </div>
            )}
            <p className="lb-time">
              {dates.longAgo ? 'Ne compte pas dans le défi de l’année.'
                : st.has('en_cours') && dates.start ? `En cours depuis ${daysFr(daysSince(dates.start))}`
                  : days ? <>Lu en <b>{daysFr(days)}</b>{d.pageCount ? ` · ${Math.round(d.pageCount / days)} pages par jour` : ''}{dates.end ? ` · fini le ${dateFr(dates.end)}` : ''}</>
                    : 'Temps de lecture : —'}
            </p>
          </section>
        )}
        <div className="lb-rate" role="radiogroup" aria-label="Ma note sur cinq">
          {[1, 2, 3, 4, 5].map(v => <button type="button" key={v} className={(book.rating || 0) >= v ? 'on' : ''} onClick={() => rate(v)} aria-label={`${v} sur 5`}>★</button>)}
        </div>
        {err && <p className="lb-err">{err}</p>}
        <label className="lb-notes"><span>Mes notes {saved && <em>enregistré ✓</em>}</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} rows={3} placeholder="Une impression, une citation, la page où tu t’es arrêtée…" />
        </label>
        <Resume text={d.description} />
        {d.isbn && <p className="lb-isbn">ISBN {d.isbn}</p>}
    </>
  )
  // téléphone : une seule colonne (la couverture et le titre côte à côte, puis tout le reste)
  if (ctx.mobile) {
    return (
      <div className="lba-fiche">
        <div className="lba-hero"><Cover book={book} sharp className="big" /><div>{head}</div></div>
        {body}
        {side}
      </div>
    )
  }
  return (
    <>
      <div className="lb-page lb-left"><div className="lb-pagein lb-fiche-l">
        <button type="button" className="lb-crumb" onClick={onBack}><Ico d={<path d="M15 5l-7 7 7 7" />} />{back || 'Retour'}</button>
        <Cover book={book} sharp className="big" />
        {side}
      </div></div>
      <div className="lb-page lb-right"><div className="lb-pagein lb-fiche-r">
        {head}
        {body}
      </div></div>
    </>
  )
}

function Resume({ text }) {
  const [more, setMore] = useState(false)
  if (!text) return <p className="lb-resume empty">Aucun résumé pour ce livre.</p>
  const long = text.length > 600
  return (
    <div className="lb-resume">
      <h2 className="lb-h2">Résumé</h2>
      <p className={long && !more ? 'clamped' : ''}>{text}</p>
      {long && <button type="button" onClick={() => setMore(m => !m)}>{more ? 'Réduire' : 'Lire la suite'}</button>}
    </div>
  )
}
