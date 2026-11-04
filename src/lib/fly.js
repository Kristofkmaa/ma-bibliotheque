/**
 * Fait voler une petite couverture d'un point de l'écran vers un élément (le panier),
 * en arc, en rétrécissant. Appelle onDone à l'arrivée.
 */
export function flyTo(fromRect, src, toEl, onDone, color = '#C7692A') {
  const to = toEl?.getBoundingClientRect()
  if (!fromRect || !to || matchMedia('(prefers-reduced-motion: reduce)').matches) { onDone?.(); return }
  const el = document.createElement('div')
  el.className = 'fly-cover'
  el.style.cssText = `left:${fromRect.left}px;top:${fromRect.top}px;width:${fromRect.width}px;height:${fromRect.height}px;background:${color}`
  if (src) { const img = new Image(); img.src = src; img.alt = ''; el.appendChild(img) }
  document.body.appendChild(el)
  const dx = to.left + to.width / 2 - (fromRect.left + fromRect.width / 2)
  const dy = to.top + to.height * 0.55 - (fromRect.top + fromRect.height / 2)
  const lift = Math.min(160, Math.abs(dx) * 0.35 + 60)
  const a = el.animate([
    { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - lift}px) scale(0.62) rotate(-8deg)`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.16) rotate(4deg)` },
  ], { duration: 720, easing: 'cubic-bezier(.45, 0, .25, 1)' })
  a.onfinish = () => { el.remove(); onDone?.() }
}
