import { useEffect, useState } from 'react'
import { newRequestTokensApi } from '../api/comp_requests'

/**
 * Modal for a Rep to generate and share a blank "new request" form link.
 * Faculty receives the link, opens it (no login), searches books they want,
 * and submits a brand-new comp request.
 */
export default function SendNewRequestModal({ open, onClose, faculty }) {
  const [channel,    setChannel]    = useState('whatsapp')
  const [overrideNo, setOverrideNo] = useState('')
  const [token,      setToken]      = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState('')
  const [copied,     setCopied]     = useState(false)

  useEffect(() => {
    if (open) { setToken(null); setError(''); setCopied(false); setOverrideNo('') }
  }, [open, faculty?.facultyId])

  const formUrl = token
    ? `${window.location.origin}/new-request/${token.tokenHash}`
    : null

  async function handleGenerate() {
    if (!faculty?.facultyId) return
    setGenerating(true); setError('')
    try {
      const { data } = await newRequestTokensApi.create({
        facultyId:     faculty.facultyId,
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
      const el = document.createElement('textarea')
      el.value = formUrl; document.body.appendChild(el)
      el.select(); document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleWhatsAppShare() {
    if (!formUrl || !faculty) return
    const name = faculty.facultyName ?? 'Professor'
    const msg = [
      `Dear ${name},`,
      ``,
      `Vijay Nicole Imprints would like to send you complimentary copies of our titles.`,
      ``,
      `Please use the link below to browse our catalogue and select the books you'd like:`,
      formUrl,
      ``,
      `This link expires in 72 hours.`,
      ``,
      `– VNI Field Team`,
    ].join('\n')
    const phone = overrideNo.trim() ||
      faculty.phoneWhatsapp ||
      faculty.phonePersonal || ''
    const cleanPhone = phone.replace(/\D/g, '')
    window.open(
      `https://wa.me/${cleanPhone ? cleanPhone : ''}?text=${encodeURIComponent(msg)}`,
      '_blank', 'noopener'
    )
  }

  if (!open) return null

  const expiresAt = token?.expiresAt
    ? new Date(token.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-10 pb-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
          className="relative card p-6 w-full max-w-md shadow-2xl rounded-xl"
          style={{
            background: "#1f2937",
            border: "2px solid rgba(255,255,255,0.15)",
            backdropFilter: "none",
          }}
        >

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold font-display">Send New Request Form</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Faculty will choose their own books — no existing request needed
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none ml-3">✕</button>
        </div>

        {!token ? (
          <>
            {/* Channel selector */}
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

            {/* Phone override */}
            <div className="mb-5">
              <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1.5">
                Phone override{' '}
                <span className="normal-case text-gray-600 font-normal">(optional)</span>
              </label>
              <input className="input text-sm" value={overrideNo}
                onChange={e => setOverrideNo(e.target.value)}
                placeholder={faculty?.phoneWhatsapp ?? faculty?.phonePersonal ?? '9XXXXXXXXX'} />
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-3 py-2 mb-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Faculty summary */}
            <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-3 mb-5">
              <p className="text-white text-sm font-medium">{faculty?.facultyName}</p>
              <p className="text-gray-500 text-xs">{faculty?.college?.collegeName ?? faculty?.collegeName}</p>
              <p className="text-gray-600 text-[10px] mt-1">
                Faculty will browse the full catalogue and choose their own books
              </p>
            </div>

            <button onClick={handleGenerate} disabled={generating}
              className="btn-primary w-full py-2.5 text-sm">
              {generating ? 'Generating…' : '🔗 Generate Blank Form Link'}
            </button>
          </>
        ) : (
          <>
            {/* Success state */}
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-4 py-3 mb-4">
              <p className="text-emerald-400 text-xs font-semibold mb-0.5">Link generated ✓</p>
              <p className="text-gray-400 text-xs">Expires: {expiresAt}</p>
            </div>

            <div className="bg-white/4 border border-white/10 rounded-xl px-4 py-3 mb-4">
              <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Form URL</p>
              <p className="text-white text-xs font-mono break-all leading-relaxed">{formUrl}</p>
            </div>

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

            <p className="text-gray-600 text-xs text-center">
              Faculty can browse the full VNI catalogue and pick their own books. One-time link.
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
