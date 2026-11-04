import TAPS from './tutoFrames.json'

/**
 * Le tuto de la télé : de vraies captures de l'app, présentées dans un téléphone, avec le doigt
 * qui montre chaque geste. Dessiné sur un canevas (texture de la télé, ou calque net quand on
 * zoome dessus). Repère logique 1600 × 900, mis à l'échelle de la cible.
 */

export const TV_W = 960, TV_H = 540
export const SLIDE_DUR = 7.5

const LW = 1600, LH = 900
const SERIF = '"Newsreader", Georgia, serif'
const SANS = '"Inter Tight", system-ui, sans-serif'
const INK = '#141414', COBALT = '#1F3FB0', MUTED = '#5E5A53'
const SHOT_W = 450, SHOT_H = 974

const SLIDES = [
  { title: 'Bienvenue dans ton salon', text: 'Glisse le doigt pour regarder autour de toi. Touche les objets : ils réagissent.', frames: ['salon-a', 'salon-b'] },
  { title: 'Entre dans ta bibliothèque', text: 'Touche la bibliothèque du salon : la caméra plonge et tu arrives devant tes étagères.', frames: ['enter-a', 'enter-b', 'enter-c'] },
  { title: 'Ajoute un livre', text: '« + Ajouter un livre » : tape un titre, un auteur… ou scanne le code-barres au dos.', frames: ['add-a', 'add-b'] },
  { title: 'Remplis ton panier', text: 'Touche « + », ou reste appuyé sur un livre et glisse-le : le panier monte pour l’attraper.', frames: ['basket-a', 'basket-b', 'basket-c'] },
  { title: 'Range tes livres', text: '« Ranger mon livre » : choisis l’étagère, une est déjà suggérée. Le livre s’y envole.', frames: ['range-a', 'range-c'] },
  { title: 'Tes étagères, à ton goût', text: '« Mes étagères » : crée, renomme, change le bois, la couleur du fond et les portes.', frames: ['shelves-a', 'shelves-b', 'shelves-c'] },
  { title: 'Déplace tes livres', text: 'Reste appuyé sur un livre, puis glisse-le à sa nouvelle place.', frames: ['move-a', 'move-b'] },
  { title: 'En cours, lu', text: 'Touche un livre : « En cours » glisse un marque-page entre ses pages, « Lu » le tamponne.', frames: ['read-a', 'read-b', 'read-c'] },
  { title: 'Retrouve un livre', text: 'Tape quelques lettres dans « Retrouver un livre… » : la bibliothèque t’emmène jusqu’à lui.', frames: ['find-a', 'find-b'] },
  { title: 'Reviens au salon', text: 'Le bouton « Salon », en haut à droite, te ramène ici. Bonne lecture !', frames: ['home-a', 'home-b', 'home-c'] },
]

export const TUTO_STEPS = () => SLIDES.map(({ title, text }) => ({ title, text }))

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const out = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3)
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1)

// ---- Images (chargées à la demande : l'étape en cours et la suivante) ----------------------
const imgs = new Map()
function img(name) {
  let im = imgs.get(name)
  if (!im) {
    im = new Image()
    im.decoding = 'async'
    im.src = `/tuto/${name}.webp`
    imgs.set(name, im)
  }
  return im.complete && im.naturalWidth ? im : null
}
function preload(i) { SLIDES[(i + SLIDES.length) % SLIDES.length].frames.forEach(img) }

function rr(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = []
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t
  }
  if (line) lines.push(line)
  return lines
}

/** Le doigt : un disque clair avec une ombre ; une onde quand il touche. */
function finger(g, x, y, press, ring) {
  if (ring > 0 && ring < 1) {
    g.strokeStyle = `rgba(31,63,176,${0.55 * (1 - ring)})`; g.lineWidth = 5
    g.beginPath(); g.arc(x, y, 26 + ring * 46, 0, 7); g.stroke()
  }
  const r = 26 - press * 4
  g.fillStyle = 'rgba(20,16,10,0.22)'; g.beginPath(); g.arc(x + 5, y + 9, r, 0, 7); g.fill()
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
  g.strokeStyle = 'rgba(31,63,176,0.85)'; g.lineWidth = 3; g.stroke()
}

export class TvTutorial {
  constructor() { this.i = 0; this.t = 0; preload(0); preload(1) }
  get count() { return SLIDES.length }
  update(dt) {
    this.t += dt
    if (this.t > SLIDE_DUR) { this.go(this.i + 1); return true }
    return false
  }
  go(i) { this.i = (i + SLIDES.length) % SLIDES.length; this.t = 0; preload(this.i); preload(this.i + 1) }
  next() { this.go(this.i + 1) }
  prev() { this.go(this.i - 1) }

