import { useMemo } from 'react'

/* ── Ambient particle field (light theme) ──────────────────────────────── */
const PARTICLE_COLORS = [
  { color: 'rgba(99,102,241,0.35)',  glow: '6px' },   // indigo (soft)
  { color: 'rgba(6,182,212,0.3)',    glow: '6px' },   // cyan (soft)
  { color: 'rgba(167,139,250,0.3)',  glow: '6px' },   // violet (soft)
  { color: 'rgba(245,158,11,0.25)',  glow: '5px' },   // warm amber (accent)
]

export function ParticleField({ count = 46 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const palette = PARTICLE_COLORS[i % PARTICLE_COLORS.length]
      const size = (Math.random() * 2.6 + 1).toFixed(2)
      return {
        id: i,
        x: `${(Math.random() * 100).toFixed(2)}%`,
        y: `${(Math.random() * 100).toFixed(2)}%`,
        size: `${size}px`,
        glow: palette.glow,
        color: palette.color,
        dur: `${(Math.random() * 18 + 16).toFixed(1)}s`,
        twinkle: `${(Math.random() * 4 + 3).toFixed(1)}s`,
        delay: `${(Math.random() * -30).toFixed(1)}s`,
        driftX: `${(Math.random() * 90 - 45).toFixed(0)}px`,
        driftY: `${-(Math.random() * 120 + 50).toFixed(0)}px`,
        maxOpacity: (Math.random() * 0.35 + 0.25).toFixed(2),
      }
    })
  }, [count])

  return (
    <div className="particle-field">
      {particles.map(p => (
        <span
          key={p.id}
          className="particle-dot"
          style={{
            '--x': p.x,
            '--y': p.y,
            '--size': p.size,
            '--glow': p.glow,
            '--color': p.color,
            '--dur': p.dur,
            '--twinkle': p.twinkle,
            '--delay': p.delay,
            '--drift-x': p.driftX,
            '--drift-y': p.driftY,
            '--max-opacity': p.maxOpacity,
          }}
        />
      ))}
    </div>
  )
}

/* ── Global ambient background (light theme) ────────────────────────────── */
export default function AmbientBackground({ particleCount = 46 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
      background: '#f8fafc',          // soft light gray base
    }}>
      {/* Primary indigo blob — top left (soft) */}
      <div className="blob-1" style={{
        position: 'absolute', top: '-5%', left: '-8%',
        width: 700, height: 700,
        background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%)',
        borderRadius: '50%', filter: 'blur(70px)',
      }} />
      {/* Cyan blob — top right (soft) */}
      <div className="blob-2" style={{
        position: 'absolute', top: '10%', right: '-5%',
        width: 550, height: 550,
        background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 65%)',
        borderRadius: '50%', filter: 'blur(60px)',
      }} />
      {/* Violet blob — center (soft) */}
      <div className="blob-3" style={{
        position: 'absolute', top: '45%', left: '40%',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 65%)',
        borderRadius: '50%', filter: 'blur(55px)',
        transform: 'translate(-50%,-50%)',
      }} />
      {/* Warm indigo blob — bottom (soft) */}
      <div className="blob-4" style={{
        position: 'absolute', bottom: '-10%', left: '20%',
        width: 600, height: 500,
        background: 'radial-gradient(circle, rgba(79,70,229,0.05) 0%, transparent 65%)',
        borderRadius: '50%', filter: 'blur(65px)',
      }} />
      {/* Subtle grid (very light gray) */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '56px 56px',
      }} />
      {/* Ambient particles (adjusted for light) */}
      <ParticleField count={particleCount} />
      {/* Edge vignette (fade to lighter edge) */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 120% 120% at 50% 50%, transparent 45%, rgba(248,250,252,0.6) 100%)',
      }} />
    </div>
  )
}

/* ── Shell for standalone/public pages (no sidebar/topbar) ────────────────── */
export function PublicPageShell({ children, particleCount = 46 }) {
  return (
    <>
      <AmbientBackground particleCount={particleCount} />
      <div style={{ position: 'relative', zIndex: 5 }}>
        {children}
      </div>
    </>
  )
}
