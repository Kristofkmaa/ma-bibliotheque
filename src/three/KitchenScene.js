import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { noTouchSelect } from './webgl'

/**
 * La cuisine en maquette, comme le salon : un plancher épais, quatre murs (celui qui est entre
 * nous et la pièce s'abaisse), vue de trois quarts ; on la fait tourner du doigt.
 * Contre le mur du fond : un mur carrelé, un plan de travail, un frigo dont la porte s'ouvre, des
 * placards hauts qui s'ouvrent, une tablette (l'appli de recettes) et une liste de courses
 * aimantée sur le frigo. Ce qu'on a rangé apparaît vraiment sur les étagères (des pictogrammes).
 *   focus('frigo' | 'placard' | 'tablette' | 'courses' | null) : la caméra y va, les portes s'ouvrent
 *   setPantry(items) : les ingrédients sur les étagères ; setTablet(titre, image) : l'écran de la tablette
 * Rappels : onHover(label | null, x, y), onTap(kind), onArrive(kind).
 */

const COL = {
  wall: '#EEE7DC', floorA: '#B4573A', floorB: '#C26A49', grout: '#E8DCCB',
  fridge: '#EAE4D6', fridgeIn: '#F7F6F2', brass: '#B8925A', front: '#5F7A6A', frontHi: '#6E8B7A',
  counter: '#E6DCCB', oak: '#C99B67', oakIn: '#D9B58A', plinth: '#3B3A36', steel: '#C9CCCF',
}
const FR = { x: -1.62, w: 0.8, h: 1.92, d: 0.7 }          // le frigo
const CAB = { x0: -1.08, n: 3, w: 0.8, y0: 1.5, h: 0.72, d: 0.36 } // les placards hauts
const COUNTER = { x0: -1.14, x1: 2.4, h: 0.9, d: 0.62 }
const TAB = { x: 0.32, z: 0.34 }                          // la tablette
// la pièce (maquette) : le coin cuisine ci-dessus est construit contre le mur du fond (repère « local »,
// mur en z = 0), puis posé dans la pièce par ROOT_OFF
const R = 2.3, H = 2.7, T = 0.12, FT = 0.2
const ROOT_OFF = new THREE.Vector3(-0.2, 0, -R)
const AZ0 = 0.5, EL0 = 0.52, AZ_LIM = [-1.05, 1.05], EL_LIM = [0.32, 0.92]
const TARGET0 = new THREE.Vector3(0, 0.85, 0)
const FOV_ROOM = 30
/** La vue habituelle de la cuisine (pour le carrousel des pièces). */
export const KITCHEN_VIEW = { az: AZ0, el: EL0 }

class Spring {
  constructor(v = 0, k = 90, damp = 1) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.c = 2 * Math.sqrt(k) * damp }
  step(dt) { const a = this.k * (this.t - this.v) - this.c * this.vel; this.vel += a * dt; this.v += this.vel * dt }
  get done() { return Math.abs(this.t - this.v) < 1e-4 && Math.abs(this.vel) < 1e-3 }
  snap(v) { this.v = this.t = v; this.vel = 0 }
}
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function canvasTex(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}
let seed = 7
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

// zellige vert sauge : des carreaux un peu irréguliers, chacun sa nuance, joints clairs
function zelligeTexture() {
  seed = 21
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = COL.grout; g.fillRect(0, 0, w, h)
    const n = 12, s = w / n
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const l = 0.86 + rand() * 0.22
      const c = new THREE.Color('#8FAE9B').multiplyScalar(l)
      const gr = g.createLinearGradient(x, y, x + s, y + s)
      gr.addColorStop(0, '#' + c.clone().multiplyScalar(1.12).getHexString())
      gr.addColorStop(0.55, '#' + c.getHexString())
      gr.addColorStop(1, '#' + c.clone().multiplyScalar(0.9).getHexString())
      g.fillStyle = gr
      g.beginPath(); g.roundRect(x + 3, y + 3, s - 6, s - 6, 5); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.18)'
      g.beginPath(); g.ellipse(x + s * (0.25 + rand() * 0.3), y + s * (0.2 + rand() * 0.2), s * 0.22, s * 0.08, -0.5, 0, Math.PI * 2); g.fill()
    }
  }, { repeat: true })
}
// tomettes : des hexagones de terre cuite
function tometteTexture() {
  seed = 4
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = COL.grout; g.fillRect(0, 0, w, h)
    const r = 32, dx = r * Math.sqrt(3), dy = r * 1.5
    for (let row = -1; row * dy < h + r; row++) for (let col = -1; col * dx < w + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy
      g.beginPath()
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; g[i ? 'lineTo' : 'moveTo'](cx + (r - 2.5) * Math.cos(a), cy + (r - 2.5) * Math.sin(a)) }
      g.closePath()
      const c = new THREE.Color(rand() > 0.5 ? COL.floorA : COL.floorB).multiplyScalar(0.92 + rand() * 0.16)
      g.fillStyle = '#' + c.getHexString(); g.fill()
    }
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(60,25,10,${rand() * 0.06})`; g.fillRect(rand() * w, rand() * h, 2, 2) }
  }, { repeat: true })
}
function woodTexture(base) {
  seed = 9
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h)
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(90,55,25,${0.04 + rand() * 0.07})`; g.lineWidth = 1 + rand() * 2
      const y = rand() * h; g.beginPath(); g.moveTo(0, y)
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 3)
      g.stroke()
    }
  }, { repeat: true })
}
// la liste de courses aimantée sur le frigo
function noteTexture(lines) {
  return canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = '#FFFDF6'; g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(70,110,170,0.25)'; g.lineWidth = 2
    for (let y = 92; y < h; y += 36) { g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke() }
    g.fillStyle = '#C0392B'; g.font = 'italic 600 34px Georgia, serif'; g.fillText('Courses', 22, 66)
    g.fillStyle = '#2C3E66'; g.font = 'italic 26px Georgia, serif'
    ;(lines.length ? lines : ['…']).slice(0, 6).forEach((t, i) => g.fillText('· ' + t.slice(0, 16), 22, 86 + 36 * (i + 1) - 8))
  })
}
// un pictogramme d'ingrédient, détouré (gardé une fois pour toutes)
const emojiCache = new Map()
function emojiTexture(e) {
  if (emojiCache.has(e)) return emojiCache.get(e)
  const t = canvasTex(128, 128, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = '104px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
    g.fillText(e, w / 2, h / 2 + 6)
  })
  emojiCache.set(e, t)
  return t
}

