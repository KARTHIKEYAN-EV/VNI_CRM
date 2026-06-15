import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import Layout from '../components/Layout'
import { EmptyState, Spinner } from '../components/ui'
import { reportsApi, downloadCsv } from '../api/reports'
import { regionsApi, usersApi } from '../api/master'
import { useAuth } from '../auth/AuthContext'

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------
const today   = () => new Date().toISOString().slice(0, 10)
const yrAgo   = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) }
const fmtPct  = (v) => `${(v ?? 0).toFixed(1)}%`
const fmtDays = (v) => v == null ? '—' : `${v}d`

function StatCard({ label, value, sub, color = 'white' }) {
  const colorMap = { white: '#fff', blue: '#38bdf8', emerald: '#34d399', amber: '#fbbf24', red: '#f87171' }
  return (
    <div className="stagger-in card" style={{ padding: '12px 14px' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = '' }}
    >
      <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Sora, sans-serif', color: colorMap[color] ?? '#fff', lineHeight: 1.2 }}>{value ?? '—'}</p>
      {sub && <p style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}

function ReportTable({ columns, rows, loading, emptyMsg = 'No data for selected filters' }) {
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner size={28} /></div>
  if (!rows?.length) return <EmptyState icon="📊" title={emptyMsg} />
  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}>
            {columns.map(c => (
              <th key={c.key} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}
              className="stagger-in"
              style={{ borderBottom: i < rows.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none', animationDelay: `${i*25}ms`, transition: 'background 120ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {columns.map(c => (
                <td key={c.key} style={{ padding: '10px 14px', color: '#d1d5db', whiteSpace: 'nowrap' }}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FilterBar({ dateFrom, dateTo, onDateFrom, onDateTo, regionId, onRegion, repId, onRep, regions, reps, onExport }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5 items-center">
      <input type="date" value={dateFrom} onChange={e => onDateFrom(e.target.value)}
        className="input text-xs w-36" />
      <span className="text-gray-600 text-xs">–</span>
      <input type="date" value={dateTo} onChange={e => onDateTo(e.target.value)}
        className="input text-xs w-36" />
      {regions && (
        <select value={regionId} onChange={e => onRegion(e.target.value)} className="input text-xs w-44">
          <option value="">All regions</option>
          {regions.map(r => <option key={r.regionId} value={r.regionId}>{r.regionName}</option>)}
        </select>
      )}
      {reps && (
        <select value={repId} onChange={e => onRep(e.target.value)} className="input text-xs w-44">
          <option value="">All reps</option>
          {reps.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
        </select>
      )}
      <button onClick={onExport}
        className="ml-auto px-3 py-1.5 rounded-lg text-xs border border-white/20 text-gray-400 hover:text-white hover:bg-white/8 transition-all">
        ↓ Export CSV
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report 1: Comp Summary
// ---------------------------------------------------------------------------
function CompSummary({ regions, reps }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [df, setDf] = useState(yrAgo()), [dt, setDt] = useState(today())
  const [rid, setRid] = useState(''), [uid, setUid] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    reportsApi.compSummary({ dateFrom: df, dateTo: dt, regionId: rid || undefined, repId: uid || undefined })
      .then(r => setRows(r.data)).finally(() => setLoading(false))
  }, [df, dt, rid, uid])
  useEffect(() => { load() }, [load])

  // Aggregate by period for chart
  const chartData = Object.values(
    rows.reduce((acc, r) => {
      if (!acc[r.period]) acc[r.period] = { period: r.period, requests: 0, copies: 0 }
      acc[r.period].requests += r.totalRequests
      acc[r.period].copies   += r.totalCopies
      return acc
    }, {})
  ).sort((a, b) => a.period.localeCompare(b.period))

  const totalReqs  = rows.reduce((s, r) => s + r.totalRequests, 0)
  const totalCopies = rows.reduce((s, r) => s + r.totalCopies, 0)

  const cols = [
    { key: 'period',        label: 'Period' },
    { key: 'regionName',    label: 'Region' },
    { key: 'repName',       label: 'Rep' },
    { key: 'totalRequests', label: 'Requests' },
    { key: 'totalCopies',   label: 'Copies' },
  ]

  return (
    <div>
      <FilterBar dateFrom={df} dateTo={dt} onDateFrom={setDf} onDateTo={setDt}
        regionId={rid} onRegion={setRid} repId={uid} onRep={setUid}
        regions={regions} reps={reps}
        onExport={() => downloadCsv(rows, cols, 'comp_summary')} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <StatCard label="Total Requests" value={totalReqs} />
        <StatCard label="Total Copies"   value={totalCopies} />
      </div>
      {chartData.length > 1 && (
        <div className="mb-5 bg-white/3 border border-white/8 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="period" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="requests" fill="#D01D22" name="Requests" radius={[3,3,0,0]} />
              <Bar dataKey="copies"   fill="#02B6FF" name="Copies"   radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <ReportTable columns={cols} rows={rows} loading={loading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report 2: Subject Coverage
// ---------------------------------------------------------------------------
function SubjectCoverage({ regions }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false)
  const [df, setDf] = useState(yrAgo()), [dt, setDt] = useState(today())
  const [rid, setRid] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    reportsApi.subjectCoverage({ dateFrom: df, dateTo: dt, regionId: rid || undefined })
      .then(r => setRows(r.data)).finally(() => setLoading(false))
  }, [df, dt, rid])
  useEffect(() => { load() }, [load])

  const cols = [
    { key: 'subjectName',  label: 'Subject' },
    { key: 'compCount',    label: 'Comp Lines' },
    { key: 'collegeCount', label: 'Colleges Reached' },
    { key: 'copyCount',    label: 'Total Copies' },
  ]
  return (
    <div>
      <FilterBar dateFrom={df} dateTo={dt} onDateFrom={setDf} onDateTo={setDt}
        regionId={rid} onRegion={setRid} regions={regions}
        onExport={() => downloadCsv(rows, cols, 'subject_coverage')} />
      <ReportTable columns={cols} rows={rows} loading={loading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report 3: College Coverage
// ---------------------------------------------------------------------------
function CollegeCoverage({ regions, reps }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false)
  const [df, setDf] = useState(yrAgo()), [dt, setDt] = useState(today())
  const [rid, setRid] = useState(''), [uid, setUid] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    reportsApi.collegeCoverage({ dateFrom: df, dateTo: dt, regionId: rid || undefined, repId: uid || undefined })
      .then(r => setRows(r.data)).finally(() => setLoading(false))
  }, [df, dt, rid, uid])
  useEffect(() => { load() }, [load])

  const cols = [
    { key: 'collegeName',   label: 'College' },
    { key: 'collegeType',   label: 'Type', render: r => <span className="text-gray-400">{r.collegeType}</span> },
    { key: 'regionName',    label: 'Region' },
    { key: 'totalRequests', label: 'Requests' },
    { key: 'totalCopies',   label: 'Copies' },
    { key: 'lastCompDate',  label: 'Last Comp' },
  ]
  return (
    <div>
      <FilterBar dateFrom={df} dateTo={dt} onDateFrom={setDf} onDateTo={setDt}
        regionId={rid} onRegion={setRid} repId={uid} onRep={setUid}
        regions={regions} reps={reps}
        onExport={() => downloadCsv(rows, cols, 'college_coverage')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
        <StatCard label="Colleges Reached" value={rows.length} />
        <StatCard label="Total Copies" value={rows.reduce((s, r) => s + r.totalCopies, 0)} />
      </div>
      <ReportTable columns={cols} rows={rows} loading={loading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report 4: Book-wise Comping
// ---------------------------------------------------------------------------
function BookComping({ regions }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false)
  const [df, setDf] = useState(yrAgo()), [dt, setDt] = useState(today())
  const [rid, setRid] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    reportsApi.bookComping({ dateFrom: df, dateTo: dt, regionId: rid || undefined })
      .then(r => setRows(r.data)).finally(() => setLoading(false))
  }, [df, dt, rid])
  useEffect(() => { load() }, [load])

  const cols = [
    { key: 'title',         label: 'Title', render: r => <span className="text-white font-medium">{r.title}</span> },
    { key: 'authors',       label: 'Authors' },
    { key: 'subjectArea',   label: 'Subject' },
    { key: 'totalRequests', label: 'Requests' },
    { key: 'totalCopies',   label: 'Copies Comped' },
    { key: 'compStock',     label: 'Catalog Stock', render: r => (
      <span className={r.compStock === 0 ? 'text-red-400' : 'text-emerald-400'}>{r.compStock}</span>
    )},
  ]
  return (
    <div>
      <FilterBar dateFrom={df} dateTo={dt} onDateFrom={setDf} onDateTo={setDt}
        regionId={rid} onRegion={setRid} regions={regions}
        onExport={() => downloadCsv(rows, cols, 'book_comping')} />
      <ReportTable columns={cols} rows={rows} loading={loading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report 5: Adoption Rate
// ---------------------------------------------------------------------------
const PIE_COLORS = ['#10b981', '#f97316', '#6b7280']

function AdoptionRate({ regions }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false)
  const [df, setDf] = useState(yrAgo()), [dt, setDt] = useState(today())
  const [rid, setRid] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    reportsApi.adoptionRate({ dateFrom: df, dateTo: dt, regionId: rid || undefined })
      .then(r => setRows(r.data)).finally(() => setLoading(false))
  }, [df, dt, rid])
  useEffect(() => { load() }, [load])

  const totAdopted    = rows.reduce((s, r) => s + r.adopted,     0)
  const totNotAdopted = rows.reduce((s, r) => s + r.notAdopted,  0)
  const totPending    = rows.reduce((s, r) => s + r.pending,      0)
  const totDelivered  = totAdopted + totNotAdopted + totPending
  const overallPct    = totDelivered > 0 ? ((totAdopted / (totAdopted + totNotAdopted)) * 100).toFixed(1) : '—'

  const pieData = [
    { name: 'Adopted',     value: totAdopted },
    { name: 'Not Adopted', value: totNotAdopted },
    { name: 'Pending',     value: totPending },
  ].filter(d => d.value > 0)

  const cols = [
    { key: 'repName',        label: 'Rep', render: r => <span className="text-white font-medium">{r.repName}</span> },
    { key: 'totalDelivered', label: 'Delivered' },
    { key: 'adopted',        label: 'Adopted',     render: r => <span className="text-emerald-400">{r.adopted}</span> },
    { key: 'notAdopted',     label: 'Not Adopted', render: r => <span className="text-orange-400">{r.notAdopted}</span> },
    { key: 'pending',        label: 'Pending',     render: r => <span className="text-gray-400">{r.pending}</span> },
    { key: 'adoptionPct',    label: 'Rate',        render: r => <span className="text-white font-semibold">{fmtPct(r.adoptionPct)}</span> },
  ]

  return (
    <div>
      <FilterBar dateFrom={df} dateTo={dt} onDateFrom={setDf} onDateTo={setDt}
        regionId={rid} onRegion={setRid} regions={regions}
        onExport={() => downloadCsv(rows, cols, 'adoption_rate')} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <StatCard label="Delivered"    value={totDelivered} />
        <StatCard label="Adopted"      value={totAdopted}    color="emerald" />
        <StatCard label="Not Adopted"  value={totNotAdopted} color="amber" />
        <StatCard label="Overall Rate" value={`${overallPct}%`} color="blue" />
      </div>
      {pieData.length > 0 && (
        <div className="mb-5 bg-white/3 border border-white/8 rounded-xl p-4 flex justify-center">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false} fontSize={11} fill="#8884d8">
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <ReportTable columns={cols} rows={rows} loading={loading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report 6: Pending Follow-ups
// ---------------------------------------------------------------------------
function PendingFollowUps({ regions, reps }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false)
  const [rid, setRid] = useState(''), [uid, setUid] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    reportsApi.pendingFollowUps({ regionId: rid || undefined, repId: uid || undefined })
      .then(r => setRows(r.data)).finally(() => setLoading(false))
  }, [rid, uid])
  useEffect(() => { load() }, [load])

  const cols = [
    { key: 'requestRef',  label: 'Reference', render: r => (
      <button onClick={() => navigate(`/requests/${r.requestId}`)}
        className="text-brand-blue font-mono text-xs hover:underline">{r.requestRef}</button>
    )},
    { key: 'facultyName', label: 'Faculty' },
    { key: 'collegeName', label: 'College' },
    { key: 'repName',     label: 'Rep' },
    { key: 'deliveredAt', label: 'Delivered' },
    { key: 'daysElapsed', label: 'Days', render: r => (
      <span className={r.daysElapsed >= 60 ? 'text-red-400 font-bold' : r.daysElapsed >= 30 ? 'text-amber-400 font-bold' : 'text-gray-400'}>
        {r.daysElapsed}d
      </span>
    )},
    { key: 'status', label: 'Status', render: r => (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
        ${r.status === 'PENDING_FOLLOW_UP' ? 'bg-amber-950/60 text-amber-400' : 'bg-teal-950/60 text-teal-400'}`}>
        {r.status.replace(/_/g,' ')}
      </span>
    )},
  ]
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        {regions && (
          <select value={rid} onChange={e => setRid(e.target.value)} className="input text-xs w-44">
            <option value="">All regions</option>
            {regions.map(r => <option key={r.regionId} value={r.regionId}>{r.regionName}</option>)}
          </select>
        )}
        {reps && (
          <select value={uid} onChange={e => setUid(e.target.value)} className="input text-xs w-44">
            <option value="">All reps</option>
            {reps.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
          </select>
        )}
        <button onClick={() => downloadCsv(rows, cols.filter(c => c.key !== 'requestRef').concat([{key:'requestRef',label:'Reference'}]), 'pending_follow_ups')}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs border border-white/20 text-gray-400 hover:text-white hover:bg-white/8 transition-all">
          ↓ Export CSV
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
        <StatCard label="Total Pending" value={rows.length} />
        <StatCard label="Overdue (30d+)" value={rows.filter(r => r.daysElapsed >= 30).length} color="amber" />
        <StatCard label="Critical (60d+)" value={rows.filter(r => r.daysElapsed >= 60).length} color="red" />
      </div>
      <ReportTable columns={cols} rows={rows} loading={loading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report 7: Fulfilment TAT
// ---------------------------------------------------------------------------
function FulfilmentTAT({ regions }) {
  const navigate = useNavigate()
  const [data,    setData]    = useState({ rows: [], summary: null })
  const [loading, setLoading] = useState(false)
  const [df, setDf] = useState(yrAgo()), [dt, setDt] = useState(today())
  const [rid, setRid] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    reportsApi.fulfilmentTat({ dateFrom: df, dateTo: dt, regionId: rid || undefined })
      .then(r => setData(r.data)).finally(() => setLoading(false))
  }, [df, dt, rid])
  useEffect(() => { load() }, [load])

  const { rows, summary } = data

  const cols = [
    { key: 'requestRef',               label: 'Reference', render: r => (
      <button onClick={() => navigate(`/requests/${r.requestId}`)}
        className="text-brand-blue font-mono text-xs hover:underline">{r.requestRef}</button>
    )},
    { key: 'facultyName',              label: 'Faculty' },
    { key: 'approvedAt',               label: 'Approved' },
    { key: 'dispatchedAt',             label: 'Dispatched' },
    { key: 'deliveredAt',              label: 'Delivered' },
    { key: 'approvalToDispatchDays',   label: 'Appr→Disp', render: r => <span className="font-mono">{fmtDays(r.approvalToDispatchDays)}</span> },
    { key: 'dispatchToDeliveryDays',   label: 'Disp→Del',  render: r => <span className="font-mono">{fmtDays(r.dispatchToDeliveryDays)}</span> },
    { key: 'totalFulfilDays',          label: 'Total TAT', render: r => (
      <span className={`font-mono font-semibold ${(r.totalFulfilDays ?? 0) > 14 ? 'text-amber-400' : 'text-emerald-400'}`}>
        {fmtDays(r.totalFulfilDays)}
      </span>
    )},
  ]
  return (
    <div>
      <FilterBar dateFrom={df} dateTo={dt} onDateFrom={setDf} onDateTo={setDt}
        regionId={rid} onRegion={setRid} regions={regions}
        onExport={() => downloadCsv(rows, cols, 'fulfilment_tat')} />
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
          <StatCard label="Avg Appr→Disp" value={`${summary.avgApprovalToDispatch ?? '—'}d`} />
          <StatCard label="Avg Disp→Del"  value={`${summary.avgDispatchToDelivery ?? '—'}d`} />
          <StatCard label="Avg Total TAT"  value={`${summary.avgTotalDays ?? '—'}d`} color="blue" />
          <StatCard label="Fastest"        value={`${summary.minTotalDays ?? '—'}d`} color="emerald" />
          <StatCard label="Slowest"        value={`${summary.maxTotalDays ?? '—'}d`} color="amber" />
        </div>
      )}
      <ReportTable columns={cols} rows={rows} loading={loading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report 8: Print Run Impact
// ---------------------------------------------------------------------------
function PrintRunImpact() {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false)
  const [df, setDf] = useState(yrAgo()), [dt, setDt] = useState(today())
  const load = useCallback(() => {
    setLoading(true)
    reportsApi.printRunImpact({ dateFrom: df, dateTo: dt })
      .then(r => setRows(r.data)).finally(() => setLoading(false))
  }, [df, dt])
  useEffect(() => { load() }, [load])

  const cols = [
    { key: 'title',          label: 'Title', render: r => <span className="text-white font-medium">{r.title}</span> },
    { key: 'authors',        label: 'Authors' },
    { key: 'subjectArea',    label: 'Subject' },
    { key: 'compStock',      label: 'Catalog Stock' },
    { key: 'totalComped',    label: 'Comped', render: r => <span className="text-brand-blue font-mono">{r.totalComped}</span> },
    { key: 'remainingStock', label: 'Remaining', render: r => (
      <span className={r.remainingStock <= 5 ? 'text-red-400 font-bold' : 'text-gray-300'}>{r.remainingStock}</span>
    )},
    { key: 'utilizationPct', label: 'Utilisation', render: r => (
      <div className="flex items-center gap-2">
        <div className="w-20 bg-white/10 rounded-full h-1.5">
          <div className="bg-brand-red h-1.5 rounded-full" style={{ width: `${Math.min(100, r.utilizationPct)}%` }} />
        </div>
        <span className="text-xs font-mono">{fmtPct(r.utilizationPct)}</span>
      </div>
    )},
  ]
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <input type="date" value={df} onChange={e => setDf(e.target.value)} className="input text-xs w-36" />
        <span className="text-gray-600 text-xs">–</span>
        <input type="date" value={dt} onChange={e => setDt(e.target.value)} className="input text-xs w-36" />
        <button onClick={() => downloadCsv(rows, cols, 'print_run_impact')}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs border border-white/20 text-gray-400 hover:text-white hover:bg-white/8 transition-all">
          ↓ Export CSV
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
        <StatCard label="Titles Comped" value={rows.length} />
        <StatCard label="Total Copies"  value={rows.reduce((s, r) => s + r.totalComped, 0)} color="blue" />
        <StatCard label="Low Stock (≤5)" value={rows.filter(r => r.remainingStock <= 5).length} color="amber" />
      </div>
      <ReportTable columns={cols} rows={rows} loading={loading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reports hub
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'comp-summary',      label: 'Comp Summary',       icon: '📊', desc: 'Totals by period, region, rep' },
  { id: 'subject-coverage',  label: 'Subject Coverage',   icon: '📖', desc: 'Subjects comped across colleges' },
  { id: 'college-coverage',  label: 'College Coverage',   icon: '🏫', desc: 'Colleges reached by comp activity' },
  { id: 'book-comping',      label: 'Book-wise Comping',  icon: '📚', desc: 'Copies per title in catalog' },
  { id: 'adoption-rate',     label: 'Adoption Rate',      icon: '✅', desc: 'Adoption outcomes by rep' },
  { id: 'pending-follow-ups',label: 'Pending Follow-ups', icon: '📬', desc: 'Unactioned deliveries' },
  { id: 'fulfilment-tat',    label: 'Fulfilment TAT',     icon: '⏱️', desc: 'Approval→Dispatch→Delivery time' },
  { id: 'print-run-impact',  label: 'Print Run Impact',   icon: '🖨️', desc: 'Comp stock utilisation' },
]

export default function Reports() {
  const [activeTab, setActiveTab]   = useState('comp-summary')
  const [regions,   setRegions]     = useState([])
  const [reps,      setReps]        = useState([])
  const { hasRole }                 = useAuth()

  useEffect(() => {
    regionsApi.listAll().then(r => setRegions(r.data))
    if (hasRole('admin', 'ceo', 'manager')) {
      usersApi.list({ role: 'rep', pageSize: 100 }).then(r => setReps(r.data.items))
    }
  }, [hasRole])

  const tab = TABS.find(t => t.id === activeTab)

  return (
    <Layout>
      <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-48px)]">

        {/* Mobile: horizontal scrollable tab strip */}
        <div className="md:hidden flex overflow-x-auto border-b border-white/6 bg-white/2 px-2 py-2 gap-1 flex-shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all
                ${activeTab === t.id
                  ? 'bg-brand-red/20 text-white border border-brand-red/40'
                  : 'text-gray-400 hover:text-white hover:bg-white/6'}`}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Desktop: vertical sidebar */}
        <aside className="hidden md:flex md:flex-col w-[220px] flex-shrink-0 border-r border-white/6 overflow-y-auto py-3">
          <p className="px-4 pb-2 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
            Reports
          </p>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all
                ${activeTab === t.id
                  ? 'bg-brand-red/15 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-sm flex-shrink-0">{t.icon}</span>
              <span className="text-[13px] truncate">{t.label}</span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-5xl">
            <div className="mb-5">
              <h1 className="text-xl font-bold text-white font-display">{tab?.label}</h1>
              <p className="text-gray-500 text-sm mt-0.5">{tab?.desc}</p>
            </div>

            {activeTab === 'comp-summary'       && <CompSummary    regions={regions} reps={reps} />}
            {activeTab === 'subject-coverage'   && <SubjectCoverage regions={regions} />}
            {activeTab === 'college-coverage'   && <CollegeCoverage regions={regions} reps={reps} />}
            {activeTab === 'book-comping'       && <BookComping     regions={regions} />}
            {activeTab === 'adoption-rate'      && <AdoptionRate    regions={regions} />}
            {activeTab === 'pending-follow-ups' && <PendingFollowUps regions={regions} reps={reps} />}
            {activeTab === 'fulfilment-tat'     && <FulfilmentTAT   regions={regions} />}
            {activeTab === 'print-run-impact'   && <PrintRunImpact />}
          </div>
        </main>
      </div>
    </Layout>
  )
}
