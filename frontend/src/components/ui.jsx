// =============================================================================
// Shared UI primitives — v2 with full animation system + light/dark theme
// =============================================================================
import { useEffect, useRef, useState } from 'react'

// ── Stagger wrapper ──────────────────────────────────────────────────────────
export function Stagger({ children, delayStep = 45, className = '' }) {
  const items = Array.isArray(children) ? children : [children]
  return (
    <>
      {items.map((child, i) => (
        <div key={child?.key ?? i} className={`stagger-in ${className}`}
          style={{ animationDelay: `${i * delayStep}ms` }}>
          {child}
        </div>
      ))}
    </>
  )
}

// ── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="stagger-in" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
      <div>
        <h1 style={{
          color: 'var(--text)', fontSize: 22, fontWeight: 700,
          fontFamily: 'Sora, sans-serif', letterSpacing: '-0.2px', lineHeight: 1.2
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>{subtitle}</p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

// ── Status badges ────────────────────────────────────────────────────────────
const BADGE_MAP = {
  VERIFIED:       { bgVar: '--badge-verified-bg',       borderVar: '--badge-verified-border',       textVar: '--badge-verified-text',       dotVar: '--badge-verified-dot' },
  PENDING_REVIEW: { bgVar: '--badge-pending-bg',         borderVar: '--badge-pending-border',         textVar: '--badge-pending-text',         dotVar: '--badge-pending-dot' },
  active:         { bgVar: '--badge-active-bg',          borderVar: '--badge-active-border',          textVar: '--badge-active-text',          dotVar: '--badge-active-dot' },
  inactive:       { bgVar: '--badge-inactive-bg',        borderVar: '--badge-inactive-border',        textVar: '--badge-inactive-text',        dotVar: '--badge-inactive-dot' },
  Physical:       { bgVar: '--badge-physical-bg',        borderVar: '--badge-physical-border',        textVar: '--badge-physical-text',        dotVar: '--badge-physical-dot' },
  Digital:        { bgVar: '--badge-digital-bg',         borderVar: '--badge-digital-border',         textVar: '--badge-digital-text',         dotVar: '--badge-digital-dot' },
  Both:           { bgVar: '--badge-both-bg',            borderVar: '--badge-both-border',            textVar: '--badge-both-text',            dotVar: '--badge-both-dot' },
  // inside BADGE_MAP of ui.jsx
DRAFT:             { bgVar: '--status-draft-bg',             borderVar: '--status-draft-border',             textVar: '--status-draft-text',             dotVar: '--status-draft-dot' },
SUBMITTED:         { bgVar: '--status-submitted-bg',         borderVar: '--status-submitted-border',         textVar: '--status-submitted-text',         dotVar: '--status-submitted-dot' },
APPROVED:          { bgVar: '--status-approved-bg',          borderVar: '--status-approved-border',          textVar: '--status-approved-text',          dotVar: '--status-approved-dot' },
REJECTED:          { bgVar: '--status-rejected-bg',          borderVar: '--status-rejected-border',          textVar: '--status-rejected-text',          dotVar: '--status-rejected-dot' },
DISPATCHED:        { bgVar: '--status-dispatched-bg',        borderVar: '--status-dispatched-border',        textVar: '--status-dispatched-text',        dotVar: '--status-dispatched-dot' },
DELIVERED:         { bgVar: '--status-delivered-bg',         borderVar: '--status-delivered-border',         textVar: '--status-delivered-text',         dotVar: '--status-delivered-dot' },
ADOPTED:           { bgVar: '--status-adopted-bg',           borderVar: '--status-adopted-border',           textVar: '--status-adopted-text',           dotVar: '--status-adopted-dot' },
NOT_ADOPTED:       { bgVar: '--status-not-adopted-bg',       borderVar: '--status-not-adopted-border',       textVar: '--status-not-adopted-text',       dotVar: '--status-not-adopted-dot' },
PENDING_FOLLOW_UP: { bgVar: '--status-pending-follow-bg',    borderVar: '--status-pending-follow-border',    textVar: '--status-pending-follow-text',    dotVar: '--status-pending-follow-dot' },
CANCELLED:         { bgVar: '--status-cancelled-bg',         borderVar: '--status-cancelled-border',         textVar: '--status-cancelled-text',         dotVar: '--status-cancelled-dot' },
}

export function StatusBadge({ value }) {
  const s = BADGE_MAP[value] ?? BADGE_MAP.inactive
  return (
    <span className="scale-in" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 6,
      background: `var(${s.bgVar})`,
      border: `1px solid var(${s.borderVar})`,
      color: `var(${s.textVar})`,
      fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: `var(${s.dotVar})`, flexShrink: 0 }} />
      {value}
    </span>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({ icon = '🔍', title = 'No results', subtitle }) {
  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
      <div className="float" style={{ fontSize: 40, marginBottom: 14, lineHeight: 1 }}>{icon}</div>
      <p style={{ color: 'var(--text)', fontWeight: 500, fontSize: 15, marginBottom: 6 }}>{title}</p>
      {subtitle && <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 280 }}>{subtitle}</p>}
    </div>
  )
}

