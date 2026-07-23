import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field, Select } from '../components/FormModal'
import {
  PageHeader, StatusBadge, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog,
} from '../components/ui'
import { booksApi, authorsApi } from '../api/master'
import { exportApi, importApi } from '../api/importExport'
import CsvImportExport from '../components/CsvImportExport'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = {
  title: '', isbn: '', edition: '', subjectArea: '',
  discipline: '', mrp: '', format: 'Physical', compStock: '0',
  authorIds: [],
}

export default function Books() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)

  const [allAuthors, setAllAuthors] = useState([])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmRow, setConfirmRow] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await booksApi.list({ page, pageSize: 20, search: debouncedSearch || undefined })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { authorsApi.listAll().then(r => setAllAuthors(r.data)) }, [])

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      title: row.title,
      isbn: row.isbn ?? '',
      edition: row.edition ?? '',
      subjectArea: row.subjectArea ?? '',
      discipline: row.discipline ?? '',
      mrp: String(row.mrp),
      format: row.format,
      compStock: String(row.compStock),
      authorIds: row.authors.map(a => ({ authorId: a.authorId, authorOrder: a.authorOrder })),
    })
    setFormError(''); setDrawerOpen(true)
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleAuthor(authorId) {
    setForm(f => {
      const exists = f.authorIds.find(a => a.authorId === authorId)
      if (exists) return { ...f, authorIds: f.authorIds.filter(a => a.authorId !== authorId) }
      return { ...f, authorIds: [...f.authorIds, { authorId, authorOrder: f.authorIds.length + 1 }] }
    })
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormError('Title is required'); return }
    if (!form.mrp || isNaN(Number(form.mrp))) { setFormError('MRP must be a number'); return }
    setFormError(''); setSaving(true)
    try {
      const payload = {
        title: form.title,
        isbn: form.isbn || undefined,
        edition: form.edition || undefined,
        subjectArea: form.subjectArea || undefined,
        discipline: form.discipline || undefined,
        mrp: Number(form.mrp),
        format: form.format,
        compStock: Number(form.compStock) || 0,
        authors: form.authorIds,
      }
      editing
        ? await booksApi.update(editing.bookId, payload)
        : await booksApi.create(payload)
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  async function handleDeactivate(row) {
    await booksApi.deactivate(row.bookId); setConfirmRow(null); fetchItems()
  }

  const columns = [
    {
      key: 'title', header: 'Title', sortable: true,
      render: row => (
        <div>
          <p style={{ color: 'var(--text)', fontWeight: 500, lineHeight: 1.25 }}>{row.title}</p>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
            {row.authors.map(a => a.authorName).join(', ') || 'No authors'}
            {row.edition ? ` · ${row.edition} Ed.` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'subjectArea', header: 'Subject', width: 'w-40',
      render: row => <span style={{ color: 'var(--muted)', fontSize: 12 }}>{row.subjectArea ?? '—'}</span>,
    },
    {
      key: 'mrp', header: 'MRP', sortable: true, width: 'w-24',
      render: row => <span style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>₹{row.mrp}</span>,
    },
    {
      key: 'compStock', header: 'Comp Stock', sortable: true, width: 'w-28',
      render: row => (
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
          color: row.compStock === 0 ? 'var(--danger)' : 'var(--success)'
        }}>
          {row.compStock}
        </span>
      ),
    },
    {
      key: 'format', header: 'Format', width: 'w-28',
      render: row => <StatusBadge value={row.format} />,
    },
    {
      key: 'isActive', header: 'Active', width: 'w-24',
      render: row => <StatusBadge value={row.isActive ? 'active' : 'inactive'} />,
    },
  ]

  const rowActions = row => {
    const acts = [{ label: 'Edit', onClick: openEdit }]
    if (isAdmin && row.isActive)
      acts.push({ label: 'Deactivate', onClick: r => setConfirmRow(r), danger: true })
    return acts
  }

  return (
    <Layout>
      {/* Page wrapper – transparent to show ambient background */}
      <div style={{ padding: '1.5rem', minHeight: '100vh', background: 'transparent' }}>
        <PageHeader
          title="Book Catalog"
          subtitle={`${total} titles`}
          action={isAdmin && <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">+ Add Book</button>}
        />

        {isAdmin && (
          <CsvImportExport
            entityLabel="Books"
            onExport={exportApi.books}
            onImport={async (file) => { const r = await importApi.books(file); fetchItems(); return r }}
            templateHeaders={['title', 'isbn', 'edition', 'subject_area', 'discipline', 'mrp', 'format', 'comp_stock', 'author_names']}
          />
        )}

        <div className="mb-5">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search by title or subject…" className="max-w-sm" />
        </div>

        <DataTable columns={columns} rows={items} actions={rowActions}
          keyField="bookId" loading={loading}
          emptyNode={<EmptyState icon="📚" title="No books found" subtitle="Add your first book to the catalog" />} />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      <FormModal open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Book' : 'Add Book'} onSave={handleSave} saving={saving} width="max-w-lg">
        {formError && (
          <div style={{
            backgroundColor: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            color: 'var(--error-text)',
            fontSize: 13,
          }}>
            {formError}
          </div>
        )}
        <Field label="Title" required>
          <input className="input" value={form.title} onChange={e => setField('title', e.target.value)}
            placeholder="Full book title" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ISBN">
            <input className="input" value={form.isbn} onChange={e => setField('isbn', e.target.value)}
              placeholder="978-…" />
          </Field>
          <Field label="Edition">
            <input className="input" value={form.edition} onChange={e => setField('edition', e.target.value)}
              placeholder="e.g. 3rd" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject Area">
            <input className="input" value={form.subjectArea} onChange={e => setField('subjectArea', e.target.value)}
              placeholder="e.g. Financial Accounting" />
          </Field>
          <Field label="Discipline">
            <input className="input" value={form.discipline} onChange={e => setField('discipline', e.target.value)}
              placeholder="e.g. Commerce" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="MRP (₹)" required>
            <input className="input" type="number" min="0" value={form.mrp}
              onChange={e => setField('mrp', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Comp Stock">
            <input className="input" type="number" min="0" value={form.compStock}
              onChange={e => setField('compStock', e.target.value)} />
          </Field>
          <Field label="Format">
            <Select value={form.format} onChange={v => setField('format', v)}>
              <option value="Physical">Physical</option>
              <option value="Digital">Digital</option>
              <option value="Both">Both</option>
            </Select>
          </Field>
        </div>

        <Field label="Authors">
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
            {allAuthors.map(a => {
              const selected = form.authorIds.some(x => x.authorId === a.authorId)
              return (
                <button key={a.authorId} onClick={() => toggleAuthor(a.authorId)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 150ms',
                    backgroundColor: selected ? 'var(--primary-soft)' : 'var(--card)',
                    border: selected
                      ? '1px solid var(--primary)'
                      : '1px solid var(--border)',
                    color: selected ? 'var(--text)' : 'var(--muted)',
                  }}
                  onMouseEnter={e => {
                    if (!selected) {
                      e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                      e.currentTarget.style.color = 'var(--text)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!selected) {
                      e.currentTarget.style.backgroundColor = 'var(--card)';
                      e.currentTarget.style.color = 'var(--muted)';
                    }
                  }}
                >
                  {a.authorName}
                </button>
              )
            })}
          </div>
        </Field>
      </FormModal>

      <ConfirmDialog open={Boolean(confirmRow)} title="Deactivate Book"
        message={`Deactivate "${confirmRow?.title}"? It will no longer appear in comp request forms.`}
        onConfirm={() => handleDeactivate(confirmRow)} onCancel={() => setConfirmRow(null)} />
    </Layout>
  )
}
