import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { IconGoogle } from './Icons'
import { BibliSyIcon } from './BibliSyLogo'

const GOLD = '#816EBB'

// ── Livres décoratifs animés ──────────────────────────────────────────────────
const BOOKS = [
  { w: 18, h: 72, c: '#8B2635', delay: 0    },
  { w: 14, h: 58, c: '#2D1B69', delay: 0.3  },
  { w: 22, h: 80, c: '#1A5C6B', delay: 0.6  },
  { w: 16, h: 65, c: '#4A1A6B', delay: 0.15 },
  { w: 20, h: 74, c: '#2D6A4F', delay: 0.45 },
  { w: 24, h: 86, c: '#7B4F12', delay: 0.75 },
  { w: 14, h: 60, c: '#6B3030', delay: 0.9  },
  { w: 18, h: 68, c: '#1E3A5F', delay: 0.2  },
  { w: 26, h: 82, c: '#3D1A5C', delay: 0.55 },
  { w: 16, h: 56, c: '#2B5A3E', delay: 0.1  },
  { w: 20, h: 76, c: '#5C2A1A', delay: 0.65 },
  { w: 14, h: 62, c: '#1A3A5C', delay: 0.4  },
]

function BookShelf({ books = BOOKS }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
      {/* Planche */}
      {books.map((b, i) => (
        <motion.div
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 + b.delay, duration: 0.5, ease: 'easeOut' }}
          style={{
            width: b.w, height: b.h,
            background: `linear-gradient(180deg, ${b.c} 0%, ${b.c}cc 100%)`,
            borderRadius: '2px 3px 3px 2px',
            boxShadow: `inset 2px 0 5px rgba(0,0,0,0.35), 1px 0 6px rgba(0,0,0,0.5)`,
            position: 'relative', overflow: 'hidden', flexShrink: 0,
          }}
        >
          {/* Reflet tranche */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: 4,
            height: '100%',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.18), transparent)',
          }} />
          {/* Ligne de titre simulée */}
          <div style={{
            position: 'absolute', top: '30%', left: 3, right: 3,
            height: 1.5, background: 'rgba(255,255,255,0.12)', borderRadius: 1,
          }} />
        </motion.div>
      ))}
    </div>
  )
}

// ── Feature card ──────────────────────────────────────────────────────────────
function Feature({ icon, title, desc, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: 'easeOut' }}
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(129,110,187,0.14)',
        borderRadius: 14, padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: 'rgba(129,110,187,0.13)',
        border: '1px solid rgba(129,110,187,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE9F8', marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'rgba(237,233,248,0.42)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </motion.div>
  )
}

