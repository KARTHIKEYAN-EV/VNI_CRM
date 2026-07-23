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
      <div className="card p-6 w-full max-w-sm shadow-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'Sora, sans-serif', marginBottom: 4 }}>Add Faculty</h3>
        <p style={{ color: '#d97706', fontSize: 12, marginBottom: 16 }}>
          ⚠️ New faculty will be flagged as PENDING_REVIEW for Admin verification
        </p>
        {error && <p style={{ color: 'var(--error-text)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Name *</label>
            <input className="input text-sm" value={form.facultyName}
              onChange={e => setForm(f => ({ ...f, facultyName: e.target.value }))}
              placeholder="Dr. / Mr. / Ms." />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>College *</label>
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
            <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Department *</label>
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
            <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Mobile</label>
            <input className="input text-sm" value={form.phonePersonal}
              onChange={e => setForm(f => ({ ...f, phonePersonal: e.target.value }))}
              placeholder="9XXXXXXXXX" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
          >Cancel</button>
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
    if (lineItems.some(li => li.bookId === book.bookId)) return

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
      {/* Transparent background for starfield */}
      <div style={{ padding: '1.5rem', maxWidth: '42rem', minHeight: '100vh', background: 'transparent' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/requests')}
            style={{ color: 'var(--muted)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>
            {isEdit ? 'Edit Draft' : 'New Comp Request'}
          </h1>
        </div>

        {error && (
          <div style={{
            background: 'var(--error-bg)', border: '1px solid var(--error-border)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            color: 'var(--error-text)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* ── Section 1: Faculty ─────────────────────────────────────── */}
        <Section title="Faculty" icon="👤">
          {selectedFaculty ? (
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 16px',
            }}>
              <div>
                <p style={{ color: 'var(--text)', fontWeight: 600 }}>{selectedFaculty.facultyName}</p>
                <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                  {selectedFaculty.designation ?? ''}
                  {selectedFaculty.designation ? ' · ' : ''}
                  {selectedFaculty.college?.collegeName ?? ''}
                </p>
                {selectedFaculty.dataQualityFlag === 'PENDING_REVIEW' && (
                  <span style={{ color: '#d97706', fontSize: 10, fontWeight: 600, marginTop: 4, display: 'block' }}>⚠️ PENDING REVIEW</span>
                )}
              </div>
              <button onClick={() => setSelectedFaculty(null)}
                style={{ color: 'var(--faint)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
                Change
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
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
                <div style={{
                  position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', overflow: 'hidden',
                }}>
                  {facultyResults.map(f => (
                    <button key={f.facultyId} onClick={() => selectFaculty(f)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px', textAlign: 'left', background: 'none',
                        border: 'none', cursor: 'pointer',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div>
                        <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>{f.facultyName}</p>
                        <p style={{ color: 'var(--muted)', fontSize: 12 }}>{f.college?.collegeName} · {f.department?.deptName}</p>
                      </div>
                    </button>
                  ))}
                  <button onClick={() => setShowAddFaculty(true)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px', color: '#D01D22', fontSize: 14,
                      background: 'none', border: 'none', borderTop: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}>
                    <span>＋</span> Add new faculty (not in system)
                  </button>
                </div>
              )}
              {facultySearch.length > 2 && !facultyLoading && facultyResults.length === 0 && (
                <div style={{
                  position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', overflow: 'hidden',
                }}>
                  <button onClick={() => setShowAddFaculty(true)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '12px 16px', color: '#D01D22', fontSize: 14,
                      background: 'none', border: 'none', cursor: 'pointer',
                    }}>
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
              <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Visit Date *</label>
              <input className="input" type="date" value={requestDate}
                onChange={e => setRequestDate(e.target.value)} max={today()} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Visit Notes</label>
            <textarea className="input min-h-[72px] resize-none text-sm" value={visitNotes}
              onChange={e => setVisitNotes(e.target.value)}
              placeholder="Optional — notes from the conversation with faculty" />
          </div>
        </Section>

        {/* ── Section 3: Books ────────────────────────────────────────── */}
        <Section title="Books" icon="📚"
          action={<span style={{ color: 'var(--faint)', fontSize: 12 }}>{lineItems.length} book{lineItems.length !== 1 ? 's' : ''} added</span>}>
          {/* Book search */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input className="input" value={bookSearch}
              onChange={e => setBookSearch(e.target.value)}
              placeholder="Search by title or subject to add books…" />
            {bookLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size={16} />
              </div>
            )}
            {bookResults.length > 0 && (
              <div style={{
                position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                maxHeight: '16rem', overflowY: 'auto',
              }}>
                {bookResults.map(book => {
                  const alreadyAdded = lineItems.some(li => li.bookId === book.bookId)
                  return (
                    <button key={book.bookId} onClick={() => addBook(book)} disabled={alreadyAdded}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px', textAlign: 'left',
                        opacity: alreadyAdded ? 0.4 : 1,
                        cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                        background: 'none', border: 'none',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = 'var(--hover-bg)' }}
                      onMouseLeave={e => { if (!alreadyAdded) e.currentTarget.style.background = 'none' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</p>
                        <p style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {book.authors?.map(a => a.authorName).join(', ')}
                          {book.edition ? ` · ${book.edition} Ed.` : ''}
                        </p>
                      </div>
                      <span style={{ color: 'var(--muted)', fontSize: 12, flexShrink: 0 }}>₹{book.mrp}</span>
                      {alreadyAdded && <span style={{ color: 'var(--success)', fontSize: 12, flexShrink: 0 }}>Added</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Empty state */}
          {lineItems.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '24px', border: '1px dashed var(--border)', borderRadius: 12,
            }}>
              <p style={{ color: 'var(--faint)', fontSize: 14 }}>Search above to add books to this request</p>
            </div>
          )}

          {/* Line items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lineItems.map(li => (
              <div key={li.tempId} style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 12,
              }}>
                {/* Duplicate warning */}
                {li.dupWarning && !li.dupOverride && (
                  <div style={{
                    background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
                    borderRadius: 8, padding: '8px 12px', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ color: 'var(--warning-text)', fontSize: 12 }}>
                        ⚠️ This book was comped to this faculty {li.dupWarning.daysAgo} days ago
                        ({li.dupWarning.lastRequestRef})
                      </p>
                      <button onClick={() => updateLine(li.tempId, 'dupOverride', true)}
                        style={{ color: 'var(--warning-text)', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Acknowledge
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{li.bookTitle}</p>
                    <p style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {li.bookAuthors?.map(a => a.authorName).join(', ') || 'No authors'}
                    </p>
                  </div>
                  <button onClick={() => removeLine(li.tempId)}
                    style={{ color: 'var(--faint)', fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--faint)'}
                  >✕</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  {/* Quantity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--input)', borderRadius: 8, padding: '2px' }}>
                    <button onClick={() => updateLine(li.tempId, 'quantity', Math.max(1, li.quantity - 1))}
                      style={{ width: 24, height: 24, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>−</button>
                    <span style={{ color: 'var(--text)', fontSize: 14, width: 24, textAlign: 'center', fontFamily: 'monospace' }}>{li.quantity}</span>
                    <button onClick={() => updateLine(li.tempId, 'quantity', Math.min(5, li.quantity + 1))}
                      style={{ width: 24, height: 24, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>+</button>
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
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {[
              { value: 'college',   label: 'College address (default)' },
              { value: 'alternate', label: 'Alternate address' },
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" value={opt.value} checked={dispatchType === opt.value}
                  onChange={() => setDispatchType(opt.value)}
                  style={{ accentColor: '#D01D22' }} />
                <span style={{ color: 'var(--text)', fontSize: 14 }}>{opt.label}</span>
              </label>
            ))}
          </div>

          {dispatchType === 'alternate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={() => navigate('/requests')}
            style={{
              padding: '10px 16px', borderRadius: 12, fontSize: 14,
              color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none' }}
          >Cancel</button>
          <button onClick={() => handleSave(false)} disabled={saving}
            style={{
              padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500,
              color: 'var(--muted)', border: '1px solid var(--border)', background: 'none',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!saving) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--hover-bg)' }}}
            onMouseLeave={e => { if (!saving) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none' }}}
          >Save Draft</button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="btn-primary" style={{ padding: '10px 24px', fontSize: 14, marginLeft: 'auto' }}>
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
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <h2 style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, fontFamily: 'Sora, sans-serif' }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
