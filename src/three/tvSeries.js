import { tmdbImgCors, loadImage, year } from '../lib/tmdb'

/**
 * L'écran de la télé vu du salon : nos séries rangées comme des cassettes VHS sur une étagère
 * courbe (celle du milieu de face, les autres de tranche), le titre en bleu dessous, la frise
 * des années en bas — comme dans la télé quand on y entre. Une cassette toutes les 8 secondes.
 * Repère logique 1600 × 900, mis à l'échelle de la cible.
 */

export const TV_W = 1280, TV_H = 720
const SLIDE = 8
const LW = 1600, LH = 900
const SERIF = '"Newsreader", Georgia, serif'
const SANS = '"Inter Tight", system-ui, sans-serif'
const PAPER = '#F5EFE3', INK = '#1A1814', MUTED = '#8A8273', ACCENT = '#2342D6'
const SPINES = [
  ['#1C1A17', '#EDE3CC'], ['#ECE2CB', '#1C1A17'], ['#6E1F1A', '#F1E4C8'], ['#1F3A2E', '#E9DFC9'],
  ['#1E2B4A', '#EBDDB6'], ['#B5832E', '#1C1A17'], ['#5A3B26', '#EADCC0'], ['#3B3A37', '#E4D9C2'],
  ['#C9BFAA', '#2A2620'], ['#8C2F22', '#F3E7CF'],
]
const spineOf = s => { let h = 0; for (const c of s.name || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return SPINES[h % SPINES.length] }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const out = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3)
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
    list = [...list].sort((a, b) => (a.first_air_date || '9999').localeCompare(b.first_air_date || '9999') || a.name.localeCompare(b.name))
    this.list = list
    this.i = Math.min(this.i, Math.max(0, list.length - 1))
    for (const s of list) for (const [k, p, size] of [['p', s.poster_path, 'w342']]) {
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
      g.fillStyle = ACCENT; g.font = `600 130px ${SANS}`
      g.fillText('Nos séries', 112, 470)
      g.fillStyle = INK
      g.fillText('préférées', 112, 600)
      g.fillStyle = MUTED; g.font = `italic 400 38px ${SERIF}`
      g.fillText('Touche la télé pour les ajouter', 120, 690)
      g.restore()
      return
    }
    const t = this.t, n = this.list.length
    const k = out(t / 0.8)            // la cassette du milieu se retourne
    // l'étagère courbe : les cassettes de tranche rapetissent en s'éloignant du milieu
    const FH = 520, FW = FH * 0.7, SH = FH * 0.97, SW = FH * 0.072, GAP = FH * 0.012, CX = LW / 2, CY = 390
    const R = 950, near = FW / 2 + SW / 2 + GAP, step = SW + GAP
    const items = []
    for (let i = Math.max(0, this.i - 12); i <= Math.min(n - 1, this.i + 12); i++) {
      const d = i - this.i, ad = Math.abs(d)
      if (!d) continue
      const arc = Math.sign(d) * (near + (ad - 1) * step), a = arc / R
      const sc = 900 / (900 + R * (1 - Math.cos(a)))
      items.push({ s: this.list[i], x: CX + R * Math.sin(a) * sc, sc, ad, a })
    }
    // ombre au sol
    const sh = g.createRadialGradient(CX, CY + FH / 2 + 10, 10, CX, CY + FH / 2 + 10, 640)
    sh.addColorStop(0, 'rgba(60,42,20,0.22)'); sh.addColorStop(1, 'rgba(60,42,20,0)')
    g.save(); g.scale(1, 0.06); g.fillStyle = sh; g.beginPath(); g.arc(CX, (CY + FH / 2 + 10) / 0.06, 640, 0, 7); g.fill(); g.restore()
    items.sort((p, q) => q.ad - p.ad)
    for (const it of items) {
      const [bg, fg] = spineOf(it.s)
      const w = SW * it.sc * Math.max(0.35, Math.cos(it.a)), h = SH * it.sc
      const x = it.x - w / 2, y = CY - h / 2
      g.save()
      g.shadowColor = 'rgba(30,20,8,0.3)'; g.shadowBlur = 16; g.shadowOffsetY = 10
      g.fillStyle = bg; g.fillRect(x, y, w, h)
      g.restore()
      g.fillStyle = '#2A62C0'; g.fillRect(x, y, w, h * 0.09)
      const sg = g.createLinearGradient(x, 0, x + w, 0)
      sg.addColorStop(0, 'rgba(255,255,255,0.14)'); sg.addColorStop(0.4, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.2)')
      g.fillStyle = sg; g.fillRect(x, y, w, h)
      g.save()
      g.translate(x + w / 2, y + h / 2); g.rotate(Math.PI / 2)
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = `600 ${Math.round(26 * it.sc)}px ${SERIF}`
      let name = (it.s.name || '').toUpperCase()
      while (name.length > 3 && g.measureText(name).width > h * 0.7) name = name.slice(0, -2) + '…'
      g.fillText(name, 0, 0)
      g.restore()
    }
    // la cassette du milieu, de face
    const fw = SW + (FW - SW) * k, fh = SH + (FH - SH) * k
    const fx = CX - fw / 2, fy = CY - fh / 2
    g.save()
    g.shadowColor = 'rgba(40,28,12,0.4)'; g.shadowBlur = 40; g.shadowOffsetY = 24
    g.fillStyle = '#1D4F9C'; g.fillRect(fx, fy, fw, fh)
    g.restore()
    const band = fh * 0.09
    const bg2 = g.createLinearGradient(0, fy, 0, fy + band)
    bg2.addColorStop(0, '#3D7BD8'); bg2.addColorStop(1, '#1F56B0')
    g.fillStyle = bg2; g.fillRect(fx + 4, fy + 4, fw - 8, band)
    g.fillStyle = '#fff'; g.font = `800 ${Math.round(band * 0.42)}px ${SANS}`; g.textBaseline = 'middle'; g.textAlign = 'left'
    g.fillText(spaced('Série'), fx + fw * 0.07, fy + 4 + band / 2)
    g.textAlign = 'right'; g.fillText(year(s) || '', fx + fw * 0.93, fy + 4 + band / 2)
    const p = this.imgs.get('p' + s.id)
    g.fillStyle = '#15120F'; g.fillRect(fx + 4, fy + 4 + band, fw - 8, fh - 8 - band)
    if (p) { g.globalAlpha = k; cover(g, p, fx + 4, fy + 4 + band, fw - 8, fh - 8 - band); g.globalAlpha = 1 }
    const sheen = g.createLinearGradient(fx, fy, fx + fw, fy + fh)
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)'); sheen.addColorStop(0.3, 'rgba(255,255,255,0)')
    g.fillStyle = sheen; g.fillRect(fx, fy, fw, fh)

    // le titre, en bleu, sous l'étagère
    g.globalAlpha = out((t - 0.2) / 0.6)
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'
    g.fillStyle = ACCENT; g.font = `600 64px ${SANS}`
    g.fillText(wrap(g, s.name, 1100, 1)[0] || '', CX, 745)
    g.fillStyle = MUTED; g.font = `600 20px ${SANS}`
    g.fillText(spaced([year(s), s.seasons ? `${s.seasons} saisons` : '', s.networks?.[0]].filter(Boolean).join('  ·  ')), CX, 784)
    g.globalAlpha = 1
    // la frise des années
    g.fillStyle = 'rgba(26,24,20,0.16)'; g.fillRect(120, 836, LW - 240, 2)
    for (let i = 0; i < n; i++) {
      const x = 120 + (n > 1 ? i / (n - 1) : 0.5) * (LW - 240)
      g.fillStyle = i === this.i ? ACCENT : 'rgba(26,24,20,0.35)'
      if (i === this.i) { g.fillRect(x - 2, 820, 4, 32); g.beginPath(); g.arc(x, 837, 7, 0, 7); g.fill() } else g.fillRect(x - 1, 828, 2, 18)
    }
    // en-tête
    g.textAlign = 'left'; g.fillStyle = INK; g.font = `600 18px ${SANS}`
    g.fillText(spaced('Nos séries'), 70, 70)
    g.fillRect(250, 63, 90, 2)
    g.fillText(spaced('Vidéothèque'), 360, 70)
    g.textAlign = 'right'; g.fillStyle = MUTED
    g.fillText(spaced(`N° ${String(this.i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`), LW - 70, 70)
    g.restore()
  }
}
