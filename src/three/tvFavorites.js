import { preloadCover } from '../lib/covers'
import { spineColors, toDisplay } from '../lib/bookUtils'

/**
 * La télé en mode « mes livres » : la couverture en grand, au format panoramique — le fond est
 * la couverture elle-même, très agrandie et adoucie, qui remplit l'écran ; la couverture nette
 * est posée dessus, avec le titre. Un livre toutes les 7 secondes, en fondu.
 */

const SLIDE = 7
const LW = 1600, LH = 900
const SERIF = '"Newsreader", Georgia, serif'
const SANS = '"Inter Tight", system-ui, sans-serif'
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function wrap(g, text, maxW, maxLines) {
  const words = (text || '').split(/\s+/), lines = []
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const keep = lines.slice(0, maxLines)
    keep[maxLines - 1] = keep[maxLines - 1].replace(/\s*\S*$/, '') + '…'
    return keep
  }
  return lines
}

export class TvFavorites {
  constructor() { this.list = []; this.label = ''; this.i = 0; this.t = 0; this.imgs = new Map(); this.blur = new Map() }
  get count() { return this.list.length }
  get book() { return this.list[this.i] || null }

  setBooks(list, label) {
    const sig = list.map(b => b.id).join(',') + '|' + label
    if (sig === this.sig) return
    this.sig = sig
    this.list = list
    this.label = label
    this.i = Math.min(this.i, Math.max(0, list.length - 1))
    list.forEach(b => preloadCover(b).then(res => { if (res?.img) this.imgs.set(b.id, res.img) }))
  }
  update(dt) {
    this.t += dt
    if (this.t > SLIDE && this.list.length > 1) { this.go(this.i + 1); return true }
    return false
  }
  go(i) { if (!this.list.length) return; this.prevI = this.i; this.i = (i + this.list.length) % this.list.length; this.t = 0 }
  next() { this.go(this.i + 1) }
  prev() { this.go(this.i - 1) }

  /** Couverture adoucie (réduite puis agrandie) qui sert de fond panoramique. */
  _soft(book, img) {
    if (this.blur.has(book.id)) return this.blur.get(book.id)
    const c = document.createElement('canvas'); c.width = 24; c.height = 14
    const g = c.getContext('2d')
    // bande centrale de la couverture, au format de l'écran
    const sh = img.naturalWidth * (14 / 24)
    g.drawImage(img, 0, Math.max(0, (img.naturalHeight - sh) / 2), img.naturalWidth, Math.min(sh, img.naturalHeight), 0, 0, 24, 14)
    this.blur.set(book.id, c)
    return c
  }

  _slide(g, book, alpha, t) {
    if (!book || alpha <= 0) return
    const img = this.imgs.get(book.id)
    const [bg] = spineColors(book)
    g.save()
    g.globalAlpha = alpha
    // fond panoramique : la couverture très agrandie, qui avance doucement
    if (img) {
      const z = 1.08 + 0.05 * (t / SLIDE)
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
      g.drawImage(this._soft(book, img), -LW * (z - 1) / 2, -LH * (z - 1) / 2, LW * z, LH * z)
    } else { g.fillStyle = bg; g.fillRect(0, 0, LW, LH) }
    const shade = g.createLinearGradient(0, 0, LW, 0)
    shade.addColorStop(0, 'rgba(10,10,14,0.15)'); shade.addColorStop(0.55, 'rgba(10,10,14,0.45)'); shade.addColorStop(1, 'rgba(10,10,14,0.7)')
    g.fillStyle = shade; g.fillRect(0, 0, LW, LH)
    // la couverture, nette
    const ch = 700, cw = img ? ch * (img.naturalWidth / img.naturalHeight) : ch * 0.66
    const cx = 170 + (1 - ease(clamp(t / 0.9, 0, 1))) * -40, cy = (LH - ch) / 2
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 50; g.shadowOffsetY = 24
    if (img) g.drawImage(img, cx, cy, cw, ch)
    else { g.fillStyle = bg; g.fillRect(cx, cy, cw, ch) }
    g.shadowColor = 'transparent'
    // titre
    const d = toDisplay(book)
    const tx = cx + cw + 90, tw = LW - tx - 90
    g.fillStyle = '#F4C35A'; g.font = `600 24px ${SANS}`; g.textBaseline = 'alphabetic'
    g.fillText(this.label.toUpperCase().split('').join(String.fromCharCode(8202)), tx, 300)
    g.fillStyle = '#F7F4EE'; g.font = `500 76px ${SERIF}`
    const tl = wrap(g, d.title, tw, 3)
    tl.forEach((l, k) => g.fillText(l, tx, 390 + k * 84))
    g.fillStyle = 'rgba(247,244,238,0.78)'; g.font = `italic 400 40px ${SERIF}`
    g.fillText(wrap(g, d.authors.join(', '), tw, 1)[0] || '', tx, 390 + tl.length * 84 + 26)
    if (book.rating) {
      g.fillStyle = '#F4C35A'; g.font = `400 40px ${SANS}`
      g.fillText('★'.repeat(book.rating), tx, 390 + tl.length * 84 + 96)
    }
    g.restore()
  }

  draw(g, w, h) {
    g.save()
    g.setTransform(w / LW, 0, 0, h / LH, 0, 0)
    g.fillStyle = '#1E2A55'; g.fillRect(0, 0, LW, LH)
    if (!this.list.length) {
      g.fillStyle = '#F4F2ED'; g.textAlign = 'center'
      g.font = `500 72px ${SERIF}`; g.fillText('Tes livres passeront ici', LW / 2, LH / 2)
      g.font = `italic 400 38px ${SERIF}`; g.fillStyle = 'rgba(244,242,237,0.7)'
      g.fillText('Ajoute-en depuis la Boutique', LW / 2, LH / 2 + 70)
      g.restore()
      return
    }
    const fade = clamp(this.t / 0.8, 0, 1)
    if (fade < 1 && this.prevI != null && this.prevI !== this.i) this._slide(g, this.list[this.prevI], 1, SLIDE)
    this._slide(g, this.book, fade, this.t)
    // points
    const n = this.list.length
    if (n > 1) for (let k = 0; k < n; k++) {
      g.fillStyle = k === this.i ? '#F4C35A' : 'rgba(247,244,238,0.35)'
      g.beginPath(); g.arc(LW / 2 - (n - 1) * 15 + k * 30, LH - 50, k === this.i ? 8 : 6, 0, 7); g.fill()
    }
    g.restore()
  }
}
