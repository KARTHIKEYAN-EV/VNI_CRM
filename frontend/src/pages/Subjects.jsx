import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field, Select } from '../components/FormModal'
import {
  PageHeader, StatusBadge, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog,
} from '../components/ui'
import { subjectsApi } from '../api/academic'
import { collegesApi, departmentsApi } from '../api/master'
import { coursesApi } from '../api/academic'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = {
  subjectName: '', subjectCode: '', semesterYear: '',
  subjectType: 'Core', courseId: '',
}

const TYPE_STYLE = {
  Core:     'bg-blue-950/50 text-blue-400',
  Elective: 'bg-purple-950/50 text-purple-400',
  Lab:      'bg-emerald-950/50 text-emerald-400',
}

export default function Subjects() {
  const { hasRole } = useAuth()
  const isAdmin     = hasRole('admin')

  const [items,        setItems]        = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [pages,        setPages]        = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const debouncedSearch = useDebounce(search, 350)

  // For filter dropdowns
  const [colleges,       setColleges]       = useState([])
  const [filterCollege,  setFilterCollege]  = useState('')
  const [filterDept,     setFilterDept]     = useState('')
  const [depts,          setDepts]          = useState([])
  const [courses,        setCourses]        = useState([])

  // Form state
  const [formCollegeId, setFormCollegeId] = useState('')
  const [formDepts,     setFormDepts]     = useState([])
  const [formDeptId,    setFormDeptId]    = useState('')
  const [formCourses,   setFormCourses]   = useState([])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [confirmRow, setConfirmRow] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await subjectsApi.list({
        page, pageSize: 20,
        search:      debouncedSearch || undefined,
        courseId:    filterCourse    || undefined,
        subjectType: filterType      || undefined,
      })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, debouncedSearch, filterCourse, filterType])

  useEffect(() => { fetchItems() }, [fetchItems])

  // Cascading filter dropdowns
  useEffect(() => { collegesApi.listAll().then(r => setColleges(r.data)) }, [])
  useEffect(() => {
    if (!filterCollege) { setDepts([]); setCourses([]); return }
    departmentsApi.listAll({ collegeId: filterCollege }).then(r => setDepts(r.data))
    setCourses([])
  }, [filterCollege])
  useEffect(() => {
    if (!filterDept) { setCourses([]); return }
    coursesApi.listAll({ deptId: filterDept }).then(r => setCourses(r.data))
  }, [filterDept])

  // Cascading form dropdowns
  useEffect(() => {
    if (!formCollegeId) { setFormDepts([]); setFormDeptId(''); setFormCourses([]); return }
    departmentsApi.listAll({ collegeId: formCollegeId }).then(r => setFormDepts(r.data))
  }, [formCollegeId])
  useEffect(() => {
    if (!formDeptId) { setFormCourses([]); return }
    coursesApi.listAll({ deptId: formDeptId }).then(r => setFormCourses(r.data))
  }, [formDeptId])

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM)
    setFormCollegeId(''); setFormDeptId('')
    setFormError(''); setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      subjectName:  row.subjectName,
      subjectCode:  row.subjectCode  ?? '',
      semesterYear: row.semesterYear ?? '',
      subjectType:  row.subjectType,
      courseId:     String(row.courseId),
    })
    // Pre-populate the cascading form dropdowns from the existing record
    // so the course dropdown shows the full list for that course's dept/college
    if (row.course?.collegeId || row.course?.deptId) {
      const cid = String(row.course.collegeId ?? '')
      const did = String(row.course.deptId    ?? '')
      setFormCollegeId(cid)
      setFormDeptId(did)
    }
    setFormError(''); setDrawerOpen(true)
  }

  async function handleSave() {
    if (!form.subjectName.trim()) { setFormError('Subject name is required'); return }
    if (!form.courseId)           { setFormError('Course is required'); return }
    setFormError(''); setSaving(true)
    try {
      const payload = {
        subjectName:  form.subjectName,
        subjectCode:  form.subjectCode  || undefined,
        semesterYear: form.semesterYear || undefined,
        subjectType:  form.subjectType,
        courseId:     Number(form.courseId),
      }
      editing
        ? await subjectsApi.update(editing.subjectId, payload)
        : await subjectsApi.create(payload)
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  const columns = [
    {
      key: 'subjectName', header: 'Subject', sortable: true,
      render: row => (
        <div>
          <p className="text-white font-medium">{row.subjectName}</p>
          <p className="text-gray-500 text-xs">
            {row.course?.courseName ?? '—'}
            {row.semesterYear ? ` · ${row.semesterYear}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'subjectCode', header: 'Code', width: 'w-32',
      render: row => <span className="text-gray-500 text-xs font-mono">{row.subjectCode ?? '—'}</span>,
    },
    {
      key: 'subjectType', header: 'Type', width: 'w-28',
      render: row => (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${TYPE_STYLE[row.subjectType] ?? 'bg-gray-900 text-gray-400'}`}>
          {row.subjectType}
        </span>
      ),
    },
    {
      key: 'syllabusCount', header: 'Syllabi', width: 'w-24',
      render: row => <span className="text-gray-400 text-xs font-mono">{row.syllabusCount}</span>,
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
      <div className="p-6">
        <PageHeader title="Subjects" subtitle={`${total} papers`}
          action={<button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">+ Add Subject</button>} />

        <div className="flex flex-wrap gap-3 mb-5">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search subjects…" className="flex-1 min-w-[180px] max-w-xs" />
          <select value={filterCollege}
            onChange={e => { setFilterCollege(e.target.value); setFilterDept(''); setFilterCourse(''); setPage(1) }}
            className="input w-52 text-sm">
            <option value="">All colleges</option>
            {colleges.map(c => <option key={c.collegeId} value={c.collegeId}>{c.collegeName}</option>)}
          </select>
          {depts.length > 0 && (
            <select value={filterDept}
              onChange={e => { setFilterDept(e.target.value); setFilterCourse(''); setPage(1) }}
              className="input w-44 text-sm">
              <option value="">All depts</option>
              {depts.map(d => <option key={d.deptId} value={d.deptId}>{d.deptName}</option>)}
            </select>
          )}
          {courses.length > 0 && (
            <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setPage(1) }}
              className="input w-44 text-sm">
              <option value="">All courses</option>
              {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.courseName}</option>)}
            </select>
          )}
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
            className="input w-36 text-sm">
            <option value="">All types</option>
            <option value="Core">Core</option>
            <option value="Elective">Elective</option>
            <option value="Lab">Lab</option>
          </select>
        </div>

        <DataTable columns={columns} rows={items} actions={rowActions}
          keyField="subjectId" loading={loading}
          emptyNode={<EmptyState icon="📖" title="No subjects found"
            subtitle="Select a course above or add a new subject" />} />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      <FormModal open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Subject' : 'Add Subject'} onSave={handleSave} saving={saving}>
        {formError && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">{formError}</div>
        )}

        {/* Cascading selects — college → dept → course (shown for both create and edit) */}
        <Field label="College" required>
          <Select value={formCollegeId} onChange={v => { setFormCollegeId(v); setFormDeptId('') }}>
            <option value="">Select college</option>
            {colleges.map(c => <option key={c.collegeId} value={c.collegeId}>{c.collegeName}</option>)}
          </Select>
        </Field>
        <Field label="Department" required>
          <Select value={formDeptId} onChange={setFormDeptId} disabled={!formCollegeId}>
            <option value="">Select department</option>
            {formDepts.map(d => <option key={d.deptId} value={d.deptId}>{d.deptName}</option>)}
          </Select>
        </Field>

        <Field label="Course" required>
          <Select value={form.courseId} onChange={v => setForm(f => ({ ...f, courseId: v }))}
            disabled={!formDeptId}>
            <option value="">Select course</option>
            {formCourses.map(c =>
              <option key={c.courseId} value={c.courseId}>{c.courseName}</option>)}
          </Select>
        </Field>

        <Field label="Subject Name" required>
          <input className="input" value={form.subjectName}
            onChange={e => setForm(f => ({ ...f, subjectName: e.target.value }))}
            placeholder="e.g. Financial Accounting" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject Code">
            <input className="input" value={form.subjectCode}
              onChange={e => setForm(f => ({ ...f, subjectCode: e.target.value }))}
              placeholder="e.g. BC301" />
          </Field>
          <Field label="Semester / Year">
            <input className="input" value={form.semesterYear}
              onChange={e => setForm(f => ({ ...f, semesterYear: e.target.value }))}
              placeholder="e.g. Semester 3" />
          </Field>
        </div>

        <Field label="Type" required>
          <Select value={form.subjectType} onChange={v => setForm(f => ({ ...f, subjectType: v }))}>
            <option value="Core">Core</option>
            <option value="Elective">Elective</option>
            <option value="Lab">Lab</option>
          </Select>
        </Field>
      </FormModal>

      <ConfirmDialog open={Boolean(confirmRow)} title="Deactivate Subject"
        message={`Deactivate "${confirmRow?.subjectName}"?`}
        onConfirm={async () => { await subjectsApi.deactivate(confirmRow.subjectId); setConfirmRow(null); fetchItems() }}
        onCancel={() => setConfirmRow(null)} />
    </Layout>
  )
}
