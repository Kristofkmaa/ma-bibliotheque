import { useState, useRef, useEffect } from 'react'

// Profondeur de la tranche selon le nombre de pages
function spineDepth(pageCount) {
  if (!pageCount) return 28
  if (pageCount < 100)  return 14
  if (pageCount < 250)  return 20
  if (pageCount < 400)  return 28
  if (pageCount < 600)  return 36
  if (pageCount < 800)  return 44
  return 52
}

export default function Book3DViewer({ book }) {
  const W = 210   // largeur couverture px
  const H = 310   // hauteur couverture px
  const D = spineDepth(book.pageCount || book.page_count)

  const [rotY, setRotY] = useState(-28)   // légère rotation initiale pour voir la tranche
  const [rotX, setRotX] = useState(8)
  const [dragging, setDragging] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const rafId  = useRef(null)

  const cover = book.cover || book.cover_url

  // ── Drag souris ──────────────────────────────────────────────────────────
  const startDrag = (clientX, clientY) => {
    setDragging(true)
    lastPos.current = { x: clientX, y: clientY }
  }

  const moveDrag = (clientX, clientY) => {
    if (!dragging) return
    const dx = clientX - lastPos.current.x
    const dy = clientY - lastPos.current.y
    lastPos.current = { x: clientX, y: clientY }

    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      setRotY(r => r + dx * 0.55)
      setRotX(r => Math.max(-35, Math.min(35, r - dy * 0.35)))
    })
  }

  useEffect(() => () => cancelAnimationFrame(rafId.current), [])

  // ── Touches ──────────────────────────────────────────────────────────────
  const touchStart = e => startDrag(e.touches[0].clientX, e.touches[0].clientY)
  const touchMove  = e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY) }

  // ── Couleur tranche (bord gauche de la couverture) ───────────────────────
  // On utilise la couverture comme texture de tranche recadrée sur le bord gauche
  const spineStyle = {
    backgroundImage: cover ? `url(${cover})` : undefined,
    backgroundSize: `${W}px ${H}px`,
    backgroundPosition: 'left center',
    backgroundRepeat: 'no-repeat',
    filter: 'brightness(0.75) saturate(1.2)',
  }
  if (!cover) {
    spineStyle.background = 'linear-gradient(180deg, #5C3D2E, #6557A0, #5C3D2E)'
  }

  // ── Couleur dos (bord droit de la couverture) ────────────────────────────
  const backSpineStyle = {
    backgroundImage: cover ? `url(${cover})` : undefined,
    backgroundSize: `${W}px ${H}px`,
    backgroundPosition: 'right center',
    backgroundRepeat: 'no-repeat',
    filter: 'brightness(0.5)',
  }

  return (
    <div
      onMouseDown={e => startDrag(e.clientX, e.clientY)}
      onMouseMove={e => moveDrag(e.clientX, e.clientY)}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onTouchStart={touchStart}
      onTouchMove={touchMove}
      onTouchEnd={() => setDragging(false)}
      style={{
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${D + 40}px ${D + 60}px`,
        perspective: '1100px',
        touchAction: 'none',
      }}
    >
      <div
        style={{
          width: W,
          height: H,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: dragging ? 'none' : 'transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)',
          filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.85))',
        }}
      >
        {/* ── Couverture (face avant) ── */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translateZ(${D / 2}px)`,
          overflow: 'hidden',
          borderRadius: '0 3px 3px 0',
          boxShadow: `
            inset -3px 0 10px rgba(0,0,0,0.3),
            2px 0 6px rgba(0,0,0,0.2)
          `,
        }}>
          {cover
            ? <img src={cover} alt={book.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(145deg, #2D1B69, #1A0F3A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20, textAlign: 'center',
              }}>
                <span style={{
                  fontFamily: "'Playfair Display', serif",
                  color: '#D4C8FF', fontSize: 16, fontWeight: 700, lineHeight: 1.4,
                }}>{book.title}</span>
              </div>
          }
          {/* Reflet brillant */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* ── Dos du livre (face arrière) ── */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: `rotateY(180deg) translateZ(${D / 2}px)`,
          overflow: 'hidden',
          borderRadius: '0 3px 3px 0',
          ...backSpineStyle,
        }}>
          {!cover && (
            <div style={{ width:'100%',height:'100%', background:'#1a0e05' }} />
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20,
          }}>
            <p style={{
              fontFamily: "'Playfair Display', serif",
              color: 'rgba(237,233,248,0.7)', fontSize: 13,
              textAlign: 'center', lineHeight: 1.4, margin: 0,
            }}>{book.title}</p>
            <div style={{ width: 40, height: 1, background: 'rgba(129,110,187,0.4)' }} />
            <p style={{
              color: 'rgba(237,233,248,0.45)', fontSize: 11, margin: 0,
            }}>{(book.authors || [])[0]}</p>
          </div>
        </div>

        {/* ── Tranche (face gauche) — texture extraite de la couverture ── */}
        <div style={{
          position: 'absolute',
          left: -D, width: D, height: H,
          transformOrigin: 'right center',
          transform: `rotateY(90deg) translateZ(-${D / 2}px)`,
          overflow: 'hidden',
          ...spineStyle,
          boxShadow: 'inset -4px 0 12px rgba(0,0,0,0.4), inset 2px 0 6px rgba(255,255,255,0.05)',
        }}>
          {/* Reflet tranche */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, rgba(0,0,0,0.3) 0%, rgba(255,255,255,0.05) 40%, rgba(0,0,0,0.2) 100%)',
          }} />
          {/* Titre vertical sur la tranche */}
          {D >= 20 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                fontFamily: "'Playfair Display', serif",
                fontSize: Math.max(8, Math.min(11, D * 0.3)) + 'px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                lineHeight: 1.2,
                letterSpacing: '0.03em',
                overflow: 'hidden',
                maxHeight: '85%',
                textAlign: 'center',
              }}>
                {book.title}
              </span>
            </div>
          )}
        </div>

        {/* ── Pages (face droite) — blanc ivoire ── */}
        <div style={{
          position: 'absolute',
          right: -D, width: D, height: H,
          transformOrigin: 'left center',
          transform: `rotateY(-90deg) translateZ(${D / 2}px)`,
          background: `repeating-linear-gradient(
            90deg,
            #f8f4ec 0px,
            #ede8df 1px,
            #f8f4ec 2px
          )`,
          boxShadow: 'inset 3px 0 8px rgba(0,0,0,0.12)',
        }} />

        {/* ── Haut du livre ── */}
        <div style={{
          position: 'absolute',
          top: -D, left: 0, width: W, height: D,
          transformOrigin: 'bottom center',
          transform: `rotateX(90deg) translateZ(-${D / 2}px)`,
          background: '#f0ebe0',
          boxShadow: 'inset 0 -2px 6px rgba(0,0,0,0.15)',
        }} />

        {/* ── Bas du livre ── */}
        <div style={{
          position: 'absolute',
          bottom: -D, left: 0, width: W, height: D,
          transformOrigin: 'top center',
          transform: `rotateX(-90deg) translateZ(${D / 2}px)`,
          background: '#e8e0d0',
        }} />
      </div>

      {/* Hint drag */}
      <p style={{
        position: 'absolute',
        bottom: 8,
        fontSize: '11px',
        color: 'rgba(237,233,248,0.25)',
        margin: 0,
        letterSpacing: '0.04em',
        pointerEvents: 'none',
      }}>
        Fais glisser pour faire tourner le livre
      </p>
    </div>
  )
}
