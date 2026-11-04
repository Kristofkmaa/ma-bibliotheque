/**
 * Le tuto qui passe en boucle sur la télé du salon : une suite de petites scènes animées,
 * dessinées sur un canevas (pas de vidéo), dans les couleurs du site.
 */

export const TV_W = 960, TV_H = 540
export const SLIDE_DUR = 6.5

const SERIF = '"Newsreader", Georgia, serif'
const SANS = '"Inter Tight", system-ui, sans-serif'
const PAPER = '#F4F2ED', GOLD = '#F4C35A', COBALT = '#2B47B0'
const SPINES = ['#B8322B', '#3F57B5', '#1E5A4A', '#C7692A', '#4A3B8C', '#D9A93A', '#7A2E3A', '#2E2A26', '#C2774E', '#2F5A4B']
const WOODS = [['#D8CCB0', '#DAD5CA'], ['#73513A', '#2F5A4B'], ['#2A2A2D', '#D3A23E'], ['#F0EDE6', '#2B47B0'], ['#ADB3B9', '#B9443A']]

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const out = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3)
const back = t => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) }
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1)

function rr(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r)
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r)
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y)
  g.closePath()
}

/** Le doigt : un rond clair, et des ondes quand il touche. */
function finger(g, x, y, press = 0, ripple = -1) {
  if (ripple >= 0 && ripple <= 1) {
    g.strokeStyle = `rgba(244,242,237,${0.7 * (1 - ripple)})`; g.lineWidth = 3
    g.beginPath(); g.arc(x, y, 18 + ripple * 34, 0, 7); g.stroke()
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 4, y + 6, 17 - press * 3, 0, 7); g.fill()
  g.fillStyle = 'rgba(244,242,237,0.95)'; g.beginPath(); g.arc(x, y, 17 - press * 3, 0, 7); g.fill()
  g.strokeStyle = 'rgba(20,20,20,0.25)'; g.lineWidth = 2; g.stroke()
}

function spine(g, x, y, w, h, c) {
  g.fillStyle = c; g.fillRect(x, y, w, h)
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, 3, h)
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 4, y + 10, w - 8, 3); g.fillRect(x + 4, y + h - 13, w - 8, 3)
}

function cover(g, x, y, w, h, c, c2) {
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 6, y + 8, w, h)
  g.fillStyle = c; g.fillRect(x, y, w, h)
  g.fillStyle = c2; g.beginPath(); g.arc(x + w / 2, y + h * 0.42, w * 0.28, 0, 7); g.fill()
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x + w * 0.18, y + h * 0.78, w * 0.64, 5)
}

function shelfBox(g, x, y, w, h, wood, wall) {
  g.fillStyle = wall; g.fillRect(x, y, w, h)
  g.fillStyle = wood
  g.fillRect(x - 8, y + h, w + 16, 10)
  g.fillRect(x - 8, y - 4, 8, h + 8); g.fillRect(x + w, y - 4, 8, h + 8)
}

function basket(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s)
  g.strokeStyle = '#B57A3D'; g.lineWidth = 7
  g.beginPath(); g.ellipse(0, -10, 70, 62, 0, Math.PI, 0); g.stroke()
  g.fillStyle = '#C99355'
  g.beginPath(); g.moveTo(-82, -10); g.lineTo(82, -10); g.lineTo(62, 62); g.lineTo(-62, 62); g.closePath(); g.fill()
  g.strokeStyle = 'rgba(90,55,20,0.45)'; g.lineWidth = 3
  for (let k = 0; k < 4; k++) { const yy = 6 + k * 15; g.beginPath(); g.moveTo(-80 + k * 5, yy); g.lineTo(80 - k * 5, yy); g.stroke() }
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 22, -10); g.lineTo(k * 17, 62); g.stroke() }
  g.fillStyle = '#E2B272'; rr(g, -88, -18, 176, 14, 7); g.fill()
  g.restore()
}

function typed(text, t, a, b) {
  const n = Math.floor(text.length * seg(t, a, b))
  return text.slice(0, n)
}

