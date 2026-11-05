import * as THREE from 'three'
import { spineColors, authorInitials, toDisplay } from '../lib/bookUtils'
import { coverKey, preloadCover } from '../lib/covers'

/**
 * Textures dessinées sur canvas pour la scène 3D : dos des livres (titre vertical),
 * couvertures de secours, tranche des pages, bois, portes. Tout est mis en cache.
 */

const cache = new Map()
let anisotropy = 4
export function setAnisotropy(n) { anisotropy = n }

function canvasTexture(key, w, h, draw, { repeat = false, scale = 1 } = {}) {
  if (cache.has(key)) return cache.get(key)
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale); c.height = Math.round(h * scale)
  const ctx = c.getContext('2d')
  ctx.scale(scale, scale)     // même dessin, plus de pixels (texte des tranches plus net)
  draw(ctx, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping }
  cache.set(key, tex)
  return tex
}

const SERIF = '"Newsreader", Georgia, serif'
const SANS = '"Inter Tight", system-ui, sans-serif'

function fitText(ctx, text, maxW, size, font, minSize = 10) {
  let s = size
  ctx.font = `500 ${s}px ${font}`
  while (ctx.measureText(text).width > maxW && s > minSize) { s -= 1; ctx.font = `500 ${s}px ${font}` }
  return s
}

/** Dos du livre : fond de couleur, deux filets, titre de bas en haut, initiales de l'auteur. */
export function spineTexture(book) {
  const d = toDisplay(book)
  const [bg, ink] = spineColors(book)
  const key = `spine|${book.id}|${d.title}|${bg}`
  return canvasTexture(key, 128, 1024, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.25, 'rgba(255,255,255,0)')
    g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 3
    for (const y of [56, 68, h - 68, h - 56]) { ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(w - 14, y); ctx.stroke() }
    ctx.globalAlpha = 1
    // titre, de bas en haut (sens français)
    ctx.save()
    ctx.translate(w / 2, h - 210)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = ink
    ctx.textBaseline = 'middle'
    const title = d.title.toUpperCase()
    const s = fitText(ctx, title, h - 330, 58, SERIF, 26)
    ctx.font = `500 ${s}px ${SERIF}`
    let t = title
    while (ctx.measureText(t).width > h - 330 && t.length > 3) t = t.slice(0, -2)
    if (t !== title) t = t.trimEnd() + '…'
    ctx.fillText(t, 0, 0)
    ctx.restore()
    // initiales
    ctx.strokeStyle = ink; ctx.lineWidth = 3
    ctx.strokeRect(w / 2 - 34, h - 160, 68, 56)
    ctx.fillStyle = ink; ctx.font = `italic 500 36px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(authorInitials(book), w / 2, h - 131)
  }, { scale: 1.5 })   // 1,5 × plus de pixels : titre de la tranche net
}

/** Couverture générée quand l'image réelle n'est pas disponible. */
export function fallbackCover(book) {
  const d = toDisplay(book)
  const [bg, ink] = spineColors(book)
  return canvasTexture(`cover|${book.id}|${d.title}`, 512, 768, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.7; ctx.lineWidth = 3
    ctx.strokeRect(28, 28, w - 56, h - 56)
    ctx.globalAlpha = 1
    ctx.fillStyle = ink; ctx.textAlign = 'center'
    ctx.font = `600 22px ${SANS}`
    ctx.fillText('BIBLIOTHÈQUE LEVANA', w / 2, 92)
    // titre sur plusieurs lignes
    const words = d.title.toUpperCase().split(/\s+/)
    const lines = []
    ctx.font = `500 64px ${SERIF}`
    for (const wd of words) {
      const last = lines[lines.length - 1]
      if (last && ctx.measureText(last + ' ' + wd).width < w - 110) lines[lines.length - 1] = last + ' ' + wd
      else lines.push(wd)
    }
    const shown = lines.slice(0, 5)
    const y0 = h / 2 - (shown.length - 1) * 36
    shown.forEach((l, i) => ctx.fillText(l, w / 2, y0 + i * 72))
    ctx.font = `italic 400 30px ${SERIF}`
    ctx.fillText(d.authors.join(', ').slice(0, 34), w / 2, h - 96)
  })
}

/** Marque-page : carton coloré, filet doré, petit motif (deux teintes selon la couleur du livre). */
export function bookmarkTexture(variant = 0) {
  const [bg, ink] = variant ? ['#B8322B', '#F3D79A'] : ['#1F3FB0', '#F3D79A']
  return canvasTexture(`bookmark|${variant}`, 64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, bg); g.addColorStop(0.5, bg); g.addColorStop(1, '#00000033')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = ink; ctx.lineWidth = 2.5
    ctx.strokeRect(6, 6, w - 12, h - 12)
    ctx.fillStyle = ink
    for (let y = 40; y < h - 30; y += 34) { ctx.beginPath(); ctx.arc(w / 2, y, 3.2, 0, Math.PI * 2); ctx.fill() }
  })
}

/** Tranche des pages (crème, fines lignes). */
export function pagesTexture() {
  return canvasTexture('pages', 256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#EFE7D4'; ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 2) {
      ctx.fillStyle = y % 4 ? 'rgba(120,100,70,0.10)' : 'rgba(255,255,255,0.35)'
      ctx.fillRect(0, y, w, 1)
    }
  })
}

/** Veinage du bois (en niveaux de gris, multiplié par la couleur de la matière). */
export function grainTexture() {
  return canvasTexture('grain', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
    let seed = 7
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let i = 0; i < 140; i++) {
      const y = rnd() * h
      ctx.strokeStyle = `rgba(0,0,0,${0.025 + rnd() * 0.05})`
      ctx.lineWidth = 1 + rnd() * 2.5
      ctx.beginPath(); ctx.moveTo(0, y)
      for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x / (60 + rnd() * 40) + i) * (2 + rnd() * 3))
      ctx.stroke()
    }
  }, { repeat: true })
}

/** Portes : panneau (cadre), cannage (treillis) ou lattes, en niveaux de gris teintés ensuite. */
export function doorTexture(style) {
  return canvasTexture(`door|${style}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
    if (style === 'lattes') {
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + 30, 0, 2, h)
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, 0, 2, h)
      }
    } else if (style === 'cannage') {
      ctx.fillStyle = '#E9D5A8'; ctx.fillRect(28, 28, w - 56, h - 56)
      ctx.strokeStyle = 'rgba(110,75,30,0.55)'; ctx.lineWidth = 2
      for (let i = -h; i < w + h; i += 14) {
        ctx.beginPath(); ctx.moveTo(i, 28); ctx.lineTo(i + h, 28 + h); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(i, h - 28); ctx.lineTo(i + h, h - 28 - h); ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(110,75,30,0.35)'
      for (let y = 28; y < h - 28; y += 14) { ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(w - 28, y); ctx.stroke() }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 6; ctx.strokeRect(28, 28, w - 56, h - 56)
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 3; ctx.strokeRect(34, 34, w - 68, h - 68)
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.strokeRect(40, 40, w - 80, h - 80)
    }
  })
}