export default class KitchenScene {
  constructor(container, cb = {}) {
    this.cb = cb
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

    this.camera = new THREE.PerspectiveCamera(FOV_ROOM, 1, 0.05, 80)
    this.hits = []                 // ce qu'on peut toucher (userData.kind)
    this.anims = []                // portes : { obj, spring, open, closed }
    this.view = null               // vue actuelle : null (toute la cuisine) ou une partie
    this.az = new Spring(AZ0, 40, 1)
    this.el = new Spring(EL0, 40, 1)
    this.dist = 12
    this.root = new THREE.Group(); this.root.position.copy(ROOT_OFF)
    this.fly = null
    this.hover = null
    this.items = { frigo: new THREE.Group(), placard: new THREE.Group(), door: new THREE.Group() }
    this.disposables = []

    this._build()
    this._bind()
    this.resize()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this._place(this._frame(null), true)
    this.renderer.shadowMap.needsUpdate = true
    this.kick()
  }

  // ---- Construction ----------------------------------------------------------------------------
  _mat(o) { const m = new THREE.MeshStandardMaterial(o); this.disposables.push(m); return m }
  _box(w, h, d, mat, r = 0, seg = 3) {
    const geo = r ? new RoundedBoxGeometry(w, h, d, seg, r) : new THREE.BoxGeometry(w, h, d)
    this.disposables.push(geo)
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = true; m.receiveShadow = true
    return m
  }
  _tag(obj, kind) { obj.traverse(o => { if (o.isMesh) { o.userData.kind = kind; this.hits.push(o) } }) }

