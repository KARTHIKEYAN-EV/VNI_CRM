import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field, Select } from '../components/FormModal'
import {
  PageHeader, StatusBadge, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog, DuplicateWarning, Spinner,
} from '../components/ui'
import { collegesApi, regionsApi } from '../api/master'
import { exportApi, importApi } from '../api/importExport'
import CsvImportExport from '../components/CsvImportExport'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = {
  collegeName: '', collegeType: 'Engineering', regionId: '',
  affiliatedUniversity: '', addressCity: '', addressDistrict: '',
  addressState: 'Tamil Nadu', addressPin: '', phone: '', email: '',
}

export default function Colleges() {
  const { hasRole } = useAuth()
  const isAdmin     = hasRole('admin')

  // List state
  const [items,     setItems]     = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [pages,     setPages]     = useState(1)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterDQF, setFilterDQF] = useState('')
  const debouncedSearch = useDebounce(search, 350)

  // Regions for dropdown
  const [regions, setRegions] = useState([])

  // Form / modal
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [editing,     setEditing]     = useState(null)   // null = create
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState('')

  // Duplicate check
  const [dupMatches,  setDupMatches]  = useState([])
  const [dupChecked,  setDupChecked]  = useState(false)

  // Confirm deactivate
  const [confirmRow,  setConfirmRow]  = useState(null)

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await collegesApi.list({
        page, pageSize: 20,
        search: debouncedSearch || undefined,
        dqFlag: filterDQF || undefined,
      })
      setItems(data.items)
      setTotal(data.total)
      setPages(data.pages)
    } catch { /* handled by axios interceptor */ }
    finally { setLoading(false) }
  }, [page, debouncedSearch, filterDQF])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    regionsApi.listAll().then(r => setRegions(r.data))
  }, [])

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------
  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setDupMatches([])
    setDupChecked(false)
    setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      collegeName:          row.collegeName,
      collegeType:          row.collegeType,
      regionId:             String(row.regionId),
      affiliatedUniversity: row.affiliatedUniversity ?? '',
      addressCity:          row.addressCity          ?? '',
      addressDistrict:      row.addressDistrict       ?? '',
      addressState:         row.addressState          ?? 'Tamil Nadu',
      addressPin:           row.addressPin            ?? '',
      phone:                row.phone                 ?? '',
      email:                row.email                 ?? '',
    })
    setFormError('')
    setDupMatches([])
    setDupChecked(false)
    setDrawerOpen(true)
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    if (key === 'collegeName') { setDupChecked(false); setDupMatches([]) }
  }

  async function handleCheckDuplicate() {
    if (!form.collegeName.trim()) return
    try {
      const { data } = await collegesApi.checkDuplicate({
        collegeName: form.collegeName,
        collegeType: form.collegeType,
        regionId:    Number(form.regionId) || 1,
        addressCity: form.addressCity,
      })
      setDupMatches(data.matches)
      setDupChecked(true)
    } catch {}
  }

  async function handleSave() {
    if (!form.collegeName.trim()) { setFormError('College name is required'); return }
    if (!form.regionId)           { setFormError('Region is required'); return }
    if (!dupChecked && !editing)  {
      await handleCheckDuplicate()
      return  // let user review duplicates before final save
    }
    setFormError('')
    setSaving(true)
    try {
      const payload = {
        collegeName:          form.collegeName,
        collegeType:          form.collegeType,
        regionId:             Number(form.regionId),
        affiliatedUniversity: form.affiliatedUniversity || undefined,
        addressCity:          form.addressCity          || undefined,
        addressDistrict:      form.addressDistrict      || undefined,
        addressState:         form.addressState,
        addressPin:           form.addressPin           || undefined,
        phone:                form.phone                || undefined,
        email:                form.email                || undefined,
      }
      if (editing) {
        await collegesApi.update(editing.collegeId, payload)
      } else {
        await collegesApi.create(payload)
      }
      setDrawerOpen(false)
      fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(row) {
    try {
      await collegesApi.deactivate(row.collegeId)
      setConfirmRow(null)
      fetchItems()
    } catch {}
  }

  async function handleApprove(row) {
    try {
      await collegesApi.approve(row.collegeId)
      fetchItems()
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------
  const columns = [
    {
      key: 'collegeName', header: 'College', sortable: true,
      render: row => (
        <div>
          <p className="text-white font-medium">{row.collegeName}</p>
          <p className="text-gray-500 text-xs">{row.addressCity}{row.addressDistrict ? ` · ${row.addressDistrict}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'collegeType', header: 'Type', sortable: true, width: 'w-36',
      render: row => <span className="text-gray-400 text-xs">{row.collegeType}</span>,
    },
    {
      key: 'region', header: 'Region', width: 'w-36',
      render: row => <span className="text-gray-400 text-xs">{row.region?.regionName ?? '—'}</span>,
    },
    {
      key: 'dataQualityFlag', header: 'Status', width: 'w-36',
      render: row => <StatusBadge value={row.dataQualityFlag} />,
    },
    {
      key: 'isActive', header: 'Active', width: 'w-24',
      render: row => <StatusBadge value={row.isActive ? 'active' : 'inactive'} />,
    },
  ]

  const rowActions = row => {
    const acts = [{ label: 'Edit', onClick: openEdit }]
    if (isAdmin && row.dataQualityFlag === 'PENDING_REVIEW') {
      acts.push({ label: 'Approve', onClick: handleApprove })
    }
    if (isAdmin && row.isActive) {
      acts.push({ label: 'Deactivate', onClick: r => setConfirmRow(r), danger: true })
    }
    return acts
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Layout>
      <div className="p-6">
        <PageHeader
          title="Colleges"
          subtitle={`${total} total`}
          action={
            <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">
              + Add College
            </button>
          }
        />

        {isAdmin && (
          <CsvImportExport
            entityLabel="Colleges"
            onExport={exportApi.colleges}
            onImport={async (file) => { const r = await importApi.colleges(file); fetchItems(); return r }}
            templateHeaders={['college_name', 'college_type', 'region_name', 'affiliated_university', 'address_city', 'address_district', 'address_state', 'address_pin', 'phone', 'email']}
          />
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <SearchInput
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search colleges…"
            className="flex-1 min-w-[200px] max-w-xs"
          />
          <select
            value={filterDQF}
            onChange={e => { setFilterDQF(e.target.value); setPage(1) }}
            className="input w-48 text-sm"
          >
            <option value="">All statuses</option>
            <option value="VERIFIED">Verified only</option>
            <option value="PENDING_REVIEW">Pending review</option>
          </select>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          rows={items}
          actions={rowActions}
          keyField="collegeId"
          loading={loading}
          emptyNode={
            <EmptyState
              icon="🏫"
              title="No colleges found"
              subtitle={search ? 'Try a different search term' : 'Add your first college to get started'}
            />
          }
        />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      {/* Form drawer */}
      <FormModal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit College' : 'Add College'}
        subtitle={!editing ? 'Fields marked * are required' : undefined}
        onSave={handleSave}
        saving={saving}
      >
        <DuplicateWarning matches={dupMatches} onDismiss={() => setDupMatches([])} />
        {formError && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
            {formError}
          </div>
        )}

        <Field label="College Name" required>
          <input
            className="input"
            value={form.collegeName}
            onChange={e => setField('collegeName', e.target.value)}
            placeholder="e.g. Sri Ramakrishna College of Arts & Science"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <Select value={form.collegeType} onChange={v => setField('collegeType', v)}>
              <option value="Engineering">Engineering</option>
              <option value="Arts&Science">Arts &amp; Science</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
          <Field label="Region" required>
            <Select value={form.regionId} onChange={v => setField('regionId', v)}>
              <option value="">Select region</option>
              {regions.map(r => (
                <option key={r.regionId} value={r.regionId}>{r.regionName}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Affiliated University">
          <input className="input" value={form.affiliatedUniversity}
            onChange={e => setField('affiliatedUniversity', e.target.value)}
            placeholder="e.g. Anna University" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input className="input" value={form.addressCity}
              onChange={e => setField('addressCity', e.target.value)} placeholder="City" />
          </Field>
          <Field label="District">
            <input className="input" value={form.addressDistrict}
              onChange={e => setField('addressDistrict', e.target.value)} placeholder="District" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className="input" value={form.phone}
              onChange={e => setField('phone', e.target.value)} placeholder="044-XXXXXXX" />
          </Field>
          <Field label="Email">
            <input className="input" value={form.email} type="email"
              onChange={e => setField('email', e.target.value)} placeholder="principal@college.edu" />
          </Field>
        </div>

        {!editing && !dupChecked && form.collegeName.trim() && (
          <button
            onClick={handleCheckDuplicate}
            className="w-full py-2 rounded-xl text-xs text-amber-400 border border-amber-800/50 hover:bg-amber-950/30 transition-all mt-1"
          >
            Check for duplicates before saving
          </button>
        )}
      </FormModal>

      {/* Confirm deactivate */}
      <ConfirmDialog
        open={Boolean(confirmRow)}
        title="Deactivate College"
        message={`Deactivate "${confirmRow?.collegeName}"? The record will be hidden but not deleted.`}
        onConfirm={() => handleDeactivate(confirmRow)}
        onCancel={() => setConfirmRow(null)}
      />
    </Layout>
  )
}
