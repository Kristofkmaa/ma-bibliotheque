import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { searchByISBN } from '../lib/googleBooks'
import { IconBarcode, IconX } from './Icons'

export default function Scanner({ onBookFound, onClose }) {
  const [mode, setMode] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const html5QrRef = useRef(null)
  const doneRef    = useRef(false)

  useEffect(() => {
    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {})
        html5QrRef.current = null
      }
    }
  }, [])

  const startBarcodeScanner = async () => {
    setMode('barcode')
    setError('')
    doneRef.current = false
    setStatus('Initialisation de la camera...')

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader')
        html5QrRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 100 } },
          async (decodedText) => {
            // Evite les appels multiples si le callback se declenche plusieurs fois
            if (doneRef.current) return
            doneRef.current = true

            setScanning(true)
            setStatus('ISBN detecte. Recherche en cours...')

            try {
              await scanner.stop().catch(() => {})
              html5QrRef.current = null

              const book = await searchByISBN(decodedText)
              if (book) {
                onBookFound(book)
                onClose()
              } else {
                setError('Aucun livre trouve pour cet ISBN : ' + decodedText)
                setScanning(false)
                doneRef.current = false
              }
            } catch {
              setError('Erreur lors de la recherche du livre.')
              setScanning(false)
              doneRef.current = false
            }
          },
          () => {}
        )

        setStatus('Pointez le code-barres vers la camera')
      } catch {
        setError("Impossible d'acceder a la camera. Verifiez les permissions.")
        setStatus('')
      }
    }, 100)
  }

  // Démarre le scanner automatiquement à l'ouverture
  useEffect(() => {
    startBarcodeScanner()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.9)',
      backdropFilter: 'blur(8px)',
      zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #0E0B1A, #130F22)',
        border: '1px solid rgba(129,110,187,0.18)',
        borderRadius: '16px', width: '100%', maxWidth: '460px',
        padding: '28px',
        boxShadow: '0 25px 80px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconBarcode size={18} color="#816EBB" />
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.2rem', fontWeight: 700,
              color: '#EDE9F8', margin: 0,
            }}>
              Scanner un livre
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.07)', border: 'none',
            borderRadius: '8px', width: 32, height: 32,
            color: 'rgba(237,233,248,0.5)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconX size={14} />
          </button>
        </div>

        {/* Scanner barcode */}
        {mode === 'barcode' && !scanning && (
          <div>
            <div id="qr-reader" style={{ borderRadius: '8px', overflow: 'hidden' }} />
            {status && (
              <p style={{ color: '#816EBB', fontSize: '13px', textAlign: 'center', marginTop: '12px' }}>
                {status}
              </p>
            )}
          </div>
        )}

        {/* Chargement */}
        {scanning && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 0',
          }}>
            <div style={{
              width: 40, height: 40,
              border: '2px solid rgba(129,110,187,0.15)',
              borderTopColor: '#816EBB', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#816EBB', fontSize: '14px', textAlign: 'center', margin: 0 }}>
              {status || 'Analyse en cours…'}
            </p>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div style={{
            marginTop: '16px', padding: '14px 16px',
            background: 'rgba(200,50,50,0.08)',
            border: '1px solid rgba(200,50,50,0.2)',
            borderRadius: '10px',
          }}>
            <p style={{ color: '#f87171', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>
            <button
              onClick={() => { setError(''); setStatus(''); startBarcodeScanner() }}
              style={{
                color: '#816EBB', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '13px', padding: 0,
              }}
            >
              ← Réessayer
            </button>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
