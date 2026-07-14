// =============================================================================
// Shared UI primitives — v2 with full animation system (Light Theme)
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
        <h1 style={{ color: '#111827', fontSize: 22, fontWeight: 700, fontFamily: 'Sora, sans-serif', letterSpacing: '-0.2px', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 3 }}>{subtitle}</p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

// ── Status badges ────────────────────────────────────────────────────────────
const BADGE_MAP = {
  VERIFIED:       { bg: '#ecfdf5',   border: '#a7f3d0', text: '#065f46', dot: '#10b981' },
  PENDING_REVIEW: { bg: '#fffbeb',   border: '#fde68a', text: '#92400e', dot: '#f59e0b' },
  active:         { bg: '#ecfdf5',   border: '#a7f3d0', text: '#065f46', dot: '#10b981' },
  inactive:       { bg: '#f9fafb',   border: '#e5e7eb', text: '#6b7280', dot: '#9ca3af' },
  Physical:       { bg: '#f0f9ff',   border: '#bae6fd', text: '#075985', dot: '#0ea5e9' },
  Digital:        { bg: '#f5f3ff',   border: '#ddd6fe', text: '#5b21b6', dot: '#8b5cf6' },
  Both:           { bg: '#eef2ff',   border: '#c7d2fe', text: '#3730a3', dot: '#6366f1' },
}

export function StatusBadge({ value }) {
  const s = BADGE_MAP[value] ?? { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', dot: '#9ca3af' }
  return (
    <span className="scale-in" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 6,
      background: s.bg, border: `1px solid ${s.border}`,
      color: s.text, fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {value}
    </span>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({ icon = '🔍', title = 'No results', subtitle }) {
  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
      <div className="float" style={{ fontSize: 40, marginBottom: 14, lineHeight: 1 }}>{icon}</div>
      <p style={{ color: '#111827', fontWeight: 500, fontSize: 15, marginBottom: 6 }}>{title}</p>
      {subtitle && <p style={{ color: '#6b7280', fontSize: 13, maxWidth: 280 }}>{subtitle}</p>}
    </div>
  )
}

// ── Pagination ───────────────────────────────────────────────────────────────
export function PaginationBar({ page, pages, total, pageSize, onPage }) {
  if (pages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '0 2px' }}>
      <p style={{ color: '#6b7280', fontSize: 12 }}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <PagBtn onClick={() => onPage(page - 1)} disabled={page <= 1}>←</PagBtn>
        {pageNumbers(page, pages).map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} style={{ padding: '0 4px', color: '#6b7280', fontSize: 12 }}>…</span>
            : <PagBtn key={p} onClick={() => onPage(p)} active={p === page}>{p}</PagBtn>
        )}
        <PagBtn onClick={() => onPage(page + 1)} disabled={page >= pages}>→</PagBtn>
      </div>
    </div>
  )
}

function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: 28, height: 28, borderRadius: 7, fontSize: 12, fontWeight: 500,
        background: active ? '#6366f1' : 'transparent',
        color: active ? '#fff' : disabled ? '#d1d5db' : '#6b7280',
        border: active ? 'none' : '1px solid transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 150ms ease, color 150ms ease, transform 150ms ease',
        transform: active ? 'scale(1.05)' : 'scale(1)',
        boxShadow: active ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
      }}
      onMouseEnter={e => { if (!active && !disabled) { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = '#111827' } }}
      onMouseLeave={e => { if (!active && !disabled) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280' } }}
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
      <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}
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
            color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, lineHeight: 1, padding: 2,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#111827' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af' }}
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
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'flex-start',   // Show at top
          justifyContent: 'center',
          paddingTop: 40,
          paddingLeft: 16,
          paddingRight: 16,
        }}>
      <div className="modal-backdrop"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
        onClick={onCancel} />
      <div className="modal-pop card-raised" style={{
                                              position: 'relative',
                                              padding: 24,
                                              width: '100%',
                                              maxWidth: 420,
                                              background: '#ffffff',                 // light background
                                              border: '2px solid #e5e7eb',           // light border
                                              borderRadius: 12,
                                              boxShadow: '0 16px 40px rgba(0,0,0,0.08)',
                                              opacity: 1,
                                            }}>
        <h3 style={{ color: '#111827', fontWeight: 600, fontSize: 16, fontFamily: 'Sora, sans-serif', marginBottom: 8 }}>{title}</h3>
        <p style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 9, fontSize: 13, color: '#6b7280',
              background: 'transparent', border: 'none', cursor: 'pointer',
              transition: 'color 150ms ease, background 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#111827'; e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent' }}
          >Cancel</button>
          <button onClick={onConfirm}
            style={{
              padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: danger ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              color: danger ? '#dc2626' : '#059669',
              border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              transition: 'background 150ms ease',
            }}
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
    <div className="stagger-in" style={{
      background: '#fef3c7', border: '1px solid #fde68a',
      borderRadius: 10, padding: '12px 14px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <p style={{ color: '#92400e', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            ⚠️ Possible duplicate{matches.length > 1 ? 's' : ''} detected
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {matches.map(m => (
              <li key={m.id} style={{ color: '#b45309', fontSize: 12, marginBottom: 2 }}>
                #{m.id} · {m.name}{m.detail ? ` — ${m.detail}` : ''}{' '}
                <span style={{ color: '#d97706' }}>({Math.round(m.similarity * 100)}% match)</span>
              </li>
            ))}
          </ul>
          <p style={{ color: '#92400e', fontSize: 11, marginTop: 6 }}>You can still save — this is a warning, not a block.</p>
        </div>
        <button onClick={onDismiss} style={{ color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
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
// Fully custom light dropdown
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
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selected ? 'text-gray-900 truncate' : 'text-[var(--faint)] truncate'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-gray-400 flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-[var(--card2)] border border-black/12 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
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
                  ${isSelected ? 'text-gray-900 bg-black/5' : 'text-gray-700 hover:bg-black/5 hover:text-gray-900'}`}
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
