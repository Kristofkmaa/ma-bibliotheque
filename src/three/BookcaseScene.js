import * as THREE from 'three'
import { spineSize, spineColors } from '../lib/bookUtils'
import { spineTexture, coverTexture, pagesTexture, grainTexture, doorTexture, setAnisotropy } from './textures'

/*
 * Bibliothèque en vraie 3D (Three.js), vue de trois quarts.
 * Les livres sont des volumes (couverture, dos, tranche des pages) légèrement tournés pour
 * montrer la moitié de leur couverture. Chacun est monté sur ressort : la souris fait passer
 * une vague dans la rangée, le livre survolé sort de l'étagère. Portes coulissantes en 3D.
 * La scène ne se redessine que lorsque quelque chose bouge.
 */

// ---- Dimensions du monde (1 = hauteur d'un grand livre) -------------------------------------
export const RH = 1.22     // hauteur utile d'un rayon
export const PT = 0.07     // épaisseur d'une planche
export const SD = 0.92     // profondeur du meuble
const ST = 0.08            // épaisseur des montants
const PADX = 0.16          // marge intérieure gauche
export const BETA = 0.4    // rotation des livres (rad) : on voit la moitié de la couverture
export const GAP = 0.105   // espace ajouté entre deux livres
const AVG_T = 0.115        // épaisseur moyenne d'un livre (pour estimer la capacité d'un rayon)
const DOOR_T = 0.025

/** Géométrie partagée avec React : nombre de rayons, largeur du meuble, livres par rayon. */
export function worldLayout(wPx, hPx, mobile) {
  const rows = mobile ? (hPx > 520 ? 3 : 2) : (hPx > 760 ? 3 : 2)
  const caseH = rows * (RH + PT) + PT
  const aspect = Math.max(0.45, wPx / Math.max(1, hPx))
  const CW = Math.max(2.1, Math.min(9.5, aspect * caseH * (mobile ? 1.12 : 1.02)))
  const step = AVG_T / Math.cos(BETA) + GAP
  const perRow = Math.max(3, Math.floor((CW - PADX - 0.3) / step))
  return { rows, CW, perRow, perPage: rows * perRow, mobile }
}

function bookDims(book) {
  const { hr } = spineSize(book)
  const h = 0.95 * hr
  const pages = book.page_count || book.pageCount || 280
  const t = Math.max(0.075, Math.min(0.17, 0.07 + pages / 4500))
  return { h, t, d: Math.min(0.66 * h, SD - 0.22) }
}

// ---- Ressorts ---------------------------------------------------------------------------------
class Spring {
  constructor(v = 0, k = 170, damp = 0.72) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.c = 2 * Math.sqrt(k) * damp }
  step(dt) {
    const a = this.k * (this.t - this.v) - this.c * this.vel
    this.vel += a * dt
    this.v += this.vel * dt
  }
  get done() { return Math.abs(this.t - this.v) < 1e-4 && Math.abs(this.vel) < 1e-3 }
  snap(v) { this.v = this.t = v; this.vel = 0 }
}

const tmpV = new THREE.Vector3()
const lerpColor = (c, target, f) => c.lerp(target, f)