  /** Dessine l'écran entier dans un contexte de taille w × h. */
  draw(g, w = TV_W, h = TV_H) {
    g.save()
    g.setTransform(w / LW, 0, 0, h / LH, 0, 0)
    g.imageSmoothingQuality = 'high'
    const bg = g.createLinearGradient(0, 0, LW, LH)
    bg.addColorStop(0, '#F6F2EA'); bg.addColorStop(1, '#E7DFD1')
    g.fillStyle = bg; g.fillRect(0, 0, LW, LH)
    // grand rond de couleur derrière le téléphone (doux, comme les affiches du salon)
    g.fillStyle = 'rgba(31,63,176,0.08)'; g.beginPath(); g.arc(470, 470, 380, 0, 7); g.fill()
    g.fillStyle = 'rgba(194,119,78,0.12)'; g.beginPath(); g.arc(640, 160, 120, 0, 7); g.fill()

    const s = SLIDES[this.i], t = this.t
    const enter = out(seg(t, 0, 0.7)), leave = ease(seg(t, SLIDE_DUR - 0.5, SLIDE_DUR))

    // ---- le téléphone
    const ph = 820, pw = Math.round(ph * (390 / 844)) + 28
    const px = 470 - pw / 2, py = 40 + (1 - enter) * 50 + leave * -30
    g.save()
    g.globalAlpha = enter * (1 - leave)
    g.shadowColor = 'rgba(20,16,10,0.35)'; g.shadowBlur = 50; g.shadowOffsetY = 24
    g.fillStyle = '#111'; rr(g, px, py, pw, ph, 62); g.fill()
    g.shadowColor = 'transparent'
    const sx = px + 14, sy = py + 14, sw = pw - 28, sh = ph - 28
    g.save()
    rr(g, sx, sy, sw, sh, 50); g.clip()
    g.fillStyle = '#EDEBE6'; g.fillRect(sx, sy, sw, sh)
    const nf = s.frames.length
    const fd = SLIDE_DUR / nf
    const k = Math.min(nf - 1, Math.floor(t / fd))
    const ft = t - k * fd
    const drawShot = (name, alpha, zoom) => {
      const im = img(name)
      if (!im || alpha <= 0) return
      g.globalAlpha = alpha * enter * (1 - leave)
      const z = 1 + zoom
      const dw = sw * z, dh = (sw * SHOT_H / SHOT_W) * z
      g.drawImage(im, sx - (dw - sw) / 2, sy + 46 - (dh - sw * SHOT_H / SHOT_W) * 0.3, dw, dh)   // sous l'encoche
    }
    // fondu entre deux captures, légère avancée de la caméra
    const prevA = k > 0 ? 1 - seg(ft, 0, 0.45) : 0
    if (prevA > 0) drawShot(s.frames[k - 1], prevA, 0.03)
    drawShot(s.frames[k], k > 0 ? seg(ft, 0, 0.45) : 1, 0.03 * seg(ft, 0, fd))
    g.globalAlpha = enter * (1 - leave)
    // le doigt
    for (const tap of TAPS[s.frames[k]] || []) {
      const p0 = seg(ft, 0.35, 0.75)
      if (p0 <= 0) continue
      let fx = sx + tap.x * sw, fy = sy + 46 + tap.y * (sw * SHOT_H / SHOT_W)
      let press = 0, ring = -1
      if (tap.kind === 'swipe') {
        const m = ease(seg(ft, 0.8, 2.0))
        fx += (tap.dx || 0) / 390 * sw * m
        press = m > 0 && m < 1 ? 1 : 0
      } else if (tap.kind === 'hold') {
        press = 1; ring = (ft * 0.8) % 1
      } else {
        const r = seg(ft, 0.8, 1.6); press = r > 0 && r < 0.4 ? 1 : 0; ring = r
      }
      g.globalAlpha = enter * (1 - leave) * out(p0) * (1 - seg(ft, fd - 0.35, fd))
      finger(g, fx, fy, press, ring)
    }
    g.restore()
    // encoche
    g.globalAlpha = enter * (1 - leave)
    g.fillStyle = '#111'; rr(g, px + pw / 2 - 58, py + 26, 116, 30, 15); g.fill()
    g.restore()

    // ---- le texte
    g.save()
    g.globalAlpha = enter * (1 - leave)
    g.translate((1 - enter) * 40 - leave * 30, 0)
    g.textBaseline = 'alphabetic'
    g.fillStyle = COBALT; g.font = `600 22px ${SANS}`
    g.fillText(`ÉTAPE ${this.i + 1} SUR ${SLIDES.length}`.split('').join(String.fromCharCode(8202)), 800, 250)
    g.fillStyle = INK; g.font = `500 72px ${SERIF}`
    const tl = wrap(g, s.title, 700)
    tl.forEach((l, j) => g.fillText(l, 800, 336 + j * 78))
    g.fillStyle = MUTED; g.font = `400 36px ${SERIF}`
    wrap(g, s.text, 680).forEach((l, j) => g.fillText(l, 800, 336 + tl.length * 78 + 40 + j * 50))
    g.restore()
    // progression
    for (let j = 0; j < SLIDES.length; j++) {
      g.fillStyle = j === this.i ? COBALT : 'rgba(20,20,20,0.18)'
      g.beginPath(); g.arc(808 + j * 30, 790, j === this.i ? 8 : 6, 0, 7); g.fill()
    }
    g.fillStyle = 'rgba(20,20,20,0.12)'; g.fillRect(800, 820, 560, 4)
    g.fillStyle = COBALT; g.fillRect(800, 820, 560 * clamp(t / SLIDE_DUR, 0, 1), 4)
    g.restore()
  }
}
