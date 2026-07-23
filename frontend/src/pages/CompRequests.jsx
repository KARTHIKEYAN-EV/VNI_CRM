import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import { PageHeader, EmptyState, PaginationBar, SearchInput, StatusBadge } from '../components/ui'
import { compRequestsApi } from '../api/comp_requests'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

const STATUS_TABS = [
  { label: 'All',       value: '' },
  { label: 'Draft',     value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved',  value: 'APPROVED' },
  { label: 'Dispatched',value: 'DISPATCHED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Adopted',   value: 'ADOPTED' },
]

export default function CompRequests() {
  const navigate    = useNavigate()
  const { hasRole } = useAuth()

  const [items,      setItems]      = useState([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [pages,      setPages]      = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [statusTab,  setStatusTab]  = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const debouncedSearch = useDebounce(search, 350)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await compRequestsApi.list({
        page, pageSize: 20,
        status:   statusTab  || undefined,
        search:   debouncedSearch || undefined,
        dateFrom: dateFrom   || undefined,
        dateTo:   dateTo     || undefined,
      })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [page, statusTab, debouncedSearch, dateFrom, dateTo])

  useEffect(() => { fetchItems() }, [fetchItems])

  const columns = [
    {
      key: 'requestRef', header: 'Reference', sortable: true, width: 'w-40',
      render: row => (
        <span style={{ color: 'var(--blue)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>
          {row.requestRef}
        </span>
      ),
    },
    {
      key: 'faculty', header: 'Faculty',
      render: row => (
        <div>
          <p style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14 }}>{row.faculty?.facultyName ?? '—'}</p>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>{row.college?.collegeName ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'lineItems', header: 'Books', width: 'w-20',
      render: row => (
        <span style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
          {row.lineItems?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'rep', header: 'Rep', width: 'w-36',
      render: row => (
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{row.rep?.fullName ?? '—'}</span>
      ),
    },
    {
      key: 'requestDate', header: 'Visit Date', sortable: true, width: 'w-32',
      render: row => <span style={{ color: 'var(--muted)', fontSize: 12 }}>{row.requestDate}</span>,
    },
    {
      key: 'status', header: 'Status', width: 'w-40',
      render: row => <StatusBadge value={row.status} />,
    },
  ]

  const rowActions = row => [
    { label: 'View', onClick: r => navigate(`/requests/${r.requestId}`) },
    ...(row.status === 'DRAFT'
      ? [{ label: 'Edit', onClick: r => navigate(`/requests/${r.requestId}/edit`) }]
      : []),
  ]

  return (
    <Layout>
      {/* Transparent background – shows ambient starfield */}
      <div style={{ padding: '1.5rem', minHeight: '100vh', background: 'transparent' }}>
        <PageHeader
          title="Comp Requests"
          subtitle={`${total} total`}
          action={
            <button onClick={() => navigate('/requests/new')} className="btn-primary px-4 py-2 text-sm">
              + New Request
            </button>
          }
        />

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {STATUS_TABS.map(tab => {
            const active = statusTab === tab.value
            return (
              <button key={tab.value}
                onClick={() => { setStatusTab(tab.value); setPage(1) }}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
                  background: active ? 'var(--tab-active-bg)' : 'transparent',
                  color: active ? 'var(--tab-active-text)' : 'var(--muted)',
                  border: `1px solid ${active ? 'var(--tab-active-border)' : 'transparent'}`,
                  transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--text)';
                    e.currentTarget.style.background = 'var(--hover-bg)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--muted)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Search by reference…" className="w-full sm:flex-1 sm:min-w-[180px] sm:max-w-xs" />
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="input text-sm flex-1 sm:w-36" placeholder="From" />
            <span style={{ color: 'var(--faint)', fontSize: 12, flexShrink: 0 }}>–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="input text-sm flex-1 sm:w-36" placeholder="To" />
          </div>
        </div>

        <DataTable columns={columns} rows={items} actions={rowActions}
          keyField="requestId" loading={loading}
          emptyNode={
            <EmptyState icon="📋" title="No comp requests found"
              subtitle={statusTab ? `No requests with status ${statusTab}` : 'Create your first comp request'} />
          } />
        <PaginationBar page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
      </div>
    </Layout>
  )
}