// ---- Couvertures réelles -------------------------------------------------------------------

const texCache = new Map()   // clé de couverture → texture prête

function toTexture(img) {
  const tex = new THREE.Texture(img)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  tex.needsUpdate = true
  return tex
}

/** Texture de la vraie couverture si elle est déjà prête, sinon null (sans attendre). */
export function cachedCover(book) {
  const key = coverKey(book)
  return key ? texCache.get(key) || null : null
}

/** Promesse de la vraie couverture (texture), ou null si elle n'existe pas. */
export function loadCover(book) {
  const key = coverKey(book)
  if (!key) return Promise.resolve(null)
  if (texCache.has(key)) return Promise.resolve(texCache.get(key))
  return preloadCover(book).then(res => {
    if (!res) return null
    if (!texCache.has(key)) texCache.set(key, toTexture(res.img))
    return texCache.get(key)
  })
}

/**
 * Pour un nouveau livre : appelle show(texture) dès que la vraie couverture est prête
 * (tout de suite si elle l'est déjà). Si elle tarde trop, show(couverture générée), puis on
 * remplace par la vraie si elle finit par arriver (via swap).
 * Retourne true si la couverture était déjà prête.
 */
export function withCover(book, show, swap, waitMs = 1800) {
  const ready = cachedCover(book)
  if (ready) { show(ready); return true }
  let shown = false
  const timer = setTimeout(() => { shown = true; show(fallbackCover(book)) }, waitMs)
  loadCover(book).then(tex => {
    if (!shown) { clearTimeout(timer); shown = true; show(tex || fallbackCover(book)) }
    else if (tex) swap?.(tex)
  })
  return false
}

/** Ancienne interface : couverture générée tout de suite, vraie couverture quand elle arrive. */
export function coverTexture(book, onReady) {
  const ready = cachedCover(book)
  if (ready) return ready
  loadCover(book).then(tex => { if (tex) onReady?.(tex) })
  return fallbackCover(book)
}

/**
 * Petite plaque nominative en laiton, nom gravé (une par étagère, fixée à la planche).
 * Rend la texture et ses proportions (largeur / hauteur).
 */
export function plaqueTexture(text) {
  const key = `plaque|${text}`
  if (cache.has(key)) return cache.get(key)
  const H = 112
  const m = document.createElement('canvas').getContext('2d')
  const label = text.toUpperCase()
  const spaced = label.split('').join(String.fromCharCode(8202))
  m.font = `600 46px ${SANS}`
  const tw = Math.min(1400, m.measureText(spaced).width)
  const W = Math.ceil(tw + 92)
  const tex = canvasTexture(key + '|t', W, H, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#E9CF8C'); g.addColorStop(0.45, '#C9A45A'); g.addColorStop(1, '#9C7A35')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    // reflet et biseau
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(0, 0, w, 6)
    ctx.fillStyle = 'rgba(70,45,10,0.35)'; ctx.fillRect(0, h - 6, w, 6)
    ctx.strokeStyle = 'rgba(70,45,10,0.45)'; ctx.lineWidth = 3; ctx.strokeRect(10, 10, w - 20, h - 20)
    // vis
    for (const x of [24, w - 24]) {
      ctx.fillStyle = '#8A6A2C'; ctx.beginPath(); ctx.arc(x, h / 2, 7, 0, 7); ctx.fill()
      ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, h / 2 - 3); ctx.lineTo(x + 4, h / 2 + 3); ctx.stroke()
    }
    // texte gravé : ombre claire dessous, sombre dessus
    ctx.font = `600 46px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,244,210,0.75)'; ctx.fillText(spaced, w / 2, h / 2 + 3, w - 80)
    ctx.fillStyle = '#3B2A10'; ctx.fillText(spaced, w / 2, h / 2 + 1, w - 80)
  }, { scale: 2 })
  const out = { tex, aspect: W / H }
  cache.set(key, out)
  return out
}
