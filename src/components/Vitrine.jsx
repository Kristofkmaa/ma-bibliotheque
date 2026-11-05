import { useMemo, useState } from 'react'
import { isMovie, year } from '../lib/tmdb'

const COLORS = [
  ['#1C1A17', '#EDE3CC'], ['#ECE2CB', '#1C1A17'], ['#6E1F1A', '#F1E4C8'], ['#1F3A2E', '#E9DFC9'],
  ['#1E2B4A', '#EBDDB6'], ['#B5832E', '#1C1A17'], ['#5A3B26', '#EADCC0'], ['#3B3A37', '#E4D9C2'],
  ['#C9BFAA', '#2A2620'], ['#8C2F22', '#F3E7CF'],
]
const colorOf = s => { let h = 0; for (const c of s.name || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length] }

/**
 * La vitrine du meuble télé, vue de près : nos films et séries rangés comme de vrais boîtiers,
 * dans l'ordre où on les a ajoutés. On touche une tranche : elle sort, et sa fiche s'ouvre.
 */
export default function Vitrine({ series, onOpen, onList, onClose }) {
  const [kind, setKind] = useState('all')
  const [out, setOut] = useState(null)
  const list = useMemo(() => [...series]
    .filter(s => kind === 'all' || (kind === 'movie') === isMovie(s))
    .sort((a, b) => (a.added_at || '').localeCompare(b.added_at || '')), [series, kind])
  const nTv = series.filter(s => !isMovie(s)).length, nMovie = series.length - nTv
  const pick = s => { setOut(s.id); setTimeout(() => { setOut(null); onOpen(s) }, 380) }
  return (
    <div className="vt" role="dialog" aria-label="Notre vitrine">
      <header className="vt-head">
        <div>
          <p className="vt-kicker">Notre vitrine</p>
          <h2 className="vt-title">{series.length ? `${series.length} titre${series.length > 1 ? 's' : ''}` : 'Encore vide'}</h2>
        </div>
        <button type="button" className="vt-close" onClick={onClose} aria-label="Revenir au salon">×</button>
      </header>
      {series.length > 0 && (nTv > 0 && nMovie > 0) && (
        <div className="vt-seg" role="tablist" aria-label="Afficher">
          {[['all', `Tout · ${series.length}`], ['tv', `Séries · ${nTv}`], ['movie', `Films · ${nMovie}`]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
      )}
      <div className="vt-cabinet">
        <div className="vt-shelf">
          {list.map((s, i) => {
            const [bg, fg] = colorOf(s)
            return (
              <button key={s.id} type="button" className={'vt-case' + (out === s.id ? ' out' : '')} style={{ background: bg, color: fg, '--d': `${Math.min(i, 20) * 0.025}s` }}
                onClick={() => pick(s)} aria-label={`${s.name}${year(s) ? ', ' + year(s) : ''}`}>
                <span className={'vt-cap ' + (isMovie(s) ? 'm' : 't')} />
                <span className="vt-name">{s.name}</span>
                <span className="vt-year">{year(s)}</span>
              </button>
            )
          })}
          {!list.length && <p className="vt-empty">Vos films et séries se rangeront ici quand vous les ajouterez.</p>}
        </div>
        <div className="vt-plank" aria-hidden="true" />
      </div>
      <div className="vt-actions">
        <button type="button" className="vt-btn" onClick={onList}>Ouvrir notre liste sur l’écran</button>
      </div>
      <p className="vt-hint">Touche une tranche pour sa fiche · glisse pour voir les autres</p>
    </div>
  )
}
