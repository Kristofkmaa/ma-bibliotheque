import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { tmdbImgCors, loadImage, year, isMovie } from '../lib/tmdb'

/**
 * L'étagère de nos films et séries, en vraie 3D : de vrais boîtiers de Blu-ray (épais, en
 * plastique brillant, l'affiche sous le film, la tranche titrée), posés en arc sur un sol qui
 * les reflète. Celui du milieu est de face ; les autres montrent leur tranche, tournés vers lui.
 * On fait défiler au doigt, à la molette, aux flèches (la position vient du parent) ; à la
 * souris, le boîtier du milieu suit un peu le pointeur.
 */

// les proportions d'un boîtier Blu-ray (135 × 171 × 12 mm)
const CW = 1.35, CH = 1.71, CD = 0.14
const GAP = 0.025
const ARC = 7                         // rayon de l'arc
const FOV = 30
const SPINE_BG = '#1B3F8F'            // le plastique bleu des boîtiers

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ease = t => 1 - Math.pow(1 - t, 3)

/** La WebGL marche-t-elle ici ? (sinon on garde l'étagère en CSS) */
export function canWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch { return false }
}

function frontCanvas(s) {
  const c = document.createElement('canvas'); c.width = 540; c.height = 684
  const g = c.getContext('2d')
  g.fillStyle = '#101216'; g.fillRect(0, 0, c.width, c.height)
  const band = 52
  const bg = g.createLinearGradient(0, 0, c.width, 0)
  bg.addColorStop(0, '#2457C5'); bg.addColorStop(1, '#173C93')
  g.fillStyle = bg; g.fillRect(0, 0, c.width, band)
  g.fillStyle = '#fff'; g.font = '800 24px "Inter Tight", system-ui, sans-serif'; g.textBaseline = 'middle'
  g.fillText(isMovie(s) ? 'FILM' : 'SÉRIE', 22, band / 2 + 1)
  g.textAlign = 'right'; g.font = '600 22px "Inter Tight", system-ui, sans-serif'
  g.fillText(year(s) || '', c.width - 22, band / 2 + 1)
  g.textAlign = 'left'
  // sans affiche : le titre
  g.fillStyle = '#1D2028'; g.fillRect(0, band, c.width, c.height - band)
  g.fillStyle = '#E9E4DA'; g.font = '800 46px "Inter Tight", system-ui, sans-serif'
  wrapText(g, s.name || '', 36, band + 120, c.width - 72, 54)
  return c
}

function drawPoster(c, img) {
  const g = c.getContext('2d'), band = 52
  const W = c.width, H = c.height - band
  const r = Math.max(W / img.naturalWidth, H / img.naturalHeight)
  const sw = W / r, sh = H / r
  g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, band, W, H)
  // le reflet du plastique, et le liseré du bord
  const sheen = g.createLinearGradient(0, 0, W, c.height)
  sheen.addColorStop(0, 'rgba(255,255,255,0.10)'); sheen.addColorStop(0.35, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(0,0,0,0.12)')
  g.fillStyle = sheen; g.fillRect(0, band, W, H)
}

function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(/\s+/)
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w } else line = t
  }
  if (line) g.fillText(line, x, y)
}

function spineCanvas(s, [bgc, fg]) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 1180
  const g = c.getContext('2d')
  g.fillStyle = bgc; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = SPINE_BG; g.fillRect(0, 0, c.width, 74)
  g.fillStyle = '#fff'; g.font = '800 26px "Inter Tight", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(isMovie(s) ? 'F' : 'S', c.width / 2, 38)
  g.save()
  g.translate(c.width / 2, 110); g.rotate(Math.PI / 2)
  g.fillStyle = fg; g.textAlign = 'left'
  let size = 44
  g.font = `800 ${size}px "Inter Tight", system-ui, sans-serif`
  const name = (s.name || '').toUpperCase()
  while (g.measureText(name).width > c.height - 260 && size > 22) { size -= 2; g.font = `800 ${size}px "Inter Tight", system-ui, sans-serif` }
  g.fillText(name, 0, 2)
  g.restore()
  g.fillStyle = fg; g.globalAlpha = 0.75; g.font = '600 26px "Inter Tight", system-ui, sans-serif'
  g.save(); g.translate(c.width / 2, c.height - 70); g.rotate(Math.PI / 2); g.fillText(year(s) || '', 0, 0); g.restore()
  return c
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62)
  r.addColorStop(0, 'rgba(0,0,0,0.75)'); r.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = r; g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

