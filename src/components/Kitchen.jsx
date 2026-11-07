import { useEffect, useMemo, useRef, useState } from 'react'
import { useKitchen } from '../hooks/useKitchen'
import { AISLES, INGREDIENTS, aisleOf, findIngredients, inPantry } from '../lib/ingredients'
import { recipesWith, searchRecipes, randomRecipes, recipeDetail, toEnglish, DISH_TYPES, DIETS, amountFr, timeFr } from '../lib/recipes'
import { relayUrl } from '../lib/covers'
import { useIsMobile } from '../hooks/useIsMobile'
import { isoDay, addDays, daysLeft, urgency, leftFr, dayFr, QUICK_DATES, planWeek, slim } from '../lib/pantryDates'

/**
 * La cuisine : une pièce en 3D (le frigo, les placards, la tablette, la liste de courses sur le
 * frigo). On ouvre le frigo ou les placards pour dire ce qu'on a ; la tablette ouvre l'appli de
 * recettes, qui propose d'abord ce qu'on peut cuisiner avec ce qu'il nous reste.
 */
const PLACE = { frigo: { title: 'Le frigo', one: 'dans le frigo' }, placard: { title: 'Les placards', one: 'dans les placards' } }
const CLASSICS = {
  frigo: ['Œufs', 'Lait', 'Beurre', 'Crème fraîche', 'Fromage râpé', 'Yaourt nature', 'Jambon', 'Lardons', 'Poulet', 'Tomates', 'Carottes', 'Courgettes', 'Salade', 'Citron', 'Moutarde', 'Pommes'],
  placard: ['Pâtes', 'Riz', 'Farine', 'Sucre', 'Huile d’olive', 'Sel', 'Poivre', 'Oignons', 'Ail', 'Pommes de terre', 'Tomates pelées', 'Bouillon', 'Lentilles', 'Thon en boîte', 'Chocolat noir', 'Levure chimique'],
}
const byFr = new Map(INGREDIENTS.map(i => [i.fr, i]))
const byExpiry = (a, b) => (a.expires || '9999').localeCompare(b.expires || '9999')
const isUrgent = i => i.expires && daysLeft(i.expires) <= 2

