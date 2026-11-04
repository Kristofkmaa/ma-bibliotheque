import * as THREE from 'three'
import { hashString } from '../lib/bookUtils'
import { spineTexture, withCover, pagesTexture } from './textures'
import { basketScale } from '../lib/basketSize'

/*
 * Panier en osier en vraie 3D : corbeille ovale tressée, bord en tresse, anse,
 * livres debout dedans (vrais volumes avec leur couverture), un peu de travers.
 * Un livre ajouté tombe dans le panier, qui se balance ; au survol un livre sort un peu.
 * Rendu seulement quand quelque chose bouge.
 */

const SX = 1.25, SZ = 0.82   // ovale
const BH = 0.82              // hauteur de la corbeille
const R_TOP = 1.0, R_BOT = 0.8
const BOOK_W = 0.92, BOOK_H = 1.42   // proportions d'une couverture (≈ 2/3)
const CAM_AZ = 0.42, CAM_TILT = 0.42  // vue de trois quarts, un peu d'en haut


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
    this.baseWidth = cb.baseWidth || 360
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'basket-canvas'
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)
    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0xa08a68, 1.4))
    const key = new THREE.DirectionalLight(0xfff1dc, 1.6)
    key.position.set(-1.2, 7, 2.2)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -3, near: 0.5, far: 20 })
    key.shadow.radius = 6
    key.shadow.bias = -0.0005
    this.scene.add(key)

    this.root = new THREE.Group()        // se balance quand un livre tombe dedans
    this.scene.add(this.root)
    this.wobble = new Spring(0, 90, 0.35)
    this.k = new Spring(1, 55, 0.95)     // largeur du panier (grandit avec le contenu)
    this._buildBasket()
    this._applyScale()

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.16 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    this.pagesMat = new THREE.MeshStandardMaterial({ map: pagesTexture(), roughness: 0.95 })
    this.books = new Map()
    this.expected = new Set()             // livres en vol vers le panier (révélés à l'arrivée)
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

    this._sizeContainer()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
  }

  // ---- Panier ----------------------------------------------------------------------------
  _buildBasket() {
    const g = new THREE.Group()
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
    this.body = g
    this.root.add(g)

    const pts = []
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI * (i / 24)
      pts.push(new THREE.Vector3(Math.cos(a) * (R_TOP * SX - 0.02), BH + Math.sin(a) * 1.15, 0))
    }
    const handleMat = ropeMat.clone()
    handleMat.map = ropeTexture().clone(); handleMat.map.repeat.set(16, 1); handleMat.map.needsUpdate = true
    const handle = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.07, 12), handleMat)
    handle.castShadow = true
    this.handle = handle
    this.root.add(handle)
  }

  /** L'ovale s'élargit (et s'approfondit un peu) avec k ; la hauteur ne change pas. */
  _applyScale() {
    const k = this.k.v
    this.body.scale.set(SX * k, 1, SZ * (1 + (k - 1) * 0.6))
    this.handle.scale.set(k, 1, 1)
  }

  /** Largeur du cadre : le panier grandit à l'écran, les livres gardent leur taille. */
  _sizeContainer() {
    const w = Math.round(this.baseWidth * (1 + Math.min(0.62, (this.k.v - 1) * 0.85)))
    if (w !== this._lastW) { this._lastW = w; this.container.style.width = `${w}px` }
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    if (!w || !h) return
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.renderer.setSize(w, h, false) }
    this.camera.aspect = w / h
    this._fit()
    this._emitAnchors()
    this.kick()
  }

  /** Cadre la caméra sur le panier (largeur actuelle) et son anse. */
  _fit() {
    const k = this.k.v, kz = 1 + (k - 1) * 0.6
    const target = new THREE.Vector3(0, 0.95, 0)
    const dir = new THREE.Vector3(Math.sin(CAM_AZ), CAM_TILT, Math.cos(CAM_AZ)).normalize()
    const pts = []
    for (const x of [-SX * 1.08 * k, SX * 1.08 * k]) for (const y of [0, BH + 1.25]) for (const z of [-SZ * kz, SZ * kz]) pts.push(new THREE.Vector3(x, y, z))
    let lo = 1, hi = 60
    for (let i = 0; i < 26; i++) {
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
  }

  // ---- Livres ------------------------------------------------------------------------------
  /** Livres du panier : on ajoute, on retire, on range. Le panier grandit avec le contenu. */
  setItems(items) {
    const keep = new Set(items.map(it => it.googleId))
    for (const [id, b] of [...this.books]) if (!keep.has(id)) this._dispose(b)
    items.forEach(it => {
      if (this.books.has(it.googleId)) { this.books.get(it.googleId).item = it; return }
      this._makeBook(it)
    })
    this._layout()   // fixe aussi la largeur du panier (k) pour que tout tienne
    if (!this.ready) { this.k.snap(this.k.t); this._applyScale(); this._sizeContainer() }
    this.ready = true
    this.kick()
  }

  setHidden(googleId) {
    this.hiddenId = googleId
    for (const b of this.books.values()) b.wrap.visible = !b.waiting && !b.incoming && b.item.googleId !== googleId
    this.kick()
  }

  /** Un livre va arriver en volant : il sera créé caché et révélé à l'arrivée (reveal). */
  expect(googleId) { this.expected.add(googleId) }

  _makeBook(item) {
    const book = toBook(item)
    const h = hashString(item.googleId)
    const t = 0.11 + ((h >> 3) % 5) * 0.008
    const cover = new THREE.MeshStandardMaterial({ roughness: 0.55 })
    const back = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.7 })
    const spine = new THREE.MeshStandardMaterial({ map: spineTexture(book), roughness: 0.6 })
    // faces : +x tranche, -x dos, +y/-y tête/pied, +z couverture, -z 4e de couverture
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(BOOK_W, BOOK_H, t), [this.pagesMat, spine, this.pagesMat, this.pagesMat, cover, back])
    mesh.castShadow = mesh.receiveShadow = true
    mesh.userData.id = item.googleId
    const wrap = new THREE.Group()
    wrap.rotation.order = 'YXZ'
    wrap.add(mesh)
    this.root.add(wrap)
    const b = {
      item, mesh, wrap, mats: [cover, back, spine], t,
      x: new Spring(0, 150, 0.8), y: new Spring(0, 150, 0.82), z: new Spring(0, 150, 0.8),
      rx: new Spring(0, 260, 0.9), ry: new Spring(0, 320, 0.9), rz: new Spring(0, 200, 0.85), fresh: true,
    }
    this.books.set(item.googleId, b)
    b.incoming = this.expected.delete(item.googleId)
    b.waiting = true
    wrap.visible = false
    b.coverReady = new Promise(res => { b._coverDone = res })
    withCover(book, tex => {
      cover.map = tex; cover.needsUpdate = true
      b._coverDone()
      if (!b.waiting || b.incoming) { this.kick(); return }
      this._show(b, !!this.ready)
    }, tex => { cover.map = tex; cover.needsUpdate = true; this.kick() })
    if (b.incoming) setTimeout(() => this.reveal(item.googleId), 5000) // filet de sécurité
    return b
  }

  _dispose(b) {
    this.root.remove(b.wrap)
    b.mesh.geometry.dispose()
    b.mats.forEach(m => m.dispose())
    this.books.delete(b.item.googleId)
  }

  /** Pose de départ d'une chute : au-dessus du panier, couverture face à nous (comme une image). */
  _startPose(b) {
    const el = Math.atan2(CAM_TILT, 1)
    // juste au-dessus de sa place : il tombera tout droit dans sa tranche
    return { x: b.base.x, y: BH + BOOK_H / 2 + 0.55, z: b.base.z, rx: -el, ry: CAM_AZ, rz: 0 }
  }

  /** Fait apparaître un livre ; s'il doit tomber, il part de la pose de départ. */
  _show(b, drop) {
    b.waiting = false
    b.incoming = false
    b.wrap.visible = b.item.googleId !== this.hiddenId
    if (drop && b.base) {
      const s = this._startPose(b)
      b.x.snap(s.x); b.y.snap(s.y); b.z.snap(s.z); b.rx.snap(s.rx); b.ry.snap(s.ry); b.rz.snap(s.rz)
      this._target(b)
      setTimeout(() => { this.wobble.vel += 0.8; this.kick() }, 300)
    }
    this.kick()
  }

  /** Le livre volant arrive : le livre 3D prend sa place exacte et tombe dans le panier. */
  reveal(googleId) {
    const b = this.books.get(googleId)
    if (b && (b.incoming || b.waiting)) this._show(b, true)
  }

  ready_(googleId) { return this.books.get(googleId)?.coverReady || Promise.resolve() }

  /** Rectangle écran de la couverture dans la pose de départ (cible du livre volant). */
  startRect(googleId) {
    const b = this.books.get(googleId)
    if (!b || !b.base || !this.w) return null
    const s = this._startPose(b)
    this.root.updateMatrixWorld()
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(s.x, s.y, s.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(s.rx, s.ry, s.rz, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    ).premultiply(this.root.matrixWorld)
    const rc = this.renderer.domElement.getBoundingClientRect()
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    const v = new THREE.Vector3()
    for (const x of [-BOOK_W / 2, BOOK_W / 2]) for (const y of [-BOOK_H / 2, BOOK_H / 2]) {
      v.set(x, y, b.t / 2).applyMatrix4(m).project(this.camera)
      const sx = rc.left + (v.x + 1) / 2 * rc.width, sy = rc.top + (1 - v.y) / 2 * rc.height
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
    }
    return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 }
  }

  /**
   * Disposition « dossiers dans une corbeille » : les livres sont parallèles, couverture face à
   * nous, rangés l'un derrière l'autre (tranches) sur 1 à 3 colonnes. Deux livres ne partagent
   * jamais le même volume : chaque tranche a sa profondeur, et dans une tranche les livres
   * penchent tous du même côté. Le panier s'élargit assez pour tout contenir.
   */
  _layout() {
    const list = [...this.books.values()]
    const n = list.length
    if (!n) { this.k.t = basketScale(0); return }
    const cols = n <= 6 ? 1 : n <= 13 ? 2 : 3
    const slices = Math.ceil(n / cols)
    // alignés sur l'ovale du panier (le plus compact) ; la vue de 3/4 montre leurs couvertures
    const nrm = new THREE.Vector3(0, 0, 1)     // vers l'avant du panier
    const tan = new THREE.Vector3(1, 0, 0)     // de gauche à droite
    const maxT = Math.max(...list.map(b => b.t))
    const depth = maxT + 0.028                 // d'une tranche à l'autre
    const pitch = BOOK_W + 0.07                // d'une colonne à l'autre
    const lean = j => [-0.05, 0.04, -0.02, 0.05, -0.04, 0.025, -0.05][j % 7]
    const slot = (i) => {
      const ci = i % cols, j = Math.floor(i / cols)
      const a = (ci - (cols - 1) / 2) * pitch + (j % 2 ? 0.035 : -0.035)
      const d = (j - (slices - 1) / 2) * depth
      return { a, d, j }
    }
    // emprise au sol de chaque livre (coins du bas, livre penché) dans le repère du panier
    const footprint = (a, d, rz) => {
      const out = []
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const lx = sx * ((BOOK_W / 2) * Math.cos(rz) + (BOOK_H / 2) * Math.abs(Math.sin(rz)))
        const ld = d + sz * maxT / 2
        out.push(tan.clone().multiplyScalar(a + lx).addScaledVector(nrm, ld))
      }
      return out
    }
    const fits = k => {
      const kz = 1 + (k - 1) * 0.6
      const ax = R_BOT * 0.93 * SX * k, bz = R_BOT * 0.93 * SZ * kz
      for (let i = 0; i < n; i++) {
        const { a, d, j } = slot(i)
        for (const c of footprint(a, d, lean(j))) if ((c.x / ax) ** 2 + (c.z / bz) ** 2 > 1) return false
      }
      return true
    }
    let k = basketScale(n)
    while (!fits(k) && k < 2.6) k += 0.02
    this.k.t = k
    list.forEach((b, i) => {
      const { a, d, j } = slot(i)
      const h = hashString(b.item.googleId)
      const rz = lean(j)
      const p = tan.clone().multiplyScalar(a).addScaledVector(nrm, d)
      // le coin le plus bas touche le fond ; les tranches du fond dépassent un peu (posées sur les autres)
      const lift = (slices - 1 - j) * 0.09 + ((h >> 6) % 4) * 0.01
      const y = 0.045 + (BOOK_H / 2) * Math.cos(rz) + (BOOK_W / 2) * Math.abs(Math.sin(rz)) + lift
      b.base = { x: p.x, y, z: p.z, rz, ry: 0 }
      if (b.fresh) {
        b.x.snap(b.base.x); b.y.snap(b.base.y); b.z.snap(b.base.z); b.rz.snap(b.base.rz); b.ry.snap(b.base.ry)
        b.fresh = false
        if (!b.waiting && !b.incoming && this.ready) this._show(b, true)
      }
      this._target(b)
    })
  }

  _target(b) {
    const hov = b.item.googleId === this.hoverId
    b.x.t = b.base.x
    b.y.t = b.base.y + (hov ? 0.32 : 0)
    b.z.t = b.base.z
    b.rx.t = 0
    b.rz.t = b.base.rz          // il monte dans sa tranche, sans toucher les autres
    b.ry.t = b.base.ry
  }

  // ---- Interactions ------------------------------------------------------------------------
  _pointer(e) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    this.ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1)
    this.ndcValid = true
  }

  _pick() {
    if (!this.ndcValid) return null
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const meshes = [...this.books.values()].filter(b => b.wrap.visible && !b.waiting && !b.incoming).map(b => b.mesh)
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
    const kz = 1 + (this.k.v - 1) * 0.6
    const p = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(this.camera); return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h } }
    this.cb.onAnchors?.({ tag: p(0.15, BH * 0.42, SZ * kz * 0.95), mouth: p(0, BH + 0.1, 0) })
  }

  // ---- Boucle --------------------------------------------------------------------------------
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

    // le panier grandit en douceur : cadre, caméra et forme suivent
    if (!this.k.done) {
      for (let i = 0; i < sub; i++) this.k.step(h)
      this._applyScale()
      this._sizeContainer()
      this.resize()
      moving = true
    }
    for (const b of this.books.values()) {
      if (b.waiting || b.incoming) continue
      for (let i = 0; i < sub; i++) { b.x.step(h); b.y.step(h); b.z.step(h); b.rx.step(h); b.ry.step(h); b.rz.step(h) }
      b.wrap.position.set(b.x.v, b.y.v, b.z.v)
      b.wrap.rotation.set(b.rx.v, b.ry.v, b.rz.v)
      if (!(b.x.done && b.y.done && b.z.done && b.rx.done && b.ry.done && b.rz.done)) moving = true
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
