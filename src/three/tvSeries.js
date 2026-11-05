import { tmdbImgCors, loadImage, year } from '../lib/tmdb'

/**
 * L'écran de la télé vu du salon : nos séries, façon page de magazine — fond papier, grand
 * titre en serif, l'image de la série à droite, et les affiches qui montent depuis le bas
 * de l'écran (celle à l'honneur plus haut que les autres). Une série toutes les 8 secondes.
 * Repère logique 1600 × 900, mis à l'échelle de la cible.
 */

export const TV_W = 960, TV_H = 540
const SLIDE = 8
const LW = 1600, LH = 900
const SERIF = '"Newsreader", Georgia, serif'
const SANS = '"Inter Tight", system-ui, sans-serif'
const PAPER = '#EFE9DD', INK = '#16130F', MUTED = '#6B6358', ACCENT = '#1F3FB0'
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const out = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3)
const back = t => { t = clamp(t, 0, 1); const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) }
const spaced = s => s.toUpperCase().split('').join(String.fromCharCode(8202))

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

function cover(g, img, x, y, w, h) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / r, sh = h / r
  g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

export class TvSeries {
  constructor(onImage) { this.list = []; this.i = 0; this.t = 0; this.imgs = new Map(); this.onImage = onImage }
  get count() { return this.list.length }
  get show() { return this.list[this.i] || null }

  setSeries(list) {
    const sig = list.map(s => s.id + (s.rating || '')).join(',')
    if (sig === this.sig) return
    this.sig = sig
    this.list = list
    this.i = Math.min(this.i, Math.max(0, list.length - 1))
    for (const s of list) for (const [k, p, size] of [['p', s.poster_path, 'w342'], ['b', s.backdrop_path, 'w780']]) {
      const key = k + s.id
      if (this.imgs.has(key) || !p) continue
      this.imgs.set(key, null)
      loadImage(tmdbImgCors(p, size)).then(im => { if (im) { this.imgs.set(key, im); this.onImage?.() } })
    }
  }
  update(dt) {
    this.t += dt
    if (this.t > SLIDE && this.list.length > 1) { this.go(this.i + 1); return true }
    return false
  }
  go(i) { if (!this.list.length) return; this.i = (i + this.list.length) % this.list.length; this.t = 0 }
  next() { this.go(this.i + 1) }
  prev() { this.go(this.i - 1) }

  draw(g, w = TV_W, h = TV_H) {
    g.save()
    g.setTransform(w / LW, 0, 0, h / LH, 0, 0)
    g.imageSmoothingQuality = 'high'
    g.fillStyle = PAPER; g.fillRect(0, 0, LW, LH)
    g.textBaseline = 'alphabetic'
    const s = this.show
    if (!s) {
      g.fillStyle = MUTED; g.font = `600 22px ${SANS}`
      g.fillText(spaced('La télé du salon'), 120, 330)
      g.fillStyle = INK; g.font = `500 120px ${SERIF}`
      g.fillText('Nos séries', 112, 470)
      g.font = `italic 400 120px ${SERIF}`; g.fillStyle = ACCENT
      g.fillText('préférées', 112, 590)
      g.fillStyle = MUTED; g.font = `italic 400 38px ${SERIF}`
      g.fillText('Touche la télé pour les ajouter', 120, 690)
      g.restore()
      return
    }
    const t = this.t, n = this.list.length
    const enter = out(t / 0.9), leave = clamp((t - (SLIDE - 0.5)) / 0.5, 0, 1) * (n > 1 ? 1 : 0)
    const a = enter * (1 - leave)

    // l'image de la série, à droite, qui avance doucement
    const bx = 860, by = 70, bw = 680, bh = 470
    const bimg = this.imgs.get('b' + s.id) || this.imgs.get('p' + s.id)
    g.save()
    g.globalAlpha = a
    g.beginPath(); g.rect(bx, by, bw, bh); g.clip()
    if (bimg) {
      const z = 1.06 + 0.05 * (t / SLIDE)
      cover(g, bimg, bx - bw * (z - 1) / 2, by - bh * (z - 1) / 2 + (1 - enter) * 30, bw * z, bh * z)
    } else { g.fillStyle = '#D9D0C0'; g.fillRect(bx, by, bw, bh) }
    g.restore()

    // le texte
    g.save()
    g.globalAlpha = a
    g.translate(0, (1 - enter) * 26)
    g.fillStyle = MUTED; g.font = `600 22px ${SANS}`
    g.fillText(spaced(`Nos séries · ${String(this.i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`), 110, 150)
    g.fillStyle = INK; g.font = `500 96px ${SERIF}`
    const tl = wrap(g, s.name, 660, 3)
    tl.forEach((l, k) => g.fillText(l, 104, 250 + k * 96))
    let y = 250 + (tl.length - 1) * 96 + 70
    g.fillStyle = ACCENT; g.font = `italic 400 36px ${SERIF}`
    const meta = [year(s), s.seasons ? `${s.seasons} saison${s.seasons > 1 ? 's' : ''}` : '', s.genres?.[0]].filter(Boolean).join(' · ')
    if (meta) { g.fillText(meta, 110, y); y += 52 }
    if (s.rating) { g.fillStyle = '#C8932E'; g.font = `400 34px ${SANS}`; g.fillText('★'.repeat(s.rating), 110, y); y += 48 }
    g.fillStyle = MUTED; g.font = `400 28px ${SERIF}`
    wrap(g, s.overview, 640, 2).forEach((l, k) => g.fillText(l, 110, y + k * 38))
    g.restore()

    // les affiches qui montent depuis le bas de l'écran
    const pw = 150, ph = 225, gap = 26
    const shown = Math.min(n, 8)
    const x0 = LW - 60 - shown * (pw + gap) + gap
    for (let k = 0; k < shown; k++) {
      const idx = (this.i + k) % n, ser = this.list[idx]
      const rise = back((t - k * 0.08) / 0.9)
      const lift = k === 0 ? 150 : 60 + ((k * 37) % 3) * 18
      const x = x0 + k * (pw + gap), y = LH - lift * rise + 18
      g.save()
      g.shadowColor = 'rgba(30,20,10,0.28)'; g.shadowBlur = 24; g.shadowOffsetY = 10
      const p = this.imgs.get('p' + ser.id)
      if (p) cover(g, p, x, y, pw, ph)
      else { g.fillStyle = '#CFC4B2'; g.fillRect(x, y, pw, ph) }
      g.restore()
      if (k === 0) { g.fillStyle = ACCENT; g.fillRect(x, y - 16, 40, 5) }
    }
    g.restore()
  }
}
