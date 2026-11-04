import { useEffect, useRef } from 'react'
import { cursor } from '../lib/cursorState'

/** Curseur anneau + point, lissé, qui se transforme en disque cobalt "OUVRIR" sur la jaquette active. */
export default function Cursor() {
  const el = useRef(null)
  const labelEl = useRef(null)

  useEffect(() => {
    const node = el.current
    let mx = window.innerWidth / 2, my = window.innerHeight / 2
    let cx = mx, cy = my
    let last = performance.now()
    let raf = 0
    let lastState = ''
    let lastLabel = ''

    const onMove = e => { mx = e.clientX; my = e.clientY }
    const onOver = e => {
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.closest('input, textarea')) { cursor.state = 'text'; return }
      if (t.closest('.spine')) { cursor.state = 'spine'; return }
      if (t.closest('button, a, select, [data-cursor="btn"]')) { cursor.state = 'btn'; return }
      cursor.state = 'default'
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerover', onOver, { passive: true })

    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const f = 1 - Math.exp(-22 * dt)
      if (Math.abs(mx - cx) > 0.1 || Math.abs(my - cy) > 0.1) {
        cx += (mx - cx) * f; cy += (my - cy) * f
        node.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`
      }
      if (cursor.state !== lastState) {
        lastState = cursor.state
        node.className = 'custom-cursor' + (lastState !== 'default' ? ' ' + lastState : '')
      }
      const lbl = cursor.label.join('|')
      if (lbl !== lastLabel && labelEl.current) {
        lastLabel = lbl
        labelEl.current.innerHTML = cursor.label.map(l => `<span>${l}</span>`).join('')
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerover', onOver)
    }
  }, [])

  return (
    <div className="custom-cursor" ref={el} aria-hidden="true">
      <div className="cursor-ring" />
      <div className="cursor-dot" />
      <div className="cursor-label" ref={labelEl}><span>OUVRIR</span><span>LE LIVRE</span></div>
    </div>
  )
}