function field(g, x, y, w, text, caret, label) {
  g.fillStyle = 'rgba(244,242,237,0.1)'; rr(g, x, y, w, 56, 6); g.fill()
  g.strokeStyle = 'rgba(244,242,237,0.5)'; g.lineWidth = 2; g.stroke()
  g.fillStyle = PAPER; g.font = `italic 400 28px ${SERIF}`; g.textBaseline = 'middle'
  const shown = text || label
  g.globalAlpha = text ? 1 : 0.5
  g.fillText(shown, x + 18, y + 29)
  g.globalAlpha = 1
  if (caret) { const tw = text ? g.measureText(text).width : 0; g.fillRect(x + 20 + tw, y + 14, 2.5, 30) }
}

// ---- Les scènes -------------------------------------------------------------------------------
const SLIDES = [
  {
    title: 'Bienvenue dans ton salon',
    text: 'Glisse le doigt pour regarder autour de toi. Touche les objets : ils réagissent.',
    draw(g, t, cx, cy) {
      // petite pièce en maquette qui pivote doucement
      const a = Math.sin(t * 1.1) * 0.25
      g.save(); g.translate(cx, cy + 20)
      const iso = (x, z) => [(x - z) * Math.cos(0.5 + a) * 1.0, (x + z) * 0.5 * Math.sin(0.5 + 0.3) - 0]
      const P = (x, y, z) => { const [u, v] = iso(x, z); return [u, v - y] }
      const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill() }
      poly([P(-110, 0, -110), P(110, 0, -110), P(110, 0, 110), P(-110, 0, 110)], '#C9A47A')
      poly([P(-110, 0, -110), P(110, 0, -110), P(110, 150, -110), P(-110, 150, -110)], '#ECE3D5')
      poly([P(-110, 0, -110), P(-110, 0, 110), P(-110, 150, 110), P(-110, 150, -110)], '#E0D4C2')
      poly([P(-20, 0, -108), P(40, 0, -108), P(40, 70, -108), P(-20, 70, -108)], '#F6EFE4')
      poly([P(0, 6, -106), P(22, 6, -106), P(22, 34, -106), P(0, 34, -106)], `rgba(255,${140 + Math.sin(t * 9) * 20},60,0.95)`)
      poly([P(-108, 0, -60), P(-108, 0, 10), P(-108, 110, 10), P(-108, 110, -60)], '#73513A')
      poly([P(40, 0, 40), P(100, 0, 40), P(100, 30, 40), P(40, 30, 40)], '#8FA697')
      g.restore()
      // le doigt glisse de gauche à droite
      const s = (t % 3) / 3
      const fx = cx - 90 + ease(seg(s, 0.1, 0.7)) * 180
      finger(g, fx, cy + 150, s > 0.1 && s < 0.7 ? 1 : 0)
      g.strokeStyle = 'rgba(244,242,237,0.6)'; g.lineWidth = 3
      g.beginPath(); g.moveTo(cx - 70, cy + 190); g.lineTo(cx + 70, cy + 190); g.stroke()
      g.beginPath(); g.moveTo(cx + 58, cy + 182); g.lineTo(cx + 70, cy + 190); g.lineTo(cx + 58, cy + 198); g.stroke()
    },
  },
  {
    title: 'Entre dans ta bibliothèque',
    text: 'Touche la bibliothèque du salon : tu entres dans ton mur de livres. Les portes cachent les étagères qu’on ne regarde pas.',
    draw(g, t, cx, cy) {
      const x = cx - 120, y = cy - 140, w = 240, rh = 82
      for (let r = 0; r < 3; r++) {
        const yy = y + r * (rh + 10)
        shelfBox(g, x, yy, w, rh, '#C9A47A', r === 1 ? '#2F5A4B' : '#DAD5CA')
        for (let k = 0; k < 9; k++) spine(g, x + 8 + k * 24, yy + 14 + (k % 3) * 4, 20, rh - 14 - (k % 3) * 4, SPINES[(k + r * 3) % SPINES.length])
        // portes qui glissent
        const open = r < 2 ? ease(seg(t, 1.2 + r * 0.25, 2.2 + r * 0.25)) : 0
        g.fillStyle = '#E6DBC3'
        g.fillRect(x + open * -w * 0.55, yy, w / 2, rh)
        g.fillRect(x + w / 2 + open * w * 0.55, yy, w / 2, rh)
        g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2
        g.strokeRect(x + open * -w * 0.55 + 8, yy + 8, w / 2 - 16, rh - 16)
        g.strokeRect(x + w / 2 + open * w * 0.55 + 8, yy + 8, w / 2 - 16, rh - 16)
      }
      g.fillStyle = 'rgba(30,42,85,1)'; g.fillRect(x - 160, y - 10, 152, 300); g.fillRect(x + w + 8, y - 10, 160, 300)
      const tap = seg(t, 0.4, 1.2)
      finger(g, cx + 30, cy + 10, tap > 0.3 && tap < 1 ? 1 : 0, tap > 0.3 ? (tap - 0.3) / 0.7 : -1)
    },
  },
  {
    title: 'Ajoute un livre',
    text: '« + Ajouter un livre » : cherche un titre, un auteur… ou scanne le code-barres au dos du livre.',
    draw(g, t, cx, cy) {
      field(g, cx - 180, cy - 150, 360, typed('Le Petit Prince', t, 0.5, 2.6), Math.floor(t * 2) % 2 === 0, 'Un titre, un auteur…')
      const show = out(seg(t, 2.8, 3.6))
      for (let k = 0; k < 3; k++) {
        const yy = cy - 60 + (1 - show) * 40
        g.globalAlpha = show
        cover(g, cx - 160 + k * 115, yy, 90, 130, SPINES[k * 2 + 1], SPINES[(k * 2 + 4) % 10])
        g.globalAlpha = 1
      }
      // code-barres
      const bx = cx - 70, by = cy + 110
      g.fillStyle = PAPER; rr(g, bx - 14, by - 10, 168, 74, 6); g.fill()
      g.fillStyle = '#141414'
      let xx = bx
      for (let k = 0; k < 34; k++) { const w = [2, 3, 1, 4][k % 4]; if (k % 2 === 0) g.fillRect(xx, by, w, 54); xx += w + 1.6 }
      const scan = (t * 0.9) % 1
      g.fillStyle = 'rgba(201,97,79,0.85)'; g.fillRect(bx - 10, by + scan * 54, 160, 3)
    },
  },
  {
    title: 'Remplis ton panier',
    text: 'Touche + sur un livre, ou reste appuyé dessus et glisse-le : le panier apparaît pour l’attraper.',
    draw(g, t, cx, cy) {
      const by = cy + 110
      const rise = back(seg(t, 0.6, 1.4)) * (1 - seg(t, 5.2, 5.9))
      basket(g, cx + 70, by + 140 - rise * 140, 0.9)
      const bx0 = cx - 170, by0 = cy - 170
      const f = ease(seg(t, 1.6, 3.2))
      const x = bx0 + (cx + 40 - bx0) * f, y = by0 + (by - 60 - by0) * f - Math.sin(f * Math.PI) * 90
      const sc = 1 - f * 0.35
      if (t < 3.3) {
        g.save(); g.translate(x + 40, y + 60); g.rotate(-0.15 * f + 0.05); g.scale(sc, sc)
        cover(g, -40, -60, 80, 118, '#B8322B', '#F4C35A'); g.restore()
      }
      const p = seg(t, 0.2, 0.9)
      g.fillStyle = COBALT; g.beginPath(); g.arc(bx0 + 84, by0 + 2, 18 * (1 + 0.15 * Math.sin(p * Math.PI)), 0, 7); g.fill()
      g.fillStyle = '#fff'; g.font = `600 26px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', bx0 + 84, by0 + 2); g.textAlign = 'left'
      if (t > 1.5 && t < 3.2) finger(g, x + 40, y + 70, 1)
      if (t > 3.2) {
        g.fillStyle = PAPER; g.font = `italic 400 22px ${SERIF}`; g.textAlign = 'center'
        g.globalAlpha = out(seg(t, 3.3, 3.8)) * (1 - seg(t, 5, 5.5)); g.fillText('1 livre', cx + 70, by + 100 - rise * 140 + 140); g.globalAlpha = 1; g.textAlign = 'left'
      }
    },
  },
  {
    title: 'Range tes livres',
    text: '« Ranger un par un » : choisis l’étagère, une est déjà suggérée (même auteur, même genre). Le livre s’y envole.',
    draw(g, t, cx, cy) {
      shelfBox(g, cx - 170, cy - 170, 340, 90, '#73513A', '#2F5A4B')
      const n = t > 3.6 ? 8 : 7
      for (let k = 0; k < n; k++) spine(g, cx - 160 + k * 26, cy - 156 + (k % 2) * 6, 22, 76 - (k % 2) * 6, k === 7 ? '#C9614F' : SPINES[k])
      const names = [['Polars', '#73513A', '#2F5A4B'], ['Romans', '#D8CCB0', '#DAD5CA'], ['Poésie', '#F0EDE6', '#2B47B0']]
      names.forEach(([nm, wd, wl], k) => {
        const x = cx - 190 + k * 132, y = cy + 120
        const sugg = k === 0
        g.fillStyle = 'rgba(244,242,237,0.12)'; rr(g, x, y, 120, 46, 4); g.fill()
        g.strokeStyle = sugg ? GOLD : 'rgba(244,242,237,0.35)'; g.lineWidth = sugg ? 3 + Math.sin(t * 5) : 1.5; g.stroke()
        g.fillStyle = wl; g.fillRect(x + 10, y + 12, 22, 22); g.strokeStyle = wd; g.lineWidth = 4; g.strokeRect(x + 10, y + 12, 22, 22)
        g.fillStyle = PAPER; g.font = `400 20px ${SERIF}`; g.textBaseline = 'middle'; g.fillText(nm, x + 42, y + 24)
        if (sugg) { g.fillStyle = GOLD; g.font = `600 12px ${SANS}`; g.fillText('SUGGÉRÉE', x, y - 12) }
      })
      // le livre part de la fenêtre et vole sur l'étagère
      const f = ease(seg(t, 2.2, 3.6))
      if (t < 3.6) {
        const x0 = cx - 40, y0 = cy - 40, x1 = cx - 160 + 7 * 26, y1 = cy - 156
        const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * 60
        const w = 70 - 48 * f, h = 100 - 24 * f
        if (f < 0.5) cover(g, x, y, w, h, '#C9614F', '#F4C35A'); else spine(g, x, y, Math.max(22, w), h, '#C9614F')
      }
      const tap = seg(t, 1.4, 2.2)
      if (t > 1.2 && t < 2.6) finger(g, cx - 120, cy + 143, tap > 0.4 ? 1 : 0, tap > 0.4 ? (tap - 0.4) / 0.6 : -1)
    },
  },
  {
    title: 'Tes étagères, à ton goût',
    text: '« Mes étagères » : crée, renomme, change le bois, la couleur du fond et le style des portes.',
    draw(g, t, cx, cy) {
      for (let r = 0; r < 3; r++) {
        const k = (Math.floor(t / 1.6) + r) % WOODS.length
        const k2 = (k + WOODS.length - 1) % WOODS.length
        const f = ease(seg(t % 1.6, 0, 0.5))
        const mix = (a, b) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = s => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f); return `rgb(${c(16)},${c(8)},${c(0)})` }
        const y = cy - 150 + r * 104
        shelfBox(g, cx - 150, y, 300, 84, mix(WOODS[k2][0], WOODS[k][0]), mix(WOODS[k2][1], WOODS[k][1]))
        g.fillStyle = PAPER; g.font = `600 13px ${SANS}`
        g.fillRect(cx - 150, y + 84, 0, 0)
        g.fillStyle = 'rgba(20,20,20,0.85)'; g.fillRect(cx - 146, y + 76, 92, 20)
        g.fillStyle = PAPER; g.textBaseline = 'middle'; g.fillText(['POLARS', 'ROMANS', 'POÉSIE'][r], cx - 140, y + 86)
        for (let b = 0; b < 6; b++) spine(g, cx - 120 + b * 26, y + 16, 22, 60, SPINES[(b + r * 2) % 10])
      }
    },
  },
  {
    title: 'Déplace tes livres',
    text: 'Dans la bibliothèque, reste appuyé sur un livre, puis glisse-le à sa nouvelle place.',
    draw(g, t, cx, cy) {
      const x0 = cx - 170, y0 = cy - 60
      shelfBox(g, x0, y0, 340, 120, '#C9A47A', '#DAD5CA')
      const lift = ease(seg(t, 0.8, 1.4)), move = ease(seg(t, 1.4, 3.2)), drop = ease(seg(t, 3.2, 3.8))
      const from = 1, to = 9
      const pos = from + (to - from) * move
      for (let k = 0; k < 11; k++) {
        if (k === from) continue
        const slot = k < from ? k : k - 1
        const shift = slot >= Math.floor(pos) ? 1 : 0
        spine(g, x0 + 10 + (slot + shift * (move > 0 ? 1 : 0)) * 29, y0 + 18, 25, 102, SPINES[k % 10])
      }
      const bx = x0 + 10 + pos * 29, by = y0 + 18 - 40 * lift * (1 - drop)
      g.save(); g.translate(bx + 12, by + 51); g.rotate(-0.12 * lift * (1 - drop)); spine(g, -12, -51, 25, 102, '#C9614F'); g.restore()
      if (t > 0.3 && t < 3.6) finger(g, bx + 12, by + 60, t > 0.8 ? 1 : 0, t < 0.8 ? (t - 0.3) / 0.5 : -1)
      if (t > 0.6 && t < 1.2) { g.fillStyle = 'rgba(244,242,237,0.8)'; g.font = `italic 400 22px ${SERIF}`; g.fillText('appui long…', bx - 30, by - 40) }
    },
  },
  {
    title: 'En cours, lu',
    text: 'Touche un livre : marque-le « En cours » (un marque-page apparaît entre les pages) ou « Lu ».',
    draw(g, t, cx, cy) {
      const x = cx - 75, y = cy - 120
      // marque-page qui sort des pages
      const m = back(seg(t, 0.8, 1.8))
      g.fillStyle = '#C9614F'
      g.beginPath(); g.moveTo(x + 100, y + 20); g.lineTo(x + 124, y + 20); g.lineTo(x + 124, y + 20 - 70 * m); g.lineTo(x + 112, y + 8 - 70 * m); g.lineTo(x + 100, y + 20 - 70 * m); g.closePath(); g.fill()
      cover(g, x, y, 150, 220, '#1E5A4A', '#D9A93A')
      g.fillStyle = PAPER; g.font = `600 14px ${SANS}`; g.fillText('EN COURS', x + 150 + 26, y - 30 + 70 * (1 - m))
      // tampon « Lu »
      const s = seg(t, 3.0, 3.5)
      if (s > 0) {
        g.save(); g.translate(cx + 40, cy + 40); g.rotate(-0.22); const k = 1 + (1 - back(s)) * 1.2; g.scale(k, k)
        g.globalAlpha = Math.min(1, s * 2)
        g.strokeStyle = '#C9614F'; g.lineWidth = 5; rr(g, -78, -34, 156, 68, 8); g.stroke()
        g.fillStyle = '#C9614F'; g.font = `600 34px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LU', 0, -4)
        g.font = `600 10px ${SANS}`; g.fillText('BIBLIOTHÈQUE LEVANA', 0, 22)
        g.restore(); g.textAlign = 'left'
      }
    },
  },
  {
    title: 'Retrouve un livre',
    text: 'Tape quelques lettres dans « Retrouver un livre… » : le mur t’emmène jusqu’à lui et il sort de l’étagère.',
    draw(g, t, cx, cy) {
      field(g, cx - 180, cy - 160, 360, typed('Monte', t, 0.4, 1.4), Math.floor(t * 2) % 2 === 0, 'Retrouver un livre…')
      const x0 = cx - 170, y0 = cy - 30
      shelfBox(g, x0, y0, 340, 120, '#73513A', '#B9443A')
      const out1 = back(seg(t, 2.2, 2.9)) * (1 - ease(seg(t, 5.2, 5.8)))
      for (let k = 0; k < 11; k++) {
        const hit = k === 6
        const dy = hit ? -26 * out1 : 0
        spine(g, x0 + 10 + k * 29, y0 + 18 + dy, 25, 102, hit ? GOLD : SPINES[k % 10])
      }
      if (out1 > 0.1) { g.fillStyle = PAPER; g.font = `italic 400 22px ${SERIF}`; g.globalAlpha = Math.min(1, out1); g.fillText('Le Comte de Monte-Cristo', x0 + 60, y0 + 160); g.globalAlpha = 1 }
    },
  },
  {
    title: 'Reviens au salon',
    text: 'Le bouton « Salon », en haut à droite de la bibliothèque, te ramène ici. Bonne lecture !',
    draw(g, t, cx, cy) {
      const p = 1 + Math.sin(t * 4) * 0.05
      g.save(); g.translate(cx, cy - 20); g.scale(p, p)
      g.strokeStyle = PAPER; g.lineWidth = 3; rr(g, -110, -36, 220, 72, 4); g.stroke()
      g.lineWidth = 4
      g.beginPath(); g.moveTo(-74, 0); g.lineTo(-52, -20); g.lineTo(-30, 0); g.moveTo(-66, -6); g.lineTo(-66, 18); g.lineTo(-38, 18); g.lineTo(-38, -6); g.stroke()
      g.fillStyle = PAPER; g.font = `600 26px ${SANS}`; g.textBaseline = 'middle'; g.fillText('SALON', -12, 2)
      g.restore()
      const tap = (t % 2.2) / 2.2
      finger(g, cx + 50, cy + 10, tap > 0.3 && tap < 0.6 ? 1 : 0, tap > 0.3 ? (tap - 0.3) / 0.7 : -1)
      g.fillStyle = GOLD
      for (let k = 0; k < 5; k++) { const a = t * 0.8 + k * 1.26; g.beginPath(); g.arc(cx + Math.cos(a) * 170, cy + 120 + Math.sin(a) * 26, 4, 0, 7); g.fill() }
    },
  },
]

