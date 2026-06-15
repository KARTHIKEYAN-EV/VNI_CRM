import { useState, useEffect } from 'react'
import { tokensApi } from '../api/comp_requests'

/**
 * Modal for Rep to generate and share a faculty self-fill form link.
 * Phase 1: manual share (copy link / WhatsApp deep-link).
 * Phase 2+: system sends automatically.
 */
export default function SendFormModal({ open, onClose, request }) {
  const [channel,   setChannel]   = useState('whatsapp')
  const [overrideNo,setOverrideNo]= useState('')
  const [token,     setToken]     = useState(null)
  const [generating,setGenerating]= useState(false)
  const [error,     setError]     = useState('')
  const [copied,    setCopied]    = useState(false)

  // Reset when opened for a new request
  useEffect(() => {
    if (open) { setToken(null); setError(''); setCopied(false) }
  }, [open, request?.requestId])

  const formUrl = token
    ? `${window.location.origin}/form/${token.tokenHash}`
    : null

  async function handleGenerate() {
    setGenerating(true); setError('')
    try {
      const { data } = await tokensApi.sendForm(request.requestId, {
        sendChannel:   channel,
        sendToNumber:  overrideNo.trim() || undefined,
      })
      setToken(data)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to generate link')
    } finally { setGenerating(false) }
  }

  async function handleCopy() {
    if (!formUrl) return
    try {
      await navigator.clipboard.writeText(formUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that block clipboard API
      const el = document.createElement('textarea')
      el.value = formUrl; document.body.appendChild(el)
      el.select(); document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleWhatsAppShare() {
    if (!formUrl || !request) return
    const facultyName = request.faculty?.facultyName ?? 'Professor'
    const books = (request.lineItems ?? [])
      .map(li => `• ${li.bookTitle} (×${li.quantity})`)
      .join('\n')
    const msg = [
      `Dear ${facultyName},`,
      ``,
      `Vijay Nicole Imprints has prepared a complimentary copy request for you.`,
      ``,
      `Books requested:`,
      books,
      ``,
      `Please review and confirm your request using the link below:`,
      formUrl,
      ``,
      `This link expires in 72 hours.`,
      ``,
      `– VNI Field Team`,
    ].join('\n')
    const phone = overrideNo.trim() ||
      request.faculty?.phoneWhatsapp ||
      request.faculty?.phonePersonal || ''
    const cleanPhone = phone.replace(/\D/g, '')
    const waUrl = `https://wa.me/${cleanPhone ? cleanPhone : ''}?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank', 'noopener')
  }

  if (!open) return null

  const expiresAt = token?.expiresAt
    ? new Date(token.expiresAt).toLocaleString('en-IN', {
        dateStyle: 'medium', timeStyle: 'short',
      })
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold font-display">Send Form to Faculty</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Generate a self-fill link for {request?.faculty?.facultyName ?? 'faculty'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none ml-3">✕</button>
        </div>

        {!token ? (
          /* Generation form */
          <>
            <div className="mb-4">
              <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1.5">
                Channel
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'whatsapp', label: '💬 WhatsApp' },
                  { value: 'email',    label: '📧 Email'    },
                  { value: 'both',     label: 'Both'        },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setChannel(opt.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all
                      ${channel === opt.value
                        ? 'bg-brand-red/20 text-white border-brand-red/50'
                        : 'text-gray-400 border-white/10 hover:border-white/20 hover:text-white'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1.5">
                Phone number override{' '}
                <span className="normal-case text-gray-600 font-normal">
                  (optional — defaults to faculty's saved number)
                </span>
              </label>
              <input className="input text-sm" value={overrideNo}
                onChange={e => setOverrideNo(e.target.value)}
                placeholder={request?.faculty?.phoneWhatsapp ?? '9XXXXXXXXX'} />
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-3 py-2 mb-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Faculty info summary */}
            <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-3 mb-5">
              <p className="text-white text-sm font-medium">{request?.faculty?.facultyName}</p>
              <p className="text-gray-500 text-xs">{request?.college?.collegeName}</p>
              <p className="text-gray-600 text-xs mt-1">
                {(request?.lineItems ?? []).length} book{(request?.lineItems ?? []).length !== 1 ? 's' : ''} in request
              </p>
            </div>

            <button onClick={handleGenerate} disabled={generating}
              className="btn-primary w-full py-2.5 text-sm">
              {generating ? 'Generating…' : '🔗 Generate Form Link'}
            </button>
          </>
        ) : (
          /* Link generated */
          <>
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-4 py-3 mb-4">
              <p className="text-emerald-400 text-xs font-semibold mb-0.5">Link generated ✓</p>
              <p className="text-gray-400 text-xs">Expires: {expiresAt}</p>
            </div>

            {/* URL display */}
            <div className="bg-white/4 border border-white/10 rounded-xl px-4 py-3 mb-4">
              <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Form URL</p>
              <p className="text-white text-xs font-mono break-all leading-relaxed">{formUrl}</p>
            </div>

            {/* Actions */}
            <div className="space-y-2 mb-4">
              <button onClick={handleCopy}
                className={`w-full py-2.5 rounded-xl text-sm font-medium border transition-all
                  ${copied
                    ? 'bg-emerald-900/50 text-emerald-300 border-emerald-800/50'
                    : 'border-white/20 text-gray-300 hover:text-white hover:bg-white/6'}`}>
                {copied ? '✓ Copied to clipboard' : '📋 Copy Link'}
              </button>

              <button onClick={handleWhatsAppShare}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/30 transition-all">
                💬 Share via WhatsApp
              </button>
            </div>

            {/* Expiry + reminder */}
            <p className="text-gray-600 text-xs text-center">
              This is a one-time link. Faculty cannot re-submit after confirming.
            </p>

            <button onClick={() => setToken(null)}
              className="w-full mt-3 py-2 text-xs text-gray-600 hover:text-gray-400 transition-all">
              ← Generate a new link
            </button>
          </>
        )}
      </div>
    </div>
  )
}
