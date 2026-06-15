import { useState } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import vniLogo from "../assets/vni-logo.png";

// Floating particles for moving background
function Particles() {
  const items = [
    { x: '12%',  delay: '0s',   dur: '7s',  drift: '20px',  size: 2 },
    { x: '25%',  delay: '1.2s', dur: '9s',  drift: '-25px', size: 1.5 },
    { x: '38%',  delay: '0.4s', dur: '6s',  drift: '30px',  size: 2.5 },
    { x: '52%',  delay: '2.1s', dur: '8s',  drift: '-15px', size: 1 },
    { x: '65%',  delay: '0.8s', dur: '11s', drift: '22px',  size: 2 },
    { x: '78%',  delay: '1.6s', dur: '7.5s',drift: '-30px', size: 1.5 },
    { x: '88%',  delay: '3s',   dur: '9.5s',drift: '18px',  size: 2 },
    { x: '6%',   delay: '2.5s', dur: '10s', drift: '25px',  size: 1 },
    { x: '45%',  delay: '4s',   dur: '8.5s',drift: '-20px', size: 1.5 },
    { x: '70%',  delay: '1s',   dur: '12s', drift: '15px',  size: 2.5 },
    { x: '32%',  delay: '3.5s', dur: '6.5s',drift: '-28px', size: 1 },
    { x: '58%',  delay: '0.2s', dur: '13s', drift: '22px',  size: 1.5 },
  ]
  return (
    <>
      {items.map((p, i) => (
        <div key={i} className="particle" style={{
          position: 'absolute',
          bottom: `${10 + (i % 4) * 8}%`,
          left: p.x,
          width: p.size,
          height: p.size,
          borderRadius: '50%',
          background: i % 3 === 0
            ? 'rgba(99,102,241,0.7)'
            : i % 3 === 1
              ? 'rgba(6,182,212,0.5)'
              : 'rgba(167,139,250,0.6)',
          boxShadow: i % 3 === 0
            ? '0 0 6px rgba(99,102,241,0.8)'
            : i % 3 === 1
              ? '0 0 6px rgba(6,182,212,0.6)'
              : '0 0 6px rgba(167,139,250,0.7)',
          '--dur': p.dur,
          '--drift': p.drift,
          animationDelay: p.delay,
        }} />
      ))}
    </>
  )
}

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [shake,    setShake]    = useState(false)

  const { login, isAuthenticated } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || '/dashboard'

  if (isAuthenticated) return <Navigate to={from} replace />

  async function submit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password')
      setShake(false); requestAnimationFrame(() => setShake(true))
      setTimeout(() => setShake(false), 500)
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#05080f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* ── Moving background ───────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>

        {/* Indigo blob — top left */}
        <div className="blob-1" style={{
          position: 'absolute', top: '6%', left: '8%',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 65%)',
          borderRadius: '50%', filter: 'blur(55px)',
        }} />

        {/* Cyan blob — bottom right */}
        <div className="blob-2" style={{
          position: 'absolute', bottom: '4%', right: '6%',
          width: 650, height: 520,
          background: 'radial-gradient(circle, rgba(6,182,212,0.11) 0%, transparent 65%)',
          borderRadius: '50%', filter: 'blur(65px)',
        }} />

        {/* Violet blob — center */}
        <div className="blob-3" style={{
          position: 'absolute', top: '45%', left: '50%',
          width: 450, height: 450,
          background: 'radial-gradient(circle, rgba(167,139,250,0.09) 0%, transparent 65%)',
          borderRadius: '50%', filter: 'blur(50px)',
          transform: 'translate(-50%,-50%)',
        }} />

        {/* Extra indigo blob — bottom left */}
        <div className="blob-4" style={{
          position: 'absolute', bottom: '15%', left: '5%',
          width: 350, height: 350,
          background: 'radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 65%)',
          borderRadius: '50%', filter: 'blur(45px)',
        }} />

        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)
          `,
          backgroundSize: '52px 52px',
        }} />

        {/* Radial vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, transparent 38%, rgba(5,8,15,0.85) 100%)',
        }} />

        {/* Floating particles */}
        <Particles />
      </div>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>

        {/* Brand mark */}
        <div className="stagger-in d0" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="pulse-glow float" style={{
            display: 'inline-flex', width: 68, height: 68, borderRadius: 20,
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 22,
            boxShadow: '0 16px 48px rgba(99,102,241,0.45), 0 4px 16px rgba(99,102,241,0.3)',
          }}>
            {/* <span style={{ color: '#fff', fontWeight: 900, fontSize: 20, fontFamily: 'Space Grotesk,sans-serif', letterSpacing: '-1px' }}>VNI</span> */}
            <img
              src={vniLogo}
              alt="VNI Logo"
              style={{
                width: "60px",
                height: "60px",
                objectFit: "contain",
              }}
            />
          </div>
          <h1 style={{
            color: '#f1f5f9', fontSize: 30, fontWeight: 700,
            fontFamily: 'Space Grotesk,sans-serif', letterSpacing: '-0.5px',
            lineHeight: 1.2, marginBottom: 6,
          }}>Welcome back</h1>
          <p style={{ color: '#475569', fontSize: 14 }}>Sign in to VNI CRM</p>
        </div>

        {/* Card */}
        <div className="stagger-in d100" style={{
          background: 'rgba(13,17,32,0.88)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 22,
          padding: 34,
          backdropFilter: 'blur(24px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(99,102,241,0.06)',
        }}>
          <form onSubmit={submit}>
            <div className={shake ? 'shake' : ''}>
              {/* Email */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Email address
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="you@vni.in"
                  className="input" style={{ fontSize: 14 }} />
              </div>

              {/* Password */}
              <div style={{ marginBottom: error ? 18 : 26 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Password
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="••••••••"
                  className="input" style={{ fontSize: 14 }} />
              </div>

              {/* Error */}
              {error && (
                <div className="scale-in" style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(30,10,60,0.5)', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 10, padding: '11px 14px', marginBottom: 20,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="#a78bfa"/>
                  </svg>
                  <span style={{ color: '#c4b5fd', fontSize: 13 }}>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary"
                style={{ width: '100%', padding: '13px 20px', fontSize: 14, borderRadius: 12 }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg className="spin-slow" width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    Signing in…
                  </span>
                ) : 'Sign in →'}
              </button>
            </div>
          </form>
        </div>

        <p className="stagger-in d200" style={{ textAlign: 'center', fontSize: 11, color: '#1e293b', marginTop: 24 }}>
          Vijay Nicole Imprints · Internal system · 2026
        </p>
      </div>
    </div>
  )
}