function wrapText(g, text, maxW) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t
  }
  if (line) lines.push(line)
  return lines
}

export const TUTO_STEPS = () => SLIDES.map(({ title, text }) => ({ title, text }))

export class TvTutorial {
  constructor() { this.i = 0; this.t = 0 }
  get count() { return SLIDES.length }
  update(dt) {
    this.t += dt
    if (this.t > SLIDE_DUR) { this.t = 0; this.i = (this.i + 1) % SLIDES.length; return true }
    return false
  }
  go(i) { this.i = (i + SLIDES.length) % SLIDES.length; this.t = 0 }
  next() { this.go(this.i + 1) }
  prev() { this.go(this.i - 1) }

  draw(g) {
    const W = TV_W, H = TV_H
    const bg = g.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, '#1E2A55'); bg.addColorStop(1, COBALT)
    g.fillStyle = bg; g.fillRect(0, 0, W, H)
    const s = SLIDES[this.i], t = this.t
    const enter = out(seg(t, 0, 0.6)), leave = ease(seg(t, SLIDE_DUR - 0.45, SLIDE_DUR))
    // l'illustration
    g.save()
    g.globalAlpha = enter * (1 - leave)
    g.translate(-30 * leave, 30 * (1 - enter))
    g.fillStyle = 'rgba(255,255,255,0.05)'; rr(g, 36, 40, 440, 460, 14); g.fill()
    g.beginPath(); rr(g, 36, 40, 440, 460, 14); g.clip()
    s.draw(g, t, 256, 270)
    g.restore()
    // le texte
    g.save()
    g.globalAlpha = enter * (1 - leave)
    g.translate(40 * (1 - enter) - 30 * leave, 0)
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'
    g.fillStyle = GOLD; g.font = `600 17px ${SANS}`
    g.fillText(`TUTO · ${this.i + 1} / ${SLIDES.length}`.split('').join(String.fromCharCode(8202)), 520, 110)
    g.fillStyle = PAPER; g.font = `500 42px ${SERIF}`
    const tl = wrapText(g, s.title, 400)
    tl.forEach((l, k) => g.fillText(l, 520, 166 + k * 46))
    g.fillStyle = 'rgba(244,242,237,0.78)'; g.font = `400 25px ${SERIF}`
    wrapText(g, s.text, 400).forEach((l, k) => g.fillText(l, 520, 166 + tl.length * 46 + 26 + k * 34))
    g.restore()
    // progression
    const n = SLIDES.length
    for (let k = 0; k < n; k++) {
      const x = 520 + k * 22, y = 488
      g.fillStyle = k === this.i ? GOLD : 'rgba(244,242,237,0.3)'
      g.beginPath(); g.arc(x, y, k === this.i ? 6 : 4.5, 0, 7); g.fill()
    }
    g.fillStyle = 'rgba(244,242,237,0.18)'; g.fillRect(520, 508, 400, 3)
    g.fillStyle = GOLD; g.fillRect(520, 508, 400 * (t / SLIDE_DUR), 3)
    // reflet de l'écran
    const r = g.createLinearGradient(0, 0, W, H)
    r.addColorStop(0, 'rgba(255,255,255,0.07)'); r.addColorStop(0.45, 'rgba(255,255,255,0)')
    g.fillStyle = r; g.fillRect(0, 0, W, H)
  }
}
