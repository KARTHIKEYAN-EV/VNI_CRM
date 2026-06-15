import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import FormModal, { Field, Select } from '../components/FormModal'
import {
  PageHeader, EmptyState, PaginationBar,
  SearchInput, ConfirmDialog,
} from '../components/ui'
import { usersApi, regionsApi } from '../api/master'
import { useAuth } from '../auth/AuthContext'

const ROLES = [
  { value: 'rep',         label: 'Sales Rep' },
  { value: 'manager',     label: 'Regional Manager' },
  { value: 'ceo',         label: 'CEO' },
  { value: 'back_office', label: 'Back Office' },
  { value: 'admin',       label: 'System Admin' },
]

const ROLE_BADGE = {
  rep:         { label: 'Sales Rep',   color: 'bg-blue-900/40 text-blue-300 border-blue-800/40' },
  manager:     { label: 'Manager',     color: 'bg-purple-900/40 text-purple-300 border-purple-800/40' },
  ceo:         { label: 'CEO',         color: 'bg-amber-900/40 text-amber-300 border-amber-800/40' },
  back_office: { label: 'Back Office', color: 'bg-teal-900/40 text-teal-300 border-teal-800/40' },
  admin:       { label: 'Admin',       color: 'bg-red-900/40 text-red-300 border-red-800/40' },
}

const EMPTY_FORM = {
  fullName: '', email: '', password: '', role: 'rep',
  regionId: '', phone: '',
}

