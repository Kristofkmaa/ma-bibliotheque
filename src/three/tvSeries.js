import { tmdbImgCors, loadImage, year, isMovie, runtimeLabel } from '../lib/tmdb'
// une note toujours entre 0 et 5 étoiles (une valeur hors échelle ne doit jamais casser l'affichage)
const st5 = n => Math.max(0, Math.min(5, Math.round(+n || 0)))

/**
 * L'image projetée au mur du salon : notre menu de films et séries, comme sur la projection
 * quand on y entre — fond sombre, l'affiche du moment (son image, son titre), une rangée de
 * cartes en dessous. Une œuvre toutes les 8 secondes. Repère logique 1600 × 900.
 */

export const TV_W = 1280, TV_H = 720
const SLIDE = 8
const LW = 1600, LH = 900
const SERIF = '"Newsreader", Georgia, serif'
const SANS = '"Inter Tight", system-ui, sans-serif'
const BG = '#0D0C0E', FG = '#F3EFE8', MUTED = 'rgba(243,239,232,0.62)', GOLD = '#E8B04B'
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
    list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.added_at || '').localeCompare(a.added_at || ''))
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
    if (this.hold) return false
    if (this.t > SLIDE && this.list.length > 1) { this.go(this.i + 1); return true }
    return false
  }
  go(i) { if (!this.list.length) return; this.i = (i + this.list.length) % this.list.length; this.t = 0 }
  next() { this.go(this.i + 1) }
  /** Montrer une œuvre précise (celle dont le générique passe). */
  showId(id) { const k = this.list.findIndex(x => x.id === id); if (k >= 0 && k !== this.i) this.go(k); this.hold = true }
  prev() { this.go(this.i - 1) }

  draw(g, w = TV_W, h = TV_H) {
    g.save()
    g.setTransform(w / LW, 0, 0, h / LH, 0, 0)
    // une vidéo passe par-dessus : rien d'autre ne doit se voir derrière elle
    if (this.blank) { g.fillStyle = '#000'; g.fillRect(0, 0, LW, LH); g.restore(); return }
    g.imageSmoothingQuality = 'high'
    g.fillStyle = BG; g.fillRect(0, 0, LW, LH)
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'
    const s = this.show
    // en-tête : le nom et les rayons
    const header = () => {
      g.fillStyle = GOLD; g.font = `500 40px ${SERIF}`; g.fillText('Maruchime', 70, 82)
      g.fillStyle = MUTED; g.font = `600 15px ${SANS}`; g.fillText(spaced('Films & séries'), 270, 80)
      g.font = `600 22px ${SANS}`
      ;[['Notre liste', FG], ['Séries', MUTED], ['Films', MUTED]].forEach(([t, c], k) => { g.fillStyle = c; g.fillText(t, 540 + [0, 170, 300][k], 80) })
    }
    if (!s) {
      header()
      g.fillStyle = FG; g.font = `800 120px ${SANS}`
      g.fillText('Nos films', 112, 470)
      g.fillStyle = GOLD
      g.fillText('& séries', 112, 600)
      g.fillStyle = MUTED; g.font = `italic 400 38px ${SERIF}`
      g.fillText('Touche l’image pour les ajouter', 120, 690)
      g.restore()
      return
    }
    const t = this.t, n = this.list.length
    const enter = out(t / 1.0), leave = clamp((t - (SLIDE - 0.6)) / 0.6, 0, 1) * (n > 1 ? 1 : 0)
    // l'affiche du moment : son image en grand, qui avance doucement
    const bimg = this.imgs.get('b' + s.id) || this.imgs.get('p' + s.id)
    g.save()
    g.globalAlpha = enter * (1 - leave)
    if (bimg) {
      const z = 1.04 + 0.05 * (t / SLIDE)
      cover(g, bimg, -LW * (z - 1) / 2, -LH * (z - 1) / 2, LW * z, LH * 0.78 * z)
    }
    g.restore()
    let sh = g.createLinearGradient(0, 0, LW, 0)
    sh.addColorStop(0, 'rgba(13,12,14,0.95)'); sh.addColorStop(0.4, 'rgba(13,12,14,0.55)'); sh.addColorStop(0.75, 'rgba(13,12,14,0)')
    g.fillStyle = sh; g.fillRect(0, 0, LW, LH)
    sh = g.createLinearGradient(0, LH * 0.35, 0, LH * 0.8)
    sh.addColorStop(0, 'rgba(13,12,14,0)'); sh.addColorStop(1, BG)
    g.fillStyle = sh; g.fillRect(0, LH * 0.35, LW, LH * 0.65)
    sh = g.createLinearGradient(0, 0, 0, 160)
    sh.addColorStop(0, 'rgba(13,12,14,0.85)'); sh.addColorStop(1, 'rgba(13,12,14,0)')
    g.fillStyle = sh; g.fillRect(0, 0, LW, 160)
    header()
    // le titre, à gauche
    g.save()
    g.globalAlpha = enter * (1 - leave)
    g.translate(0, (1 - enter) * 24)
    g.fillStyle = GOLD; g.font = `700 18px ${SANS}`
    g.fillText(spaced(`${isMovie(s) ? 'Film' : 'Série'}  —  ${s.category || s.genres?.[0] || ''}`), 72, 300)
    g.fillStyle = FG; g.font = `800 92px ${SANS}`
    const tl = wrap(g, s.name, 820, 2)
    tl.forEach((l, k) => g.fillText(l, 66, 392 + k * 90))
    let y = 392 + (tl.length - 1) * 90 + 52
    g.fillStyle = MUTED; g.font = `600 22px ${SANS}`
    const meta = [s.rating ? '★'.repeat(st5(s.rating)) : '', year(s), isMovie(s) ? runtimeLabel(s.runtime) : s.seasons ? `${s.seasons} saisons` : ''].filter(Boolean).join('   ·   ')
    g.fillText(meta, 72, y)
    // les deux boutons
    y += 34
    g.fillStyle = FG; rr(g, 72, y, 210, 62, 8); g.fill()
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(102, y + 16); g.lineTo(126, y + 31); g.lineTo(102, y + 46); g.closePath(); g.fill()
    g.font = `700 26px ${SANS}`; g.fillText('Lecture', 140, y + 40)
    g.fillStyle = 'rgba(110,106,100,0.6)'; rr(g, 298, y, 190, 62, 8); g.fill()
    g.fillStyle = FG; g.fillText('Infos', 380, y + 40)
    g.strokeStyle = FG; g.lineWidth = 3; g.beginPath(); g.arc(345, y + 31, 13, 0, 7); g.stroke()
    g.font = `italic 700 18px ${SERIF}`; g.textAlign = 'center'; g.fillText('i', 345, y + 38); g.textAlign = 'left'
    g.restore()
    // une rangée de cartes en bas
    g.fillStyle = FG; g.font = `700 26px ${SANS}`
    g.fillText(this.list.some(x => (x.rating || 0) >= 4) ? 'Nos coups de cœur' : 'Ajoutés récemment', 72, 712)
    const cw = 300, ch = 169, gap = 18
    for (let k = 0; k < Math.min(n, 5); k++) {
      const ser = this.list[(this.i + 1 + k) % n]
      if (n > 1 && ser === s && k > 0) break
      const x = 72 + k * (cw + gap), yy = 732
      const im = this.imgs.get('b' + ser.id) || this.imgs.get('p' + ser.id)
      g.save()
      rr(g, x, yy, cw, ch, 8); g.clip()
      g.fillStyle = '#24211E'; g.fillRect(x, yy, cw, ch)
      if (im) cover(g, im, x, yy, cw, ch)
      const cs = g.createLinearGradient(0, yy + ch * 0.4, 0, yy + ch)
      cs.addColorStop(0, 'rgba(0,0,0,0)'); cs.addColorStop(1, 'rgba(0,0,0,0.75)')
      g.fillStyle = cs; g.fillRect(x, yy, cw, ch)
      g.fillStyle = FG; g.font = `800 24px ${SANS}`
      g.fillText(wrap(g, ser.name, cw - 24, 1)[0] || '', x + 12, yy + ch - 14)
      g.restore()
    }
    g.restore()
  }
}

function rr(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
