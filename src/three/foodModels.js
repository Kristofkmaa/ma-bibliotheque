import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { norm } from '../lib/ingredients'

/**
 * Les ingrédients en 3D, rangés dans le frigo et les placards : chaque produit emballé a son
 * emballage (brique, pot, bocal, bouteille, conserve, paquet, sachet, pot d'épices, barquette,
 * boîte d'œufs, part de fromage…) avec une étiquette à son nom. Les fruits, légumes et le pain
 * restent des pictogrammes pour l'instant (des modèles viendront).
 *   makeFood(item) → THREE.Group (posé sur y = 0, étiquette tournée vers +z) ou null (pictogramme)
 * Chaque groupe a userData.dispose() pour libérer ses étiquettes et matières.
 */

// l'emballage de chaque ingrédient du catalogue (nom sans accents) ; sinon, celui de son rayon
const PACK = {
  'oeufs': 'oeufs', 'lait': 'brique', 'creme liquide': 'brique', 'bouillon': 'brique',
  'creme fraiche': 'pot', 'yaourt nature': 'pot', 'fromage frais': 'pot', 'ricotta': 'pot', 'mascarpone': 'pot', 'feta': 'pot', 'houmous': 'pot',
  'beurre': 'plaquette', 'fromage rape': 'sachet', 'mozzarella': 'sachet',
  'emmental': 'fromage', 'comte': 'fromage', 'parmesan': 'fromage', 'cheddar': 'fromage', 'reblochon': 'fromageRond', 'chevre': 'fromageRond',
  'moutarde': 'bocal', 'pesto': 'bocal', 'olives': 'bocal', 'capres': 'bocal', 'cornichons': 'bocal', 'coulis de tomate': 'bocal',
  'mayonnaise': 'squeeze', 'ketchup': 'squeeze', 'sauce piquante': 'bouteillePetite',
  'pate feuilletee': 'rouleau', 'pate brisee': 'rouleau', 'pate a pizza': 'rouleau',
  'pates': 'paquet', 'spaghetti': 'paquetLong', 'riz': 'paquet', 'riz a risotto': 'paquet', 'semoule': 'paquet', 'nouilles': 'paquet', 'flocons d avoine': 'paquet',
  'quinoa': 'sachet', 'boulgour': 'sachet', 'lentilles': 'sachet', 'chapelure': 'paquet', 'pain de mie': 'sachet', 'tortillas': 'sachet',
  'pois chiches': 'conserve', 'haricots rouges': 'conserve', 'haricots blancs': 'conserve', 'tomates pelees': 'conserve', 'mais en boite': 'conserve', 'lait de coco': 'conserve',
  'concentre de tomate': 'conservePetite', 'thon en boite': 'conservePlate', 'sardines': 'conservePlate',
  'farine': 'sachet', 'sucre': 'paquet', 'sucre roux': 'paquet', 'sucre glace': 'paquet', 'levure chimique': 'paquetPetit', 'bicarbonate': 'paquetPetit',
  'levure de boulanger': 'paquetPetit', 'maizena': 'paquet', 'chocolat noir': 'tablette', 'cacao': 'conserve', 'vanille': 'epice',
  'poudre d amande': 'sachet', 'amandes': 'sachet', 'noix': 'sachet', 'noisettes': 'sachet', 'cacahuetes': 'sachet', 'raisins secs': 'sachet',
  'sel': 'epice', 'poivre': 'moulin',
  'huile d olive': 'bouteille', 'huile': 'bouteille', 'huile de sesame': 'bouteillePetite', 'vinaigre': 'bouteille', 'vinaigre balsamique': 'bouteillePetite',
  'sauce soja': 'bouteillePetite', 'sauce worcestershire': 'bouteillePetite', 'vin blanc': 'vin', 'vin rouge': 'vin',
  'miel': 'bocal', 'confiture': 'bocal', 'sirop d erable': 'bouteillePetite', 'pate a tartiner': 'bocal', 'beurre de cacahuete': 'bocal',
  'cafe': 'paquet', 'the': 'paquetPetit', 'biscuits': 'paquet',
}
const BY_AISLE = { cremerie: 'pot', viande: 'barquette', frais: 'bocal', feculents: 'paquet', conserves: 'conserve', patisserie: 'sachet', epices: 'epice', huiles: 'bouteille', sucre: 'bocal' }
// les produits frais restent des pictogrammes (pour l'instant)
const FRESH = new Set(['legumes', 'fruits', 'garde'])
const FRESH_NAMES = new Set(['pain'])

