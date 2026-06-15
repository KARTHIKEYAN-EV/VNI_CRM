import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AmbientBackground from './AmbientBackground'
import vniLogo from "../assets/vni-logo.png";

/* ── Role metadata ─────────────────────────────────────────────────────────── */
const ROLE_META = {
  rep:         { label: 'Sales Rep',        color: '#06b6d4' },
  manager:     { label: 'Regional Manager', color: '#a78bfa' },
  ceo:         { label: 'CEO',              color: '#fbbf24' },
  back_office: { label: 'Back Office',      color: '#34d399' },
  admin:       { label: 'System Admin',     color: '#6366f1' },
}

const I = ({ d, s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}>
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
)

const NAV = [
  { id: 'dashboard',   label: 'Dashboard',     icon: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z','M9 22V12h6v10'],            path: '/dashboard' },
  { id: 'requests',    label: 'Comp Requests',  icon: ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2','M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'], path: '/requests',   roles: ['rep','manager','ceo','admin','back_office'] },
  { id: 'workflow',    label: 'Workflow',       icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8',                                             path: '/workflow',   roles: ['ceo','admin','back_office','rep','manager'] },
  { id: 'followups',   label: 'Follow-ups',     icon: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z','M22 6l-10 7L2 6'], path: '/follow-ups', roles: ['rep','manager','ceo','admin'] },
  { id: 'reports',     label: 'Reports',        icon: ['M18 20V10','M12 20V4','M6 20v-6'],                                          path: '/reports',    roles: ['manager','ceo','admin','back_office'] },
  { divider: 'Data' },
  { id: 'colleges',    label: 'Colleges',       icon: ['M3 21h18','M9 21V5l9-3v19','M3 8l6-2'],                                     path: '/colleges',   roles: ['admin','manager','rep','ceo'] },
  { id: 'departments', label: 'Departments',    icon: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',    path: '/departments',roles: ['admin','manager','rep','ceo'] },
  { id: 'faculty',     label: 'Faculty',        icon: ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2','M12 11a4 4 0 100-8 4 4 0 000 8'], path: '/faculty',   roles: ['admin','manager','rep','ceo'] },
  { id: 'books',       label: 'Books',          icon: ['M4 19.5A2.5 2.5 0 016.5 17H20','M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z'], path: '/books', roles: ['admin','manager','rep','ceo','back_office'] },
  { divider: 'Academic' },
  { id: 'courses',     label: 'Courses',        icon: ['M22 10v6M2 10l10-5 10 5-10 5z','M6 12v5c3 3 9 3 12 0v-5'],                  path: '/courses',    roles: ['admin','manager','rep','ceo'] },
  { id: 'subjects',    label: 'Subjects',       icon: ['M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z','M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z'], path: '/subjects', roles: ['admin','manager','rep','ceo'] },
  { id: 'syllabi',     label: 'Syllabi',        icon: ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z','M14 2v6h6','M16 13H8','M16 17H8','M10 9H8'], path: '/syllabi', roles: ['admin','manager','rep','ceo'] },
  { divider: 'Admin' },
  { id: 'regions',     label: 'Regions',        icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', path: '/regions', roles: ['admin'] },
  { id: 'users',       label: 'Users',          icon: ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2','M9 11a4 4 0 100-8 4 4 0 000 8','M23 21v-2a4 4 0 00-3-3.87','M16 3.13a4 4 0 010 7.75'], path: '/users', roles: ['admin'] },
  { id: 'master',      label: 'Master Data',    icon: ['M4 6h16M4 10h16M4 14h16M4 18h7'],                                           path: '/master-data',roles: ['admin'] },
  { id: 'authors',     label: 'Authors',        icon: ['M12 20h9','M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z'],        path: '/authors',    roles: ['admin'] },
]

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
function Sidebar({ visible, onClose, isMobile }) {
  const { user, logout, hasRole } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const rm        = ROLE_META[user?.role] ?? { label: user?.role, color: '#94a3b8' }
  const initials  = (user?.fullName ?? '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  const nav = NAV.filter(n => !n.roles || n.roles.some(r => hasRole(r)))

  function go(path) { navigate(path); if (isMobile) onClose() }
  function signOut() { logout(); navigate('/login') }

  const sidebarStyle = {
    position: isMobile ? 'fixed' : 'sticky',
    top: 0, left: 0, height: '100vh',
    width: 256, zIndex: isMobile ? 50 : 20,
    background: 'rgba(7,10,22,0.85)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column',
    transform: (isMobile && !visible) ? 'translateX(-100%)' : 'translateX(0)',
    transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1)',
    boxShadow: isMobile ? '4px 0 60px rgba(0,0,0,0.7)' : '1px 0 0 rgba(255,255,255,0.04)',
    flexShrink: 0,
  }

  return (
    <>
      {isMobile && visible && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0, zIndex: 49,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease-out both',
        }} />
      )}
      <aside style={sidebarStyle}>
        {/* Logo */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div className="pulse-glow" style={{
              width: 36, height: 36, borderRadius: 11,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(99,102,241,0.45)',
              flexShrink: 0,
            }}>
              {/* <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'Space Grotesk,sans-serif', letterSpacing: '-0.5px' }}>VNI</span> */}
              <img
                src={vniLogo}
                alt="VNI"
                style={{
                  width: "32px",
                  height: "32px",
                  objectFit: "contain",
                }}
              />
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'Space Grotesk,sans-serif', letterSpacing: '-0.3px', lineHeight: 1.2 }}>VNI CRM</p>
              <p style={{ color: '#334155', fontSize: 10, marginTop: 2 }}>Field Operations v1</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {nav.map((item, idx) => {
            if (item.divider) return (
              <div key={`d${idx}`} style={{ padding: '12px 8px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
                <span style={{ color: '#1e3a5f', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{item.divider}</span>
                <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
              </div>
            )
            const active = location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
            return (
              <button key={item.id} onClick={() => go(item.path)}
                style={{
                  position: 'relative', width: '100%',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 11px', marginBottom: 1, borderRadius: 10,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: active ? 'linear-gradient(90deg,rgba(99,102,241,0.18) 0%,rgba(99,102,241,0.05) 100%)' : 'transparent',
                  color: active ? '#c7d2fe' : '#4b5563',
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 160ms ease',
                  outline: 'none',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='#94a3b8' }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#4b5563' }}}
              >
                <span style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, borderRadius: 99,
                  background: 'linear-gradient(180deg,#818cf8,#6366f1)',
                  height: active ? '55%' : '0%', opacity: active ? 1 : 0,
                  transition: 'height 220ms cubic-bezier(0.34,1.56,0.64,1), opacity 180ms',
                  boxShadow: active ? '2px 0 8px rgba(99,102,241,0.6)' : 'none',
                }} />
                <span style={{ color: active ? '#818cf8' : 'inherit', transition: 'color 160ms', display: 'flex' }}>
                  <I d={item.icon} s={14} />
                </span>
                <span style={{ letterSpacing: '0.01em' }}>{item.label}</span>
                {active && (
                  <span style={{
                    marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%',
                    background: '#818cf8', boxShadow: '0 0 8px rgba(129,140,248,0.8)', flexShrink: 0,
                  }} />
                )}
              </button>
            )
          })}
        </nav>

        {/* User footer */}
        <div style={{ padding: '10px 8px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 11px', borderRadius: 11, marginBottom: 4,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: rm.color + '1a', border: `1.5px solid ${rm.color}45`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: rm.color, fontSize: 11, fontWeight: 700, fontFamily: 'Space Grotesk,sans-serif' }}>{initials}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.fullName}</p>
              <p style={{ color: rm.color, fontSize: 10, marginTop: 1, opacity: 0.8 }}>{rm.label}</p>
            </div>
          </div>
          <button onClick={signOut} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 11px', borderRadius: 9, border: 'none',
            background: 'transparent', color: '#334155',
            fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
            transition: 'all 160ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='#f87171'; e.currentTarget.style.background='rgba(248,113,113,0.07)' }}
          onMouseLeave={e => { e.currentTarget.style.color='#334155'; e.currentTarget.style.background='transparent' }}
          >
            <I d={['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4','M16 17l5-5-5-5','M21 12H9']} s={14} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}

/* ── Topbar ──────────────────────────────────────────────────────────────── */
function Topbar({ onMenuClick }) {
  const { user } = useAuth()
  const location  = useLocation()
  const bellRef   = useRef(null)
  const rm        = ROLE_META[user?.role] ?? { color: '#94a3b8' }
  const initials  = (user?.fullName ?? '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  const crumbs = location.pathname.split('/').filter(Boolean).map(s =>
    s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
  )

  return (
    <header style={{
      height: 54, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 16,
      background: 'rgba(5,8,15,0.75)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <button onClick={onMenuClick} className="md:hidden" style={{
        width: 34, height: 34, borderRadius: 9,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
        color: '#64748b', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', transition: 'all 150ms',
      }}
      onMouseEnter={e=>{e.currentTarget.style.color='#e2e8f0';e.currentTarget.style.background='rgba(255,255,255,0.08)'}}
      onMouseLeave={e=>{e.currentTarget.style.color='#64748b';e.currentTarget.style.background='rgba(255,255,255,0.04)'}}>
        <I d="M4 6h16M4 12h16M4 18h16" s={16} />
      </button>

      <div className="hidden md:flex" style={{ alignItems: 'center', gap: 6, flex: 1 }}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: '#1e3a5f', fontSize: 12 }}>›</span>}
            <span style={{ color: i===crumbs.length-1 ? '#e2e8f0' : '#334155', fontSize: 13, fontWeight: i===crumbs.length-1 ? 500 : 400 }}>{c}</span>
          </span>
        ))}
      </div>

      {/* <div className="md:hidden" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk,sans-serif' }}>VNI CRM</span>
      </div> */}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <button ref={bellRef}
          onClick={() => { bellRef.current?.classList.remove('bell-ring'); void bellRef.current?.offsetWidth; bellRef.current?.classList.add('bell-ring') }}
          style={{
            width: 34, height: 34, borderRadius: 9, border: 'none',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            color: '#64748b', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', position: 'relative',
            transition: 'all 150ms',
          }}
          onMouseEnter={e=>{e.currentTarget.style.color='#e2e8f0';e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='#64748b';e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}}>
          <I d={['M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9','M13.73 21a2 2 0 01-3.46 0']} s={15} />
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '5px 12px 5px 5px', borderRadius: 11,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          cursor: 'default',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: rm.color + '1a', border: `1.5px solid ${rm.color}45`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: rm.color, fontSize: 10, fontWeight: 700, fontFamily: 'Space Grotesk,sans-serif' }}>{initials}</span>
          </div>
          <div className="hidden sm:block">
            <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>{user?.fullName?.split(' ')[0]}</p>
            <p style={{ color: '#334155', fontSize: 10, lineHeight: 1.2 }}>{ROLE_META[user?.role]?.label}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

/* ── Layout shell ────────────────────────────────────────────────────────── */
export default function Layout({ children }) {
  const location  = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative' }}>
      {/* Global moving background */}
      <AmbientBackground />

      {/* Desktop sidebar */}
      <div className="hidden md:block" style={{ position: 'sticky', top: 0, height: '100vh', flexShrink: 0, zIndex: 10 }}>
        <Sidebar visible={true} onClose={() => {}} isMobile={false} />
      </div>

      {/* Mobile sidebar */}
      <div className="md:hidden">
        <Sidebar visible={mobileOpen} onClose={() => setMobileOpen(false)} isMobile={true} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 5 }}>
        <Topbar onMenuClick={() => setMobileOpen(o => !o)} />
        <main key={location.pathname} className="page-enter" style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
