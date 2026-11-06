import * as THREE from 'three'
import RoomScene, { canvasTex, woodTexture, rand, reseed } from './RoomScene'

/**
 * Le garage, en maquette : un sol en béton avec sa place marquée, la porte sectionnelle, la voiture,
 * un établi et son panneau à outils, une étagère (pneus, bidons, cartons), un calendrier au mur
 * (pour les rappels : contrôle technique, vidange… à venir, voir A_FAIRE_PLUS_TARD.md).
 */
export const GARAGE_VIEW = { az: 0.55, el: 0.52 }

function concreteTexture() {
  reseed(5)
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#B9B6AF'; g.fillRect(0, 0, w, h)
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '40,38,35'},${rand() * 0.07})`; g.fillRect(rand() * w, rand() * h, 2, 2) }
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(60,55,50,${0.03 + rand() * 0.04})`; g.beginPath(); g.ellipse(rand() * w, rand() * h, 40 + rand() * 90, 20 + rand() * 50, rand() * 3, 0, Math.PI * 2); g.fill() }
    g.strokeStyle = 'rgba(70,66,60,0.35)'; g.lineWidth = 2
    for (const v of [0, 256]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, h); g.stroke(); g.beginPath(); g.moveTo(0, v); g.lineTo(w, v); g.stroke() }
  }, { repeat: true })
}

export default class GarageScene extends RoomScene {
  constructor(container, cb = {}) {
    super(container, cb, { az0: GARAGE_VIEW.az, el0: GARAGE_VIEW.el, floor: concreteTexture, floorRepeat: 2.2, floorRough: 0.9, wall: '#E4E2DC', side: '#D9D6CE', slab: '#B7AD9E', base: '#CFCBC2' })
  }

