import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../auth/AuthContext'
import { compRequestsApi } from '../api/comp_requests'

const PHASES = [
  { id:'A', label:'Foundation', done:true, items:'Schema · Auth · Scaffolding' },
  { id:'B', label:'Master Data', done:true, items:'Regions · Colleges · Faculty · Books' },
  { id:'C', label:'Academic Hierarchy', done:true, items:'Courses · Subjects · Syllabi' },
  { id:'D', label:'Comp Request (Rep Mode)', done:true, items:'Create · Draft · Submit' },
  { id:'E', label:'Approval & Fulfilment', done:true, items:'Approve · Dispatch · Deliver · Adopt' },
  { id:'F', label:'Faculty Form (Tokenised)', done:true, items:'Token · Public form · Expiry' },
  { id:'G', label:'Follow-up & Notif.', done:true, items:'Reminders · Email · Scheduler' },
  { id:'H', label:'MIS & Reports', done:true, items:'8 reports · CSV export' },
  { id:'I', label:'Admin & Data Quality', done:true, items:'Config UI · Review queue · Import' },
]

const CARDS = {
  submitted: {
    label:'Awaiting Approval',
    path:'/workflow',
    accent:'#818cf8',
    grad:'rgba(129,140,248,0.15),rgba(99,102,241,0.05)',
    icon:['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2','M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2']
  },
  approved: {
    label:'Ready to Dispatch',
    path:'/workflow',
    accent:'#34d399',
    grad:'rgba(52,211,153,0.12),rgba(16,185,129,0.04)',
    icon:['M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8']
  },
  dispatched: {
    label:'Pending Delivery',
    path:'/workflow',
    accent:'#06b6d4',
    grad:'rgba(6,182,212,0.12),rgba(6,182,212,0.04)',
    icon:'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0'
  },
  delivered: {
    label:'Adoption Follow-up',
    path:'/follow-ups',
    accent:'#fbbf24',
    grad:'rgba(251,191,36,0.12),rgba(245,158,11,0.04)',
    icon:'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
  },
  pendingFollowUp: {
    label:'Overdue Follow-up',
    path:'/follow-ups',
    accent:'#f87171',
    grad:'rgba(248,113,113,0.12),rgba(239,68,68,0.04)',
    icon:'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
  },
  myDraft: {
    label:'My Drafts',
    path:'/requests?status=DRAFT',
    accent:'#94a3b8',
    grad:'rgba(148,163,184,0.1),rgba(100,116,139,0.04)',
    icon:'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
  },
}

function useCountUp(target, ms = 800) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (!target) { setVal(0); return }
    const t0 = performance.now()
    const tick = now => {
      const p = Math.min((now - t0) / ms, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, ms])
  return val
}

