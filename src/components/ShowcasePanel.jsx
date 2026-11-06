import { useEffect, useMemo, useState } from 'react'

/** Une image qui disparaît si elle ne se charge pas (on voit alors le titre dessous). */
function Img({ src }) {
  const [bad, setBad] = useState(false)
  return src && !bad ? <img src={src} alt="" loading="lazy" onError={() => setBad(true)} /> : null
}
import { toDisplay } from '../lib/bookUtils'
import { tmdbImg, isMovie, year } from '../lib/tmdb'
import { SHOWCASE_MAX } from '../hooks/useShowcase'

const KINDS = [['book', 'Livres'], ['work', 'Films & séries'], ['game', 'Jeux']]
const FORMAT = { book: 'Livre', bluray: 'Blu-ray', game: 'Jeu', switch: 'Jeu' }

/**
 * Le meuble télé : nos médias préférés posés dessus (livres, Blu-ray, jeux de toutes les
 * consoles), dans l'ordre qu'on veut. On les déplace (← →), on les retire, on en ajoute.
 */
export default function ShowcasePanel({ shown, api, books, series, games, onClose }) {
  const [kind, setKind] = useState(() => (books.length ? 'book' : series.length ? 'work' : 'game'))
  const [q, setQ] = useState('')
  useEffect(() => {
    const k = e => { if (e.key === 'Escape' && e.target?.tagName !== 'INPUT') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const full = shown.length >= SHOWCASE_MAX
  const on = useMemo(() => new Set(api.items.map(x => x.kind + ':' + x.id)), [api.items])
  const pool = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = kind === 'book'
      ? books.map(b => { const d = toDisplay(b); return { id: b.id, name: d.title, sub: d.authors[0], img: d.cover } })
      : kind === 'work'
        ? series.map(s => ({ id: s.id, name: s.name, sub: [isMovie(s) ? 'Film' : 'Série', year(s)].filter(Boolean).join(' · '), img: tmdbImg(s.poster_path, 'w185') }))
        : games.map(g => ({ id: g.id, name: g.name, sub: g.platform || g.platforms?.[0] || '', img: g.img }))
    return list.filter(x => !t || x.name.toLowerCase().includes(t))
  }, [kind, q, books, series, games])
  return (
    <section className="vt sc" role="dialog" aria-label="Nos médias préférés">
      <header className="vt-head">
        <div>
          <span className="vt-kicker">Le meuble télé</span>
          <h2 className="vt-title">Nos médias préférés</h2>
        </div>
        <button type="button" className="vt-close" onClick={onClose} aria-label="Fermer">×</button>
      </header>

      <div className="sc-row" aria-label="Sur le meuble, de gauche à droite">
        {!shown.length && <p className="sc-empty">Rien sur le meuble pour l’instant : choisis plus bas les livres, films, séries et jeux que tu veux y poser.</p>}
        {shown.map((it, i) => (
          <div key={it.key} className={'sc-item f-' + it.format + (it.fam ? ' p-' + it.fam : '')}>
            <span className="sc-cover"><b>{it.name}</b><Img src={it.thumb} />{it.format !== 'book' && <i className="sc-band" />}</span>
            <span className="sc-name">{it.name}</span>
            <span className="sc-kind">{FORMAT[it.format]}{it.sub ? ' · ' + it.sub : ''}</span>
            <span className="sc-act">
              <button type="button" onClick={() => api.move(it, -1)} disabled={i === 0} aria-label="Vers la gauche">←</button>
              <button type="button" onClick={() => api.remove(it)} aria-label="Retirer du meuble">×</button>
              <button type="button" onClick={() => api.move(it, 1)} disabled={i === shown.length - 1} aria-label="Vers la droite">→</button>
            </span>
          </div>
        ))}
      </div>
      <p className="sc-count">{shown.length} / {SHOWCASE_MAX} sur le meuble{full ? ' — retire-en un pour en poser un autre' : ''}</p>

      <div className="vt-seg">
        {KINDS.map(([k, t]) => <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{t}</button>)}
      </div>
      <label className="sc-find">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Chercher dans mes ${KINDS.find(x => x[0] === kind)[1].toLowerCase()}…`} />
      </label>
      <div className="sc-pool">
        {!pool.length && <p className="sc-empty">{q ? 'Rien ne correspond.' : 'Rien ici pour l’instant.'}</p>}
        {pool.map(x => {
          const there = on.has(kind + ':' + x.id)
          return (
            <button type="button" key={x.id} className={'sc-pick' + (there ? ' on' : '')} disabled={!there && full}
              onClick={() => (there ? api.remove({ kind, id: x.id }) : api.add({ kind, id: x.id }))}>
              <span className="sc-pick-img"><Img src={x.img} /></span>
              <span className="sc-pick-txt"><b>{x.name}</b><em>{x.sub}</em></span>
              <span className="sc-pick-mark">{there ? '✓' : '+'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
