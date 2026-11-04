/** Le panier peut contenir 20 livres ; il s'élargit avec son contenu (sans devenir gigantesque). */
export const MAX_BASKET = 20
export const basketScale = n => 1 + 0.6 * Math.max(0, Math.min(1, (n - 4) / 16))
