import * as THREE from 'three'
import { spineSize, spineColors } from '../lib/bookUtils'
import { spineTexture, withCover, pagesTexture, grainTexture, doorTexture, setAnisotropy, bookmarkTexture } from './textures'
import { getBookStatuses } from '../hooks/useLibrary'

/*
 * Bibliothèque en vraie 3D (Three.js), vue de trois quarts : un seul grand mur.
 * Toutes les étagères sont empilées dans le même meuble ; la caméra le parcourt de haut en bas
 * (molette, doigt, clavier) et peut reculer pour une vue d'ensemble (pincement, bouton).
 * Seules les étagères proches de l'écran ont leurs livres en 3D ; leurs portes s'ouvrent quand
 * elles arrivent dans le champ. Les livres sont des volumes sur ressorts (vague, survol, prise en
 * main). La scène ne se redessine que lorsque quelque chose bouge.
 */

// ---- Dimensions du monde (1 = hauteur d'un grand livre) -------------------------------------
export const RH = 1.22     // hauteur utile d'un rayon
export const PT = 0.07     // épaisseur d'une planche
export const SD = 0.92     // profondeur du meuble
export const ST = 0.08     // épaisseur des montants
const PADX = 0.16          // marge intérieure gauche
export const BETA = 0.4    // rotation des livres (rad) : on voit la moitié de la couverture
export const GAP = 0.105   // espace ajouté entre deux livres
const AVG_T = 0.115        // épaisseur moyenne d'un livre (pour estimer la capacité d'un rayon)
const DOOR_T = 0.025