// ── Pagination ───────────────────────────────────────────────────────────────
export function PaginationBar({ page, pages, total, pageSize, onPage }) {
  if (pages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '0 2px' }}>
      <p style={{ color: 'var(--muted)', fontSize: 12 }}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <PagBtn onClick={() => onPage(page - 1)} disabled={page <= 1}>←</PagBtn>
        {pageNumbers(page, pages).map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--muted)', fontSize: 12 }}>…</span>
            : <PagBtn key={p} onClick={() => onPage(p)} active={p === page}>{p}</PagBtn>
        )}
        <PagBtn onClick={() => onPage(page + 1)} disabled={page >= pages}>→</PagBtn>
      </div>
    </div>
  )
}

function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28, borderRadius: 7, fontSize: 12, fontWeight: 500,
        background: active ? '#D01D22' : 'transparent',
        color: active ? '#fff' : disabled ? 'var(--faint)' : 'var(--muted)',
        border: active ? 'none' : '1px solid transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 150ms ease, color 150ms ease, transform 150ms ease',
        transform: active ? 'scale(1.05)' : 'scale(1)',
        boxShadow: active ? '0 2px 8px rgba(208,29,34,0.3)' : 'none',
      }}
      onMouseEnter={e => { if (!active && !disabled) { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text)'; } }}
      onMouseLeave={e => { if (!active && !disabled) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; } }}
    >
      {children}
    </button>
  )
}

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

// ── Search input ─────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div style={{ position: 'relative' }} className={className}>
      <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="input"
        style={{ paddingLeft: 32, paddingRight: value ? 32 : 16 }}
      />
      {value && (
        <button onClick={() => onChange('')}
          className="scale-in"
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, lineHeight: 1, padding: 2,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
        >✕</button>
      )}
    </div>
  )
}

// ── Confirm dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = true }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 40, paddingLeft: 16, paddingRight: 16,
    }}>
      <div className="modal-backdrop"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
        onClick={onCancel} />
      <div
        className="modal-pop card-raised bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10"
        style={{
          position: 'relative', padding: 24, width: '100%', maxWidth: 420,
          borderRadius: 12,
          boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
          opacity: 1,
        }}
      >
        <h3 style={{ color: 'var(--text)', fontWeight: 600, fontSize: 16, fontFamily: 'Sora, sans-serif', marginBottom: 8 }}>{title}</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            className="text-muted hover:text-text hover:bg-hover-bg rounded-lg px-4 py-2 text-sm transition-colors"
          >Cancel</button>
          <button onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              danger
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300'
                : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300'
            }`}
          >Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ── Duplicate warning ─────────────────────────────────────────────────────────
export function DuplicateWarning({ matches, onDismiss }) {
  if (!matches?.length) return null
  return (
    <div className="stagger-in bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4 mb-4">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <p className="text-amber-800 dark:text-amber-200 text-sm font-semibold mb-1">
            ⚠️ Possible duplicate{matches.length > 1 ? 's' : ''} detected
          </p>
          <ul className="m-0 p-0 list-none">
            {matches.map(m => (
              <li key={m.id} className="text-amber-700 dark:text-amber-300 text-xs mb-1">
                #{m.id} · {m.name}{m.detail ? ` — ${m.detail}` : ''}{' '}
                <span className="text-amber-600 dark:text-amber-400">({Math.round(m.similarity * 100)}% match)</span>
              </li>
            ))}
          </ul>
          <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">You can still save — this is a warning, not a block.</p>
        </div>
        <button onClick={onDismiss} className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-100">✕</button>
      </div>
    </div>
  )
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return (
    <svg className="spin-slow" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  )
}

// ── CustomSelect ─────────────────────────────────────────────────────────────
export function CustomSelect({
  value, onChange, options, placeholder = 'Select…', disabled = false,
  getLabel = o => o.label, getValue = o => o.value,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const selected = options.find(o => String(getValue(o)) === String(value))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`input text-sm flex items-center justify-between gap-2 text-left
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} text-gray-900 dark:text-white`}
      >
        <span className={selected ? 'truncate' : 'text-muted truncate'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/12 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {options.length === 0 && (
            <p className="text-gray-500 text-sm px-4 py-3">No options</p>
          )}
          {options.map(o => {
            const isSelected = String(getValue(o)) === String(value)
            return (
              <button
                key={getValue(o)}
                type="button"
                onClick={() => { onChange(getValue(o)); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                  ${isSelected
                    ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-white/8'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/6'
                  }`}
              >
                {getLabel(o)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
