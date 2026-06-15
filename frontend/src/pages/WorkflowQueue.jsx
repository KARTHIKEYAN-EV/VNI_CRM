import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader, EmptyState, Spinner } from '../components/ui'
import { compRequestsApi, workflowApi } from '../api/comp_requests'
import { useAuth } from '../auth/AuthContext'

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------
const WF_STATUS_MAP = {
  SUBMITTED:         { bg: 'rgba(7,89,133,0.4)',  border: 'rgba(56,189,248,0.2)',  text: '#7dd3fc', dot: '#38bdf8' },
  APPROVED:          { bg: 'rgba(6,78,59,0.4)',   border: 'rgba(52,211,153,0.2)',  text: '#6ee7b7', dot: '#34d399' },
  DISPATCHED:        { bg: 'rgba(59,7,100,0.4)',  border: 'rgba(192,132,252,0.2)', text: '#d8b4fe', dot: '#c084fc' },
  DELIVERED:         { bg: 'rgba(19,78,74,0.4)',  border: 'rgba(45,212,191,0.2)',  text: '#99f6e4', dot: '#2dd4bf' },
  PENDING_FOLLOW_UP: { bg: 'rgba(78,63,7,0.4)',   border: 'rgba(251,191,36,0.2)',  text: '#fde68a', dot: '#fbbf24' },
}
function StatusChip({ value }) {
  const s = WF_STATUS_MAP[value] ?? { bg: 'rgba(17,24,39,0.7)', border: 'rgba(55,65,81,0.4)', text: '#9ca3af', dot: '#6b7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text, fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot }} />
      {value?.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Rejection Modal (CEO)
// ---------------------------------------------------------------------------
function RejectModal({ open, onClose, onConfirm, reasons }) {
  const [reasonCode,  setReasonCode]  = useState('')
  const [reasonNotes, setReasonNotes] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')

  const selectedReason = reasons.find(r => r.reasonCode === reasonCode)

  async function handleSubmit() {
    if (!reasonCode) { setError('Select a reason'); return }
    if (selectedReason?.requiresNotes && !reasonNotes.trim()) {
      setError('Additional notes are required for this reason'); return
    }
    setError(''); setSubmitting(true)
    try {
      await onConfirm(reasonCode, reasonNotes || undefined)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Rejection failed')
    } finally { setSubmitting(false) }
  }

  useEffect(() => { if (open) { setReasonCode(''); setReasonNotes(''); setError('') } }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-white font-semibold font-display mb-4">Reject Request</h3>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1.5">
          Reason *
        </label>
        <select className="input text-sm mb-3" value={reasonCode}
          onChange={e => setReasonCode(e.target.value)}>
          <option value="">Select reason…</option>
          {reasons.map(r => (
            <option key={r.reasonCode} value={r.reasonCode}>{r.reasonLabel}</option>
          ))}
        </select>
        {selectedReason?.requiresNotes && (
          <>
            <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1.5">
              Additional Notes *
            </label>
            <textarea className="input text-sm min-h-[72px] resize-none mb-3"
              value={reasonNotes} onChange={e => setReasonNotes(e.target.value)}
              placeholder="Please specify…" />
          </>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:text-white transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-4 py-1.5 rounded-xl text-sm font-medium bg-red-900/60 text-red-300 border border-red-800/50 hover:bg-red-800/60 transition-all disabled:opacity-50">
            {submitting ? 'Rejecting…' : 'Reject Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Request row card — used across all queue types
// ---------------------------------------------------------------------------
function QueueCard({ request, actions }) {
  const navigate = useNavigate()
  return (
    <div className="card p-4 flex flex-col xs:flex-row items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => navigate(`/requests/${request.requestId}`)}
            className="text-brand-blue font-mono text-xs font-semibold hover:underline">
            {request.requestRef}
          </button>
          <StatusChip value={request.status} />
        </div>
        <p className="text-white font-medium text-sm truncate">
          {request.faculty?.facultyName ?? '—'}
        </p>
        <p className="text-gray-500 text-xs">
          {request.college?.collegeName} · {request.lineItems?.length ?? 0} book{request.lineItems?.length !== 1 ? 's' : ''}
          {' · '}{request.rep?.fullName}
        </p>
        <p className="text-gray-600 text-xs mt-0.5">{request.requestDate}</p>
      </div>
      <div className="flex xs:flex-col flex-row flex-wrap gap-1.5 xs:flex-shrink-0 w-full xs:w-auto">
        {actions.map(action => (
          <button key={action.label} onClick={() => action.onClick(request)}
            disabled={action.loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
              ${action.primary
                ? 'bg-brand-red/20 text-white border border-brand-red/40 hover:bg-brand-red/30'
                : action.danger
                  ? 'text-red-400 border border-red-900/50 hover:bg-red-950/30'
                  : 'text-gray-300 border border-white/10 hover:bg-white/6'
              } disabled:opacity-50`}>
            {action.loading ? '…' : action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CEO Approval Queue
// ---------------------------------------------------------------------------
function ApprovalQueue() {
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [reasons,    setReasons]    = useState([])
  const [rejectFor,  setRejectFor]  = useState(null)
  const [acting,     setActing]     = useState(null)   // request_id being actioned

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      compRequestsApi.list({ status: 'SUBMITTED', pageSize: 50 }),
      workflowApi.rejectionReasons(),
    ]).then(([r, reas]) => {
      setItems(r.data.items)
      setReasons(reas.data)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleApprove(request) {
    setActing(request.requestId)
    try { await workflowApi.approve(request.requestId); load() }
    finally { setActing(null) }
  }

  async function handleRejectConfirm(reasonCode, reasonNotes) {
    await workflowApi.reject(rejectFor.requestId, { reasonCode, reasonNotes })
    setRejectFor(null); load()
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size={32} /></div>

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold font-display">Pending Approval</h2>
          <p className="text-gray-500 text-xs mt-0.5">{items.length} request{items.length !== 1 ? 's' : ''} awaiting your decision</p>
        </div>
      </div>

      {items.length === 0
        ? <EmptyState icon="✅" title="All clear" subtitle="No requests pending approval" />
        : (
          <div className="space-y-3">
            {items.map(r => (
              <QueueCard key={r.requestId} request={r} actions={[
                {
                  label: 'Approve', primary: true,
                  loading: acting === r.requestId,
                  onClick: handleApprove,
                },
                {
                  label: 'Reject', danger: true,
                  onClick: r => setRejectFor(r),
                },
              ]} />
            ))}
          </div>
        )}

      <RejectModal
        open={Boolean(rejectFor)} reasons={reasons}
        onClose={() => setRejectFor(null)}
        onConfirm={handleRejectConfirm}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Back Office Fulfilment Queue
// ---------------------------------------------------------------------------
function FulfilmentQueue() {
  const [approved,   setApproved]   = useState([])
  const [dispatched, setDispatched] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [acting,     setActing]     = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      compRequestsApi.list({ status: 'APPROVED',   pageSize: 50 }),
      compRequestsApi.list({ status: 'DISPATCHED', pageSize: 50 }),
    ]).then(([a, d]) => {
      setApproved(a.data.items); setDispatched(d.data.items)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDispatch(request) {
    setActing(request.requestId)
    try { await workflowApi.dispatch(request.requestId); load() }
    finally { setActing(null) }
  }

  async function handleDeliver(request) {
    setActing(request.requestId)
    try { await workflowApi.deliver(request.requestId); load() }
    finally { setActing(null) }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size={32} /></div>

  return (
    <div className="space-y-8">
      {/* Pending dispatch */}
      <div>
        <div className="mb-3">
          <h2 className="text-white font-semibold font-display">Ready to Dispatch</h2>
          <p className="text-gray-500 text-xs mt-0.5">{approved.length} approved request{approved.length !== 1 ? 's' : ''}</p>
        </div>
        {approved.length === 0
          ? <EmptyState icon="📦" title="Nothing to dispatch" subtitle="No approved requests in queue" />
          : (
            <div className="space-y-3">
              {approved.map(r => (
                <QueueCard key={r.requestId} request={r} actions={[
                  { label: 'Mark Dispatched', primary: true, loading: acting === r.requestId, onClick: handleDispatch },
                ]} />
              ))}
            </div>
          )}
      </div>

      {/* Pending delivery confirmation */}
      <div>
        <div className="mb-3">
          <h2 className="text-white font-semibold font-display">Confirm Delivery</h2>
          <p className="text-gray-500 text-xs mt-0.5">{dispatched.length} dispatched request{dispatched.length !== 1 ? 's' : ''}</p>
        </div>
        {dispatched.length === 0
          ? <EmptyState icon="✅" title="All deliveries confirmed" />
          : (
            <div className="space-y-3">
              {dispatched.map(r => (
                <QueueCard key={r.requestId} request={r} actions={[
                  { label: 'Confirm Delivered', primary: true, loading: acting === r.requestId, onClick: handleDeliver },
                ]} />
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rep / Manager Adoption Queue
// ---------------------------------------------------------------------------
function AdoptionQueue() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    compRequestsApi.list({ status: 'DELIVERED', pageSize: 50 })
      .then(r => setItems(r.data.items))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdoption(request, adopted) {
    setActing(request.requestId)
    try { await workflowApi.markAdoption(request.requestId, adopted); load() }
    finally { setActing(null) }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size={32} /></div>

  return (
    <>
      <div className="mb-4">
        <h2 className="text-white font-semibold font-display">Pending Adoption Follow-up</h2>
        <p className="text-gray-500 text-xs mt-0.5">{items.length} delivered request{items.length !== 1 ? 's' : ''} awaiting adoption marking</p>
      </div>
      {items.length === 0
        ? <EmptyState icon="🎉" title="All followed up" subtitle="No requests waiting for adoption status" />
        : (
          <div className="space-y-3">
            {items.map(r => (
              <QueueCard key={r.requestId} request={r} actions={[
                { label: '✓ Adopted',     primary: true,  loading: acting === r.requestId, onClick: req => handleAdoption(req, true)  },
                { label: '✗ Not Adopted', danger:  false, loading: acting === r.requestId, onClick: req => handleAdoption(req, false) },
              ]} />
            ))}
          </div>
        )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Root — role dispatcher
// ---------------------------------------------------------------------------
export default function WorkflowQueue() {
  const { hasRole } = useAuth()

  const title    = hasRole('ceo', 'admin')      ? 'Approval Queue'
                 : hasRole('back_office')        ? 'Fulfilment Queue'
                 : 'Adoption Follow-up'

  const subtitle = hasRole('ceo', 'admin')      ? 'Comp requests submitted for your approval'
                 : hasRole('back_office')        ? 'Dispatch and delivery tracking'
                 : 'Mark adoption outcomes for delivered comp copies'

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-3xl">
        <PageHeader title={title} subtitle={subtitle} />
        {hasRole('ceo', 'admin')  && <ApprovalQueue />}
        {hasRole('back_office')   && <FulfilmentQueue />}
        {hasRole('rep', 'manager') && !hasRole('ceo', 'admin', 'back_office') && <AdoptionQueue />}
        {hasRole('admin')         && (
          <div className="mt-8">
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-widest mb-4">
              Back Office View (Admin)
            </p>
            <FulfilmentQueue />
          </div>
        )}
      </div>
    </Layout>
  )
}
