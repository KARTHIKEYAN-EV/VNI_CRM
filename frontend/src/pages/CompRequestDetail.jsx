import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Spinner } from '../components/ui'
import { compRequestsApi, workflowApi } from '../api/comp_requests'
import { useAuth } from '../auth/AuthContext'
import SendFormModal from '../components/SendFormModal'

const STATUS_STYLE = {
  DRAFT:             'bg-gray-900      text-gray-400   border-gray-700',
  SUBMITTED:         'bg-blue-950/60   text-blue-400   border-blue-800/50',
  APPROVED:          'bg-emerald-950/60 text-emerald-400 border-emerald-800/50',
  REJECTED:          'bg-red-950/60    text-red-400    border-red-800/50',
  DISPATCHED:        'bg-purple-950/60 text-purple-400  border-purple-800/50',
  DELIVERED:         'bg-teal-950/60   text-teal-400   border-teal-800/50',
  ADOPTED:           'bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
  NOT_ADOPTED:       'bg-orange-950/60 text-orange-400  border-orange-800/50',
  PENDING_FOLLOW_UP: 'bg-amber-950/60  text-amber-400   border-amber-800/50',
  CANCELLED:         'bg-gray-900      text-gray-600    border-gray-800',
}
function StatusChip({ value }) {
  const s = STATUS_STYLE[value] ?? 'bg-gray-900 text-gray-500 border-gray-800'
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold ${s}`}>{value?.replace(/_/g,' ')}</span>
}
function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-white/5 last:border-0">
      <span className="text-gray-500 text-xs uppercase tracking-wider">{label}</span>
      <span className="text-white text-sm text-right max-w-[65%]">{value ?? '—'}</span>
    </div>
  )
}
function Ts({ value }) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

// ---------------------------------------------------------------------------
// Rejection modal (CEO)
// ---------------------------------------------------------------------------
function RejectModal({ open, onClose, onConfirm, reasons }) {
  const [code, setCode]   = useState('')
  const [notes, setNotes] = useState('')
  const [err, setErr]     = useState('')
  const [busy, setBusy]   = useState(false)
  const sel = reasons.find(r => r.reasonCode === code)

  useEffect(() => { if (open) { setCode(''); setNotes(''); setErr('') } }, [open])

  async function go() {
    if (!code) { setErr('Select a reason'); return }
    if (sel?.requiresNotes && !notes.trim()) { setErr('Notes required'); return }
    setErr(''); setBusy(true)
    try { await onConfirm(code, notes || undefined); onClose() }
    catch (e) { setErr(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-white font-semibold font-display mb-4">Reject Request</h3>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1.5">Reason *</label>
        <select className="input text-sm mb-3" value={code} onChange={e => setCode(e.target.value)}>
          <option value="">Select reason…</option>
          {reasons.map(r => <option key={r.reasonCode} value={r.reasonCode}>{r.reasonLabel}</option>)}
        </select>
        {sel?.requiresNotes && (
          <textarea className="input text-sm min-h-[64px] resize-none mb-3"
            value={notes} onChange={e => setNotes(e.target.value)} placeholder="Please specify…" />
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:text-white">Cancel</button>
          <button onClick={go} disabled={busy}
            className="px-4 py-1.5 rounded-xl text-sm font-medium bg-red-900/60 text-red-300 border border-red-800/50 hover:bg-red-800/60 disabled:opacity-50">
            {busy ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function CompRequestDetail() {
  const { id }            = useParams()
  const navigate          = useNavigate()
  const { user, hasRole } = useAuth()

  const [request,   setRequest]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [reasons,   setReasons]   = useState([])
  const [acting,    setActing]    = useState('')
  const [err,       setErr]       = useState('')
  const [rejectOpen,setRejectOpen]= useState(false)
  const [sendFormOpen,setSendFormOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      compRequestsApi.get(id),
      workflowApi.rejectionReasons(),
    ]).then(([r, reas]) => {
      setRequest(r.data); setReasons(reas.data)
    }).finally(() => setLoading(false))
  }, [id])

  async function action(fn, label) {
    setActing(label); setErr('')
    try { const { data } = await fn(); setRequest(data) }
    catch (e) { setErr(e.response?.data?.detail ?? `${label} failed`) }
    finally { setActing('') }
  }

  if (loading) return <Layout><div className="flex justify-center h-64 items-center"><Spinner size={32} /></div></Layout>
  if (!request) return <Layout><div className="p-6 text-gray-500">Not found</div></Layout>

  const s          = request.status
  const isMyRequest = request.repId === user?.userId
  const canManage  = hasRole('admin','manager','ceo') || isMyRequest

  // Which actions to show
  const showEdit     = s === 'DRAFT'  && canManage
  const showSubmit   = s === 'DRAFT'  && canManage && request.lineItems?.length > 0
  const showCancel   = ['DRAFT','SUBMITTED'].includes(s) && canManage
  const showApprove  = s === 'SUBMITTED'  && hasRole('ceo','admin')
  const showReject   = s === 'SUBMITTED'  && hasRole('ceo','admin')
  const showDispatch = s === 'APPROVED'   && hasRole('back_office','admin')
  const showDeliver  = s === 'DISPATCHED' && hasRole('back_office','admin')
  const showAdoption = ['DELIVERED','PENDING_FOLLOW_UP'].includes(s) && canManage

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button onClick={() => navigate('/requests')}
            className="text-gray-500 hover:text-white text-sm">← Back</button>
          <h1 className="text-xl font-bold text-white font-display font-mono">{request.requestRef}</h1>
          <StatusChip value={s} />
        </div>

        {err && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">{err}</div>
        )}

        {/* Action bar */}
        {(showEdit||showSubmit||showCancel||showApprove||showReject||showDispatch||showDeliver||showAdoption) && (
          <div className="flex flex-wrap gap-2 mb-5 p-3 bg-white/3 border border-white/8 rounded-xl">
            {showEdit && (
              <button onClick={() => navigate(`/requests/${id}/edit`)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 text-gray-300 hover:text-white hover:bg-white/8 transition-all">
                ✏️ Edit Draft
              </button>
            )}
            {showEdit && (
              <button onClick={() => setSendFormOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 text-gray-300 hover:text-white hover:bg-white/8 transition-all">
                💬 Send to Faculty
              </button>
            )}
            {showSubmit && (
              <button onClick={() => action(() => compRequestsApi.submit(id), 'submit')}
                disabled={!!acting}
                className="btn-primary px-4 py-1.5 text-xs">
                {acting === 'submit' ? 'Submitting…' : 'Submit →'}
              </button>
            )}
            {showApprove && (
              <button onClick={() => action(() => workflowApi.approve(id), 'approve')}
                disabled={!!acting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-800/60 transition-all disabled:opacity-50">
                {acting === 'approve' ? 'Approving…' : '✓ Approve'}
              </button>
            )}
            {showReject && (
              <button onClick={() => setRejectOpen(true)} disabled={!!acting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-900/50 hover:bg-red-950/30 transition-all disabled:opacity-50">
                ✗ Reject
              </button>
            )}
            {showDispatch && (
              <button onClick={() => action(() => workflowApi.dispatch(id), 'dispatch')}
                disabled={!!acting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-900/60 text-purple-300 border border-purple-800/50 hover:bg-purple-800/60 transition-all disabled:opacity-50">
                {acting === 'dispatch' ? 'Updating…' : '📦 Mark Dispatched'}
              </button>
            )}
            {showDeliver && (
              <button onClick={() => action(() => workflowApi.deliver(id), 'deliver')}
                disabled={!!acting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-900/60 text-teal-300 border border-teal-800/50 hover:bg-teal-800/60 transition-all disabled:opacity-50">
                {acting === 'deliver' ? 'Updating…' : '🏠 Confirm Delivered'}
              </button>
            )}
            {showAdoption && (
              <>
                <button onClick={() => action(() => workflowApi.markAdoption(id, true), 'adopted')}
                  disabled={!!acting}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-800/60 transition-all disabled:opacity-50">
                  {acting === 'adopted' ? 'Marking…' : '✓ Adopted'}
                </button>
                <button onClick={() => action(() => workflowApi.markAdoption(id, false), 'not-adopted')}
                  disabled={!!acting}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-orange-400 border border-orange-900/50 hover:bg-orange-950/30 transition-all disabled:opacity-50">
                  {acting === 'not-adopted' ? 'Marking…' : '✗ Not Adopted'}
                </button>
              </>
            )}
            {showCancel && (
              <button onClick={() => action(() => compRequestsApi.cancel(id), 'cancel')}
                disabled={!!acting}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-950/20 transition-all ml-auto">
                Cancel Request
              </button>
            )}
          </div>
        )}

        {/* Rejection info */}
        {s === 'REJECTED' && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-xs font-semibold mb-0.5">Request Rejected</p>
            <p className="text-red-300 text-sm">{request.rejectionReason?.replace(/_/g,' ')}</p>
            {request.rejectionNotes && <p className="text-red-400/70 text-xs mt-1">{request.rejectionNotes}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Faculty */}
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Faculty</p>
            <p className="text-white font-semibold">{request.faculty?.facultyName ?? '—'}</p>
            <p className="text-gray-400 text-xs mt-0.5">{request.faculty?.designation}</p>
            <p className="text-gray-500 text-xs mt-1.5">{request.college?.collegeName}</p>
            <p className="text-gray-500 text-xs">{request.department?.deptName}</p>
            {request.faculty?.phonePersonal && (
              <p className="text-gray-400 text-xs mt-2 font-mono">📞 {request.faculty.phonePersonal}</p>
            )}
            {request.faculty?.dataQualityFlag === 'PENDING_REVIEW' && (
              <span className="text-amber-400 text-[10px] font-semibold mt-1.5 block">⚠️ PENDING REVIEW</span>
            )}
          </div>

          {/* Timeline */}
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Timeline</p>
            <InfoRow label="Visit Date"  value={request.requestDate} />
            <InfoRow label="Rep"         value={request.rep?.fullName} />
            {request.submittedAt  && <InfoRow label="Submitted"   value={Ts({ value: request.submittedAt })} />}
            {request.approvedAt   && <InfoRow label="Approved"    value={Ts({ value: request.approvedAt })} />}
            {request.rejectedAt   && <InfoRow label="Rejected"    value={Ts({ value: request.rejectedAt })} />}
            {request.dispatchedAt && <InfoRow label="Dispatched"  value={Ts({ value: request.dispatchedAt })} />}
            {request.deliveredAt  && <InfoRow label="Delivered"   value={Ts({ value: request.deliveredAt })} />}
            {request.adoptionMarkedAt && <InfoRow label="Adoption Marked" value={Ts({ value: request.adoptionMarkedAt })} />}
          </div>
        </div>

        {/* Dispatch */}
        <div className="card p-4 mb-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Dispatch</p>
          <InfoRow label="Type" value={request.dispatchType === 'college' ? 'College address' : 'Alternate address'} />
          {request.dispatchType !== 'college' && (
            <>
              {request.altRecipientName && <InfoRow label="Recipient" value={request.altRecipientName} />}
              {request.altAddress       && <InfoRow label="Address"   value={request.altAddress} />}
              {request.altCity          && <InfoRow label="City"      value={request.altCity} />}
              {request.altPin           && <InfoRow label="PIN"       value={request.altPin} />}
            </>
          )}
          {request.visitNotes && <InfoRow label="Visit Notes" value={request.visitNotes} />}
        </div>

        {/* Books */}
        <div className="card p-4 mb-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Books ({request.lineItems?.length ?? 0})
          </p>
          {!request.lineItems?.length
            ? <p className="text-gray-600 text-sm">No books added</p>
            : (
              <div className="divide-y divide-white/5">
                {request.lineItems.map(li => (
                  <div key={li.lineItemId} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{li.bookTitle}</p>
                      <p className="text-gray-500 text-xs">
                        {li.bookAuthors?.map(a => a.authorName).join(', ') || 'No authors'}
                        {li.subjectContextFree ? ` · ${li.subjectContextFree}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-gray-400 text-xs font-mono">×{li.quantity}</span>
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{li.format}</span>
                      {li.dupOverride && <span className="text-amber-600 text-[10px]">dup ack</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Audit log */}
        {request.auditLog?.length > 0 && (
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Activity</p>
            <div className="space-y-2">
              {request.auditLog.map(e => (
                <div key={e.auditId} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-700 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-300 text-xs">
                      {e.fromStatus
                        ? <><span className="text-gray-500">{e.fromStatus.replace(/_/g,' ')}</span> → <strong>{e.toStatus.replace(/_/g,' ')}</strong></>
                        : <strong>{e.toStatus.replace(/_/g,' ')}</strong>}
                      {e.notes && <span className="text-gray-500"> · {e.notes}</span>}
                    </p>
                    <p className="text-gray-600 text-[10px] mt-0.5">{Ts({ value: e.changedAt })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <RejectModal open={rejectOpen} reasons={reasons}
        onClose={() => setRejectOpen(false)}
        onConfirm={async (code, notes) => {
          await action(() => workflowApi.reject(id, { reasonCode: code, reasonNotes: notes }), 'reject')
        }} />

      <SendFormModal
        open={sendFormOpen}
        onClose={() => setSendFormOpen(false)}
        request={request}
      />
    </Layout>
  )
}
