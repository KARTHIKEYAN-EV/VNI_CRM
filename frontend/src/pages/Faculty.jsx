import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field, Select } from '../components/FormModal'
import {
  PageHeader, StatusBadge, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog, DuplicateWarning,
} from '../components/ui'
import { facultyApi, collegesApi, departmentsApi } from '../api/master'
import { exportApi, importApi } from '../api/importExport'
import CsvImportExport        from '../components/CsvImportExport'
import SendNewRequestModal    from '../components/SendNewRequestModal'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = {
  facultyName: '', collegeId: '', deptId: '', designation: '',
  phonePersonal: '', phoneWhatsapp: '', email: '', altAddress: '',
}

export default function Faculty() {
  const { hasRole } = useAuth()
  const isAdmin     = hasRole('admin')

  const [items,   setItems]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filterDQF,   setFilterDQF]   = useState('')
  const [filterCollege, setFilterCollege] = useState('')
  const debouncedSearch = useDebounce(search, 350)

  const [colleges, setColleges] = useState([])
  const [depts,    setDepts]    = useState([])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [dupMatches, setDupMatches] = useState([])
  const [dupChecked, setDupChecked] = useState(false)
  const [confirmRow, setConfirmRow] = useState(null)
  const [newRequestFaculty, setNewRequestFaculty] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await facultyApi.list({
        page, pageSize: 20,
        search:    debouncedSearch || undefined,
        dqFlag:    filterDQF      || undefined,
        collegeId: filterCollege  || undefined,
      })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, debouncedSearch, filterDQF, filterCollege])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => {
    collegesApi.listAll().then(r => setColleges(r.data))
  }, [])

  // Load departments when college changes in form
  useEffect(() => {
    if (!form.collegeId) { setDepts([]); return }
    departmentsApi.listAll({ collegeId: form.collegeId })
      .then(r => setDepts(r.data))
  }, [form.collegeId])

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM)
    setFormError(''); setDupMatches([]); setDupChecked(false)
    setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      facultyName:   row.facultyName,
      collegeId:     String(row.collegeId),
      deptId:        String(row.deptId),
      designation:   row.designation    ?? '',
      phonePersonal: row.phonePersonal  ?? '',
      phoneWhatsapp: row.phoneWhatsapp  ?? '',
      email:         row.email          ?? '',
      altAddress:    row.altAddress     ?? '',
    })
    setFormError(''); setDupMatches([]); setDupChecked(false)
    setDrawerOpen(true)
  }

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'facultyName') { setDupChecked(false); setDupMatches([]) }
    if (k === 'collegeId')   { setForm(f => ({ ...f, collegeId: v, deptId: '' })) }
  }

  async function handleCheckDuplicate() {
    if (!form.facultyName.trim()) return
    const { data } = await facultyApi.checkDuplicate({
      facultyName: form.facultyName,
      collegeId:   Number(form.collegeId) || undefined,
      deptId:      Number(form.deptId)    || undefined,
    })
    setDupMatches(data.matches); setDupChecked(true)
  }

  async function handleSave() {
    if (!form.facultyName.trim()) { setFormError('Faculty name is required'); return }
    if (!form.collegeId)          { setFormError('College is required'); return }
    if (!form.deptId)             { setFormError('Department is required'); return }
    if (!dupChecked && !editing)  { await handleCheckDuplicate(); return }
    setFormError(''); setSaving(true)
    try {
      const payload = {
        facultyName:   form.facultyName,
        collegeId:     Number(form.collegeId),
        deptId:        Number(form.deptId),
        designation:   form.designation   || undefined,
        phonePersonal: form.phonePersonal || undefined,
        phoneWhatsapp: form.phoneWhatsapp || undefined,
        email:         form.email         || undefined,
        altAddress:    form.altAddress    || undefined,
      }
      editing
        ? await facultyApi.update(editing.facultyId, payload)
        : await facultyApi.create(payload)
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  async function handleDeactivate(row) {
    await facultyApi.deactivate(row.facultyId)
    setConfirmRow(null); fetchItems()
  }

  async function handleApprove(row) {
    await facultyApi.approve(row.facultyId); fetchItems()
  }

  const columns = [
    {
      key: 'facultyName', header: 'Faculty', sortable: true,
      render: row => (
        <div>
          <p className="text-white font-medium">{row.facultyName}</p>
          <p className="text-gray-500 text-xs">{row.designation ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'college', header: 'College',
      render: row => <span className="text-gray-400 text-xs">{row.college?.collegeName ?? '—'}</span>,
    },
    {
      key: 'department', header: 'Department', width: 'w-40',
      render: row => <span className="text-gray-400 text-xs">{row.department?.deptName ?? '—'}</span>,
    },
    {
      key: 'phonePersonal', header: 'Phone', width: 'w-36',
      render: row => <span className="text-gray-400 text-xs font-mono">{row.phonePersonal ?? '—'}</span>,
    },
    {
      key: 'dataQualityFlag', header: 'Status', width: 'w-36',
      render: row => <StatusBadge value={row.dataQualityFlag} />,
    },
  ]

  const rowActions = row => {
    const acts = [
      { label: 'Edit',                onClick: openEdit },
      { label: 'Request', onClick: r => setNewRequestFaculty(r) },
    ]
    if (isAdmin && row.dataQualityFlag === 'PENDING_REVIEW')
      acts.push({ label: 'Approve', onClick: handleApprove })
    if (isAdmin && row.isActive)
      acts.push({ label: 'Deactivate', onClick: r => setConfirmRow(r), danger: true })
    return acts
  }

  return (
    <Layout>
      <div className="p-6">
        <PageHeader
          title="Faculty"
          subtitle={`${total} members`}
          action={<button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">+ Add Faculty</button>}
        />

        {isAdmin && (
          <CsvImportExport
            entityLabel="Faculty"
            onExport={() => exportApi.faculty(filterCollege || undefined)}
            onImport={async (file) => { const r = await importApi.faculty(file); fetchItems(); return r }}
            templateHeaders={['faculty_name', 'college_name', 'dept_name', 'designation', 'phone_personal', 'phone_whatsapp', 'email', 'alt_address']}
          />
        )}

        <div className="flex flex-wrap gap-3 mb-5">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search faculty…" className="flex-1 min-w-[200px] max-w-xs" />
          <select value={filterCollege} onChange={e => { setFilterCollege(e.target.value); setPage(1) }}
            className="input w-52 text-sm">
            <option value="">All colleges</option>
            {colleges.map(c => <option key={c.collegeId} value={c.collegeId}>{c.collegeName}</option>)}
          </select>
          <select value={filterDQF} onChange={e => { setFilterDQF(e.target.value); setPage(1) }}
            className="input w-44 text-sm">
            <option value="">All statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING_REVIEW">Pending review</option>
          </select>
        </div>

        <DataTable columns={columns} rows={items} actions={rowActions}
          keyField="facultyId" loading={loading}
          emptyNode={<EmptyState icon="👤" title="No faculty found" />} />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      <FormModal open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Faculty' : 'Add Faculty'} onSave={handleSave} saving={saving}>
        <DuplicateWarning matches={dupMatches} onDismiss={() => setDupMatches([])} />
        {formError && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
            {formError}
          </div>
        )}
        <Field label="Full Name" required>
          <input className="input" value={form.facultyName}
            onChange={e => setField('facultyName', e.target.value)} placeholder="Dr. / Mr. / Ms." />
        </Field>
        <Field label="College" required>
          <Select value={form.collegeId} onChange={v => setField('collegeId', v)}>
            <option value="">Select college</option>
            {colleges.map(c => <option key={c.collegeId} value={c.collegeId}>{c.collegeName}</option>)}
          </Select>
        </Field>
        <Field label="Department" required>
          <Select value={form.deptId} onChange={v => setField('deptId', v)} disabled={!form.collegeId}>
            <option value="">Select department</option>
            {depts.map(d => <option key={d.deptId} value={d.deptId}>{d.deptName}</option>)}
          </Select>
        </Field>
        <Field label="Designation">
          <Select value={form.designation} onChange={v => setField('designation', v)}>
            <option value="">Select…</option>
            {['Professor', 'Asst. Professor', 'HOD', 'Principal', 'Other'].map(d =>
              <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mobile">
            <input className="input" value={form.phonePersonal}
              onChange={e => setField('phonePersonal', e.target.value)} placeholder="9XXXXXXXXX" />
          </Field>
          <Field label="WhatsApp">
            <input className="input" value={form.phoneWhatsapp}
              onChange={e => setField('phoneWhatsapp', e.target.value)} placeholder="9XXXXXXXXX" />
          </Field>
        </div>
        <Field label="Email">
          <input className="input" type="email" value={form.email}
            onChange={e => setField('email', e.target.value)} placeholder="faculty@college.edu" />
        </Field>
        {!editing && !dupChecked && form.facultyName.trim() && (
          <button onClick={handleCheckDuplicate}
            className="w-full py-2 rounded-xl text-xs text-amber-400 border border-amber-800/50 hover:bg-amber-950/30 transition-all mt-1">
            Check for duplicates before saving
          </button>
        )}
      </FormModal>

      <ConfirmDialog open={Boolean(confirmRow)} title="Deactivate Faculty"
        message={`Deactivate "${confirmRow?.facultyName}"?`}
        onConfirm={() => handleDeactivate(confirmRow)} onCancel={() => setConfirmRow(null)} />
      <SendNewRequestModal
        open={!!newRequestFaculty}
        onClose={() => setNewRequestFaculty(null)}
        faculty={newRequestFaculty}
      />
    </Layout>
  )
}
