import { useEffect, useState } from 'react'
import { sharpCoverUrls } from '../lib/covers'

const best = new Map()   // couverture → la meilleure version déjà trouvée (on ne cherche qu'une fois)
const keyOf = b => (b?.cover_url || b?.cover || '') + '|' + (b?.isbn || '')

/**
 * Une couverture nette pour l'afficher en grand : d'abord la vignette (tout de suite), puis la
 * version grand format dès qu'elle est chargée (Google Books en grand, sinon Open Library).
 * Si aucune ne répond, on garde la vignette.
 */
export function useSharpCover(book, w = 900) {
  const k = keyOf(book)
  const first = (book?.cover_url || book?.cover || '').replace('http://', 'https://')
  const [src, setSrc] = useState(() => best.get(k) || first)
  useEffect(() => {
    if (best.has(k)) { setSrc(best.get(k)); return }
    setSrc(first)
    const list = sharpCoverUrls(book, w).filter(u => u !== first)
    if (!list.length) return
    let live = true
    const tryNext = i => {
      if (i >= list.length || !live) return
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        // une image vide (Open Library) ou pas plus grande que la vignette : on essaie la suivante
        if (img.naturalWidth < 260) { tryNext(i + 1); return }
        best.set(k, list[i])
        if (live) setSrc(list[i])
      }
      img.onerror = () => tryNext(i + 1)
      img.src = list[i]
    }
    tryNext(0)
    return () => { live = false }
  }, [k]) // eslint-disable-line react-hooks/exhaustive-deps
  return src
}
