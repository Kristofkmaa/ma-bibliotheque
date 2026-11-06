import * as THREE from 'three'
import RoomScene, { canvasTex, woodTexture, parquetTexture, rand, reseed } from './RoomScene'

/**
 * La chambre, en maquette : le lit et ses tables de chevet, une fenêtre et ses rideaux, et le
 * dressing (une penderie avec ses vêtements sur cintres, des étagères de pulls pliés, les
 * chaussures, un grand miroir). Ce qu'on y rangera vraiment viendra plus tard (A_FAIRE_PLUS_TARD.md).
 */
export const BEDROOM_VIEW = { az: 0.5, el: 0.52 }

export default class BedroomScene extends RoomScene {
  constructor(container, cb = {}) {
    super(container, cb, { az0: BEDROOM_VIEW.az, el0: BEDROOM_VIEW.el, floor: () => parquetTexture('#D3B38A'), floorRepeat: 2.4, floorRough: 0.6, wall: '#EFE3DA', side: '#E6D4C7', slab: '#CDBB9F' })
  }

  _furnish() {
    const S = this.scene
    const { R } = this.o
    const oak = this._mat({ map: this._tex(woodTexture('#D2B48C')), roughness: 0.55 })
    const white = this._mat({ color: '#F6F2EA', roughness: 0.8 })

    // un tapis sous le lit
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), this._mat({
      map: this._tex(canvasTex(520, 400, (g, w, h) => {
        g.fillStyle = '#E9DCCB'; g.fillRect(0, 0, w, h)
        reseed(8)
        for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(120,95,70,${rand() * 0.07})`; g.fillRect(rand() * w, rand() * h, 2, 2) }
        g.strokeStyle = '#B98A6B'; g.lineWidth = 10; g.strokeRect(22, 22, w - 44, h - 44)
        g.strokeStyle = '#7F9A86'; g.lineWidth = 4; g.strokeRect(44, 44, w - 88, h - 88)
      })), roughness: 1,
    }))
    rug.rotation.x = -Math.PI / 2; rug.position.set(0.55, 0.006, -0.85); rug.receiveShadow = true; S.add(rug)

    // le lit, contre le mur du fond
    const bed = new THREE.Group(); bed.position.set(0.55, 0, -R + 1.08); S.add(bed)
    const frame = this._box(1.7, 0.28, 2.1, oak, 0.04, 3); frame.position.y = 0.2; bed.add(frame)
    const head = this._box(1.8, 1.0, 0.12, this._mat({ color: '#8FA697', roughness: 0.9 }), 0.06, 4); head.position.set(0, 0.62, -1.06); bed.add(head)
    const mattress = this._box(1.62, 0.2, 2.0, white, 0.07, 4); mattress.position.y = 0.44; bed.add(mattress)
    const duvet = this._box(1.68, 0.12, 1.4, this._mat({ color: '#E3B7A0', roughness: 0.95 }), 0.06, 4); duvet.position.set(0, 0.56, 0.33); bed.add(duvet)
    const fold = this._box(1.68, 0.08, 0.3, white, 0.04, 3); fold.position.set(0, 0.6, -0.33); bed.add(fold)
    const plaid = this._box(1.7, 0.03, 0.42, this._mat({ color: '#C9614F', roughness: 1 }), 0.015, 2); plaid.position.set(0, 0.63, 0.75); bed.add(plaid)
    for (const x of [-0.42, 0.42]) { const p = this._box(0.62, 0.16, 0.36, white, 0.08, 4); p.position.set(x, 0.62, -0.8); p.rotation.x = -0.25; bed.add(p) }
    const cushion = this._box(0.4, 0.3, 0.12, this._mat({ color: '#D9A93A', roughness: 0.95 }), 0.05, 3); cushion.position.set(0, 0.7, -0.62); cushion.rotation.x = -0.3; bed.add(cushion)
    this._tag(bed, 'lit', 'Le lit')
    // les tables de chevet et leurs lampes
    for (const s of [-1, 1]) {
      const n = new THREE.Group(); n.position.set(0.55 + s * 1.22, 0, -R + 0.3); S.add(n)
      const b = this._box(0.48, 0.5, 0.4, oak, 0.03, 3); b.position.y = 0.25; n.add(b)
      const dr = this._box(0.4, 0.14, 0.01, this._mat({ color: '#C4A47E', roughness: 0.6 })); dr.position.set(0, 0.34, 0.205); n.add(dr)
      const base = this._cyl(0.06, 0.08, 0.2, this._mat({ color: '#EDE7DC', roughness: 0.4 }), 18); base.position.set(0, 0.6, 0); n.add(base)
      const shade = this._cyl(0.1, 0.15, 0.17, this._mat({ color: '#F4E9D6', emissive: '#FFE2B0', emissiveIntensity: 0.35, roughness: 0.8 }), 24); shade.position.set(0, 0.79, 0); n.add(shade)
      const l = new THREE.PointLight('#FFD9A8', 0.45, 1.8, 2); l.position.set(0, 0.85, 0.1); n.add(l)
      if (s > 0) { const book = this._box(0.2, 0.04, 0.14, this._mat({ color: '#2B47B0' })); book.position.set(-0.08, 0.52, 0.02); book.rotation.y = 0.3; n.add(book) }
    }
    // un cadre au-dessus du lit
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), this._mat({
      map: this._tex(canvasTex(500, 310, (g, w, h) => {
        g.fillStyle = '#F7F0E6'; g.fillRect(0, 0, w, h)
        g.fillStyle = '#E3B7A0'; g.beginPath(); g.arc(w * 0.35, h * 0.55, 80, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#8FA697'; g.beginPath(); g.arc(w * 0.6, h * 0.45, 60, 0, Math.PI * 2); g.fill()
        g.strokeStyle = '#2B47B0'; g.lineWidth = 5; g.beginPath(); g.moveTo(w * 0.15, h * 0.8); g.bezierCurveTo(w * 0.4, h * 0.3, w * 0.6, h * 0.95, w * 0.88, h * 0.35); g.stroke()
        g.strokeStyle = '#6B4A31'; g.lineWidth = 16; g.strokeRect(0, 0, w, h)
      })), roughness: 0.9,
    }))
    art.position.set(0.55, 1.75, -R + 0.006); S.add(art)

    // la fenêtre et ses rideaux, sur le mur de droite
    const win = new THREE.Group(); this.rightWall.decor.add(win)
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.15), new THREE.MeshBasicMaterial({
      map: this._tex(canvasTex(200, 230, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#CFE3F2'); gr.addColorStop(1, '#EDEFE4'); g.fillStyle = gr; g.fillRect(0, 0, w, h) })), toneMapped: false,
    }))
    sky.rotation.y = -Math.PI / 2; sky.position.set(R - 0.004, 1.55, 0.9); win.add(sky)
    this.disposables.push(sky.material)
    for (const [d, h, y, z] of [[1.06, 0.05, 2.13, 0.9], [1.06, 0.05, 0.97, 0.9], [0.04, 1.15, 1.55, 0.37], [0.04, 1.15, 1.55, 1.43], [0.03, 1.15, 1.55, 0.9]]) {
      const f = this._box(0.05, h, d === 1.06 ? 1.06 : 0.04, white); f.position.set(R - 0.025, y, z); win.add(f)
    }
    const curtain = this._mat({ color: '#E2C9A6', roughness: 1, side: THREE.DoubleSide })
    for (const z of [0.18, 1.62]) {
      for (let k = 0; k < 4; k++) { const c = this._cyl(0.055, 0.07, 2.2, curtain, 10); c.position.set(R - 0.12, 1.15, z + (k - 1.5) * 0.09); win.add(c) }
    }
    const rod = this._cyl(0.015, 0.015, 1.9, this._mat({ color: '#B8925A', metalness: 0.8, roughness: 0.3 }), 10); rod.rotation.x = Math.PI / 2; rod.position.set(R - 0.12, 2.28, 0.9); win.add(rod)

    // le dressing, sur le mur de gauche
    this._dressing(R)
    // une plante près de la fenêtre
    const pot = this._cyl(0.17, 0.13, 0.3, this._mat({ color: '#C26A49', roughness: 0.8 }), 22); pot.position.set(R - 0.35, 0.15, R - 0.45); S.add(pot)
    reseed(44)
    const leafA = this._mat({ color: '#4E7D45', roughness: 0.7 }), leafB = this._mat({ color: '#6A9566', roughness: 0.7 })
    for (let i = 0; i < 14; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), i % 2 ? leafA : leafB); l.scale.set(1, 0.35, 0.55)
      const a = rand() * Math.PI * 2
      l.position.set(R - 0.35 + Math.cos(a) * (0.08 + rand() * 0.16), 0.42 + rand() * 0.5, R - 0.45 + Math.sin(a) * (0.08 + rand() * 0.16))
      l.rotation.set(rand() - 0.5, a, rand() - 0.5); l.castShadow = true; S.add(l)
    }
  }

  _dressing(R) {
    const S = this.scene
    const g = new THREE.Group(); g.position.set(-R + 0.33, 0, -0.1); S.add(g)
    const oak = this._mat({ map: this._tex(woodTexture('#E2CBA8')), roughness: 0.55 })
    const metal = this._mat({ color: '#B8925A', metalness: 0.85, roughness: 0.3 })
    // le caisson : deux montants, un dessus, une séparation (penderie | étagères)
    const D = 0.58, W = 2.4, Hh = 2.25
    for (const z of [-W / 2, W / 2, 0.25]) { const p = this._box(D, Hh, 0.04, oak, 0.01, 2); p.position.set(0, Hh / 2, z); g.add(p) }
    const top = this._box(D, 0.04, W + 0.04, oak, 0.01, 2); top.position.set(0, Hh, 0); g.add(top)
    const bottom = this._box(D, 0.06, W, oak); bottom.position.set(0, 0.03, 0); g.add(bottom)
    // la penderie : une tringle, des vêtements sur cintres
    const rail = this._cyl(0.012, 0.012, 1.4, metal, 10); rail.rotation.x = Math.PI / 2; rail.position.set(0, 1.9, -0.47); g.add(rail)
    const colors = ['#2B47B0', '#F4EFE6', '#C9614F', '#8FA697', '#2E2A26', '#D9A93A', '#E3B7A0', '#5F7A6A', '#F4EFE6', '#7A5639']
    reseed(17)
    colors.forEach((c, i) => {
      const z = -1.1 + i * 0.13
      const long = i % 3 === 1
      const h = long ? 1.05 : 0.68 + rand() * 0.1
      const cloth = this._box(0.44, h, 0.05, this._mat({ color: c, roughness: 0.95 }), 0.03, 3); cloth.position.set(0, 1.84 - h / 2, z); cloth.rotation.y = (rand() - 0.5) * 0.12; g.add(cloth)
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 12, Math.PI * 1.4), metal); hook.position.set(0, 1.92, z); hook.rotation.y = Math.PI / 2; g.add(hook)
      const hanger = this._box(0.42, 0.015, 0.015, oak); hanger.position.set(0, 1.85, z); g.add(hanger)
    })
    // les étagères : pulls pliés, boîtes
    for (const y of [0.55, 1.05, 1.55]) { const s = this._box(D - 0.04, 0.03, 0.9, oak); s.position.set(0, y, 0.72); g.add(s) }
    const knit = ['#E3B7A0', '#F4EFE6', '#8FA697', '#2B47B0', '#C9614F', '#D9A93A']
    for (const [y, row] of [[0.57, 0], [1.07, 1], [1.57, 2]]) {
      for (let k = 0; k < 2; k++) for (let j = 0; j < 3; j++) {
        const f = this._box(0.4, 0.07, 0.3, this._mat({ color: knit[(row * 2 + k + j) % knit.length], roughness: 1 }), 0.025, 2)
        f.position.set(0, y + 0.04 + j * 0.075, 0.5 + k * 0.42); f.rotation.y = (rand() - 0.5) * 0.08; g.add(f)
      }
    }
    // les chaussures, en bas
    const shoes = ['#2E2A26', '#F4EFE6', '#C9614F', '#7A5639']
    shoes.forEach((c, i) => {
      for (const s of [-1, 1]) { const sh = this._box(0.24, 0.08, 0.09, this._mat({ color: c, roughness: 0.6 }), 0.035, 3); sh.position.set(0.02, 0.1, 0.42 + i * 0.2 + s * 0.05); sh.rotation.y = Math.PI / 2; g.add(sh) }
    })
    // un grand miroir sur pied, à côté
    const mirror = new THREE.Group(); mirror.position.set(-R + 0.42, 0, 1.55); mirror.rotation.y = 0.5; S.add(mirror)
    const fr = this._box(0.62, 1.7, 0.05, oak, 0.25, 6); fr.position.y = 0.9; fr.rotation.x = -0.08; mirror.add(fr)
    const glass = this._box(0.52, 1.6, 0.02, this._mat({ color: '#DCE6EA', metalness: 1, roughness: 0.05 }), 0.22, 6); glass.position.set(0, 0.9, 0.03); glass.rotation.x = -0.08; mirror.add(glass)
    this._tag(g, 'dressing', 'Le dressing')
  }
}
