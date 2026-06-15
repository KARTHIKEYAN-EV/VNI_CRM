import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field, Select } from '../components/FormModal'
import {
  PageHeader, EmptyState, PaginationBar, SearchInput, ConfirmDialog, StatusBadge,
} from '../components/ui'
import { syllabiApi, subjectsApi } from '../api/academic'
import { booksApi } from '../api/master'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const BLANK_UNIT = (n) => ({ unitNumber: n, title: '', topics: '' })
const DEFAULT_UNITS = [1, 2, 3, 4, 5].map(BLANK_UNIT)

const EMPTY_FORM = {
  subjectId: '', university: '', regulationYear: '',
  lastVerifiedDate: '', sourceNotes: '',
  units: DEFAULT_UNITS,
}

export default function Syllabi() {
  const { hasRole } = useAuth()
  const isAdmin     = hasRole('admin')

  const [items,          setItems]          = useState([])
  const [total,          setTotal]          = useState(0)
  const [page,           setPage]           = useState(1)
  const [pages,          setPages]          = useState(1)
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [filterSubject,  setFilterSubject]  = useState('')
  const debouncedSearch  = useDebounce(search, 350)

  const [subjects,   setSubjects]   = useState([])
  const [allBooks,   setAllBooks]   = useState([])

  // Main drawer (create/edit)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [confirmRow, setConfirmRow] = useState(null)

  // Book panel (slide over existing drawer)
  const [bookPanelSyllabus, setBookPanelSyllabus] = useState(null)
  const [bookSearch,        setBookSearch]        = useState('')
  const [bookResults,       setBookResults]       = useState([])
  const [addingBook,        setAddingBook]        = useState(false)
  const debouncedBookSearch = useDebounce(bookSearch, 350)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await syllabiApi.list({
        page, pageSize: 20,
        subjectId: filterSubject || undefined,
      })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, filterSubject])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => {
    subjectsApi.listAll().then(r => setSubjects(r.data))
  }, [])

  // Book search for assignment panel
  useEffect(() => {
    if (!debouncedBookSearch.trim()) { setBookResults([]); return }
    booksApi.search(debouncedBookSearch, 15).then(r => setBookResults(r.data))
  }, [debouncedBookSearch])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, units: DEFAULT_UNITS.map(u => ({ ...u })) })
    setFormError(''); setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    const existingUnits = Array.isArray(row.unitBreakdown) && row.unitBreakdown.length
      ? row.unitBreakdown.map(u => ({
          unitNumber: u.unit_number ?? u.unitNumber,
          title:      u.title       ?? '',
          topics:     u.topics      ?? '',
        }))
      : DEFAULT_UNITS.map(u => ({ ...u }))

    setForm({
      subjectId:        String(row.subjectId),
      university:       row.university,
      regulationYear:   row.regulationYear,
      lastVerifiedDate: row.lastVerifiedDate ?? '',
      sourceNotes:      row.sourceNotes      ?? '',
      units:            existingUnits,
    })
    setFormError(''); setDrawerOpen(true)
  }

  function setUnit(idx, field, val) {
    setForm(f => {
      const units = [...f.units]
      units[idx] = { ...units[idx], [field]: val }
      return { ...f, units }
    })
  }

  async function handleSave() {
    if (!form.subjectId)           { setFormError('Subject is required'); return }
    if (!form.university.trim())   { setFormError('University is required'); return }
    if (!form.regulationYear.trim()){ setFormError('Regulation year is required'); return }
    setFormError(''); setSaving(true)
    try {
      const units = form.units.filter(u => u.topics.trim())
      const payload = {
        subjectId:         Number(form.subjectId),
        university:        form.university,
        regulationYear:    form.regulationYear,
        lastVerifiedDate:  form.lastVerifiedDate || undefined,
        sourceNotes:       form.sourceNotes      || undefined,
        unitBreakdown:     units.length ? units : undefined,
      }
      editing
        ? await syllabiApi.update(editing.syllabusId, payload)
        : await syllabiApi.create(payload)
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  async function handleAssignBook(book, role = 'Prescribed') {
    if (!bookPanelSyllabus) return
    setAddingBook(true)
    try {
      const { data } = await syllabiApi.assignBook(bookPanelSyllabus.syllabusId, {
        bookId: book.bookId, bookRole: role,
      })
      setBookPanelSyllabus(data)
      // refresh list row in-place
      setItems(prev => prev.map(i => i.syllabusId === data.syllabusId ? data : i))
    } finally { setAddingBook(false) }
  }

  async function handleRemoveBook(bookId) {
    if (!bookPanelSyllabus) return
    await syllabiApi.removeBook(bookPanelSyllabus.syllabusId, bookId)
    const { data } = await syllabiApi.get(bookPanelSyllabus.syllabusId)
    setBookPanelSyllabus(data)
    setItems(prev => prev.map(i => i.syllabusId === data.syllabusId ? data : i))
  }

  // ── Table ──────────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'university', header: 'University / Regulation', sortable: true,
      render: row => (
        <div>
          <p className="text-white font-medium">{row.university}</p>
          <p className="text-gray-500 text-xs">{row.regulationYear}</p>
        </div>
      ),
    },
    {
      key: 'subject', header: 'Subject',
      render: row => <span className="text-gray-400 text-xs">{row.subject?.subjectName ?? '—'}</span>,
    },
    {
      key: 'books', header: 'Books', width: 'w-20',
      render: row => (
        <span className="text-gray-400 text-xs font-mono">{row.books?.length ?? 0}</span>
      ),
    },
    {
      key: 'lastVerifiedDate', header: 'Verified', width: 'w-32',
      render: row => (
        <span className="text-gray-500 text-xs">
          {row.lastVerifiedDate ?? <span className="text-gray-700">—</span>}
        </span>
      ),
    },
    {
      key: 'isActive', header: 'Status', width: 'w-24',
      render: row => <StatusBadge value={row.isActive ? 'active' : 'inactive'} />,
    },
  ]

  const rowActions = row => {
    const acts = [
      { label: 'Edit',  onClick: openEdit },
      { label: 'Books', onClick: r => { setBookPanelSyllabus(r); setBookSearch('') } },
    ]
    if (isAdmin && row.isActive)
      acts.push({ label: 'Deactivate', onClick: r => setConfirmRow(r), danger: true })
    return acts
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="p-6">
        <PageHeader title="Syllabi" subtitle={`${total} entries`}
          action={<button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">+ Add Syllabus</button>} />

        <div className="flex flex-wrap gap-3 mb-5">
          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setPage(1) }}
            className="input w-64 text-sm">
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
          </select>
        </div>

        <DataTable columns={columns} rows={items} actions={rowActions}
          keyField="syllabusId" loading={loading}
          emptyNode={<EmptyState icon="📄" title="No syllabi found"
            subtitle="Add a syllabus to link subjects to unit content and books" />} />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      {/* ── Create / Edit Drawer ─────────────────────────────────────────── */}
      <FormModal open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Syllabus' : 'Add Syllabus'}
        subtitle="Unit breakdown is optional but enables Phase 2 pitch intelligence"
        onSave={handleSave} saving={saving} width="max-w-lg">

        {formError && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">{formError}</div>
        )}

        <Field label="Subject" required>
          <Select value={form.subjectId} onChange={v => setForm(f => ({ ...f, subjectId: v }))}>
            <option value="">Select subject</option>
            {subjects.map(s => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="University" required>
            <input className="input" value={form.university}
              onChange={e => setForm(f => ({ ...f, university: e.target.value }))}
              placeholder="e.g. Anna University" />
          </Field>
          <Field label="Regulation Year" required>
            <input className="input" value={form.regulationYear}
              onChange={e => setForm(f => ({ ...f, regulationYear: e.target.value }))}
              placeholder="e.g. 2021 Regulation" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Last Verified">
            <input className="input" type="date" value={form.lastVerifiedDate}
              onChange={e => setForm(f => ({ ...f, lastVerifiedDate: e.target.value }))} />
          </Field>
          <Field label="Source Notes">
            <input className="input" value={form.sourceNotes}
              onChange={e => setForm(f => ({ ...f, sourceNotes: e.target.value }))}
              placeholder="Who provided this?" />
          </Field>
        </div>

        {/* Unit breakdown */}
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Unit Breakdown <span className="text-gray-700 normal-case font-normal">(optional)</span>
          </p>
          <div className="space-y-3">
            {form.units.map((unit, idx) => (
              <div key={idx} className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest w-14 flex-shrink-0">
                    Unit {unit.unitNumber}
                  </span>
                  <input className="input py-1.5 text-xs flex-1"
                    value={unit.title}
                    onChange={e => setUnit(idx, 'title', e.target.value)}
                    placeholder="Unit title (optional)" />
                </div>
                <textarea
                  className="input text-xs min-h-[56px] resize-none"
                  value={unit.topics}
                  onChange={e => setUnit(idx, 'topics', e.target.value)}
                  placeholder="Topics covered in this unit…" />
              </div>
            ))}
          </div>
        </div>
      </FormModal>

      {/* ── Book Assignment Panel ─────────────────────────────────────────── */}
      {bookPanelSyllabus && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setBookPanelSyllabus(null)} />
          <div className="fixed top-0 right-0 z-50 h-full max-w-md w-full bg-[#0d1525] border-l border-white/8 shadow-2xl flex flex-col">
            <div className="flex items-start justify-between px-6 py-5 border-b border-white/8 flex-shrink-0">
              <div>
                <h2 className="text-white font-semibold font-display">Book Assignments</h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  {bookPanelSyllabus.university} · {bookPanelSyllabus.regulationYear}
                </p>
              </div>
              <button onClick={() => setBookPanelSyllabus(null)}
                className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Assigned books */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Assigned ({bookPanelSyllabus.books?.length ?? 0})
                </p>
                {bookPanelSyllabus.books?.length === 0 && (
                  <p className="text-gray-700 text-xs">No books assigned yet</p>
                )}
                <div className="space-y-2">
                  {bookPanelSyllabus.books?.map(b => (
                    <div key={b.bookId}
                      className="flex items-center justify-between bg-white/3 border border-white/8 rounded-xl px-3 py-2.5">
                      <div className="min-w-0 mr-3">
                        <p className="text-white text-sm font-medium truncate">{b.bookTitle}</p>
                        <p className="text-gray-500 text-xs">
                          {b.authors.map(a => a.authorName).join(', ') || 'No authors'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md
                          ${b.bookRole === 'Prescribed'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                            : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'}`}>
                          {b.bookRole}
                        </span>
                        <button onClick={() => handleRemoveBook(b.bookId)}
                          className="text-gray-600 hover:text-red-400 transition-colors text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Search & add books */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Add Book
                </p>
                <input className="input text-sm mb-3" value={bookSearch}
                  onChange={e => setBookSearch(e.target.value)}
                  placeholder="Search catalog by title or subject…" />

                <div className="space-y-1.5">
                  {bookResults.map(book => {
                    const assigned = bookPanelSyllabus.books?.some(b => b.bookId === book.bookId)
                    return (
                      <div key={book.bookId}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 border transition-all
                          ${assigned
                            ? 'bg-white/2 border-white/5 opacity-50'
                            : 'bg-white/4 border-white/8 hover:bg-white/6'}`}>
                        <div className="min-w-0 mr-3">
                          <p className="text-white text-sm truncate">{book.title}</p>
                          <p className="text-gray-500 text-xs truncate">
                            {book.authors.map(a => a.authorName).join(', ') || 'No authors'}
                          </p>
                        </div>
                        {!assigned && (
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => handleAssignBook(book, 'Prescribed')}
                              disabled={addingBook}
                              className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/60 transition-all">
                              Prescribed
                            </button>
                            <button onClick={() => handleAssignBook(book, 'Reference')}
                              disabled={addingBook}
                              className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/50 hover:bg-amber-900/60 transition-all">
                              Reference
                            </button>
                          </div>
                        )}
                        {assigned && <span className="text-gray-600 text-xs">Added</span>}
                      </div>
                    )
                  })}
                  {bookSearch && !bookResults.length && (
                    <p className="text-gray-700 text-xs text-center py-3">No books found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog open={Boolean(confirmRow)} title="Deactivate Syllabus"
        message={`Deactivate this syllabus for "${confirmRow?.university} · ${confirmRow?.regulationYear}"?`}
        onConfirm={async () => {
          await syllabiApi.deactivate(confirmRow.syllabusId)
          setConfirmRow(null); fetchItems()
        }}
        onCancel={() => setConfirmRow(null)} />
    </Layout>
  )
}
