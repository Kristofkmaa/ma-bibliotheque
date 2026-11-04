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

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Envol d'un livre jusque dans le panier 3D, d'un seul tenant : la couverture garde ses
 * proportions et arrive exactement à la taille et à la place du livre 3D (tenu face à nous
 * au-dessus du panier). Le livre 3D prend alors le relais, à la même image, et tombe dedans.
 * target() est relu à chaque image (le panier peut grandir pendant le vol).
 */
export function flyIntoBasket({ from, src, color, target, ready, onLand, onDone }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!from || reduce) { onLand?.(); onDone?.(); return }
  const el = document.createElement('div')
  el.className = 'fly-cover fly-live'
  el.style.background = color
  if (src) { const img = new Image(); img.src = src; img.alt = ''; el.appendChild(img) }
  document.body.appendChild(el)
  const place = (x, y, w, h, rot) => {
    el.style.width = `${w}px`; el.style.height = `${h}px`
    el.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${rot}deg)`
  }
  const fx = from.left + from.width / 2, fy = from.top + from.height / 2
  place(fx, fy, from.width, from.height, 0)
  const t0 = performance.now(), dur = 760
  let last = null, landed = false, removed = false
  const step = now => {
    if (removed) return
    const tr = target() || last
    if (tr) last = tr
    const to = tr || from
    const tx = to.left + to.width / 2, ty = to.top + to.height / 2
    const t = Math.min(1, (now - t0) / dur), e = ease(t)
    const lift = Math.min(170, Math.abs(tx - fx) * 0.28 + 70)
    const x = fx + (tx - fx) * e
    const y = fy + (ty - fy) * e - lift * 4 * e * (1 - e)
    const w = from.width + (to.width - from.width) * e
    const h = from.height + (to.height - from.height) * e
    place(x, y, w, h, Math.sin(e * Math.PI) * -6)
    if (t >= 1 && !landed) {
      landed = true
      // attend la vraie couverture du livre 3D (déjà préchargée en général), puis le relais
      Promise.race([ready(), new Promise(r => setTimeout(r, 1500))]).then(() => {
        onLand?.()
        // deux images : le livre 3D est dessiné avant qu'on retire la couverture volante
        requestAnimationFrame(() => requestAnimationFrame(() => { removed = true; el.remove(); onDone?.() }))
      })
    }
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/**
 * Une couverture vole d'un rectangle à un autre en gardant ses proportions (rangement guidé :
 * du panier jusqu'à sa place sur l'étagère). Rend l'élément volant, à retirer par l'appelant.
 */
export function flyToRect(from, src, to, color = '#C7692A') {
  return new Promise(resolve => {
    if (!from || !to || matchMedia('(prefers-reduced-motion: reduce)').matches) { resolve(null); return }
    const el = document.createElement('div')
    el.className = 'fly-cover'
    el.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;background:${color};transform-origin:0 0`
    if (src) { const img = new Image(); img.src = src; img.alt = ''; el.appendChild(img) }
    document.body.appendChild(el)
    const sx = to.width / from.width, sy = to.height / from.height
    const dx = to.left - from.left, dy = to.top - from.top
    const lift = Math.min(150, Math.abs(dy) * 0.22 + 60)
    const a = el.animate([
      { transform: 'translate(0px, 0px) scale(1, 1) rotate(0deg)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2}) rotate(-7deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(0deg)` },
    ], { duration: 720, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' })
    a.onfinish = () => resolve(el)
  })
}