function StatCard({ k, count, delay }) {
  const cfg = CARDS[k]
  const num = useCountUp(count)
  const nav = useNavigate()
  const [hov, setHov] = useState(false)
  if (!count) return null
  return (
    <button onClick={() => nav(cfg.path)}
      className="stagger-in"
      style={{
        animationDelay: `${delay}ms`,
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 16,
        padding: '20px 20px 18px', borderRadius: 18,
        border: '1px solid',
        borderColor: hov ? cfg.accent + '50' : 'var(--border)',
        background: hov
          ? `linear-gradient(145deg, ${cfg.grad})`
          : 'var(--card)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transform: hov ? 'translateY(-5px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hov
          ? `0 20px 50px ${cfg.accent}25, 0 0 0 1px ${cfg.accent}20`
          : '0 4px 20px rgba(0,0,0,0.08)',
        transition: 'all 250ms cubic-bezier(0.22,1,0.36,1)',
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      {/* Shimmer line on hover */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: hov
          ? `linear-gradient(90deg, transparent, ${cfg.accent}60, transparent)`
          : 'transparent',
        transition: 'background 300ms',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: cfg.accent + '18',
          border: `1px solid ${cfg.accent}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 250ms, box-shadow 250ms',
          transform: hov ? 'scale(1.12) rotate(-6deg)' : 'scale(1)',
          boxShadow: hov ? `0 8px 20px ${cfg.accent}30` : 'none',
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
            stroke={cfg.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {(Array.isArray(cfg.icon) ? cfg.icon : [cfg.icon]).map((d,i) => <path key={i} d={d} />)}
          </svg>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cfg.accent}
          strokeWidth="2" strokeLinecap="round" style={{ opacity: hov ? 0.7 : 0.3, transition: 'opacity 200ms', marginTop: 4 }}>
          <path d="M7 17L17 7M17 7H7M17 7v10"/>
        </svg>
      </div>
      <div>
        <p style={{
          color: cfg.accent, fontSize: 36, fontWeight: 800,
          fontFamily: 'Space Grotesk,sans-serif', lineHeight: 1, letterSpacing: '-2px',
          textShadow: hov ? `0 0 30px ${cfg.accent}60` : 'none',
          transition: 'text-shadow 300ms',
        }}>{num}</p>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5, fontWeight: 500, letterSpacing: '0.02em' }}>{cfg.label}</p>
      </div>
    </button>
  )
}

const SESSION_FIELDS = (user) => [
  { label: 'User ID', value: `#${user?.userId}`, icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: '#818cf8' },
  { label: 'Role', value: user?.role, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: '#34d399' },
  { label: 'Region', value: user?.regionId ? `Region #${user.regionId}` : 'All', icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', color: '#06b6d4' },
  { label: 'Status', value: user?.isActive ? '● Active' : '○ Inactive', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: user?.isActive ? '#34d399' : '#f87171' },
]

export default function Dashboard() {
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({})

  useEffect(() => {
    const set = (k,v) => setCounts(c=>({...c,[k]:v}))
    if (hasRole('ceo','admin'))
      compRequestsApi.list({status:'SUBMITTED',pageSize:1}).then(r=>set('submitted',r.data.total))
    if (hasRole('back_office','admin')) {
      compRequestsApi.list({status:'APPROVED', pageSize:1}).then(r=>set('approved', r.data.total))
      compRequestsApi.list({status:'DISPATCHED',pageSize:1}).then(r=>set('dispatched',r.data.total))
    }
    if (hasRole('rep','manager','ceo','admin')) {
      compRequestsApi.list({status:'DELIVERED', pageSize:1}).then(r=>set('delivered', r.data.total))
      compRequestsApi.list({status:'PENDING_FOLLOW_UP', pageSize:1}).then(r=>set('pendingFollowUp',r.data.total))
      compRequestsApi.list({status:'DRAFT', pageSize:1}).then(r=>set('myDraft', r.data.total))
    }
  }, [hasRole])

  const visibleCards = Object.keys(CARDS).filter(k => counts[k] > 0)
  const doneCount = PHASES.filter(p => p.done).length
  const pct = Math.round((doneCount / PHASES.length) * 100)

  const QUICK_ACTIONS = [
    { label:'All Requests', path:'/requests', show:true, icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2', color:'#818cf8' },
    { label:'Follow-up Queue', path:'/follow-ups', show:hasRole('rep','manager','ceo','admin'), icon:'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',color:'#06b6d4' },
    { label:'Workflow Queue', path:'/workflow', show:hasRole('ceo','admin','back_office'), icon:'M13 2L3 14h9l-1 8 10-12h-9l1-8', color:'#34d399' },
    { label:'Reports', path:'/reports', show:hasRole('manager','ceo','admin','back_office'),icon:'M18 20V10M12 20V4M6 20v-6', color:'#fbbf24' },
  ].filter(a => a.show)

  return (
    <Layout>
      <div style={{ padding: '28px 28px 40px', maxWidth: 900, background: 'var(--bg)', minHeight: '100vh' }}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="stagger-in d0" style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#6366f1',
                  boxShadow: '0 0 12px rgba(99,102,241,0.8)',
                  animation: 'pulseGlow 2.5s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Live Dashboard</span>
              </div>
              <h1 style={{
                color: 'var(--text)', fontSize: 30, fontWeight: 800,
                fontFamily: 'Space Grotesk,sans-serif', letterSpacing: '-0.8px', lineHeight: 1.15, marginBottom: 6,
              }}>
                Good to see you,{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #818cf8, #06b6d4)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {user?.fullName?.split(' ').slice(-1)[0] || 'there'}
                </span>
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Here's what's happening in the field today.</p>
            </div>
            {hasRole('rep','manager','ceo','admin') && (
              <button onClick={() => navigate('/requests/new')} className="btn-primary stagger-in d100"
                style={{ padding:'11px 22px', fontSize: 13, whiteSpace: 'nowrap' }}>
                + New Request
              </button>
            )}
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────── */}
        {visibleCards.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pending Actions</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{visibleCards.length} item{visibleCards.length > 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {visibleCards.map((k,i) => <StatCard key={k} k={k} count={counts[k]} delay={i * 70} />)}
            </div>
          </div>
        )}

        {/* ── Quick Actions ────────────────────────────────────────────── */}
        <div className="stagger-in d150" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Quick Actions</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 10 }}>
            {QUICK_ACTIONS.map(a => {
              const [hov, setHov] = useState(false)
              return (
                <button key={a.path} onClick={() => navigate(a.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 16px', borderRadius: 14, cursor: 'pointer',
                    background: hov ? `${a.color}12` : 'var(--card)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${hov ? a.color + '40' : 'var(--border)'}`,
                    color: hov ? a.color : 'var(--muted)',
                    fontSize: 13, fontWeight: 500, fontFamily: 'Inter,sans-serif',
                    transform: hov ? 'translateY(-3px)' : 'translateY(0)',
                    boxShadow: hov ? `0 10px 28px ${a.color}18` : '0 2px 10px rgba(0,0,0,0.05)',
                    transition: 'all 220ms cubic-bezier(0.22,1,0.36,1)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={() => setHov(true)}
                  onMouseLeave={() => setHov(false)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d={a.icon} />
                  </svg>
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Session Info ─────────────────────────────────────────────── */}
        <div className="stagger-in d200" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Session</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 10 }}>
            {SESSION_FIELDS(user).map(({ label, value, icon, color }, i) => {
              const [hov, setHov] = useState(false)
              return (
                <div key={label}
                  className="stagger-in"
                  style={{
                    animationDelay: `${260 + i * 50}ms`,
                    padding: '14px 16px', borderRadius: 14,
                    background: hov ? `${color}0d` : 'var(--card)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${hov ? color + '35' : 'var(--border)'}`,
                    transition: 'all 220ms cubic-bezier(0.22,1,0.36,1)',
                    transform: hov ? 'translateY(-2px)' : 'none',
                  }}
                  onMouseEnter={() => setHov(true)}
                  onMouseLeave={() => setHov(false)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={icon} />
                    </svg>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>{label}</span>
                  </div>
                  <p style={{
                    color: label === 'Status' ? (user?.isActive ? '#34d399' : '#f87171') : 'var(--text)',
                    fontSize: 13, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{value ?? '—'}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Build Progress (Admin only) ───────────────────────────────── */}
        {hasRole('admin') && (
          <div className="stagger-in d250" style={{
            padding: '24px 24px 20px',
            background: 'var(--card)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border)',
            borderRadius: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Build Progress</span>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{doneCount} of {PHASES.length} phases complete</p>
              </div>
              <div style={{
                padding: '5px 12px', borderRadius: 20,
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                fontSize: 13, fontWeight: 700, color: '#818cf8', fontFamily: 'Space Grotesk,sans-serif',
              }}>{pct}%</div>
            </div>
            <div style={{ height: 6, background: 'var(--border2)', borderRadius: 99, marginBottom: 20, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                boxShadow: '0 0 16px rgba(99,102,241,0.6)',
                transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                  animation: 'shimmer 2.5s ease-in-out infinite',
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {PHASES.map(({ id, label, done, next, items }, i) => {
                const [hov, setHov] = useState(false)
                const dotColor = done ? '#10b981' : next ? '#fbbf24' : '#334155'
                const accentColor = done ? '#10b981' : next ? '#fbbf24' : '#334155'
                const bg = hov
                  ? done ? 'rgba(5,46,37,0.45)' : next ? 'rgba(69,48,8,0.5)' : 'rgba(255,255,255,0.04)'
                  : done ? 'rgba(5,46,37,0.25)' : next ? 'rgba(69,48,8,0.3)' : 'rgba(255,255,255,0.02)'
                const border = done
                  ? `1px solid rgba(16,185,129,${hov ? 0.25 : 0.12})`
                  : next ? `1px solid rgba(245,158,11,${hov ? 0.25 : 0.12})`
                  : '1px solid rgba(255,255,255,0.04)'
                const textC = done ? '#6ee7b7' : next ? '#fde68a' : '#334155'
                return (
                  <div key={id}
                    className="stagger-in"
                    style={{
                      animationDelay: `${300 + i * 30}ms`,
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 11,
                      background: bg, border,
                      transition: 'all 180ms ease', cursor: 'default',
                      transform: hov ? 'translateX(5px)' : 'translateX(0)',
                    }}
                    onMouseEnter={() => setHov(true)}
                    onMouseLeave={() => setHov(false)}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: dotColor, flexShrink: 0,
                      boxShadow: next ? `0 0 10px ${dotColor}` : done ? `0 0 5px ${dotColor}6d` : 'none',
                      animation: next ? 'pulseGlow 2s ease-in-out infinite' : 'none',
                    }} />
                    <span style={{
                      fontFamily: 'JetBrains Mono,monospace', fontSize: 10,
                      color: accentColor, width: 14, flexShrink: 0, opacity: 0.8,
                    }}>{id}</span>
                    <span style={{ color: textC, fontSize: 13, fontWeight: 500, flexShrink: 0, minWidth: 160 }}>{label}</span>
                    <span style={{
                      color: '#334155', fontSize: 11,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{items}</span>
                    {(done || next) && (
                      <span style={{
                        marginLeft: 'auto', flexShrink: 0,
                        padding: '2px 9px', borderRadius: 20,
                        fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                        background: done ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: done ? '#34d399' : '#fbbf24',
                        border: done ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(245,158,11,0.25)',
                      }}>
                        {done ? 'Done' : 'Next'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
