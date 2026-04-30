// Logo Biblisy — B en forme de livre avec signet violet
// light=true  → blanc + violet  (sur fond sombre)
// light=false → marine + violet (sur fond clair)

export function BibliSyIcon({ size = 40, light = true }) {
  const ink    = light ? '#FFFFFF' : '#1E2340'
  const purple = '#816EBB'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Épine du livre (barre verticale gauche) ── */}
      <rect x="4" y="4" width="7" height="50" rx="3.5" fill={ink} />

      {/* ── Lignes de pages en bas ── */}
      <line x1="4"  y1="52" x2="38" y2="52" stroke={ink} strokeWidth="2"   strokeLinecap="round" opacity="0.7"/>
      <line x1="4"  y1="55" x2="32" y2="55" stroke={ink} strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>

      {/* ── Bosse supérieure du B ── */}
      <path
        d="M11 4 L26 4 Q42 4 42 15 Q42 26 26 26 L11 26"
        stroke={ink}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Bosse inférieure du B (plus large) ── */}
      <path
        d="M11 26 L28 26 Q47 26 47 38 Q47 50 28 50 L11 50"
        stroke={ink}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Signet violet ── */}
      <path
        d="M24 22 L24 37 L29 32 L34 37 L34 22 Z"
        fill={purple}
      />
    </svg>
  )
}

// Logo horizontal : icône + texte côte à côte
export function BibliSyLogoHorizontal({ iconSize = 32, fontSize = 16, light = true }) {
  const textColor = light ? '#EDE9F8' : '#1E2340'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <BibliSyIcon size={iconSize} light={light} />
      <span style={{
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        fontSize, fontWeight: 700,
        color: textColor,
        letterSpacing: '-0.03em',
        lineHeight: 1,
      }}>
        Biblisy
      </span>
    </div>
  )
}

// Logo vertical : icône au-dessus, texte en dessous (page de connexion)
export function BibliSyLogoVertical({ iconSize = 72, light = true }) {
  const textColor  = light ? '#EDE9F8' : '#1E2340'
  const purple     = '#816EBB'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <BibliSyIcon size={iconSize} light={light} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
        <span style={{
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
          fontSize: iconSize * 0.42, fontWeight: 700,
          color: textColor,
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          Biblisy
        </span>
        <span style={{
          width: 5, height: 5, borderRadius: 1,
          background: purple,
          marginLeft: 1, marginBottom: 4,
          display: 'inline-block',
        }}/>
      </div>
    </div>
  )
}
