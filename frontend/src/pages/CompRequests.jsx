import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import DataTable from '../components/DataTable'
import { PageHeader, EmptyState, PaginationBar, SearchInput } from '../components/ui'
import { compRequestsApi } from '../api/comp_requests'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'

// Status colours
const STATUS_MAP = {
  DRAFT:             { bg: 'rgba(17,24,39,0.8)',  border: 'rgba(55,65,81,0.5)',    text: '#9ca3af', dot: '#6b7280' },
  SUBMITTED:         { bg: 'rgba(7,89,133,0.4)',  border: 'rgba(56,189,248,0.2)',  text: '#7dd3fc', dot: '#38bdf8' },
  APPROVED:          { bg: 'rgba(6,78,59,0.4)',   border: 'rgba(52,211,153,0.2)',  text: '#6ee7b7', dot: '#34d399' },
  REJECTED:          { bg: 'rgba(69,10,10,0.4)',  border: 'rgba(248,113,113,0.2)', text: '#fca5a5', dot: '#f87171' },
  DISPATCHED:        { bg: 'rgba(59,7,100,0.4)',  border: 'rgba(192,132,252,0.2)', text: '#d8b4fe', dot: '#c084fc' },
  DELIVERED:         { bg: 'rgba(19,78,74,0.4)',  border: 'rgba(45,212,191,0.2)',  text: '#99f6e4', dot: '#2dd4bf' },
  ADOPTED:           { bg: 'rgba(6,78,59,0.55)',  border: 'rgba(52,211,153,0.25)', text: '#a7f3d0', dot: '#34d399' },
  NOT_ADOPTED:       { bg: 'rgba(67,20,7,0.4)',   border: 'rgba(251,146,60,0.2)',  text: '#fed7aa', dot: '#fb923c' },
  PENDING_FOLLOW_UP: { bg: 'rgba(78,63,7,0.4)',   border: 'rgba(251,191,36,0.2)',  text: '#fde68a', dot: '#fbbf24' },
  CANCELLED:         { bg: 'rgba(17,24,39,0.5)',  border: 'rgba(55,65,81,0.3)',    text: '#6b7280', dot: '#374151' },
}

function StatusChip({ value }) {
  const s = STATUS_MAP[value] ?? { bg: 'rgba(17,24,39,0.7)', border: 'rgba(55,65,81,0.4)', text: '#9ca3af', dot: '#6b7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 6,
      background: s.bg, border: `1px solid ${s.border}`,
      color: s.text, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {value?.replace(/_/g, ' ')}
    </span>
  )
}

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
        <span className="text-brand-blue font-mono text-xs font-semibold">
          {row.requestRef}
        </span>
      ),
    },
    {
      key: 'faculty', header: 'Faculty',
      render: row => (
        <div>
          <p className="text-white font-medium text-sm">{row.faculty?.facultyName ?? '—'}</p>
          <p className="text-gray-500 text-xs">{row.college?.collegeName ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'lineItems', header: 'Books', width: 'w-20',
      render: row => (
        <span className="text-gray-400 text-xs font-mono">{row.lineItems?.length ?? 0}</span>
      ),
    },
    {
      key: 'rep', header: 'Rep', width: 'w-36',
      render: row => (
        <span className="text-gray-400 text-xs">{row.rep?.fullName ?? '—'}</span>
      ),
    },
    {
      key: 'requestDate', header: 'Visit Date', sortable: true, width: 'w-32',
      render: row => <span className="text-gray-400 text-xs">{row.requestDate}</span>,
    },
    {
      key: 'status', header: 'Status', width: 'w-40',
      render: row => <StatusChip value={row.status} />,
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
      <div className="p-4 md:p-6">
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
                  background: active ? 'rgba(208,29,34,0.15)' : 'transparent',
                  color: active ? '#fff' : '#6b7280',
                  border: `1px solid ${active ? 'rgba(208,29,34,0.35)' : 'transparent'}`,
                  transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent' } }}
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
            <span className="text-gray-600 text-xs flex-shrink-0">–</span>
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
