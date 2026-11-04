import { useEffect, useMemo, useRef, useState } from 'react'
import { spineColors } from '../lib/bookUtils'

const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * « Retrouver un livre » dans sa propre bibliothèque : on tape un titre ou un auteur,
 * on choisit, et la bibliothèque va jusqu'au livre (qui sort un instant de l'étagère).
 */
export default function LibrarySearch({ books, shelves, onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const input = useRef(null)

  const shelfOf = useMemo(() => {
    const m = new Map()
    shelves.forEach(s => s.book_ids.forEach(id => m.set(id, s.name)))
    return m
  }, [shelves])

  const results = useMemo(() => {
    const n = norm(q.trim())
    if (!n) return []
    return books
      .map(b => {
        const t = norm(b.title), a = norm((b.authors || []).join(' '))
        const score = t.startsWith(n) ? 0 : t.includes(n) ? 1 : a.includes(n) ? 2 : 9
        return { b, score }
      })
      .filter(x => x.score < 9)
      .sort((x, y) => x.score - y.score || norm(x.b.title).localeCompare(norm(y.b.title)))
      .slice(0, 8)
      .map(x => x.b)
  }, [q, books])

  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    const onDown = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])

  const pick = b => {
    onPick(b.id)
    setQ(''); setOpen(false)
    input.current?.blur()
  }

  return (
    <div className="lib-search" ref={box}>
      <svg className="ls-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="5" cy="5" r="4" stroke="currentColor" fill="none" /><path d="M8 8l3.5 3.5" stroke="currentColor" /></svg>
      <input
        ref={input} type="search" value={q} placeholder="Retrouver un livre…" spellCheck="false"
        aria-label="Retrouver un livre dans ma bibliothèque"
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
          else if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]) }
          else if (e.key === 'Escape') { e.stopPropagation(); setQ(''); setOpen(false); e.currentTarget.blur() }
        }}
      />
      {open && q.trim() && (
        <div className="ls-pop grain" role="listbox">
          {results.length ? results.map((b, i) => (
            <button
              key={b.id} type="button" role="option" aria-selected={i === active}
              className={'ls-item' + (i === active ? ' on' : '')}
              onPointerEnter={() => setActive(i)} onClick={() => pick(b)}
            >
              <span className="ls-spine" style={{ background: spineColors(b)[0] }} />
              <span className="ls-text">
                <span className="ls-title">{b.title}</span>
                <span className="ls-meta">{(b.authors || []).join(', ')}{shelfOf.get(b.id) ? ` · ${shelfOf.get(b.id)}` : ''}</span>
              </span>
            </button>
          )) : <p className="ls-empty">Aucun livre ne correspond.</p>}
        </div>
      )}
    </div>
  )
}
