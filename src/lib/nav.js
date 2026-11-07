import { useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * La navigation du site : chaque endroit ouvert (la bibliothèque, la cuisine, la télé, un panneau,
 * une fiche…) laisse une entrée dans l'historique du navigateur, avec son adresse
 * (« /cuisine/semaine », « /bibliotheque/livre/42 »…). Ainsi, partout, de la même façon :
 *   - le bouton retour du navigateur, le geste retour du téléphone et la touche Échap referment
 *     l'endroit du dessus (avec son animation habituelle) ;
 *   - recharger la page ramène au même endroit, et on peut garder une adresse en favori.
 *
 * Chaque composant déclare simplement ce qu'il a d'ouvert :
 *   useLayer(ouvert, '/adresse', fermer)
 *   useBack(profondeur, i => '/adresse', revenirA)  (plusieurs pas : le PC, ses pages…)
 * et l'historique suit tout seul : on ne touche jamais à `history` ailleurs.
 *
 * La barre de la maison s'en sert aussi : useNav() dit dans quel module on est (et si un panneau
 * est ouvert par-dessus), goSection('cuisine') y emmène d'où qu'on soit.
 */

const SEARCH = typeof location !== 'undefined' ? location.search : ''
const stack = []          // les entrées ouvertes, de la plus ancienne à celle du dessus : { owner, i, path }
const hist = []           // les entrées que l'historique du navigateur contient (au-dessus de l'accueil)
let busy = false, again = false
let pendingGo = null

// ---- Qui écoute (la barre de la maison) ------------------------------------------------------
const listeners = new Set()
let version = 0
const notify = () => { version++; listeners.forEach(f => f()) }
const subscribe = f => { listeners.add(f); return () => listeners.delete(f) }

// ---- L'adresse d'arrivée : on la garde, puis on repart de l'accueil (les endroits se rouvrent un par un)
const clean = p => '/' + String(p || '/').split('/').filter(Boolean).map(decodeURIComponent).join('/')
const BOOT = typeof location !== 'undefined' ? clean(location.pathname).split('/').filter(Boolean) : []
let bootTaken = false
if (typeof history !== 'undefined') {
  try { history.replaceState({ maru: 0 }, '', '/' + SEARCH) } catch { /* ignore */ }
}
/**
 * L'endroit demandé à l'arrivée sur le site (une seule fois) : ['cuisine', 'semaine'], ou null.
 * `scope` : les premiers mots que le composant sait ouvrir.
 */
export function takeStart(scope) {
  if (bootTaken || !BOOT.length || !scope.includes(BOOT[0])) return null
  bootTaken = true
  return BOOT
}
/** Sans rien prendre : l'adresse d'arrivée (pour décider de l'état de départ). */
export const peekStart = () => (bootTaken ? [] : BOOT)

// ---- L'historique suit la pile ---------------------------------------------------------------
function go(n) {
  return new Promise(res => {
    const t = setTimeout(() => { pendingGo = null; res() }, 600)
    pendingGo = () => { clearTimeout(t); res() }
    history.go(n)
  })
}
const shownPath = () => clean(location.pathname)
function schedule() {
  if (busy) { again = true; return }
  busy = true
  queueMicrotask(run)
}
async function run() {
  try {
    for (;;) {
      again = false
      let p = 0
      while (p < hist.length && p < stack.length && hist[p] === stack[p]) p++
      if (hist.length > p) { const n = hist.length - p; hist.length = p; await go(-n); continue }
      for (let i = p; i < stack.length; i++) {
        history.pushState({ maru: i + 1 }, '', stack[i].path + SEARCH)
        hist.push(stack[i])
      }
      // un pas de côté (le frigo → les placards, un autre onglet…) : la même entrée, une autre adresse
      const want = hist.length ? hist[hist.length - 1].path : '/'
      if (shownPath() !== want) history.replaceState({ maru: hist.length }, '', want + SEARCH)
      if (!again) break
    }
  } finally { busy = false; notify() }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', e => {
    if (pendingGo) { const r = pendingGo; pendingGo = null; r(); return }
    const d = Math.max(0, e.state?.maru ?? 0)
    if (d < hist.length) {
      // retour : on referme ce qui était au-dessus (seulement le plus bas : le reste se ferme avec)
      const removed = hist.splice(d)
      const firstOf = new Map()
      for (const x of removed) {
        const k = stack.indexOf(x)
        if (k >= 0) stack.splice(k, 1)
        if (!firstOf.has(x.owner)) firstOf.set(x.owner, x.i)
      }
      const now = performance.now()
      for (const [o, i] of firstOf) { o.wait = i; o.waitUntil = now + 3000 }
      const low = removed[0]
      try { low.owner.backTo(low.i) } catch { /* ignore */ }
      schedule()
    } else if (d > hist.length) {
      // « suivant » : on ne rouvre pas ce qui a été fermé, on reste où on est
      history.go(hist.length - d)
      pendingGo = () => {}
    }
  })

  // Échap : comme le bouton retour (sauf dans un champ, qu'on quitte d'abord, ou si un composant
  // a déjà traité la touche lui-même : un menu, une bande-annonce…)
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    setTimeout(() => {
      if (e.defaultPrevented) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) { t.blur?.(); return }
      back()
    })
  })
}

