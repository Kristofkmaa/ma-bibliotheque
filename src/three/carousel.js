/**
 * Le carrousel des pièces : chaque pièce (une maquette, avec sa propre scène 3D) est posée sur un
 * grand cercle. Celle de devant est en grand ; les autres sont plus loin, plus petites, et tournent
 * doucement sur elles-mêmes (leurs murs s'abaissent et se relèvent comme si on les tournait à la
 * main). Aller dans une autre pièce fait tourner tout le carrousel.
 *
 * Chaque scène reçoit seulement une « pose » de caméra : { az, el, scale, ox, oy, spin }
 * (angle autour de la maquette, hauteur, taille à l'écran, décalage en pixels, vitesse de rotation).
 * Les toiles sont superposées : la pièce la plus proche passe devant.
 */
const SPIN = 0.13                 // rad/s : un tour en ~48 s
const TURN_MS = 2100
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const TAU = Math.PI * 2

/**
 * Où se trouve une pièce à l'écran, pour un angle α autour du carrousel (0 : devant, π : au fond).
 * Le cercle est vu d'en haut et de biais : les pièces du fond sont plus haut et plus petites,
 * celles des côtés s'écartent à gauche et à droite.
 */
export function poseAt(alpha, w, h) {
  const mobile = w < 768
  const u = (1 - Math.cos(alpha)) / 2      // 0 devant → 1 au fond
  const v = Math.sin(alpha)                // -1 à gauche, 1 à droite
  const ring = mobile ? { x: 0.34 * w, y: 0.35 * h, s: 0.25, side: 0.3 } : { x: 0.37 * w, y: 0.33 * h, s: 0.24, side: 0.32 }
  // la taille fond vite en quittant le devant (les pièces des côtés sont déjà petites)
  const k = Math.min(1, u * 2)
  const scale = 1 - (1 - ring.side) * Math.pow(k, 0.8) - (ring.side - ring.s) * Math.max(0, u * 2 - 1)
  return { ox: v * ring.x, oy: -ring.y * Math.pow(u, 0.6), scale, depth: u }
}

export class RoomCarousel {
  /** rooms : [{ id, scene, host, az0, el0 }] dans l'ordre du cercle ; front : l'id de la pièce de devant. */
  constructor(rooms, front) {
    this.rooms = rooms
    this.front = rooms.findIndex(r => r.id === front)
    this.turning = null
    this.raf = 0
    this.idle()
  }
  get n() { return this.rooms.length }
  size() { const h = this.rooms[0].host; return { w: h.clientWidth || innerWidth, h: h.clientHeight || innerHeight } }
  alphaOf(i, front = this.front) { return (((i - front) % this.n) + this.n) % this.n * (TAU / this.n) }

  _apply(i, alpha, az, spin = 0) {
    const r = this.rooms[i]
    const { w, h } = this.size()
    const p = poseAt(alpha, w, h)
    r.lastAz = az                // (la scène ajoute elle-même sa rotation lente, remise à zéro quand spin vaut 0)
    r.scene.setCarousel({ az, el: r.el0, scale: p.scale, ox: p.ox, oy: p.oy, spin })
    r.host.style.zIndex = String(10 - Math.round(p.depth * 8))
    r.host.style.pointerEvents = 'none'
  }
  /** Au repos : la pièce de devant est à nous, les autres tournent lentement au fond. */
  idle() {
    this.rooms.forEach((r, i) => {
      r.host.classList.toggle('bg', i !== this.front)
      if (i === this.front) {
        r.scene.setCarousel(null)
        r.host.style.zIndex = '10'
        r.host.style.pointerEvents = ''
      } else this._apply(i, this.alphaOf(i), r.lastAz ?? r.az0 + this.alphaOf(i), SPIN)
    })
  }
  resize() { if (!this.turning) this.idle(); this.onLayout?.() }
  /** Les pièces du fond, à l'écran (pour poser leur étiquette et y aller d'un toucher). */
  spots() {
    if (this.turning) return []
    const { w, h } = this.size()
    return this.rooms.map((r, i) => ({ r, i })).filter(x => x.i !== this.front).map(({ r, i }) => {
      const p = poseAt(this.alphaOf(i), w, h)
      // (la pièce juste derrière dépasse au-dessus de celle de devant : son étiquette va en haut)
      return { id: r.id, x: w / 2 + p.ox, y: h / 2 + p.oy, size: p.scale * Math.min(w, h) * 0.9, above: p.depth > 0.9 && w >= 768 }
    })
  }

  /** La pièce qui vient devant reprend la main : on oublie l'angle où elle tournait au fond. */
  _release(i) { this.rooms[i].lastAz = undefined }
  /** Faire tourner le carrousel jusqu'à la pièce `id` ; done() quand elle est devant. */
  turnTo(id, done) {
    const to = this.rooms.findIndex(r => r.id === id)
    if (to < 0 || to === this.front || this.turning) { done?.(); return }
    let steps = ((to - this.front) % this.n + this.n) % this.n
    if (steps > this.n / 2) steps -= this.n      // par le plus court chemin
    const delta = -steps * (TAU / this.n)      // le carrousel tourne : la pièce choisie vient devant
    const start = this.rooms.map((r, i) => {
      const a0 = this.alphaOf(i)
      // la pièce qui part garde l'angle où on la regardait ; les autres partent de leur rotation en cours
      const az = i === this.front ? r.scene.currentAz?.() ?? r.az0 : r.az0 + a0 + (r.scene.carouselSpin?.() || 0)
      return { a0, az }
    })
    this.turning = { t0: performance.now(), delta, start, to, done }
    const step = now => {
      const T = this.turning
      const k = Math.min(1, (now - T.t0) / TURN_MS), e = ease(k)
      this.rooms.forEach((r, i) => {
        const s = T.start[i]
        const alpha = s.a0 + T.delta * e
        // la pièce qui arrive finit dans sa vue habituelle (tour complet arrondi), les autres suivent le cercle
        let az
        if (i === T.to) {
          // finir dans sa vue habituelle, en tournant dans le même sens que le carrousel
          const turns = (s.az - r.az0) / TAU
          const end = r.az0 + (T.delta < 0 ? Math.floor(turns + 1e-6) : Math.ceil(turns - 1e-6)) * TAU
          az = s.az + (end - s.az) * e
        } else az = s.az + T.delta * e
        this._apply(i, alpha, az)
      })
      if (k < 1) { this.raf = requestAnimationFrame(step); return }
      this.rooms.forEach(r => r.host.classList.remove('bg'))
      this.front = T.to
      this.turning = null
      this._release(T.to)
      this.idle()
      T.done?.()
    }
    this.raf = requestAnimationFrame(step)
  }
  dispose() { cancelAnimationFrame(this.raf) }
}