/** Géométrie partagée avec React : nombre de rayons, largeur du meuble, livres par rayon. */
export function worldLayout(wPx, hPx, mobile) {
  const rows = mobile ? (hPx > 520 ? 3 : 2) : (hPx > 760 ? 3 : 2)
  const caseH = rows * (RH + PT) + PT
  // zone très large et basse (tiroir ouvert, grand écran) : le meuble ne s'étire pas, il garde de grands livres
  const aspect = Math.max(0.45, Math.min(2.6, wPx / Math.max(1, hPx)))
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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerpColor = (c, target, f) => c.lerp(target, f)

/** Le livre est-il bleu ? (le marque-page prend alors la teinte rouge, pour trancher) */
function spineColorsIsBlue(book) {
  const [bg] = spineColors(book)
  return ['#1F3FB0', '#4A3B8C', '#3B5B7E'].includes(bg)
}

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

    this.books = new Map()   // id -> entrée 3D (livres des étagères proches de l'écran)
    this.bases = new Map()   // id -> place de chaque livre du mur (même hors écran)
    this.rowSkins = []
    this.rowCount = 0
    this.knownIds = null
    this.freshIds = new Set()
    this.liveRows = null
    this.inView = null
    this.scroll = new Spring(0, 90, 1)      // centre de la vue (hauteur dans le mur)
    this.zoom = new Spring(1, 60, 1)        // 1 : de près ; 0 : vue d'ensemble
    this.edgeVel = 0
    this.lightOffset = new THREE.Vector3(-3.2, 6.5, 6)
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
    if (w === this.w && h === this.h && this.layout) return
    this.w = w; this.h = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    const next = worldLayout(w, h, window.innerWidth <= 767)
    const sameShape = lay => lay.rows === this.layout.rows && lay.mobile === this.layout.mobile && Math.abs(lay.CW - this.layout.CW) < 1e-6
    if (!this.layout) {
      this.layout = next
      if (this.rowsData) this._rebuild()
      this._fitCamera()
    } else if (sameShape(next)) {
      this._fitCamera()
    } else {
      // on recadre tout de suite ; on ne reconstruit le meuble qu'une fois la taille stabilisée
      this._fitCamera()
      clearTimeout(this.rebuildTimer)
      this.rebuildTimer = setTimeout(() => {
        if (this.disposed) return
        const lay = worldLayout(this.w, this.h, window.innerWidth <= 767)
        if (sameShape(lay)) return
        this.layout = lay
        if (this.rowsData) this._rebuild()
        this._fitCamera()
        this.kick()
      }, 220)
    }
    this.kick()
  }

  /** Cadrage d'une fenêtre de hauteur donnée (centrée en 0) : distance et décalage de la visée. */
  _fitWindow(height) {
    const { CW, mobile } = this.layout
    const dir = this.camDir
    const corners = []
    for (const x of [-CW / 2 - ST, CW / 2 + ST]) for (const y of [-height / 2, height / 2]) for (const z of [-SD / 2, SD / 2 + 0.06]) corners.push(new THREE.Vector3(x, y, z))
    const target = new THREE.Vector3(0, 0, 0)
    const place = dist => {
      this.camera.position.copy(target).addScaledVector(dir, dist)
      this.camera.lookAt(target)
      this.camera.updateMatrixWorld()
      this.camera.updateProjectionMatrix()
    }
    const bounds = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (const c of corners) { const q = c.clone().project(this.camera); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y) }
      return { x0, x1, y0, y1 }
    }
    const mx = mobile ? 0.97 : 0.96, my = 0.94
    let dist = 10
    for (let pass = 0; pass < 3; pass++) {
      let lo = 0.5, hi = 160
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
    return { dist, offset: target.clone() }
  }

  _fitCamera() {
    if (!this.layout) return
    const { rows: vis, mobile } = this.layout
    const az = mobile ? 0.36 : 0.5
    const el = mobile ? 0.11 : 0.15
    this.camDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
    this.viewH = vis * (RH + PT) + PT
    this.totalH = Math.max(this.rowCount, vis) * (RH + PT) + PT
    this.camNear = this._fitWindow(this.viewH)
    this.camFar = this.totalH > this.viewH + 0.01 ? this._fitWindow(this.totalH + 0.12) : this.camNear
    if (!this.scrollInit && this.rowCount) { this.scroll.snap(this._clampScroll(Infinity)); this.scrollInit = true }
    this.scroll.t = this._clampScroll(this.scroll.t)
    if (this.scroll.v !== this._clampScroll(this.scroll.v)) this.scroll.snap(this.scroll.t)
    this._placeCamera()
    this._updateVisible(true)
  }

  /** Limites du défilement (centre de la vue) ; « rubber » laisse dépasser un peu en tirant. */
  _clampScroll(v, rubber = false) {
    const lo = this.viewH / 2, hi = this.totalH - this.viewH / 2
    if (hi <= lo) return this.totalH / 2
    if (!rubber) return clamp(v, lo, hi)
    if (v > hi) return hi + (v - hi) * 0.35
    if (v < lo) return lo + (v - lo) * 0.35
    return v
  }

  /** Place la caméra entre la vue rapprochée (au défilement courant) et la vue d'ensemble. */
  _placeCamera() {
    if (!this.camNear) return
    const z = clamp(this.zoom.v, 0, 1)
    const yc = this.scroll.v
    const tNear = new THREE.Vector3(0, yc, 0).add(this.camNear.offset)
    const target = new THREE.Vector3(0, this.totalH / 2, 0).add(this.camFar.offset).lerp(tNear, z)
    const dist = this.camFar.dist + (this.camNear.dist - this.camFar.dist) * z
    this.camera.position.copy(target).addScaledVector(this.camDir, dist)
    this.camera.lookAt(target)
    this.camera.updateMatrixWorld()
    this.camera.updateProjectionMatrix()
    const big = this.totalH > this.viewH
    const h = big ? this.totalH + (this.viewH - this.totalH) * z : this.viewH
    const yNow = big ? this.totalH / 2 + (yc - this.totalH / 2) * z : this.totalH / 2
    this.viewNow = { yc: yNow, h }
    // la lumière suit la vue (ombres nettes sur toute la hauteur du mur)
    this.key.position.copy(target).add(this.lightOffset)
    this.key.target.position.copy(target)
    const sc = this.key.shadow.camera
    const { CW } = this.layout
    sc.left = -CW / 2 - 1.5; sc.right = CW / 2 + 1.5; sc.top = h / 2 + 2; sc.bottom = -h / 2 - 2; sc.near = 0.5; sc.far = 40
    sc.updateProjectionMatrix()
    this._ppu = null
    const T = this.totalH
    this.cb.onView?.({ top: clamp(1 - (yNow + h / 2) / T, 0, 1), bottom: clamp(1 - (yNow - h / 2) / T, 0, 1), zoom: z })
  }

  _upp() { return (this.viewNow?.h || this.viewH || 3) / Math.max(1, this.h) }

  rowBase(r) { return (this.rowCount - 1 - r) * (RH + PT) + PT }

  // ---- Navigation (appelée par l'interface) ---------------------------------------------------
  scrollToRow(r) {
    if (!this.rowCount) return
    const c = this.rowBase(clamp(r, 0, this.rowCount - 1)) + RH / 2
    this.scroll.t = this._clampScroll(c)
    this.setZoom(true)
    this.kick()
  }
  scrollBy(rows) { this.scroll.t = this._clampScroll(this.scroll.t - rows * (RH + PT)); this.kick() }
  scrollToTop() { this.scroll.t = this._clampScroll(Infinity); this.kick() }
  scrollToBottom() { this.scroll.t = this._clampScroll(-Infinity); this.kick() }
  setZoom(near) { this.zoom.t = near ? 1 : 0; this.cb.onZoom?.(this.zoom.t); this.kick() }
  get zoomedOut() { return this.zoom.t < 0.5 }

  /** Amène un livre à l'écran puis le fait sortir un instant de l'étagère. */
  focusBook(id) {
    const base = this.bases.get(id)
    if (!base) return false
    this.scrollToRow(base.row)
    clearTimeout(this.spotTimer)
    this.spotTimer = setTimeout(() => {
      const e = this.books.get(id)
      if (!e) return
      this.spotId = id
      this._refreshTargets(); this.kick()
      this.cb.onSpot?.(e.book)
      this.spotTimer = setTimeout(() => { this.spotId = null; this._refreshTargets(); this.kick(); this.cb.onSpot?.(null) }, 2400)
    }, 750)
    return true
  }

  /** Défilement automatique pendant un glisser-déposer, près du haut ou du bas de la zone. */
  _edgeFrom(clientY) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    const zone = Math.min(80, rc.height * 0.16)
    const y = clientY - rc.top
    let v = 0
    if (y < zone) v = ((zone - Math.max(0, y)) / zone) * 3.4
    else if (y > rc.height - zone) v = -((Math.min(rc.height, y) - (rc.height - zone)) / zone) * 3.4
    this.edgeVel = v
    if (v) this.kick()
  }
  setExternalPointer(cx, cy) {
    this.extActive = cx != null
    if (cx == null) { this.edgeVel = 0; return }
    this._edgeFrom(cy)
  }

  // ---- Meuble (planches, fonds, montants, portes) ---------------------------------------------
  _woodMat(color) {
    return new THREE.MeshStandardMaterial({ color, map: this.grain, roughness: 0.78, metalness: 0.02 })
  }

  _buildCase() {
    const old = this.caseParts
    for (const o of [...this.caseGroup.children]) { this.caseGroup.remove(o); o.geometry?.dispose() }
    for (const o of [...this.doorsGroup.children]) { this.doorsGroup.remove(o); o.geometry?.dispose() }
    old?.forEach(pt => { pt.wood.dispose(); pt.wall.dispose(); pt.doorMats.forEach(m => m.dispose()) })
    this.crown?.material.dispose()
    const { CW } = this.layout
    const rows = this.rowCount
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
      const doorMatL = new THREE.MeshStandardMaterial({ color: '#E2D6BC', map: doorTexture('panneau'), roughness: 0.7, clippingPlanes: [clipL, clipR], clipShadows: true })
      const doorMatR = doorMatL.clone()
      const half = CW / 2 + 0.01
      const dl = new THREE.Mesh(new THREE.BoxGeometry(half, RH - 0.02, DOOR_T), doorMatL)
      const dr = new THREE.Mesh(new THREE.BoxGeometry(CW, RH - 0.02, DOOR_T), doorMatR)
      const dz = SD / 2 + 0.06
      dl.position.set(0, y0 + RH / 2, dz); dr.position.set(0, y0 + RH / 2, dz + DOOR_T + 0.012) // jamais dans le même plan : pas de scintillement
      dl.castShadow = dr.castShadow = true
      this.doorsGroup.add(dl, dr)
      part.doorL = dl; part.doorR = dr; part.doorMats = [doorMatL, doorMatR]; part.doorStyle = 'panneau'
      part.left = new Spring(half, 120, 0.9)
      part.right = new Spring(half, 120, 0.9)
      part.born = new Spring(1, 90, 0.85)
      // les portes déjà là gardent leur position (pas de fermeture/réouverture)
      if (old?.[r]) { part.left.snap(old[r].left.v); part.right.snap(old[r].right.v) }
      this.caseParts.push(part)
    }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(CW + 2 * ST + 0.06, 0.09, SD + 0.1), this._woodMat('#D8CCB0'))
    crown.position.set(0, H - PT + 0.045, 0.03)
    crown.castShadow = true
    this.crown = crown
    this.caseGroup.add(crown)
    this.rowSkins = []
  }

  /** Reconstruit le meuble (nombre de rayons ou largeur changés) et replace tout. */
  _rebuild() {
    this.rowCount = Math.max(1, this.rowsData.length)
    this._buildCase()
    this.rowsData.forEach((row, r) => { this._applySkin(r, row.palette, true); this.rowSkins[r] = row.palette })
    this._computeBases()
    this._fitCamera()
    this._updateVisible(true)
    this._updateDoorTargets()
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
    // Le livre n'apparaît qu'avec sa vraie couverture (préchargée) : jamais d'image par défaut
    entry.waiting = true
    wrap.visible = false
    withCover(book, tex => {
      cover.map = tex; cover.needsUpdate = true
      if (!entry.waiting) return
      entry.waiting = false
      wrap.visible = true
      if (entry.base) {
        entry.y.snap(entry.base.y + Math.min(0.2, RH - entry.h - 0.02))
        entry.y.t = entry.base.y + (entry.waveLift || 0)
      }
      this.kick()
    }, tex => { cover.map = tex; cover.needsUpdate = true; this.kick() })
    return entry
  }

  /**
   * Livre « en cours » : un marque-page glissé au milieu des pages dépasse du haut du livre,
   * avec une queue d'aronde. Il sort des pages quand on passe le livre en cours.
   */
  _syncBookmark(e) {
    const wants = getBookStatuses(e.book).includes('en_cours')
    if (wants && !e.mark) {
      const w = 0.095, L = 0.32, notch = 0.04
      const shape = new THREE.Shape()
      shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, L); shape.lineTo(0, L - notch); shape.lineTo(-w / 2, L); shape.closePath()
      const tex = bookmarkTexture(spineColorsIsBlue(e.book) ? 1 : 0).clone()
      tex.needsUpdate = true
      tex.repeat.set(1 / w, 1 / L); tex.offset.set(0.5, 0)
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide })
      const mark = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat)
      mark.rotation.y = Math.PI / 2            // dans le plan des pages
      mark.rotation.z = 0.06                    // légèrement penché, comme glissé à la main
      const holder = new THREE.Group()
      holder.add(mark)
      holder.position.set(0, e.h / 2 - 0.1, e.d * 0.16)    // au milieu des pages, côté visible
      holder.scale.y = 0.001                    // il sort des pages (animé)
      mark.castShadow = true
      e.mesh.add(holder)
      e.mark = holder; e.markMat = mat; e.markTex = tex
      e.markGrow = true
      this.kick()
    } else if (!wants && e.mark) {
      e.mesh.remove(e.mark)
      e.mark.children[0].geometry.dispose(); e.markMat.dispose(); e.markTex.dispose()
      e.mark = null
    }
    e.markReady = true
  }

  _disposeBook(entry) {
    if (entry.mark) { entry.mark.children[0].geometry.dispose(); entry.markMat.dispose(); entry.markTex.dispose() }
    this.booksGroup.remove(entry.wrap)
    entry.mesh.geometry.dispose()
    entry.mats.forEach(m => m.dispose())
    this.books.delete(entry.id)
  }

  /**
   * Tous les rayons du mur : [{ books: [livre | {placeholder}], palette, born }].
   * Les livres déjà présents glissent vers leur nouvelle place ; les nouveaux se posent.
   */
  setRows(rowsData) {
    this.rowsData = rowsData
    if (!this.layout) return
    if (Math.max(1, rowsData.length) !== this.rowCount || !this.caseParts) {
      this._rebuild()
    } else {
      rowsData.forEach((row, r) => {
        this._applySkin(r, row.palette, !this.rowSkins[r])
        this.rowSkins[r] = row.palette
      })
    }
    rowsData.forEach((row, r) => {
      if (row.born && this.caseParts[r]) { this.caseParts[r].born.snap(0); this.caseParts[r].born.t = 1 }
    })
    // livres arrivés depuis la dernière fois (ils se poseront) ; au tout premier affichage, tous se posent
    const ids = new Set()
    rowsData.forEach(row => row.books.forEach(b => { if (!b.placeholder) ids.add(b.id) }))
    this.intro = this.knownIds == null
    this.freshIds = new Set()
    if (!this.intro) for (const id of ids) if (!this.knownIds.has(id)) this.freshIds.add(id)
    this.knownIds = ids
    this._computeBases()
    this._updateVisible(true)
    this._updateDoorTargets()
    this.intro = false
    this.kick()
  }

  /** Place de chaque livre du mur (calculée même pour les étagères hors écran). */
  _computeBases() {
    if (!this.layout || !this.rowsData) return
    const { CW } = this.layout
    const cb = Math.cos(BETA), sb = Math.sin(BETA)
    this.bases = new Map()
    this.rowEnds = []
    this.rowsData.forEach((row, r) => {
      const y0 = this.rowBase(r)
      const items = row.books.map(b => (b.placeholder ? { ph: true, t: AVG_T * 1.2, d: 0.6 } : { b, ...bookDims(b) }))
      let need = 0
      items.forEach((it, i) => { need += i ? (items[i - 1].t + it.t) / (2 * cb) : 0 })
      const first = items[0] ? (items[0].t * cb + items[0].d * sb) / 2 : 0
      const lastExt = items.length ? (items[items.length - 1].t * cb + items[items.length - 1].d * sb) / 2 : 0
      const avail = CW - PADX - 0.12 - first - lastExt - need
      const gap = items.length > 1 ? Math.max(0.012, Math.min(GAP, avail / (items.length - 1))) : GAP
      let x = -CW / 2 + PADX + first
      items.forEach((it, i) => {
        if (i) x += (items[i - 1].t + it.t) / (2 * cb) + gap
        if (it.ph) return
        const zSpine = SD / 2 - 0.045
        this.bases.set(it.b.id, { x, y: y0 + it.h / 2, z: zSpine - (it.d / 2) * cb, row: r })
      })
      this.rowEnds[r] = items.length ? x + lastExt : -CW / 2 + PADX
    })
  }

  /** Rayons proches de l'écran (livres en 3D) et rayons bien visibles (portes ouvertes). */
  _updateVisible(force = false) {
    if (!this.viewNow || !this.rowsData || !this.caseParts) return
    const { yc, h } = this.viewNow
    const m = RH + PT
    const live = new Set(), inView = new Set()
    let center = 0, best = Infinity
    for (let r = 0; r < this.rowCount; r++) {
      const lo = this.rowBase(r) - PT, hi = this.rowBase(r) + RH
      if (hi > yc - h / 2 - m && lo < yc + h / 2 + m) live.add(r)
      if (hi > yc - h / 2 + 0.3 * RH && lo < yc + h / 2 - 0.3 * RH) inView.add(r)
      const c = this.rowBase(r) + RH / 2
      if (Math.abs(c - yc) < best) { best = Math.abs(c - yc); center = r }
    }
    const same = (a, b) => a && a.size === b.size && [...a].every(x => b.has(x))
    if (force || !same(this.liveRows, live)) { this.liveRows = live; this._materialize() }
    if (force || !same(this.inView, inView)) { this.inView = inView; this._updateDoorTargets() }
    if (center !== this.centerRow) { this.centerRow = center; this.cb.onCenter?.(center) }
  }

  /** Crée les livres des rayons proches de l'écran, libère les autres. */
  _materialize() {
    if (!this.rowsData || !this.liveRows) return
    const want = new Map()
    this.rowsData.forEach((row, r) => {
      if (!this.liveRows.has(r)) return
      row.books.forEach(b => { if (!b.placeholder) want.set(b.id, b) })
    })
    if (this.drag) want.set(this.drag.id, this.drag.entry.book)
    for (const e of [...this.books.values()]) if (!want.has(e.id)) this._disposeBook(e)
    let order = 0
    for (const [id, b] of want) {
      let e = this.books.get(id)
      const created = !e
      if (!e) e = this._makeBook(b)
      e.book = b
      this._syncBookmark(e)
      const base = this.bases.get(id)
      if (!base) continue
      e.base = { x: base.x, y: base.y, z: base.z }
      e.row = base.row
      if (created) {
        const drop = this.intro || this.freshIds.has(id) ? Math.min(0.2, RH - e.h - 0.02) : 0
        e.x.snap(base.x); e.z.snap(base.z); e.yaw.snap(-BETA)
        e.y.snap(base.y + drop)
        if (drop) { e.y.t = base.y; e.delay = this.intro ? Math.min(order, 40) * 16 : 0 }
        e.wrap.position.set(e.x.v, e.y.v, e.z.v)
        e.mesh.rotation.y = e.yaw.v
        order++
      }
      if (!(this.drag && id === this.drag.id)) e.x.t = base.x
    }
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
      const end = (this.rowEnds?.[r] ?? -CW / 2) + CW / 2 + 0.1
      const empty = count === 0
      const fullyOpen = !empty && end > CW - 0.25
      const open = this.doorsOpen && !!this.inView?.has(r)
      part.left.t = !open || empty ? half : -0.2
      part.right.t = !open || empty ? half : fullyOpen ? CW + 0.3 : end
    })
    this.kick()
  }

  // ---- Interactions ----------------------------------------------------------------------------
  _bindEvents() {
    const el = this.renderer.domElement
    this.pts = new Map()
    this.onHoverMove = e => {
      const rc = el.getBoundingClientRect()
      this.pointer = { x: e.clientX - rc.left, y: e.clientY - rc.top, cx: e.clientX, cy: e.clientY }
      this.ndc.set((this.pointer.x / rc.width) * 2 - 1, -(this.pointer.y / rc.height) * 2 + 1)
      this.pointerDirty = true
      this.kick()
    }
    this.onWinMove = e => {
      if (this.pts.has(e.pointerId)) this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      // pincement à deux doigts : vue d'ensemble / vue rapprochée
      if (this.pinch && this.pts.size >= 2) {
        const [a, b] = [...this.pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        this.zoom.t = clamp(this.pinch.z + (d / this.pinch.d - 1) * 1.4, 0, 1)
        this.cb.onZoom?.(this.zoom.t)
        this.kick()
        return
      }
      if (this.drag) { e.preventDefault(); this.onHoverMove(e); this._dragMove(); this._edgeFrom(e.clientY); return }
      const p = this.press
      if (!p) return
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y)
      if (!p.moved && dist > (p.type === 'mouse' ? 6 : 10)) {
        p.moved = true
        clearTimeout(p.timer)
        if (p.id && p.type === 'mouse' && this.cb.canDrag?.() && this.zoom.t > 0.5) { this.onHoverMove(e); this._startDrag(); return }
        // sinon on fait défiler le mur (on le « tire » du doigt ou de la souris)
        p.pan = true
        this.panning = { y: e.clientY, scroll: this.scroll.v, lastY: e.clientY, lastT: performance.now(), vel: 0 }
        el.style.cursor = 'grabbing'
        this._setHover(null)
      }
      if (p.pan && this.panning) {
        e.preventDefault()
        const pn = this.panning
        const now = performance.now()
        const v = (e.clientY - pn.lastY) / Math.max(1, now - pn.lastT)
        pn.vel = pn.vel * 0.6 + v * 0.4
        pn.lastY = e.clientY; pn.lastT = now
        this.scroll.snap(this._clampScroll(pn.scroll + (e.clientY - pn.y) * this._upp() / Math.max(0.35, this.zoom.v), true))
        this.camDirty = true
        this.kick()
      }
    }
    this.onLeave = () => { this.pointer = null; this.pointerDirty = true; this._setHover(null); this.kick() }
    this.onDown = e => {
      if (e.button > 0 || this.cb.isLocked?.()) return
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pts.size === 2) {
        const [a, b] = [...this.pts.values()]
        this.pinch = { d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), z: this.zoom.t }
        if (this.press) clearTimeout(this.press.timer)
        this.press = null; this.panning = null
        return
      }
      const overview = this.zoom.t <= 0.5
      const hit = overview ? null : this._pick(e)
      this.press = { id: hit, x: e.clientX, y: e.clientY, type: e.pointerType, overview }
      if (hit && e.pointerType !== 'mouse' && this.cb.canDrag?.()) {
        this.press.timer = setTimeout(() => { if (this.press && !this.press.moved && !this.drag) this._startDrag() }, 320)
      }
    }
    this.onUp = e => {
      this.pts.delete(e.pointerId)
      if (this.pinch) { if (this.pts.size < 2) this.pinch = null; return }
      const press = this.press
      this.press = null
      if (press?.timer) clearTimeout(press.timer)
      this.edgeVel = 0
      if (this.drag) { this._endDrag(true); return }
      if (!press) return
      el.style.cursor = ''
      if (press.pan && this.panning) {
        // élan : le mur continue un peu sur sa lancée
        const fling = this.panning.vel * 280 * this._upp()
        this.scroll.t = this._clampScroll(this.scroll.v + fling)
        this.panning = null
        this.kick()
        return
      }
      if (press.moved) return
      if (press.overview) { this._zoomAt(e); return }
      const hit = this._pick(e)
      if (hit && hit === press.id) this._open(hit)
    }
    this.onCancel = e => {
      this.pts.delete(e.pointerId); this.pinch = null
      if (this.drag) this._endDrag(false)
      this.press = null; this.panning = null; this.edgeVel = 0
    }
    this.onWheel = e => {
      if (this.cb.isLocked?.() || this.drag) return
      e.preventDefault()
      // pincement du pavé tactile (ou ctrl + molette) : zoom
      if (e.ctrlKey) { this.zoom.t = clamp(this.zoom.t - e.deltaY * 0.012, 0, 1); this.cb.onZoom?.(this.zoom.t); this.kick(); return }
      if (this.zoom.t < 0.5) return
      const d = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY
      this.scroll.t = this._clampScroll(this.scroll.t - d * this._upp() * 0.9)
      this.kick()
    }
    el.addEventListener('pointermove', this.onHoverMove)
    window.addEventListener('pointermove', this.onWinMove, { passive: false })
    el.addEventListener('pointerleave', this.onLeave)
    el.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onCancel)
    el.addEventListener('wheel', this.onWheel, { passive: false })
  }

  /** En vue d'ensemble : un clic rapproche la caméra de l'étagère visée. */
  _zoomAt(e) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    this.ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1)
    const q = this._frontPoint(SD / 2)
    if (q) for (let r = 0; r < this.rowCount; r++) {
      const y0 = this.rowBase(r)
      if (q.y >= y0 - PT && q.y <= y0 + RH) { this.scrollToRow(r); return }
    }
    this.setZoom(true)
  }

  _pick(e) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    this.ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const meshes = [...this.books.values()].filter(b => !b.waiting && (!this.drag || b.id !== this.drag.id)).map(b => b.mesh)
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

  /** Rayon et position d'insertion sous un point de l'écran (livre venu du panier). */
  targetAt(cx, cy) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    if (cx < rc.left || cx > rc.right || cy < rc.top || cy > rc.bottom || !this.rowsData) return null
    this.ndc.set(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1)
    const q = this._frontPoint(SD / 2)
    if (!q) return null
    for (let r = 0; r < this.rowCount; r++) {
      const y0 = this.rowBase(r)
      if (q.y < y0 - PT || q.y > y0 + RH) continue
      const row = this.rowsData[r]
      if (!row) return null
      const xs = row.books.filter(b => !b.placeholder).map(b => this.bases.get(b.id)?.x ?? 0)
      return { row: r, index: xs.filter(x => x < q.x).length }
    }
    return null
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
    const q = this._frontPoint(SD / 2)
    let target = null
    if (q) {
      for (let r = 0; r < this.rowCount; r++) {
        const y0 = this.rowBase(r)
        if (q.y < y0 - PT || q.y > y0 + RH) continue
        const row = this.rowsData[r]
        if (!row) break
        const xs = row.books.filter(b => !b.placeholder && b.id !== d.id).map(b => this.bases.get(b.id)?.x ?? 0)
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
    this.edgeVel = 0
    document.body.classList.remove('is-dragging')
    this.cb.onDragEnd?.(d.id, commit ? d.target : null)
    d.entry.yaw.t = -BETA
    const base = this.bases.get(d.id)
    if (base) d.entry.x.t = base.x
    this._materialize()
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
      if (e.id === this.spotId) { lift += 0.12; pull += 0.24 }
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

  /** Repositionne les étiquettes des planches (calque HTML) après un rendu React. */
  refreshOverlay() { this._emitOverlay() }

  _frame = now => {
    if (this.disposed) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    let moving = false
    const sub = 4, h = dt / sub

    // défilement automatique (glisser-déposer près des bords)
    if (this.edgeVel && (this.drag || this.extActive)) {
      this.scroll.t = this._clampScroll(this.scroll.t + this.edgeVel * dt)
      moving = true
    }
    // caméra : défilement et zoom
    if (!this.scroll.done || !this.zoom.done || this.camDirty) {
      for (let i = 0; i < sub; i++) { this.scroll.step(h); this.zoom.step(h) }
      this.camDirty = false
      this._placeCamera()
      this._updateVisible()
      this.pointerDirty = true
      moving = true
      if (this.edgeVel && this.drag) this._dragMove()
      else if (this.edgeVel && this.extActive) this.cb.onAutoScroll?.()
    }

    const ptrChanged = this.pointerDirty
    this.pointerDirty = false
    const near = this.zoom.v > 0.6
    if (ptrChanged && this.pointer && !this.drag && !this.panning && near) {
      this.raycaster.setFromCamera(this.ndc, this.camera)
      const meshes = [...this.books.values()].filter(b => !b.waiting).map(b => b.mesh)
      const doors = this.caseParts?.flatMap(p => [p.doorL, p.doorR]) || []
      const hits = this.raycaster.intersectObjects([...meshes, ...doors], false)
      const top = hits[0]?.object
      this._setHover(top && !doors.includes(top) ? top.userData.id : null)
    } else if (!near && this.hoverId) this._setHover(null)
    if (ptrChanged || this.wasWaving) this._wave()
    this.wasWaving = !!this.pointer && near

    for (const e of this.books.values()) {
      if (e.waiting) { e.wrap.position.set(e.x.v, e.y.v, e.z.v); continue }
      if (e.delay > 0) { e.delay -= dt * 1000; moving = true; e.wrap.position.set(e.x.v, e.y.v, e.z.v); continue }
      for (let i = 0; i < sub; i++) { e.x.step(h); e.y.step(h); e.z.step(h); e.yaw.step(h) }
      e.wrap.position.set(e.x.v, e.y.v, e.z.v)
      e.mesh.rotation.y = e.yaw.v
      if (e.mark && e.markGrow) {
        const s = Math.min(1, e.mark.scale.y + dt * 3.2)
        e.mark.scale.y = s < 1 ? s : 1
        if (s >= 1) e.markGrow = false; else moving = true
      }
      if (!(e.x.done && e.y.done && e.z.done && e.yaw.done)) moving = true
    }
    if (this.caseParts) {
      const { CW } = this.layout
      const half = CW / 2 + 0.01
      for (const part of this.caseParts) {
        for (let i = 0; i < sub; i++) { part.left.step(h); part.right.step(h); part.born.step(h) }
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
    if (moving || this.drag || this.pointerDirty || this.panning) requestAnimationFrame(this._frame)
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

  /** Étiquettes des planches : positionnées directement (sans repasser par React). */
  _emitOverlay() {
    if (!this.caseParts || !this.cb.labelEl || !this.layout) return
    const { CW } = this.layout
    for (let r = 0; r < this.rowCount; r++) {
      const el = this.cb.labelEl(r)
      if (!el) continue
      tmpV.set(-CW / 2 + 0.1, this.rowBase(r) - PT / 2, SD / 2 + 0.04).project(this.camera)
      const x = (tmpV.x + 1) / 2 * this.w, y = (1 - tmpV.y) / 2 * this.h
      const show = y > -10 && y < this.h + 10 && this.zoom.v > 0.25
      el.style.visibility = show ? 'visible' : 'hidden'
      if (show) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateY(-50%)`
    }
  }

  dispose() {
    this.disposed = true
    clearTimeout(this.rebuildTimer)
    clearTimeout(this.spotTimer)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.onHoverMove)
    window.removeEventListener('pointermove', this.onWinMove)
    el.removeEventListener('pointerleave', this.onLeave)
    el.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onCancel)
    el.removeEventListener('wheel', this.onWheel)
    for (const e of [...this.books.values()]) this._disposeBook(e)
    this.renderer.dispose()
    el.remove()
  }
}
