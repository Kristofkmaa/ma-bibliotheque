import { DEFAULT_SKIN } from './skins'

/**
 * Étagères de l'utilisatrice : { id, name, position, material, wall, doors, book_ids[] }.
 * Toutes les opérations sont pures : elles prennent la liste « effective » affichée
 * (avec l'étagère virtuelle par défaut et la pseudo-étagère « À ranger ») et rendent
 * la nouvelle liste réelle à enregistrer.
 */

export const VIRTUAL = '__virtual'   // étagère par défaut, tant que rien n'a été rangé
export const LOOSE = '__loose'       // livres présents sur aucune étagère
export const PH = '__ph'             // emplacement pendant un glisser-déposer
export const NEWSHELF = '__new'      // nouvelle étagère créée en lâchant un livre dans le vide

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 3) | 8).toString(16)
  })
}

const skinOf = s => ({ material: s?.material || DEFAULT_SKIN.material, wall: s?.wall || DEFAULT_SKIN.wall, doors: s?.doors || DEFAULT_SKIN.doors })

/** Liste affichée : étagères réelles nettoyées, + « À ranger » si des livres n'ont pas de place. */
export function effectiveShelves(shelves, allBooks) {
  const ids = new Set(allBooks.map(b => b.id))
  if (!shelves.length) {
    return [{ id: VIRTUAL, name: 'Ma bibliothèque', ...DEFAULT_SKIN, book_ids: allBooks.map(b => b.id), virtual: true }]
  }
  const seen = new Set()
  const clean = shelves.map(s => ({
    ...s,
    book_ids: (s.book_ids || []).filter(id => ids.has(id) && !seen.has(id) && seen.add(id)),
  }))
  const loose = allBooks.filter(b => !seen.has(b.id)).map(b => b.id)
  if (!loose.length) return clean
  // tout en bas du meuble, pour qu'on voie bien qu'ils ont quitté leur étagère
  return [...clean, { id: LOOSE, name: 'À ranger', ...skinOf(clean[clean.length - 1]), book_ids: loose, pseudo: true }]
}

/** Liste réelle à enregistrer (l'étagère virtuelle reçoit un vrai identifiant). */
export function materialize(eff) {
  const map = {}
  const list = eff.filter(s => !s.pseudo).map(s => {
    const { virtual, pseudo, ...rest } = s // eslint-disable-line no-unused-vars
    if (virtual) { const id = uid(); map[s.id] = id; return { ...rest, id } }
    return rest
  })
  return { list, map }
}

const insertAt = (arr, i, v) => { const a = [...arr]; a.splice(Math.max(0, Math.min(i, a.length)), 0, v); return a }

export function moveBook(eff, bookId, targetId, index) {
  const { list, map } = materialize(eff)
  let next = list.map(s => ({ ...s, book_ids: s.book_ids.filter(x => x !== bookId) }))
  const tid = map[targetId] || targetId
  if (tid === LOOSE) return { list: next }
  if (tid === NEWSHELF) {
    const id = uid()
    next = [...next, { id, name: 'Nouvelle étagère', ...skinOf(next[next.length - 1]), book_ids: [bookId] }]
    return { list: next, createdId: id }
  }
  next = next.map(s => (s.id === tid ? { ...s, book_ids: insertAt(s.book_ids, index, bookId) } : s))
  return { list: next }
}

export function createShelf(eff, name = 'Nouvelle étagère') {
  const { list } = materialize(eff)
  const id = uid()
  return { list: [...list, { id, name, ...skinOf(list[list.length - 1]), book_ids: [] }], id }
}

/** Range un livre tout juste ajouté sur une étagère (à la fin). */
export function placeBook(eff, bookId, targetId) {
  const { list, map } = materialize(eff)
  if (!list.length) return { list }
  const tid = map[targetId] || targetId
  const target = list.find(s => s.id === tid) || list[0]
  return { list: list.map(s => (s === target ? { ...s, book_ids: [...s.book_ids.filter(x => x !== bookId), bookId] } : { ...s, book_ids: s.book_ids.filter(x => x !== bookId) })) }
}

const patchShelf = (eff, id, fn) => {
  const { list, map } = materialize(eff)
  const tid = map[id] || id
  return { list: list.map(s => (s.id === tid ? fn(s) : s)), id: tid }
}

export const renameShelf = (eff, id, name) => patchShelf(eff, id, s => ({ ...s, name: name.trim() || s.name }))
export const setShelfSkin = (eff, id, patch) => patchShelf(eff, id, s => ({ ...s, ...patch }))

export function applySkinToAll(eff, id) {
  const { list, map } = materialize(eff)
  const src = list.find(s => s.id === (map[id] || id))
  if (!src) return { list }
  const skin = skinOf(src)
  return { list: list.map(s => ({ ...s, ...skin })) }
}

export function moveShelf(eff, id, delta) {
  const { list, map } = materialize(eff)
  const tid = map[id] || id
  const i = list.findIndex(s => s.id === tid)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return { list }
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return { list: next }
}

export function deleteShelf(eff, id) {
  const { list, map } = materialize(eff)
  const tid = map[id] || id
  return { list: list.filter(s => s.id !== tid) } // ses livres repassent dans « À ranger »
}

/** Supprime une étagère en rangeant ses livres à la fin d'une autre. */
export function deleteShelfMoving(eff, id, destId) {
  const { list, map } = materialize(eff)
  const tid = map[id] || id
  const did = map[destId] || destId
  const src = list.find(s => s.id === tid)
  if (!src || tid === did) return { list }
  return {
    list: list
      .filter(s => s.id !== tid)
      .map(s => (s.id === did ? { ...s, book_ids: [...s.book_ids, ...src.book_ids.filter(x => !s.book_ids.includes(x))] } : s)),
    id: did,
  }
}

/** Transforme « À ranger » en vraie étagère. */
export function adoptLoose(eff) {
  const loose = eff.find(s => s.id === LOOSE)
  const { list } = materialize(eff)
  if (!loose) return { list }
  const id = uid()
  return { list: [...list, { id, name: 'Nouvelle étagère', ...skinOf(list[list.length - 1]), book_ids: loose.book_ids }], id }
}

/** Aperçu pendant un glisser-déposer : le livre quitte sa place, un emplacement s'ouvre à la cible. */
export function previewDrag(eff, bookId, target) {
  const without = eff.map(s => ({ ...s, book_ids: s.book_ids.filter(x => x !== bookId) }))
  if (!target) return without
  if (target.shelfId === NEWSHELF) {
    return [...without, { id: NEWSHELF, name: 'Nouvelle étagère', ...skinOf(without[without.length - 1]), book_ids: [PH], preview: true }]
  }
  return without.map(s => (s.id === target.shelfId ? { ...s, book_ids: insertAt(s.book_ids, target.index, PH) } : s))
}
