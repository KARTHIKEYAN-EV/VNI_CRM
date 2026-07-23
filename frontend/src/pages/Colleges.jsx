import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field, Select } from '../components/FormModal'
import {
  PageHeader, StatusBadge, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog,
} from '../components/ui'
import { collegesApi, regionsApi } from '../api/master'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = {
  collegeName: '', collegeType: 'Arts', regionId: '',
  affiliatedUniversity: '', addressStreet: '', addressCity: '',
  addressDistrict: '', addressState: 'Tamil Nadu', addressPin: '',
  phone: '', email: ''
}

export default function Colleges() {
  const { hasRole } = useAuth()
  const isAdmin     = hasRole('admin')
  const isRep       = hasRole('rep')

  const [items,     setItems]     = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [pages,     setPages]     = useState(1)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const debouncedSearch = useDebounce(search, 350)

  const [regions, setRegions] = useState([])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [confirmRow, setConfirmRow] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await collegesApi.list({
        page, pageSize: 20,
        search: debouncedSearch || undefined,
      })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => {
    regionsApi.listAll().then(r => setRegions(r.data))
  }, [])

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      collegeName: row.collegeName,
      collegeType: row.collegeType,
      regionId: String(row.regionId),
      affiliatedUniversity: row.affiliatedUniversity ?? '',
      addressStreet: row.addressStreet ?? '',
      addressCity: row.addressCity ?? '',
      addressDistrict: row.addressDistrict ?? '',
      addressState: row.addressState ?? 'Tamil Nadu',
      addressPin: row.addressPin ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
    })
    setFormError(''); setDrawerOpen(true)
  }

  async function handleSave() {
    if (!form.collegeName.trim()) { setFormError('College name is required'); return }
    setFormError(''); setSaving(true)
    try {
      const payload = { ...form, regionId: Number(form.regionId) }
      editing
        ? await collegesApi.update(editing.collegeId, payload)
        : await collegesApi.create(payload)
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  async function handleDeactivate(row) {
    await collegesApi.deactivate(row.collegeId); setConfirmRow(null); fetchItems()
  }

  const columns = [
    {
      key: 'collegeName', header: 'College', sortable: true,
      render: row => <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.collegeName}</span>,
    },
    {
      key: 'collegeType', header: 'Type', width: 'w-32',
      render: row => <span style={{ color: 'var(--muted)', fontSize: 12, textTransform: 'capitalize' }}>{row.collegeType}</span>,
    },
    {
      key: 'region', header: 'Region', width: 'w-40',
      render: row => <span style={{ color: 'var(--muted)', fontSize: 12 }}>{row.region?.regionName ?? '—'}</span>,
    },
    {
      key: 'addressCity', header: 'City', width: 'w-36',
      render: row => <span style={{ color: 'var(--muted)', fontSize: 12 }}>{row.addressCity ?? '—'}</span>,
    },
    {
      key: 'isActive', header: 'Status', width: 'w-28',
      render: row => <StatusBadge value={row.isActive ? 'active' : 'inactive'} />,
    },
  ]

  const rowActions = row => {
    const acts = [{ label: 'Edit', onClick: openEdit }]
    if ((isAdmin || isRep) && row.isActive)
      acts.push({ label: 'Deactivate', onClick: r => setConfirmRow(r), danger: true })
    return acts
  }

  return (
    <Layout>
      {/* Transparent background to show the starfield */}
      <div style={{ padding: '1.5rem', minHeight: '100vh', background: 'transparent' }}>
        <PageHeader
          title="Colleges"
          subtitle={`${total} institutions`}
          action={
            (isAdmin || isRep) && (
              <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">+ Add College</button>
            )
          }
        />

        <div className="mb-5">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search colleges…" className="max-w-xs" />
        </div>

        <DataTable columns={columns} rows={items} actions={rowActions}
          keyField="collegeId" loading={loading}
          emptyNode={<EmptyState icon="🏫" title="No colleges found" />} />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      <FormModal open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit College' : 'Add College'} onSave={handleSave} saving={saving}>
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

        <Field label="College Name" required>
          <input className="input" value={form.collegeName}
            onChange={e => setForm(f => ({ ...f, collegeName: e.target.value }))}
            placeholder="e.g. Government Arts College" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="College Type">
            <Select value={form.collegeType} onChange={v => setForm(f => ({ ...f, collegeType: v }))}>
              <option value="Arts">Arts</option>
              <option value="Science">Science</option>
              <option value="Engineering">Engineering</option>
              <option value="Medical">Medical</option>
              <option value="Law">Law</option>
            </Select>
          </Field>
          <Field label="Region" required>
            <Select value={form.regionId} onChange={v => setForm(f => ({ ...f, regionId: v }))}>
              <option value="">Select region</option>
              {regions.map(r => (
                <option key={r.regionId} value={r.regionId}>{r.regionName}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Affiliated University">
          <input className="input" value={form.affiliatedUniversity}
            onChange={e => setForm(f => ({ ...f, affiliatedUniversity: e.target.value }))}
            placeholder="e.g. University of Madras" />
        </Field>

        <Field label="Address Street">
          <input className="input" value={form.addressStreet}
            onChange={e => setForm(f => ({ ...f, addressStreet: e.target.value }))}
            placeholder="123 College Road" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input className="input" value={form.addressCity}
              onChange={e => setForm(f => ({ ...f, addressCity: e.target.value }))}
              placeholder="Chennai" />
          </Field>
          <Field label="District">
            <input className="input" value={form.addressDistrict}
              onChange={e => setForm(f => ({ ...f, addressDistrict: e.target.value }))}
              placeholder="Chennai" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <input className="input" value={form.addressState}
              onChange={e => setForm(f => ({ ...f, addressState: e.target.value }))}
              placeholder="Tamil Nadu" />
          </Field>
          <Field label="PIN Code">
            <input className="input" value={form.addressPin}
              onChange={e => setForm(f => ({ ...f, addressPin: e.target.value }))}
              placeholder="600001" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className="input" type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="044-12345678" />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="college@edu.in" />
          </Field>
        </div>
      </FormModal>

      <ConfirmDialog open={Boolean(confirmRow)} title="Deactivate College"
        message={`Deactivate "${confirmRow?.collegeName}"?`}
        onConfirm={() => handleDeactivate(confirmRow)} onCancel={() => setConfirmRow(null)} />
    </Layout>
  )
}
