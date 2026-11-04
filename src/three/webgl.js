/** Le navigateur sait-il afficher de la 3D (WebGL) ? Sinon on garde l'étagère dessinée à plat. */
export function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch { return false }
}

/**
 * iPhone : un appui long sur la 3D ne doit ni sélectionner du texte (poignées bleues),
 * ni afficher la loupe ou le menu « Copier ». Les gestes restent gérés par les évènements pointer.
 */
export function noTouchSelect(el) {
  el.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault() }, { passive: false })
  el.addEventListener('contextmenu', e => e.preventDefault())
  el.addEventListener('selectstart', e => e.preventDefault())
}