class ShelfGL {
  constructor(host, cb) {
    this.host = host
    this.cb = cb
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.setClearColor(0x000000, 0)
    host.appendChild(this.renderer.domElement)
    this.renderer.domElement.className = 'vx-gl'
    this.scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
    this.scene.environment = this.envRT.texture
    pmrem.dispose()
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
    this.scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1420, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-3, 5, 6); this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.8); rim.position.set(4, 2, -3); this.scene.add(rim)
    this.geo = new RoundedBoxGeometry(CW, CH, CD, 2, 0.022)
    this.plastic = new THREE.MeshPhysicalMaterial({ color: SPINE_BG, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 })
    this.back = new THREE.MeshPhysicalMaterial({ color: '#122A63', roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.2 })
    this.shadowTex = shadowTexture()
    this.shadowGeo = new THREE.PlaneGeometry(CW * 1.5, CD * 6)
    this.items = new Map()            // id → { grp, mesh, mirror, shadow, mats, mmats, tex: [], front }
    this.list = []
    this.disp = 0
    this.target = 0
    this.vel = 0
    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 }
    this.time = 0
    this.resize()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.raycaster = new THREE.Raycaster()
    const el = this.renderer.domElement
    this.onMove = e => {
      const r = el.getBoundingClientRect()
      this.tilt.ty = ((e.clientX - r.left) / r.width - 0.5) * 0.5
      this.tilt.tx = ((e.clientY - r.top) / r.height - 0.5) * 0.3
      const hit = this.hit(e)
      el.style.cursor = hit != null ? 'pointer' : ''
    }
    this.onLeave = () => { this.tilt.tx = this.tilt.ty = 0; el.style.cursor = '' }
    this.onClick = e => {
      const i = this.hit(e)
      if (i == null) return
      if (i === Math.round(this.target)) this.cb.onOpen?.()
      else this.cb.onPick?.(i)
    }
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerleave', this.onLeave)
    el.addEventListener('click', this.onClick)
    this.last = performance.now()
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      if (document.hidden) return
      this.frame(dt)
    }
    this.raf = requestAnimationFrame(loop)
  }

  resize() {
    const W = this.host.clientWidth || 1, H = this.host.clientHeight || 1
    this.W = W; this.H = H
    this.renderer.setSize(W, H, false)
    this.camera.aspect = W / H
    // le boîtier du milieu prend la même place qu'avant : ~84 % de la hauteur, ou ~46 % de la largeur
    const frontPx = Math.min(H * 0.8, (W * 0.46) / (CW / CH))
    const f = frontPx / H
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    this.dist = CH / (2 * t * f)
    this.camera.position.set(0, CH * 0.16, this.dist)
    this.camera.lookAt(0, -CH * 0.02, 0)
    this.camera.updateProjectionMatrix()
  }

  setList(list, spineOf) {
    this.list = list
    this.spineOf = spineOf
    const ids = new Set(list.map(s => s.id))
    for (const [id, it] of this.items) if (!ids.has(id)) this.drop(id, it)
  }

  setPos(p, dragging) {
    if (dragging) this.vel = (p - this.target) / Math.max(0.016, (performance.now() - (this.lastSet || 0)) / 1000)
    this.lastSet = performance.now()
    if (!this.placed) { this.placed = true; this.disp = p }   // à l'ouverture : directement au bon titre
    this.target = p
    this.dragging = dragging
  }

  /** Le boîtier d'une œuvre (créé à la demande, gardé tant qu'il est près du milieu). */
  item(s) {
    let it = this.items.get(s.id)
    if (it) return it
    const spine = new THREE.CanvasTexture(spineCanvas(s, this.spineOf(s)))
    spine.colorSpace = THREE.SRGBColorSpace; spine.anisotropy = 4
    const fc = frontCanvas(s)
    const front = new THREE.CanvasTexture(fc)
    front.colorSpace = THREE.SRGBColorSpace; front.anisotropy = 8
    const spineMat = new THREE.MeshPhysicalMaterial({ map: spine, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.15 })
    const frontMat = new THREE.MeshPhysicalMaterial({ map: front, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.08 })
    // l'ordre des faces : +x, −x, +y, −y, +z (devant), −z (dos) ; les deux côtés portent la tranche
    const mats = [spineMat, spineMat, this.plastic, this.plastic, frontMat, this.back]
    const grp = new THREE.Group()
    const mesh = new THREE.Mesh(this.geo, mats)
    grp.add(mesh)
    // le reflet sur le sol : le même boîtier à l'envers, très atténué
    const mm = mats.map(m => { const c = m.clone(); c.transparent = true; c.opacity = 0.2; c.depthWrite = false; return c })
    const mirror = new THREE.Mesh(this.geo, mm)
    mirror.scale.y = -1
    mirror.position.y = -CH
    grp.add(mirror)
    const shadow = new THREE.Mesh(this.shadowGeo, new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -CH / 2 + 0.002
    grp.add(shadow)
    grp.userData.id = s.id
    this.scene.add(grp)
    it = { grp, mesh, mirror, shadow, mats: [spineMat, frontMat], mmats: mm, tex: [spine, front], fc, posterAsked: false }
    this.items.set(s.id, it)
    return it
  }

  poster(s, it) {
    if (it.posterAsked || !s.poster_path) return
    it.posterAsked = true
    loadImage(tmdbImgCors(s.poster_path, 'w342')).then(img => {
      if (!img || !this.items.has(s.id)) return
      drawPoster(it.fc, img)
      it.tex[1].needsUpdate = true
    })
  }

  drop(id, it) {
    this.scene.remove(it.grp)
    it.tex.forEach(t => t.dispose())
    it.mats.forEach(m => m.dispose())
    it.mmats.forEach(m => m.dispose())
    it.shadow.material.dispose()
    this.items.delete(id)
  }

  hit(e) {
    const el = this.renderer.domElement, r = el.getBoundingClientRect()
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.raycaster.setFromCamera(v, this.camera)
    const meshes = []
    for (const it of this.items.values()) if (it.grp.visible) meshes.push(it.mesh)
    const h = this.raycaster.intersectObjects(meshes, false)[0]
    if (!h) return null
    const id = h.object.parent.userData.id
    const i = this.list.findIndex(s => s.id === id)
    return i < 0 ? null : i
  }

  frame(dt) {
    this.time += dt
    if (this.dragging) this.disp = this.target
    else this.disp += (this.target - this.disp) * (1 - Math.exp(-dt * 11))
    this.vel *= Math.exp(-dt * 6)
    const tl = this.tilt
    tl.x += (tl.tx - tl.x) * (1 - Math.exp(-dt * 6)); tl.y += (tl.ty - tl.y) * (1 - Math.exp(-dt * 6))
    const n = this.list.length
    const near = CW / 2 + CD / 2 + GAP * 3, step = CD + GAP
    const active = Math.round(this.disp)
    const span = 26
    const keep = new Set()
    for (let i = Math.max(0, active - span); i <= Math.min(n - 1, active + span); i++) {
      const s = this.list[i]
      const d = i - this.disp, ad = Math.abs(d)
      const arc = ad < 1 ? d * near : Math.sign(d) * (near + (ad - 1) * step)
      const a = arc / ARC
      if (Math.abs(a) > 1.5) continue
      const it = this.item(s)
      keep.add(s.id)
      if (ad < 4) this.poster(s, it)
      const w = ease(clamp(1 - ad, 0, 1))                 // 1 : de face, 0 : de tranche
      const x = ARC * Math.sin(a), z = ARC * (Math.cos(a) - 1)
      // de face au milieu ; ailleurs, la tranche vers nous, l'affiche tournée vers le milieu
      let ry = -Math.sign(d) * (1 - w) * Math.PI / 2 - a
      // pendant qu'on fait défiler, les boîtiers penchent un peu dans le sens du mouvement
      ry += clamp(-this.vel * 0.04, -0.25, 0.25) * (1 - w * 0.6)
      let rx = 0, y = 0
      if (w > 0) {
        y = w * (0.06 + Math.sin(this.time * 1.4) * 0.018)
        ry += w * (tl.y + Math.sin(this.time * 0.7) * 0.05)
        rx = w * tl.x
      }
      it.grp.visible = true
      it.grp.position.set(x, 0, z + w * 0.35)
      it.mesh.position.y = y
      it.mesh.rotation.set(rx, ry, 0)
      it.mirror.position.y = -CH - y
      it.mirror.rotation.set(-rx, ry, 0)
      it.shadow.rotation.z = -ry
      it.shadow.material.opacity = 0.5 - w * 0.15
      it.grp.renderOrder = -Math.round(ad)
    }
    for (const [id, it] of this.items) if (!keep.has(id)) { it.grp.visible = false; if (this.items.size > 70) this.drop(id, it) }
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.onMove)
    el.removeEventListener('pointerleave', this.onLeave)
    el.removeEventListener('click', this.onClick)
    for (const [id, it] of this.items) this.drop(id, it)
    this.geo.dispose(); this.plastic.dispose(); this.back.dispose(); this.shadowTex.dispose(); this.shadowGeo.dispose()
    this.envRT.dispose()
    this.renderer.dispose()
    el.remove()
  }
}

export default function BluRayShelf({ list, pos, dragging, onPick, onOpen, stageRef, spineOf }) {
  const hostRef = useRef(null)
  const gl = useRef(null)
  const cb = useRef({})
  cb.current.onPick = onPick
  cb.current.onOpen = onOpen
  useEffect(() => {
    const s = new ShelfGL(hostRef.current, cb.current)
    gl.current = s
    return () => { s.dispose(); gl.current = null }
  }, [])
  useEffect(() => { gl.current?.setList(list, spineOf) }, [list, spineOf])
  useEffect(() => { gl.current?.setPos(pos, dragging) }, [pos, dragging])
  return (
    <div className="vx-stage vx-stage3d" ref={el => { hostRef.current = el; if (stageRef) stageRef.current = el }} />
  )
}
