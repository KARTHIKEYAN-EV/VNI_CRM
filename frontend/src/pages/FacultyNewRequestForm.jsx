import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams }                                  from 'react-router-dom'
import { newRequestTokensApi }                        from '../api/comp_requests'
import AmbientBackground                              from '../components/AmbientBackground'

// ---------------------------------------------------------------------------
// Standalone public page — no Layout, no auth required
// ---------------------------------------------------------------------------

const today = () => new Date().toISOString().split('T')[0]
const uid   = () => Math.random().toString(36).slice(2, 8)

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function VNILogo() {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="pulse-glow w-10 h-10 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
          boxShadow: '0 6px 20px var(--primary-glow)',
        }}>
        <span className="text-white font-bold text-sm font-display">VNI</span>
      </div>
      <div>
        <p className="text-white font-semibold text-sm font-display leading-tight">
          Vijay Nicole Imprints
        </p>
        <p className="text-gray-500 text-xs">Complimentary Copy Request</p>
      </div>
    </div>
  )
}

function FormError({ title, message }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: 'var(--bg)' }}>
      <AmbientBackground particleCount={28} />
      <div className="w-full max-w-sm text-center relative z-10">
        <VNILogo />
        <div className="card p-6" style={{ background: 'rgba(127,29,29,0.18)', borderColor: 'rgba(248,113,113,0.25)' }}>
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-white font-semibold mb-2 font-display">{title}</p>
          <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  )
}

