import * as THREE from 'three'
import { hashString } from '../lib/bookUtils'
import { spineTexture, withCover, pagesTexture } from './textures'

/*
 * Panier en osier en vraie 3D : corbeille ovale tressée, bord en tresse, anse,
 * livres debout dedans (vrais volumes avec leur couverture), un peu de travers.
 * Un livre ajouté tombe dans le panier, qui se balance ; au survol un livre sort un peu.
 * Rendu seulement quand quelque chose bouge.
 */

const SX = 1.25, SZ = 0.82   // ovale
const BH = 0.82              // hauteur de la corbeille
const R_TOP = 1.0, R_BOT = 0.8
const BOOK_W = 0.8, BOOK_H = 1.5

class Spring {
  constructor(v = 0, k = 140, damp = 0.62) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.c = 2 * Math.sqrt(k) * damp }
  step(dt) { const a = this.k * (this.t - this.v) - this.c * this.vel; this.vel += a * dt; this.v += this.vel * dt }
  get done() { return Math.abs(this.t - this.v) < 1e-4 && Math.abs(this.vel) < 1e-3 }
  snap(v) { this.v = this.t = v; this.vel = 0 }
}

let weaveTex = null, ropeTex = null
function weaveTexture() {
  if (weaveTex) return weaveTex
  const c = document.createElement('canvas'); c.width = 256; c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#B98345'; g.fillRect(0, 0, 256, 128)
  const rowH = 16, cell = 32
  for (let r = 0; r < 128 / rowH; r++) {
    for (let k = -1; k < 256 / cell + 1; k++) {
      const x = k * cell + (r % 2 ? cell / 2 : 0), y = r * rowH
      const grad = g.createLinearGradient(0, y, 0, y + rowH)
      grad.addColorStop(0, '#E6BC7C'); grad.addColorStop(0.45, '#D9A866'); grad.addColorStop(1, '#9E6C35')
      g.fillStyle = grad
      g.beginPath()
      g.ellipse(x + cell / 2, y + rowH / 2, cell / 2 + 1, rowH / 2 - 1, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.fillStyle = 'rgba(70, 40, 15, 0.45)'
  for (let x = 0; x < 256; x += cell / 2) g.fillRect(x, 0, 2, 128)
  weaveTex = new THREE.CanvasTexture(c)
  weaveTex.colorSpace = THREE.SRGBColorSpace
  weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping
  weaveTex.repeat.set(7, 3.2)
  return weaveTex
}
function ropeTexture() {
  if (ropeTex) return ropeTex
  const c = document.createElement('canvas'); c.width = 128; c.height = 32
  const g = c.getContext('2d')
  g.fillStyle = '#B57A3D'; g.fillRect(0, 0, 128, 32)
  for (let x = -32; x < 160; x += 12) {
    const grad = g.createLinearGradient(x, 0, x + 12, 32)
    grad.addColorStop(0, '#E2B272'); grad.addColorStop(1, '#8A5E31')
    g.fillStyle = grad
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 0); g.lineTo(x + 20, 32); g.lineTo(x + 12, 32); g.closePath(); g.fill()
  }
  ropeTex = new THREE.CanvasTexture(c)
  ropeTex.colorSpace = THREE.SRGBColorSpace
  ropeTex.wrapS = ropeTex.wrapT = THREE.RepeatWrapping
  ropeTex.repeat.set(30, 1)
  return ropeTex
}

const toBook = it => ({
  id: `basket:${it.googleId}`, google_id: it.googleId, title: it.title, authors: it.authors,
  cover: it.cover, isbn: it.isbn, page_count: it.pageCount,
})

export class BasketScene {
  constructor(container, cb) {
    this.cb = cb
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'basket-canvas'
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0xa08a68, 1.4))
    const key = new THREE.DirectionalLight(0xfff1dc, 1.6)
    key.position.set(-1.2, 7, 2.2)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: 0.5, far: 20 })
    key.shadow.radius = 6
    key.shadow.bias = -0.0005
    this.scene.add(key)

    this.root = new THREE.Group()        // se balance quand un livre tombe dedans
    this.scene.add(this.root)
    this.wobble = new Spring(0, 90, 0.35)
    this._buildBasket()

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.16 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    this.pagesMat = new THREE.MeshStandardMaterial({ map: pagesTexture(), roughness: 0.95 })
    this.books = new Map()
    this.raycaster = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()
    this.hoverId = null
    this.hiddenId = null

    const el = this.renderer.domElement
    this.onMove = e => { this._pointer(e); this._hover(); this.kick() }
    this.onLeave = () => { this.ndcValid = false; this._setHover(null); this.kick() }
    this.onDown = e => {
      this._pointer(e)
      const id = this._pick()
      if (!id) return
      const it = this.books.get(id)
      cb.onBookDown?.(e, it.item, this.screenRect(it))
    }
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerleave', this.onLeave)
    el.addEventListener('pointerdown', this.onDown)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
  }

  _buildBasket() {
    const g = new THREE.Group()
    g.scale.set(SX, 1, SZ)
    const prof = []
    for (let i = 0; i <= 12; i++) {
      const t = i / 12
      prof.push(new THREE.Vector2(R_BOT + (R_TOP - R_BOT) * Math.pow(t, 0.85) + Math.sin(t * Math.PI) * 0.04, t * BH))
    }
    const outer = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), new THREE.MeshStandardMaterial({ map: weaveTexture(), bumpMap: weaveTexture(), bumpScale: 2.2, roughness: 0.85 }))
    outer.castShadow = true
    const innerMat = new THREE.MeshStandardMaterial({ map: weaveTexture(), color: 0x6f4a26, roughness: 0.95, side: THREE.BackSide })
    const inner = new THREE.Mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p.x * 0.96, p.y)), 72), innerMat)
    inner.receiveShadow = true
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(R_BOT * 0.96, 48), new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 1 }))
    bottom.rotation.x = -Math.PI / 2
    bottom.position.y = 0.03
    bottom.receiveShadow = true
    const ropeMat = new THREE.MeshStandardMaterial({ map: ropeTexture(), bumpMap: ropeTexture(), bumpScale: 1.5, roughness: 0.8 })
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R_TOP + 0.02, 0.075, 14, 96), ropeMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = BH
    rim.castShadow = true
    const foot = new THREE.Mesh(new THREE.TorusGeometry(R_BOT + 0.01, 0.05, 10, 80), ropeMat)
    foot.rotation.x = Math.PI / 2
    foot.position.y = 0.04
    g.add(outer, inner, bottom, rim, foot)
    this.root.add(g)

    // anse (hors du groupe ovale pour garder une section ronde)
    const pts = []
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI * (i / 24)
      pts.push(new THREE.Vector3(Math.cos(a) * (R_TOP * SX - 0.02), BH + Math.sin(a) * 1.15, 0))
    }
    const handleMat = ropeMat.clone()
    handleMat.map = ropeTexture().clone(); handleMat.map.repeat.set(16, 1); handleMat.map.needsUpdate = true
    const handle = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.07, 12), handleMat)
    handle.castShadow = true
    this.root.add(handle)
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    if (!w || !h) return
    this.w = w; this.h = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // vue de trois quarts, légèrement d'en haut, cadrée sur le panier et son anse
    const target = new THREE.Vector3(0, 0.95, 0)
    const dir = new THREE.Vector3(Math.sin(0.42), 0.42, Math.cos(0.42)).normalize()
    const pts = []
    for (const x of [-SX * 1.08, SX * 1.08]) for (const y of [0, BH + 1.25]) for (const z of [-SZ, SZ]) pts.push(new THREE.Vector3(x, y, z))
    let lo = 1, hi = 40
    for (let i = 0; i < 28; i++) {
      const d = (lo + hi) / 2
      this.camera.position.copy(target).addScaledVector(dir, d)
      this.camera.lookAt(target)
      this.camera.updateMatrixWorld(); this.camera.updateProjectionMatrix()
      const ok = pts.every(p => { const q = p.clone().project(this.camera); return Math.abs(q.x) < 0.94 && Math.abs(q.y) < 0.92 })
      if (ok) hi = d; else lo = d
    }
    this.camera.position.copy(target).addScaledVector(dir, hi)
    this.camera.lookAt(target)
    this.camera.updateMatrixWorld(); this.camera.updateProjectionMatrix()
    this._emitAnchors()
    this.kick()
  }

  /** Livres du panier : on ajoute (ils tombent dedans), on retire, on range. */
  setItems(items) {
    const keep = new Set(items.map(it => it.googleId))
    for (const [id, b] of [...this.books]) if (!keep.has(id)) this._dispose(b)
    let added = false
    items.forEach(it => {
      if (this.books.has(it.googleId)) { this.books.get(it.googleId).item = it; return }
      this._makeBook(it)
      added = true
    })
    this._layout()
    this.ready = true
    this.kick()
  }

  setHidden(googleId) {
    this.hiddenId = googleId
    for (const b of this.books.values()) b.wrap.visible = !b.waiting && b.item.googleId !== googleId
    this.kick()
  }

  _makeBook(item) {
    const book = toBook(item)
    const h = hashString(item.googleId)
    const t = 0.13 + ((h >> 3) % 6) * 0.012
    const cover = new THREE.MeshStandardMaterial({ roughness: 0.55 })
    const back = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.7 })
    const spine = new THREE.MeshStandardMaterial({ map: spineTexture(book), roughness: 0.6 })
    // faces : +x tranche, -x dos, +y/-y tête/pied, +z couverture, -z 4e de couverture
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(BOOK_W, BOOK_H, t), [this.pagesMat, spine, this.pagesMat, this.pagesMat, cover, back])
    mesh.castShadow = mesh.receiveShadow = true
    mesh.userData.id = item.googleId
    const wrap = new THREE.Group()
    wrap.add(mesh)
    this.root.add(wrap)
    const b = {
      item, mesh, wrap, mats: [cover, back, spine], t,
      x: new Spring(0, 160, 0.75), y: new Spring(0, 150, 0.82), z: new Spring(0, 160, 0.75),
      rz: new Spring(0, 140, 0.6), ry: new Spring(0, 140, 0.7), fresh: true,
    }
    this.books.set(item.googleId, b)
    // Le livre n'apparaît qu'avec sa vraie couverture, puis tombe dans le panier
    b.waiting = true
    b.dropOnReveal = !!this.ready
    wrap.visible = false
    withCover(book, tex => {
      cover.map = tex; cover.needsUpdate = true
      if (!b.waiting) return
      b.waiting = false
      wrap.visible = b.item.googleId !== this.hiddenId
      if (b.dropOnReveal && b.base) {
        b.y.snap(b.base.y + 2.2)
        b.rz.snap(b.base.rz * -2.5)
        this._target(b)
        setTimeout(() => { this.wobble.vel += 0.9; this.kick() }, 280)
      }
      this.kick()
    }, tex => { cover.map = tex; cover.needsUpdate = true; this.kick() })
    return b
  }

  _dispose(b) {
    this.root.remove(b.wrap)
    b.mesh.geometry.dispose()
    b.mats.forEach(m => m.dispose())
    this.books.delete(b.item.googleId)
  }

  /** Disposition : un ou deux rangs de livres debout, couverture vers nous, un peu de travers. */
  _layout() {
    const list = [...this.books.values()]
    const n = list.length
    const rows = n > 5 ? [list.slice(0, Math.ceil(n / 2)), list.slice(Math.ceil(n / 2))] : [[], list]
    rows.forEach((row, ri) => {
      const k = row.length
      if (!k) return
      const back = ri === 0
      const span = Math.min(1.5, 0.42 * (k - 1))
      row.forEach((b, i) => {
        const h = hashString(b.item.googleId)
        const x = k > 1 ? -span / 2 + (span * i) / (k - 1) : 0
        b.base = {
          x: x + (((h >> 2) % 7) - 3) * 0.015,
          y: BOOK_H / 2 + 0.04 + (back ? 0.2 : 0) + ((h >> 6) % 5) * 0.012,
          z: back ? -0.22 : 0.2,
          rz: ((h % 15) - 7) * 0.028 + x * -0.12,
          ry: (((h >> 4) % 9) - 4) * 0.05,
        }
        if (b.fresh) {
          b.x.snap(b.base.x); b.z.snap(b.base.z); b.ry.snap(b.base.ry)
          b.y.snap(this.ready ? b.base.y + 2.2 : b.base.y)
          b.rz.snap(this.ready ? b.base.rz * -2.5 : b.base.rz)
          // couverture déjà prête : il tombe tout de suite, et le panier se balance à l'arrivée
          if (this.ready && !b.waiting) setTimeout(() => { this.wobble.vel += 0.9; this.kick() }, 280)
          b.fresh = false
        }
        this._target(b)
      })
    })
  }

  _target(b) {
    const hov = b.item.googleId === this.hoverId
    b.x.t = b.base.x
    b.y.t = b.base.y + (hov ? 0.32 : 0)
    b.z.t = b.base.z + (hov ? 0.15 : 0)
    b.rz.t = hov ? 0 : b.base.rz
    b.ry.t = hov ? 0 : b.base.ry
  }

  _pointer(e) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    this.ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1)
    this.ndcValid = true
  }

  _pick() {
    if (!this.ndcValid) return null
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const meshes = [...this.books.values()].filter(b => b.wrap.visible && !b.waiting).map(b => b.mesh)
    const hit = this.raycaster.intersectObjects(meshes, false)[0]
    return hit ? hit.object.userData.id : null
  }

  _hover() { this._setHover(this._pick()) }

  _setHover(id) {
    if (id === this.hoverId) return
    this.hoverId = id
    this.container.style.cursor = id ? 'grab' : ''
    for (const b of this.books.values()) if (b.base) this._target(b)
    const b = id && this.books.get(id)
    this.cb.onHover?.(b ? b.item : null)
  }

  screenRect(b) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    const box = new THREE.Box3().setFromObject(b.mesh)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    const v = new THREE.Vector3()
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).project(this.camera)
      const sx = rc.left + (v.x + 1) / 2 * rc.width, sy = rc.top + (1 - v.y) / 2 * rc.height
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
    }
    return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 }
  }

  /** Points d'accroche des éléments HTML : l'étiquette sur le devant, l'ouverture (cible des envols). */
  _emitAnchors() {
    const p = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(this.camera); return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h } }
    this.cb.onAnchors?.({ tag: p(0.15, BH * 0.42, SZ * 0.95), mouth: p(0, BH + 0.1, 0) })
  }

  kick() {
    if (this.running || this.disposed) return
    this.running = true
    this.last = performance.now()
    requestAnimationFrame(this._frame)
  }

  _frame = now => {
    if (this.disposed) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    let moving = false
    const sub = 4, h = dt / sub
    for (const b of this.books.values()) {
      if (b.waiting) continue
      for (let i = 0; i < sub; i++) { b.x.step(h); b.y.step(h); b.z.step(h); b.rz.step(h); b.ry.step(h) }
      b.wrap.position.set(b.x.v, b.y.v, b.z.v)
      b.wrap.rotation.set(0, b.ry.v, b.rz.v)
      if (!(b.x.done && b.y.done && b.z.done && b.rz.done && b.ry.done)) moving = true
    }
    for (let i = 0; i < sub; i++) this.wobble.step(h)
    this.root.rotation.z = this.wobble.v * 0.06
    this.root.position.y = Math.abs(this.wobble.v) * -0.02
    if (!this.wobble.done) moving = true
    this.renderer.render(this.scene, this.camera)
    if (moving) requestAnimationFrame(this._frame)
    else this.running = false
  }

  dispose() {
    this.disposed = true
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.onMove)
    el.removeEventListener('pointerleave', this.onLeave)
    el.removeEventListener('pointerdown', this.onDown)
    for (const b of [...this.books.values()]) this._dispose(b)
    this.renderer.dispose()
    el.remove()
  }
}
