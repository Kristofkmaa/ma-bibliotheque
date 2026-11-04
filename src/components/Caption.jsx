import { useEffect, useRef } from 'react'

const EASE = 'cubic-bezier(.2, .8, .2, 1)'

function swapLine(container, text, className, dir) {
  if (!container) return
  const oldSpans = Array.from(container.children)
  if (oldSpans.length && oldSpans[oldSpans.length - 1].textContent === text && dir === 0) return
  const span = document.createElement('span')
  span.className = className
  span.textContent = text
  container.appendChild(span)
  const d = dir || 1
  span.animate([{ transform: `translateY(${d * 105}%)` }, { transform: 'translateY(0%)' }],
    { duration: 650, easing: EASE, fill: 'both' })
  oldSpans.forEach(old => {
    const a = old.animate([{ transform: 'translateY(0%)' }, { transform: `translateY(${-d * 105}%)` }],
      { duration: 650, easing: EASE, fill: 'both' })
    a.onfinish = () => old.remove()
  })
}

/** Légende sous l'étagère : titre / auteur / année, qui glissent à travers des masques. */
export default function Caption({ title, subtitle, year, dir }) {
  const t = useRef(null), s = useRef(null), y = useRef(null)
  const first = useRef(true)

  useEffect(() => {
    const d = first.current ? 1 : (dir || 1)
    first.current = false
    swapLine(t.current, title, 'caption-line title', d)
    swapLine(s.current, subtitle, 'caption-line subtitle', d)
    swapLine(y.current, year, 'caption-line year', d)
  }, [title, subtitle, year, dir])

  return (
    <div className="caption-container" aria-live="polite">
      <div className="caption-mask title-mask" ref={t} />
      <div className="caption-mask subtitle-mask" ref={s} />
      <div className="caption-mask year-mask" ref={y} />
    </div>
  )
}