const Close = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
const Back = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
const CartIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.1" /><circle cx="9.5" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></svg>
const CalIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
const Heart = ({ on }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" className={on ? 'fill' : ''} /></svg>

export default function Kitchen({ userId, scene, onClose }) {
  const k = useKitchen(userId)
  const mobile = useIsMobile()
  const sceneRef = useRef(scene)
  const rootRef = useRef(null)
  const [view, setView] = useState(null)       // où la caméra va
  const [arrived, setArrived] = useState(null) // où elle est arrivée (le panneau s'ouvre)
  const [app, setApp] = useState(null)         // l'appli de recettes : { tab, from }
  const [chip, setChip] = useState(null)
  const cb = useRef({})
  cb.current.tap = kind => go(kind)

  // la maquette existe déjà (elle était au fond du carrousel) : on prend la main
  useEffect(() => {
    const s = scene
    sceneRef.current = s
    s.cb = {
      onHover: (label, x, y) => setChip(label ? { label, x, y } : null),
      onTap: kind => cb.current.tap(kind),
      onArrive: kind => { setArrived(kind); if (kind === 'tablette') setApp(a => a || { tab: 'frigo', from: s.tabletRect() }) },
    }
    rootRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' })
    return () => { s.cb = {} }
  }, [scene])
  useEffect(() => { sceneRef.current?.setPantry(k.pantry) }, [k.pantry])
  useEffect(() => { sceneRef.current?.setShopping(k.shopping.filter(s => !s.done).map(s => s.fr)) }, [k.shopping])

  const go = kind => {
    if (kind === view && kind) return
    setArrived(null)
    setView(kind)
    sceneRef.current?.focus(kind)
  }
  const back = () => go(null)
  const openApp = tab => { setApp({ tab, from: null }); if (view !== 'tablette') { setView('tablette'); sceneRef.current?.focus('tablette') } }
  const closeApp = () => { setApp(null); go(null) }
  const leave = () => {
    setArrived(null); setView(null)
    const el = rootRef.current
    if (!el?.animate) { onClose(); return }
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' }).finished.then(onClose, onClose)
  }
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { if (app) closeApp(); else if (view) back() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const count = p => k.pantry.filter(i => (p === 'placard' ? i.place === 'placard' : i.place !== 'placard')).length
  const todo = k.shopping.filter(s => !s.done).length
  const hurry = k.pantry.filter(isUrgent).length

  return (
    <div className={'kitchen' + (view ? ' focused' : '') + (app ? ' app-open' : '')} ref={rootRef}>

      <header className="kt-top">
        <button type="button" className="kt-back" onClick={view && !app ? back : leave}>
          <Back /><span>{view && !app ? 'La cuisine' : 'Le salon'}</span>
        </button>
        <div className="kt-title"><b>La cuisine</b><span>Maruchime</span></div>
        <span className="kt-top-r" />
      </header>

      {chip && !mobile && <div className="salon-chip lbl" style={{ transform: `translate(${chip.x + 14}px, ${chip.y + 16}px)` }}>{chip.label}</div>}

      {!view && (
        <nav className="kt-dock" aria-label="La cuisine">
          <button type="button" onClick={() => go('frigo')}><span className="kt-ico">🧊</span><b>Le frigo</b>{hurry > 0 ? <em className="warn" title="À finir vite">{hurry}</em> : <em>{count('frigo')}</em>}</button>
          <button type="button" onClick={() => go('placard')}><span className="kt-ico">🫙</span><b>Les placards</b><em>{count('placard')}</em></button>
          <button type="button" className="main" onClick={() => go('tablette')}><span className="kt-ico">📖</span><b>Les recettes</b></button>
          <button type="button" onClick={() => openApp('semaine')}><span className="kt-ico">📅</span><b>La semaine</b>{k.week?.days?.length > 0 && <em>{k.week.days.filter(d => !d.done).length}</em>}</button>
          <button type="button" onClick={() => go('courses')}><span className="kt-ico">📝</span><b>Les courses</b>{todo > 0 && <em>{todo}</em>}</button>
        </nav>
      )}
      {!view && <p className="kt-hint">{mobile ? 'Glisse pour tourner la cuisine · touche le frigo ou les placards' : 'Fais glisser pour tourner la cuisine · clique sur le frigo, les placards ou la tablette'}</p>}

      {(arrived === 'frigo' || arrived === 'placard') && (
        <PantryPanel key={arrived} place={arrived} k={k} onClose={back} onRecipes={() => openApp('frigo')} onWeek={() => openApp('semaine')} onOther={() => go(arrived === 'frigo' ? 'placard' : 'frigo')} />
      )}
      {arrived === 'courses' && <ShoppingPanel k={k} onClose={back} />}
      {app && <RecipeApp k={k} start={app} onClose={closeApp} onOpenPlace={p => { setApp(null); go(p) }} onShow={(t, img) => sceneRef.current?.setTablet(t, img ? relayUrl(img) : null)} />}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Le frigo et les placards : ce qu'on a, rangé par rayon                     */
/* -------------------------------------------------------------------------- */
function PantryPanel({ place, k, onClose, onRecipes, onWeek, onOther }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [dateFor, setDateFor] = useState(null)   // l'article dont on règle la date
  const inputRef = useRef(null)
  const here = k.pantry.filter(i => (place === 'placard' ? i.place === 'placard' : i.place !== 'placard'))
  const has = fr => here.some(i => i.fr === fr)
  const sugg = q.trim() ? findIngredients(q, 7) : []
  const exact = sugg.find(s => s.fr.toLowerCase() === q.trim().toLowerCase())
  const classics = CLASSICS[place].filter(f => !has(f)).map(f => byFr.get(f)).filter(Boolean).slice(0, 10)
  const groups = AISLES.map(a => ({ a, list: here.filter(i => i.aisle === a.id).sort(byExpiry) })).filter(g => g.list.length)
  const hurry = here.filter(isUrgent).sort(byExpiry)
  const other = place === 'frigo' ? 'placard' : 'frigo'

  // au frigo, ce qu'on range se périme : on propose tout de suite sa date (un geste, ou rien)
  const add = it => { const item = k.addItem(it, place); setQ(''); if (place === 'frigo') setDateFor(item.id); inputRef.current?.focus() }
  const addCustom = async () => {
    const fr = q.trim()
    if (!fr) return
    if (exact) { add(exact); return }
    setBusy(true)
    const en = await toEnglish(fr)
    setBusy(false)
    add({ fr: fr.charAt(0).toUpperCase() + fr.slice(1), en })
  }

  return (
    <section className={'kt-panel kt-pantry pl-' + place} role="dialog" aria-label={PLACE[place].title}>
      <header className="kt-panel-head">
        <div>
          <p className="kt-kicker">{here.length ? `${here.length} ingrédient${here.length > 1 ? 's' : ''}` : 'C’est vide pour l’instant'}</p>
          <h2>{PLACE[place].title}</h2>
        </div>
        <button type="button" className="kt-x" onClick={onClose} aria-label="Fermer"><Close /></button>
      </header>

      <form className="kt-add" onSubmit={e => { e.preventDefault(); addCustom() }}>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder={place === 'frigo' ? 'Ajouter : œufs, crème, poulet…' : 'Ajouter : pâtes, riz, farine…'} aria-label="Ajouter un ingrédient" enterKeyHint="done" />
        {q.trim() && <button type="submit" className="kt-add-go" disabled={busy}>{busy ? '…' : 'Ajouter'}</button>}
      </form>
      {q.trim() && (
        <div className="kt-sugg">
          {sugg.map(s => (
            <button type="button" key={s.fr} className={'kt-chip' + (has(s.fr) ? ' on' : '')} disabled={has(s.fr)} onClick={() => add(s)}>
              <span>{s.emoji}</span>{s.fr}{has(s.fr) && <i>déjà là</i>}
            </button>
          ))}
          {!exact && <button type="button" className="kt-chip new" onClick={addCustom}><span>＋</span>« {q.trim()} »</button>}
        </div>
      )}

      <div className="kt-panel-body">
        {hurry.length > 0 && !q.trim() && (
          <div className="kt-hurry">
            <p><b>À finir vite</b> {hurry.map(i => `${i.fr.toLowerCase()} (${leftFr(i.expires)})`).join(', ')}</p>
            <button type="button" onClick={onWeek}>Prévoir les repas →</button>
          </div>
        )}
        {!q.trim() && classics.length > 0 && (
          <div className="kt-classics">
            <h3>Les classiques <em>un toucher pour ranger</em></h3>
            <div className="kt-chips">
              {classics.map(c => <button type="button" key={c.fr} className="kt-chip" onClick={() => add(c)}><span>{c.emoji}</span>{c.fr}</button>)}
            </div>
          </div>
        )}
        {groups.map(({ a, list }) => (
          <div className="kt-group" key={a.id}>
            <h3>{a.label}</h3>
            <ul>
              {list.map(i => (
                <li key={i.id} className={dateFor === i.id ? 'editing' : ''}>
                  <div className="kt-row">
                    <span className="kt-emo">{i.emoji}</span>
                    <span className="kt-name">{i.fr}</span>
                    <button type="button" className="kt-mini" onClick={() => k.moveItem(i.id, other)} title={other === 'frigo' ? 'Mettre au frigo' : 'Mettre dans les placards'}>{other === 'frigo' ? '→ frigo' : '→ placard'}</button>
                    <button type="button" className={'kt-date' + (i.expires ? ' u-' + urgency(daysLeft(i.expires)) : ' none')} onClick={() => setDateFor(f => (f === i.id ? null : i.id))}
                      aria-expanded={dateFor === i.id} aria-label={i.expires ? `À consommer ${leftFr(i.expires)} : changer la date` : `Date de péremption de ${i.fr}`}>
                      {i.expires ? leftFr(i.expires) : <><CalIcon />date</>}
                    </button>
                    <button type="button" className="kt-del" onClick={() => k.removeItem(i.id)} aria-label={`Retirer ${i.fr}`}><Close /></button>
                  </div>
                  {dateFor === i.id && <DateEdit item={i} k={k} onDone={() => setDateFor(null)} />}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!here.length && <p className="kt-empty">Ajoute ce que tu as {PLACE[place].one} : la tablette te proposera des recettes avec.</p>}
      </div>

      <footer className="kt-panel-foot">
        <button type="button" className="kt-ghost" onClick={onOther}>{place === 'frigo' ? 'Les placards' : 'Le frigo'} →</button>
        <button type="button" className="kt-cta" onClick={onRecipes} disabled={!k.pantry.length}>Que cuisiner avec ça ?</button>
      </footer>
    </section>
  )
}

/** La date de péremption d'un article : un raccourci, ou le calendrier. */
function DateEdit({ item, k, onDone }) {
  const today = isoDay()
  const ref = useRef(null)
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) }, [])
  const set = v => { k.setExpiry(item.id, v); onDone() }
  return (
    <div className="kt-dateedit" ref={ref}>
      <span className="kt-dateedit-l">À consommer avant</span>
      <div className="kt-chips">
        {QUICK_DATES.map(([l, n]) => {
          const v = addDays(today, n)
          return <button type="button" key={l} className={'kt-chip' + (item.expires === v ? ' on' : '')} onClick={() => set(v)}>{l}</button>
        })}
        <label className="kt-chip kt-cal"><CalIcon /><span>{item.expires ? new Date(item.expires + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Autre date'}</span>
          <input type="date" value={item.expires || ''} min={addDays(today, -30)} onChange={e => e.target.value && set(e.target.value)} aria-label="Choisir la date" />
        </label>
        {item.expires && <button type="button" className="kt-chip ghost" onClick={() => set(null)}>Sans date</button>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* La liste de courses (aimantée sur le frigo)                                */
/* -------------------------------------------------------------------------- */
function ShoppingPanel({ k, onClose }) {
  const [q, setQ] = useState('')
  const done = k.shopping.filter(s => s.done).length
  const add = () => { const t = q.trim(); if (!t) return; k.addShopping([{ fr: t.charAt(0).toUpperCase() + t.slice(1) }]); setQ('') }
  return (
    <section className="kt-panel kt-shop" role="dialog" aria-label="La liste de courses">
      <header className="kt-panel-head">
        <div><p className="kt-kicker">{k.shopping.length ? `${k.shopping.length - done} à acheter` : 'Rien à acheter'}</p><h2>Les courses</h2></div>
        <button type="button" className="kt-x" onClick={onClose} aria-label="Fermer"><Close /></button>
      </header>
      <form className="kt-add" onSubmit={e => { e.preventDefault(); add() }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ajouter à la liste…" aria-label="Ajouter à la liste" enterKeyHint="done" />
        {q.trim() && <button type="submit" className="kt-add-go">Ajouter</button>}
      </form>
      <div className="kt-panel-body">
        <ul className="kt-shoplist">
          {k.shopping.map(s => (
            <li key={s.id} className={s.done ? 'done' : ''}>
              <button type="button" className="kt-check" onClick={() => k.toggleShopping(s.id)} aria-pressed={s.done} aria-label={s.done ? `Décocher ${s.fr}` : `Cocher ${s.fr}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </button>
              <span className="kt-emo">{s.emoji}</span>
              <span className="kt-name">{s.fr}{s.qty && <i className="kt-qty"> · {s.qty}</i>}{s.from?.length > 0 && <small className="kt-from">pour {s.from.join(', ')}</small>}</span>
              <button type="button" className="kt-del" onClick={() => k.removeShopping(s.id)} aria-label={`Retirer ${s.fr}`}><Close /></button>
            </li>
          ))}
        </ul>
        {!k.shopping.length && <p className="kt-empty">Depuis une recette, « Ajouter aux courses » écrit ici ce qui manque.</p>}
      </div>
      <footer className="kt-panel-foot">
        <button type="button" className="kt-cta" onClick={k.storeShopping} disabled={!done}>{done ? `Ranger ${done} article${done > 1 ? 's' : ''} achetés` : 'Coche ce que tu as acheté'}</button>
      </footer>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* L'appli de recettes (la tablette)                                          */
/* -------------------------------------------------------------------------- */
function RecipeApp({ k, start, onClose, onOpenPlace, onShow }) {
  const [tab, setTab] = useState(start.tab || 'frigo')
  const [open, setOpen] = useState(null)          // id de la recette ouverte
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current, r = start.from
    if (!el?.animate || !r?.width) return
    const W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight
    el.animate([
      { transform: `translate(${r.left}px, ${r.top}px) scale(${r.width / W}, ${r.height / H})`, borderRadius: '40px', opacity: 0.4 },
      { transform: 'none', borderRadius: '0px', opacity: 1 },
    ], { duration: 520, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const TABS = [['semaine', 'Ma semaine'], ['frigo', 'Mon frigo'], ['chercher', 'Chercher'], ['miennes', 'Mes recettes']]
  return (
    <div className="kt-app" ref={ref} role="dialog" aria-label="Les recettes">
      <header className="ka-top">
        <div className="ka-brand"><span>🍲</span><b>Recettes</b></div>
        <nav className="ka-tabs" style={{ '--i': TABS.findIndex(t => t[0] === tab), '--n': TABS.length }} aria-label="Les recettes">
          <span className="ka-thumb" aria-hidden="true" />
          {TABS.map(([id, label]) => <button type="button" key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setOpen(null) }}>{label}</button>)}
        </nav>
        <button type="button" className="ka-close" onClick={onClose} aria-label="Ranger la tablette"><Close /></button>
      </header>
      <main className="ka-main">
        {tab === 'semaine' && <WeekPlan k={k} onOpen={setOpen} onOpenPlace={onOpenPlace} />}
        {tab === 'frigo' && <WithPantry k={k} onOpen={setOpen} onOpenPlace={onOpenPlace} />}
        {tab === 'chercher' && <Search onOpen={setOpen} />}
        {tab === 'miennes' && <Mine k={k} onOpen={setOpen} />}
      </main>
      {open && <RecipePage id={open} k={k} onBack={() => setOpen(null)} onShow={onShow} onCourses={() => onOpenPlace('courses')} />}
    </div>
  )
}

function KeyMissing({ err }) {
  if (err?.missing === 'spoonacular') {
    return (
      <div className="ka-state">
        <p className="ka-state-emo">🔑</p>
        <h3>Il manque la clé du livre de recettes</h3>
        <p>Dans Vercel → Settings → Environment Variables, ajoute <code>SPOONACULAR_API_KEY</code> (et <code>DEEPL_API_KEY</code> pour le français), puis redéploie. Le frigo et les placards marchent déjà.</p>
      </div>
    )
  }
  return <div className="ka-state"><p className="ka-state-emo">🍳</p><h3>Oups</h3><p>{err?.message || 'Le livre de recettes ne répond pas.'}</p></div>
}
const Loading = () => <div className="ka-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="ka-card skel"><div className="ka-img" /><p /><p /></div>)}</div>

function useAsync(fn, deps) {
  const [st, setSt] = useState({ loading: true })
  useEffect(() => {
    let live = true
    setSt(s => ({ ...s, loading: true, error: null }))
    fn().then(data => live && setSt({ data }), error => live && setSt({ error }))
    return () => { live = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return st
}

function Card({ r, onOpen, fav }) {
  const missed = r.missed?.length ?? null
  return (
    <button type="button" className="ka-card" onClick={() => onOpen(r.id)}>
      <div className="ka-img">{r.image && <img src={r.image} alt="" loading="lazy" />}{fav && <span className="ka-fav">♥</span>}
        {missed != null && <span className={'ka-badge' + (missed === 0 ? ' ok' : '')}>{missed === 0 ? 'Tout est là' : `Il manque ${missed}`}</span>}
      </div>
      <h4>{r.title}</h4>
      {r.used ? (
        <p className="ka-use">
          <span className="yes">✓ {r.used.length} de chez toi</span>
          {missed > 0 && <span className="no"> · {r.missed.slice(0, 3).map(m => m.fr.toLowerCase()).join(', ')}{missed > 3 ? '…' : ''}</span>}
        </p>
      ) : <p className="ka-use">{[timeFr(r.time), r.servings ? `${r.servings} pers.` : ''].filter(Boolean).join(' · ')}</p>}
    </button>
  )
}

/**
 * Ma semaine : des recettes pour les jours qui viennent, qui finissent d'abord ce qui périme.
 * On demande deux listes au livre de recettes (avec tout ce qu'on a, et avec ce qui presse),
 * puis on choisit et on pose une recette par jour, la plus pressée en premier.
 */
function WeekPlan({ k, onOpen, onOpenPlace }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [count, setCount] = useState(k.week?.count || 7)
  const [toast, setToast] = useState(null)
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t) }, [toast])
  const today = isoDay()
  const week = k.week
  const live = week?.days?.length && daysLeft(addDays(week.start, week.days.length - 1), today) >= 0
  const match = en => inPantry(en, k.pantry)
  const soon = k.pantry.filter(i => i.expires && daysLeft(i.expires) <= 6).sort(byExpiry)
  // les ingrédients de la recette, revus avec tout ce qu'on a (pas seulement ce qu'on a demandé)
  const recheck = r => {
    const all = [...(r.used || []), ...(r.missed || [])]
    return { ...r, used: all.filter(x => match(x.en)), missed: all.filter(x => !match(x.en)) }
  }

  const build = async n => {
    setBusy(true); setErr(null)
    try {
      const have = [...new Set(k.pantry.map(i => i.en).filter(Boolean))]
      const hurry = [...new Set(soon.map(i => i.en))].slice(0, 10)
      const [a, b] = await Promise.all([recipesWith(have, 'missing', 36), hurry.length ? recipesWith(hurry, 'used', 36) : { results: [] }])
      const seen = new Set()
      const pool = [...b.results, ...a.results].filter(r => !seen.has(r.id) && seen.add(r.id)).map(recheck)
      const days = planWeek(pool, match, { count: n, start: today })
      k.setWeek({ start: today, count: n, days, pool: pool.map(slim), skipped: [] })
    } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  const swap = i => {
    const ids = week.days.map(d => d.recipe.id)
    const skipped = [...(week.skipped || []), week.days[i].recipe.id]
    const taken = week.days.filter((d, j) => j !== i).flatMap(d => d.recipe.used.map(u => match(u.en)?.id).filter(Boolean))
    const [next] = planWeek((week.pool || []).map(recheck), match, { count: 1, start: week.days[i].date, skip: [...ids, ...skipped], taken })
    if (!next) { setToast('Plus d’autre idée : refais la semaine'); return }
    k.setWeek({ ...week, skipped, days: week.days.map((d, j) => (j === i ? { ...next, date: d.date } : d)) })
  }
  const missing = live ? week.days.filter(d => !d.done).flatMap(d => recheck(d.recipe).missed.filter(m => !k.inShopping(m.fr)).map(m => ({ ...m, from: d.recipe.title }))) : []
  const missingUnique = [...new Map(missing.map(m => [m.fr.toLowerCase(), m])).values()]
  const covered = live ? new Set(week.days.flatMap(d => recheck(d.recipe).used.map(u => match(u.en)?.id))) : new Set()
  const soonLive = soon.filter(i => daysLeft(i.expires) >= 0)     // (ce qui est déjà périmé ne se prévoit plus)
  const notPlanned = soonLive.filter(i => !covered.has(i.id))

  if (!k.pantry.length) {
    return (
      <div className="ka-state">
        <p className="ka-state-emo">📅</p>
        <h3>D’abord, le frigo</h3>
        <p>Range ce que tu as (avec les dates de péremption) : la semaine finira d’abord ce qui presse.</p>
        <div className="ka-state-row"><button type="button" className="kt-cta" onClick={() => onOpenPlace('frigo')}>Ouvrir le frigo</button></div>
      </div>
    )
  }
  if (!live) {
    return (
      <div className="kw-start">
        <p className="kt-kicker">Ma semaine</p>
        <h2>Les repas des jours qui viennent</h2>
        <p className="kw-lead">On choisit des recettes avec ce que tu as, en finissant d’abord ce qui périme bientôt.</p>
        {soon.length > 0 ? (
          <ul className="kw-soon">
            {soon.map(i => <li key={i.id} className={'u-' + urgency(daysLeft(i.expires))}><span>{i.emoji}</span>{i.fr}<em>{leftFr(i.expires)}</em></li>)}
          </ul>
        ) : (
          <p className="kw-tip">Astuce : mets les dates de péremption dans le frigo (le petit 📅 à côté de chaque aliment), la semaine s’en servira.</p>
        )}
        <div className="kw-count" role="group" aria-label="Combien de repas">
          {[3, 5, 7].map(n => <button type="button" key={n} className={'kt-chip' + (count === n ? ' on' : '')} onClick={() => setCount(n)}>{n} repas</button>)}
        </div>
        <button type="button" className="kt-cta kw-go" onClick={() => build(count)} disabled={busy}>{busy ? 'On cherche…' : 'Préparer ma semaine'}</button>
        {err && <KeyMissing err={err} />}
      </div>
    )
  }
  return (
    <div className="kw">
      <div className="ka-intro kw-head">
        <h2>Ma semaine</h2>
        <p>{week.days.length} repas · {soonLive.length ? `${soonLive.length - notPlanned.length} des ${soonLive.length} aliments qui périment bientôt sont prévus` : 'rien ne périme dans les jours qui viennent'}</p>
        {notPlanned.length > 0 && <p className="kw-left">Pas encore prévu : {notPlanned.map(i => `${i.fr.toLowerCase()} (${leftFr(i.expires)})`).join(', ')}</p>}
      </div>
      <ol className="kw-days">
        {week.days.map((d, i) => {
          const r = recheck(d.recipe)
          const items = r.used.map(u => ({ u, it: match(u.en) })).filter(x => x.it)
          const dated = items.filter(x => x.it.expires).sort((a, b) => byExpiry(a.it, b.it))
          const late = dated.filter(x => daysLeft(x.it.expires, d.date) < 0)
          const past = daysLeft(d.date, today) < 0
          return (
            <li key={d.date} className={'kw-day' + (d.done ? ' done' : '') + (past && !d.done ? ' past' : '')}>
              <div className="kw-when"><b>{dayFr(d.date, today)}</b><span>{new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></div>
              <button type="button" className="kw-recipe" onClick={() => onOpen(r.id)}>
                <span className="kw-img">{r.image && <img src={r.image} alt="" loading="lazy" />}</span>
                <span className="kw-txt">
                  <b>{r.title}</b>
                  <span className="kw-uses">
                    {dated.slice(0, 3).map(({ it }) => <i key={it.id} className={'u-' + urgency(daysLeft(it.expires))}>{it.fr.toLowerCase()} · {leftFr(it.expires)}</i>)}
                    {items.length > dated.length && <i className="plain">{dated.length ? '+ ' : ''}{items.length - dated.length} de chez toi</i>}
                    {r.missed.length > 0 && <i className="miss">il manque {r.missed.length}</i>}
                  </span>
                  {late.length > 0 && <span className="kw-late">⚠ {late.map(x => x.it.fr.toLowerCase()).join(', ')} {late.length > 1 ? 'seront périmés' : 'sera périmé'} ce jour-là</span>}
                </span>
              </button>
              <div className="kw-acts">
                <button type="button" className={'kw-check' + (d.done ? ' on' : '')} onClick={() => k.setDay(i, { done: !d.done })} aria-pressed={d.done} aria-label={d.done ? 'Pas encore fait' : 'Fait'}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </button>
                {!d.done && <button type="button" className="kw-swap" onClick={() => swap(i)} aria-label="Une autre recette ce jour-là" title="Une autre idée">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4" /></svg>
                </button>}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="kw-foot">
        {missingUnique.length > 0 ? (
          <button type="button" className="ka-cart" onClick={() => { k.addShopping(missingUnique.map(m => ({ fr: m.fr, en: m.en, from: m.from }))); setToast(`${missingUnique.length} ajouté${missingUnique.length > 1 ? 's' : ''} à la liste de courses`) }}>
            <CartIcon /><span><b>Ajouter les {missingUnique.length} manquants de la semaine aux courses</b><em>{missingUnique.slice(0, 5).map(m => m.fr.toLowerCase()).join(', ')}{missingUnique.length > 5 ? '…' : ''}</em></span>
          </button>
        ) : <p className="kw-ok">✓ Tout ce qu’il faut est là (ou sur la liste de courses)</p>}
        <button type="button" className="kt-ghost" onClick={() => build(week.count || 7)} disabled={busy}>{busy ? 'On cherche…' : '↻ Refaire la semaine'}</button>
      </div>
      {err && <KeyMissing err={err} />}
      {toast && <div className="ka-toast" role="status">{toast}</div>}
    </div>
  )
}

function WithPantry({ k, onOpen, onOpenPlace }) {
  const [rank, setRank] = useState('missing')
  const [only, setOnly] = useState('all')
  const have = useMemo(() => k.pantry.map(i => i.en).filter(Boolean), [k.pantry])
  const st = useAsync(() => (have.length ? recipesWith(have, rank) : Promise.resolve({ results: [] })), [have.join(','), rank])
  if (!k.pantry.length) {
    return (
      <div className="ka-state">
        <p className="ka-state-emo">🧊</p>
        <h3>Le frigo est vide</h3>
        <p>Dis ce que tu as dans le frigo et les placards : on te propose des recettes avec ce qu’il te reste.</p>
        <div className="ka-state-row"><button type="button" className="kt-cta" onClick={() => onOpenPlace('frigo')}>Ouvrir le frigo</button><button type="button" className="kt-ghost" onClick={() => onOpenPlace('placard')}>Les placards</button></div>
      </div>
    )
  }
  const list = (st.data?.results || []).filter(r => only === 'all' || (only === 'none' ? r.missed.length === 0 : r.missed.length <= 2))
  const sorted = rank === 'missing' ? [...list].sort((a, b) => a.missed.length - b.missed.length || b.used.length - a.used.length) : list
  return (
    <>
      <div className="ka-intro">
        <h2>Avec ce qu’il te reste</h2>
        <p>{k.pantry.length} ingrédient{k.pantry.length > 1 ? 's' : ''} dans le frigo et les placards · le sel, le poivre et l’eau sont toujours là</p>
        <div className="ka-filters">
          {[['all', 'Toutes'], ['none', 'Rien à acheter'], ['few', '2 courses max']].map(([id, l]) => <button type="button" key={id} className={'kt-chip' + (only === id ? ' on' : '')} onClick={() => setOnly(id)}>{l}</button>)}
          <span className="ka-sep" />
          <button type="button" className={'kt-chip' + (rank === 'used' ? ' on' : '')} onClick={() => setRank(r => (r === 'used' ? 'missing' : 'used'))}>Utiliser le plus possible</button>
        </div>
      </div>
      {st.error ? <KeyMissing err={st.error} /> : st.loading ? <Loading /> : sorted.length
        ? <div className="ka-grid">{sorted.map(r => <Card key={r.id} r={r} onOpen={onOpen} fav={k.favorites.some(f => f.id === r.id)} />)}</div>
        : <div className="ka-state"><p className="ka-state-emo">🥄</p><h3>Rien avec ce filtre</h3><p>Essaie « Toutes », ou ajoute quelques ingrédients.</p></div>}
    </>
  )
}

function Search({ onOpen }) {
  const [q, setQ] = useState('')
  const [sent, setSent] = useState('')
  const [type, setType] = useState('')
  const [diet, setDiet] = useState('')
  const st = useAsync(() => (sent || diet ? searchRecipes(sent, { type, diet }) : randomRecipes(type)), [sent, type, diet])
  return (
    <>
      <div className="ka-intro">
        <form className="ka-search" onSubmit={e => { e.preventDefault(); setSent(q.trim()) }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Une envie ? gratin, curry, tarte aux pommes…" aria-label="Chercher une recette" enterKeyHint="search" />
          {q && <button type="button" className="kt-x sm" onClick={() => { setQ(''); setSent('') }} aria-label="Effacer"><Close /></button>}
        </form>
        <div className="ka-filters">
          {DISH_TYPES.map(([id, l]) => <button type="button" key={id || 'all'} className={'kt-chip' + (type === id ? ' on' : '')} onClick={() => setType(id)}>{l}</button>)}
        </div>
        <div className="ka-filters">
          {DIETS.map(([id, l]) => <button type="button" key={id || 'all'} className={'kt-chip soft' + (diet === id ? ' on' : '')} onClick={() => setDiet(id)}>{l}</button>)}
        </div>
        {!sent && !diet && <p className="ka-note">Des idées au hasard{type ? ` · ${DISH_TYPES.find(t => t[0] === type)?.[1].toLowerCase()}` : ''}</p>}
      </div>
      {st.error ? <KeyMissing err={st.error} /> : st.loading ? <Loading /> : st.data?.results?.length
        ? <div className="ka-grid">{st.data.results.map(r => <Card key={r.id} r={r} onOpen={onOpen} />)}</div>
        : <div className="ka-state"><p className="ka-state-emo">🔎</p><h3>Aucune recette</h3><p>Essaie un autre mot.</p></div>}
    </>
  )
}

function Mine({ k, onOpen }) {
  return (
    <>
      <div className="ka-intro"><h2>Nos recettes</h2><p>Celles qu’on aime, et celles qu’on a déjà faites</p></div>
      <h3 className="ka-h3">Préférées <em>{k.favorites.length}</em></h3>
      {k.favorites.length
        ? <div className="ka-grid">{k.favorites.map(r => <Card key={r.id} r={r} onOpen={onOpen} fav />)}</div>
        : <p className="kt-empty">Le ♥ d’une recette la garde ici.</p>}
      <h3 className="ka-h3">Déjà cuisinées <em>{k.cooked.length}</em></h3>
      {k.cooked.length
        ? <ul className="ka-cooked">{k.cooked.map(r => (
          <li key={r.id}><button type="button" onClick={() => onOpen(r.id)}>{r.image && <img src={r.image} alt="" loading="lazy" />}<b>{r.title}</b><em>{new Date(r.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</em></button></li>
        ))}</ul>
        : <p className="kt-empty">« J’ai cuisiné ça » sur une recette la note ici.</p>}
    </>
  )
}

function RecipePage({ id, k, onBack, onShow, onCourses }) {
  const st = useAsync(() => recipeDetail(id), [id])
  const [people, setPeople] = useState(null)
  const [doneSteps, setDoneSteps] = useState(() => new Set())
  const [cooking, setCooking] = useState(false)
  const [toast, setToast] = useState(null)
  const r = st.data
  useEffect(() => { if (r) { setPeople(r.servings || 2); onShow?.(r.title, r.image) } }, [r]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t) }, [toast])
  const ings = useMemo(() => (r?.ingredients || []).map(i => ({ ...i, have: i.staple ? null : inPantry(i.en, k.pantry) })), [r, k.pantry])
  const missing = ings.filter(i => !i.staple && !i.have)
  const fav = r && k.favorites.some(f => f.id === r.id)
  const ratio = r?.servings && people ? people / r.servings : 1
  const qtyOf = i => [amountFr(i.amount * ratio), i.unit].filter(Boolean).join(' ')
  const listed = missing.filter(m => k.inShopping(m.fr))
  const toList = missing.filter(m => !k.inShopping(m.fr))
  const addMissing = () => {
    if (!toList.length) return
    k.addShopping(toList.map(m => ({ fr: m.fr, en: m.en, qty: qtyOf(m), from: r.title })))
    setToast(`${toList.length} ajouté${toList.length > 1 ? 's' : ''} à la liste de courses`)
  }
  const flipOne = m => {
    if (k.inShopping(m.fr)) { k.unShopping(m.fr, r.title); setToast(`« ${m.fr} » retiré des courses`) }
    else { k.addShopping([{ fr: m.fr, en: m.en, qty: qtyOf(m), from: r.title }]); setToast(`« ${m.fr} » ajouté aux courses`) }
  }

  return (
    <div className="ka-page">
      <button type="button" className="ka-pback" onClick={onBack}><Back /><span>Recettes</span></button>
      {st.error ? <KeyMissing err={st.error} /> : !r ? <div className="ka-page-load"><span /></div> : (
        <>
          <div className="ka-hero">
            {r.image && <img src={r.image} alt="" />}
            <div className="ka-hero-txt">
              <p className="kt-kicker">{[...r.dish, r.vegetarian ? 'Végétarien' : '', r.glutenFree ? 'Sans gluten' : ''].filter(Boolean).join(' · ')}</p>
              <h1>{r.title}</h1>
              <div className="ka-meta">
                {r.time && <span>⏱ {timeFr(r.time)}</span>}
                <span className="ka-people">
                  <button type="button" onClick={() => setPeople(p => Math.max(1, p - 1))} aria-label="Une personne de moins">−</button>
                  <b>{people} pers.</b>
                  <button type="button" onClick={() => setPeople(p => Math.min(20, p + 1))} aria-label="Une personne de plus">+</button>
                </span>
                <span>{missing.length ? `Il manque ${missing.length} ingrédient${missing.length > 1 ? 's' : ''}` : 'Tout est là ✓'}</span>
              </div>
              <div className="ka-actions">
                <button type="button" className={'ka-heart' + (fav ? ' on' : '')} onClick={() => k.toggleFavorite(r)} aria-pressed={fav}><Heart on={fav} />{fav ? 'Dans nos préférées' : 'Garder'}</button>
                <button type="button" className="kt-cta" onClick={() => setCooking(true)}>J’ai cuisiné ça</button>
              </div>
              {missing.length > 0 && (toList.length ? (
                <button type="button" className="ka-cart" onClick={addMissing}>
                  <CartIcon /><span><b>{toList.length > 1 ? `Ajouter les ${toList.length} manquants aux courses` : `Ajouter « ${toList[0].fr} » aux courses`}</b>
                  <em>{toList.slice(0, 4).map(m => m.fr.toLowerCase()).join(', ')}{toList.length > 4 ? '…' : ''}</em></span>
                </button>
              ) : (
                <button type="button" className="ka-cart ok" onClick={onCourses}>
                  <CartIcon /><span><b>{listed.length > 1 ? `Les ${listed.length} manquants sont sur la liste` : 'Ce qui manque est sur la liste'}</b><em>Voir la liste de courses →</em></span>
                </button>
              ))}
            </div>
          </div>
          <div className="ka-body">
            <section className="ka-ings">
              <h3>Ingrédients</h3>
              <ul>
                {ings.map((i, n) => (
                  <li key={n} className={i.staple ? 'base' : i.have ? 'have' : 'miss'}>
                    <span className="ka-dot" aria-hidden="true" />
                    <span className="ka-q">{qtyOf(i)}</span>
                    <span className="ka-n">{i.fr}</span>
                    {i.staple || i.have ? <em>{i.staple ? 'de base' : i.have.place === 'placard' ? 'placard' : 'frigo'}</em> : (
                      <button type="button" className={'ka-buy' + (k.inShopping(i.fr) ? ' on' : '')} onClick={() => flipOne(i)} aria-pressed={k.inShopping(i.fr)}
                        aria-label={k.inShopping(i.fr) ? `Retirer ${i.fr} des courses` : `Ajouter ${i.fr} aux courses`}>
                        {k.inShopping(i.fr) ? '✓ sur la liste' : '+ courses'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <section className="ka-steps">
              <h3>Préparation</h3>
              {r.steps.length ? (
                <ol>
                  {r.steps.map((s, n) => (
                    <li key={n} className={doneSteps.has(n) ? 'done' : ''}>
                      <button type="button" onClick={() => setDoneSteps(d => { const x = new Set(d); x.has(n) ? x.delete(n) : x.add(n); return x })}>
                        <span className="ka-num">{n + 1}</span><span>{s}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : <p className="kt-empty">Les étapes sont sur la recette originale.</p>}
              {r.source && <a className="ka-source" href={r.source} target="_blank" rel="noreferrer">Recette originale{r.sourceName ? ` · ${r.sourceName}` : ''} ↗</a>}
              {!r.translated && <p className="ka-note">Ajoute DEEPL_API_KEY dans Vercel pour avoir les étapes en français.</p>}
            </section>
          </div>
        </>
      )}
      {cooking && r && <Cooked r={r} ings={ings} k={k} onDone={msg => { setCooking(false); if (msg) setToast(msg) }} />}
      {toast && <div className="ka-toast" role="status">{toast}</div>}
    </div>
  )
}

/** « J'ai cuisiné ça » : on coche ce qui est fini, ça quitte le frigo ou les placards. */
function Cooked({ r, ings, k, onDone }) {
  const used = [...new Map(ings.filter(i => i.have).map(i => [i.have.id, i.have])).values()]
  const [gone, setGone] = useState(() => new Set())
  const flip = id => setGone(g => { const x = new Set(g); x.has(id) ? x.delete(id) : x.add(id); return x })
  const confirm = () => {
    k.markCooked(r)
    if (gone.size) k.removeItems([...gone])
    onDone(gone.size ? `Bon appétit ! ${gone.size} ingrédient${gone.size > 1 ? 's' : ''} retiré${gone.size > 1 ? 's' : ''}` : 'Bon appétit !')
  }
  return (
    <div className="ka-sheet-back" onClick={() => onDone(null)}>
      <div className="ka-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="J’ai cuisiné ça">
        <h3>Bon appétit !</h3>
        <p>Qu’est-ce qui est fini ? On le retire {used.some(u => u.place === 'placard') ? 'du frigo et des placards' : 'du frigo'}.</p>
        <ul>
          {used.map(u => (
            <li key={u.id}><button type="button" className={gone.has(u.id) ? 'on' : ''} onClick={() => flip(u.id)} aria-pressed={gone.has(u.id)}>
              <span className="kt-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <span className="kt-emo">{u.emoji}</span><span>{u.fr}</span><em>{aisleOf(u.aisle).place === 'placard' || u.place === 'placard' ? 'placard' : 'frigo'}</em>
            </button></li>
          ))}
          {!used.length && <li className="kt-empty">Rien de chez nous dans cette recette.</li>}
        </ul>
        <div className="ka-sheet-row">
          <button type="button" className="kt-ghost" onClick={() => onDone(null)}>Annuler</button>
          <button type="button" className="kt-cta" onClick={confirm}>{gone.size ? `Retirer ${gone.size} et noter` : 'Noter la recette'}</button>
        </div>
      </div>
    </div>
  )
}
