import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const ToastCtx = createContext(null)

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#34d399" strokeWidth="1.5"/>
      <path d="M5 8l2 2 4-4" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#38bdf8" strokeWidth="1.5"/>
      <path d="M8 7v4M8 5.5v.5" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  warn: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L14 13H2L8 2z" stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 7v3M8 11.5v.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
}

const TEXT_COLORS = {
  success: '#6ee7b7', error: '#fca5a5', info: '#7dd3fc', warn: '#fde68a',
}

function ToastItem({ id, type = 'info', message, duration = 3500, onRemove }) {
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onRemove(id), 280)
  }, [id, onRemove])

  useEffect(() => {
    const t = setTimeout(dismiss, duration)
    return () => clearTimeout(t)
  }, [dismiss, duration])

  return (
    <div
      className={`toast toast-${type === 'warning' ? 'warn' : type} ${exiting ? 'toast-exit' : 'toast-enter'}`}
      style={{ '--duration': `${duration}ms` }}
      onClick={dismiss}
    >
      <span className="flex-shrink-0 mt-0.5">{ICONS[type === 'warning' ? 'warn' : type]}</span>
      <p style={{ color: TEXT_COLORS[type === 'warning' ? 'warn' : type], fontSize: '13px', lineHeight: '1.4', flex: 1 }}>
        {message}
      </p>
      <button
        onClick={e => { e.stopPropagation(); dismiss() }}
        style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', flexShrink: 0, lineHeight: 1 }}
      >✕</button>
      <div className="toast-progress" />
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = nextId.current++
    setToasts(t => [...t, { id, message, type, duration }])
  }, [])

  const remove = useCallback(id => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {createPortal(
        <div id="toast-root">
          {toasts.map(t => (
            <ToastItem key={t.id} {...t} onRemove={remove} />
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return {
    success: (msg, d) => ctx(msg, 'success', d),
    error:   (msg, d) => ctx(msg, 'error',   d),
    info:    (msg, d) => ctx(msg, 'info',    d),
    warn:    (msg, d) => ctx(msg, 'warning', d),
  }
}
