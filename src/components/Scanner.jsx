import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { searchByISBN } from '../lib/googleBooks'

/** Scanner de code-barres ISBN (caméra) via html5-qrcode. */
export default function Scanner({ onBookFound, onClose }) {
  const [status, setStatus] = useState('Initialisation de la caméra…')
  const [error, setError] = useState('')
  const scannerRef = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('isbn-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 110 } },
          async decoded => {
            if (doneRef.current || cancelled) return
            doneRef.current = true
            setStatus('Code détecté, recherche du livre…')
            try {
              await scanner.stop().catch(() => {})
              scannerRef.current = null
              const book = await searchByISBN(decoded)
              if (book) onBookFound(book)
              else { setError('Aucun livre trouvé pour le code ' + decoded); doneRef.current = false }
            } catch {
              setError('Erreur lors de la recherche du livre.')
              doneRef.current = false
            }
          },
          () => {}
        )
        if (!cancelled) setStatus('Pointe le code-barres au dos du livre vers la caméra')
      } catch {
        if (!cancelled) { setError("Impossible d'accéder à la caméra. Vérifie les permissions du navigateur."); setStatus('') }
      }
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(timer)
      if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null }
    }
  }, [onBookFound])

  return (
    <div className="scanner-panel" role="dialog" aria-modal="true" aria-label="Scanner un code-barres">
      <button type="button" className="lbl box search-close-btn" onClick={onClose}>Fermer</button>
      <div className="detail-top-logo"><div className="logo"><div className="logo-name">Levana</div><div className="logo-sub">Scanner</div></div></div>
      <div id="isbn-reader" className="scanner-box" />
      {status && <p className="scanner-msg">{status}</p>}
      {error && <p className="scanner-msg error">{error}</p>}
    </div>
  )
}
