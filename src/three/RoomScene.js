import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { noTouchSelect } from './webgl'

/**
 * Une pièce en maquette, toute simple (le garage, la chambre…) : un socle épais, un sol, quatre
 * murs (celui qui est entre nous et la pièce s'abaisse), vue de trois quarts qu'on fait tourner en
 * glissant, et la place sur le carrousel des pièces (setCarousel). Chaque pièce la meuble dans
 * _furnish() ; les objets qu'on peut toucher sont « étiquetés » avec _tag(objet, kind, libellé).
 * Rappels : onHover(label | null, x, y), onTap(kind).
 */
export class Spring {
  constructor(v = 0, k = 90, damp = 1) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.c = 2 * Math.sqrt(k) * damp }
  step(dt) { const a = this.k * (this.t - this.v) - this.c * this.vel; this.vel += a * dt; this.v += this.vel * dt }
  get done() { return Math.abs(this.t - this.v) < 1e-4 && Math.abs(this.vel) < 1e-3 }
  snap(v) { this.v = this.t = v; this.vel = 0 }
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function canvasTex(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}
let seed = 7
export const reseed = s => { seed = s }
export const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

export function woodTexture(base, { lines = 70, dark = 'rgba(90,55,25,' } = {}) {
  seed = 9
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h)
    for (let i = 0; i < lines; i++) {
      g.strokeStyle = `${dark}${0.04 + rand() * 0.07})`; g.lineWidth = 1 + rand() * 2
      const y = rand() * h; g.beginPath(); g.moveTo(0, y)
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 3)
      g.stroke()
    }
  }, { repeat: true })
}
/** Un parquet en lames décalées. */
export function parquetTexture(base) {
  seed = 11
  return canvasTex(512, 512, (g, w, h) => {
    const bw = 64
    for (let x = 0; x < w; x += bw) {
      let y = -rand() * 200
      while (y < h) {
        const len = 160 + rand() * 180
        const c = new THREE.Color(base).multiplyScalar(0.9 + rand() * 0.18)
        g.fillStyle = '#' + c.getHexString(); g.fillRect(x, y, bw, len)
        g.fillStyle = 'rgba(80, 50, 20, 0.07)'
        for (let k = 0; k < 6; k++) g.fillRect(x + 4 + rand() * (bw - 8), y, 1.2, len)
        g.fillStyle = 'rgba(60, 35, 15, 0.3)'; g.fillRect(x, y, bw, 2)
        y += len
      }
      g.fillStyle = 'rgba(60, 35, 15, 0.35)'; g.fillRect(x, 0, 2, h)
    }
  }, { repeat: true })
}

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export default class RoomScene {
  /**
   * opts : { R, H, az0, el0, floor (texture), floorRepeat, wall, side, base }
   */
  constructor(container, cb = {}, opts = {}) {
    this.cb = cb
    this.o = { R: 2.3, H: 2.7, T: 0.12, FT: 0.2, az0: 0.5, el0: 0.52, fov: 30, wall: '#EEE7DC', side: '#E7DECF', slab: '#CDBB9F', ...opts }
    this.container = container
    this.mobile = matchMedia('(max-width: 767px)').matches
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    r.setPixelRatio(this.dpr)
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.05
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    r.domElement.className = 'kitchen-canvas'
    container.appendChild(r.domElement)
    noTouchSelect(r.domElement)

    this.scene = new THREE.Scene()
    const pm = new THREE.PMREMGenerator(r)
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    pm.dispose()
    this.scene.environment = this.env
    this.scene.environmentIntensity = 0.55
    this.camera = new THREE.PerspectiveCamera(this.o.fov, 1, 0.05, 80)
    this.target = new THREE.Vector3(0, 0.85, 0)
    this.hits = []
    this.labels = {}
    this.disposables = []
    this.az = new Spring(this.o.az0, 40, 1)
    this.el = new Spring(this.o.el0, 40, 1)
    this.dist = 12
    this.cSpin = 0

    this._lights()
    this._shell()
    this._furnish()
    this._bind()
    this.resize()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.renderer.shadowMap.needsUpdate = true
    this.kick()
  }

  // ---- Petits outils ------------------------------------------------------------------------------
  _mat(o) { const m = new THREE.MeshStandardMaterial(o); this.disposables.push(m); return m }
  _box(w, h, d, mat, r = 0, seg = 3) {
    const geo = r ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d)
    this.disposables.push(geo)
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = true; m.receiveShadow = true
    return m
  }
  _cyl(rt, rb, h, mat, seg = 20) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m }
  _tex(t) { this.disposables.push(t); return t }
  _tag(obj, kind, label) { this.labels[kind] = label; obj.traverse(o => { if (o.isMesh) { o.userData.kind = kind; this.hits.push(o) } }) }
  _furnish() {}

  // ---- La lumière et la pièce -----------------------------------------------------------------------
  _lights() {
    const S = this.scene
    S.add(new THREE.HemisphereLight('#FFF7EC', '#B9A28A', 1.15))
    const sun = new THREE.DirectionalLight('#FFF1DC', 1.9)
    sun.position.set(-2.4, 6.4, 4.4); sun.target.position.set(0, 0.4, 0)
    sun.castShadow = true
    sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048)
    Object.assign(sun.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 16 })
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025; sun.shadow.radius = 4
    const fill = new THREE.DirectionalLight('#E8EEFF', 0.35); fill.position.set(5, 2.5, 3)
    S.add(sun, sun.target, fill)
  }
  _shell() {
    const S = this.scene
    const { R, H, T, FT } = this.o
    const slab = this._box(2 * R + 2 * T, FT, 2 * R + 2 * T, this._mat({ map: this._tex(woodTexture(this.o.slab)), roughness: 0.75 }), 0.03, 3)
    slab.position.set(0, -FT / 2, 0); slab.castShadow = false; S.add(slab)
    const ft = this.o.floor ? this._tex(this.o.floor()) : null
    if (ft) ft.repeat.set(this.o.floorRepeat || 2.3, this.o.floorRepeat || 2.3)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), this._mat({ map: ft, color: ft ? '#ffffff' : this.o.floorColor || '#BBB2A6', roughness: this.o.floorRough ?? 0.8 }))
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; floor.receiveShadow = true; S.add(floor)
    this.floor = floor
    const cs = this._tex(canvasTex(256, 256, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w / 2)
      gr.addColorStop(0, 'rgba(40,30,20,0.38)'); gr.addColorStop(1, 'rgba(40,30,20,0)')
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
    }))
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), new THREE.MeshBasicMaterial({ map: cs, transparent: true, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -FT - 0.05; S.add(shadow)
    this.disposables.push(shadow.material)

    this.walls = []
    const wallMat = this._mat({ color: this.o.wall, roughness: 0.95 })
    const sideMat = this._mat({ color: this.o.side, roughness: 0.95 })
    const baseMat = this._mat({ color: this.o.base || '#F4EFE6', roughness: 0.7 })
    const capMat = this._mat({ color: '#F7F2EA', roughness: 0.8 })
    const L = 2 * R + 2 * T
    const wall = (name, n, mat, along) => {
      const grp = new THREE.Group(); S.add(grp)
      const decor = new THREE.Group(); S.add(decor)
      const x = n.x * (R + T / 2), z = n.z * (R + T / 2)
      const m = this._box(along === 'x' ? L : T, H, along === 'x' ? T : L, mat, 0.02, 2); m.position.set(x, H / 2, z); m.castShadow = false
      const b = this._box(along === 'x' ? 2 * R : 0.025, 0.09, along === 'x' ? 0.025 : 2 * R, baseMat, 0.006, 2)
      b.position.set(n.x * (R - 0.0125), 0.045, n.z * (R - 0.0125)); b.castShadow = false
      const c = this._box(along === 'x' ? L + 0.02 : T + 0.04, 0.05, along === 'x' ? T + 0.04 : L + 0.02, capMat, 0.015, 2); c.position.set(x, H + 0.02, z)
      grp.add(m, b, c)
      const w = { name, n, grp, decor, cut: new Spring(1, 70, 1) }
      this.walls.push(w)
      return w
    }
    this.backWall = wall('back', new THREE.Vector3(0, 0, -1), wallMat, 'x')
    this.frontWall = wall('front', new THREE.Vector3(0, 0, 1), wallMat, 'x')
    this.leftWall = wall('left', new THREE.Vector3(-1, 0, 0), sideMat, 'z')
    this.rightWall = wall('right', new THREE.Vector3(1, 0, 0), sideMat, 'z')
  }

  // ---- Caméra -------------------------------------------------------------------------------------------
  _orbit(az = this.az.v, el = this.el.v, d = this.dist) {
    const t = this.target
    return { pos: new THREE.Vector3(t.x + Math.sin(az) * Math.cos(el) * d, t.y + Math.sin(el) * d, t.z + Math.cos(az) * Math.cos(el) * d), target: t.clone() }
  }
  _fitDistance() {
    const { R, T, FT, H } = this.o
    const pts = []
    for (const x of [-R - T, R + T]) for (const y of [-FT, H + 0.05]) for (const z of [-R - T, R + T]) pts.push(new THREE.Vector3(x, y, z))
    const m = this.mobile ? { top: 0.1, bottom: 0.13, side: 0.03 } : { top: 0.1, bottom: 0.16, side: 0.05 }
    const cam = new THREE.PerspectiveCamera(this.o.fov, this.w / Math.max(1, this.h), 0.05, 80)
    const fits = d => {
      for (const az of [-1.05, -0.5, 0, this.o.az0, 1.05]) {
        const f = this._orbit(az, this.o.el0, d)
        cam.position.copy(f.pos); cam.lookAt(f.target); cam.updateMatrixWorld()
        for (const p of pts) {
          const v = p.clone().project(cam)
          if (Math.abs(v.x) > 1 - m.side * 2 || v.y > 1 - m.top * 2 || v.y < -1 + m.bottom * 2) return false
        }
      }
      return true
    }
    let lo = 3, hi = 60
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid }
    return hi
  }
  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1
    if (w === this.w && h === this.h) return
    this.w = w; this.h = h
    this.mobile = matchMedia('(max-width: 767px)').matches
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.dist = this._fitDistance()
    this.kick()
  }

  /** Le carrousel des pièces : une pose imposée ({ az, el, scale, ox, oy, spin }), ou null pour reprendre la main. */
  setCarousel(p) {
    if (!p) {
      if (this.carousel) {
        this.carousel = null
        this.camera.far = 80
        this.camera.clearViewOffset()
        this.az.snap(this.o.az0); this.el.snap(this.o.el0)
        this.renderer.setPixelRatio(this.dpr)
        this.w = 0; this.resize()
      }
      this.kick()
      return
    }
    if (!this.carousel) {
      this._setHover(null)
      this.renderer.setPixelRatio(1)
      this.camera.far = 600
      this.w = 0; this.resize()
    }
    if (!p.spin) this.cSpin = 0
    this.carousel = p
    this.kick()
  }
  currentAz() { return this.az.v }
  carouselSpin() { return this.cSpin }

  // ---- Toucher, survoler, tourner -----------------------------------------------------------------
  _pick(cx, cy) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1)
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera)
    return ray.intersectObjects(this.hits, false).find(h => h.object.visible)?.object.userData.kind || null
  }
  _setHover(kind, x, y) {
    if (kind === this.hover && kind == null) return
    this.hover = kind
    this.renderer.domElement.style.cursor = kind ? 'pointer' : 'grab'
    this.cb.onHover?.(kind ? this.labels[kind] : null, x, y)
  }
  _bind() {
    const el = this.renderer.domElement
    this.onDown = e => {
      if (e.button > 0 || this.carousel) return
      this.press = { x: e.clientX, y: e.clientY, az: this.az.t, el: this.el.t, moved: false }
      el.setPointerCapture?.(e.pointerId)
    }
    this.onMove = e => {
      if (this.carousel) return
      const p = this.press
      if (!p) { if (e.pointerType === 'mouse') { const k = this._pick(e.clientX, e.clientY); if (k !== this.hover || k) this._setHover(k, e.clientX, e.clientY) } return }
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      if (!p.moved && Math.hypot(dx, dy) > 8) { p.moved = true; this._setHover(null); el.style.cursor = 'grabbing' }
      if (p.moved) {
        const k = 5.2 / Math.max(320, this.w)
        const rub = (v, lo, hi) => (v < lo ? lo + (v - lo) * 0.3 : v > hi ? hi + (v - hi) * 0.3 : v)
        this.az.t = rub(p.az - dx * k, -1.05, 1.05)
        this.el.t = rub(p.el + dy * k * 0.6, 0.32, 0.92)
        this.kick()
      }
    }
    this.onUp = e => {
      const p = this.press
      this.press = null
      if (!p) return
      this.az.t = clamp(this.az.t, -1.05, 1.05); this.el.t = clamp(this.el.t, 0.32, 0.92); this.kick()
      if (p.moved) { el.style.cursor = 'grab'; return }
      const k = this._pick(e.clientX, e.clientY)
      if (k) this.cb.onTap?.(k)
    }
    this.onLeave = () => { if (!this.press) this._setHover(null) }
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointerleave', this.onLeave)
  }

  // ---- Animation ----------------------------------------------------------------------------------------
  /** Ce que la pièce anime elle-même à chaque image (rend vrai si ça bouge encore). */
  _animate() { return false }
  kick() { if (!this.raf && !this.dead) { this.last = performance.now(); this.raf = requestAnimationFrame(this._loop) } }
  _loop = now => {
    this.raf = 0
    const dt = Math.min(0.25, (now - this.last) / 1000); this.last = now
    const sub = Math.max(1, Math.ceil(dt * 60))
    let busy = false
    const cam = this.camera
    if (this.carousel) {
      const p = this.carousel
      if (p.spin) { this.cSpin += p.spin * dt; busy = true }
      const f = this._orbit(p.az + this.cSpin, p.el, this.dist / p.scale)
      cam.position.copy(f.pos); cam.lookAt(f.target)
      cam.setViewOffset(this.w, this.h, -p.ox, -p.oy, this.w, this.h)
    } else {
      if (!this.az.done || !this.el.done) { for (let i = 0; i < sub; i++) { this.az.step(dt / sub); this.el.step(dt / sub) } busy = true }
      const f = this._orbit(); cam.position.copy(f.pos); cam.lookAt(f.target)
    }
    // les murs : celui qui est entre la caméra et la pièce s'abaisse, les autres se relèvent
    const cp = cam.position, len = Math.hypot(cp.x, cp.z) || 1
    for (const w of this.walls) {
      w.cut.t = (w.n.x * cp.x + w.n.z * cp.z) / len > 0.2 ? 0.07 : 1
      if (!this.wallsReady) w.cut.snap(w.cut.t)
      if (!w.cut.done || !this.wallsReady) {
        for (let i = 0; i < sub; i++) w.cut.step(dt / sub)
        w.grp.scale.y = Math.max(0.05, w.cut.v)
        w.decor.visible = w.cut.v > 0.6
        this.renderer.shadowMap.needsUpdate = true
        busy = true
      }
    }
    this.wallsReady = true
    if (this._animate(dt)) busy = true
    // au fond du carrousel, une image sur deux suffit (la pièce tourne lentement)
    this.odd = !this.odd
    if (!(this.carousel?.spin && this.odd)) this.renderer.render(this.scene, cam)
    if (busy || this.press) this.kick()
  }

  dispose() {
    this.dead = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointerleave', this.onLeave)
    this.scene.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => { x?.map?.dispose(); x?.dispose() }) } })
    this.disposables.forEach(d => d.dispose?.())
    this.env.dispose()
    this.renderer.dispose()
    el.remove()
  }
}
export { ease }