export function packOf(it) {
  const k = norm(it.fr)
  if (FRESH_NAMES.has(k)) return null
  if (PACK[k]) return PACK[k]
  if (FRESH.has(it.aisle)) return null
  return BY_AISLE[it.aisle] || 'bocal'
}

// une couleur par produit (toujours la même), dans des tons doux
const PALETTE = ['#2B47B0', '#B4573A', '#5F7A6A', '#D9A93A', '#7A5639', '#C9614F', '#3F6E8C', '#8A4F7D', '#4E7D45', '#2E2A26']
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const colorOf = it => PALETTE[hash(norm(it.fr)) % PALETTE.length]
// quelques couleurs qu'on attend vraiment
const CONTENT = {
  'lait': '#F7F7F2', 'creme liquide': '#F6F1E4', 'moutarde': '#D9B33A', 'pesto': '#5E7F2E', 'olives': '#3F4A22', 'capres': '#6E7A3A', 'cornichons': '#5A7A2C',
  'coulis de tomate': '#B7321F', 'miel': '#E3A02A', 'confiture': '#9C1F33', 'pate a tartiner': '#5A3420', 'beurre de cacahuete': '#B98244', 'houmous': '#E2CDA0',
  'huile d olive': '#9AA43A', 'huile': '#E9C85A', 'vinaigre': '#E8DCC0', 'vinaigre balsamique': '#3A1A14', 'sauce soja': '#2A160E', 'sirop d erable': '#9A5418',
  'vin blanc': '#E6D98A', 'vin rouge': '#5A1222', 'ketchup': '#B7281C', 'mayonnaise': '#F4E9C2', 'sel': '#F7F7F7', 'poivre': '#3B3129', 'paprika': '#B5401E',
  'curcuma': '#E0A11A', 'cannelle': '#8C5229', 'cumin': '#9A6B2A', 'curry': '#C9921E', 'thym': '#6E7B4A', 'origan': '#6C7A3E', 'romarin': '#5F6E43',
  'herbes de provence': '#6F7C48', 'muscade': '#8E6236', 'piment de cayenne': '#A8341C', 'vanille': '#2E2017', 'graines de sesame': '#E6D7B0', 'laurier': '#6F7B4C',
}

const geoCache = new Map()
const geo = (k, make) => { if (!geoCache.has(k)) geoCache.set(k, make()); return geoCache.get(k) }