function FormSuccess({ result }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: 'var(--bg)' }}>
      <AmbientBackground particleCount={28} />
      <div className="w-full max-w-sm text-center relative z-10 scale-in">
        <VNILogo />
        <div className="card p-6" style={{ background: 'rgba(5,46,37,0.35)', borderColor: 'rgba(16,185,129,0.25)' }}>
          <p className="text-5xl mb-4">✅</p>
          <p className="text-white font-bold text-lg font-display mb-2">
            Request Submitted!
          </p>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            {result.message}
          </p>
          <div className="bg-white/5 rounded-xl px-4 py-3 text-left space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">Reference</span>
              <span className="text-white text-xs font-mono font-semibold">{result.requestRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">Faculty</span>
              <span className="text-white text-xs">{result.facultyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">College</span>
              <span className="text-white text-xs text-right max-w-[60%]">{result.collegeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">Books</span>
              <span className="text-white text-xs">{result.bookCount} title{result.bookCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-4">
            Your sales representative will be in touch once the request is processed.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Book search with debounce
// ---------------------------------------------------------------------------

function BookSearch({ tokenHash, onAdd, addedBookIds }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  function handleChange(val) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await newRequestTokensApi.searchBooks(tokenHash, val)
        setResults(data)
      } catch { setResults([]) }
      finally  { setLoading(false) }
    }, 350)
  }

  function handleAdd(book) {
    onAdd(book)
    setQuery('')
    setResults([])
  }

  return (
    <div className="relative">
      <input
        className="input text-sm"
        value={query}
        onChange={e => handleChange(e.target.value)}
        placeholder="Search by title, author or subject…"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="spin-slow h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                    strokeDasharray="40" strokeDashoffset="15" />
          </svg>
        </div>
      )}
      {results.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-[var(--card2)] border border-white/12 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {results.map(book => {
            const added = addedBookIds.has(book.bookId)
            return (
              <button
                key={book.bookId}
                onClick={() => !added && handleAdd(book)}
                disabled={added}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                  ${added ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/6'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium leading-tight">{book.title}</p>
                  {book.authors && (
                    <p className="text-gray-500 text-xs mt-0.5 truncate">{book.authors}</p>
                  )}
                  {book.subjectArea && (
                    <p className="text-gray-600 text-[10px]">{book.subjectArea}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-gray-500 text-xs">₹{book.mrp}</span>
                  {added
                    ? <span className="text-emerald-500 text-[10px]">Added ✓</span>
                    : <span className="text-brand-blue text-[10px]">+ Add</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}
      {query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-[var(--card2)] border border-white/12 rounded-xl shadow-2xl overflow-hidden">
          <p className="text-gray-500 text-sm px-4 py-3">No books found for "{query}"</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Line item row
// ---------------------------------------------------------------------------

function LineItemRow({ item, onUpdate, onRemove }) {
  return (
    <div className="bg-white/3 border border-white/8 rounded-xl p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm leading-tight">{item.title}</p>
          {item.authors && (
            <p className="text-gray-500 text-xs mt-0.5">{item.authors}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(item.tempId)}
          className="text-gray-600 hover:text-red-400 transition-colors text-sm flex-shrink-0 mt-0.5"
        >✕</button>
      </div>

      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {/* Quantity stepper */}
        <div className="flex items-center gap-1 bg-white/6 rounded-lg p-0.5">
          <button
            onClick={() => onUpdate(item.tempId, 'quantity', Math.max(1, item.quantity - 1))}
            className="w-6 h-6 text-gray-400 hover:text-white transition-colors text-sm font-bold"
          >−</button>
          <span className="text-white text-sm w-6 text-center font-mono">{item.quantity}</span>
          <button
            onClick={() => onUpdate(item.tempId, 'quantity', Math.min(3, item.quantity + 1))}
            className="w-6 h-6 text-gray-400 hover:text-white transition-colors text-sm font-bold"
          >+</button>
        </div>

        {/* Format */}
        <select
          className="input py-1.5 text-xs w-28"
          value={item.format}
          onChange={e => onUpdate(item.tempId, 'format', e.target.value)}
        >
          <option value="Physical">📗 Physical</option>
          <option value="Digital">💻 Digital</option>
        </select>

        {/* Subject context free text */}
        <input
          className="input py-1.5 text-xs flex-1 min-w-[100px]"
          value={item.subjectContextFree}
          onChange={e => onUpdate(item.tempId, 'subjectContextFree', e.target.value)}
          placeholder="Subject / course (optional)"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FacultyNewRequestForm() {
  const { token: tokenHash } = useParams()

  // Form metadata
  const [formData,   setFormData]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState(null)

  // Line items
  const [lineItems,  setLineItems]  = useState([])

  // Header fields
  const [requestDate,  setRequestDate]  = useState(today())
  const [visitNotes,   setVisitNotes]   = useState('')
  const [dispatchType, setDispatchType] = useState('college')
  const [altRecipient, setAltRecipient] = useState('')
  const [altAddress,   setAltAddress]   = useState('')
  const [altCity,      setAltCity]      = useState('')
  const [altPin,       setAltPin]       = useState('')

  // Submission
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result,      setResult]      = useState(null)

  // Load form metadata
  useEffect(() => {
    newRequestTokensApi.getForm(tokenHash)
      .then(({ data }) => setFormData(data))
      .catch(err => setLoadError(err.response?.data?.detail ?? 'Could not load form'))
      .finally(() => setLoading(false))
  }, [tokenHash])

  // Helpers
  const addedBookIds = new Set(lineItems.map(li => li.bookId))

  function addBook(book) {
    if (addedBookIds.has(book.bookId)) return
    setLineItems(prev => [...prev, {
      tempId:             uid(),
      bookId:             book.bookId,
      title:              book.title,
      authors:            book.authors,
      quantity:           1,
      format:             'Physical',
      subjectContextFree: '',
    }])
  }

  function updateLine(tempId, field, value) {
    setLineItems(prev => prev.map(li => li.tempId === tempId ? { ...li, [field]: value } : li))
  }

  function removeLine(tempId) {
    setLineItems(prev => prev.filter(li => li.tempId !== tempId))
  }

  async function handleSubmit() {
    if (lineItems.length === 0) {
      setSubmitError('Please add at least one book before submitting.')
      return
    }
    setSubmitError(''); setSubmitting(true)
    try {
      const { data } = await newRequestTokensApi.submit(tokenHash, {
        visitNotes:       visitNotes   || undefined,
        requestDate,
        dispatchType,
        altRecipientName: dispatchType !== 'college' ? altRecipient || undefined : undefined,
        altAddress:       dispatchType !== 'college' ? altAddress   || undefined : undefined,
        altCity:          dispatchType !== 'college' ? altCity      || undefined : undefined,
        altPin:           dispatchType !== 'college' ? altPin       || undefined : undefined,
        lineItems: lineItems.map(li => ({
          bookId:             li.bookId,
          quantity:           li.quantity,
          format:             li.format,
          subjectContextFree: li.subjectContextFree || undefined,
        })),
      })
      setResult(data)
    } catch (err) {
      setSubmitError(err.response?.data?.detail ?? 'Submission failed. Please try again.')
    } finally { setSubmitting(false) }
  }

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative" style={{ background: 'var(--bg)' }}>
        <AmbientBackground particleCount={28} />
        <div className="flex flex-col items-center gap-3 relative z-10">
          <svg className="spin-slow h-8 w-8" style={{ color: 'var(--primary)' }} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor"
                    strokeWidth="3" strokeDasharray="40" strokeDashoffset="15" />
          </svg>
          <p className="text-gray-500 text-sm">Loading your form…</p>
        </div>
      </div>
    )
  }

  if (loadError) return <FormError title="Link Not Found" message={loadError} />

  if (formData?.isExpired) {
    return (
      <FormError
        title="Link Expired"
        message="This form link has expired (72-hour limit). Please contact your VNI sales representative for a new link."
      />
    )
  }

  if (formData?.isUsed) {
    return (
      <FormError
        title="Already Submitted"
        message="This form has already been submitted. Each link can only be used once. Contact your VNI representative if you need to make changes."
      />
    )
  }

  if (result) return <FormSuccess result={result} />

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-5 pb-12 relative" style={{ background: 'var(--bg)' }}>
      <AmbientBackground />
      <div className="max-w-lg mx-auto relative z-10 page-enter">
        <VNILogo />

        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white font-display">
            New Comp Copy Request
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Select the books you'd like to receive and confirm your details below.
          </p>
        </div>

        {/* ── Your Details (read-only) ─────────────────────────────────────── */}
        <div className="card p-4 mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Your Details
          </p>
          <p className="text-white font-semibold">{formData?.facultyName}</p>
          <p className="text-gray-400 text-sm mt-0.5">{formData?.deptName}</p>
          <p className="text-gray-500 text-xs mt-0.5">{formData?.collegeName}</p>
          <p className="text-gray-600 text-xs mt-2">
            Request prepared by {formData?.repName}
          </p>
        </div>

        {/* ── Visit Date ──────────────────────────────────────────────────── */}
        <div className="card p-4 mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Visit Date
          </p>
          <input
            className="input text-sm"
            type="date"
            value={requestDate}
            max={today()}
            onChange={e => setRequestDate(e.target.value)}
          />
        </div>

        {/* ── Books ───────────────────────────────────────────────────────── */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Books
            </p>
            {lineItems.length > 0 && (
              <span className="text-gray-600 text-xs">
                {lineItems.length} book{lineItems.length !== 1 ? 's' : ''} · {lineItems.reduce((s, li) => s + li.quantity, 0)} cop{lineItems.reduce((s, li) => s + li.quantity, 0) === 1 ? 'y' : 'ies'}
              </span>
            )}
          </div>

          {/* Search */}
          <BookSearch
            tokenHash={tokenHash}
            onAdd={addBook}
            addedBookIds={addedBookIds}
          />

          {/* Line items */}
          {lineItems.length === 0 ? (
            <div className="mt-4 text-center py-6 border border-dashed border-white/10 rounded-xl">
              <p className="text-4xl mb-2">📚</p>
              <p className="text-gray-600 text-sm">
                Search above to add books to this request
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {lineItems.map(li => (
                <LineItemRow
                  key={li.tempId}
                  item={li}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Delivery Address ─────────────────────────────────────────────── */}
        <div className="card p-4 mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Delivery Address
          </p>
          <div className="space-y-2 mb-3">
            {[
              { value: 'college',   label: 'My college address', sub: formData?.collegeName },
              { value: 'alternate', label: 'Alternate / home address', sub: null },
            ].map(opt => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                  ${dispatchType === opt.value
                    ? 'border-[rgba(99,102,241,0.4)]'
                    : 'bg-white/3 border-white/8 hover:border-white/15'}`}
                style={dispatchType === opt.value ? { background: 'var(--primary-soft)' } : undefined}
              >
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center
                  ${dispatchType === opt.value ? 'border-[var(--primary)]' : 'border-gray-600'}`}>
                  {dispatchType === opt.value && (
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
                  )}
                </div>
                <input type="radio" value={opt.value} className="sr-only"
                  checked={dispatchType === opt.value}
                  onChange={() => setDispatchType(opt.value)} />
                <div>
                  <p className="text-white text-sm font-medium">{opt.label}</p>
                  {opt.sub && <p className="text-gray-500 text-xs mt-0.5">{opt.sub}</p>}
                </div>
              </label>
            ))}
          </div>

          {dispatchType === 'alternate' && (
            <div className="space-y-2 mt-3">
              <input className="input text-sm" value={altRecipient}
                onChange={e => setAltRecipient(e.target.value)}
                placeholder="Recipient name (if different)" />
              <textarea className="input text-sm min-h-[64px] resize-none" value={altAddress}
                onChange={e => setAltAddress(e.target.value)} placeholder="Street / door number" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input className="input text-sm" value={altCity}
                  onChange={e => setAltCity(e.target.value)} placeholder="City" />
                <input className="input text-sm" value={altPin}
                  onChange={e => setAltPin(e.target.value)} placeholder="PIN code" />
              </div>
            </div>
          )}
        </div>

        {/* ── Notes ────────────────────────────────────────────────────────── */}
        <div className="card p-4 mb-5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Notes <span className="normal-case font-normal text-gray-600">(optional)</span>
          </p>
          <textarea
            className="input text-sm min-h-[72px] resize-none"
            value={visitNotes}
            onChange={e => setVisitNotes(e.target.value)}
            placeholder="Any additional information for the VNI team…"
          />
        </div>

        {/* Error */}
        {submitError && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
            {submitError}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || lineItems.length === 0}
          className="btn-primary w-full py-4 text-base font-semibold"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="spin-slow h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor"
                        strokeWidth="3" strokeDasharray="40" strokeDashoffset="15" />
              </svg>
              Submitting…
            </span>
          ) : lineItems.length === 0
            ? 'Add books to continue'
            : `Submit ${lineItems.length} book${lineItems.length !== 1 ? 's' : ''} →`}
        </button>

        <p className="text-center text-xs text-gray-700 mt-4">
          This link expires{' '}
          {formData?.expiresAt
            ? new Date(formData.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
            : 'soon'}.
        </p>
      </div>
    </div>
  )
}
