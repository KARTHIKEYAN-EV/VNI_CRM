import { useMemo } from 'react'

/* ── Ambient particle field ─────────────────────────────────────────────── */
const PARTICLE_COLORS = [
  { color: 'rgba(99,102,241,0.75)',  glow: '8px' },   // indigo
  { color: 'rgba(6,182,212,0.6)',    glow: '7px' },   // cyan
  { color: 'rgba(167,139,250,0.65)', glow: '8px' },   // violet
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
        maxOpacity: (Math.random() * 0.5 + 0.35).toFixed(2),
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

/* ── Global ambient background (blobs + grid + vignette + particles) ─────── */
export default function AmbientBackground({ particleCount = 46 }) {
  return (
    <div
      className="ambient-background"
      style={{ background: 'var(--bg)' }}
    >
      {/* Blobs – all visual definitions now in index.css via custom properties */}
      <div
        className="ambient-blob blob-1"
        style={{ top: '-5%', left: '-8%', width: 700, height: 700 }}
      />
      <div
        className="ambient-blob blob-2"
        style={{ top: '10%', right: '-5%', width: 550, height: 550 }}
      />
      <div
        className="ambient-blob blob-3"
        style={{ top: '45%', left: '40%', width: 500, height: 500, transform: 'translate(-50%,-50%)' }}
      />
      <div
        className="ambient-blob blob-4"
        style={{ bottom: '-10%', left: '20%', width: 600, height: 500 }}
      />

      {/* Subtle grid */}
      <div className="ambient-grid" />

      {/* Ambient particles */}
      <ParticleField count={particleCount} />

      {/* Edge vignette */}
      <div className="ambient-vignette" />
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