  _furnish() {
    const S = this.scene
    const { R } = this.o
    const wood = this._mat({ map: this._tex(woodTexture('#C49A6C')), roughness: 0.6 })
    const metal = this._mat({ color: '#5E6670', metalness: 0.6, roughness: 0.4 })
    const red = this._mat({ color: '#B23A2E', roughness: 0.45, metalness: 0.2 })

    // la place marquée au sol
    const lines = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.6), this._mat({
      map: this._tex(canvasTex(270, 360, (g, w, h) => {
        g.strokeStyle = '#F0C93A'; g.lineWidth = 9
        g.beginPath(); g.moveTo(8, 0); g.lineTo(8, h); g.moveTo(w - 8, 0); g.lineTo(w - 8, h); g.stroke()
        g.fillStyle = 'rgba(240,201,58,0.9)'
        for (let y = 20; y < h; y += 46) { g.save(); g.translate(w / 2, y); g.rotate(-0.6); g.fillRect(-28, -4, 56, 8); g.restore() }
      })), transparent: true, roughness: 0.9, depthWrite: false,
    }))
    lines.rotation.x = -Math.PI / 2; lines.position.set(0.35, 0.004, 0.25); S.add(lines)

    // la voiture
    this._car(0.35, 0.25)

    // la porte sectionnelle, sur le mur de gauche
    const door = new THREE.Group(); this.leftWall.decor.add(door)
    const panel = this._mat({ color: '#F1EFEA', roughness: 0.6 })
    for (let i = 0; i < 5; i++) {
      const p = this._box(0.05, 0.4, 2.4, panel, 0.01, 2); p.position.set(-R + 0.03, 0.22 + i * 0.41, 0.1); door.add(p)
      const g = this._box(0.06, 0.015, 2.36, this._mat({ color: '#D6D3CC', roughness: 0.7 })); g.position.set(-R + 0.03, 0.02 + i * 0.41, 0.1); door.add(g)
    }
    const handle = this._box(0.04, 0.03, 0.25, metal, 0.01, 2); handle.position.set(-R + 0.07, 0.6, 0.1); door.add(handle)
    for (const z of [-1.12, 1.32]) { const rail = this._box(0.06, 2.1, 0.06, metal); rail.position.set(-R + 0.05, 1.05, z); door.add(rail) }

    // l'établi et le panneau à outils, sur le mur du fond
    const bench = new THREE.Group(); bench.position.set(-1.0, 0, -R + 0.38); S.add(bench)
    const top = this._box(1.7, 0.06, 0.66, wood, 0.01, 2); top.position.y = 0.92; bench.add(top)
    for (const [x, z] of [[-0.78, -0.28], [0.78, -0.28], [-0.78, 0.28], [0.78, 0.28]]) { const l = this._box(0.07, 0.9, 0.07, metal); l.position.set(x, 0.45, z); bench.add(l) }
    const shelf = this._box(1.6, 0.03, 0.6, wood); shelf.position.y = 0.25; bench.add(shelf)
    const vice = this._box(0.18, 0.12, 0.16, this._mat({ color: '#2F5D8C', roughness: 0.4, metalness: 0.3 }), 0.02, 2); vice.position.set(0.62, 1.01, 0.18); bench.add(vice)
    const box = this._box(0.42, 0.2, 0.24, red, 0.02, 2); box.position.set(-0.5, 1.05, 0); bench.add(box)
    const bh = this._box(0.2, 0.03, 0.04, metal); bh.position.set(-0.5, 1.17, 0); bench.add(bh)
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), this._mat({
      map: this._tex(canvasTex(640, 360, (g, w, h) => {
        g.fillStyle = '#D8BF95'; g.fillRect(0, 0, w, h)
        g.fillStyle = 'rgba(80,60,40,0.35)'
        for (let y = 14; y < h; y += 24) for (let x = 14; x < w; x += 24) { g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill() }
        const tool = (x, y, draw) => { g.save(); g.translate(x, y); g.fillStyle = '#3B4048'; g.strokeStyle = '#3B4048'; draw(); g.restore() }
        tool(80, 70, () => { g.fillRect(-6, 0, 12, 150); g.fillStyle = '#B23A2E'; g.fillRect(-12, 120, 24, 70) })     // tournevis
        tool(150, 60, () => { g.fillRect(-5, 30, 10, 160); g.fillRect(-35, 10, 70, 30) })                               // marteau
        tool(240, 60, () => { g.lineWidth = 12; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 170); g.stroke(); g.beginPath(); g.arc(0, 0, 22, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke() })   // clé
        tool(330, 60, () => { g.fillStyle = '#E0A93A'; g.fillRect(-40, 0, 80, 120); g.fillStyle = '#3B4048'; g.fillRect(-12, 120, 24, 70) })   // perceuse
        tool(440, 60, () => { g.lineWidth = 10; g.beginPath(); g.moveTo(-30, 180); g.lineTo(0, 0); g.lineTo(30, 180); g.stroke() })   // pince
        for (let i = 0; i < 5; i++) tool(520 + i * 22, 70, () => { g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 60 + i * 20); g.stroke() })
      })), roughness: 0.85,
    }))
    board.position.set(-1.0, 1.55, -R + 0.006); S.add(board)

    // le calendrier des rappels (contrôle technique, vidange…) : il servira plus tard
    const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), this._mat({
      map: this._tex(canvasTex(210, 280, (g, w, h) => {
        g.fillStyle = '#FFFDF7'; g.fillRect(0, 0, w, h)
        g.fillStyle = '#B23A2E'; g.fillRect(0, 0, w, 54)
        g.fillStyle = '#fff'; g.font = '700 26px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('RAPPELS', w / 2, 36)
        g.fillStyle = '#3B4048'; g.font = '16px system-ui, sans-serif'
        for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) g.fillText(String(r * 7 + c + 1 <= 31 ? r * 7 + c + 1 : ''), 18 + c * 29, 86 + r * 40)
        g.strokeStyle = '#B23A2E'; g.lineWidth = 3; g.beginPath(); g.arc(18 + 3 * 29, 80 + 2 * 40, 15, 0, Math.PI * 2); g.stroke()
      })), roughness: 0.9,
    }))
    cal.position.set(0.55, 1.62, -R + 0.006); S.add(cal)

    // l'étagère : pneus, bidons, cartons (mur de droite)
    const rack = new THREE.Group(); this.rightWall.decor.add(rack)
    for (const y of [0.05, 0.75, 1.45, 2.05]) { const p = this._box(0.5, 0.04, 1.4, metal); p.position.set(R - 0.28, y, -0.9); rack.add(p) }
    for (const [x, z] of [[R - 0.05, -1.58], [R - 0.05, -0.22], [R - 0.5, -1.58], [R - 0.5, -0.22]]) { const u = this._box(0.04, 2.1, 0.04, metal); u.position.set(x, 1.05, z); rack.add(u) }
    const tire = this._mat({ color: '#26272A', roughness: 0.85 }), rim = this._mat({ color: '#A9AEB4', metalness: 0.8, roughness: 0.3 })
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.085, 12, 28), tire); t.rotation.x = Math.PI / 2; t.position.set(R - 0.28, 0.16 + i * 0.17, -1.25); t.castShadow = true; rack.add(t)
      const c = this._cyl(0.13, 0.13, 0.12, rim, 16); c.position.set(R - 0.28, 0.16 + i * 0.17, -1.25); rack.add(c)
    }
    const cans = [['#2F5D8C', 0.18], ['#E0A93A', 0.22], ['#B23A2E', 0.2]]
    cans.forEach(([c, hgt], i) => { const b = this._box(0.16, hgt, 0.11, this._mat({ color: c, roughness: 0.4 }), 0.02, 2); b.position.set(R - 0.28, 0.77 + hgt / 2, -1.4 + i * 0.2); rack.add(b) })
    const carton = this._mat({ color: '#C79B66', roughness: 0.9 })
    for (const [z, s] of [[-1.25, 0.34], [-0.75, 0.3], [-0.45, 0.24]]) { const b = this._box(0.4, s, s, carton, 0.01, 2); b.position.set(R - 0.28, 1.47 + s / 2, z); rack.add(b) }

    // un vélo contre le mur de droite, devant
    this._bike(R - 0.22, 1.1)
    // un néon au plafond (on ne voit que sa lumière sur l'établi)
    const neon = new THREE.PointLight('#F4F8FF', 0.8, 4, 2); neon.position.set(-0.6, 2.3, -0.8); S.add(neon)
  }

  _car(x, z) {
    const S = this.scene
    const car = new THREE.Group(); car.position.set(x, 0, z); car.rotation.y = Math.PI / 2 - 0.12; S.add(car)
    const paint = this._mat({ color: '#7FA2BF', roughness: 0.25, metalness: 0.35 })
    const glass = this._mat({ color: '#25303A', roughness: 0.08, metalness: 0.4 })
    const chrome = this._mat({ color: '#D5D8DC', metalness: 1, roughness: 0.18 })
    const tire = this._mat({ color: '#1E1F22', roughness: 0.85 })
    const body = this._box(2.3, 0.5, 1.05, paint, 0.16, 4); body.position.y = 0.42; car.add(body)
    const cabin = this._box(1.25, 0.46, 0.92, paint, 0.18, 4); cabin.position.set(-0.12, 0.84, 0); car.add(cabin)
    // les vitres, posées sur la cabine
    for (const s of [-1, 1]) { const w = this._box(1.0, 0.28, 0.02, glass, 0.05, 2); w.position.set(-0.12, 0.86, s * 0.465); car.add(w) }
    const wf = this._box(0.02, 0.3, 0.8, glass, 0.04, 2); wf.position.set(0.5, 0.85, 0); wf.rotation.z = -0.5; car.add(wf)
    const wr = this._box(0.02, 0.28, 0.8, glass, 0.04, 2); wr.position.set(-0.74, 0.85, 0); wr.rotation.z = 0.5; car.add(wr)
    // roues
    for (const [wx, wz] of [[0.72, 0.52], [-0.72, 0.52], [0.72, -0.52], [-0.72, -0.52]]) {
      const t = this._cyl(0.22, 0.22, 0.18, tire, 24); t.rotation.x = Math.PI / 2; t.position.set(wx, 0.22, wz); car.add(t)
      const h = this._cyl(0.12, 0.12, 0.19, chrome, 16); h.rotation.x = Math.PI / 2; h.position.set(wx, 0.22, wz); car.add(h)
    }
    // pare-chocs, phares, feux
    for (const sx of [-1, 1]) { const b = this._box(0.08, 0.1, 1.0, chrome, 0.03, 2); b.position.set(sx * 1.17, 0.3, 0); car.add(b) }
    const lamp = this._mat({ color: '#FFF4D6', emissive: '#FFE9B0', emissiveIntensity: 0.4, roughness: 0.2 })
    const tail = this._mat({ color: '#C23B2F', emissive: '#7A1A12', emissiveIntensity: 0.4, roughness: 0.3 })
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), lamp); h.position.set(1.14, 0.5, s * 0.36); h.scale.x = 0.5; car.add(h)
      const t = this._box(0.04, 0.08, 0.18, tail, 0.02, 2); t.position.set(-1.15, 0.5, s * 0.36); car.add(t)
    }
    this._tag(car, 'voiture', 'La voiture')
  }

  _bike(x, z) {
    const S = this.scene
    const bike = new THREE.Group(); bike.position.set(x, 0, z); bike.rotation.y = Math.PI / 2; S.add(bike)
    const frame = this._mat({ color: '#2B47B0', roughness: 0.4, metalness: 0.3 })
    const tire = this._mat({ color: '#1E1F22', roughness: 0.8 })
    for (const wx of [-0.45, 0.45]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 32), tire); w.position.set(wx, 0.32, 0); w.castShadow = true; bike.add(w) }
    const bar = (a, b) => {
      const v = new THREE.Vector3().subVectors(b, a), m = this._cyl(0.018, 0.018, v.length(), frame, 8)
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); bike.add(m)
    }
    const V = (x, y) => new THREE.Vector3(x, y, 0)
    bar(V(-0.45, 0.32), V(-0.05, 0.36)); bar(V(-0.05, 0.36), V(0.3, 0.7)); bar(V(-0.12, 0.72), V(0.3, 0.7)); bar(V(-0.45, 0.32), V(-0.12, 0.72))
    bar(V(-0.05, 0.36), V(-0.12, 0.72)); bar(V(0.3, 0.7), V(0.45, 0.32)); bar(V(0.3, 0.7), V(0.26, 0.86))
    const seat = this._box(0.18, 0.04, 0.08, this._mat({ color: '#2A2422' }), 0.02, 2); seat.position.set(-0.13, 0.77, 0); bike.add(seat)
    const hb = this._box(0.04, 0.03, 0.4, tire, 0.01, 2); hb.position.set(0.26, 0.87, 0); bike.add(hb)
  }
}
