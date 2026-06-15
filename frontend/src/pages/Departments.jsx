import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field, Select } from '../components/FormModal'
import {
  PageHeader, StatusBadge, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog,
} from '../components/ui'
import { departmentsApi, collegesApi } from '../api/master'
import { exportApi, importApi } from '../api/importExport'
import CsvImportExport from '../components/CsvImportExport'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = { deptName: '', collegeId: '' }

export default function Departments() {
  const { hasRole } = useAuth()
  const isAdmin     = hasRole('admin')

  const [items,          setItems]          = useState([])
  const [total,          setTotal]          = useState(0)
  const [page,           setPage]           = useState(1)
  const [pages,          setPages]          = useState(1)
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [filterCollege,  setFilterCollege]  = useState('')
  const debouncedSearch = useDebounce(search, 350)

  const [colleges,   setColleges]   = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [confirmRow, setConfirmRow] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await departmentsApi.list({
        page, pageSize: 20,
        search:    debouncedSearch || undefined,
        collegeId: filterCollege   || undefined,
      })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, debouncedSearch, filterCollege])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { collegesApi.listAll().then(r => setColleges(r.data)) }, [])

  function openCreate() {
    setEditing(null)
    setForm({ deptName: '', collegeId: filterCollege })
    setFormError(''); setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({ deptName: row.deptName, collegeId: String(row.collegeId) })
    setFormError(''); setDrawerOpen(true)
  }

  async function handleSave() {
    if (!form.deptName.trim())  { setFormError('Department name is required'); return }
    if (!form.collegeId)         { setFormError('College is required'); return }
    setFormError(''); setSaving(true)
    try {
      const payload = { deptName: form.deptName, collegeId: Number(form.collegeId) }
      editing
        ? await departmentsApi.update(editing.deptId, payload)
        : await departmentsApi.create(payload)
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  async function handleDeactivate(row) {
    await departmentsApi.deactivate(row.deptId); setConfirmRow(null); fetchItems()
  }

  const columns = [
    {
      key: 'deptName', header: 'Department', sortable: true,
      render: row => <span className="text-white font-medium">{row.deptName}</span>,
    },
    {
      key: 'college', header: 'College',
      render: row => <span className="text-gray-400 text-xs">{row.college?.collegeName ?? '—'}</span>,
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
      <div className="p-6">
        <PageHeader
          title="Departments"
          subtitle={`${total} departments`}
          action={
            <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">
              + Add Department
            </button>
          }
        />
        {isAdmin && (
          <CsvImportExport
            entityLabel="Departments"
            onExport={() => exportApi.departments(filterCollege || undefined)}
            onImport={async (file) => { const r = await importApi.departments(file); fetchItems(); return r }}
            templateHeaders={['college_name', 'dept_name']}
          />
        )}
        <div className="flex flex-wrap gap-3 mb-5">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search departments…" className="flex-1 min-w-[180px] max-w-xs" />
          <select value={filterCollege}
            onChange={e => { setFilterCollege(e.target.value); setPage(1) }}
            className="input w-56 text-sm">
            <option value="">All colleges</option>
            {colleges.map(c => (
              <option key={c.collegeId} value={c.collegeId}>{c.collegeName}</option>
            ))}
          </select>
        </div>

        <DataTable columns={columns} rows={items} actions={rowActions}
          keyField="deptId" loading={loading}
          emptyNode={<EmptyState icon="📂" title="No departments found" />} />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      <FormModal open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Department' : 'Add Department'}
        onSave={handleSave} saving={saving}>
        {formError && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
            {formError}
          </div>
        )}
        <Field label="College" required>
          <Select value={form.collegeId} onChange={v => setForm(f => ({ ...f, collegeId: v }))}>
            <option value="">Select college</option>
            {colleges.map(c => (
              <option key={c.collegeId} value={c.collegeId}>{c.collegeName}</option>
            ))}
          </Select>
        </Field>
        <Field label="Department Name" required>
          <input className="input" value={form.deptName}
            onChange={e => setForm(f => ({ ...f, deptName: e.target.value }))}
            placeholder="e.g. Department of Commerce" />
        </Field>
      </FormModal>

      <ConfirmDialog open={Boolean(confirmRow)} title="Deactivate Department"
        message={`Deactivate "${confirmRow?.deptName}"?`}
        onConfirm={() => handleDeactivate(confirmRow)} onCancel={() => setConfirmRow(null)} />
    </Layout>
  )
}
