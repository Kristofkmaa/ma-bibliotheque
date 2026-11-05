import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { grainTexture } from './textures'
import { spineColors } from '../lib/bookUtils'
import { TvSeries, TV_W, TV_H } from './tvSeries'
import { resolveSkin } from '../lib/skins'
import { RH, PT, SD, ST } from './BookcaseScene'
import { noTouchSelect } from './webgl'

/**
 * Le salon d'accueil : une pièce en maquette (sol + deux murs), vue de trois quarts,
 * meubles dessinés en code dans le style doux du site. On glisse pour regarder autour,
 * on touche un objet pour qu'il réagisse ; la bibliothèque mène au mur de livres.
 */

const R = 2.4          // demi-côté de la pièce (assez grande : chaque mur a son rôle)
const H = 3.0          // hauteur des murs (la pièce occupe la hauteur d'un téléphone)
const T = 0.12         // épaisseur des murs
const FT = 0.2         // épaisseur du plancher
const FOV = 30
const AZ_MIN = 0.18, AZ_MAX = 1.2, AZ0 = 0.62
const EL_MIN = 0.3, EL_MAX = 0.82, EL0 = 0.58
const TARGET0 = new THREE.Vector3(0, 0.95, 0)

// emplacements (repère de la pièce)
const BOOKCASE = { x: -1.05, z: -R + 0.2, w: 1.62, h: 2.18, d: 0.38 }   // mur du fond, à gauche (face à la caméra)
const FIRE = { x: 0, w: 1.3, d: 0.3, h: 1.38 }                         // centrée sur le mur de devant (loin des livres et du canapé)
// le mur de gauche est tout entier pour le vidéoprojecteur ; celui du fond pour la bibliothèque
const TV = { z: 0 }                         // mur de gauche, en face du canapé : l'image projetée
const SCR = { w: 3.0, h: 1.69, y: 1.68 }    // l'image projetée (16:9), presque tout le mur
const PROJ = { x: 1.0, y: 2.62 }            // le vidéoprojecteur, suspendu au-dessus du canapé
// les meubles en plus grand
const BIG = { sofa: 1.4, fire: 1.3, table: 1.25, lamp: 1.25, plant: 1.35, cabinet: 1, projector: 1.4 }
const SOFA = { x: R - 0.78, z: 0.0 }        // contre le mur de droite, face à l'image
const TABLE = { x: 0.1, z: 0.0 }            // entre le canapé et l'image
const LAMP = { x: R - 0.45, z: 1.82 }       // au bout du canapé
const PLANT = { x: R - 0.45, z: -R + 0.45 } // coin du fond, à droite
const WINDOW = { z: 0, y: 1.82, w: 0.8, h: 1.1 }   // mur de droite, derrière le canapé
const SALON_ROWS = 4                        // la bibliothèque du salon montre au plus 4 étagères

const COL = {
  wallBack: '#ECE3D5', wallLeft: '#E4D9C8', base: '#F4EFE6', slab: '#CDBB9F',
  floor: '#C9A47A', plaster: '#F1EBE0', stone: '#DDD5C7', soot: '#2A2420',
  sofa: '#8FA697', walnut: '#7A5639', oak: '#D2BC97', brass: '#C9A45C',
  cushion1: '#D9A93A', cushion2: '#C9614F', plaid: '#3F57B5',
  leaf1: '#4F7B57', leaf2: '#6A9566', pot: '#C2774E', curtain: '#E2B85A',
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const shortAngle = (a, b) => { const d = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return d }
const isUnder = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false }

class Spring {
  constructor(v = 0, k = 120, damp = 0.6) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.c = 2 * Math.sqrt(k) * damp }
  step(dt) { const a = this.k * (this.t - this.v) - this.c * this.vel; this.vel += a * dt; this.v += this.vel * dt }
  get done() { return Math.abs(this.t - this.v) < 1e-4 && Math.abs(this.vel) < 1e-3 }
  snap(v) { this.v = this.t = v; this.vel = 0 }
}

// ---- Textures dessinées ------------------------------------------------------------------------
function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

let rnd = 1
const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647 }

function parquetTexture() {
  rnd = 11
  return canvasTex(512, 512, (g, w, h) => {
    const bw = 64
    for (let x = 0; x < w; x += bw) {
      let y = -rand() * 200
      while (y < h) {
        const len = 160 + rand() * 180
        const l = 0.9 + rand() * 0.18
        const c = new THREE.Color(COL.floor).multiplyScalar(l)
        g.fillStyle = '#' + c.getHexString()
        g.fillRect(x, y, bw, len)
        g.fillStyle = 'rgba(80, 50, 20, 0.07)'
        for (let k = 0; k < 6; k++) g.fillRect(x + 4 + rand() * (bw - 8), y, 1.2, len)
        g.fillStyle = 'rgba(60, 35, 15, 0.35)'
        g.fillRect(x, y, bw, 2)
        y += len
      }
      g.fillStyle = 'rgba(60, 35, 15, 0.4)'
      g.fillRect(x, 0, 2, h)
    }
  }, { repeat: true })
}

function fabricTexture() {
  rnd = 5
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.03})`; g.fillRect(0, y, w, 1) }
    for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.03})`; g.fillRect(x, 0, 1, h) }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${rand() * 0.18})`; g.fillRect(rand() * w, rand() * h, 2, 1) }
  }, { repeat: true })
}

function rugTexture() {
  return canvasTex(1024, 860, (g, w, h) => {
    g.fillStyle = '#EFE6D6'; g.fillRect(0, 0, w, h)
    rnd = 3
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(120, 95, 60, ${rand() * 0.08})`; g.fillRect(rand() * w, rand() * h, 2, 2) }
    const band = (inset, color, lw) => { g.strokeStyle = color; g.lineWidth = lw; g.strokeRect(inset, inset, w - inset * 2, h - inset * 2) }
    band(40, '#2B47B0', 16); band(76, '#C2774E', 6); band(98, '#2B47B0', 3)
    g.fillStyle = '#C2774E'
    for (let x = 150; x < w - 120; x += 64) { g.beginPath(); g.arc(x, 130, 7, 0, 7); g.fill(); g.beginPath(); g.arc(x, h - 130, 7, 0, 7); g.fill() }
    g.strokeStyle = 'rgba(43, 71, 176, 0.5)'; g.lineWidth = 3
    g.beginPath(); g.ellipse(w / 2, h / 2, 170, 120, 0, 0, 7); g.stroke()
    g.beginPath(); g.ellipse(w / 2, h / 2, 120, 80, 0, 0, 7); g.stroke()
  })
}

function spineBandTexture() {
  return canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h)
    const grad = g.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, 'rgba(255,255,255,0.3)'); grad.addColorStop(0.3, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.25)')
    g.fillStyle = grad; g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(0,0,0,0.35)'
    for (const y of [20, 27, h - 30, h - 23]) g.fillRect(8, y, w - 16, 3)
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(24, 60, w - 48, h - 120)
  })
}

function artTexture(kind) {
  return canvasTex(256, 336, (g, w, h) => {
    g.fillStyle = '#F4EFE6'; g.fillRect(0, 0, w, h)
    if (kind === 0) {
      g.fillStyle = '#2B47B0'; g.beginPath(); g.arc(w * 0.42, h * 0.4, 70, 0, 7); g.fill()
      g.fillStyle = '#C2774E'; g.beginPath(); g.moveTo(40, h - 50); g.lineTo(40, h * 0.62); g.arc(w / 2, h * 0.62, w / 2 - 40, Math.PI, 0); g.lineTo(w - 40, h - 50); g.fill()
      g.fillStyle = '#D9A93A'; g.fillRect(w * 0.58, h * 0.18, 46, 46)
    } else {
      g.fillStyle = '#E2B85A'; g.beginPath(); g.arc(w / 2, h * 0.36, 64, 0, 7); g.fill()
      g.strokeStyle = '#2F5A4B'; g.lineWidth = 7
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(36, h * 0.6 + i * 22); g.bezierCurveTo(w * 0.35, h * 0.55 + i * 22, w * 0.65, h * 0.68 + i * 22, w - 36, h * 0.6 + i * 22); g.stroke() }
    }
  })
}

