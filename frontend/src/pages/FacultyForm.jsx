import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { tokensApi } from '../api/comp_requests'
import AmbientBackground from '../components/AmbientBackground'

// ---------------------------------------------------------------------------
// Standalone public page — no Layout, no auth context used
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Book search with debounce — lets faculty add extra books to the request
// ---------------------------------------------------------------------------
function BookSearch({ token, onAdd, addedBookIds }) {
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
        const { data } = await tokensApi.searchBooks(token, val)
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
                  {book.mrp != null && <span className="text-gray-500 text-xs">₹{book.mrp}</span>}
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
// Added-book row (faculty-added extra book, removable, qty stepper)
// ---------------------------------------------------------------------------
function AddedBookRow({ item, onUpdate, onRemove }) {
  return (
    <div className="bg-white/3 border border-white/8 rounded-xl p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium leading-tight">{item.title}</p>
          {item.authors && (
            <p className="text-gray-500 text-xs mt-0.5">{item.authors}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(item.tempId)}
          className="text-gray-600 hover:text-red-400 transition-colors text-sm flex-shrink-0 mt-0.5"
        >✕</button>
      </div>

      <div className="flex items-center gap-2 mt-2.5">
        <div className="flex items-center gap-1 bg-white/6 rounded-lg p-0.5">
          <button
            onClick={() => onUpdate(item.tempId, Math.max(1, item.quantity - 1))}
            className="w-6 h-6 text-gray-400 hover:text-white transition-colors text-sm font-bold"
          >−</button>
          <span className="text-white text-sm w-6 text-center font-mono">{item.quantity}</span>
          <button
            onClick={() => onUpdate(item.tempId, Math.min(3, item.quantity + 1))}
            className="w-6 h-6 text-gray-400 hover:text-white transition-colors text-sm font-bold"
          >+</button>
        </div>
        <span className="text-gray-600 text-[10px]">{item.format}</span>
      </div>
    </div>
  )
}

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

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------
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
// Main form
// ---------------------------------------------------------------------------
export default function FacultyForm() {
  const { token } = useParams()

  const [formData,     setFormData]     = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState(null)

  const [dispatchType, setDispatchType] = useState('college')
  const [altRecipient, setAltRecipient] = useState('')
  const [altAddress,   setAltAddress]   = useState('')
  const [altCity,      setAltCity]      = useState('')
  const [altPin,       setAltPin]       = useState('')
  const [notes,        setNotes]        = useState('')
  const [bookQtys,     setBookQtys]     = useState({}) // { lineItemId: quantity }
  const [addedBooks,   setAddedBooks]   = useState([])  // faculty-added extra books

  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')
  const [result,       setResult]       = useState(null)

  // Load form data
  useEffect(() => {
    tokensApi.getForm(token)
      .then(({ data }) => {
        setFormData(data)
        setDispatchType(data.dispatchType ?? 'college')
        setAltRecipient(data.altRecipientName ?? '')
        setAltAddress(data.altAddress ?? '')
        setAltCity(data.altCity ?? '')
        setAltPin(data.altPin ?? '')
        setNotes(data.visitNotes ?? '')
        // initialise qty map from loaded books
        const qtys = {}
        data.books?.forEach(b => { qtys[b.lineItemId] = b.quantity })
        setBookQtys(qtys)
      })
      .catch(err => setLoadError(err.response?.data?.detail ?? 'Could not load form'))
      .finally(() => setLoading(false))
  }, [token])

  function changeQty(lineItemId, delta) {
    setBookQtys(prev => ({
      ...prev,
      [lineItemId]: Math.max(1, (prev[lineItemId] ?? 1) + delta),
    }))
  }

  function addBook(book) {
    setAddedBooks(prev => [
      ...prev,
      {
        tempId:   `${book.bookId}-${Date.now()}`,
        bookId:   book.bookId,
        title:    book.title,
        authors:  book.authors,
        quantity: 1,
        format:   'Physical',
      },
    ])
  }

  function updateAddedBookQty(tempId, quantity) {
    setAddedBooks(prev => prev.map(b => b.tempId === tempId ? { ...b, quantity } : b))
  }

  function removeAddedBook(tempId) {
    setAddedBooks(prev => prev.filter(b => b.tempId !== tempId))
  }

  async function handleSubmit() {
    setSubmitError(''); setSubmitting(true)
    try {
      const { data } = await tokensApi.submitForm(token, {
        visitNotes:       notes || undefined,
        dispatchType,
        altRecipientName: dispatchType !== 'college' ? altRecipient || undefined : undefined,
        altAddress:       dispatchType !== 'college' ? altAddress   || undefined : undefined,
        altCity:          dispatchType !== 'college' ? altCity      || undefined : undefined,
        altPin:           dispatchType !== 'college' ? altPin       || undefined : undefined,
        books: formData?.books?.map(b => ({
          lineItemId: b.lineItemId,
          quantity:   bookQtys[b.lineItemId] ?? b.quantity,
        })),
        additionalBooks: addedBooks.map(b => ({
          bookId:   b.bookId,
          quantity: b.quantity,
          format:   b.format,
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

  if (loadError) {
    return <FormError title="Link Not Found" message={loadError} />
  }

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

  if (result) {
    return <FormSuccess result={result} />
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-5 pb-10 relative" style={{ background: 'var(--bg)' }}>
      <AmbientBackground />
      <div className="max-w-sm mx-auto relative z-10 page-enter">
        <VNILogo />

        {/* Reference */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-white font-display">Review & Confirm</h1>
          <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg"
            style={{ color: 'var(--blue)', background: 'var(--blue-glow)', border: '1px solid rgba(6,182,212,0.3)' }}>
            {formData?.requestRef}
          </span>
        </div>

        {/* Faculty / College info (read-only) */}
        <div className="card p-4 mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Your Details</p>
          <p className="text-white font-semibold">{formData?.facultyName}</p>
          <p className="text-gray-400 text-sm">{formData?.deptName}</p>
          <p className="text-gray-500 text-xs mt-0.5">{formData?.collegeName}</p>
          <p className="text-gray-600 text-xs mt-2">
            Requested by {formData?.repName} · {formData?.requestDate}
          </p>
        </div>

        {/* Books (editable quantity) */}
        <div className="card p-4 mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Books Requested ({formData?.books?.length ?? 0})
          </p>
          <div className="space-y-3">
            {formData?.books?.map(book => (
              <div key={book.lineItemId} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium leading-tight">{book.bookTitle}</p>
                  {book.authors && (
                    <p className="text-gray-500 text-xs mt-0.5">{book.authors}</p>
                  )}
                  <p className="text-gray-600 text-[10px] mt-0.5">{book.format}</p>
                </div>
                {/* Quantity stepper */}
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => changeQty(book.lineItemId, -1)}
                    disabled={(bookQtys[book.lineItemId] ?? book.quantity) <= 1}
                    className="w-7 h-7 rounded-lg bg-white/6 border border-white/10 text-gray-300
                               hover:bg-white/12 disabled:opacity-30 disabled:cursor-not-allowed
                               flex items-center justify-center text-base leading-none transition"
                  >−</button>
                  <span className="w-6 text-center text-white text-sm font-mono font-semibold">
                    {bookQtys[book.lineItemId] ?? book.quantity}
                  </span>
                  <button
                    onClick={() => changeQty(book.lineItemId, 1)}
                    className="w-7 h-7 rounded-lg bg-white/6 border border-white/10 text-gray-300
                               hover:bg-white/12 flex items-center justify-center text-base leading-none transition"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add more books */}
        <div className="card p-4 mb-4 relative">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Add More Books <span className="normal-case font-normal text-gray-600">(optional)</span>
          </p>
          <BookSearch
            token={token}
            onAdd={addBook}
            addedBookIds={new Set(addedBooks.map(b => b.bookId))}
          />
          {addedBooks.length > 0 && (
            <div className="space-y-2 mt-3">
              {addedBooks.map(item => (
                <AddedBookRow
                  key={item.tempId}
                  item={item}
                  onUpdate={updateAddedBookQty}
                  onRemove={removeAddedBook}
                />
              ))}
            </div>
          )}
        </div>

        {/* Delivery address */}
        <div className="card p-4 mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Delivery Address
          </p>
          <div className="space-y-2 mb-3">
            {[
              { value: 'college',   label: 'My college address', sub: formData?.collegeName },
              { value: 'alternate', label: 'Alternate / home address', sub: null },
            ].map(opt => (
              <label key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                  ${dispatchType === opt.value
                    ? 'border-[rgba(99,102,241,0.4)]'
                    : 'bg-white/3 border-white/8 hover:border-white/15'}`}
                style={dispatchType === opt.value ? { background: 'var(--primary-soft)' } : undefined}>
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

        {/* Optional notes */}
        <div className="card p-4 mb-5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Notes <span className="normal-case font-normal text-gray-600">(optional)</span>
          </p>
          <textarea className="input text-sm min-h-[72px] resize-none" value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional information for the VNI team…" />
        </div>

        {submitError && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
            {submitError}
          </div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting}
          className="btn-primary w-full py-4 text-base font-semibold">
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="spin-slow h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor"
                        strokeWidth="3" strokeDasharray="40" strokeDashoffset="15" />
              </svg>
              Submitting…
            </span>
          ) : 'Confirm & Submit Request'}
        </button>

        <p className="text-center text-xs text-gray-700 mt-4">
          By submitting you confirm the books listed above. This link expires{' '}
          {formData?.expiresAt
            ? new Date(formData.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
            : 'soon'}.
        </p>
      </div>
    </div>
  )
}