// ── Stat ──────────────────────────────────────────────────────────────────────
function Stat({ value, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: GOLD, letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(237,233,248,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>{label}</div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function LoginPage({ onLogin, loading }) {
  const [hovered, setHovered] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = document.getElementById('biblisy-landing')
    if (!el) return
    const handler = () => setScrolled(el.scrollTop > 40)
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [])

  return (
    <div
      id="biblisy-landing"
      style={{
        minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden',
        background: '#0C0A15',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        position: 'relative',
      }}
    >
      {/* ── Halos de fond ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '-10%', left: '10%',
          width: '80vw', height: '80vw',
          background: 'radial-gradient(ellipse, rgba(129,110,187,0.07) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '5%', right: '-10%',
          width: '60vw', height: '60vw',
          background: 'radial-gradient(ellipse, rgba(101,87,160,0.05) 0%, transparent 65%)',
        }} />
      </div>

      {/* ── Navbar flottante ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px',
          background: scrolled ? 'rgba(12,10,21,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(129,110,187,0.1)' : '1px solid transparent',
          transition: 'background 0.3s, border-color 0.3s, backdrop-filter 0.3s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <BibliSyIcon size={26} light={true} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#EDE9F8', letterSpacing: '-0.03em' }}>Biblisy</span>
        </div>
        <button
          onClick={onLogin}
          disabled={loading}
          style={{
            padding: '8px 18px', borderRadius: 20,
            background: 'rgba(129,110,187,0.15)',
            border: '1px solid rgba(129,110,187,0.3)',
            color: GOLD, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,110,187,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,110,187,0.15)' }}
        >
          Se connecter
        </button>
      </motion.div>

      {/* ── HERO ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px 40px', textAlign: 'center',
        minHeight: 'calc(100vh - 60px)',
      }}>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(129,110,187,0.1)',
            border: '1px solid rgba(129,110,187,0.25)',
            borderRadius: 20, padding: '5px 14px',
            fontSize: 11, fontWeight: 600,
            color: 'rgba(237,233,248,0.6)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, display: 'inline-block' }} />
          Ta bibliothèque personnelle
        </motion.div>

        {/* Grand logo */}
        <motion.div
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: 28 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            {/* Glow derrière l'icône */}
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', inset: -24,
                background: 'radial-gradient(circle, rgba(129,110,187,0.22) 0%, transparent 70%)',
                borderRadius: '50%',
              }} />
              <BibliSyIcon size={96} light={true} />
            </div>
            {/* Nom stylisé */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, lineHeight: 1 }}>
              <span style={{
                fontFamily: "'Playfair Display', 'Georgia', serif",
                fontSize: 56, fontWeight: 700,
                color: '#EDE9F8',
                letterSpacing: '-0.03em',
              }}>Biblisy</span>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: GOLD, marginLeft: 3, marginBottom: 12,
                display: 'inline-block', flexShrink: 0,
              }} />
            </div>
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.55 }}
          style={{
            fontSize: 'clamp(22px, 5vw, 34px)',
            fontWeight: 700, color: '#EDE9F8',
            margin: '0 0 16px', lineHeight: 1.25,
            maxWidth: 540,
          }}
        >
          Ta bibliothèque,{' '}
          <span style={{
            background: 'linear-gradient(135deg, #a78bfa, #816EBB)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>réinventée</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{
            fontSize: 16, color: 'rgba(237,233,248,0.45)',
            margin: '0 0 44px', lineHeight: 1.75,
            maxWidth: 440,
          }}
        >
          Organise tous tes livres, suis ta progression, découvre tes prochaines lectures grâce à l'IA et partage ta passion avec la communauté.
        </motion.p>

        {/* CTA principal */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
        >
          <button
            onClick={onLogin}
            disabled={loading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, padding: '16px 36px',
              background: loading ? 'rgba(255,255,255,0.06)' : '#ffffff',
              border: 'none', borderRadius: 14,
              fontSize: 15, fontWeight: 700, color: '#110D1E',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: hovered
                ? '0 8px 32px rgba(129,110,187,0.4), 0 2px 8px rgba(0,0,0,0.4)'
                : '0 4px 20px rgba(0,0,0,0.4)',
              transform: hovered ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              minWidth: 240,
            }}
          >
            <IconGoogle size={18} />
            {loading ? 'Connexion…' : 'Commencer avec Google'}
          </button>
          <span style={{ fontSize: 11, color: 'rgba(237,233,248,0.2)' }}>
            Gratuit · Aucune carte requise · Données privées
          </span>
        </motion.div>

        {/* Étagère animée */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          style={{ marginTop: 60, position: 'relative' }}
        >
          <BookShelf />
          {/* Planche */}
          <div style={{
            height: 5, borderRadius: 3,
            background: 'linear-gradient(90deg, transparent, rgba(129,110,187,0.35) 20%, rgba(129,110,187,0.55) 50%, rgba(129,110,187,0.35) 80%, transparent)',
            boxShadow: '0 2px 16px rgba(129,110,187,0.2)',
            marginTop: 0,
          }} />
          {/* Reflet planche */}
          <div style={{
            height: 20,
            background: 'linear-gradient(180deg, rgba(129,110,187,0.06), transparent)',
            borderRadius: '0 0 8px 8px',
          }} />
        </motion.div>

        {/* Flèche vers bas */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          style={{ marginTop: 40 }}
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            style={{ fontSize: 18, color: 'rgba(237,233,248,0.15)' }}
          >
            ↓
          </motion.div>
        </motion.div>
      </div>

      {/* ── FEATURES ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '60px 24px', maxWidth: 700, margin: '0 auto',
      }}>

        {/* Titre section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          style={{ textAlign: 'center', marginBottom: 40 }}
        >
          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: GOLD, marginBottom: 14,
          }}>
            Tout ce qu'il te faut
          </div>
          <h2 style={{
            fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 700,
            color: '#EDE9F8', margin: 0, lineHeight: 1.3,
          }}>
            Une app pensée pour les vrais lecteurs
          </h2>
        </motion.div>

        {/* Grille features */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
        }}>
          <Feature
            delay={0.05}
            icon="📚"
            title="Ta bibliothèque en un coup d'œil"
            desc="Tous tes livres organisés par statut : en cours, lus, souhaités, possédés, favoris. Retrouve n'importe quel livre en quelques secondes."
          />
          <Feature
            delay={0.15}
            icon="📷"
            title="Scanner = ajouter en 2 secondes"
            desc="Pointe la caméra sur le code-barres d'un livre. L'ISBN est détecté, les infos récupérées automatiquement depuis Google Books."
          />
          <Feature
            delay={0.25}
            icon="✨"
            title="Suggestions intelligentes"
            desc="L'IA analyse tes goûts et te propose des livres que tu vas adorer. Plus ta bibliothèque est riche, meilleures sont les recommandations."
          />
          <Feature
            delay={0.35}
            icon="📊"
            title="Suis ta progression"
            desc="Visualise tes stats de lecture : pages lues, genres préférés, objectifs annuels. Regarde ta bibliothèque grandir au fil des mois."
          />
          <Feature
            delay={0.45}
            icon="👥"
            title="Communauté de lecteurs"
            desc="Explore les bibliothèques d'autres passionnés, abonne-toi à tes amis et découvre ce qu'ils lisent en ce moment."
          />
          <Feature
            delay={0.55}
            icon="🔒"
            title="Profil public ou privé"
            desc="Tu décides de ce que tu partages. Active ton profil public pour rejoindre la communauté, ou garde ta bibliothèque pour toi."
          />
        </div>
      </div>

      {/* ── BANDE STATS ── */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{
          position: 'relative', zIndex: 1,
          margin: '0 24px 60px',
          maxWidth: 700 - 48, marginLeft: 'auto', marginRight: 'auto',
          background: 'rgba(129,110,187,0.05)',
          border: '1px solid rgba(129,110,187,0.14)',
          borderRadius: 16, padding: '28px 32px',
          display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 24,
        }}
      >
        <Stat value="∞" label="Livres possibles" />
        <Stat value="0€" label="Gratuit" />
        <Stat value="2s" label="Pour scanner" />
        <Stat value="100%" label="Privé & sécurisé" />
      </motion.div>

      {/* ── CTA FINAL ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{
          position: 'relative', zIndex: 1,
          textAlign: 'center',
          padding: '40px 24px 80px',
        }}
      >
        <div style={{
          maxWidth: 480, margin: '0 auto',
          background: 'linear-gradient(145deg, rgba(17,13,30,0.9), rgba(12,10,21,0.9))',
          border: '1px solid rgba(129,110,187,0.2)',
          borderRadius: 20, padding: '40px 32px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(16px)',
        }}>
          {/* Mini étagère dans la card */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <BookShelf books={BOOKS.slice(0, 7)} />
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'linear-gradient(90deg, transparent, rgba(129,110,187,0.5), transparent)', marginBottom: 28 }} />

          <h3 style={{
            fontFamily: "'Playfair Display', 'Georgia', serif",
            fontSize: 22, fontWeight: 700, color: '#EDE9F8',
            margin: '0 0 10px',
          }}>
            Prêt à construire ta bibliothèque ?
          </h3>
          <p style={{ fontSize: 14, color: 'rgba(237,233,248,0.4)', margin: '0 0 28px', lineHeight: 1.65 }}>
            Rejoins Biblisy et commence à organiser ta collection dès aujourd'hui. Gratuit, sans abonnement.
          </p>

          <button
            onClick={onLogin}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, width: '100%', padding: '15px 24px',
              background: loading ? 'rgba(255,255,255,0.05)' : '#fff',
              border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 700, color: '#110D1E',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.45)' } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.35)' }}
          >
            <IconGoogle size={18} />
            {loading ? 'Connexion…' : 'Commencer avec Google'}
          </button>

          <p style={{ fontSize: 11, color: 'rgba(237,233,248,0.18)', marginTop: 14, marginBottom: 0 }}>
            Tes données sont privées et ne sont jamais partagées.
          </p>
        </div>
      </motion.div>

      {/* ── FOOTER ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(129,110,187,0.08)',
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <BibliSyIcon size={16} light={true} />
        <span style={{ fontSize: 12, color: 'rgba(237,233,248,0.2)' }}>
          Biblisy · fait avec passion pour les lecteurs
        </span>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
