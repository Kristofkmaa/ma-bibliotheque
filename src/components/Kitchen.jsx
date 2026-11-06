import { useEffect, useMemo, useRef, useState } from 'react'
import KitchenScene from '../three/KitchenScene'
import { useKitchen } from '../hooks/useKitchen'
import { AISLES, INGREDIENTS, aisleOf, findIngredients, inPantry } from '../lib/ingredients'
import { recipesWith, searchRecipes, randomRecipes, recipeDetail, toEnglish, DISH_TYPES, DIETS, amountFr, timeFr } from '../lib/recipes'
import { relayUrl } from '../lib/covers'
import { useIsMobile } from '../hooks/useIsMobile'

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

const Close = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
const Back = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
const Heart = ({ on }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" className={on ? 'fill' : ''} /></svg>

export default function Kitchen({ userId, onClose }) {
  const k = useKitchen(userId)
  const mobile = useIsMobile()
  const hostRef = useRef(null)
  const sceneRef = useRef(null)
  const rootRef = useRef(null)
  const [view, setView] = useState(null)       // où la caméra va
  const [arrived, setArrived] = useState(null) // où elle est arrivée (le panneau s'ouvre)
  const [app, setApp] = useState(null)         // l'appli de recettes : { tab, from }
  const [chip, setChip] = useState(null)
  const cb = useRef({})
  cb.current.tap = kind => go(kind)

  useEffect(() => {
    const s = new KitchenScene(hostRef.current, {
      onHover: (label, x, y) => setChip(label ? { label, x, y } : null),
      onTap: kind => cb.current.tap(kind),
      onArrive: kind => { setArrived(kind); if (kind === 'tablette') setApp(a => a || { tab: 'frigo', from: s.tabletRect() }) },
    })
    sceneRef.current = s
    if (location.search.includes('debug')) window.__kitchen = s
    rootRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' })
    return () => { s.dispose(); sceneRef.current = null }
  }, [])
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

  return (
    <div className={'kitchen' + (view ? ' focused' : '') + (app ? ' app-open' : '')} ref={rootRef}>
      <div className="kitchen-host" ref={hostRef} />

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
          <button type="button" onClick={() => go('frigo')}><span className="kt-ico">🧊</span><b>Le frigo</b><em>{count('frigo')}</em></button>
          <button type="button" onClick={() => go('placard')}><span className="kt-ico">🫙</span><b>Les placards</b><em>{count('placard')}</em></button>
          <button type="button" className="main" onClick={() => go('tablette')}><span className="kt-ico">📖</span><b>Les recettes</b></button>
          <button type="button" onClick={() => go('courses')}><span className="kt-ico">📝</span><b>Les courses</b>{todo > 0 && <em>{todo}</em>}</button>
        </nav>
      )}
      {!view && <p className="kt-hint">{mobile ? 'Glisse pour regarder la cuisine · touche le frigo ou les placards' : 'Clique sur le frigo, les placards ou la tablette'}</p>}

      {(arrived === 'frigo' || arrived === 'placard') && (
        <PantryPanel key={arrived} place={arrived} k={k} onClose={back} onRecipes={() => openApp('frigo')} onOther={() => go(arrived === 'frigo' ? 'placard' : 'frigo')} />
      )}
      {arrived === 'courses' && <ShoppingPanel k={k} onClose={back} />}
      {app && <RecipeApp k={k} start={app} onClose={closeApp} onOpenPlace={p => { setApp(null); go(p) }} onShow={(t, img) => sceneRef.current?.setTablet(t, img ? relayUrl(img) : null)} />}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Le frigo et les placards : ce qu'on a, rangé par rayon                     */
/* -------------------------------------------------------------------------- */
function PantryPanel({ place, k, onClose, onRecipes, onOther }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const here = k.pantry.filter(i => (place === 'placard' ? i.place === 'placard' : i.place !== 'placard'))
  const has = fr => here.some(i => i.fr === fr)
  const sugg = q.trim() ? findIngredients(q, 7) : []
  const exact = sugg.find(s => s.fr.toLowerCase() === q.trim().toLowerCase())
  const classics = CLASSICS[place].filter(f => !has(f)).map(f => byFr.get(f)).filter(Boolean).slice(0, 10)
  const groups = AISLES.map(a => ({ a, list: here.filter(i => i.aisle === a.id) })).filter(g => g.list.length)
  const other = place === 'frigo' ? 'placard' : 'frigo'

  const add = it => { k.addItem(it, place); setQ(''); inputRef.current?.focus() }
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
                <li key={i.id}>
                  <span className="kt-emo">{i.emoji}</span>
                  <span className="kt-name">{i.fr}</span>
                  <button type="button" className="kt-mini" onClick={() => k.moveItem(i.id, other)} title={other === 'frigo' ? 'Mettre au frigo' : 'Mettre dans les placards'}>{other === 'frigo' ? '→ frigo' : '→ placard'}</button>
                  <button type="button" className="kt-del" onClick={() => k.removeItem(i.id)} aria-label={`Retirer ${i.fr}`}><Close /></button>
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
              <span className="kt-emo">{s.emoji}</span><span className="kt-name">{s.fr}</span>
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
  const TABS = [['frigo', 'Avec mon frigo'], ['chercher', 'Chercher'], ['miennes', 'Mes recettes']]
  return (
    <div className="kt-app" ref={ref} role="dialog" aria-label="Les recettes">
      <header className="ka-top">
        <div className="ka-brand"><span>🍲</span><b>Recettes</b></div>
        <nav className="ka-tabs" style={{ '--i': TABS.findIndex(t => t[0] === tab) }} aria-label="Les recettes">
          <span className="ka-thumb" aria-hidden="true" />
          {TABS.map(([id, label]) => <button type="button" key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setOpen(null) }}>{label}</button>)}
        </nav>
        <button type="button" className="ka-close" onClick={onClose} aria-label="Ranger la tablette"><Close /></button>
      </header>
      <main className="ka-main">
        {tab === 'frigo' && <WithPantry k={k} onOpen={setOpen} onOpenPlace={onOpenPlace} />}
        {tab === 'chercher' && <Search onOpen={setOpen} />}
        {tab === 'miennes' && <Mine k={k} onOpen={setOpen} />}
      </main>
      {open && <RecipePage id={open} k={k} onBack={() => setOpen(null)} onShow={onShow} />}
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

function RecipePage({ id, k, onBack, onShow }) {
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
            </div>
          </div>
          <div className="ka-body">
            <section className="ka-ings">
              <h3>Ingrédients</h3>
              <ul>
                {ings.map((i, n) => (
                  <li key={n} className={i.staple ? 'base' : i.have ? 'have' : 'miss'}>
                    <span className="ka-dot" aria-hidden="true" />
                    <span className="ka-q">{[amountFr(i.amount * ratio), i.unit].filter(Boolean).join(' ')}</span>
                    <span className="ka-n">{i.fr}</span>
                    <em>{i.staple ? 'de base' : i.have ? (i.have.place === 'placard' ? 'placard' : 'frigo') : 'à acheter'}</em>
                  </li>
                ))}
              </ul>
              {missing.length > 0 && (
                <button type="button" className="kt-ghost wide" onClick={() => { k.addShopping(missing.map(m => ({ fr: m.fr, en: m.en }))); setToast(`${missing.length} ajouté${missing.length > 1 ? 's' : ''} à la liste de courses`) }}>
                  📝 {missing.length > 1 ? `Ajouter les ${missing.length} manquants aux courses` : `Ajouter « ${missing[0].fr} » aux courses`}
                </button>
              )}
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
