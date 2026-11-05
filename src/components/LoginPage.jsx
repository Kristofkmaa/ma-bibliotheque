import { useState } from 'react'
import { SPINE_PALETTE } from '../lib/bookUtils'
import { isDemoMode } from '../lib/supabase'

const SPINES = [
  { w: 18, h: 92, c: 0 }, { w: 14, h: 76, c: 1 }, { w: 22, h: 104, c: 2 }, { w: 16, h: 84, c: 3 },
  { w: 20, h: 96, c: 4 }, { w: 24, h: 112, c: 5 }, { w: 14, h: 78, c: 6 }, { w: 18, h: 88, c: 7 },
  { w: 26, h: 106, c: 8 }, { w: 16, h: 72, c: 9 }, { w: 20, h: 98, c: 10 }, { w: 14, h: 80, c: 11 },
]

export default function LoginPage({ onSignIn }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true); setError('')
    try { await onSignIn() } catch (e) { setError(e.message || 'Connexion impossible'); setBusy(false) }
  }

  return (
    <div className="login">
      <div className="login-shelf" aria-hidden="true">
        {SPINES.map((s, i) => (
          <div key={i} className="login-spine" style={{ width: s.w, height: s.h, background: SPINE_PALETTE[s.c][0], color: SPINE_PALETTE[s.c][1], animationDelay: `${0.15 + i * 0.06}s` }} />
        ))}
      </div>
      <div>
        <h1 className="login-title">Bibliothèque<br /><em>Maruchime</em></h1>
      </div>
      <p className="login-sub">Une étagère à feuilleter du bout des doigts : les livres lus, ceux qu'on possède, ceux qu'on attend encore.</p>
      <button type="button" className="lbl box cobalt" onClick={go} disabled={busy}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.25 1.5-1.7 4.4-5.35 4.4-3.2 0-5.85-2.65-5.85-5.9s2.65-5.9 5.85-5.9c1.85 0 3.05.8 3.75 1.45l2.55-2.45C16.75 4.1 14.6 3 12 3 7.05 3 3 7.05 3 12s4.05 9 9 9c5.2 0 8.65-3.65 8.65-8.8 0-.6-.05-1.05-.3-2.1z"/></svg>
        {isDemoMode ? 'Entrer en mode démo' : 'Se connecter avec Google'}
      </button>
      {isDemoMode && <p className="login-note">Supabase non configuré · les livres restent dans ce navigateur</p>}
      {error && <p className="login-error">{error}</p>}
    </div>
  )
}
