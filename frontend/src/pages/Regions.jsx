import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field } from '../components/FormModal'
import {
  PageHeader, StatusBadge, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog,
} from '../components/ui'
import { regionsApi } from '../api/master'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = { regionName: '', districtsCovered: '' }

export default function Regions() {
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
      const { data } = await regionsApi.list({
        page, pageSize: 20,
        search: debouncedSearch || undefined,
      })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { fetchItems() }, [fetchItems])

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({ regionName: row.regionName, districtsCovered: row.districtsCovered ?? '' })
    setFormError(''); setDrawerOpen(true)
  }

  async function handleSave() {
    if (!form.regionName.trim()) { setFormError('Region name is required'); return }
    setFormError(''); setSaving(true)
    try {
      const payload = {
        regionName:       form.regionName,
        districtsCovered: form.districtsCovered || undefined,
      }
      editing
        ? await regionsApi.update(editing.regionId, payload)
        : await regionsApi.create(payload)
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  async function handleDeactivate(row) {
    await regionsApi.deactivate(row.regionId); setConfirmRow(null); fetchItems()
  }

  const columns = [
    {
      key: 'regionName', header: 'Region Name', sortable: true,
      render: row => <span className="text-white font-medium">{row.regionName}</span>,
    },
    {
      key: 'districtsCovered', header: 'Districts Covered',
      render: row => <span className="text-gray-400 text-xs">{row.districtsCovered ?? '—'}</span>,
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
          title="Regions"
          subtitle={`${total} sales regions`}
          action={
            isAdmin && (
              <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">
                + Add Region
              </button>
            )
          }
        />

        <div className="mb-5">
          <SearchInput
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search regions…"
            className="max-w-xs"
          />
        </div>

        <DataTable
          columns={columns} rows={items} actions={rowActions}
          keyField="regionId" loading={loading}
          emptyNode={<EmptyState icon="🗺️" title="No regions found" />}
        />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      <FormModal
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Region' : 'Add Region'}
        onSave={handleSave} saving={saving}
      >
        {formError && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
            {formError}
          </div>
        )}
        <Field label="Region Name" required>
          <input className="input" value={form.regionName}
            onChange={e => setForm(f => ({ ...f, regionName: e.target.value }))}
            placeholder="e.g. Tirunelveli Region" />
        </Field>
        <Field label="Districts Covered">
          <textarea className="input min-h-[80px] resize-none"
            value={form.districtsCovered}
            onChange={e => setForm(f => ({ ...f, districtsCovered: e.target.value }))}
            placeholder="e.g. Tirunelveli, Nagercoil, Kanyakumari" />
        </Field>
      </FormModal>

      <ConfirmDialog
        open={Boolean(confirmRow)} title="Deactivate Region"
        message={`Deactivate "${confirmRow?.regionName}"?`}
        onConfirm={() => handleDeactivate(confirmRow)} onCancel={() => setConfirmRow(null)}
      />
    </Layout>
  )
}
