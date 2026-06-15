import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import FormModal, { Field, Select } from '../components/FormModal'
import { DuplicateWarning, Spinner, CustomSelect } from '../components/ui'
import { compRequestsApi } from '../api/comp_requests'
import { facultyApi, collegesApi, departmentsApi } from '../api/master'
import { booksApi } from '../api/master'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const today = () => new Date().toISOString().split('T')[0]
const uid   = () => Math.random().toString(36).slice(2, 8)

// ---------------------------------------------------------------------------
// On-the-fly faculty creation mini-modal
// ---------------------------------------------------------------------------
function AddFacultyModal({ open, onClose, onCreated, colleges }) {
  const [form,    setForm]    = useState({ facultyName: '', collegeId: '', deptId: '', designation: '', phonePersonal: '' })
  const [depts,   setDepts]   = useState([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!form.collegeId) { setDepts([]); return }
    departmentsApi.listAll({ collegeId: form.collegeId }).then(r => setDepts(r.data))
  }, [form.collegeId])

  async function handleSave() {
    if (!form.facultyName.trim()) { setError('Name is required'); return }
    if (!form.collegeId)           { setError('College is required'); return }
    if (!form.deptId)              { setError('Department is required'); return }
    setError(''); setSaving(true)
    try {
      const { data } = await facultyApi.create({
        facultyName:   form.facultyName,
        collegeId:     Number(form.collegeId),
        deptId:        Number(form.deptId),
        designation:   form.designation   || undefined,
        phonePersonal: form.phonePersonal || undefined,
      })
      onCreated(data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-white font-semibold font-display mb-1">Add Faculty</h3>
        <p className="text-amber-400 text-xs mb-4">
          ⚠️ New faculty will be flagged as PENDING_REVIEW for Admin verification
        </p>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1">Name *</label>
            <input className="input text-sm" value={form.facultyName}
              onChange={e => setForm(f => ({ ...f, facultyName: e.target.value }))}
              placeholder="Dr. / Mr. / Ms." />
          </div>
          <div>
            <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1">College *</label>
            <CustomSelect
              value={form.collegeId}
              onChange={v => setForm(f => ({ ...f, collegeId: v, deptId: '' }))}
              options={colleges}
              getValue={c => c.collegeId}
              getLabel={c => c.collegeName}
              placeholder="Select college"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1">Department *</label>
            <CustomSelect
              value={form.deptId}
              onChange={v => setForm(f => ({ ...f, deptId: v }))}
              options={depts}
              getValue={d => d.deptId}
              getLabel={d => d.deptName}
              placeholder="Select department"
              disabled={!form.collegeId}
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1">Mobile</label>
            <input className="input text-sm" value={form.phonePersonal}
              onChange={e => setForm(f => ({ ...f, phonePersonal: e.target.value }))}
              placeholder="9XXXXXXXXX" />
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:text-white transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">
            {saving ? 'Saving…' : 'Add Faculty'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export default function CompRequestNew() {
  const navigate    = useNavigate()
  const { id }      = useParams()          // present when editing a DRAFT
  const isEdit      = Boolean(id)
  const { user }    = useAuth()

  // ── Header state ────────────────────────────────────────────────────────
  const [requestDate,      setRequestDate]      = useState(today())
  const [visitNotes,       setVisitNotes]       = useState('')
  const [dispatchType,     setDispatchType]     = useState('college')
  const [altRecipient,     setAltRecipient]     = useState('')
  const [altAddress,       setAltAddress]       = useState('')
  const [altCity,          setAltCity]          = useState('')
  const [altPin,           setAltPin]           = useState('')

  // ── Faculty ─────────────────────────────────────────────────────────────
  const [selectedFaculty,  setSelectedFaculty]  = useState(null)
  const [facultySearch,    setFacultySearch]    = useState('')
  const [facultyResults,   setFacultyResults]   = useState([])
  const [facultyLoading,   setFacultyLoading]   = useState(false)
  const [showAddFaculty,   setShowAddFaculty]   = useState(false)
  const [colleges,         setColleges]         = useState([])
  const debouncedFacSearch = useDebounce(facultySearch, 350)

  // ── Books ────────────────────────────────────────────────────────────────
  const [lineItems,        setLineItems]        = useState([])
  const [bookSearch,       setBookSearch]       = useState('')
  const [bookResults,      setBookResults]      = useState([])
  const [bookLoading,      setBookLoading]      = useState(false)
  const debouncedBookSearch = useDebounce(bookSearch, 350)

  // ── Form state ───────────────────────────────────────────────────────────
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')
  const [loadingDraft,     setLoadingDraft]     = useState(isEdit)

  // ── Load existing draft ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    compRequestsApi.get(id).then(({ data }) => {
      if (data.status !== 'DRAFT') { navigate(`/requests/${id}`); return }
      setRequestDate(data.requestDate)
      setVisitNotes(data.visitNotes ?? '')
      setDispatchType(data.dispatchType)
      setAltRecipient(data.altRecipientName ?? '')
      setAltAddress(data.altAddress ?? '')
      setAltCity(data.altCity ?? '')
      setAltPin(data.altPin ?? '')
      setSelectedFaculty(data.faculty)

      setLineItems((data.lineItems ?? []).map(li => ({
        tempId:             uid(),
        bookId:             li.bookId,
        bookTitle:          li.bookTitle,
        bookAuthors:        li.bookAuthors ?? [],
        subjectId:          li.subjectId ?? null,
        subjectContextFree: li.subjectContextFree ?? '',
        quantity:           li.quantity,
        format:             li.format,
        dupOverride:        li.dupOverride,
        dupWarning:         null,
      })))
    }).finally(() => setLoadingDraft(false))
  }, [id, isEdit, navigate])

  useEffect(() => { collegesApi.listAll().then(r => setColleges(r.data)) }, [])

  // Faculty search
  useEffect(() => {
    if (!debouncedFacSearch.trim()) { setFacultyResults([]); return }
    setFacultyLoading(true)
    facultyApi.search(debouncedFacSearch)
      .then(r => setFacultyResults(r.data))
      .finally(() => setFacultyLoading(false))
  }, [debouncedFacSearch])

  // Book search
  useEffect(() => {
    if (!debouncedBookSearch.trim()) { setBookResults([]); return }
    setBookLoading(true)
    booksApi.search(debouncedBookSearch, 15)
      .then(r => setBookResults(r.data))
      .finally(() => setBookLoading(false))
  }, [debouncedBookSearch])

  // ── Faculty select ───────────────────────────────────────────────────────
  function selectFaculty(f) {
    setSelectedFaculty(f)
    setFacultySearch('')
    setFacultyResults([])
  }

  // ── Add book to line ─────────────────────────────────────────────────────
  async function addBook(book) {
    if (lineItems.some(li => li.bookId === book.bookId)) return  // already in list

    let dupWarning = null
    if (selectedFaculty) {
      try {
        const { data } = await compRequestsApi.checkLineDuplicate({
          facultyId: selectedFaculty.facultyId,
          bookId:    book.bookId,
        })
        if (data.isDuplicate) dupWarning = data
      } catch (e) {
        console.warn('Duplicate check failed:', e)
      }
    }

    setLineItems(prev => [...prev, {
      tempId:             uid(),
      bookId:             book.bookId,
      bookTitle:          book.title,
      bookAuthors:        book.authors ?? [],
      subjectId:          null,
      subjectContextFree: '',
      quantity:           1,
      format:             'Physical',
      dupOverride:        false,
      dupWarning,
    }])
    setBookSearch('')
    setBookResults([])
  }

  function updateLine(tempId, field, value) {
    setLineItems(prev => prev.map(li =>
      li.tempId === tempId ? { ...li, [field]: value } : li
    ))
  }

  function removeLine(tempId) {
    setLineItems(prev => prev.filter(li => li.tempId !== tempId))
  }

  // ── Save / Submit ────────────────────────────────────────────────────────
  async function handleSave(submit = false) {
    if (!selectedFaculty) { setError('Please select a faculty member'); return }
    if (submit && lineItems.length === 0) { setError('Add at least one book before submitting'); return }
    setError(''); setSaving(true)

    try {
      const payload = {
        facultyId:        selectedFaculty.facultyId,
        visitNotes:       visitNotes || undefined,
        requestDate,
        dispatchType,
        altRecipientName: dispatchType !== 'college' ? altRecipient || undefined : undefined,
        altAddress:       dispatchType !== 'college' ? altAddress   || undefined : undefined,
        altCity:          dispatchType !== 'college' ? altCity      || undefined : undefined,
        altPin:           dispatchType !== 'college' ? altPin       || undefined : undefined,
        lineItems: lineItems.map(li => ({
          bookId:             li.bookId,
          subjectId:          li.subjectId   || undefined,
          subjectContextFree: li.subjectContextFree || undefined,
          quantity:           li.quantity,
          format:             li.format,
          dupOverride:        li.dupOverride,
        })),
      }

      let reqId = isEdit ? Number(id) : null
      if (!isEdit) {
        const { data } = await compRequestsApi.create(payload)
        reqId = data.requestId
      } else {
        await compRequestsApi.update(reqId, payload)
      }

      if (submit) {
        await compRequestsApi.submit(reqId)
      }
      navigate(`/requests/${reqId}`)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loadingDraft) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Spinner size={32} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/requests')}
            className="text-gray-500 hover:text-white transition-colors text-sm">← Back</button>
          <h1 className="text-xl font-bold text-white font-display">
            {isEdit ? 'Edit Draft' : 'New Comp Request'}
          </h1>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ── Section 1: Faculty ─────────────────────────────────────── */}
        <Section title="Faculty" icon="👤">
          {selectedFaculty ? (
            <div className="flex items-start justify-between bg-white/4 border border-white/10 rounded-xl px-4 py-3">
              <div>
                <p className="text-white font-semibold">{selectedFaculty.facultyName}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {selectedFaculty.designation ?? ''}
                  {selectedFaculty.designation ? ' · ' : ''}
                  {selectedFaculty.college?.collegeName ?? ''}
                </p>
                {selectedFaculty.dataQualityFlag === 'PENDING_REVIEW' && (
                  <span className="text-amber-400 text-[10px] font-semibold mt-1 block">⚠️ PENDING REVIEW</span>
                )}
              </div>
              <button onClick={() => setSelectedFaculty(null)}
                className="text-gray-600 hover:text-white transition-colors text-xs ml-3">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input className="input" value={facultySearch}
                onChange={e => setFacultySearch(e.target.value)}
                placeholder="Search faculty by name…" />
              {facultyLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner size={16} />
                </div>
              )}
              {/* Results dropdown */}
              {facultyResults.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#111827] border border-white/12 rounded-xl shadow-2xl overflow-hidden">
                  {facultyResults.map(f => (
                    <button key={f.facultyId} onClick={() => selectFaculty(f)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/6 transition-colors text-left">
                      <div>
                        <p className="text-white text-sm font-medium">{f.facultyName}</p>
                        <p className="text-gray-500 text-xs">{f.college?.collegeName} · {f.department?.deptName}</p>
                      </div>
                    </button>
                  ))}
                  <button onClick={() => setShowAddFaculty(true)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-brand-red hover:bg-white/4 transition-colors text-sm border-t border-white/8">
                    <span>＋</span> Add new faculty (not in system)
                  </button>
                </div>
              )}
              {facultySearch.length > 2 && !facultyLoading && facultyResults.length === 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#111827] border border-white/12 rounded-xl shadow-2xl overflow-hidden">
                  <button onClick={() => setShowAddFaculty(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-brand-red hover:bg-white/4 transition-colors text-sm">
                    <span>＋</span> No results — add "{facultySearch}" as new faculty
                  </button>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── Section 2: Visit Details ────────────────────────────────── */}
        <Section title="Visit Details" icon="📅">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1.5">Visit Date *</label>
              <input className="input" type="date" value={requestDate}
                onChange={e => setRequestDate(e.target.value)} max={today()} />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1.5">Visit Notes</label>
            <textarea className="input min-h-[72px] resize-none text-sm" value={visitNotes}
              onChange={e => setVisitNotes(e.target.value)}
              placeholder="Optional — notes from the conversation with faculty" />
          </div>
        </Section>

        {/* ── Section 3: Books ────────────────────────────────────────── */}
        <Section title="Books" icon="📚"
          action={<span className="text-gray-600 text-xs">{lineItems.length} book{lineItems.length !== 1 ? 's' : ''} added</span>}>

          {/* Book search */}
          <div className="relative mb-4">
            <input className="input" value={bookSearch}
              onChange={e => setBookSearch(e.target.value)}
              placeholder="Search by title or subject to add books…" />
            {bookLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size={16} />
              </div>
            )}
            {bookResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#111827] border border-white/12 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                {bookResults.map(book => {
                  const alreadyAdded = lineItems.some(li => li.bookId === book.bookId)
                  return (
                    <button key={book.bookId} onClick={() => addBook(book)} disabled={alreadyAdded}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                        ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/6'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{book.title}</p>
                        <p className="text-gray-500 text-xs truncate">
                          {book.authors?.map(a => a.authorName).join(', ')}
                          {book.edition ? ` · ${book.edition} Ed.` : ''}
                        </p>
                      </div>
                      <span className="text-gray-600 text-xs flex-shrink-0">₹{book.mrp}</span>
                      {alreadyAdded && <span className="text-emerald-500 text-xs flex-shrink-0">Added</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Line items */}
          {lineItems.length === 0 && (
            <div className="text-center py-6 border border-dashed border-white/10 rounded-xl">
              <p className="text-gray-600 text-sm">Search above to add books to this request</p>
            </div>
          )}
          <div className="space-y-3">
            {lineItems.map(li => (
              <div key={li.tempId} className="bg-white/3 border border-white/8 rounded-xl p-3">
                {/* Duplicate warning */}
                {li.dupWarning && !li.dupOverride && (
                  <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2 mb-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-amber-400 text-xs">
                        ⚠️ This book was comped to this faculty {li.dupWarning.daysAgo} days ago
                        ({li.dupWarning.lastRequestRef})
                      </p>
                      <button onClick={() => updateLine(li.tempId, 'dupOverride', true)}
                        className="text-[10px] text-amber-600 hover:text-amber-400 whitespace-nowrap">
                        Acknowledge
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{li.bookTitle}</p>
                    <p className="text-gray-500 text-xs">
                      {li.bookAuthors?.map(a => a.authorName).join(', ') || 'No authors'}
                    </p>
                  </div>
                  <button onClick={() => removeLine(li.tempId)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-sm flex-shrink-0">✕</button>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  {/* Quantity */}
                  <div className="flex items-center gap-1 bg-white/6 rounded-lg p-0.5">
                    <button onClick={() => updateLine(li.tempId, 'quantity', Math.max(1, li.quantity - 1))}
                      className="w-6 h-6 text-gray-400 hover:text-white transition-colors text-sm font-bold">−</button>
                    <span className="text-white text-sm w-6 text-center font-mono">{li.quantity}</span>
                    <button onClick={() => updateLine(li.tempId, 'quantity', Math.min(5, li.quantity + 1))}
                      className="w-6 h-6 text-gray-400 hover:text-white transition-colors text-sm font-bold">+</button>
                  </div>

                  {/* Format */}
                  <select className="input py-1 text-xs w-28"
                    value={li.format}
                    onChange={e => updateLine(li.tempId, 'format', e.target.value)}>
                    <option value="Physical">Physical</option>
                    <option value="Digital">Digital</option>
                  </select>

                  {/* Subject (free text) */}
                  <input className="input py-1 text-xs flex-1"
                    value={li.subjectContextFree}
                    onChange={e => updateLine(li.tempId, 'subjectContextFree', e.target.value)}
                    placeholder="Subject context (optional)" />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 4: Dispatch ─────────────────────────────────────── */}
        <Section title="Dispatch Address" icon="📦">
          <div className="flex gap-4 mb-3">
            {[
              { value: 'college',   label: 'College address (default)' },
              { value: 'alternate', label: 'Alternate address' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value={opt.value} checked={dispatchType === opt.value}
                  onChange={() => setDispatchType(opt.value)}
                  className="accent-brand-red" />
                <span className="text-gray-300 text-sm">{opt.label}</span>
              </label>
            ))}
          </div>

          {dispatchType === 'alternate' && (
            <div className="space-y-2 mt-2">
              <input className="input text-sm" value={altRecipient}
                onChange={e => setAltRecipient(e.target.value)} placeholder="Recipient name" />
              <textarea className="input text-sm min-h-[60px] resize-none" value={altAddress}
                onChange={e => setAltAddress(e.target.value)} placeholder="Street address" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input className="input text-sm" value={altCity}
                  onChange={e => setAltCity(e.target.value)} placeholder="City" />
                <input className="input text-sm" value={altPin}
                  onChange={e => setAltPin(e.target.value)} placeholder="PIN code" />
              </div>
            </div>
          )}
        </Section>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex gap-3 mt-6">
          <button onClick={() => navigate('/requests')}
            className="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white hover:bg-white/6 transition-all">
            Cancel
          </button>
          <button onClick={() => handleSave(false)} disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border border-white/20 text-gray-300 hover:text-white hover:bg-white/6 transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="btn-primary px-6 py-2.5 text-sm ml-auto">
            {saving ? 'Submitting…' : 'Submit Request →'}
          </button>
        </div>
      </div>

      <AddFacultyModal
        open={showAddFaculty}
        onClose={() => setShowAddFaculty(false)}
        onCreated={selectFaculty}
        colleges={colleges}
      />
    </Layout>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ title, icon, action, children }) {
  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h2 className="text-white font-semibold text-sm font-display">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
