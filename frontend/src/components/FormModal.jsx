import { useEffect } from 'react'

/**
 * Right-side slide-in drawer for add/edit forms.
 *
 * Props:
 *   open    — boolean
 *   onClose — () => void
 *   title   — string
 *   subtitle? — string
 *   children  — form content
 *   footer?   — custom footer node (defaults to Save/Cancel)
 *   onSave?   — () => void  (used by default footer)
 *   saving?   — boolean     (disables Save button)
 *   width?    — Tailwind width class (default "max-w-md")
 */
export default function FormModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  onSave,
  saving = false,
  width  = 'max-w-md',
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full ${width} w-full bg-[#0d1525] border-l border-white/8
          shadow-2xl flex flex-col transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold font-display">{title}</h2>
            {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white hover:rotate-90 transition-all duration-200 text-lg leading-none mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/8">
          {footer ?? (
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/6 transition-all duration-200 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="btn-primary px-5 py-2 flex items-center gap-2"
              >
                {saving && (
                  <svg className="spin-slow" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="15" />
                  </svg>
                )}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Field — labelled form field wrapper
// ---------------------------------------------------------------------------
export function Field({ label, required, error, children }) {
  return (
    <div className={`mb-4 ${error ? 'shake' : ''}`}>
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-brand-red ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1 modal-pop">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Select — styled select element
// ---------------------------------------------------------------------------
export function Select({ value, onChange, children, ...props }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input appearance-none"
      {...props}
    >
      {children}
    </select>
  )
}
