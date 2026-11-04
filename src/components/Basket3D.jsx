import { useEffect, useRef, useState } from 'react'
import { BasketScene } from '../three/BasketScene'

/**
 * Le panier en vraie 3D (Three.js). Mêmes possibilités que le panier dessiné :
 * toucher un livre, le retirer (×), l'attraper pour le poser sur une étagère.
 */
export default function Basket3D({ items, width, height, onBookDown, onBookClick, onRemove, dragging }) {
  const box = useRef(null)
  const sceneRef = useRef(null)
  const [anchors, setAnchors] = useState(null)
  const [hover, setHover] = useState(null)       // { item, x, y }
  const keepHover = useRef(false)
  const hideTimer = useRef(null)
  const cbs = useRef({})
  cbs.current = { onBookDown, onBookClick }

  useEffect(() => {
    const sc = new BasketScene(box.current, {
      onAnchors: setAnchors,
      onHover: item => {
        clearTimeout(hideTimer.current)
        if (item) {
          const b = sc.books.get(item.googleId)
          const r = sc.screenRect(b), c = box.current.getBoundingClientRect()
          setHover({ item, x: r.right - c.left, y: r.top - c.top })
        } else {
          hideTimer.current = setTimeout(() => { if (!keepHover.current) setHover(null) }, 380)
        }
      },
      onBookDown: (e, item, rect) => {
        if (cbs.current.onBookDown) { cbs.current.onBookDown(e, item, rect); return }
        // recherche : un simple toucher ouvre la fiche
        const sx = e.clientX, sy = e.clientY
        const up = ev => {
          window.removeEventListener('pointerup', up)
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) cbs.current.onBookClick?.(item)
        }
        window.addEventListener('pointerup', up)
      },
    })
    sceneRef.current = sc
    if (location.search.includes('debug')) window.__basket = sc // tests automatisés
    return () => { clearTimeout(hideTimer.current); sc.dispose(); sceneRef.current = null }
  }, [])

  useEffect(() => { sceneRef.current?.setItems(items) }, [items])
  useEffect(() => { sceneRef.current?.setHidden(dragging || null) }, [dragging])

  return (
    <div className="basket3d" ref={box} style={{ width, height }}>
      {anchors && <span className="bb-target" style={{ left: anchors.mouth.x - width * 0.18, top: anchors.mouth.y - 10, width: width * 0.36, height: 20 }} />}
      {anchors && (
        <div className="bb-tag" style={{ left: anchors.tag.x, top: anchors.tag.y }}>
          {items.length ? `${items.length} livre${items.length > 1 ? 's' : ''}` : 'vide'}
        </div>
      )}
      {onRemove && hover && items.some(i => i.googleId === hover.item.googleId) && (
        <button
          type="button" className="bb-remove on" style={{ left: hover.x - 12, top: hover.y - 8 }}
          aria-label={`Retirer ${hover.item.title} du panier`}
          onPointerEnter={() => { keepHover.current = true; clearTimeout(hideTimer.current) }}
          onPointerLeave={() => { keepHover.current = false; setHover(null) }}
          onClick={() => { keepHover.current = false; onRemove(hover.item.googleId); setHover(null) }}
        >×</button>
      )}
    </div>
  )
}

