import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field } from '../components/FormModal'
import {
  PageHeader, StatusBadge, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog,
} from '../components/ui'
import { authorsApi } from '../api/master'
import { exportApi, importApi } from '../api/importExport'
import CsvImportExport from '../components/CsvImportExport'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = { authorName: '', email: '', phone: '', bio: '' }

export default function Authors() {
  const { hasRole } = useAuth()
  const isAdmin     = hasRole('admin')

  const [items,     setItems]     = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [pages,     setPages]     = useState(1)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const debouncedSearch = useDebounce(search, 350)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [confirmRow, setConfirmRow] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await authorsApi.list({ page, pageSize: 20, search: debouncedSearch || undefined })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { fetchItems() }, [fetchItems])

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({ authorName: row.authorName, email: row.email ?? '', phone: row.phone ?? '', bio: row.bio ?? '' })
    setFormError(''); setDrawerOpen(true)
  }

  async function handleSave() {
    if (!form.authorName.trim()) { setFormError('Author name is required'); return }
    setFormError(''); setSaving(true)
    try {
      const payload = {
        authorName: form.authorName,
        email:      form.email || undefined,
        phone:      form.phone || undefined,
        bio:        form.bio   || undefined,
      }
      editing
        ? await authorsApi.update(editing.authorId, payload)
        : await authorsApi.create(payload)
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  async function handleDeactivate(row) {
    await authorsApi.deactivate(row.authorId); setConfirmRow(null); fetchItems()
  }

  const columns = [
    {
      key: 'authorName', header: 'Author', sortable: true,
      render: row => <span className="text-gray-900 dark:text-white font-medium">{row.authorName}</span>,
    },
    {
      key: 'email', header: 'Email', width: 'w-52',
      render: row => <span className="text-gray-500 dark:text-gray-400 text-xs">{row.email ?? '—'}</span>,
    },
    {
      key: 'phone', header: 'Phone', width: 'w-36',
      render: row => <span className="text-gray-500 dark:text-gray-400 text-xs font-mono">{row.phone ?? '—'}</span>,
    },
    {
      key: 'isActive', header: 'Status', width: 'w-28',
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
      <div className="p-6 bg-white dark:bg-[#05080f] min-h-screen">
        <PageHeader
          title="Authors"
          subtitle={`${total} authors`}
          action={
            isAdmin && (
              <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">+ Add Author</button>
            )
          }
        />
        {isAdmin && (
          <CsvImportExport
            entityLabel="Authors"
            onExport={exportApi.authors}
            onImport={async (file) => { const r = await importApi.authors(file); fetchItems(); return r }}
            templateHeaders={['author_name', 'email', 'phone', 'bio']}
          />
        )}
        <div className="mb-5">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search authors…" className="max-w-xs" />
        </div>
        <DataTable columns={columns} rows={items} actions={rowActions}
          keyField="authorId" loading={loading}
          emptyNode={<EmptyState icon="✍️" title="No authors found" />} />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      <FormModal open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Author' : 'Add Author'} onSave={handleSave} saving={saving}>
        {formError && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-600 dark:text-red-400 text-sm">
            {formError}
          </div>
        )}
        <Field label="Full Name" required>
          <input className="input" value={form.authorName}
            onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))}
            placeholder="Author's full name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input className="input" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="author@email.com" />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="9XXXXXXXXX" />
          </Field>
        </div>
        <Field label="Bio">
          <textarea className="input min-h-[80px] resize-none" value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder="Brief bio (optional)" />
        </Field>
      </FormModal>

      <ConfirmDialog open={Boolean(confirmRow)} title="Deactivate Author"
        message={`Deactivate "${confirmRow?.authorName}"?`}
        onConfirm={() => handleDeactivate(confirmRow)} onCancel={() => setConfirmRow(null)} />
    </Layout>
  )
}
