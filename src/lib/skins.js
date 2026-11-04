/**
 * Apparence des étagères : matière (bois du meuble), couleur du fond, style des portes.
 * Chaque palette donne les teintes utilisées par le dessin en perspective (SVG) et par le CSS.
 */

export const MATERIALS = [
  {
    id: 'chene', label: 'Chêne clair',
    hi: '#E8DFCB', mid: '#D8CCB0', lo: '#C4B594',
    side1: '#D8CBAD', side2: '#C6B897', ceil1: '#B9AC8E', ceil2: '#CDC1A6', top1: '#E4DAC4', top2: '#C9BC9E',
    door1: '#E6DBC3', door2: '#CFBF9E', grain: 'rgba(110, 80, 30, 0.05)', edge: 'rgba(20, 16, 10, 0.35)',
  },
  {
    id: 'noyer', label: 'Noyer',
    hi: '#94704F', mid: '#73513A', lo: '#553926',
    side1: '#6E4E36', side2: '#5A3E2A', ceil1: '#3E2A1C', ceil2: '#553A28', top1: '#86664A', top2: '#5E422E',
    door1: '#8A6545', door2: '#664630', grain: 'rgba(30, 15, 5, 0.12)', edge: 'rgba(10, 5, 0, 0.5)',
  },
  {
    id: 'ebene', label: 'Laque noire',
    hi: '#4A4A4E', mid: '#2A2A2D', lo: '#151517',
    side1: '#2E2E31', side2: '#1F1F22', ceil1: '#101012', ceil2: '#202023', top1: '#3A3A3E', top2: '#242427',
    door1: '#38383C', door2: '#1E1E21', grain: 'rgba(255, 255, 255, 0.025)', edge: 'rgba(0, 0, 0, 0.6)',
  },
  {
    id: 'blanc', label: 'Bois blanc',
    hi: '#FDFCF8', mid: '#F0EDE6', lo: '#DCD8CE',
    side1: '#EEEBE4', side2: '#DFDBD2', ceil1: '#CFCBC1', ceil2: '#E1DDD5', top1: '#F7F5F0', top2: '#E2DFD7',
    door1: '#F8F6F1', door2: '#E6E3DB', grain: 'rgba(120, 110, 90, 0.035)', edge: 'rgba(20, 16, 10, 0.25)',
  },
  {
    id: 'acier', label: 'Acier',
    hi: '#CED2D6', mid: '#ADB3B9', lo: '#8C9299',
    side1: '#B4B9BE', side2: '#9DA3A9', ceil1: '#7C828A', ceil2: '#959BA2', top1: '#C4C8CC', top2: '#A3A9AF',
    door1: '#BCC1C6', door2: '#9BA1A8', grain: 'rgba(255, 255, 255, 0.06)', edge: 'rgba(20, 25, 30, 0.4)',
  },
]

export const WALLS = [
  { id: 'papier', label: 'Papier', color: '#DAD5CA' },
  { id: 'cobalt', label: 'Cobalt', color: '#2B47B0' },
  { id: 'vermillon', label: 'Vermillon', color: '#B9443A' },
  { id: 'sapin', label: 'Sapin', color: '#2F5A4B' },
  { id: 'terracotta', label: 'Terracotta', color: '#C2774E' },
  { id: 'moutarde', label: 'Moutarde', color: '#D3A23E' },
  { id: 'ardoise', label: 'Ardoise', color: '#4B5662' },
  { id: 'nuit', label: 'Nuit', color: '#1D2232' },
]

export const DOOR_STYLES = [
  { id: 'panneau', label: 'Panneau' },
  { id: 'cannage', label: 'Cannage' },
  { id: 'lattes', label: 'Lattes' },
]

export const DEFAULT_SKIN = { material: 'chene', wall: 'papier', doors: 'panneau' }

function mix(hex, target, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(target.slice(1), 16)
  const ch = (v, s) => (v >> s) & 255
  const m = s => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t)
  return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)
}

const cache = new Map()

/** Résout un skin (ids) en palette complète (même objet pour un même skin). */
export function resolveSkin(skin = {}) {
  const key = `${skin.material}|${skin.wall}|${skin.doors}`
  if (!cache.has(key)) cache.set(key, buildPalette(skin))
  return cache.get(key)
}

function buildPalette(skin) {
  const mat = MATERIALS.find(x => x.id === skin.material) || MATERIALS[0]
  const wall = WALLS.find(x => x.id === skin.wall) || WALLS[0]
  const doors = DOOR_STYLES.find(x => x.id === skin.doors) ? skin.doors : 'panneau'
  return {
    mat, doors, wallId: wall.id,
    wall1: mix(wall.color, '#000000', 0.08),
    wall2: mix(wall.color, '#FFFFFF', 0.08),
    wall3: mix(wall.color, '#000000', 0.05),
  }
}

/** Variables CSS d'un rayon (planche, montants, portes). */
export function skinVars(p) {
  return {
    '--wood-hi': p.mat.hi, '--wood-mid': p.mat.mid, '--wood-lo': p.mat.lo,
    '--door-1': p.mat.door1, '--door-2': p.mat.door2, '--grain': p.mat.grain, '--wood-edge': p.mat.edge,
    '--wall-1': p.wall1, '--wall-2': p.wall2, '--wall-3': p.wall3,
    '--top-1': p.mat.top1, '--top-2': p.mat.top2, '--ceil-1': p.mat.ceil1, '--ceil-2': p.mat.ceil2,
    '--side-1': p.mat.side1, '--side-2': p.mat.side2,
  }
}
