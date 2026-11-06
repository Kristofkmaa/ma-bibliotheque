/**
 * Sur téléphone, l'appli ne bouge pas : pas de zoom (pincer, double-toucher, champ de saisie)
 * et la page ne glisse pas de gauche à droite. Les gestes à deux doigts de nos propres scènes
 * (le salon) restent possibles : on n'empêche que la réaction du navigateur, pas l'événement.
 */
export function lockViewport() {
  const stop = e => { if (e.cancelable) e.preventDefault() }
  // Safari (iPhone) ignore user-scalable=no : ses gestes « gesture* » sont le zoom au pincement
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false })
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (typeof e.scale === 'number' && e.scale !== 1)) stop(e) }, { passive: false })
  // si un zoom est passé quand même (ou une page décalée), on revient en place
  const vv = window.visualViewport
  const reset = () => { if (window.scrollX) window.scrollTo(0, window.scrollY) }
  window.addEventListener('scroll', reset, { passive: true })
  vv?.addEventListener('resize', reset)
}
