import { back } from '../lib/nav'

/**
 * Le bouton retour du site : partout le même, en haut à gauche, et il dit où il mène
 * (« Le salon », « La cuisine », « Recettes »…). Il fait exactement comme le bouton retour du
 * navigateur (ou le geste retour du téléphone) : il referme l'endroit du dessus.
 *   tone : 'light' (sur une pièce claire) ou 'dark' (la télé, le PC, une pièce sombre)
 */
export default function BackButton({ label, tone = 'light', onClick, className = '' }) {
  return (
    <button type="button" className={`nav-back ${tone} ${className}`.trim()} onClick={onClick || back} aria-label={`Retour : ${label}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      <span>{label}</span>
    </button>
  )
}