/** L'étiquette : un fond coloré, le nom en grand, le pictogramme dans un coin. */
function labelTexture(it, color, { w = 256, h = 160, light = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')
  g.fillStyle = light ? '#FBF7EF' : color; g.fillRect(0, 0, w, h)
  if (light) { g.fillStyle = color; g.fillRect(0, 0, w, h * 0.16); g.fillRect(0, h * 0.84, w, h * 0.16) }
  else { g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.roundRect(w * 0.08, h * 0.22, w * 0.84, h * 0.56, 14); g.fill() }
  const name = it.fr.length > 18 ? it.fr.slice(0, 17) + '…' : it.fr
  let fs = 46
  g.font = `700 ${fs}px Georgia, serif`
  while (g.measureText(name).width > w * 0.76 && fs > 18) { fs -= 2; g.font = `700 ${fs}px Georgia, serif` }
  g.fillStyle = light ? '#2B2620' : '#2B2620'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(name, w / 2, h / 2 + 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function makeFood(it) {
  const type = packOf(it)
  if (!type) return null
  const key = norm(it.fr)
  const color = colorOf(it)
  const own = []                                  // ce qu'on libère quand le produit s'en va
  const mat = o => { const m = new THREE.MeshStandardMaterial(o); own.push(m); return m }
  const tex = o => { const t = labelTexture(it, color, o); own.push(t); return t }
  const G = new THREE.Group()
  const add = (geometry, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; G.add(m); return m }
  // une étiquette plate devant une boîte
  const front = (w, h, z, y, o) => add(geo(`pl${w}x${h}`, () => new THREE.PlaneGeometry(w, h)), mat({ map: tex(o), roughness: 0.7 }), 0, y, z)
  // une étiquette enroulée autour d'un cylindre (centrée devant)
  const band = (r, h, y, o) => {
    const t = tex(o); t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2; t.offset.x = 0.5
    return add(geo(`band${r}x${h}`, () => new THREE.CylinderGeometry(r, r, h, 28, 1, true)), mat({ map: t, roughness: 0.6 }), 0, y)
  }
  const glass = () => mat({ color: '#E8F1F0', roughness: 0.05, transparent: true, opacity: 0.38, depthWrite: false })
  const content = CONTENT[key] || color

  switch (type) {
    case 'brique': {
      add(geo('brique', () => new THREE.BoxGeometry(0.068, 0.16, 0.068)), mat({ color: '#F7F5EF', roughness: 0.55 }), 0, 0.08)
      const roof = new THREE.Shape(); roof.moveTo(-0.034, 0); roof.lineTo(0.034, 0); roof.lineTo(0, 0.03); roof.closePath()
      add(geo('briqueToit', () => new THREE.ExtrudeGeometry(roof, { depth: 0.068, bevelEnabled: false })), mat({ color: '#F7F5EF', roughness: 0.55 }), 0, 0.16, -0.034)
      const cap = add(geo('briqueBouchon', () => new THREE.CylinderGeometry(0.009, 0.009, 0.012, 12)), mat({ color, roughness: 0.4 }), 0.012, 0.172, 0.018); cap.rotation.x = -0.55
      front(0.066, 0.11, 0.0345, 0.075, { w: 160, h: 256, light: true })
      break
    }
    case 'pot': {
      add(geo('pot', () => new THREE.CylinderGeometry(0.04, 0.032, 0.075, 24)), mat({ color: '#FBF8F1', roughness: 0.5 }), 0, 0.0375)
      band(0.0372, 0.05, 0.04)
      add(geo('potCouvercle', () => new THREE.CylinderGeometry(0.042, 0.042, 0.006, 24)), mat({ color, roughness: 0.3, metalness: 0.4 }), 0, 0.078)
      break
    }
    case 'bocal': {
      add(geo('bocal', () => new THREE.CylinderGeometry(0.038, 0.038, 0.1, 24)), glass(), 0, 0.05)
      add(geo('bocalDedans', () => new THREE.CylinderGeometry(0.035, 0.035, 0.085, 20)), mat({ color: content, roughness: 0.7 }), 0, 0.045)
      add(geo('bocalCouvercle', () => new THREE.CylinderGeometry(0.039, 0.039, 0.018, 24)), mat({ color, roughness: 0.35, metalness: 0.5 }), 0, 0.108)
      band(0.0385, 0.042, 0.05, { w: 256, h: 120 })
      break
    }
    case 'squeeze': {
      add(geo('squeeze', () => new THREE.CylinderGeometry(0.026, 0.032, 0.14, 20)), mat({ color: content, roughness: 0.35 }), 0, 0.07)
      add(geo('squeezeBouchon', () => new THREE.CylinderGeometry(0.02, 0.026, 0.03, 16)), mat({ color: '#F4EFE6', roughness: 0.4 }), 0, 0.155)
      band(0.0295, 0.06, 0.06, { w: 256, h: 140 })
      break
    }
    case 'bouteille': case 'bouteillePetite': case 'vin': {
      const s = type === 'bouteille' ? 1 : type === 'vin' ? 1.12 : 0.72
      const pts = [[0, 0], [0.03, 0], [0.031, 0.006], [0.031, 0.15], [0.026, 0.175], [0.013, 0.2], [0.012, 0.235], [0, 0.235]].map(([x, y]) => new THREE.Vector2(x * s, y * s))
      add(geo('bouteille' + s, () => new THREE.LatheGeometry(pts, 24)), mat({ color: type === 'vin' ? '#263B24' : content, roughness: 0.12, metalness: 0.1, transparent: type !== 'vin', opacity: 0.85 }))
      add(geo('bouchon' + s, () => new THREE.CylinderGeometry(0.0135 * s, 0.0135 * s, 0.025 * s, 14)), mat({ color: type === 'vin' ? '#8C2333' : color, roughness: 0.4 }), 0, 0.24 * s)
      band(0.0315 * s, 0.07 * s, 0.085 * s, { w: 256, h: 150, light: true })
      break
    }
    case 'conserve': case 'conservePetite': {
      const s = type === 'conserve' ? 1 : 0.7
      add(geo('boite' + s, () => new THREE.CylinderGeometry(0.036 * s, 0.036 * s, 0.1 * s, 24)), mat({ color: '#C9CDD2', metalness: 0.85, roughness: 0.3 }), 0, 0.05 * s)
      band(0.0365 * s, 0.082 * s, 0.05 * s, { w: 256, h: 160 })
      break
    }
    case 'conservePlate': {
      add(geo('boitePlate', () => new RoundedBoxGeometry(0.1, 0.032, 0.07, 2, 0.012)), mat({ color: '#C9CDD2', metalness: 0.85, roughness: 0.3 }), 0, 0.016)
      front(0.094, 0.026, 0.0352, 0.016, { w: 256, h: 72 })
      break
    }
    case 'paquet': case 'paquetLong': case 'paquetPetit': {
      const [w, h, d] = type === 'paquet' ? [0.085, 0.14, 0.05] : type === 'paquetLong' ? [0.055, 0.2, 0.035] : [0.06, 0.085, 0.035]
      add(geo(`paq${w}`, () => new THREE.BoxGeometry(w, h, d)), mat({ color, roughness: 0.6 }), 0, h / 2)
      front(w * 0.98, h * 0.98, d / 2 + 0.0008, h / 2, { w: 200, h: Math.round(200 * h / w) })
      break
    }
    case 'sachet': {
      add(geo('sachet', () => new RoundedBoxGeometry(0.09, 0.13, 0.045, 3, 0.018)), mat({ color, roughness: 0.75 }), 0, 0.065)
      add(geo('sachetHaut', () => new THREE.BoxGeometry(0.086, 0.012, 0.01)), mat({ color, roughness: 0.75 }), 0, 0.135)
      front(0.07, 0.09, 0.0232, 0.065, { w: 160, h: 206, light: true })
      break
    }
    case 'epice': {
      add(geo('epice', () => new THREE.CylinderGeometry(0.02, 0.02, 0.07, 18)), glass(), 0, 0.035)
      add(geo('epiceDedans', () => new THREE.CylinderGeometry(0.018, 0.018, 0.058, 16)), mat({ color: content, roughness: 0.9 }), 0, 0.031)
      add(geo('epiceBouchon', () => new THREE.CylinderGeometry(0.021, 0.021, 0.018, 18)), mat({ color: '#2E2A26', roughness: 0.5 }), 0, 0.079)
      band(0.0205, 0.03, 0.035, { w: 256, h: 120, light: true })
      break
    }
    case 'moulin': {
      add(geo('moulin', () => new THREE.CylinderGeometry(0.022, 0.026, 0.12, 18)), mat({ color: '#6B4A31', roughness: 0.45 }), 0, 0.06)
      add(geo('moulinHaut', () => new THREE.SphereGeometry(0.024, 16, 10)), mat({ color: '#6B4A31', roughness: 0.45 }), 0, 0.125)
      break
    }
    case 'plaquette': {
      add(geo('plaquette', () => new THREE.BoxGeometry(0.095, 0.035, 0.05)), mat({ color: '#E8C95A', roughness: 0.4, metalness: 0.3 }), 0, 0.0175)
      front(0.09, 0.03, 0.0255, 0.0175, { w: 256, h: 86, light: true })
      break
    }
    case 'tablette': {
      add(geo('tablette', () => new THREE.BoxGeometry(0.075, 0.11, 0.012)), mat({ color: '#5A3420', roughness: 0.5 }), 0, 0.055)
      front(0.07, 0.07, 0.0065, 0.06, { w: 160, h: 160 })
      break
    }
    case 'rouleau': {
      const m = add(geo('rouleau', () => new THREE.CylinderGeometry(0.024, 0.024, 0.11, 20)), mat({ color: '#F4EFE6', roughness: 0.6 }), 0, 0.024); m.rotation.z = Math.PI / 2
      const t = tex({ w: 256, h: 110 }); t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2; t.offset.x = 0.25
      const b = add(geo('rouleauBande', () => new THREE.CylinderGeometry(0.0245, 0.0245, 0.07, 20, 1, true)), mat({ map: t, roughness: 0.6 }), 0, 0.024); b.rotation.z = Math.PI / 2
      break
    }
    case 'oeufs': {
      add(geo('boiteOeufs', () => new RoundedBoxGeometry(0.1, 0.04, 0.075, 2, 0.01)), mat({ color: '#B9AE9A', roughness: 0.95 }), 0, 0.02)
      const egg = mat({ color: '#E9C9A0', roughness: 0.6 })
      for (const [x, z] of [[-0.03, -0.018], [0, -0.018], [0.03, -0.018], [-0.03, 0.018], [0, 0.018], [0.03, 0.018]]) {
        const e = add(geo('oeuf', () => new THREE.SphereGeometry(0.014, 14, 10)), egg, x, 0.048, z); e.scale.y = 1.3
      }
      break
    }
    case 'barquette': {
      add(geo('barquette', () => new RoundedBoxGeometry(0.105, 0.03, 0.08, 2, 0.008)), mat({ color: '#2E2A26', roughness: 0.5 }), 0, 0.015)
      const meat = key.includes('poulet') || key.includes('dinde') ? '#E9B79A' : key.includes('saumon') ? '#EE8A5E' : key.includes('cabillaud') || key.includes('tofu') ? '#F2EBDD' : key.includes('crevette') ? '#F09A72' : key.includes('jambon') ? '#E9A3A0' : '#B9454A'
      add(geo('viande', () => new RoundedBoxGeometry(0.09, 0.022, 0.066, 2, 0.01)), mat({ color: meat, roughness: 0.65 }), 0, 0.03)
      add(geo('film', () => new THREE.BoxGeometry(0.104, 0.002, 0.079)), glass(), 0, 0.043)
      front(0.05, 0.022, 0.0405, 0.017, { w: 200, h: 88, light: true })
      break
    }
    case 'fromage': {
      const s = new THREE.Shape(); s.moveTo(-0.05, -0.03); s.lineTo(0.05, -0.03); s.lineTo(0, 0.04); s.closePath()
      const m = add(geo('partFromage', () => new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 })), mat({ color: key === 'parmesan' ? '#E8D29A' : key === 'cheddar' ? '#E59A3A' : '#F2D37A', roughness: 0.6 }), 0, 0.02, 0)
      m.rotation.x = -Math.PI / 2; m.position.set(0, 0.003, 0.005)
      break
    }
    case 'fromageRond': {
      add(geo('camembert', () => new THREE.CylinderGeometry(0.045, 0.045, 0.035, 24)), mat({ color: '#F0E7D2', roughness: 0.8 }), 0, 0.0175)
      band(0.0455, 0.025, 0.0175, { w: 256, h: 70 })
      break
    }
    default: return null
  }
  G.userData.dispose = () => own.forEach(o => o.dispose())
  return G
}