export class BookcaseScene {
  constructor(container, cb) {
    this.cb = cb
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.localClippingEnabled = true
    setAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()))
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.className = 'shelf-canvas'

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200)
    this.root = new THREE.Group()
    this.scene.add(this.root)

    this.scene.add(new THREE.HemisphereLight(0xfff8ec, 0xb4a58a, 1.35))
    const key = new THREE.DirectionalLight(0xfff3e2, 1.55)
    key.position.set(-3.2, 6.5, 6)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    key.shadow.radius = 5
    this.key = key
    this.scene.add(key, key.target)
    const fill = new THREE.DirectionalLight(0xe8eeff, 0.35)
    fill.position.set(5, 2, 3)
    this.scene.add(fill)

    this.caseGroup = new THREE.Group()
    this.booksGroup = new THREE.Group()
    this.doorsGroup = new THREE.Group()
    this.root.add(this.caseGroup, this.booksGroup, this.doorsGroup)

    this.pagesMat = new THREE.MeshStandardMaterial({ map: pagesTexture(), roughness: 0.95 })
    this.grain = grainTexture()

    this.books = new Map()   // id -> entry
    this.rows = []           // structure des rayons affichés
    this.rowSkins = []
    this.doorsOpen = false
    this.hoverId = null
    this.pointer = null
    this.drag = null
    this.raycaster = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()
    this.overlayKey = ''
    this.running = false
    this.last = 0

    this._bindEvents()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
  }

  // ---- Dimensions & caméra -----------------------------------------------------------------
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    if (!w || !h) return
    this.w = w; this.h = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.layout = worldLayout(w, h, window.innerWidth <= 767)
    this._buildCase()
    this._fitCamera()
    this._placeAll(true)
    this.kick()
  }

  _fitCamera() {
    const { rows, CW, mobile } = this.layout
    const H = rows * (RH + PT) + PT
    const az = mobile ? 0.36 : 0.5
    const el = mobile ? 0.11 : 0.15
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
    const corners = []
    for (const x of [-CW / 2 - ST, CW / 2 + ST]) for (const y of [-PT, H + 0.05]) for (const z of [-SD / 2, SD / 2 + 0.06]) corners.push(new THREE.Vector3(x, y, z))
    const target = new THREE.Vector3(0, H / 2, 0)
    const place = dist => {
      this.camera.position.copy(target).addScaledVector(dir, dist)
      this.camera.lookAt(target)
      this.camera.updateMatrixWorld()
      this.camera.updateProjectionMatrix()
    }
    const bounds = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (const c of corners) { const p = c.clone().project(this.camera); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y) }
      return { x0, x1, y0, y1 }
    }
    const mx = mobile ? 0.97 : 0.96, my = 0.94
    let dist = 10
    // On cherche la distance qui fait remplir la zone, puis on recentre le meuble ; deux passes.
    for (let pass = 0; pass < 3; pass++) {
      let lo = 0.5, hi = 80
      for (let i = 0; i < 32; i++) {
        const d = (lo + hi) / 2
        place(d)
        const b = bounds()
        if (b.x1 - b.x0 < 2 * mx && b.y1 - b.y0 < 2 * my) hi = d; else lo = d
      }
      dist = hi
      place(dist)
      const b = bounds()
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
      const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * dist
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1)
      target.addScaledVector(right, cx * halfH * this.camera.aspect).addScaledVector(up, cy * halfH)
    }
    place(dist)
    const s = this.key.shadow.camera
    s.left = -CW / 2 - 1; s.right = CW / 2 + 1; s.top = H + 1; s.bottom = -1; s.near = 0.5; s.far = 30
    s.updateProjectionMatrix()
    this.key.target.position.set(0, H / 2, 0)
    this._ppu = null
  }

  rowBase(r) { return (this.layout.rows - 1 - r) * (RH + PT) + PT }

  // ---- Meuble (planches, fonds, montants, portes) ---------------------------------------------
  _woodMat(color) {
    return new THREE.MeshStandardMaterial({ color, map: this.grain, roughness: 0.78, metalness: 0.02 })
  }

  _buildCase() {
    for (const o of [...this.caseGroup.children]) { this.caseGroup.remove(o); o.geometry?.dispose() }
    for (const o of [...this.doorsGroup.children]) { this.doorsGroup.remove(o); o.geometry?.dispose() }
    const { rows, CW } = this.layout
    const H = rows * (RH + PT) + PT
    this.caseParts = []
    const clipL = new THREE.Plane(new THREE.Vector3(1, 0, 0), CW / 2)
    const clipR = new THREE.Plane(new THREE.Vector3(-1, 0, 0), CW / 2)
    for (let r = 0; r < rows; r++) {
      const y0 = this.rowBase(r)
      const part = { r }
      const wood = this._woodMat('#D8CCB0'), wall = new THREE.MeshStandardMaterial({ color: '#DAD5CA', roughness: 0.95 })
      part.wood = wood; part.wall = wall
      const plank = new THREE.Mesh(new THREE.BoxGeometry(CW + 2 * ST, PT, SD + 0.04), wood)
      plank.position.set(0, y0 - PT / 2, 0.02)
      plank.receiveShadow = plank.castShadow = true
      const back = new THREE.Mesh(new THREE.PlaneGeometry(CW, RH + PT), wall)
      back.position.set(0, y0 + RH / 2 - PT / 2 + PT, -SD / 2)
      back.receiveShadow = true
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(ST, RH + PT, SD + 0.04), wood)
      sideL.position.set(-CW / 2 - ST / 2, y0 + RH / 2, 0.02)
      const sideR = sideL.clone(); sideR.position.x = CW / 2 + ST / 2
      sideL.castShadow = sideR.castShadow = true
      sideL.receiveShadow = sideR.receiveShadow = true
      this.caseGroup.add(plank, back, sideL, sideR)
      part.plank = plank
      // portes coulissantes (découpées aux bords du meuble)
      const doorMatL = new THREE.MeshStandardMaterial({ color: '#E2D6BC', map: doorTexture('panneau'), roughness: 0.7, clippingPlanes: [clipL, clipR], clipShadows: true })
      const doorMatR = doorMatL.clone()
      const half = CW / 2 + 0.01
      const dl = new THREE.Mesh(new THREE.BoxGeometry(half, RH - 0.02, DOOR_T), doorMatL)
      const dr = new THREE.Mesh(new THREE.BoxGeometry(CW, RH - 0.02, DOOR_T), doorMatR)
      const dz = SD / 2 + 0.06
      dl.position.set(0, y0 + RH / 2, dz); dr.position.set(0, y0 + RH / 2, dz + 0.004)
      dl.castShadow = dr.castShadow = true
      this.doorsGroup.add(dl, dr)
      part.doorL = dl; part.doorR = dr; part.doorMats = [doorMatL, doorMatR]; part.doorStyle = 'panneau'
      // ressorts : position du bord d'attaque de chaque porte (depuis la gauche du meuble)
      part.left = new Spring(half, 120, 0.9)
      part.right = new Spring(half, 120, 0.9)
      part.born = new Spring(1, 90, 0.85)
      this.caseParts.push(part)
    }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(CW + 2 * ST + 0.06, 0.09, SD + 0.1), this._woodMat('#D8CCB0'))
    crown.position.set(0, H - PT + 0.045, 0.03)
    crown.castShadow = true
    this.crown = crown
    this.caseGroup.add(crown)
    this.rowSkins = []
    if (this.rowsData) this.setRows(this.rowsData, { instant: true })
  }

  /** Apparence d'un rayon : couleurs du bois, du fond, style des portes (les couleurs se fondent). */
  _applySkin(r, palette, instant) {
    const part = this.caseParts[r]
    if (!part || !palette) return
    part.targetWood = new THREE.Color(palette.mat.mid)
    part.targetWall = new THREE.Color(palette.wall2)
    part.targetDoor = new THREE.Color(palette.mat.door1)
    if (instant) {
      part.wood.color.copy(part.targetWood); part.wall.color.copy(part.targetWall)
      part.doorMats.forEach(m => m.color.copy(part.targetDoor))
    }
    if (part.doorStyle !== palette.doors) {
      part.doorStyle = palette.doors
      part.doorMats.forEach(m => { m.map = doorTexture(palette.doors); m.needsUpdate = true })
    }
    if (r === 0) this.crown.material.color.copy(part.targetWood)
  }

  // ---- Livres ----------------------------------------------------------------------------------
  _makeBook(book) {
    const { h, t, d } = bookDims(book)
    const [bg] = spineColors(book)
    const back = new THREE.MeshStandardMaterial({ color: new THREE.Color(bg).multiplyScalar(0.8), roughness: 0.7 })
    const spine = new THREE.MeshStandardMaterial({ map: spineTexture(book), roughness: 0.6 })
    const cover = new THREE.MeshStandardMaterial({ roughness: 0.55 })
    const entry = { id: book.id, book, h, t, d }
    cover.map = coverTexture(book, tex => { cover.map = tex; cover.needsUpdate = true; this.kick() })
    // ordre des faces : +x couverture, -x 4e de couverture, +y/-y tête et pied, +z dos, -z gouttière
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), [cover, back, this.pagesMat, this.pagesMat, spine, this.pagesMat])
    mesh.castShadow = mesh.receiveShadow = true
    mesh.userData.id = book.id
    const wrap = new THREE.Group()
    wrap.add(mesh)
    this.booksGroup.add(wrap)
    Object.assign(entry, {
      mesh, wrap, mats: [cover, back, spine],
      x: new Spring(0, 150, 0.78), y: new Spring(0, 190, 0.6), z: new Spring(0, 170, 0.72),
      yaw: new Spring(-BETA, 150, 0.8), tilt: new Spring(0, 160, 0.75),
    })
    this.books.set(book.id, entry)
    return entry
  }

  _disposeBook(entry) {
    this.booksGroup.remove(entry.wrap)
    entry.mesh.geometry.dispose()
    entry.mats.forEach(m => m.dispose())
    this.books.delete(entry.id)
  }

  /**
   * Rayons à afficher : [{ books: [livre | {placeholder}], palette, born }].
   * Les livres déjà présents glissent vers leur nouvelle place ; les nouveaux se posent.
   */
  setRows(rowsData, { instant = false, settle = false } = {}) {
    this.rowsData = rowsData
    if (!this.layout) return
    const keep = new Set()
    rowsData.forEach((row, r) => {
      this._applySkin(r, row.palette, instant || !this.rowSkins[r])
      this.rowSkins[r] = row.palette
      if (row.born && this.caseParts[r]) { this.caseParts[r].born.snap(0); this.caseParts[r].born.t = 1 }
      row.books.forEach(b => { if (!b.placeholder) keep.add(b.id) })
    })
    if (this.drag) keep.add(this.drag.id)
    for (const e of [...this.books.values()]) if (!keep.has(e.id)) this._disposeBook(e)
    let order = 0
    rowsData.forEach((row, r) => {
      row.books.forEach(b => {
        if (b.placeholder) return
        let e = this.books.get(b.id)
        const fresh = !e
        if (!e) e = this._makeBook(b)
        e.book = b
        e.row = r
        e.fresh = fresh
        e.order = order++
      })
    })
    this._placeAll(instant, settle)
    this.kick()
  }

  /** Calcule la place de chaque livre dans son rayon (et l'espace laissé par l'emplacement). */
  _placeAll(instant, settle) {
    if (!this.layout || !this.rowsData) return
    const { CW } = this.layout
    const cb = Math.cos(BETA), sb = Math.sin(BETA)
    this.rowEnds = []
    this.slots = []
    this.rowsData.forEach((row, r) => {
      const y0 = this.rowBase(r)
      const items = row.books.map(b => (b.placeholder ? { ph: true, t: AVG_T * 1.2, d: 0.6 } : this.books.get(b.id)))
      // largeur naturelle, puis on resserre si le rayon déborde
      let need = 0
      items.forEach((it, i) => { need += i ? (items[i - 1].t + it.t) / (2 * cb) : 0 })
      const first = items[0] ? (items[0].t * cb + items[0].d * sb) / 2 : 0
      const lastExt = items.length ? (items[items.length - 1].t * cb + items[items.length - 1].d * sb) / 2 : 0
      const avail = CW - PADX - 0.12 - first - lastExt - need
      const gap = items.length > 1 ? Math.max(0.012, Math.min(GAP, avail / (items.length - 1))) : GAP
      let x = -CW / 2 + PADX + first
      const slots = []
      items.forEach((it, i) => {
        if (i) x += (items[i - 1].t + it.t) / (2 * cb) + gap
        slots.push(x)
        if (it.ph) return
        const e = it
        const zSpine = SD / 2 - 0.045
        e.base = { x, y: y0 + e.h / 2, z: zSpine - (e.d / 2) * cb }
        if (instant || e.fresh) {
          e.x.snap(x); e.z.snap(e.base.z); e.yaw.snap(-BETA)
          // un nouveau livre se pose : il part d'un peu plus haut (sans dépasser le rayon du dessus)
          const drop = settle || e.fresh ? Math.min(0.2, RH - e.h - 0.02) : 0
          e.y.snap(e.base.y + drop)
          if (drop) { e.y.t = e.base.y; e.delay = Math.min(e.order, 40) * 16 }
          e.wrap.position.set(e.x.v, e.y.v, e.z.v)
          e.mesh.rotation.y = e.yaw.v
          e.fresh = false
        }
        e.x.t = x
      })
      this.rowEnds[r] = items.length ? x + lastExt : -CW / 2 + PADX
      this.slots[r] = slots
    })
    this._updateDoorTargets()
    this._refreshTargets()
  }

  // ---- Portes ------------------------------------------------------------------------------------
  setDoors(open) { this.doorsOpen = open; this._updateDoorTargets(); this.kick() }

  _updateDoorTargets() {
    if (!this.caseParts || !this.layout) return
    const { CW } = this.layout
    const half = CW / 2 + 0.01
    this.caseParts.forEach((part, r) => {
      const row = this.rowsData?.[r]
      const count = row ? row.books.length : 0
      const end = (this.rowEnds?.[r] ?? -CW / 2) + CW / 2 + 0.1 // en distance depuis la gauche
      const empty = count === 0
      const fullyOpen = !empty && end > CW - 0.25
      part.left.t = !this.doorsOpen || empty ? half : -0.2
      part.right.t = !this.doorsOpen || empty ? half : fullyOpen ? CW + 0.3 : end
      part.free = this.doorsOpen && !fullyOpen && (empty || CW - end > 0.6)
      part.k = r
    })
  }

  // ---- Interactions ----------------------------------------------------------------------------
  _bindEvents() {
    const el = this.renderer.domElement
    this.onMove = e => {
      const rc = el.getBoundingClientRect()
      this.pointer = { x: e.clientX - rc.left, y: e.clientY - rc.top, cx: e.clientX, cy: e.clientY }
      this.ndc.set((this.pointer.x / rc.width) * 2 - 1, -(this.pointer.y / rc.height) * 2 + 1)
      if (this.press && !this.drag) {
        const dist = Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y)
        if (this.press.type === 'mouse' ? dist > 6 : dist > 10) {
          if (this.press.type === 'mouse' && this.cb.canDrag?.()) this._startDrag()
          else if (this.press.type !== 'mouse') { clearTimeout(this.press.timer); this.press = null }
        }
      }
      if (this.drag) { e.preventDefault(); this._dragMove() }
      this.pointerDirty = true
      this.kick()
    }
    this.onLeave = () => { this.pointer = null; this.pointerDirty = true; this._setHover(null); this.kick() }
    this.onDown = e => {
      if (e.button > 0) return
      const hit = this._pick(e)
      if (!hit) return
      this.press = { id: hit, x: e.clientX, y: e.clientY, type: e.pointerType }
      if (e.pointerType !== 'mouse' && this.cb.canDrag?.()) {
        this.press.timer = setTimeout(() => { if (this.press && !this.drag) this._startDrag() }, 320)
      }
    }
    this.onUp = e => {
      const press = this.press
      this.press = null
      if (press?.timer) clearTimeout(press.timer)
      if (this.drag) { this._endDrag(true); return }
      if (!press) return
      const hit = this._pick(e)
      if (hit && hit === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10) this._open(hit)
    }
    this.onCancel = () => { if (this.drag) this._endDrag(false); this.press = null }
    el.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointermove', this.onWinMove = e => { if (this.drag) this.onMove(e) }, { passive: false })
    el.addEventListener('pointerleave', this.onLeave)
    el.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onCancel)
  }

  _pick(e) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    this.ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const meshes = [...this.books.values()].filter(b => !this.drag || b.id !== this.drag.id).map(b => b.mesh)
    const doors = this.caseParts?.flatMap(p => [p.doorL, p.doorR]) || []
    const hits = this.raycaster.intersectObjects([...meshes, ...doors], false)
    if (!hits.length) return null
    const first = hits[0].object
    if (doors.includes(first)) return null // une porte cache le livre
    return first.userData.id
  }

  _setHover(id) {
    if (id === this.hoverId) return
    this.hoverId = id
    this.cb.onHover?.(id ? this.books.get(id)?.book : null)
    this.container.style.cursor = id ? 'pointer' : ''
    this._refreshTargets()
  }

  _open(id) {
    const e = this.books.get(id)
    if (!e) return
    e.taking = true
    this._refreshTargets()
    this.kick()
    setTimeout(() => {
      this.cb.onOpen?.(e.book, { getBoundingClientRect: () => this.screenRect(e) })
      setTimeout(() => { e.taking = false; this._refreshTargets(); this.kick() }, 900)
    }, 220)
  }

  /** Rectangle écran (pour faire grandir la fiche depuis le livre). */
  screenRect(e) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    const box = new THREE.Box3().setFromObject(e.mesh)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      tmpV.set(x, y, z).project(this.camera)
      const sx = rc.left + (tmpV.x + 1) / 2 * rc.width, sy = rc.top + (1 - tmpV.y) / 2 * rc.height
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy)
    }
    return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY }
  }

  // ---- Glisser-déposer -----------------------------------------------------------------------
  _startDrag() {
    const id = this.press?.id
    const e = id && this.books.get(id)
    if (!e) return
    clearTimeout(this.press.timer)
    this.drag = { id, entry: e }
    navigator.vibrate?.(8)
    document.body.classList.add('is-dragging')
    this._setHover(null)
    this.cb.onDragStart?.(id)
    this._dragMove()
  }

  /** Point du curseur sur le plan avant du meuble. */
  _frontPoint(z) {
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z)
    const p = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(plane, p) ? p : null
  }

  _dragMove() {
    const d = this.drag
    if (!d || !this.pointer) return
    const p = this._frontPoint(SD / 2 + 0.28)
    if (p) {
      d.entry.x.t = p.x
      d.entry.y.t = p.y - 0.15
      d.entry.z.t = SD / 2 + 0.28 - d.entry.d / 2
      d.entry.yaw.t = -0.15
    }
    // cible : rayon et position d'insertion (comptée sur les livres hors livre déplacé)
    const q = this._frontPoint(SD / 2)
    let target = null
    if (q) {
      for (let r = 0; r < this.layout.rows; r++) {
        const y0 = this.rowBase(r)
        if (q.y < y0 - PT || q.y > y0 + RH) continue
        const row = this.rowsData[r]
        if (!row) break
        const xs = row.books.filter(b => !b.placeholder && b.id !== d.id).map(b => this.books.get(b.id)?.base?.x ?? 0)
        target = { row: r, index: xs.filter(x => x < q.x).length }
        break
      }
    }
    if (JSON.stringify(target) !== JSON.stringify(d.target)) { d.target = target; this.cb.onDragTarget?.(target) }
    this.cb.onDragMove?.(this.pointer.cx, this.pointer.cy)
  }

  _endDrag(commit) {
    const d = this.drag
    this.drag = null
    document.body.classList.remove('is-dragging')
    this.cb.onDragEnd?.(d.id, commit ? d.target : null)
    d.entry.yaw.t = -BETA
    this._placeAll(false)
    this.kick()
  }

  // ---- Cibles des ressorts (vague, survol, prise en main) -----------------------------------
  _refreshTargets() {
    for (const e of this.books.values()) {
      if (this.drag && e.id === this.drag.id) continue
      if (!e.base) continue
      let lift = 0, pull = 0
      if (e.id === this.hoverId) { lift += 0.075; pull += 0.13 }
      if (e.taking) { lift += 0.16; pull += 0.3 }
      e.waveLift = lift
      e.y.t = e.base.y + lift + (e.wave || 0)
      e.z.t = e.base.z + pull
    }
  }

  /** La vague : les livres proches du curseur se soulèvent (projection écran des livres). */
  _wave() {
    const ptr = this.pointer
    for (const e of this.books.values()) {
      if (!e.base || (this.drag && e.id === this.drag.id)) continue
      let w = 0
      if (ptr && !this.drag) {
        tmpV.set(e.base.x, e.base.y + e.h / 2, e.base.z + e.d / 2).project(this.camera)
        const sx = (tmpV.x + 1) / 2 * this.w, sy = (1 - tmpV.y) / 2 * this.h
        const bandTop = sy - 12, bandBottom = sy + e.h * this._pxPerUnit() + 20
        if (ptr.y > bandTop && ptr.y < bandBottom) {
          const dx = (ptr.x - sx) / (this._pxPerUnit() * 0.42)
          w = 0.05 * Math.exp(-dx * dx)
        }
      }
      if (Math.abs((e.wave || 0) - w) > 1e-4) { e.wave = w; e.y.t = e.base.y + (e.waveLift || 0) + w }
    }
  }

  _pxPerUnit() {
    if (!this._ppu) {
      const a = new THREE.Vector3(0, 0, SD / 2).project(this.camera), b = new THREE.Vector3(0, 1, SD / 2).project(this.camera)
      this._ppu = Math.abs(a.y - b.y) / 2 * this.h
    }
    return this._ppu
  }

  // ---- Boucle d'animation ------------------------------------------------------------------------
  kick() {
    if (this.running || this.disposed) return
    this.running = true
    this.last = performance.now()
    this._ppu = null
    requestAnimationFrame(this._frame)
  }

  _frame = now => {
    if (this.disposed) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const ptrChanged = this.pointerDirty
    this.pointerDirty = false
    if (ptrChanged && this.pointer && !this.drag) {
      this.raycaster.setFromCamera(this.ndc, this.camera)
      const meshes = [...this.books.values()].map(b => b.mesh)
      const doors = this.caseParts?.flatMap(p => [p.doorL, p.doorR]) || []
      const hits = this.raycaster.intersectObjects([...meshes, ...doors], false)
      const top = hits[0]?.object
      this._setHover(top && !doors.includes(top) ? top.userData.id : null)
    }
    if (ptrChanged || this.wasWaving) this._wave()
    this.wasWaving = !!this.pointer

    let moving = false
    const sub = 4, h = dt / sub
    for (const e of this.books.values()) {
      if (e.delay > 0) { e.delay -= dt * 1000; moving = true; e.wrap.position.set(e.x.v, e.y.v, e.z.v); continue }
      for (let i = 0; i < sub; i++) { e.x.step(h); e.y.step(h); e.z.step(h); e.yaw.step(h) }
      e.wrap.position.set(e.x.v, e.y.v, e.z.v)
      e.mesh.rotation.y = e.yaw.v
      if (!(e.x.done && e.y.done && e.z.done && e.yaw.done)) moving = true
    }
    if (this.caseParts) {
      const { CW } = this.layout
      const half = CW / 2 + 0.01
      for (const part of this.caseParts) {
        for (let i = 0; i < sub; i++) { part.left.step(h); part.right.step(h); part.born.step(h) }
        // bord d'attaque gauche/droit → position des panneaux
        part.doorL.position.x = -CW / 2 + part.left.v - half / 2
        part.doorR.position.x = -CW / 2 + part.right.v + CW / 2
        const b = Math.max(0, Math.min(1, part.born.v))
        part.plank.scale.x = Math.max(0.001, b)
        if (!(part.left.done && part.right.done && part.born.done)) moving = true
        if (part.targetWood) {
          const f = 1 - Math.exp(-dt * 7)
          lerpColor(part.wood.color, part.targetWood, f)
          lerpColor(part.wall.color, part.targetWall, f)
          part.doorMats.forEach(m => lerpColor(m.color, part.targetDoor, f))
          if (part.r === 0) lerpColor(this.crown.material.color, part.targetWood, f)
          if (part.wood.color.getHex() !== part.targetWood.getHex()) moving = true
        }
      }
    }

    this.renderer.render(this.scene, this.camera)
    this._adapt(dt)
    this._emitOverlay()
    if (moving || this.drag || this.pointerDirty) requestAnimationFrame(this._frame)
    else this.running = false
  }

  /**
   * Qualité adaptative : sur un appareil modeste (images trop lentes pendant les animations),
   * on réduit d'abord la résolution, puis on simplifie les ombres.
   */
  _adapt(dt) {
    if (dt <= 0 || dt > 0.25) return
    this.perf = this.perf || { sum: 0, n: 0, level: 0 }
    const pf = this.perf
    pf.sum += dt; pf.n++
    if (pf.n < 24) return
    const avg = pf.sum / pf.n
    pf.sum = 0; pf.n = 0
    if (avg > 0.034 && pf.level === 0) {
      pf.level = 1
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(this.w, this.h, false)
    } else if (avg > 0.034 && pf.level === 1) {
      pf.level = 2
      this.renderer.shadowMap.type = THREE.PCFShadowMap
      this.key.shadow.mapSize.set(1024, 1024)
      this.key.shadow.map?.dispose(); this.key.shadow.map = null
    }
  }

  /** Positions écran des étiquettes de planche et des porte-étiquettes (calques HTML). */
  _emitOverlay() {
    if (!this.caseParts || !this.cb.onOverlay) return
    const { CW } = this.layout
    const toScreen = v => { const p = v.clone().project(this.camera); return { x: (p.x + 1) / 2 * this.w, y: (1 - p.y) / 2 * this.h } }
    const out = this.caseParts.map((part, r) => {
      const y0 = this.rowBase(r)
      const label = toScreen(new THREE.Vector3(-CW / 2 + 0.1, y0 - PT / 2, SD / 2 + 0.04))
      const card = toScreen(new THREE.Vector3(-CW / 2 + part.right.v + 0.12, y0 + RH - 0.16, SD / 2 + 0.08))
      return { label, card, free: !!part.free && part.right.done, born: part.born.v }
    })
    const key = out.map(o => `${o.label.x | 0},${o.label.y | 0},${o.card.x | 0},${o.card.y | 0},${o.free}`).join('|')
    if (key !== this.overlayKey) { this.overlayKey = key; this.cb.onOverlay(out) }
  }

  dispose() {
    this.disposed = true
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointermove', this.onWinMove)
    el.removeEventListener('pointerleave', this.onLeave)
    el.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onCancel)
    for (const e of [...this.books.values()]) this._disposeBook(e)
    this.renderer.dispose()
    el.remove()
  }
}