function skyTexture(mode) {
  return canvasTex(256, 320, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h)
    const stops = {
      jour: ['#9EC3E6', '#CFE2EE', '#F2EAD8'],
      soir: ['#4B5C9A', '#D98C6E', '#F4C58E'],
      nuit: ['#141A33', '#26305A', '#3E4673'],
    }[mode]
    grad.addColorStop(0, stops[0]); grad.addColorStop(0.6, stops[1]); grad.addColorStop(1, stops[2])
    g.fillStyle = grad; g.fillRect(0, 0, w, h)
    rnd = 9
    if (mode === 'nuit') {
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,240,${0.4 + rand() * 0.6})`; g.fillRect(rand() * w, rand() * h * 0.7, 2, 2) }
      g.fillStyle = '#F4EFD8'; g.beginPath(); g.arc(w * 0.7, h * 0.25, 22, 0, 7); g.fill()
      g.fillStyle = stops[0]; g.beginPath(); g.arc(w * 0.7 + 10, h * 0.25 - 6, 20, 0, 7); g.fill()
    } else if (mode === 'soir') {
      g.fillStyle = 'rgba(255, 220, 160, 0.95)'; g.beginPath(); g.arc(w * 0.35, h * 0.72, 30, 0, 7); g.fill()
    } else {
      g.fillStyle = 'rgba(255,255,255,0.85)'
      for (const [x, y, s] of [[60, 80, 1], [190, 130, 0.8], [110, 200, 0.6]]) {
        g.beginPath(); g.ellipse(x, y, 40 * s, 14 * s, 0, 0, 7); g.ellipse(x + 22 * s, y - 8 * s, 26 * s, 14 * s, 0, 0, 7); g.fill()
      }
    }
    // collines au loin
    g.fillStyle = mode === 'nuit' ? '#1C2442' : mode === 'soir' ? '#6E5A78' : '#9DB79A'
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.86)
    g.bezierCurveTo(w * 0.3, h * 0.78, w * 0.55, h * 0.92, w, h * 0.82); g.lineTo(w, h); g.fill()
  })
}

function glowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad; g.fillRect(0, 0, w, h)
  })
}

function contactShadowTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(40,30,20,0.38)'); grad.addColorStop(1, 'rgba(40,30,20,0)')
    g.fillStyle = grad; g.fillRect(0, 0, w, h)
  })
}

// ---- Feu ---------------------------------------------------------------------------------------
const FLAME_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const FLAME_FS = `
uniform float uTime; uniform float uSeed; uniform float uPower;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec2 uv = vUv;
  float t = uTime * 1.7 + uSeed * 10.0;
  float n = fbm(vec2(uv.x * 3.0 + uSeed * 5.0, uv.y * 2.4 - t));
  float y = uv.y;
  float w = 0.4 * (1.0 - pow(y, 1.25)) * (0.7 + 0.6 * n);
  float dx = abs(uv.x - 0.5 + (n - 0.5) * 0.3 * y);
  float shape = smoothstep(w, w * 0.3, dx) * smoothstep(1.0, 0.2, y + (n - 0.5) * 0.4) * smoothstep(0.0, 0.1, y);
  float core = smoothstep(w * 0.6, 0.0, dx) * smoothstep(0.65, 0.0, y);
  vec3 col = mix(vec3(0.95, 0.28, 0.07), vec3(1.0, 0.64, 0.16), shape);
  col = mix(col, vec3(1.0, 0.93, 0.62), core);
  float a = shape * uPower;
  gl_FragColor = vec4(col * a, a);
}`

function flameMaterial(seed) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uPower: { value: 1 } },
    vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })
}

// ---- Moment de la journée ----------------------------------------------------------------------
export function dayMode(hour) {
  if (hour >= 7.5 && hour < 17.5) return 'jour'
  if (hour >= 17.5 && hour < 21.5) return 'soir'
  if (hour >= 5.5 && hour < 7.5) return 'soir'
  return 'nuit'
}

const MOOD = {
  jour: { hemi: [0xfffaf0, 0xc7b79c, 1.55], key: [0xfff1dc, 1.6], fill: 0.35, fire: 0.85, lamp: false },
  soir: { hemi: [0xffe6c9, 0x9c8a74, 1.05], key: [0xffc59a, 0.9], fill: 0.22, fire: 1.0, lamp: true },
  nuit: { hemi: [0xd6cfe0, 0x7a6a5c, 0.9], key: [0xb4bfe6, 0.5], fill: 0.18, fire: 1.15, lamp: true },
}

// ================================================================================================
export class LivingRoomScene {
  constructor(container, cb = {}) {
    this.cb = cb
    this.container = container
    this.mobile = matchMedia('(max-width: 767px)').matches || matchMedia('(pointer: coarse)').matches
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 2 : 2)
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.localClippingEnabled = true   // portes du meuble (copie du mur)
    this.renderer.domElement.className = 'salon-canvas'
    container.appendChild(this.renderer.domElement)
    noTouchSelect(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80)
    this.room = new THREE.Group()
    this.scene.add(this.room)

    this.az = new Spring(AZ0, 40, 1)
    this.el = new Spring(EL0, 40, 1)
    this.target = TARGET0.clone()
    this.dist = 10
    this.fly = null           // déplacement de caméra (entrée dans la bibliothèque, retour)
    this.items = new Map()    // kind -> { group, bounce, label }
    this.hitMeshes = []
    this.hover = null
    this.pointer = null
    this.time = 0
    this.frames = 0
    this.slow = 0
    this.shadowDirty = 2
    this.fabric = fabricTexture()
    this.grain = grainTexture()
    this.glow = glowTexture()
    this.bandTex = spineBandTexture()
    this.disposables = [this.fabric, this.glow, this.bandTex]
    this.raycaster = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()

    const q = new URLSearchParams(location.search).get('heure')
    const now = new Date()
    this.hour = q != null && !isNaN(+q) ? +q : now.getHours() + now.getMinutes() / 60
    this.mode = dayMode(this.hour)

    this._buildLights()
    this._buildShell()
    this._buildBookcase()
    this._buildFireplace()
    this._buildTvCorner()
    this._buildSofa()
    this._buildTable()
    this._buildLamp()
    this._buildPlant()
    this._buildWindow()
    for (const [kind, k] of Object.entries(BIG)) {
      const it = this.items.get(kind)
      if (!it) continue
      it.group.scale.setScalar(k)
      it.group.userData.k = k
    }
    this._applyMood()

    this._bindEvents()
    this.resize()
    this._ro = new ResizeObserver(() => this.resize())
    this._ro.observe(container)
    this._onVis = () => { if (!document.hidden) this.last = performance.now() }
    document.addEventListener('visibilitychange', this._onVis)
    this.last = performance.now()
    this._loop = this._loop.bind(this)
    this.raf = requestAnimationFrame(this._loop)
    document.fonts?.ready.then(() => { if (this.tvCanvas) this._drawTv(); this._drawCabinet() })
  }

  // ---- Matériaux --------------------------------------------------------------------------
  _mat(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts })
    this.disposables.push(m)
    return m
  }
  _fabricMat(color) { return this._mat(color, { map: this.fabric, roughness: 0.95 }) }
  _woodMat(color) { return this._mat(color, { map: this.grain, roughness: 0.7 }) }
  _rbox(w, h, d, r, mat, seg = 3) {
    const geo = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))
    this.disposables.push(geo)
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = true; m.receiveShadow = true
    return m
  }
  _geo(g) { this.disposables.push(g); return g }

  _register(kind, group, label, extra = {}) {
    const item = { kind, group, label, bounce: new Spring(0, 260, 0.22), ...extra }
    group.traverse(o => { if (o.isMesh) { o.userData.kind = kind; this.hitMeshes.push(o) } })
    this.items.set(kind, item)
    return item
  }

  // ---- Lumières --------------------------------------------------------------------------
  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 1)
    const key = new THREE.DirectionalLight(0xffffff, 1)
    key.position.set(-2.6, 6.5, 4.6)
    key.castShadow = true
    const s = this.mobile ? 1024 : 2048
    key.shadow.mapSize.set(s, s)
    Object.assign(key.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 16 })
    key.shadow.bias = -0.0005
    key.shadow.normalBias = 0.025
    key.shadow.radius = 4
    this.key = key
    this.fill = new THREE.DirectionalLight(0xe8eeff, 0.3)
    this.fill.position.set(5, 2.5, 3)
    this.scene.add(this.hemi, key, key.target, this.fill)

    // lumières de la bibliothèque : elles prennent le relais pendant l'entrée (même rendu exact)
    this.libHemi = new THREE.HemisphereLight(0xfff8ec, 0xb4a58a, 0)
    const lk = new THREE.DirectionalLight(0xfff3e2, 0)
    lk.castShadow = true
    lk.shadow.mapSize.set(s, s)
    lk.shadow.radius = 5
    lk.shadow.camera.layers.set(1)      // seul le meuble projette ces ombres
    this.libKey = lk
    this.libFill = new THREE.DirectionalLight(0xe8eeff, 0)
    this.libFill.position.set(5, 2, 3)
    this.scene.add(this.libHemi, lk, lk.target, this.libFill, this.libFill.target)
  }

  _applyMood() {
    const m = MOOD[this.mode]
    this.hemi.color.set(m.hemi[0]); this.hemi.groundColor.set(m.hemi[1]); this.hemi.intensity = m.hemi[2]
    this.key.color.set(m.key[0]); this.key.intensity = m.key[1]
    this.fill.intensity = m.fill
    this.baseLights = { hemi: m.hemi[2], key: m.key[1], fill: m.fill }
    this.mix = 0     // 0 : lumière du salon ; 1 : lumière de la bibliothèque
    this.firePower = new Spring(m.fire, 30, 0.5)
    this.fireFull = m.fire
    this.fireLow = store('levana.salon.feu') === 'bas'
    this.firePower.base = this.fireLow ? Math.min(m.fire, 0.28) : m.fire
    this.firePower.v = this.firePower.base
    this.setLamp(m.lamp)
  }

  // ---- Pièce : sol, murs, plinthes, socle ----------------------------------------------
  _buildShell() {
    const g = this.room
    // socle (le plancher a une épaisseur : effet maquette)
    const slab = this._rbox(2 * R + 2 * T, FT, 2 * R + 2 * T, 0.03, this._woodMat(COL.slab))
    slab.position.set(0, -FT / 2, 0)
    slab.castShadow = false
    g.add(slab)
    const ptex = parquetTexture()
    ptex.repeat.set(2.4, 2.4)
    this.disposables.push(ptex)
    const floor = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(2 * R, 2 * R)), this._mat('#ffffff', { map: ptex, roughness: 0.62 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0.002
    floor.receiveShadow = true
    g.add(floor)

    // ombre douce sous la maquette
    const cs = contactShadowTexture(); this.disposables.push(cs)
    const shadow = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(7.6, 7.6)), new THREE.MeshBasicMaterial({ map: cs, transparent: true, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(0, -FT - 0.05, 0)
    g.add(shadow)

    // quatre murs : celui qui se trouve entre la caméra et la pièce s'abaisse (on tourne à 360°)
    this.walls = []
    const baseMat = this._mat(COL.base, { roughness: 0.7 })
    const capMat = this._mat('#F7F2EA', { roughness: 0.8 })
    const wall = (name, n, build) => {
      const grp = new THREE.Group()
      g.add(grp)
      const w = { name, grp, n, cut: new Spring(1, 70, 1), decor: [], attached: [] }   // attached : meubles contre ce mur
      build(grp, w)
      this.walls.push(w)
      return w
    }
    const L = 2 * R + 2 * T
    wall('back', new THREE.Vector3(0, 0, -1), grp => {
      const m = this._rbox(L, H, T, 0.02, this._mat(COL.wallBack, { roughness: 0.95 })); m.position.set(0, H / 2, -R - T / 2); m.castShadow = false; m.receiveShadow = true
      const b = this._rbox(2 * R, 0.09, 0.025, 0.006, baseMat); b.position.set(0, 0.045, -R + 0.0125); b.castShadow = false
      const c = this._rbox(L + 0.02, 0.05, T + 0.04, 0.015, capMat); c.position.set(0, H + 0.02, -R - T / 2)
      grp.add(m, b, c)
    })
    wall('front', new THREE.Vector3(0, 0, 1), grp => {
      const m = this._rbox(L, H, T, 0.02, this._mat(COL.wallBack, { roughness: 0.95 })); m.position.set(0, H / 2, R + T / 2); m.castShadow = false; m.receiveShadow = true
      const b = this._rbox(2 * R, 0.09, 0.025, 0.006, baseMat); b.position.set(0, 0.045, R - 0.0125); b.castShadow = false
      const c = this._rbox(L + 0.02, 0.05, T + 0.04, 0.015, capMat); c.position.set(0, H + 0.02, R + T / 2)
      grp.add(m, b, c)
    })
    // un mur latéral (x = ±R), percé d'une fenêtre s'il le faut
    const sideWall = (sx, hole) => {
      const sh = new THREE.Shape()
      sh.moveTo(-R, 0); sh.lineTo(R, 0); sh.lineTo(R, H); sh.lineTo(-R, H); sh.closePath()
      if (hole) {
        const u0 = -WINDOW.z - WINDOW.w / 2, u1 = -WINDOW.z + WINDOW.w / 2
        const v0 = WINDOW.y - WINDOW.h / 2, v1 = WINDOW.y + WINDOW.h / 2
        const p = new THREE.Path()
        p.moveTo(u0, v0); p.lineTo(u0, v1); p.lineTo(u1, v1); p.lineTo(u1, v0); p.closePath()
        sh.holes.push(p)
      }
      const m = new THREE.Mesh(this._geo(new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false })), this._mat(COL.wallLeft, { roughness: 0.95 }))
      m.rotation.y = Math.PI / 2
      m.position.set(sx < 0 ? -R - T : R, 0, 0)
      m.receiveShadow = true
      const b = this._rbox(0.025, 0.09, 2 * R, 0.006, baseMat); b.position.set(sx * (R - 0.0125), 0.045, 0); b.castShadow = false
      const c = this._rbox(T + 0.04, 0.05, 2 * R + 0.02, 0.015, capMat); c.position.set(sx * (R + T / 2), H + 0.02, 0)
      return [m, b, c]
    }
    wall('left', new THREE.Vector3(-1, 0, 0), grp => { grp.add(...sideWall(-1, false)) })
    wall('right', new THREE.Vector3(1, 0, 0), grp => { grp.add(...sideWall(1, true)) })
    this.wallOf = name => this.walls.find(w => w.name === name)

    // tapis
    const rug = new THREE.Mesh(this._geo(new RoundedPlane(2.5, 2.1, 0.12)), this._mat('#ffffff', { map: this._track(rugTexture()), roughness: 1 }))
    rug.rotation.x = -Math.PI / 2
    rug.position.set(-0.05, 0.008, 0.0)
    rug.receiveShadow = true
    g.add(rug)

  }

  _track(t) { this.disposables.push(t); return t }

  // ---- Bibliothèque ----------------------------------------------------------------------
  _buildBookcase() {
    const grp = new THREE.Group()
    grp.position.set(BOOKCASE.x, 0, BOOKCASE.z)   // face à la pièce (+z)
    this.room.add(grp)
    this.bookcase = grp
    this.bookcaseInner = new THREE.Group()
    grp.add(this.bookcaseInner)
    this.bookcaseBooks = new THREE.Group()
    grp.add(this.bookcaseBooks)
    this._register('bookcase', grp, 'Entrer dans ma bibliothèque')
    this.setShelfSkin(null)
    this.setBooks([])
  }

  setShelfSkin(skin) {
    const pal = resolveSkin(skin || { material: 'chene', wall: 'papier' })
    const key = `${pal.mat.id}|${pal.wallId}`
    if (key === this.skinKey) return
    this.skinKey = key
    const inner = this.bookcaseInner
    const old = new Set(inner.children)
    this.hitMeshes = this.hitMeshes.filter(m => !old.has(m))
    inner.children.slice().forEach(c => inner.remove(c))
    const { w, h, d } = BOOKCASE
    const wood = this._woodMat(pal.mat.mid)
    const wall = this._mat(pal.wall2, { roughness: 0.95 })
    const th = 0.045
    const add = m => { m.userData.kind = 'bookcase'; this.hitMeshes.push(m); inner.add(m); return m }
    add(this._rbox(th, h, d, 0.012, wood)).position.set(-w / 2 + th / 2, h / 2, 0)
    add(this._rbox(th, h, d, 0.012, wood)).position.set(w / 2 - th / 2, h / 2, 0)
    add(this._rbox(w + 0.04, th, d + 0.03, 0.014, wood)).position.set(0, h - th / 2, 0.01)
    add(this._rbox(w, 0.09, d, 0.01, wood)).position.set(0, 0.045, 0)
    const backPanel = add(this._rbox(w - 2 * th, h - 0.1, 0.02, 0.004, wall))
    backPanel.position.set(0, h / 2, -d / 2 + 0.01)
    backPanel.castShadow = false
    this.rows = []
    const n = 4
    const y0 = 0.09, y1 = h - th
    const rh = (y1 - y0) / n
    for (let i = 0; i < n; i++) {
      const y = y0 + i * rh
      if (i > 0) add(this._rbox(w - 2 * th, 0.03, d - 0.02, 0.006, wood)).position.set(0, y + 0.015, 0.005)
      this.rows.push({ y: y + (i > 0 ? 0.03 : 0), h: rh - (i > 0 ? 0.03 : 0) })
    }
    this.rows.reverse()      // du haut vers le bas
    this.shadowDirty = 2
    if (this.lastBooks) this.setBooks(this.lastBooks, true)
  }

  /** Les livres de l'utilisatrice, dans l'ordre de ses étagères (ceux qui tiennent). */
  setBooks(books, force = false) {
    const sig = books.map(b => b.id).join(',')
    if (!force && sig === this.booksSig) return
    this.booksSig = sig
    this.lastBooks = books
    const G = this.bookcaseBooks
    G.children.slice().forEach(c => { G.remove(c) })
    this.hitMeshes = this.hitMeshes.filter(m => m.userData.kind !== 'bookcase' || !m.userData.book)
    this.shelfBooks = []
    if (!this.unitBox) this.unitBox = this._geo(new THREE.BoxGeometry(1, 1, 1))
    if (!this.pagesMat) this.pagesMat = this._mat('#F3EBDD', { roughness: 0.95 })
    this.bookMats = this.bookMats || new Map()
    const matsFor = color => {
      if (!this.bookMats.has(color)) {
        const cover = this._mat(color, { roughness: 0.7 })
        const spine = this._mat(color, { map: this.bandTex, roughness: 0.65 })
        this.bookMats.set(color, [cover, cover, this.pagesMat, this.pagesMat, spine, cover])
      }
      return this.bookMats.get(color)
    }
    const { w, d } = BOOKCASE
    const inner = w - 2 * 0.045 - 0.04
    let i = 0
    let order = 0
    // peu de livres : on les répartit sur tous les rayons plutôt que de remplir le haut
    const perRow = Math.ceil(books.length / this.rows.length)
    for (let r = 0; r < this.rows.length; r++) {
      const rowEnd = Math.min(books.length, i + perRow)
      const row = this.rows[r]
      const decor = r === 0 ? 0.24 : r === 2 ? 0.18 : 0
      const avail = inner - decor
      // les livres du rayon (ceux qui tiennent), puis centrés dans la place libre
      const thick = b => clamp(0.03 + (b.page_count || b.pageCount || 260) / 16000, 0.032, 0.07)
      let total = 0, n = 0
      while (i + n < rowEnd && total + thick(books[i + n]) <= avail) { total += thick(books[i + n]) + 0.002; n++ }
      let x = -inner / 2 + Math.max(0, (avail - total) / 2)
      const stop = i + n
      while (i < stop) {
        const b = books[i]
        const t = thick(b)
        const hh = row.h * (0.66 + ((hashId(b.id) % 100) / 100) * 0.24)
        const dd = d * (0.62 + ((hashId(b.id + 'd') % 100) / 100) * 0.12)
        const m = new THREE.Mesh(this.unitBox, matsFor(spineColors(b)[0]))
        m.scale.set(t, hh, dd)
        m.position.set(x + t / 2, row.y + hh / 2 + 0.001, d / 2 - dd / 2 - 0.03)
        m.castShadow = true; m.receiveShadow = true
        m.userData = { kind: 'bookcase', book: b }
        this.hitMeshes.push(m)
        G.add(m)
        this.shelfBooks.push({ mesh: m, z0: m.position.z, out: new Spring(0, 220, 0.5), order: order++ })
        x += t + 0.002
        i++
      }
      // un petit objet au bout de certains rayons
      if (decor) {
        const obj = r === 0 ? this._vase(0.07, 0.2, '#2B47B0') : this._bookStack()
        obj.position.set(inner / 2 - decor / 2, row.y, 0)
        obj.traverse(o => { if (o.isMesh) { o.userData = { kind: 'bookcase', book: true }; this.hitMeshes.push(o) } })
        G.add(obj)
      }
    }
    this.shadowDirty = 2
    this.wave(0.4)
  }

  _vase(r, h, color) {
    const pts = []
    for (let k = 0; k <= 12; k++) {
      const t = k / 12
      pts.push(new THREE.Vector2(r * (0.55 + 0.6 * Math.sin(Math.PI * (0.15 + t * 0.75))) * (t > 0.9 ? 0.7 : 1), t * h))
    }
    const m = new THREE.Mesh(this._geo(new THREE.LatheGeometry(pts, 28)), this._mat(color, { roughness: 0.35 }))
    m.castShadow = true
    const g = new THREE.Group(); g.add(m)
    return g
  }

  _bookStack() {
    const g = new THREE.Group()
    const cols = ['#C9614F', '#E2B85A', '#2F5A4B']
    cols.forEach((c, k) => {
      const b = this._rbox(0.15 - k * 0.012, 0.03, 0.2 - k * 0.015, 0.004, this._mat(c, { roughness: 0.7 }))
      b.position.set(0, 0.015 + k * 0.031, 0.02)
      b.rotation.y = (k - 1) * 0.12
      g.add(b)
    })
    return g
  }

  /** Une vague qui parcourt les livres (ils sortent un peu de l'étagère, puis reviennent). */
  wave(delay = 0) { this.waveAt = this.time + delay }

  // ---- Cheminée ---------------------------------------------------------------------------
  _buildFireplace() {
    const grp = new THREE.Group()
    grp.position.set(FIRE.x, 0, R)    // contre le mur de devant, face à la pièce (−z)
    grp.rotation.y = Math.PI
    this.room.add(grp)
    const W = FIRE.w, D = FIRE.d
    const aw = 0.74, ah = 0.5, ay = 0.1, ar = aw / 2
    const outline = new THREE.Shape()
    outline.moveTo(-W / 2, 0); outline.lineTo(W / 2, 0); outline.lineTo(W / 2, FIRE.h); outline.lineTo(-W / 2, FIRE.h); outline.closePath()
    const arch = new THREE.Path()
    arch.moveTo(-aw / 2, ay); arch.lineTo(aw / 2, ay); arch.lineTo(aw / 2, ay + ah)
    arch.absarc(0, ay + ah, ar, 0, Math.PI, false)
    arch.lineTo(-aw / 2, ay)
    outline.holes.push(arch)
    const breast = new THREE.Mesh(this._geo(new THREE.ExtrudeGeometry(outline, { depth: D, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 24 })), this._mat(COL.plaster, { roughness: 0.92 }))
    breast.castShadow = true; breast.receiveShadow = true
    grp.add(breast)
    // dos plein (vue de derrière, quand le mur de devant est abaissé)
    const backPlate = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(W + 0.02, FIRE.h + 0.02)), this._mat(COL.plaster, { roughness: 0.92 }))
    backPlate.rotation.y = Math.PI
    backPlate.position.set(0, FIRE.h / 2, -0.016)
    grp.add(backPlate)
    // intérieur noirci
    const inner = new THREE.Shape()
    inner.moveTo(-aw / 2 + 0.01, ay); inner.lineTo(aw / 2 - 0.01, ay); inner.lineTo(aw / 2 - 0.01, ay + ah)
    inner.absarc(0, ay + ah, ar - 0.01, 0, Math.PI, false)
    inner.lineTo(-aw / 2 + 0.01, ay)
    const liner = new THREE.Mesh(this._geo(new THREE.ExtrudeGeometry(inner, { depth: D - 0.04, bevelEnabled: false, curveSegments: 24 })), this._mat(COL.soot, { roughness: 1, side: THREE.BackSide }))
    liner.position.z = 0.02
    grp.add(liner)
    // âtre et tablette
    const hearth = this._rbox(W + 0.24, 0.07, 0.46, 0.02, this._mat(COL.stone, { roughness: 0.8 }))
    hearth.position.set(0, 0.035, D + 0.2)
    grp.add(hearth)
    const mantel = this._rbox(W + 0.18, 0.07, D + 0.16, 0.02, this._woodMat(COL.oak))
    mantel.position.set(0, 1.12, D / 2 + 0.06)
    grp.add(mantel)
    // bûches
    const logMat = this._woodMat('#6B4A2E'), endMat = this._mat('#C9A36E', { roughness: 0.9 })
    ;[[-0.1, 0.16, 0.25, 0.3], [0.12, 0.155, 0.17, -0.35], [0.0, 0.25, 0.2, 0.05]].forEach(([x, y, z, rot]) => {
      const lg = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.055, 0.06, 0.46, 14)), [logMat, endMat, endMat])
      lg.rotation.z = Math.PI / 2; lg.rotation.y = rot
      lg.position.set(x, y, z)
      lg.castShadow = true
      grp.add(lg)
    })
    // braises
    const ember = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(0.62, 0.3)), new THREE.MeshBasicMaterial({ map: this.glow, color: 0xff6a1f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    ember.rotation.x = -Math.PI / 2
    ember.position.set(0, ay + 0.012, 0.2)
    grp.add(ember)
    this.ember = ember
    // flammes
    this.flames = []
    ;[[-0.1, 0.3, 0.42, 0.1], [0.1, 0.28, 0.38, 0.6], [0, 0.34, 0.5, 0.33]].forEach(([x, w, h, seed]) => {
      const mat = flameMaterial(seed); this.disposables.push(mat)
      const f = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(w, h)), mat)
      f.geometry.translate(0, h / 2, 0)
      f.position.set(x, 0.17, 0.22)
      f.renderOrder = 5
      grp.add(f)
      this.flames.push(f)
    })
    // lueur du feu
    this.fireLight = new THREE.PointLight(0xff8a3c, 2, 5.5, 1.6)
    this.fireLight.position.set(FIRE.x, 0.55 * BIG.fire, R - (D + 0.45) * BIG.fire)
    this.scene.add(this.fireLight)
    // déco de la tablette : miroir rond, bougies, petit vase
    const mirror = new THREE.Mesh(this._geo(new THREE.CircleGeometry(0.3, 48)), this._mat('#C9D3D8', { roughness: 0.15, metalness: 0.3 }))
    // le miroir est accroché au mur (il s'abaisse avec lui)
    mirror.position.set(FIRE.x, 2.2, R - 0.014)
    mirror.rotation.y = Math.PI
    const rim = new THREE.Mesh(this._geo(new THREE.TorusGeometry(0.3, 0.022, 10, 64)), this._mat(COL.brass, { roughness: 0.35, metalness: 0.6 }))
    rim.position.copy(mirror.position); rim.rotation.y = Math.PI
    rim.castShadow = true
    const fw = this.wallOf('front')
    fw.grp.add(mirror, rim)
    fw.decor.push(mirror, rim)
    this.candles = []
    ;[[-0.52, 0.16], [-0.43, 0.11]].forEach(([x, h]) => {
      const c = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.025, 0.025, h, 16)), this._mat('#F6F0E2', { roughness: 0.6 }))
      c.position.set(x, 1.155 + h / 2, D / 2 + 0.08)
      c.castShadow = true
      const mat = flameMaterial(x * 7); this.disposables.push(mat)
      const f = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(0.045, 0.09)), mat)
      f.geometry.translate(0, 0.045, 0)
      f.position.set(x, 1.155 + h + 0.005, D / 2 + 0.08)
      grp.add(c, f)
      this.candles.push(f)
    })
    const vase = this._vase(0.06, 0.2, '#C2774E')
    vase.position.set(0.48, 1.155, D / 2 + 0.06)
    grp.add(vase)
    // brindilles dans le vase
    const twigMat = this._mat('#6B4A2E')
    for (let k = 0; k < 4; k++) {
      const a = k * 1.6
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.15, 0), new THREE.Vector3(Math.cos(a) * 0.05, 0.35, Math.sin(a) * 0.03), new THREE.Vector3(Math.cos(a) * 0.12, 0.5 + k * 0.03, Math.sin(a) * 0.06))
      const tw = new THREE.Mesh(this._geo(new THREE.TubeGeometry(curve, 8, 0.004, 4)), twigMat)
      vase.add(tw)
    }
    this._register('fire', grp, 'Baisser le feu')
    this.wallOf('front').attached.push(grp)
  }

  // ---- Coin télé -------------------------------------------------------------------------
  _buildTvCorner() {
    const grp = new THREE.Group()
    grp.position.set(-R + 0.22, 0, TV.z)
    grp.rotation.y = Math.PI / 2      // contre le mur de gauche, face au canapé (+x)
    this.room.add(grp)
    const W = 2.3, Hh = 0.5, D = 0.42, leg = 0.14
    const wood = this._woodMat(COL.walnut)
    const body = this._rbox(W, Hh, D, 0.03, wood)
    body.position.y = leg + Hh / 2
    grp.add(body)
    const legMat = this._mat('#3B2A1E', { roughness: 0.6 })
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const l = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.018, 0.012, leg, 10)), legMat)
      l.position.set(sx * (W / 2 - 0.08), leg / 2, sz * (D / 2 - 0.07))
      l.castShadow = true
      grp.add(l)
    }
    // la vitrine : nos films et séries rangés dedans, derrière deux portes vitrées coulissantes
    const iw = W - 0.1, ih = Hh - 0.1
    this.cabCanvas = document.createElement('canvas')
    this.cabCanvas.width = 2048; this.cabCanvas.height = Math.round(2048 * ih / iw)
    this.cabTex = this._track(new THREE.CanvasTexture(this.cabCanvas))
    this.cabTex.colorSpace = THREE.SRGBColorSpace
    this.cabTex.anisotropy = 8
    const inside = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(iw, ih)), this._mat('#ffffff', { map: this.cabTex, roughness: 0.75 }))
    inside.position.set(0, leg + Hh / 2, D / 2 + 0.003)
    grp.add(inside)
    const glass = new THREE.MeshBasicMaterial({ map: this._track(glassTexture()), transparent: true, depthWrite: false, toneMapped: false })
    this.cabGlass = glass     // les portes s'effacent quand on s'approche du meuble
    this.cabGroup = grp
    this.cabFront = new THREE.Vector3(0, leg + Hh / 2, D / 2 + 0.02)
    const brass = this._mat(COL.brass, { metalness: 0.6, roughness: 0.3 })
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(iw / 2 + 0.01, ih)), glass)
      door.position.set(sx * (iw / 4), leg + Hh / 2, D / 2 + 0.012 + (sx > 0 ? 0.006 : 0))
      grp.add(door)
      const pull = this._rbox(0.012, ih * 0.5, 0.012, 0.004, brass)
      pull.position.set(sx * 0.06, leg + Hh / 2, D / 2 + 0.024)
      grp.add(pull)
    }
    // l'encadrement de la vitrine
    for (const [w, h, x, y] of [[W - 0.04, 0.05, 0, leg + Hh - 0.025], [W - 0.04, 0.05, 0, leg + 0.025], [0.05, Hh, -W / 2 + 0.025, leg + Hh / 2], [0.05, Hh, W / 2 - 0.025, leg + Hh / 2]]) {
      const f = this._rbox(w, h, 0.03, 0.008, wood)
      f.position.set(x, y, D / 2 + 0.004)
      grp.add(f)
    }
    this._drawCabinet()
    this._register('cabinet', grp, 'Notre vitrine')
    this.wallOf('left').attached.push(grp)

    // l'image projetée directement sur le mur : bords fondus, halo de lumière autour
    const scr = new THREE.Group()
    scr.position.set(-R + 0.004, 0, TV.z)
    scr.rotation.y = Math.PI / 2
    this.room.add(scr)
    const halo = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(SCR.w * 1.32, SCR.h * 1.5)), new THREE.MeshBasicMaterial({
      map: this._track(projGlowTexture()), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }))
    halo.position.set(0, SCR.y, 0.002)
    scr.add(halo)
    this.projHalo = halo
    this.tvCanvas = document.createElement('canvas')
    this.tvCanvas.width = TV_W; this.tvCanvas.height = TV_H
    this.series = new TvSeries(() => { if (this.tvCanvas) this._drawTv() })
    this.tvBubbleOn = this.cb.tvBubble?.() ?? true
    this.tvTex = this._track(new THREE.CanvasTexture(this.tvCanvas))
    this.tvTex.colorSpace = THREE.SRGBColorSpace
    this.tvTex.anisotropy = 4
    const screen = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(SCR.w, SCR.h)), new THREE.MeshBasicMaterial({
      map: this.tvTex, alphaMap: this._track(featherTexture()), transparent: true, depthWrite: false, toneMapped: false, color: 0xf1ede6,
    }))
    screen.position.set(0, SCR.y, 0.004)
    scr.add(screen)
    this.tvScreen = screen
    this._drawTv()
    this._register('tv', scr, 'Films & séries')
    this.wallOf('left').attached.push(scr)

    this._buildProjector()
  }

  /** Le vidéoprojecteur, suspendu au-dessus du canapé, et son faisceau jusqu'à la toile. */
  _buildProjector() {
    const grp = new THREE.Group()
    grp.position.set(PROJ.x, PROJ.y, TV.z)
    this.room.add(grp)
    const shell = this._mat('#EEEBE5', { roughness: 0.45 })
    const dark = this._mat('#1C1C1F', { roughness: 0.35 })
    const body = this._rbox(0.36, 0.12, 0.3, 0.035, shell)
    grp.add(body)
    // objectif, tourné vers la toile (-x)
    const lens = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 24)), dark)
    lens.rotation.z = Math.PI / 2
    lens.position.set(-0.19, 0, 0.06)
    const glass = new THREE.Mesh(this._geo(new THREE.CircleGeometry(0.038, 24)), new THREE.MeshBasicMaterial({ color: 0xdfeaff, toneMapped: false }))
    glass.rotation.y = -Math.PI / 2
    glass.position.set(-0.216, 0, 0.06)
    // grille d'aération et voyant
    for (let i = 0; i < 5; i++) {
      const v = this._rbox(0.012, 0.05, 0.004, 0.002, dark)
      v.position.set(0.04 + i * 0.024, 0, -0.151)
      grp.add(v)
    }
    const led = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.008, 8, 6)), new THREE.MeshBasicMaterial({ color: 0x5ad18a, toneMapped: false }))
    led.position.set(0.12, 0.062, -0.09)
    // suspension : platine et tige jusqu'en haut
    const rodLen = (H + 0.02 - PROJ.y) / BIG.projector - 0.06
    const rod = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.014, 0.014, rodLen, 10)), dark)
    rod.position.set(0.04, 0.06 + rodLen / 2, 0)
    const plate = this._rbox(0.14, 0.02, 0.12, 0.006, dark)
    plate.position.set(0.04, 0.07, 0)
    const top = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 16)), dark)
    top.position.set(0.04, 0.06 + rodLen, 0)
    grp.add(lens, glass, led, rod, plate, top)
    grp.traverse(o => { if (o.isMesh) o.castShadow = o !== glass && o !== led })
    this._register('projector', grp, 'Films & séries')

    // le faisceau : une pyramide de lumière très légère, de l'objectif aux coins de la toile
    const o = new THREE.Vector3(PROJ.x - 0.22 * BIG.projector, PROJ.y, TV.z + 0.06 * BIG.projector)
    const x = -R + 0.03, y0 = SCR.y - SCR.h / 2, y1 = SCR.y + SCR.h / 2, z0 = TV.z - SCR.w / 2, z1 = TV.z + SCR.w / 2
    const c = [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]]
    const pos = []
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; pos.push(o.x, o.y, o.z, ...a, ...b) }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    // plus clair près de l'objectif, presque rien sur le mur
    const col = []
    for (let i = 0; i < 4; i++) col.push(1, 1, 1, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15)
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    this.beam = new THREE.Mesh(this._geo(geo), new THREE.MeshBasicMaterial({
      color: 0xfff3d6, vertexColors: true, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }))
    this.beam.renderOrder = 5
    this.room.add(this.beam)
  }

  /** Nos séries, sur l'écran de la télé. */
  setSeries(list) {
    this.cabList = list
    this._drawCabinet()
    this.series.setSeries(list)
    this._drawTv()
    this._emitSlide()
  }
  setTvBubble(on) { this.tvBubbleOn = on }

  /** L'intérieur de la vitrine : un boîtier par film ou série, dans l'ordre d'ajout. */
  _drawCabinet() {
    const c = this.cabCanvas
    if (!c) return
    const g = c.getContext('2d'), W = c.width, Hc = c.height
    const bg = g.createLinearGradient(0, 0, 0, Hc)
    bg.addColorStop(0, '#120D09'); bg.addColorStop(0.25, '#2A1F16'); bg.addColorStop(1, '#3A2B1E')
    g.fillStyle = bg; g.fillRect(0, 0, W, Hc)
    const list = [...(this.cabList || [])].sort((a, b) => (a.added_at || '').localeCompare(b.added_at || ''))
    const pad = 22, top = Hc * 0.1, h = Hc - top - 14
    const sw = Math.min(h * 0.11, (W - 2 * pad) / Math.max(1, list.length) - 3)
    list.forEach((s, i) => {
      const x = pad + i * (sw + 3)
      const [bgc, fg] = CASE_COLORS[hashName(s.name) % CASE_COLORS.length]
      g.fillStyle = bgc; g.fillRect(x, top, sw, h)
      g.fillStyle = s.media === 'movie' ? '#C23B33' : '#2A62C0'; g.fillRect(x, top, sw, h * 0.085)
      const sh = g.createLinearGradient(x, 0, x + sw, 0)
      sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)')
      g.fillStyle = sh; g.fillRect(x, top, sw, h)
      g.save()
      g.translate(x + sw / 2, top + h * 0.55); g.rotate(Math.PI / 2)
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = `700 ${Math.round(sw * 0.48)}px "Inter Tight", system-ui, sans-serif`
      let name = (s.name || '').toUpperCase()
      while (name.length > 3 && g.measureText(name).width > h * 0.8) name = name.slice(0, -2) + '…'
      g.fillText(name, 0, 0)
      g.restore()
    })
    if (!list.length) {
      g.fillStyle = 'rgba(244,239,227,0.55)'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = `italic 400 ${Math.round(Hc * 0.13)}px "Newsreader", Georgia, serif`
      g.fillText('Vos films et séries se rangeront ici', W / 2, Hc / 2)
    }
    // ombre portée de la tablette du haut
    const sh = g.createLinearGradient(0, 0, 0, Hc * 0.3)
    sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = sh; g.fillRect(0, 0, W, Hc * 0.3)
    this.cabTex.needsUpdate = true
  }

  _emitSlide() {
    this.cb.onTvSlide?.({ i: this.series.i, count: this.series.count })
  }

  _drawTv() {
    this.series.draw(this.tvCanvas.getContext('2d'), TV_W, TV_H)
    this.tvTex.needsUpdate = true
  }

  // ---- Zoom sur la télé (le tuto en grand) -------------------------------------------------
  _tvView() {
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    if (this.tvZoom?.kind === 'cab') {
      // devant le meuble, un peu au-dessus : la vitrine occupe le bas de l'écran
      this.cabGroup.updateWorldMatrix(true, false)
      const target = this.cabGroup.localToWorld(this.cabFront.clone())
      target.y += 0.25
      const dist = Math.min(2.4 * 0.6 / (t * this.camera.aspect), 0.7 / 0.3 / 2 / t)
      return { target, az: Math.PI / 2, el: 0.3, dist }
    }
    // face à l'écran, tout près : l'écran remplit la vue (on entre dans la télé)
    const target = this.tvScreen.getWorldPosition(new THREE.Vector3())
    const dist = Math.min(SCR.w / 2 / (t * this.camera.aspect), SCR.h / 2 / t) * 0.94
    return { target, az: Math.PI / 2, el: 0, dist }
  }

  /** Zoom : sur l'image projetée (« tv »), ou sur le meuble et ses boîtiers (« cab »). */
  zoomTv(kind = 'tv') {
    if (this.fly || this.tvZoom) return
    this._setHover(null)
    this._drawTv()
    this.tvZoom = { kind, k: 0, dir: 1, from: { target: this.target.clone(), az: this.az.v + (this.lastDrift || 0), el: this.el.v, dist: this.dist } }
    this.cb.onTvZoom?.(true)
    this._emitSlide()
  }

  unzoomTv() {
    if (!this.tvZoom) return
    this.tvZoom.dir = -1
    this.cb.onTvZoom?.(false)
  }

  /**
   * Le lecteur des génériques (un élément HTML de 640 × 360) posé exactement sur l'écran de la
   * télé : on projette les quatre coins de l'écran et on déforme l'élément pour qu'il les
   * rejoigne (perspective comprise). Caché quand l'écran est de dos, que son mur est baissé,
   * ou pendant un trajet de caméra.
   */
  _placeTvVideo() {
    const el = this.cb.tvVideo?.()
    if (!el) return
    const hide = () => { if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden' }
    if (this.fly || this.tvZoom || (this.wallOf('left').f ?? 1) < 0.97) return hide()
    const scr = this.tvScreen
    // la caméra vient de bouger : ses matrices ne sont recalculées qu'au rendu, on le fait ici
    // tout de suite, sinon le lecteur aurait une image de retard et glisserait à côté de l'écran
    this.camera.updateMatrixWorld()
    scr.updateWorldMatrix(true, false)
    const sp = scr.getWorldPosition(new THREE.Vector3())
    const nrm = new THREE.Vector3(0, 0, 1).transformDirection(scr.matrixWorld)
    if (nrm.dot(this.camera.position.clone().sub(sp).normalize()) < 0.12) return hide()
    const S = this.renderer.domElement.getBoundingClientRect()
    const pts = []
    const hw = SCR.w / 2, hh = SCR.h / 2
    for (const [x, y] of [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]]) {
      const v = scr.localToWorld(new THREE.Vector3(x, y, 0.002)).project(this.camera)
      if (v.z > 1) return hide()
      pts.push(S.left + ((v.x + 1) / 2) * S.width, S.top + ((1 - v.y) / 2) * S.height)
    }
    const m = quadMatrix(640, 360, pts)
    if (!m) return hide()
    const tf = `matrix3d(${m})`
    if (el.style.transform !== tf) el.style.transform = tf
    if (el.style.visibility !== 'visible') el.style.visibility = 'visible'
  }

  /** Zoom terminé : on est dans la télé (le module des séries la recouvre). */
  get inTv() { return !!this.tvZoom && this.tvZoom.kind === 'tv' && this.tvZoom.dir > 0 && this.tvZoom.k >= 1 }

  _stepTvZoom(dt) {
    const z = this.tvZoom
    z.k = clamp(z.k + (z.dir * dt) / 1.1, 0, 1)
    const e = ease(z.k), a = z.from, b = this._tvView()
    // la caméra garde son objectif (rien ne se déforme) ; elle tourne vers la télé, puis descend
    // à sa hauteur seulement à la fin (elle passe au-dessus de la lampe et du canapé)
    const eEl = ease(clamp((z.k - 0.3) / 0.7, 0, 1))
    const tgt = a.target.clone().lerp(b.target, e)
    const dist = Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * e)
    if (z.dir > 0 && z.k >= 1 && !z.inside) { z.inside = true; this.cb.onTvInside?.(z.kind) }
    if (z.dir < 0 && z.inside) { z.inside = false; this.cb.onTvInside?.(false) }
    if (this.cabGlass) this.cabGlass.opacity = z.kind === 'cab' ? 1 - clamp(e * 1.4, 0, 1) : 1
    this._placeCamera(a.az + shortAngle(a.az, b.az) * e, a.el + (b.el - a.el) * eEl, dist, tgt)
    if (z.dir < 0 && z.k <= 0) {
      this.tvZoom = null
      this.az.snap(a.az); this.el.snap(a.el); this.target.copy(a.target)
      this.camera.fov = FOV; this.camera.clearViewOffset(); this.camera.updateProjectionMatrix()
      this.idleAt = this.time
      if (this.pendingEnter !== undefined) { const f = this.pendingEnter; this.pendingEnter = undefined; this.enter(f) }
    }
  }

  /** La lampe passe devant la télé : elle s'efface pendant le zoom. */
  _fadeLamp(d) {
    this.lampHide = d
    if (!this.lampMats) {
      const set = new Set()
      // la lampe et le canapé sont entre la caméra et l'écran
      for (const k of ['lamp', 'sofa']) this.items.get(k).group.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => set.add(m)) })
      this.lampMats = [...set].map(m => ({ m, op: m.opacity, tr: m.transparent, dw: m.depthWrite }))
    }
    for (const f of this.lampMats) {
      if (d > 0) {
        if (!f.m.transparent) { f.m.transparent = true; f.m.needsUpdate = true }
        f.m.depthWrite = false
        f.m.opacity = f.op * (1 - d)
      } else if (f.m.transparent !== f.tr || f.m.opacity !== f.op) {
        f.m.opacity = f.op; f.m.depthWrite = f.dw
        if (f.m.transparent !== f.tr) { f.m.transparent = f.tr; f.m.needsUpdate = true }
      }
    }
    this.items.get('lamp').group.visible = d < 0.99
    this.items.get('sofa').group.visible = d < 0.99
  }

  /**
   * Un mur abaissé (et ce qui y est accroché) ; les meubles adossés à ce mur s'aplatissent
   * avec lui jusqu'à disparaître : du côté invisible, on ne les voit pas de dos.
   */
  _applyCut(w) {
    w.grp.scale.y = Math.max(0.05, w.cut.v)
    const show = w.cut.v > 0.6
    for (const d of w.decor) d.visible = show
    const f = clamp((w.cut.v - 0.07) / 0.93, 0, 1)
    w.f = f
    const objs = w.name === 'back' ? [this.bookcase, this.mirror?.g].filter(Boolean) : w.attached
    for (const o of objs) {
      o.userData.baseSy ??= o.scale.y
      o.userData.baseY ??= o.position.y
      o.userData.cutF = f                  // repris par le petit rebond des objets (sinon il remettrait la hauteur)
      o.scale.y = Math.max(0.001, o.userData.baseSy * f)
      o.position.y = o.userData.baseY * f
      o.visible = f > 0.02 && !(o === this.bookcase && this.mirror)
    }
  }

  // ---- Bulles (dans la 3D : elles suivent la pièce exactement, sans retard) ----------------
  _bubbleTexture(text, kind) {
    const S = 2, H = 96, TAIL = 16
    const m = document.createElement('canvas').getContext('2d')
    m.font = `italic 400 34px "Newsreader", Georgia, serif`
    const tw = m.measureText(text).width
    const icon = 40
    const W = Math.ceil(tw + icon + 64)
    const closable = kind === 'tv'
    const M = closable ? 16 : 0            // marge pour la petite croix (en haut à droite)
    const Wt = W + M, Ht = H + TAIL + 6 + M
    const c = document.createElement('canvas')
    c.width = Wt * S; c.height = Ht * S
    const g = c.getContext('2d')
    g.scale(S, S)
    g.translate(0, M)
    const r = (H - 8) / 2
    g.shadowColor = 'rgba(20,16,10,0.25)'; g.shadowBlur = 10; g.shadowOffsetY = 4
    g.fillStyle = '#F4F2ED'; g.strokeStyle = '#141414'; g.lineWidth = 2
    g.beginPath()
    g.moveTo(4 + r, 4); g.lineTo(W - 4 - r, 4); g.arc(W - 4 - r, 4 + r, r, -Math.PI / 2, Math.PI / 2)
    g.lineTo(W / 2 + 13, H - 4); g.lineTo(W / 2, H - 4 + TAIL); g.lineTo(W / 2 - 13, H - 4)
    g.lineTo(4 + r, H - 4); g.arc(4 + r, 4 + r, r, Math.PI / 2, -Math.PI / 2)
    g.closePath(); g.fill()
    g.shadowColor = 'transparent'; g.stroke()
    const cy = 4 + r
    if (kind === 'tv') {
      g.fillStyle = '#1F3FB0'; g.beginPath(); g.arc(30 + 14, cy, 20, 0, 7); g.fill()
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(39, cy - 9); g.lineTo(53, cy); g.lineTo(39, cy + 9); g.closePath(); g.fill()
    } else {
      g.fillStyle = '#C9614F'; g.beginPath(); g.arc(30 + 14, cy, 9, 0, 7); g.fill()
    }
    g.fillStyle = kind === 'tv' ? '#141414' : '#7A2E1F'
    g.font = `italic 400 34px "Newsreader", Georgia, serif`; g.textBaseline = 'middle'
    g.fillText(text, 30 + icon + 8, cy + 2)
    let close = null
    if (closable) {
      // petite croix pour enlever la bulle
      const bx = W - 8, by = 2
      g.fillStyle = '#141414'; g.beginPath(); g.arc(bx, by, 15, 0, 7); g.fill()
      g.strokeStyle = '#F4F2ED'; g.lineWidth = 2.6; g.lineCap = 'round'
      g.beginPath(); g.moveTo(bx - 5.5, by - 5.5); g.lineTo(bx + 5.5, by + 5.5); g.moveTo(bx + 5.5, by - 5.5); g.lineTo(bx - 5.5, by + 5.5); g.stroke()
      // zone à toucher (coordonnées de texture), un peu plus grande que la croix
      close = { u0: (bx - 26) / Wt, v0: 1 - (by + M + 26) / Ht }
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return { tex: t, w: Wt, h: Ht, close }
  }

  _setBubble(kind, text) {
    this.bubbles ||= {}
    let b = this.bubbles[kind]
    if (b && b.text === text) return b
    if (!text) { if (b) b.sprite.visible = false; if (b) b.text = ''; return b }
    const { tex, w, h, close } = this._bubbleTexture(text, kind)
    if (!b) {
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false })
      const sp = new THREE.Sprite(mat)
      sp.center.set(0.5, 0)
      sp.renderOrder = 30
      sp.userData.kind = kind === 'tv' ? 'tvbubble' : 'basketbubble'
      this.scene.add(sp)
      this.hitMeshes.push(sp)
      b = this.bubbles[kind] = { sprite: sp, mat, op: new Spring(0, 90, 1) }
      this.disposables.push(mat)
    } else {
      b.mat.map.dispose()
      b.mat.map = tex
      b.mat.needsUpdate = true
    }
    b.text = text; b.w = w; b.h = h; b.close = close
    this.disposables.push(tex)
    return b
  }

  /** Les bulles au-dessus de la télé et du panier. */
  _placeBubbles(dt) {
    if (!this.bubbles?.tv) this._setBubble('tv', 'Films & séries')
    this.bornAt ||= performance.now()
    const free = !this.fly && !this.tvZoom && performance.now() - this.bornAt > 1200
    const f = 1 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const px = 40     // hauteur à l'écran (px) de la pastille
    for (const [kind, pos, on] of [
      ['tv', new THREE.Vector3(-R + 0.15, SCR.y + SCR.h / 2 + 0.12, TV.z), free && this.tvBubbleOn !== false && (this.wallOf('left').f ?? 1) > 0.5],
    ]) {
      const b = this.bubbles?.[kind]
      if (!b) continue
      b.op.t = on ? 1 : 0
      b.op.step(dt)
      const o = clamp(b.op.v, 0, 1)
      b.mat.opacity = o
      b.sprite.visible = o > 0.01
      const k = (2 * px) / (f * Math.max(1, this.h)) * (b.h / 96)
      const pop = 0.75 + 0.25 * o
      b.sprite.scale.set(k * (b.w / b.h) * pop, k * pop, 1)
      b.sprite.position.copy(pos)
      b.sprite.position.y += Math.sin(this.time * 2 + (kind === 'tv' ? 0 : 1.7)) * 0.025
    }
  }

  // ---- Canapé ------------------------------------------------------------------------------
  _buildSofa() {
    const grp = new THREE.Group()
    grp.position.set(SOFA.x, 0, SOFA.z)
    grp.rotation.y = -Math.PI / 2          // face à la pièce (−x)
    this.room.add(grp)
    const L = 2.0, D = 0.9, leg = 0.08
    const fab = this._fabricMat(COL.sofa)
    const legMat = this._mat('#3B2A1E', { roughness: 0.6 })
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const l = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.022, 0.016, leg, 10)), legMat)
      l.position.set(sx * (L / 2 - 0.1), leg / 2, sz * (D / 2 - 0.1)); l.castShadow = true
      grp.add(l)
    }
    const base = this._rbox(L, 0.28, D, 0.07, fab, 4)
    base.position.y = leg + 0.14
    const back = this._rbox(L, 0.5, 0.2, 0.08, fab, 4)
    back.position.set(0, leg + 0.28 + 0.2, -D / 2 + 0.1)
    grp.add(base, back)
    const arms = []
    for (const sx of [-1, 1]) {
      const a = this._rbox(0.22, 0.56, D, 0.1, fab, 4)
      a.position.set(sx * (L / 2 - 0.11), leg + 0.28, 0)
      grp.add(a); arms.push(a)
    }
    this.cushions = []
    for (const sx of [-1, 1]) {
      const seat = this._rbox(0.77, 0.17, D - 0.24, 0.075, fab, 4)
      seat.position.set(sx * 0.39, leg + 0.28 + 0.08, 0.07)
      const bc = this._rbox(0.76, 0.44, 0.19, 0.085, fab, 4)
      bc.position.set(sx * 0.39, leg + 0.28 + 0.17 + 0.2, -D / 2 + 0.25)
      bc.rotation.x = -0.14
      grp.add(seat, bc)
      this.cushions.push({ m: seat, y0: seat.position.y, s: new Spring(0, 200, 0.25) }, { m: bc, y0: bc.position.y, s: new Spring(0, 180, 0.3) })
    }
    // coussins décoratifs et plaid
    ;[[-0.66, COL.cushion1, 0.3], [0.62, COL.cushion2, -0.28]].forEach(([x, c, rz]) => {
      const p = this._rbox(0.36, 0.36, 0.12, 0.06, this._fabricMat(c), 4)
      p.position.set(x, leg + 0.28 + 0.17 + 0.2, -D / 2 + 0.38)
      p.rotation.set(-0.3, 0, rz)
      grp.add(p)
      this.cushions.push({ m: p, y0: p.position.y, s: new Spring(0, 160, 0.25) })
    })
    // plaid plié sur l'accoudoir du fond
    const plaidMat = this._fabricMat(COL.plaid)
    const plaid = this._rbox(0.25, 0.035, 0.5, 0.016, plaidMat)
    plaid.position.set(-L / 2 + 0.11, leg + 0.575, 0.08)
    const hang = this._rbox(0.025, 0.26, 0.5, 0.01, plaidMat)
    hang.position.set(-L / 2 - 0.012, leg + 0.46, 0.08)
    grp.add(plaid, hang)
    this._register('sofa', grp, 'Le canapé')
  }

  // ---- Table basse et panier ----------------------------------------------------------
  _buildTable() {
    const grp = new THREE.Group()
    grp.position.set(TABLE.x, 0, TABLE.z)
    this.room.add(grp)
    const topMat = this._woodMat(COL.walnut)
    const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(0.47, 0), new THREE.Vector2(0.5, 0.012), new THREE.Vector2(0.505, 0.03), new THREE.Vector2(0.49, 0.048), new THREE.Vector2(0, 0.05)]
    const top = new THREE.Mesh(this._geo(new THREE.LatheGeometry(prof, 56)), topMat)
    top.position.y = 0.38
    top.castShadow = true; top.receiveShadow = true
    grp.add(top)
    const legMat = this._woodMat('#5C3F29')
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI * 2 / 3 + 0.4
      const l = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.022, 0.016, 0.4, 10)), legMat)
      l.position.set(Math.cos(a) * 0.3, 0.19, Math.sin(a) * 0.3)
      l.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12)
      l.castShadow = true
      grp.add(l)
    }
    // tasse
    const mug = new THREE.Group()
    const cup = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.042, 0.036, 0.09, 20)), this._mat('#F2ECE0', { roughness: 0.4 }))
    cup.position.y = 0.045; cup.castShadow = true
    const tea = new THREE.Mesh(this._geo(new THREE.CircleGeometry(0.036, 20)), this._mat('#8A5A2B', { roughness: 0.2 }))
    tea.rotation.x = -Math.PI / 2; tea.position.y = 0.08
    const handle = new THREE.Mesh(this._geo(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI)), this._mat('#F2ECE0', { roughness: 0.4 }))
    handle.position.set(0.045, 0.045, 0); handle.rotation.z = -Math.PI / 2
    const band = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.0425, 0.0405, 0.015, 20, 1, true)), this._mat('#2B47B0'))
    band.position.y = 0.06
    mug.add(cup, tea, handle, band)
    mug.position.set(-0.22, 0.43, 0.14)
    grp.add(mug)
    // vapeur
    this.steam = []
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(0.05, 0.05)), new THREE.MeshBasicMaterial({ map: this.glow, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }))
      s.position.set(-0.22, 0.52, 0.14)
      s.userData.phase = k / 3
      grp.add(s)
      this.steam.push(s)
    }
    // pile de livres
    const st = this._bookStack()
    st.scale.setScalar(1.25)
    st.position.set(-0.12, 0.43, -0.22)
    st.rotation.y = 0.5
    grp.add(st)
    this._register('table', grp, 'La table basse')

  }

  // ---- Lampe -------------------------------------------------------------------------------
  _buildLamp() {
    const grp = new THREE.Group()
    grp.position.set(LAMP.x, 0, LAMP.z)
    this.room.add(grp)
    const dark = this._mat('#2E2A26', { roughness: 0.5 })
    const brass = this._mat(COL.brass, { metalness: 0.6, roughness: 0.35 })
    const base = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.15, 0.16, 0.03, 32)), dark)
    base.position.y = 0.015; base.castShadow = true
    const pole = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.012, 0.012, 1.42, 10)), brass)
    pole.position.y = 0.73; pole.castShadow = true
    this.shadeMat = this._mat('#F3E6CC', { roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color('#FFC874'), emissiveIntensity: 0 })
    const shade = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.15, 0.25, 0.3, 36, 1, true)), this.shadeMat)
    shade.position.y = 1.5; shade.castShadow = true
    this.bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0 })
    this.disposables.push(this.bulbMat)
    const bulb = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.045, 14, 10)), this.bulbMat)
    bulb.position.y = 1.44
    grp.add(base, pole, shade, bulb)
    this.lampLight = new THREE.PointLight(0xffc98a, 0, 5, 1.4)
    this.lampLight.position.set(LAMP.x, 1.38 * BIG.lamp, LAMP.z)
    this.scene.add(this.lampLight)
    this.lampGlow = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(1.4, 1.4)), new THREE.MeshBasicMaterial({ map: this.glow, color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
    this.lampGlow.position.set(LAMP.x, 1.5 * BIG.lamp, LAMP.z)
    this.scene.add(this.lampGlow)
    this.lampOn = new Spring(0, 60, 0.9)
    this._register('lamp', grp, 'La lampe')
  }

  setLamp(on) {
    this.lampState = on
    this.lampOn.t = on ? 1 : 0
  }

  // ---- Plante ------------------------------------------------------------------------------
  _buildPlant() {
    const grp = new THREE.Group()
    grp.position.set(PLANT.x, 0, PLANT.z)
    this.room.add(grp)
    const pr = []
    for (let k = 0; k <= 10; k++) { const t = k / 10; pr.push(new THREE.Vector2(0.13 + 0.05 * t + (k === 10 ? 0.012 : 0), t * 0.3)) }
    pr.push(new THREE.Vector2(0.17, 0.3))
    const pot = new THREE.Mesh(this._geo(new THREE.LatheGeometry(pr, 32)), this._mat(COL.pot, { roughness: 0.8 }))
    pot.castShadow = true; pot.receiveShadow = true
    const soil = new THREE.Mesh(this._geo(new THREE.CircleGeometry(0.17, 24)), this._mat('#4A3426', { roughness: 1 }))
    soil.rotation.x = -Math.PI / 2; soil.position.y = 0.28
    grp.add(pot, soil)
    const leafShape = new THREE.Shape()
    leafShape.moveTo(0, 0)
    leafShape.bezierCurveTo(0.1, 0.08, 0.1, 0.26, 0, 0.36)
    leafShape.bezierCurveTo(-0.1, 0.26, -0.1, 0.08, 0, 0)
    const leafGeo = this._geo(new THREE.ShapeGeometry(leafShape, 8))
    const mats = [this._mat(COL.leaf1, { side: THREE.DoubleSide, roughness: 0.7 }), this._mat(COL.leaf2, { side: THREE.DoubleSide, roughness: 0.7 })]
    const stemMat = this._mat('#4B6B3F')
    this.leaves = []
    rnd = 21
    for (let k = 0; k < 11; k++) {
      const a = k * 2.4 + rand() * 0.4
      const lean = 0.25 + rand() * 0.5
      const len = 0.35 + rand() * 0.45
      const end = new THREE.Vector3(Math.cos(a) * lean * len, 0.28 + len, Math.sin(a) * lean * len)
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.28, 0), new THREE.Vector3(0, 0.28 + len * 0.6, 0), end)
      const pivot = new THREE.Group()
      pivot.position.y = 0.28
      const stem = new THREE.Mesh(this._geo(new THREE.TubeGeometry(curve, 8, 0.006, 4)), stemMat)
      stem.position.y = -0.28
      const leaf = new THREE.Mesh(leafGeo, mats[k % 2])
      leaf.position.copy(end).add(new THREE.Vector3(0, -0.28, 0))
      leaf.rotation.set(-0.5 - rand() * 0.6, -a + Math.PI / 2, 0, 'YXZ')
      leaf.scale.setScalar(0.8 + rand() * 0.5)
      leaf.castShadow = true
      pivot.add(stem, leaf)
      grp.add(pivot)
      this.leaves.push({ pivot, phase: rand() * 6, sway: new Spring(0, 90, 0.18) })
    }
    this._register('plant', grp, 'La plante')
  }

  // ---- Fenêtre -------------------------------------------------------------------------
  _buildWindow() {
    const grp = new THREE.Group()
    grp.position.set(R, WINDOW.y, WINDOW.z)
    grp.rotation.y = Math.PI
    const lw = this.wallOf('right')
    lw.grp.add(grp)
    lw.decor.push(grp)
    const sky = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(WINDOW.w, WINDOW.h)), new THREE.MeshBasicMaterial({ map: this._track(skyTexture(this.mode)), toneMapped: false }))
    sky.rotation.y = Math.PI / 2
    sky.position.x = -T + 0.01
    grp.add(sky)
    const fm = this._mat('#FAF6EE', { roughness: 0.6 })
    const bar = (w, h, d, x, y, z) => { const b = this._rbox(w, h, d, 0.008, fm); b.position.set(x, y, z); grp.add(b); return b }
    const fw = 0.045
    bar(T + 0.03, fw, WINDOW.w + fw * 2, -T / 2, WINDOW.h / 2, 0)
    bar(T + 0.03, fw, WINDOW.w + fw * 2, -T / 2, -WINDOW.h / 2, 0)
    bar(T + 0.03, WINDOW.h, fw, -T / 2, 0, WINDOW.w / 2)
    bar(T + 0.03, WINDOW.h, fw, -T / 2, 0, -WINDOW.w / 2)
    bar(0.03, WINDOW.h, 0.025, -T / 2, 0, 0)
    bar(0.03, 0.025, WINDOW.w, -T / 2, 0.08, 0)
    bar(0.16, 0.035, WINDOW.w + 0.18, 0.05, -WINDOW.h / 2 - 0.03, 0)   // rebord
    // rideaux
    const cm = this._fabricMat(COL.curtain)
    cm.side = THREE.DoubleSide
    this.curtains = []
    for (const s of [-1, 1]) {
      const geo = this._geo(new THREE.PlaneGeometry(0.3, 1.62, 18, 1))
      const p = geo.attributes.position
      for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(p.getX(k) * 42) * 0.025)
      geo.computeVertexNormals()
      const c = new THREE.Mesh(geo, cm)
      c.rotation.y = Math.PI / 2
      c.position.set(0.06, -0.12, s * (WINDOW.w / 2 + 0.14))
      c.castShadow = true
      c.userData.side = s
      grp.add(c)
      this.curtains.push(c)
    }
    const rod = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.012, 0.012, WINDOW.w + 0.8, 10)), this._mat(COL.brass, { metalness: 0.6, roughness: 0.35 }))
    rod.rotation.x = Math.PI / 2
    rod.position.set(0.07, WINDOW.h / 2 + 0.14, 0)
    grp.add(rod)
    this._register('window', grp, 'Fermer les rideaux')
    this.sky = sky
    // rideaux fermés : pour mieux voir la projection (gardé d'une visite à l'autre)
    this.curtainsClosed = store('levana.salon.rideaux') === '1'
    this.curtainK = new Spring(this.curtainsClosed ? 1 : 0, 26, 0.9)
    this.curtainK.t = this.curtainK.v
    this._applyCurtains()
  }

  /** Le feu : bas (des braises, sa lumière ne gêne plus la projection) ou vif. */
  setFireLow(low) {
    this.fireLow = low
    this.firePower.base = low ? Math.min(this.fireFull, 0.28) : this.fireFull
    if (!low) this.firePower.vel += 4
    store('levana.salon.feu', low ? 'bas' : 'vif')
    const it = this.items.get('fire')
    if (it) it.label = low ? 'Raviver le feu' : 'Baisser le feu'
  }

  setCurtains(closed) {
    this.curtainsClosed = closed
    this.curtainK.t = closed ? 1 : 0
    store('levana.salon.rideaux', closed ? '1' : '0')
    this.cb.onCinema?.(closed)
    const it = this.items.get('window')
    if (it) it.label = closed ? 'Ouvrir les rideaux' : 'Fermer les rideaux'
  }

  _applyCurtains() {
    const k = clamp(this.curtainK.v, 0, 1)
    for (const c of this.curtains) {
      const s = c.userData.side
      // ouverts : de chaque côté ; fermés : ils se rejoignent au milieu de la fenêtre
      c.position.z = s * ((WINDOW.w / 2 + 0.14) * (1 - k) + (WINDOW.w / 4 - 0.05) * k)
      c.scale.x = 1 + 0.32 * k
    }
    if (this.sky) this.sky.material.color.setScalar(1 - 0.75 * k)
    this.dimK = k
  }

  // ---- Caméra ------------------------------------------------------------------------------
  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1
    this.w = w; this.h = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.dist = this._fitDistance()
  }

  /** Distance qui fait tenir toute la maquette à l'écran, quel que soit l'angle. */
  _fitDistance() {
    const pts = []
    for (const x of [-R - T, R + T]) for (const y of [-FT, H + 0.05]) for (const z of [-R - T, R + T]) pts.push(new THREE.Vector3(x, y, z))
    const margin = this.cb.margins?.() || { top: 0.12, bottom: 0.14, side: 0.06 }
    const fits = d => {
      for (let k = 0; k < 8; k++) { const az = AZ0 + (k * Math.PI) / 4
        this._placeCamera(az, EL0, d, TARGET0)
        this.camera.updateMatrixWorld()
        for (const p of pts) {
          const v = p.clone().project(this.camera)
          if (Math.abs(v.x) > 1 - margin.side * 2 || v.y > 1 - margin.top * 2 || v.y < -1 + margin.bottom * 2) return false
        }
      }
      return true
    }
    let lo = 4, hi = 40
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid }
    return hi
  }

  _placeCamera(az, el, dist, target) {
    const c = this.camera
    c.position.set(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist)
    c.lookAt(target)
  }

  // ---- Le vrai mur de livres, en miniature ----------------------------------------------
  /**
   * Copie fidèle du mur de la bibliothèque : mêmes rayons, mêmes livres, mêmes matières,
   * portes dans le même état. Les objets (géométries, matières, couvertures) sont partagés ;
   * seules leurs positions sont recopiées à chaque image.
   */
  setWall(lib) {
    this._clearMirror()
    if (!lib?.layout || !lib.caseParts || !lib.rowCount || !lib.root) return false
    const src = lib.root
    const copy = src.clone(true)
    const pairs = [], map = new Map()
    const walk = (a, b) => { pairs.push([a, b]); map.set(a, b); a.children.forEach((c, i) => walk(c, b.children[i])) }
    walk(src, copy)
    const { CW } = lib.layout
    const totalH = lib.rowCount * (RH + PT) + PT
    // au plus 4 étagères dans le salon (celles du haut, là où l'on entre) : le reste est coupé sous le plancher
    const cutY = lib.rowCount > SALON_ROWS ? lib.rowBase(SALON_ROWS - 1) - PT : 0
    const sc = Math.min(2.8 / (totalH - cutY + 0.1), (2 * R - 1.3) / (CW + 2 * ST + 0.06))
    const hw = (CW / 2 + ST + 0.04) * sc     // demi-largeur (sur x)
    const g = new THREE.Group()
    // contre le mur du fond, entre le coin gauche et le meuble télé
    g.position.set(clamp(-0.45, -R + 0.1 + hw, R - 1.0 - hw), -cutY * sc, -R + 0.012 + (SD / 2 + 0.02) * sc)
    g.scale.setScalar(sc)
    g.add(copy)
    this.room.add(g)
    g.updateMatrixWorld(true)
    // portes et livres découpés aux montants : leurs plans de découpe suivent le meuble du salon
    const clones = new Map()
    const fix = m => {
      if (!m?.clippingPlanes?.length) return m
      let c = clones.get(m)
      if (!c) {
        c = m.clone()
        c.clippingPlanes = m.clippingPlanes.map(pl => pl.clone().applyMatrix4(g.matrixWorld))
        clones.set(m, c)
      }
      return c
    }
    copy.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material) })
    const doors = [...clones.entries()]
    const hits = []
    const tops = new Set(copy.children.flatMap(grp => grp.children))   // un objet par rayon / livre / porte
    const shown = c => !tops.has(c) || c.position.y >= cutY - 1e-3
    copy.traverse(o => {
      o.layers.enable(1)
      if (tops.has(o)) o.visible = o.visible && shown(o)
    })
    copy.children.forEach(grp => grp.children.forEach(c => {
      if (!shown(c)) return
      c.traverse(o => { if (o.isMesh) { o.userData = { ...o.userData, kind: 'bookcase' }; hits.push(o) } })
    }))
    copy.children.forEach(grp => { if (grp.isMesh) hits.push(grp) })
    // lumières de la bibliothèque, attachées au meuble (même direction par rapport aux livres)
    const lk = this.libKey
    g.add(lk, lk.target, this.libFill, this.libFill.target)
    lk.position.copy(lib.key.position); lk.target.position.copy(lib.key.target.position)
    const sh = lib.key.shadow
    Object.assign(lk.shadow.camera, { left: sh.camera.left * sc, right: sh.camera.right * sc, top: sh.camera.top * sc, bottom: sh.camera.bottom * sc, near: sh.camera.near * sc, far: sh.camera.far * sc })
    lk.shadow.camera.updateProjectionMatrix()
    lk.shadow.bias = sh.bias
    lk.shadow.normalBias = sh.normalBias * sc
    this.libFill.position.set(5, 2, 3); this.libFill.target.position.set(0, 0, 0)
    this.mirror = { lib, g, copy, pairs, doors, hits, sc, tops, cutY, sig: this._wallSig(lib) }
    this.bookcase.visible = false
    const bw = this.wallOf('back')
    if (bw) this._applyCut(bw)
    this.shadowDirty = 2
    return true
  }

  _clearMirror() {
    const m = this.mirror
    if (!m) return
    this.scene.add(this.libKey, this.libKey.target, this.libFill, this.libFill.target)
    this.room.remove(m.g)
    m.doors.forEach(([, c]) => c.dispose())
    this.mirror = null
    this.bookcase.visible = true
  }

  _wallSig(lib) {
    const ids = [lib.rowCount, lib.layout?.CW]
    for (const grp of [lib.caseGroup, lib.doorsGroup, lib.booksGroup]) {
      ids.push('|')
      for (const c of grp.children) ids.push(c.id, c.children[0]?.children.length || 0)
    }
    return ids.join(',')
  }

  /** Suit le mur de la bibliothèque (positions, portes, couvertures arrivées). */
  _syncMirror() {
    const lib = this.cb.getLibrary?.()
    if (!lib || lib.disposed) return
    const m = this.mirror
    if (!m || m.lib !== lib) {
      if (this.time >= (this.nextWallTry || 0)) { this.nextWallTry = this.time + 0.3; this.setWall(lib) }
      return
    }
    if (this._wallSig(lib) !== m.sig) { this.setWall(lib); return }
    for (const [o, c] of m.pairs) {
      if (o === lib.root) continue
      c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale)
      c.visible = o.visible && (!m.tops.has(c) || o.position.y >= m.cutY - 1e-3)
    }
    for (const [om, cm] of m.doors) {
      cm.color.copy(om.color)
      if (cm.map !== om.map) { cm.map = om.map; cm.needsUpdate = true }
    }
    if (lib.running) this.shadowDirty = Math.max(this.shadowDirty, 1)
  }

  _hits() {
    if (!this.mirror) return this.hitMeshes
    return this.hitMeshes.filter(h => !isUnder(h, this.bookcase)).concat(this.mirror.hits)
  }

  // ---- Caméra : du salon à la vue exacte de la bibliothèque ------------------------------
  _salonPose(az, el, dist, target) {
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), a = this.camera.aspect
    return { target: target.clone(), az, el, dist, fr: { l: -t * a, r: t * a, t, b: -t } }
  }

  /** La caméra de la bibliothèque, transposée sur le meuble du salon, cadrée sur sa toile. */
  _libraryPose() {
    const { lib, g } = this.mirror
    const lc = lib.camera
    lc.updateMatrixWorld()
    g.updateMatrixWorld(true)
    const pos = lc.position.clone().applyMatrix4(g.matrixWorld)
    const target = lib.key.target.position.clone().applyMatrix4(g.matrixWorld)   // point visé par la bibliothèque
    const off = pos.clone().sub(target)
    const dist = off.length()
    const az = Math.atan2(off.x, off.z), el = Math.asin(clamp(off.y / dist, -1, 1))
    const R = lib.renderer.domElement.getBoundingClientRect()
    const S = this.renderer.domElement.getBoundingClientRect()
    const u = (2 * Math.tan(THREE.MathUtils.degToRad(lc.fov / 2))) / Math.max(1, R.height)
    const cx = R.left + R.width / 2, cy = R.top + R.height / 2
    return { target, az, el, dist, fr: { l: (S.left - cx) * u, r: (S.right - cx) * u, t: (cy - S.top) * u, b: (cy - S.bottom) * u }, R, S }
  }

  /** Entre deux vues : le point visé glisse, la caméra tourne autour de lui (jamais à travers les murs). */
  _applyPose(a, b, e) {
    const c = this.camera
    const tgt = a.target.clone().lerp(b.target, e)
    const az = a.az + shortAngle(a.az, b.az) * e
    const el = a.el + (b.el - a.el) * e
    const dist = Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * e)
    this._placeCamera(az, el, dist, tgt)
    const f = k => a.fr[k] + (b.fr[k] - a.fr[k]) * e
    const n = 0.05
    c.projectionMatrix.makePerspective(f('l') * n, f('r') * n, f('t') * n, f('b') * n, n, 80)
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert()
    c.updateMatrixWorld()
  }

  /** Le salon s'efface autour du meuble (0 : salon entier, 1 : il ne reste que la bibliothèque). */
  _setFade(d) {
    if (d <= 0) {
      if (this.fadeList) {
        for (const f of this.fadeList) { f.m.opacity = f.op; f.m.depthWrite = f.dw; if (f.m.transparent !== f.tr) { f.m.transparent = f.tr; f.m.needsUpdate = true } }
        this.fadeList = null
      }
      this.fade = 0
      return
    }
    if (!this.fadeList) {
      const skip = new Set([this.ember.material, this.lampGlow.material, ...this.steam.map(x => x.material), ...this.flames.map(x => x.material), ...this.candles.map(x => x.material)])
      const seen = new Set(), list = []
      this.scene.traverse(o => {
        if (!o.isMesh || (this.mirror && isUnder(o, this.mirror.g))) return
        for (const m of [].concat(o.material)) {
          if (seen.has(m) || skip.has(m)) continue
          seen.add(m); list.push({ m, op: m.opacity, tr: m.transparent, dw: m.depthWrite })
        }
      })
      this.fadeList = list
    }
    for (const f of this.fadeList) {
      if (!f.m.transparent) { f.m.transparent = true; f.m.needsUpdate = true }
      f.m.depthWrite = false
      f.m.opacity = f.op * (1 - d)
    }
    this.fade = d
  }

  /** Découpe la vue au cadre exact de la bibliothèque (0 : plein écran, 1 : son cadre). */
  _setClip(c, R, S) {
    const st = this.container.style
    if (c <= 0 || !R) { if (st.clipPath) st.clipPath = ''; return }
    st.clipPath = `inset(${(R.top - S.top) * c}px ${(S.right - R.right) * c}px ${(S.bottom - R.bottom) * c}px ${(R.left - S.left) * c}px)`
  }

  /** On s'approche de la bibliothèque jusqu'à la voir exactement comme dans la bibliothèque. */
  enter(onDone) {
    if (this.fly) return
    // on regardait le tuto : on revient d'abord dans le salon, puis on entre
    if (this.tvZoom) { this.pendingEnter = onDone || null; this.unzoomTv(); return }
    const lib = this.cb.getLibrary?.()
    if (lib && (!this.mirror || this.mirror.lib !== lib)) this.setWall(lib)
    const start = { az: this.az.v + (this.lastDrift || 0), el: this.el.v, dist: this.dist, target: this.target.clone() }
    if (!this.mirror) {
      // bibliothèque pas encore prête : simple approche
      this.fly = { legacy: true, from: start, to: this._bookcaseView(), t: 0, dur: 1.15, onDone }
      return
    }
    this._libraryToTop()
    this.fly = { dir: 'in', start, t: 0, dur: 1.7, onDone }
    this._setHover(null)
  }

  /** Retour depuis la bibliothèque : on part de sa vue exacte et le salon apparaît autour. */
  arriveFromLibrary() {
    const lib = this.cb.getLibrary?.()
    if (lib) this.setWall(lib)
    if (!this.mirror) return
    // on part de la vue exacte où l'on était dans la bibliothèque…
    this.fly = { dir: 'out', start: { az: AZ0, el: EL0, dist: this.dist, target: TARGET0.clone() }, t: 0, dur: 1.6, libPose: this._libraryPose() }
    this._stepFly(0)
  }

  /** La bibliothèque se présente toujours par le haut, vue de près. */
  _libraryToTop() {
    const lib = this.mirror?.lib
    if (!lib?.scroll) return
    const top = lib._clampScroll(Infinity)
    if (Math.abs(lib.scroll.v - top) < 1e-3 && lib.zoom.v > 0.999) return
    lib.scroll.snap(top); lib.zoom.snap(1)
    lib.cb.onZoom?.(1)
    lib.camDirty = true
    lib.kick()
  }

  _stepFly(dt) {
    const f = this.fly
    if (f.legacy) {
      f.t += dt / f.dur
      const k = Math.min(1, f.t)
      this._applyFly(k)
      this._placeCamera(this.az.v, this.el.v, this.flyDist, this.target)
      if (k >= 1 && !f.called) { f.called = true; f.onDone?.() }
      return
    }
    f.t += dt / f.dur
    const k = Math.min(1, f.t)
    const p = f.dir === 'in' ? k : 1 - k          // 0 : salon ; 1 : bibliothèque
    const a = this._salonPose(f.start.az, f.start.el, f.start.dist, f.start.target)
    const b = f.libPose || this._libraryPose()
    this._applyPose(a, b, ease(p))
    this.shadowDirty = Math.max(this.shadowDirty, 1)
    if (k >= 1) {
      if (f.dir === 'in') { if (!f.called) { f.called = true; f.onDone?.() } return }
      // arrivé dans le salon : on rend la main
      this.fly = null
      this.az.snap(AZ0); this.el.snap(EL0); this.target.copy(TARGET0)
      this.camera.updateProjectionMatrix()
      this.idleAt = this.time
      // la caméra est arrêtée : la bibliothèque remonte en haut (les étagères du haut s'ouvrent,
      // celles du bas se ferment : c'est par le haut qu'on entrera la prochaine fois)
      const lib = this.mirror?.lib
      if (lib && !lib.disposed) { lib.setZoom(true); lib.scrollToTop() }
    }
  }

  /** Vue rapprochée (secours, quand la bibliothèque n'est pas encore là). */
  _bookcaseView() {
    const center = new THREE.Vector3(BOOKCASE.x, 1.12, BOOKCASE.z + BOOKCASE.d / 2)
    return { target: center, az: 0.2, el: 0.05, dist: 2.3 }
  }

  _applyFly(k) {
    const { from, to } = this.fly
    const e = ease(k)
    this.target.lerpVectors(from.target, to.target, e)
    this.az.snap(from.az + (to.az - from.az) * e)
    this.el.snap(from.el + (to.el - from.el) * e)
    this.flyDist = from.dist + (to.dist - from.dist) * e
  }

  // ---- Entrées -----------------------------------------------------------------------------
  _bindEvents() {
    const el = this.renderer.domElement
    el.style.touchAction = 'none'
    const pick = (x, y) => {
      const r = el.getBoundingClientRect()
      this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
      this.raycaster.setFromCamera(this.ndc, this.camera)
      const hit = this.raycaster.intersectObjects(this._hits(), false)[0]
      if (!hit) return null
      const c = this.bubbles?.tv?.close
      if (hit.object.userData.kind === 'tvbubble' && c && hit.uv && hit.uv.x >= c.u0 && hit.uv.y >= c.v0) return 'tvbubble-close'
      return hit.object.userData.kind
    }
    this._pick = pick
    this._down = e => {
      if (this.fly) return
      el.setPointerCapture?.(e.pointerId)
      this.pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), drag: false, vx: 0, vy: 0, lt: performance.now() }
      this.idleAt = this.time
    }
    this._move = e => {
      const p = this.pointer
      if (p && p.id === e.pointerId) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y
        if (!p.drag && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 7) { p.drag = true; this._setHover(null) }
        if (p.drag && !this.tvZoom) {
          const k = 2.6 / Math.max(320, this.w)
          this.az.t = this.az.t - dx * k      // tour complet autour de la pièce
          this.el.t = clamp(this.el.t + dy * k * 0.8, EL_MIN - 0.05, EL_MAX + 0.05)
          const now = performance.now(), dt = Math.max(1, now - p.lt)
          p.vx = p.vx * 0.6 + (dx / dt) * 0.4; p.vy = p.vy * 0.6 + (dy / dt) * 0.4; p.lt = now
        }
        p.x = e.clientX; p.y = e.clientY
        this.idleAt = this.time
        return
      }
      if (e.pointerType === 'mouse' && !this.fly && !this.tvZoom) this.hoverXY = { x: e.clientX, y: e.clientY }
    }
    this._up = e => {
      const p = this.pointer
      if (!p || p.id !== e.pointerId) return
      this.pointer = null
      if (this.tvZoom) return
      if (p.drag) {
        const k = 2.6 / Math.max(320, this.w)
        this.az.t = this.az.t - p.vx * 160 * k
        this.el.t = clamp(this.el.t + p.vy * 120 * k * 0.8, EL_MIN, EL_MAX)
        return
      }
      if (performance.now() - p.t0 > 700) return
      const kind = pick(e.clientX, e.clientY)
      if (kind) this.tap(kind)
    }
    this._leave = () => { this.hoverXY = null; this._setHover(null) }
    el.addEventListener('pointerdown', this._down)
    window.addEventListener('pointermove', this._move)
    window.addEventListener('pointerup', this._up)
    window.addEventListener('pointercancel', this._up)
    el.addEventListener('pointerleave', this._leave)
  }

  _setHover(kind, x, y) {
    if (kind === this.hover?.kind && kind) { this.cb.onHover?.(kind ? { kind, label: this.items.get(kind)?.label, x, y } : null); return }
    const prev = this.hover?.kind
    this.hover = kind ? { kind } : null
    this.renderer.domElement.style.cursor = kind ? 'pointer' : ''
    if (kind === 'bookcase' && prev !== 'bookcase') this.wave(0)
    this.cb.onHover?.(kind ? { kind, label: this.items.get(kind)?.label, x, y } : null)
  }

  /** Ce que fait chaque objet quand on le touche. */
  tap(kind) {
    const it = this.items.get(kind)
    if (it) it.bounce.vel += kind === 'bookcase' ? 0.6 : 1.4
    this.shadowDirty = 2
    switch (kind) {
      case 'bookcase': this.cb.onEnter?.(); break
      case 'fire': this.setFireLow(!this.fireLow); this.cb.onTap?.(kind); break
      case 'window': this.setCurtains(!this.curtainsClosed); break
      case 'lamp': this.setLamp(!this.lampState); break
      case 'sofa': this.cushions.forEach((c, i) => { c.s.vel -= 1.1 + (i % 3) * 0.2 }); break
      case 'plant': this.leaves.forEach((l, i) => { l.sway.vel += (i % 2 ? 1 : -1) * 3 }); break
      case 'tv': case 'projector': if (!this.tvZoom) this.zoomTv('tv'); break
      case 'cabinet': if (!this.tvZoom) this.zoomTv('cab'); break
      case 'tvbubble': this.zoomTv(); break
      case 'tvbubble-close': this.tvBubbleOn = false; this.cb.onTvBubbleClose?.(); break
      default: this.cb.onTap?.(kind)
    }
  }

  // ---- Boucle ------------------------------------------------------------------------------
  _loop(now) {
    this.raf = requestAnimationFrame(this._loop)
    if (document.hidden) return
    const dt = clamp((now - this.last) / 1000, 0, 0.05) || 0.016
    this.last = now
    this.time += dt
    this._adapt(dt)
    const sub = 3, h = dt / sub

    // le mur de la bibliothèque, recopié
    this._syncMirror()
    // caméra
    if (this.fly) {
      this._stepFly(dt)
    } else if (this.tvZoom) {
      this._stepTvZoom(dt)
    } else {
      if (!this.pointer) {
        this.el.t = clamp(this.el.t, EL_MIN, EL_MAX)
      }
      for (let i = 0; i < sub; i++) { this.az.step(h); this.el.step(h) }
      const idle = this.pointer ? 0 : clamp((this.time - (this.idleAt || 0) - 2) / 3, 0, 1)
      this.lastDrift = Math.sin(this.time * 0.23) * 0.035 * idle
      this._placeCamera(this.az.v + this.lastDrift, this.el.v, this.dist, this.target)
    }
    // lumières : salon → bibliothèque
    const sal = 1 - this.mix
    // rideaux : on avance doucement, la pièce s'assombrit un peu
    if (this.curtainK && !this.curtainK.done) { for (let i = 0; i < sub; i++) this.curtainK.step(h); this._applyCurtains(); this.shadowDirty = Math.max(this.shadowDirty, 1) }
    // rideaux fermés : la pièce passe en « mode cinéma », la lumière baisse franchement
    const dim = 1 - 0.5 * (this.dimK || 0)
    this.hemi.intensity = this.baseLights.hemi * sal * dim
    this.key.intensity = this.baseLights.key * sal * (1 - 0.7 * (this.dimK || 0))
    this.fill.intensity = this.baseLights.fill * sal
    this.libHemi.intensity = 1.35 * this.mix
    this.libKey.intensity = 1.55 * this.mix
    this.libFill.intensity = 0.35 * this.mix
    const vis = 1 - (this.fade || 0)

    // murs : celui qui est entre la caméra et la pièce s'abaisse (petite bordure), les autres se relèvent
    {
      const cp = this.camera.position
      const dx = cp.x, dz = cp.z, len = Math.hypot(dx, dz) || 1
      for (const w of this.walls) {
        const facing = (w.n.x * dx + w.n.z * dz) / len
        // pendant le zoom sur la télé, les murs restent comme ils sont (sinon la télé s'aplatirait)
        if (!this.tvZoom) w.cut.t = facing > 0.2 ? 0.07 : 1
        if (!this.wallsReady) w.cut.snap(w.cut.t)          // à l'ouverture : déjà en place, sans animation
        if (!w.cut.done || !this.wallsReady) {
          for (let i = 0; i < sub; i++) w.cut.step(h)
          this._applyCut(w)
          this.shadowDirty = Math.max(this.shadowDirty, 1)
        }
      }
      this.wallsReady = true
    }

    // survol à la souris
    if (this.hoverXY && !this.pointer && !this.fly && !this.tvZoom) {
      const kind = this._pick(this.hoverXY.x, this.hoverXY.y)
      this._setHover(kind, this.hoverXY.x, this.hoverXY.y)
    }

    // rebonds des objets
    let moving = false
    for (const it of this.items.values()) {
      for (let i = 0; i < sub; i++) it.bounce.step(h)
      const b = it.bounce.v
      const hov = this.hover?.kind === it.kind && it.kind !== 'bookcase' ? 1 : 0
      it.hov = (it.hov || 0) + (hov - (it.hov || 0)) * Math.min(1, dt * 10)
      const sy = 1 + b * 0.06 + it.hov * 0.012
      const sxz = 1 - b * 0.03
      const k = it.group.userData.k ?? 1
      it.group.scale.set(sxz * k, Math.max(0.001, k * sy * (it.group.userData.cutF ?? 1)), sxz * k)
      if (Math.abs(b) > 1e-3 || Math.abs(it.bounce.vel) > 1e-3) moving = true
    }
    // coussins
    for (const c of this.cushions) {
      for (let i = 0; i < sub; i++) c.s.step(h)
      c.m.position.y = c.y0 + c.s.v * 0.035
      c.m.scale.y = 1 + c.s.v * 0.12
      if (!c.s.done) moving = true
    }
    // livres : la vague
    if (this.waveAt != null) {
      const el = this.time - this.waveAt
      let any = false
      for (const b of this.shelfBooks) {
        const t0 = b.order * 0.012
        const on = el > t0 && el < t0 + 0.22
        b.out.t = on ? 0.05 : 0
        if (el < t0 + 0.22) any = true
      }
      if (!any) this.waveAt = null
    } else if (this.hover?.kind === 'bookcase' && this.time - (this.lastWave || 0) > 3.2) {
      this.lastWave = this.time; this.wave(0)
    } else if (!this.hover && this.time - (this.lastWave || 0) > 9) {
      this.lastWave = this.time; this.wave(0)
    }
    for (const b of this.shelfBooks) {
      if (b.out.t === 0 && b.out.done) { if (b.out.v !== 0) { b.out.snap(0); b.mesh.position.z = b.z0 } continue }
      for (let i = 0; i < sub; i++) b.out.step(h)
      b.mesh.position.z = b.z0 + b.out.v
      moving = true
    }
    // plante
    for (const l of this.leaves) {
      for (let i = 0; i < sub; i++) l.sway.step(h)
      l.pivot.rotation.z = Math.sin(this.time * 0.9 + l.phase) * 0.018 + l.sway.v * 0.06
      l.pivot.rotation.x = Math.cos(this.time * 0.7 + l.phase) * 0.012
    }
    // feu
    for (let i = 0; i < sub; i++) this.firePower.step(h)
    this.firePower.t = this.firePower.base
    const flick = 0.82 + 0.1 * Math.sin(this.time * 9.1) + 0.06 * Math.sin(this.time * 23.7 + 1.3) + 0.05 * Math.sin(this.time * 5.3)
    const fp = Math.max(0.2, this.firePower.v)
    const cam = this.camera.position
    for (const f of this.flames) {
      f.material.uniforms.uTime.value = this.time
      f.material.uniforms.uPower.value = Math.min(1.6, fp) * vis
      f.scale.set(1, 0.85 + 0.25 * fp, 1)
      f.getWorldPosition(tmp)
      f.rotation.y = Math.atan2(cam.x - tmp.x, cam.z - tmp.z)
    }
    for (const f of this.candles) {
      f.material.uniforms.uTime.value = this.time * 1.3
      f.material.uniforms.uPower.value = vis
      f.getWorldPosition(tmp)
      f.rotation.y = Math.atan2(cam.x - tmp.x, cam.z - tmp.z)
    }
    const fireOn = this.wallOf('front').f ?? 1
    this.fireLight.intensity = 3.2 * fp * flick * sal * fireOn
    this.ember.material.opacity = (0.65 + 0.25 * flick) * vis
    // lampe
    for (let i = 0; i < sub; i++) this.lampOn.step(h)
    const lo = clamp(this.lampOn.v, 0, 1.2)
    this.lampLight.intensity = 2.6 * lo * sal * (1 - (this.lampHide || 0))
    this.shadeMat.emissiveIntensity = 0.75 * lo * sal
    this.bulbMat.color.setRGB(0.55 + 0.45 * lo, 0.52 + 0.42 * lo, 0.45 + 0.35 * lo)
    this.lampGlow.material.opacity = 0.28 * lo * vis * (1 - (this.lampHide || 0))
    this.lampGlow.quaternion.copy(this.camera.quaternion)
    if (!this.lampOn.done) moving = true
    // vapeur de la tasse
    for (const s of this.steam) {
      const t = (this.time * 0.35 + s.userData.phase) % 1
      s.position.y = 0.5 + t * 0.22
      s.position.x = -0.22 + Math.sin(t * 6 + s.userData.phase * 9) * 0.02
      s.material.opacity = Math.sin(t * Math.PI) * 0.22 * vis
      s.scale.setScalar(0.6 + t * 1.2)
      s.quaternion.copy(this.camera.quaternion)
    }
    // télé : nos séries défilent (plus fluide pendant qu'on s'en approche)
    // le faisceau du projecteur : seulement quand la toile est bien visible (son mur relevé)
    if (this.beam) this.beam.visible = (this.wallOf('left').f ?? 1) > 0.9 && !this.fly
    this._placeTvVideo()
    if (this.inTv) return           // on est dans la télé : le module des séries recouvre tout
    if (this.series.update(dt)) this._emitSlide()
    this.tvAcc = (this.tvAcc || 0) + dt
    if (this.tvAcc >= (this.tvZoom ? 1 / 30 : 1 / 12)) { this.tvAcc = 0; this._drawTv() }
    this._placeBubbles(dt)

    if (moving) this.shadowDirty = Math.max(this.shadowDirty, 1)
    if (this.shadowDirty > 0) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty-- }
    this.renderer.render(this.scene, this.camera)
  }

  /** Téléphone lent : on baisse la définition plutôt que de saccader. */
  _adapt(dt) {
    this.frames++
    if (this.frames < 20 || this.dpr <= 1) return
    this.slow = this.slow * 0.95 + (dt > 0.03 ? 1 : 0) * 0.05
    if (this.slow > 0.5) {
      this.dpr = Math.max(1, this.dpr - 0.5)
      this.renderer.setPixelRatio(this.dpr)
      this.resize()
      this.slow = 0
    }
  }

  /** Position à l'écran de la bibliothèque (pour la transition vers le mur de livres). */
  bookcaseRect() {
    const box = new THREE.Box3().setFromObject(this.bookcaseInner)
    const r = this.renderer.domElement.getBoundingClientRect()
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const v = new THREE.Vector3(x, y, z).project(this.camera)
      const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
    }
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this._ro?.disconnect()
    document.removeEventListener('visibilitychange', this._onVis)
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this._down)
    window.removeEventListener('pointermove', this._move)
    window.removeEventListener('pointerup', this._up)
    window.removeEventListener('pointercancel', this._up)
    el.removeEventListener('pointerleave', this._leave)
    this._clearMirror()      // les objets du mur appartiennent à la bibliothèque : on ne les libère pas
    this.disposables.forEach(d => d.dispose?.())
    this.libKey.dispose?.(); this.key.dispose?.()
    this.renderer.dispose()
    el.remove()
  }
}

const tmp = new THREE.Vector3()

function hashId(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}


/** Rectangle aux coins arrondis, à plat (tapis). */
class RoundedPlane extends THREE.ShapeGeometry {
  constructor(w, h, r) {
    const s = new THREE.Shape()
    s.moveTo(-w / 2 + r, -h / 2)
    s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
    super(s, 6)
    // UV de 0 à 1 sur tout le tapis
    const p = this.attributes.position, uv = this.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h)
  }
}

// ---- Un rectangle w × h déformé pour rejoindre quatre points (matrix3d CSS) -----------------
function adj(m) {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ]
}
function mulMM(a, b) {
  const c = new Array(9)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0
    for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]
    c[3 * i + j] = s
  }
  return c
}
const mulMV = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
function basis(p) {
  const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1]
  const v = mulMV(adj(m), [p[6], p[7], 1])
  return mulMM(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]])
}
function quadMatrix(w, h, dst) {
  const t = mulMM(basis(dst), adj(basis([0, 0, w, 0, w, h, 0, h])))
  if (!t[8] || !t.every(Number.isFinite)) return null
  for (let i = 0; i < 9; i++) t[i] /= t[8]
  return [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]].join(',')
}

// ---- Préférences du salon (rideaux, feu) --------------------------------------------------
function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch { /* ignore */ }
  return null
}

/** Masque de l'image projetée : pleine au centre, fondue sur les bords (la lumière s'étale). */
function featherTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 144
  const g = c.getContext('2d')
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 144)
  g.filter = 'blur(5px)'
  g.fillStyle = '#fff'; g.fillRect(9, 9, 238, 126)
  const t = new THREE.CanvasTexture(c)
  return t
}

/** Le halo de lumière autour de l'image, sur le mur. */
function projGlowTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160
  const g = c.getContext('2d')
  const r = g.createRadialGradient(128, 80, 20, 128, 80, 128)
  r.addColorStop(0, 'rgba(255,246,226,0.55)'); r.addColorStop(0.55, 'rgba(255,240,215,0.22)'); r.addColorStop(1, 'rgba(255,240,215,0)')
  g.fillStyle = r; g.fillRect(0, 0, 256, 160)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---- La vitrine du meuble télé -------------------------------------------------------------
const CASE_COLORS = [
  ['#1C1A17', '#EDE3CC'], ['#ECE2CB', '#1C1A17'], ['#6E1F1A', '#F1E4C8'], ['#1F3A2E', '#E9DFC9'],
  ['#1E2B4A', '#EBDDB6'], ['#B5832E', '#1C1A17'], ['#5A3B26', '#EADCC0'], ['#3B3A37', '#E4D9C2'],
  ['#C9BFAA', '#2A2620'], ['#8C2F22', '#F3E7CF'],
]
function hashName(n) { let h = 0; for (const c of n || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

/** Le verre des portes : presque transparent, un reflet en biais. */
function glassTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(220,235,245,0.10)'; g.fillRect(0, 0, 256, 64)
  const r = g.createLinearGradient(0, 0, 256, 64)
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.35, 'rgba(255,255,255,0)'); r.addColorStop(0.42, 'rgba(255,255,255,0.22)')
  r.addColorStop(0.5, 'rgba(255,255,255,0.05)'); r.addColorStop(0.58, 'rgba(255,255,255,0.14)'); r.addColorStop(0.64, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 256, 64)
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 62)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
