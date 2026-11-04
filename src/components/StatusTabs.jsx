import { useEffect, useRef, useState } from 'react'

/** Onglets avec le bloc cobalt qui glisse d'un onglet à l'autre. */
export default function StatusTabs({ tabs, value, onChange }) {
  const wrap = useRef(null)
  const [ind, setInd] = useState({ w: 0, x: 0 })

  useEffect(() => {
    const measure = () => {
      const btn = wrap.current?.querySelector(`[data-tab="${value}"]`)
      if (btn) setInd({ w: btn.offsetWidth, x: btn.offsetLeft })
    }
    measure()
    const t = setTimeout(measure, 350) // après chargement des polices
    window.addEventListener('resize', measure)
    document.fonts?.ready?.then(measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [value, tabs])

  return (
    <div className="tabs-wrapper">
      <nav className="tabs" ref={wrap} aria-label="Filtrer la bibliothèque">
        <div className="tabs-indicator" style={{ width: ind.w, transform: `translateX(${ind.x}px)` }} />
        {tabs.map(tab => (
          <button
            key={tab.id} type="button" data-tab={tab.id}
            className={'tab-btn' + (tab.id === value ? ' active' : '')}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="count">{tab.count}</span>}
          </button>
        ))}
      </nav>
    </div>
  )
}
