import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field, Select } from '../components/FormModal'
import {
  PageHeader, StatusBadge, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog,
} from '../components/ui'
import { coursesApi } from '../api/academic'
import { collegesApi, departmentsApi } from '../api/master'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = {
  courseName: '', courseType: 'UG', durationYears: '3',
  collegeId: '', deptId: '', affiliatedUniversity: '',
}

export default function Courses() {
  const { hasRole } = useAuth()
  const isAdmin     = hasRole('admin')

  const [items,         setItems]         = useState([])
  const [total,         setTotal]         = useState(0)
  const [page,          setPage]          = useState(1)
  const [pages,         setPages]         = useState(1)
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [filterCollege, setFilterCollege] = useState('')
  const [filterDept,    setFilterDept]    = useState('')
  const [filterType,    setFilterType]    = useState('')
  const debouncedSearch = useDebounce(search, 350)

  const [colleges, setColleges] = useState([])
  const [depts,    setDepts]    = useState([])
  const [formDepts,setFormDepts]= useState([])   // depts for form dropdown

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [confirmRow, setConfirmRow] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await coursesApi.list({
        page, pageSize: 20,
        search:     debouncedSearch || undefined,
        collegeId:  filterCollege   || undefined,
        deptId:     filterDept      || undefined,
        courseType: filterType      || undefined,
      })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, debouncedSearch, filterCollege, filterDept, filterType])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { collegesApi.listAll().then(r => setColleges(r.data)) }, [])

  useEffect(() => {
    if (!filterCollege) { setDepts([]); return }
    departmentsApi.listAll({ collegeId: filterCollege }).then(r => setDepts(r.data))
  }, [filterCollege])

  useEffect(() => {
    if (!form.collegeId) { setFormDepts([]); return }
    departmentsApi.listAll({ collegeId: form.collegeId }).then(r => setFormDepts(r.data))
  }, [form.collegeId])

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      courseName:           row.courseName,
      courseType:           row.courseType,
      durationYears:        String(row.durationYears),
      collegeId:            String(row.collegeId),
      deptId:               String(row.deptId),
      affiliatedUniversity: row.affiliatedUniversity ?? '',
    })
    setFormError(''); setDrawerOpen(true)
  }

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'collegeId') setForm(f => ({ ...f, collegeId: v, deptId: '' }))
  }

  async function handleSave() {
    if (!form.courseName.trim()) { setFormError('Course name is required'); return }
    if (!form.collegeId)         { setFormError('College is required'); return }
    if (!form.deptId)            { setFormError('Department is required'); return }
    setFormError(''); setSaving(true)
    try {
      const payload = {
        courseName:           form.courseName,
        courseType:           form.courseType,
        durationYears:        Number(form.durationYears),
        collegeId:            Number(form.collegeId),
        deptId:               Number(form.deptId),
        affiliatedUniversity: form.affiliatedUniversity || undefined,
      }
      editing
        ? await coursesApi.update(editing.courseId, payload)
        : await coursesApi.create(payload)
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  // Course type badge styles using theme variables
  const courseTypeStyle = (type) => {
    if (type === 'UG') return { bg: 'var(--course-type-ug-bg)', text: 'var(--course-type-ug-text)', border: 'var(--course-type-ug-border)' }
    if (type === 'PG') return { bg: 'var(--course-type-pg-bg)', text: 'var(--course-type-pg-text)', border: 'var(--course-type-pg-border)' }
    return { bg: 'var(--course-type-other-bg)', text: 'var(--course-type-other-text)', border: 'var(--course-type-other-border)' }
  }

  const columns = [
    {
      key: 'courseName', header: 'Course', sortable: true,
      render: row => (
        <div>
          <p style={{ color: 'var(--text)', fontWeight: 500 }}>{row.courseName}</p>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>
            {row.college?.collegeName} · {row.department?.deptName}
          </p>
        </div>
      ),
    },
    {
      key: 'courseType', header: 'Type', width: 'w-24',
      render: row => {
        const s = courseTypeStyle(row.courseType)
        return (
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: s.bg, color: s.text, border: `1px solid ${s.border}`,
          }}>
            {row.courseType}
          </span>
        )
      },
    },
    {
      key: 'durationYears', header: 'Duration', width: 'w-28',
      render: row => <span style={{ color: 'var(--muted)', fontSize: 12 }}>{row.durationYears} yr{row.durationYears > 1 ? 's' : ''}</span>,
    },
    {
      key: 'subjectCount', header: 'Subjects', width: 'w-24',
      render: row => <span style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{row.subjectCount}</span>,
    },
    {
      key: 'isActive', header: 'Status', width: 'w-24',
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
      {/* Transparent background – shows ambient starfield */}
      <div style={{ padding: '1.5rem', minHeight: '100vh', background: 'transparent' }}>
        <PageHeader title="Courses" subtitle={`${total} programmes`}
          action={<button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">+ Add Course</button>} />

        <div className="flex flex-wrap gap-3 mb-5">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search courses…" className="flex-1 min-w-[180px] max-w-xs" />
          <select value={filterCollege} onChange={e => { setFilterCollege(e.target.value); setFilterDept(''); setPage(1) }}
            className="input w-52 text-sm">
            <option value="">All colleges</option>
            {colleges.map(c => <option key={c.collegeId} value={c.collegeId}>{c.collegeName}</option>)}
          </select>
          {depts.length > 0 && (
            <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1) }}
              className="input w-44 text-sm">
              <option value="">All departments</option>
              {depts.map(d => <option key={d.deptId} value={d.deptId}>{d.deptName}</option>)}
            </select>
          )}
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
            className="input w-32 text-sm">
            <option value="">All types</option>
            <option value="UG">UG</option>
            <option value="PG">PG</option>
            <option value="Diploma">Diploma</option>
          </select>
        </div>

        <DataTable columns={columns} rows={items} actions={rowActions}
          keyField="courseId" loading={loading}
          emptyNode={<EmptyState icon="🎓" title="No courses found" />} />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      <FormModal open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Course' : 'Add Course'} onSave={handleSave} saving={saving}>
        {formError && (
          <div style={{
            background: 'var(--error-bg)', border: '1px solid var(--error-border)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            color: 'var(--error-text)', fontSize: 13,
          }}>
            {formError}
          </div>
        )}
        <Field label="College" required>
          <Select value={form.collegeId} onChange={v => setField('collegeId', v)}>
            <option value="">Select college</option>
            {colleges.map(c => <option key={c.collegeId} value={c.collegeId}>{c.collegeName}</option>)}
          </Select>
        </Field>
        <Field label="Department" required>
          <Select value={form.deptId} onChange={v => setField('deptId', v)} disabled={!form.collegeId}>
            <option value="">Select department</option>
            {formDepts.map(d => <option key={d.deptId} value={d.deptId}>{d.deptName}</option>)}
          </Select>
        </Field>
        <Field label="Course Name" required>
          <input className="input" value={form.courseName}
            onChange={e => setField('courseName', e.target.value)}
            placeholder="e.g. B.Com, B.E. Computer Science" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <Select value={form.courseType} onChange={v => setField('courseType', v)}>
              <option value="UG">UG</option>
              <option value="PG">PG</option>
              <option value="Diploma">Diploma</option>
            </Select>
          </Field>
          <Field label="Duration (years)" required>
            <input className="input" type="number" min="1" max="6" value={form.durationYears}
              onChange={e => setField('durationYears', e.target.value)} />
          </Field>
        </div>
        <Field label="Affiliated University">
          <input className="input" value={form.affiliatedUniversity}
            onChange={e => setField('affiliatedUniversity', e.target.value)}
            placeholder="Overrides college default if set" />
        </Field>
      </FormModal>

      <ConfirmDialog open={Boolean(confirmRow)} title="Deactivate Course"
        message={`Deactivate "${confirmRow?.courseName}"? All subjects under this course will be hidden.`}
        onConfirm={async () => { await coursesApi.deactivate(confirmRow.courseId); setConfirmRow(null); fetchItems() }}
        onCancel={() => setConfirmRow(null)} />
    </Layout>
  )
}