/** Revenir d'un pas (le bouton retour du site fait exactement comme celui du navigateur). */
export function back() {
  if (hist.length) history.back()
  else if (stack.length) { const top = stack[stack.length - 1]; top.owner.backTo(top.i) }
}
/** Il y a quelque chose d'ouvert au-dessus de l'accueil. */
export const canGoBack = () => stack.length > 0

/**
 * Plusieurs pas d'un même composant : `depth` entrées, l'entrée i à l'adresse pathOf(i) ;
 * backTo(i) : revenir à la profondeur i (appelé par le retour du navigateur, Échap…).
 */
export function useBack(depth, pathOf, backTo, opts = {}) {
  const own = useRef(null)
  if (!own.current) own.current = { entries: [], wait: null, waitUntil: 0 }
  const o = own.current
  o.backTo = backTo
  o.modal = !!opts.modal
  o.depth = depth
  o.pathOf = pathOf
  useEffect(() => { sync(o) })
  // si l'animation du retour n'a pas refermé l'endroit, on le remet dans l'historique
  useEffect(() => {
    if (o.wait == null) return
    const t = setTimeout(() => { o.wait = null; sync(o) }, Math.max(0, o.waitUntil - performance.now()) + 50)
    return () => clearTimeout(t)
  })
  useEffect(() => () => {
    o.dead = true
    for (const x of o.entries) { const k = stack.indexOf(x); if (k >= 0) stack.splice(k, 1) }
    o.entries = []
    schedule(); notify()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
function sync(o) {
  if (o.dead) return
  o.entries = o.entries.filter(x => stack.includes(x))
  // on vient de revenir en arrière : on laisse à l'animation le temps de refermer
  if (o.wait != null && (o.depth <= o.wait || performance.now() > o.waitUntil)) o.wait = null
  const want = o.wait != null ? Math.min(o.depth, o.entries.length) : o.depth
  let changed = false
  while (o.entries.length > want) { const x = o.entries.pop(); const k = stack.indexOf(x); if (k >= 0) stack.splice(k, 1); changed = true }
  while (o.entries.length < want) { const x = { owner: o, i: o.entries.length, path: '/' }; o.entries.push(x); stack.push(x); changed = true }
  o.entries.forEach((x, i) => { const p = clean(o.pathOf(i)); if (x.path !== p) { x.path = p; changed = true } })
  if (changed) { schedule(); notify() }
}

/**
 * Un endroit ouvert (un pas) : useLayer(ouvert, '/adresse', fermer).
 * { modal: true } : un panneau qui couvre l'écran (une fiche, la recherche…) : la barre de la
 * maison s'efface pendant qu'il est ouvert.
 */
export function useLayer(open, path, close, opts) {
  useBack(open ? 1 : 0, () => path, () => close(), opts)
}

// ---- La barre de la maison : où l'on est, et y aller d'un toucher ----------------------------
export const SECTIONS = ['salon', 'bibliotheque', 'films', 'jeux', 'cuisine']
const ROOMS = ['cuisine', 'garage', 'chambre']
const SECTION_OF = { bibliotheque: 'bibliotheque', films: 'films', jeux: 'jeux', cuisine: 'cuisine', garage: 'garage', chambre: 'chambre' }
/** Le module où l'on est : celui de l'endroit le plus bas ouvert ('salon' sans rien d'ouvert). */
const currentSection = () => (stack.length ? SECTION_OF[stack[0].path.split('/')[1]] || 'salon' : 'salon')
let pending = null     // le module où l'on va (on referme d'abord ce qui est ouvert)

/**
 * Aller dans un module d'où qu'on soit : on referme ce qui est ouvert (en revenant au salon, ou
 * seulement à la pièce si l'on va d'une pièce à l'autre), puis le salon nous y emmène.
 * Le module où l'on est déjà : on revient à son accueil.
 */
export function goSection(id) {
  const cur = currentSection()
  const keepRoot = (cur === id && id !== 'salon') || (ROOMS.includes(cur) && ROOMS.includes(id)) ? 1 : 0
  if (cur !== id && id !== 'salon') { pending = id; notify() }
  const n = hist.length - keepRoot
  if (n > 0) history.go(-n)
}
/** Le salon prend le module demandé (une seule fois). */
export function takePending() { const p = pending; pending = null; notify(); return p }

/** Pour la barre de la maison (et le salon) : { section, pending, modal, depth }. */
export function useNav() {
  useSyncExternalStore(subscribe, () => version)
  return { section: currentSection(), pending, modal: stack.some(x => x.owner.modal), depth: stack.length }
}