  _build() {
    const S = this.scene
    // la lumière : un ciel doux et un « soleil » haut, devant à gauche (comme le salon)
    S.add(new THREE.HemisphereLight('#FFF7EC', '#B9A28A', 1.15))
    const sun = new THREE.DirectionalLight('#FFF1DC', 1.9)
    sun.position.set(-2.4, 6.4, 4.4)
    sun.target.position.set(0, 0.4, 0)
    sun.castShadow = true
    sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048)
    Object.assign(sun.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 16 })
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025; sun.shadow.radius = 4
    const fill = new THREE.DirectionalLight('#E8EEFF', 0.35); fill.position.set(5, 2.5, 3)
    S.add(sun, sun.target, fill)

    this._buildShell()
    S.add(this.root)
    // la crédence en zellige, contre le mur du fond
    const zt = zelligeTexture(); zt.repeat.set((COUNTER.x1 - COUNTER.x0) / 1.4, 0.58 / 0.7)
    const spl = new THREE.Mesh(new THREE.PlaneGeometry(COUNTER.x1 - COUNTER.x0, 0.6), this._mat({ map: zt, roughness: 0.25, metalness: 0.02 }))
    spl.position.set((COUNTER.x0 + COUNTER.x1) / 2, COUNTER.h + 0.3, 0.003); spl.receiveShadow = true; this.root.add(spl)
    this._buildCounter()
    this._buildFridge()
    this._buildCabinets()
    this._buildTablet()
    this._buildWindow()
    this._buildDecor()
    this._buildRoomDecor()
    this.root.add(this.items.frigo, this.items.placard)
  }

  // ---- La pièce : le socle, le sol, les murs ---------------------------------------------------
  _buildShell() {
    const S = this.scene
    const slab = this._box(2 * R + 2 * T, FT, 2 * R + 2 * T, this._mat({ map: woodTexture('#CDBB9F'), roughness: 0.75 }), 0.03, 3)
    slab.position.set(0, -FT / 2, 0); slab.castShadow = false; S.add(slab)
    const ft = tometteTexture(); ft.repeat.set(2.3, 2.3)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), this._mat({ map: ft, roughness: 0.8 }))
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; floor.receiveShadow = true; S.add(floor)
    // ombre douce sous la maquette
    const cs = canvasTex(256, 256, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w / 2)
      gr.addColorStop(0, 'rgba(40,30,20,0.38)'); gr.addColorStop(1, 'rgba(40,30,20,0)')
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
    })
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), new THREE.MeshBasicMaterial({ map: cs, transparent: true, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -FT - 0.05; S.add(shadow)
    this.disposables.push(shadow.material)

    // quatre murs : celui qui est entre la caméra et la pièce s'abaisse
    this.walls = []
    const wallMat = this._mat({ color: COL.wall, roughness: 0.95 })
    const sideMat = this._mat({ color: '#E7DECF', roughness: 0.95 })
    const baseMat = this._mat({ color: '#F4EFE6', roughness: 0.7 })
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
    wall('back', new THREE.Vector3(0, 0, -1), wallMat, 'x')
    wall('front', new THREE.Vector3(0, 0, 1), wallMat, 'x')
    this.leftWall = wall('left', new THREE.Vector3(-1, 0, 0), sideMat, 'z')
    this.rightWall = wall('right', new THREE.Vector3(1, 0, 0), sideMat, 'z')
  }

  // ---- Le reste de la pièce : la table, les étagères ouvertes, un tapis, une plante ------------
  _buildRoomDecor() {
    const S = this.scene
    const oak = this._mat({ map: woodTexture(COL.oak), roughness: 0.5 })
    const dark = this._mat({ color: '#6B4A31', roughness: 0.6 })
    // un tapis rayé devant le plan de travail
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.8), this._mat({
      map: canvasTex(512, 160, (g, w, h) => {
        g.fillStyle = '#F1E7D6'; g.fillRect(0, 0, w, h)
        const st = ['#B4573A', '#F1E7D6', '#5F7A6A', '#F1E7D6', '#D9A93A', '#F1E7D6']
        for (let x = 0, i = 0; x < w; x += 18, i++) { g.fillStyle = st[i % st.length]; g.fillRect(x, 10, 9, h - 20) }
        g.strokeStyle = '#B4573A'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6)
      }), roughness: 1,
    }))
    rug.rotation.x = -Math.PI / 2; rug.position.set(0.35, 0.006, -R + 1.08); rug.receiveShadow = true; S.add(rug)

    // la table ronde et ses deux chaises
    const TX = -1.05, TZ = 0.95
    const table = new THREE.Group(); table.position.set(TX, 0, TZ); S.add(table)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 48), oak); top.position.y = 0.74; top.castShadow = top.receiveShadow = true; table.add(top)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.7, 20), dark); leg.position.y = 0.37; leg.castShadow = true; table.add(leg)
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.03, 32), dark); foot.position.y = 0.015; foot.castShadow = true; table.add(foot)
    // un vase de fleurs sur la table
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 20), this._mat({ color: '#5F7A6A', roughness: 0.3 }))
    vase.position.set(0.06, 0.84, -0.04); vase.castShadow = true; table.add(vase)
    seed = 12
    const petals = [this._mat({ color: '#F3D36B', roughness: 0.6 }), this._mat({ color: '#F5F0E6', roughness: 0.6 }), this._mat({ color: '#D9776A', roughness: 0.6 })]
    for (let i = 0; i < 7; i++) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 5), this._mat({ color: '#5D7E4A' }))
      const a = rand() * Math.PI * 2, r = 0.02 + rand() * 0.03
      st.position.set(0.06 + Math.cos(a) * r, 0.98, -0.04 + Math.sin(a) * r); st.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); table.add(st)
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), petals[i % 3])
      fl.position.set(0.06 + Math.cos(a) * r * 2.6, 1.09 + rand() * 0.04, -0.04 + Math.sin(a) * r * 2.6); fl.castShadow = true; table.add(fl)
    }
    const chair = (a) => {
      const c = new THREE.Group()
      c.position.set(TX + Math.sin(a) * 0.68, 0, TZ + Math.cos(a) * 0.68); c.rotation.y = a
      const seat = this._box(0.42, 0.04, 0.42, oak, 0.015, 2); seat.position.y = 0.46; c.add(seat)
      for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.46, 10), dark); l.position.set(x, 0.23, z); l.castShadow = true; c.add(l)
      }
      const back = this._box(0.42, 0.34, 0.03, oak, 0.012, 2); back.position.set(0, 0.68, 0.2); back.rotation.x = 0.08; c.add(back)
      for (const x of [-0.17, 0.17]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 10), dark); p.position.set(x, 0.66, 0.2); p.castShadow = true; c.add(p) }
      S.add(c)
    }
    chair(Math.PI * 0.18); chair(Math.PI * 0.82 + Math.PI)

    // le mur de gauche : des étagères ouvertes (bocaux, livres de cuisine, une plante)
    const shelves = this.leftWall.decor
    const glass = this._mat({ color: '#EAF4F2', roughness: 0.05, transparent: true, opacity: 0.45 })
    const fills = ['#E9D9B8', '#B4573A', '#F4EFE4', '#6E4B2A', '#D9A93A']
    for (const [y, z0] of [[1.32, -0.95], [1.72, -0.95]]) {
      const plank = this._box(0.24, 0.035, 1.25, oak, 0.008, 2); plank.position.set(-R + 0.12, y, z0 + 0.62); shelves.add(plank)
      for (const z of [0.15, 1.1]) { const br = this._box(0.03, 0.12, 0.03, dark); br.position.set(-R + 0.03, y - 0.07, z0 + z); shelves.add(br) }
    }
    seed = 31
    for (let i = 0; i < 5; i++) {
      const hgt = 0.14 + rand() * 0.08, z = -0.82 + i * 0.13
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, hgt, 16), glass); jar.position.set(-R + 0.12, 1.34 + hgt / 2, z); shelves.add(jar)
      const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, hgt * 0.7, 16), this._mat({ color: fills[i], roughness: 0.9 })); fill.position.set(-R + 0.12, 1.34 + hgt * 0.35 + 0.005, z); fill.castShadow = true; shelves.add(fill)
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.02, 16), oak); lid.position.set(-R + 0.12, 1.34 + hgt + 0.01, z); shelves.add(lid)
    }
    const bookCols = ['#B4573A', '#5F7A6A', '#2F3E5C', '#D9A93A']
    bookCols.forEach((c, i) => { const b = this._box(0.17, 0.24 - i * 0.015, 0.035, this._mat({ color: c, roughness: 0.7 })); b.position.set(-R + 0.12, 1.74 + (0.24 - i * 0.015) / 2, -0.3 + i * 0.04); b.castShadow = true; shelves.add(b) })
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.11, 18), this._mat({ color: '#C26A49', roughness: 0.8 })); pot.position.set(-R + 0.12, 1.79, 0.05); pot.castShadow = true; shelves.add(pot)
    const leafM = this._mat({ color: '#4E7D45', roughness: 0.7 })
    for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), leafM); l.scale.set(1, 0.45, 0.7); l.position.set(-R + 0.12 + (rand() - 0.5) * 0.12, 1.86 + rand() * 0.06, 0.05 + (rand() - 0.5) * 0.14); l.rotation.set(rand(), rand() * 3, rand()); l.castShadow = true; shelves.add(l) }
    shelves.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })

    // le mur de droite : une affiche encadrée
    const art = new THREE.Group(); this.rightWall.decor.add(art)
    const frame = this._box(0.03, 0.78, 0.58, dark, 0.006, 2); frame.position.set(R - 0.016, 1.62, 0.2); art.add(frame)
    const print = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), this._mat({
      map: canvasTex(360, 504, (g, w, h) => {
        g.fillStyle = '#F4E9D6'; g.fillRect(0, 0, w, h)
        g.fillStyle = '#EBC33F'; g.beginPath(); g.ellipse(w / 2, h * 0.42, 92, 78, -0.4, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#5F7A6A'; g.beginPath(); g.ellipse(w / 2 + 70, h * 0.27, 40, 18, -0.7, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#B4573A'; g.font = 'italic 52px Georgia, serif'; g.textAlign = 'center'; g.fillText('Bon', w / 2, h * 0.78); g.fillText('appétit', w / 2, h * 0.88)
      }), roughness: 0.9,
    }))
    print.rotation.y = -Math.PI / 2; print.position.set(R - 0.034, 1.62, 0.2); art.add(print)

    // une grande plante contre le mur de droite
    const bigPot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.36, 24), this._mat({ color: '#EDE7DC', roughness: 0.5 }))
    bigPot.position.set(R - 0.36, 0.18, 0.75); bigPot.castShadow = true; S.add(bigPot)
    seed = 44
    for (let i = 0; i < 16; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), i % 2 ? leafM : this._mat({ color: '#6A9566', roughness: 0.7 }))
      l.scale.set(1, 0.35, 0.55); const a = rand() * Math.PI * 2
      l.position.set(R - 0.36 + Math.cos(a) * (0.1 + rand() * 0.2), 0.5 + rand() * 0.6, 0.75 + Math.sin(a) * (0.1 + rand() * 0.2))
      l.rotation.set(rand() - 0.5, a, rand() - 0.5); l.castShadow = true; S.add(l)
    }
  }

  _buildCounter() {
    const S = this.root
    const { x0, x1, h, d } = COUNTER
    const W = x1 - x0
    const front = this._mat({ color: COL.front, roughness: 0.55 })
    const body = this._box(W, h - 0.12, d - 0.04, this._mat({ color: '#E9E3D8', roughness: 0.8 }))
    body.position.set(x0 + W / 2, (h - 0.12) / 2 + 0.08, (d - 0.04) / 2); S.add(body)
    const plinth = this._box(W - 0.02, 0.08, d - 0.1, this._mat({ color: COL.plinth, roughness: 0.7 }))
    plinth.position.set(x0 + W / 2, 0.04, (d - 0.1) / 2); S.add(plinth)
    // les façades : des tiroirs et des portes vert sauge, des poignées en laiton
    const brass = this._mat({ color: COL.brass, metalness: 0.85, roughness: 0.32 })
    const n = 5, fw = (W - 0.02) / n
    for (let i = 0; i < n; i++) {
      const cx = x0 + 0.01 + fw * (i + 0.5)
      const drawers = i === 1 || i === 3
      const parts = drawers ? [[0.25, 0.65], [0.25, 0.38], [0.28, 0.1]] : [[0.68, 0.1]]
      for (const [ph, py] of parts) {
        const p = this._box(fw - 0.012, ph - 0.012, 0.022, front, 0.006, 2)
        p.position.set(cx, py + ph / 2 + 0.006, d - 0.03); S.add(p)
        const bar = this._box(drawers ? 0.16 : 0.012, drawers ? 0.012 : 0.16, 0.016, brass, 0.005, 2)
        bar.position.set(drawers ? cx : cx + (i % 2 ? -1 : 1) * (fw / 2 - 0.06), drawers ? py + ph - 0.05 : py + ph - 0.14, d - 0.008); S.add(bar)
      }
    }
    // le plan de travail en chêne clair
    const top = this._box(W + 0.02, 0.04, d + 0.02, this._mat({ map: woodTexture(COL.oak), roughness: 0.45 }), 0.008, 2)
    top.position.set(x0 + W / 2, h + 0.02, (d + 0.02) / 2 - 0.01); S.add(top)
    // l'évier et son robinet
    const sx = 1.05
    const sink = this._box(0.5, 0.012, 0.36, this._mat({ color: '#9EA3A7', metalness: 0.9, roughness: 0.25 }))
    sink.position.set(sx, h + 0.042, 0.33); sink.castShadow = false; S.add(sink)
    const steel = this._mat({ color: COL.steel, metalness: 1, roughness: 0.18 })
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 10, 24, Math.PI), steel)
    tube.position.set(sx, h + 0.28, 0.1); tube.castShadow = true; S.add(tube)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.27, 12), steel)
    post.position.set(sx - 0.11, h + 0.17, 0.1); post.castShadow = true; S.add(post)
    // la plaque de cuisson
    const hob = this._box(0.58, 0.012, 0.48, this._mat({
      map: canvasTex(512, 420, (g, w, hh) => {
        g.fillStyle = '#121212'; g.fillRect(0, 0, w, hh)
        g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 3
        for (const [x, y, rr] of [[130, 120, 80], [380, 120, 62], [130, 310, 62], [380, 310, 80]]) { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke() }
      }), roughness: 0.12, metalness: 0.2,
    }))
    hob.position.set(1.9, h + 0.046, 0.33); S.add(hob)
  }

  _buildFridge() {
    const S = this.root
    const { x, w, h, d } = FR
    const g = new THREE.Group(); g.position.set(x, 0, 0)
    const enamel = this._mat({ color: COL.fridge, roughness: 0.28, metalness: 0.05 })
    const inner = this._mat({ color: COL.fridgeIn, roughness: 0.6, emissive: '#FFFFFF', emissiveIntensity: 0 })
    this.fridgeInner = inner
    const t = 0.035
    // la caisse ouverte devant : on voit dedans quand la porte s'ouvre
    const parts = [
      [w, t, d - 0.06, 0, h - t / 2, (d - 0.06) / 2],
      [w, 0.06, d - 0.06, 0, 0.03, (d - 0.06) / 2],
      [t, h, d - 0.06, -w / 2 + t / 2, h / 2, (d - 0.06) / 2],
      [t, h, d - 0.06, w / 2 - t / 2, h / 2, (d - 0.06) / 2],
      [w, h, t, 0, h / 2, t / 2],
    ]
    for (const [bw, bh, bd, px, py, pz] of parts) { const m = this._box(bw, bh, bd, enamel); m.position.set(px, py, pz); g.add(m) }
    // l'intérieur blanc, les clayettes en verre, le bac à légumes, le congélateur fermé
    const back = this._box(w - 2 * t, h - 0.12, 0.01, inner); back.position.set(0, h / 2, t + 0.006); back.castShadow = false; g.add(back)
    const glass = this._mat({ color: '#DDEFF0', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35 })
    this.fridgeShelves = [0.42, 0.76, 1.08]
    for (const y of this.fridgeShelves) { const s = this._box(w - 2 * t - 0.01, 0.008, d - 0.12, glass); s.position.set(0, y, (d - 0.12) / 2 + 0.04); s.castShadow = false; g.add(s) }
    const crisp = this._box(w - 2 * t - 0.03, 0.26, 0.012, this._mat({ color: '#E8F2F2', roughness: 0.1, transparent: true, opacity: 0.45 }))
    crisp.position.set(0, 0.2, d - 0.12); crisp.castShadow = false; g.add(crisp)
    const div = this._box(w - 2 * t, 0.05, d - 0.06, enamel); div.position.set(0, 1.36, (d - 0.06) / 2); g.add(div)
    // la lampe du frigo (s'allume à l'ouverture)
    this.fridgeLamp = new THREE.PointLight('#F4FBFF', 0, 1.6, 1.5)
    this.fridgeLamp.position.set(0, 1.22, d * 0.55); g.add(this.fridgeLamp)

    // la porte du haut (congélateur), fixe, avec la liste de courses aimantée
    const brass = this._mat({ color: COL.brass, metalness: 0.85, roughness: 0.3 })
    const top = this._box(w, h - 1.38, 0.06, enamel, 0.02, 3); top.position.set(0, 1.38 + (h - 1.38) / 2, d - 0.03); g.add(top)
    const th = this._box(0.022, 0.2, 0.03, brass, 0.008, 2); th.position.set(w / 2 - 0.07, 1.48, d + 0.02); g.add(th)
    this.noteMat = this._mat({ map: noteTexture([]), roughness: 0.9 })
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), this.noteMat)
    note.position.set(-0.12, 1.66, d + 0.002); note.rotation.z = 0.04; g.add(note)
    const magnet = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 10), this._mat({ color: '#C0392B', roughness: 0.35 }))
    magnet.position.set(-0.03, 1.785, d + 0.012); magnet.scale.z = 0.5; g.add(magnet)
    this._tag(note, 'courses'); this._tag(magnet, 'courses')

    // la grande porte : charnière à gauche, elle s'ouvre vers nous
    const hinge = new THREE.Group(); hinge.position.set(-w / 2, 0, d); g.add(hinge)
    const door = this._box(w, 1.3, 0.06, enamel, 0.02, 3); door.position.set(w / 2, 0.06 + 0.65, -0.03); hinge.add(door)
    const dIn = this._box(w - 0.08, 1.2, 0.012, inner); dIn.position.set(w / 2, 0.71, -0.066); dIn.castShadow = false; hinge.add(dIn)
    const hd = this._box(0.022, 0.42, 0.03, brass, 0.008, 2); hd.position.set(w - 0.07, 1.12, 0.015); hinge.add(hd)
    // les balconnets de la porte
    const bin = this._mat({ color: '#E3EEF0', roughness: 0.15, transparent: true, opacity: 0.55 })
    this.doorBins = [0.3, 0.68, 1.02]
    for (const y of this.doorBins) { const b = this._box(w - 0.12, 0.07, 0.008, bin); b.position.set(w / 2, y + 0.035, -0.14); b.castShadow = false; hinge.add(b) }
    this.items.door.position.set(0, 0, 0); hinge.add(this.items.door)
    this.anims.push(this.fridgeDoor = { obj: hinge, spring: new Spring(0, 34, 0.9), open: -1.95, closed: 0 })
    S.add(g)
    this.fridge = g
    this._tag(g, 'frigo')
    // la note reste « courses » (étiquetée après coup)
    note.userData.kind = 'courses'; magnet.userData.kind = 'courses'
  }

  _buildCabinets() {
    const S = this.root
    const { x0, n, w, y0, h, d } = CAB
    const carcass = this._mat({ map: woodTexture(COL.oakIn), roughness: 0.6 })
    const front = this._mat({ color: COL.front, roughness: 0.5 })
    const brass = this._mat({ color: COL.brass, metalness: 0.85, roughness: 0.3 })
    this.cabDoors = []
    this.cabShelves = []
    const all = new THREE.Group()
    for (let i = 0; i < n; i++) {
      const cx = x0 + w * (i + 0.5)
      const g = new THREE.Group(); g.position.set(cx, y0, 0)
      const t = 0.018
      for (const [bw, bh, bd, px, py, pz] of [
        [w, t, d, 0, t / 2, d / 2], [w, t, d, 0, h - t / 2, d / 2], [t, h, d, -w / 2 + t / 2, h / 2, d / 2], [t, h, d, w / 2 - t / 2, h / 2, d / 2], [w, h, t, 0, h / 2, t / 2],
        [w - 2 * t, 0.014, d - 0.04, 0, h * 0.5, (d - 0.04) / 2],
      ]) { const m = this._box(bw, bh, bd, carcass); m.position.set(px, py, pz); g.add(m) }
      this.cabShelves.push({ x: cx, ys: [y0 + t, y0 + h * 0.5 + 0.007] })
      // deux portes, chacune à charnière sur son bord extérieur
      for (const side of [-1, 1]) {
        const hinge = new THREE.Group(); hinge.position.set(side * w / 2, 0, d); g.add(hinge)
        const dw = w / 2 - 0.004
        const door = this._box(dw, h - 0.008, 0.02, front, 0.006, 2); door.position.set(-side * dw / 2, h / 2, 0.01); hinge.add(door)
        const frame = this._box(dw - 0.08, h - 0.09, 0.006, this._mat({ color: COL.frontHi, roughness: 0.5 })); frame.position.set(-side * dw / 2, h / 2, 0.022); frame.castShadow = false; hinge.add(frame)
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), brass); knob.position.set(-side * (dw - 0.05), 0.08, 0.035); knob.castShadow = true; hinge.add(knob)
        this.anims.push({ obj: hinge, spring: new Spring(0, 30 + i * 3, 0.9), open: side * 1.75, closed: 0, cab: true })
      }
      all.add(g)
    }
    S.add(all)
    this._tag(all, 'placard')
    // une petite lumière sous les placards (le plan de travail chaleureux)
    const under = new THREE.PointLight('#FFD9A8', 0.6, 2.2, 2)
    under.position.set(x0 + (n * w) / 2, y0 - 0.06, 0.25); S.add(under)
  }

  _buildTablet() {
    const S = this.root
    const g = new THREE.Group(); g.position.set(TAB.x, COUNTER.h + 0.04, TAB.z)
    const stand = this._box(0.16, 0.02, 0.12, this._mat({ map: woodTexture(COL.oak), roughness: 0.5 }), 0.006, 2); stand.position.set(0, 0.01, 0); g.add(stand)
    const tilt = new THREE.Group(); tilt.position.set(0, 0.02, -0.02); tilt.rotation.x = -0.28; g.add(tilt)
    const body = this._box(0.34, 0.24, 0.012, this._mat({ color: '#1C1C1F', roughness: 0.3, metalness: 0.4 }), 0.012, 3); body.position.set(0, 0.12, 0); tilt.add(body)
    this.tabletMat = new THREE.MeshBasicMaterial({ map: this._tabletTex(null, null), toneMapped: false })
    this.disposables.push(this.tabletMat)
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.318, 0.218), this.tabletMat); screen.position.set(0, 0.12, 0.0065); tilt.add(screen)
    this.tablet = g
    S.add(g)
    this._tag(g, 'tablette')
  }
  _tabletTex(title, img) {
    return canvasTex(640, 440, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#FBF6EE'); gr.addColorStop(1, '#F1E7D8')
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
      if (img) {
        const r = Math.max(w / img.width, (h * 0.62) / img.height)
        g.drawImage(img, (w - img.width * r) / 2, 0, img.width * r, img.height * r)
        const sh = g.createLinearGradient(0, h * 0.35, 0, h * 0.62); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)')
        g.fillStyle = sh; g.fillRect(0, 0, w, h * 0.62)
      } else {
        g.fillStyle = '#5F7A6A'; g.fillRect(0, 0, w, h * 0.62)
        g.font = '120px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText('🍲', w / 2, h * 0.31)
      }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'
      g.fillStyle = '#B4573A'; g.font = '700 22px system-ui, sans-serif'; g.fillText('CE SOIR', 30, h * 0.62 + 44)
      g.fillStyle = '#23201C'; g.font = '600 38px Georgia, serif'
      const t = title || 'Qu’est-ce qu’on mange ?'
      g.fillText(t.length > 28 ? t.slice(0, 27) + '…' : t, 30, h * 0.62 + 92)
      g.fillStyle = '#7A7268'; g.font = '24px system-ui, sans-serif'; g.fillText('Touchez pour ouvrir les recettes', 30, h * 0.62 + 132)
    })
  }
  setTablet(title, imageUrl) {
    const apply = img => {
      this.tabletMat.map?.dispose()
      this.tabletMat.map = this._tabletTex(title, img)
      this.tabletMat.needsUpdate = true
      this.kick()
    }
    if (!imageUrl) { apply(null); return }
    const im = new Image(); im.crossOrigin = 'anonymous'
    im.onload = () => apply(im); im.onerror = () => apply(null)
    im.src = imageUrl
  }

  _buildWindow() {
    const S = this.root
    const x = 1.98, y = 1.92, W = 0.9, H = 0.82
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({
      map: canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#CFE3F2'); gr.addColorStop(0.7, '#EAF1EC'); gr.addColorStop(1, '#D9E4C9'); g.fillStyle = gr; g.fillRect(0, 0, w, h) }),
      toneMapped: false,
    }))
    sky.position.set(x, y, 0.004); S.add(sky)
    const frame = this._mat({ color: '#F7F3EC', roughness: 0.6 })
    for (const [bw, bh, px, py] of [[W + 0.06, 0.04, x, y + H / 2], [W + 0.06, 0.05, x, y - H / 2], [0.04, H, x - W / 2, y], [0.04, H, x + W / 2, y], [0.03, H, x, y], [W, 0.025, x, y + 0.08]]) {
      const m = this._box(bw, bh, 0.05, frame); m.position.set(px, py, 0.025); S.add(m)
    }
    const sill = this._box(W + 0.14, 0.03, 0.14, frame); sill.position.set(x, y - H / 2 - 0.035, 0.07); S.add(sill)
    // un pot de basilic sur le rebord
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.1, 18), this._mat({ color: '#C26A49', roughness: 0.8 }))
    pot.position.set(x + 0.22, y - H / 2 + 0.03, 0.07); pot.castShadow = true; S.add(pot)
    const leafM = this._mat({ color: '#4E7D45', roughness: 0.7 })
    seed = 3
    for (let i = 0; i < 14; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), leafM)
      l.scale.set(1, 0.45, 0.7)
      l.position.set(x + 0.22 + (rand() - 0.5) * 0.12, y - H / 2 + 0.1 + rand() * 0.1, 0.07 + (rand() - 0.5) * 0.08)
      l.rotation.set(rand(), rand() * 3, rand()); l.castShadow = true; S.add(l)
    }
  }

  _buildDecor() {
    const S = this.root
    const h = COUNTER.h + 0.04
    // une planche à découper posée contre la crédence
    const board = this._box(0.3, 0.42, 0.022, this._mat({ map: woodTexture('#B98552'), roughness: 0.55 }), 0.03, 3)
    board.position.set(-0.55, h + 0.21, 0.05); board.rotation.x = -0.1; S.add(board)
    // un saladier de citrons
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), this._mat({ color: '#F3EEE6', roughness: 0.35, side: THREE.DoubleSide }))
    bowl.rotation.x = Math.PI; bowl.position.set(-0.2, h + 0.13, 0.36); bowl.castShadow = true; S.add(bowl)
    const lemon = this._mat({ color: '#EBC33F', roughness: 0.55 })
    for (const [dx, dz, dy] of [[-0.05, 0, 0.02], [0.05, 0.02, 0.02], [0, -0.05, 0.03], [0.01, 0.05, 0.06]]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), lemon); l.scale.set(1, 0.85, 0.85)
      l.position.set(-0.2 + dx, h + 0.04 + dy, 0.36 + dz); l.castShadow = true; S.add(l)
    }
    // un pot à ustensiles près de la plaque
    const crock = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.16, 20), this._mat({ color: '#EDE7DC', roughness: 0.4 }))
    crock.position.set(1.45, h + 0.08, 0.14); crock.castShadow = true; S.add(crock)
    const wood = this._mat({ color: '#B98552', roughness: 0.6 })
    for (const [a, b] of [[-0.18, 0.1], [0.12, -0.08], [0.02, 0.16]]) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.34, 8), wood)
      sp.position.set(1.45 + a * 0.12, h + 0.24, 0.14 + b * 0.12); sp.rotation.set(b, 0, a); sp.castShadow = true; S.add(sp)
    }
  }

  // ---- Les ingrédients sur les étagères ---------------------------------------------------------
  setPantry(items) {
    for (const g of Object.values(this.items)) { for (const c of [...g.children]) { g.remove(c); c.geometry?.dispose(); c.material?.dispose() } }
    const plane = new THREE.PlaneGeometry(1, 1)
    this.disposables.push(plane)
    const put = (group, it, x, y, z, s, k) => {
      const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: emojiTexture(it.emoji || '🥣'), transparent: true, alphaTest: 0.08, toneMapped: false, depthWrite: true }))
      m.scale.set(s, s, 1)
      m.position.set(x, y + s * 0.46, z)
      seed = 100 + k; m.rotation.z = (rand() - 0.5) * 0.12
      m.userData.item = it
      group.add(m)
    }
    const fridge = items.filter(i => i.place !== 'placard')
    const pantry = items.filter(i => i.place === 'placard')
    // frigo : les légumes et fruits dans le bac, les sauces dans la porte, le reste sur les clayettes
    const inner = FR.w - 0.1
    const cols = 6, sx = inner / cols, s = this.mobile ? 0.105 : 0.095
    const crisp = fridge.filter(i => i.aisle === 'legumes' || i.aisle === 'fruits')
    const doorIt = fridge.filter(i => i.aisle === 'frais')
    const rest = fridge.filter(i => !crisp.includes(i) && !doorIt.includes(i))
    const slots = []
    for (const y of this.fridgeShelves.slice().reverse()) for (const [z, off] of [[0.5, 0], [0.3, 0.5]]) for (let c = 0; c < cols; c++) slots.push([FR.x - inner / 2 + sx * (c + 0.5 + off * 0.5), y + 0.006, z])
    const crispSlots = []
    for (const [z, off] of [[0.5, 0], [0.3, 0.5]]) for (let c = 0; c < cols; c++) crispSlots.push([FR.x - inner / 2 + sx * (c + 0.5 + off * 0.5), 0.07, z])
    let k = 0
    // ce qui ne tient pas dans le bac monte sur les clayettes, et inversement
    const over = []
    crisp.forEach(it => { const sl = crispSlots.shift(); if (sl) put(this.items.frigo, it, ...sl, s, k++); else over.push(it) })
    ;[...rest, ...over].forEach(it => { const sl = slots.shift(); if (sl) put(this.items.frigo, it, ...sl, s, k++) })
    // les balconnets (dans le repère de la porte : x de 0 à w, z vers l'intérieur)
    const dslots = []
    for (const y of this.doorBins.slice().reverse()) for (let c = 0; c < 5; c++) dslots.push([0.08 + (FR.w - 0.16) * (c + 0.5) / 5, y, -0.11])
    doorIt.forEach(it => { const sl = dslots.shift(); if (sl) put(this.items.door, it, ...sl, s * 0.9, k++) })
    // dans la porte grande ouverte, les pictogrammes se tournent vers nous (sinon on les verrait de profil)
    this.items.door.children.forEach(m => { m.rotation.y = 1.75 })
    // placards : deux niveaux par meuble, une rangée
    const cslots = []
    for (const lvl of [1, 0]) for (const cab of this.cabShelves) for (let c = 0; c < 6; c++) cslots.push([cab.x - CAB.w / 2 + 0.06 + (CAB.w - 0.12) * (c + 0.5) / 6, cab.ys[lvl], 0.2])
    pantry.forEach(it => { const sl = cslots.shift(); if (sl) put(this.items.placard, it, ...sl, s * 1.05, k++) })
    this.kick()
  }
  setShopping(lines) {
    this.noteMat.map?.dispose()
    this.noteMat.map = noteTexture(lines)
    this.noteMat.needsUpdate = true
    this.kick()
  }

  // ---- Caméra ------------------------------------------------------------------------------------
  /** Le cadrage d'une vue : { pos, target, fov }. Sur ordinateur, le panneau est à droite ; au téléphone, en bas. */
  _frame(kind) {
    if (!kind) return this._orbit()
    const asp = this.w / Math.max(1, this.h)
    const mob = this.mobile
    const fov = mob ? 50 : 40
    const tf = Math.tan(THREE.MathUtils.degToRad(fov) / 2)
    const dist = (W, H) => Math.max(H / 2 / tf, W / 2 / (tf * asp))
    let tx, ty, d, lift = 0.12
    if (kind === 'frigo') {
      // (la porte ouverte dépasse à gauche et vers nous : on cadre le frigo et sa porte)
      // téléphone : la feuille couvre le bas ; tout l'intérieur du frigo tient dans le haut de l'écran
      if (mob) { const H = 1.36 / 0.42; d = dist(1.45, H) + 0.66; tx = FR.x - 0.12; ty = 1.42 - H / 2; lift = 0.95 }
      else { const V = 1.5 / 0.66; d = dist(V, 2.25) + 0.55; tx = FR.x - 0.15 + V * 0.17; ty = 0.98; lift = 0.25 }
    } else if (kind === 'courses') {
      if (mob) { d = dist(0.8, 1.7) + 0.7; tx = FR.x - 0.12; ty = 1.66 - 1.7 * 0.24 }
      else { const V = 1.0 / 0.66; d = dist(V, 0.8) + 0.7; tx = FR.x - 0.12 + V * 0.17; ty = 1.62 }
      lift = 0.05
    } else if (kind === 'placard') {
      const cx = CAB.x0 + (CAB.n * CAB.w) / 2
      if (mob) { d = dist(2.5, 2.4) + 0.36; tx = cx; ty = 1.85 - 2.4 * 0.21 }
      else { const V = 2.6 / 0.66; d = dist(V, 1.3) + 0.36; tx = cx + V * 0.17; ty = 1.78 }
      lift = 0.05
    } else {
      d = dist(0.5, 0.42); tx = TAB.x; ty = COUNTER.h + 0.16; lift = 0.18
      return { pos: new THREE.Vector3(tx, ty + lift, TAB.z + 0.06 + d).add(ROOT_OFF), target: new THREE.Vector3(tx, ty, TAB.z).add(ROOT_OFF), fov }
    }
    // (cadrage pensé contre le mur du fond, puis posé dans la pièce)
    return { pos: new THREE.Vector3(tx, ty + lift, d + 0.1).add(ROOT_OFF), target: new THREE.Vector3(tx, ty, 0.1).add(ROOT_OFF), fov }
  }
  /** Toute la maquette, vue de trois quarts (on tourne autour en glissant). */
  _orbit(az = this.az.v, el = this.el.v, d = this.dist) {
    const t = TARGET0
    return { pos: new THREE.Vector3(t.x + Math.sin(az) * Math.cos(el) * d, t.y + Math.sin(el) * d, t.z + Math.cos(az) * Math.cos(el) * d), target: t.clone(), fov: FOV_ROOM }
  }
  /** La distance qui fait tenir toute la maquette à l'écran, sous tous les angles permis. */
  _fitDistance() {
    const pts = []
    for (const x of [-R - T, R + T]) for (const y of [-FT, H + 0.05]) for (const z of [-R - T, R + T]) pts.push(new THREE.Vector3(x, y, z))
    const m = this.mobile ? { top: 0.1, bottom: 0.13, side: 0.03 } : { top: 0.1, bottom: 0.16, side: 0.05 }
    const cam = new THREE.PerspectiveCamera(FOV_ROOM, this.w / Math.max(1, this.h), 0.05, 80)
    const fits = d => {
      for (const az of [AZ_LIM[0], AZ_LIM[0] / 2, 0, AZ0, AZ_LIM[1]]) {
        this.dist = d
        const f = this._orbit(az, EL0)
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
  _place(f, snap = false) {
    if (snap) { this.cam = { pos: f.pos.clone(), target: f.target.clone(), fov: f.fov }; this._applyCam(); return }
    this.fly = { from: { pos: this.cam.pos.clone(), target: this.cam.target.clone(), fov: this.cam.fov }, to: f, t: 0, dur: 1.2 }
    this.kick()
  }
  _applyCam() {
    this.camera.position.copy(this.cam.pos); this.camera.lookAt(this.cam.target)
    if (Math.abs(this.camera.fov - this.cam.fov) > 1e-3) { this.camera.fov = this.cam.fov; this.camera.updateProjectionMatrix() }
  }

  /**
   * Le carrousel des pièces : une pose de caméra imposée ({ az, el, scale, ox, oy, spin }), ou null
   * pour reprendre la main (la vue habituelle de la cuisine). Au fond, on dessine plus léger.
   */
  setCarousel(p) {
    if (!p) {
      if (this.carousel) {
        this.carousel = null
        this.camera.far = 80
        this.camera.clearViewOffset()
        this.az.snap(AZ0); this.el.snap(EL0)
        this.renderer.setPixelRatio(this.dpr)
        this.w = 0; this.resize()
        this._place(this._orbit(), true)
      }
      this.kick()
      return
    }
    if (!this.carousel) {
      // on quitte la pièce : portes fermées, vue d'ensemble, image plus légère
      this.view = null; this.fly = null
      this.fridgeDoor.spring.t = 0
      for (const a of this.anims) if (a.cab) a.spring.t = 0
      this.leftWall.decor.visible = this.leftWall.cut.v > 0.6
      this._setHover(null)
      this.renderer.setPixelRatio(1)
      this.camera.far = 600   // (au fond du carrousel, la pièce est loin)
      this.w = 0; this.resize()
    }
    if (!p.spin) this.cSpin = 0
    this.cSpin ??= 0
    this.carousel = p
    this.kick()
  }
  currentAz() { return this.az.v }
  carouselSpin() { return this.cSpin || 0 }

  /** Aller vers une partie de la cuisine (null : revenir à toute la maquette). */
  focus(kind) {
    this.view = kind
    this.fridgeDoor.spring.t = kind === 'frigo' ? this.fridgeDoor.open : 0
    // devant le frigo, les étagères du mur de gauche passeraient devant la porte ouverte
    this.leftWall.decor.visible = kind !== 'frigo' && kind !== 'courses' && this.leftWall.cut.v > 0.6
    for (const a of this.anims) if (a.cab) a.spring.t = kind === 'placard' ? a.open : 0
    this._setHover(null)
    this._place(this._frame(kind))
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
    if (this.cam) { const f = this._frame(this.view); if (this.fly) this.fly.to = f; else this._place(f, true) }
    this.kick()
  }

  // ---- Toucher, survoler, glisser -----------------------------------------------------------------
  _pick(cx, cy) {
    const rc = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1)
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera)
    const hit = ray.intersectObjects(this.hits, false).find(h => h.object.visible)
    return hit?.object.userData.kind || null
  }
  _setHover(kind, x, y) {
    if (kind === this.hover && kind == null) return
    this.hover = kind
    this.renderer.domElement.style.cursor = kind ? 'pointer' : this.view ? 'default' : 'grab'
    const LABEL = { frigo: 'Le frigo', placard: 'Les placards', tablette: 'Les recettes', courses: 'La liste de courses' }
    this.cb.onHover?.(kind ? LABEL[kind] : null, x, y)
  }
  _bind() {
    const el = this.renderer.domElement
    this.onDown = e => {
      if (e.button > 0) return
      this.press = { x: e.clientX, y: e.clientY, az: this.az.t, el: this.el.t, moved: false, id: e.pointerId }
      el.setPointerCapture?.(e.pointerId)
    }
    this.onMove = e => {
      const p = this.press
      if (!p) { if (e.pointerType === 'mouse') { const k = this._pick(e.clientX, e.clientY); if (k !== this.hover || k) this._setHover(k, e.clientX, e.clientY) } return }
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      if (!p.moved && Math.hypot(dx, dy) > 8) { p.moved = true; this._setHover(null); el.style.cursor = this.view ? 'default' : 'grabbing' }
      if (p.moved && !this.view && !this.fly) {
        // on tourne autour de la maquette (avec un peu d'élastique aux bords)
        const k = 5.2 / Math.max(320, this.w)
        const rub = (v, [lo, hi]) => (v < lo ? lo + (v - lo) * 0.3 : v > hi ? hi + (v - hi) * 0.3 : v)
        this.az.t = rub(p.az - dx * k, AZ_LIM)
        this.el.t = rub(p.el + dy * k * 0.6, EL_LIM)
        this.kick()
      }
    }
    this.onUp = e => {
      const p = this.press
      this.press = null
      if (!p) return
      this.az.t = clamp(this.az.t, ...AZ_LIM); this.el.t = clamp(this.el.t, ...EL_LIM); this.kick()
      if (p.moved) { el.style.cursor = this.view ? 'default' : 'grab'; return }
      const k = this._pick(e.clientX, e.clientY)
      if (k) this.cb.onTap?.(k)
      else if (this.view) this.cb.onTap?.(null)
    }
    this.onLeave = () => { if (!this.press) this._setHover(null) }
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointerleave', this.onLeave)
  }

  // ---- Animation (seulement quand quelque chose bouge) -------------------------------------------
  kick() { if (!this.raf && !this.dead) { this.last = performance.now(); this.raf = requestAnimationFrame(this._loop) } }
  _loop = now => {
    this.raf = 0
    const dt = Math.min(0.25, (now - this.last) / 1000); this.last = now
    const sub = Math.max(1, Math.ceil(dt * 60))   // les ressorts avancent par petits pas, même si l'image est lente
    let busy = false
    if (this.carousel) {
      // sur le carrousel des pièces : la caméra suit la pose donnée (et tourne lentement au fond)
      const p = this.carousel
      if (p.spin) { this.cSpin += p.spin * dt; busy = true }
      const f = this._orbit(p.az + this.cSpin, p.el, this.dist / p.scale)
      this.cam.pos.copy(f.pos); this.cam.target.copy(f.target); this.cam.fov = FOV_ROOM
      this._applyCam()
      this.camera.setViewOffset(this.w, this.h, -p.ox, -p.oy, this.w, this.h)
    } else if (this.fly) {
      const f = this.fly
      f.start ??= now
      f.t = Math.min(1, (now - f.start) / 1000 / f.dur)   // à l'horloge : même lent, le trajet dure ce qu'il doit
      const k = ease(f.t)
      if (!this.view) f.to = this._orbit()           // le retour suit la maquette là où on l'a laissée
      this.cam.pos.lerpVectors(f.from.pos, f.to.pos, k)
      this.cam.target.lerpVectors(f.from.target, f.to.target, k)
      this.cam.fov = f.from.fov + (f.to.fov - f.from.fov) * k
      if (f.t >= 1) { this.fly = null; this.cb.onArrive?.(this.view) } else busy = true
    } else if (!this.view) {
      if (!this.az.done || !this.el.done) {
        for (let i = 0; i < sub; i++) { this.az.step(dt / sub); this.el.step(dt / sub) }
        busy = true
      }
      const f = this._orbit(); this.cam.pos.copy(f.pos); this.cam.target.copy(f.target); this.cam.fov = f.fov
    }
    if (!this.carousel) this._applyCam()
    // les murs : celui qui est entre la caméra et la pièce s'abaisse, les autres se relèvent
    // (pendant qu'on regarde le frigo ou les placards, ils restent comme ils sont)
    if (!this.view || this.fly) {
      const cp = this.camera.position, len = Math.hypot(cp.x, cp.z) || 1
      for (const w of this.walls) {
        if (!this.view) w.cut.t = (w.n.x * cp.x + w.n.z * cp.z) / len > 0.2 ? 0.07 : 1
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
    }
    let doors = false
    for (const a of this.anims) {
      if (a.spring.done) continue
      for (let i = 0; i < sub; i++) a.spring.step(dt / sub)
      a.obj.rotation.y = a.spring.v
      doors = busy = true
    }
    // la lumière du frigo suit l'ouverture de la porte
    const open = clamp(this.fridgeDoor.spring.v / this.fridgeDoor.open, 0, 1)
    this.fridgeLamp.intensity = open * 1.6
    this.fridgeInner.emissiveIntensity = open * 0.35
    if (doors) this.renderer.shadowMap.needsUpdate = true
    this.renderer.render(this.scene, this.camera)
    if (busy || this.press) this.kick()
  }

  /** Un rectangle d'écran de la tablette (pour que l'appli s'ouvre depuis elle). */
  tabletRect() {
    const rc = this.renderer.domElement.getBoundingClientRect()
    const box = new THREE.Box3().setFromObject(this.tablet)
    const pts = [[box.min.x, box.min.y], [box.max.x, box.max.y]].map(([x, y]) => new THREE.Vector3(x, y, box.max.z).project(this.camera))
    const X = pts.map(v => rc.left + ((v.x + 1) / 2) * rc.width), Y = pts.map(v => rc.top + ((1 - v.y) / 2) * rc.height)
    return { left: Math.min(...X), top: Math.min(...Y), width: Math.abs(X[1] - X[0]), height: Math.abs(Y[1] - Y[0]) }
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