function RoleBadge({ role }) {
  const b = ROLE_BADGE[role] ?? { label: role, color: 'bg-gray-800 text-gray-400' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${b.color}`}>
      {b.label}
    </span>
  )
}

export default function Users() {
  const { user: me } = useAuth()

  const [items,   setItems]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filterRole,   setFilterRole]   = useState('')
  const [filterStatus, setFilterStatus] = useState('true')

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
      const { data } = await usersApi.list({
        page, pageSize: 20,
        search:    search    || undefined,
        role:      filterRole   || undefined,
        isActive:  filterStatus !== '' ? filterStatus : undefined,
      })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, search, filterRole, filterStatus])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => {
    regionsApi.listAll().then(r => setRegions(r.data)).catch(() => {})
  }, [])

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError('')
    setDrawerOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      fullName: row.fullName,
      email:    row.email,
      password: '',
      role:     row.role,
      regionId: row.regionId ? String(row.regionId) : '',
      phone:    row.phone ?? '',
    })
    setFormError('')
    setDrawerOpen(true)
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.fullName.trim()) { setFormError('Full name is required'); return }
    if (!form.email.trim())    { setFormError('Email is required'); return }
    if (!editing && !form.password) { setFormError('Password is required for new users'); return }
    setFormError(''); setSaving(true)
    try {
      if (editing) {
        // const payload = {
        //   fullName: form.fullName,
        //   role:     form.role,
        //   regionId: form.regionId ? Number(form.regionId) : null,
        //   phone:    form.phone || undefined,
        // }
        const payload = {
          fullName: form.fullName,
          role: form.role,
          regionId: form.regionId ? Number(form.regionId) : null,
          phone: form.phone || undefined,
          ...(form.password.trim()
            ? { password: form.password.trim() }
            : {}),
        }
        await usersApi.update(editing.userId, payload)
      } else {
        await usersApi.create({
          fullName: form.fullName,
          email:    form.email.toLowerCase().trim(),
          password: form.password,
          role:     form.role,
          regionId: form.regionId ? Number(form.regionId) : undefined,
          phone:    form.phone || undefined,
        })
      }
      setDrawerOpen(false); fetchItems()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  async function handleDeactivate(row) {
    await usersApi.deactivate(row.userId)
    setConfirmRow(null); fetchItems()
  }

  const columns = [
    {
      key: 'fullName', header: 'Name', sortable: true,
      render: row => (
        <div>
          <p className="text-white font-medium">{row.fullName}</p>
          <p className="text-gray-500 text-xs font-mono">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role', width: 'w-36',
      render: row => <RoleBadge role={row.role} />,
    },
    {
      key: 'region', header: 'Region', width: 'w-40',
      render: row => (
        <span className="text-gray-400 text-xs">{row.region?.regionName ?? '—'}</span>
      ),
    },
    {
      key: 'phone', header: 'Phone', width: 'w-36',
      render: row => (
        <span className="text-gray-400 text-xs font-mono">{row.phone ?? '—'}</span>
      ),
    },
    {
      key: 'isActive', header: 'Status', width: 'w-28',
      render: row => row.isActive
        ? <span className="text-emerald-400 text-xs font-medium">Active</span>
        : <span className="text-gray-600 text-xs">Inactive</span>,
    },
  ]

  const rowActions = row => {
    const acts = [{ label: 'Edit', onClick: openEdit }]
    if (row.userId !== me?.userId && row.isActive) {
      acts.push({ label: 'Deactivate', onClick: r => setConfirmRow(r), danger: true })
    }
    return acts
  }

  const needsRegion = ['rep', 'manager'].includes(form.role)

  return (
    <Layout>
      <div className="p-6">
        <PageHeader
          title="User Management"
          subtitle={`${total} user${total !== 1 ? 's' : ''}`}
          action={
            <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">
              + Add User
            </button>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <SearchInput
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search by name…"
            className="flex-1 min-w-[200px] max-w-xs"
          />
          <select
            value={filterRole}
            onChange={e => { setFilterRole(e.target.value); setPage(1) }}
            className="input w-44 text-sm"
          >
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="input w-36 text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="">All</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          rows={items}
          actions={rowActions}
          keyField="userId"
          loading={loading}
          emptyNode={<EmptyState icon="👥" title="No users found" />}
        />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>

      {/* Create / Edit modal */}
      <FormModal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit User' : 'Add User'}
        onSave={handleSave}
        saving={saving}
      >
        {formError && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
            {formError}
          </div>
        )}

        <Field label="Full Name" required>
          <input className="input" value={form.fullName}
            onChange={e => setField('fullName', e.target.value)}
            placeholder="First Last" />
        </Field>
        
        {!editing && (
          <Field label="Email" required>
            <input className="input" type="email" value={form.email}
              onChange={e => setField('email', e.target.value)}
              placeholder="user@vni.in" />
          </Field>
        )}

        {!editing && (
          <Field label="Password" required>
            <input className="input" type="password" value={form.password}
              onChange={e => setField('password', e.target.value)}
              placeholder="Min 8 characters" />
          </Field>
        )}

        <Field label="Role" required>
          <Select value={form.role} onChange={v => setField('role', v)}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>

        {editing && (
          <Field label="New Password">
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={e => setField('password', e.target.value)}
              placeholder="Leave blank to keep current password"
            />
          </Field>
        )}
        
        {needsRegion && (
          <Field label="Region">
            <Select value={form.regionId} onChange={v => setField('regionId', v)}>
              <option value="">— No region —</option>
              {regions.map(r => (
                <option key={r.regionId} value={r.regionId}>{r.regionName}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Phone">
          <input className="input" value={form.phone}
            onChange={e => setField('phone', e.target.value)}
            placeholder="9XXXXXXXXX" />
        </Field>

        {/* {editing && (
          <div className="bg-amber-950/30 border border-amber-900/40 rounded-xl px-4 py-3 text-amber-400 text-xs">
            To change this user's password, ask them to use Change Password in their profile, or reset via the database.
          </div>
        )} */}
      </FormModal>

      <ConfirmDialog
        open={Boolean(confirmRow)}
        title="Deactivate User"
        message={`Deactivate "${confirmRow?.fullName}"? They will no longer be able to log in.`}
        onConfirm={() => handleDeactivate(confirmRow)}
        onCancel={() => setConfirmRow(null)}
      />
    </Layout>
  )
}
