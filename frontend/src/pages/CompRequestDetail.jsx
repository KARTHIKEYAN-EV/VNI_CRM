import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Spinner, StatusBadge } from '../components/ui'
import { compRequestsApi, workflowApi } from '../api/comp_requests'
import { useAuth } from '../auth/AuthContext'
import SendFormModal from '../components/SendFormModal'

function Ts({ value }) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: 14, textAlign: 'right', maxWidth: '65%' }}>{value ?? '—'}</span>
    </div>
  )
}

/* ── Rejection modal (CEO) ──────────────────────────────────────────────── */
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
      <div className="card p-6 w-full max-w-sm shadow-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <h3 style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'Sora, sans-serif', marginBottom: 16 }}>Reject Request</h3>
        {err && <p style={{ color: 'var(--error-text)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
        <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Reason *</label>
        <select className="input text-sm mb-3" value={code} onChange={e => setCode(e.target.value)}>
          <option value="">Select reason…</option>
          {reasons.map(r => <option key={r.reasonCode} value={r.reasonCode}>{r.reasonLabel}</option>)}
        </select>
        {sel?.requiresNotes && (
          <textarea className="input text-sm min-h-[64px] resize-none mb-3"
            value={notes} onChange={e => setNotes(e.target.value)} placeholder="Please specify…" />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          <button onClick={go} disabled={busy}
            style={{
              padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 500,
              background: 'var(--error-bg)', color: 'var(--error-text)',
              border: '1px solid var(--error-border)', cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}>
            {busy ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────────── */
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
  if (!request) return <Layout><div style={{ padding: '1.5rem', color: 'var(--muted)' }}>Not found</div></Layout>

  const s          = request.status
  const isMyRequest = request.repId === user?.userId
  const canManage  = hasRole('admin','manager','ceo') || isMyRequest

  const showEdit     = s === 'DRAFT'  && canManage
  const showSubmit   = s === 'DRAFT'  && canManage && request.lineItems?.length > 0
  const showCancel   = ['DRAFT','SUBMITTED'].includes(s) && canManage
  const showApprove  = s === 'SUBMITTED'  && hasRole('ceo','admin')
  const showReject   = s === 'SUBMITTED'  && hasRole('ceo','admin')
  const showDispatch = s === 'APPROVED'   && hasRole('back_office','admin')
  const showDeliver  = s === 'DISPATCHED' && hasRole('back_office','admin')
  const showAdoption = ['DELIVERED','PENDING_FOLLOW_UP'].includes(s) && canManage

  // Helper styles for action buttons – using accent colours that remain visible on both themes
  const accentStyle = (accentVar) => ({
    background: `var(${accentVar}-bg)`,
    color: `var(${accentVar}-text)`,
    border: `1px solid var(${accentVar}-border)`,
  })

  return (
    <Layout>
      {/* Transparent background – shows starfield */}
      <div style={{ padding: '1.5rem', maxWidth: '48rem', minHeight: '100vh', background: 'transparent' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/requests')}
            style={{ color: 'var(--muted)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>
            {request.requestRef}
          </h1>
          <StatusBadge value={s} />
        </div>

        {err && (
          <div style={{
            background: 'var(--error-bg)', border: '1px solid var(--error-border)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            color: 'var(--error-text)', fontSize: 13,
          }}>
            {err}
          </div>
        )}

        {/* Action bar */}
        {(showEdit||showSubmit||showCancel||showApprove||showReject||showDispatch||showDeliver||showAdoption) && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20,
            padding: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
          }}>
            {showEdit && (
              <button onClick={() => navigate(`/requests/${id}/edit`)}
                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
              >
                ✏️ Edit Draft
              </button>
            )}
            {showEdit && (
              <button onClick={() => setSendFormOpen(true)}
                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
              >
                💬 Send to Faculty
              </button>
            )}
            {showSubmit && (
              <button onClick={() => action(() => compRequestsApi.submit(id), 'submit')} disabled={!!acting}
                className="btn-primary" style={{ padding: '6px 16px', fontSize: 12 }}>
                {acting === 'submit' ? 'Submitting…' : 'Submit →'}
              </button>
            )}
            {showApprove && (
              <button onClick={() => action(() => workflowApi.approve(id), 'approve')} disabled={!!acting}
                style={{ ...accentStyle('--accent-emerald'), padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {acting === 'approve' ? 'Approving…' : '✓ Approve'}
              </button>
            )}
            {showReject && (
              <button onClick={() => setRejectOpen(true)} disabled={!!acting}
                style={{ ...accentStyle('--accent-red'), padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ✗ Reject
              </button>
            )}
            {showDispatch && (
              <button onClick={() => action(() => workflowApi.dispatch(id), 'dispatch')} disabled={!!acting}
                style={{ ...accentStyle('--accent-purple'), padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {acting === 'dispatch' ? 'Updating…' : '📦 Mark Dispatched'}
              </button>
            )}
            {showDeliver && (
              <button onClick={() => action(() => workflowApi.deliver(id), 'deliver')} disabled={!!acting}
                style={{ ...accentStyle('--accent-teal'), padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {acting === 'deliver' ? 'Updating…' : '🏠 Confirm Delivered'}
              </button>
            )}
            {showAdoption && (
              <>
                <button onClick={() => action(() => workflowApi.markAdoption(id, true), 'adopted')} disabled={!!acting}
                  style={{ ...accentStyle('--accent-emerald'), padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {acting === 'adopted' ? 'Marking…' : '✓ Adopted'}
                </button>
                <button onClick={() => action(() => workflowApi.markAdoption(id, false), 'not-adopted')} disabled={!!acting}
                  style={{ ...accentStyle('--accent-orange'), padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {acting === 'not-adopted' ? 'Marking…' : '✗ Not Adopted'}
                </button>
              </>
            )}
            {showCancel && (
              <button onClick={() => action(() => compRequestsApi.cancel(id), 'cancel')} disabled={!!acting}
                style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--error-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none' }}
              >
                Cancel Request
              </button>
            )}
          </div>
        )}

        {/* Rejection info */}
        {s === 'REJECTED' && (
          <div style={{
            background: 'var(--error-bg)', border: '1px solid var(--error-border)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          }}>
            <p style={{ color: 'var(--error-text)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Request Rejected</p>
            <p style={{ color: 'var(--error-text)', fontSize: 14 }}>{request.rejectionReason?.replace(/_/g,' ')}</p>
            {request.rejectionNotes && <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{request.rejectionNotes}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Faculty card */}
          <div className="card p-4">
            <p style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Faculty</p>
            <p style={{ color: 'var(--text)', fontWeight: 600 }}>{request.faculty?.facultyName ?? '—'}</p>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{request.faculty?.designation}</p>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>{request.college?.collegeName}</p>
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>{request.department?.deptName}</p>
            {request.faculty?.phonePersonal && (
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8, fontFamily: 'monospace' }}>📞 {request.faculty.phonePersonal}</p>
            )}
            {request.faculty?.dataQualityFlag === 'PENDING_REVIEW' && (
              <span style={{ color: 'var(--warning)', fontSize: 10, fontWeight: 600, marginTop: 8, display: 'block' }}>⚠️ PENDING REVIEW</span>
            )}
          </div>

          {/* Timeline card */}
          <div className="card p-4">
            <p style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Timeline</p>
            <InfoRow label="Visit Date"  value={request.requestDate} />
            <InfoRow label="Rep"         value={request.rep?.fullName} />
            {request.submittedAt  && <InfoRow label="Submitted"   value={<Ts value={request.submittedAt} />} />}
            {request.approvedAt   && <InfoRow label="Approved"    value={<Ts value={request.approvedAt} />} />}
            {request.rejectedAt   && <InfoRow label="Rejected"    value={<Ts value={request.rejectedAt} />} />}
            {request.dispatchedAt && <InfoRow label="Dispatched"  value={<Ts value={request.dispatchedAt} />} />}
            {request.deliveredAt  && <InfoRow label="Delivered"   value={<Ts value={request.deliveredAt} />} />}
            {request.adoptionMarkedAt && <InfoRow label="Adoption Marked" value={<Ts value={request.adoptionMarkedAt} />} />}
          </div>
        </div>

        {/* Dispatch card */}
        <div className="card p-4 mb-4">
          <p style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Dispatch</p>
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

        {/* Books card */}
        <div className="card p-4 mb-4">
          <p style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Books ({request.lineItems?.length ?? 0})
          </p>
          {!request.lineItems?.length ? (
            <p style={{ color: 'var(--faint)', fontSize: 14 }}>No books added</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {request.lineItems.map(li => (
                <div key={li.lineItemId} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{li.bookTitle}</p>
                    <p style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {li.bookAuthors?.map(a => a.authorName).join(', ') || 'No authors'}
                      {li.subjectContextFree ? ` · ${li.subjectContextFree}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'monospace' }}>×{li.quantity}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--input)', padding: '2px 8px', borderRadius: 4 }}>{li.format}</span>
                    {li.dupOverride && <span style={{ color: '#d97706', fontSize: 10 }}>dup ack</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit log card */}
        {request.auditLog?.length > 0 && (
          <div className="card p-4">
            <p style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Activity</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {request.auditLog.map(e => (
                <div key={e.auditId} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--faint)', marginTop: 6, flexShrink: 0 }} />
                  <div>
                    <p style={{ color: 'var(--text)', fontSize: 13 }}>
                      {e.fromStatus
                        ? <><span style={{ color: 'var(--muted)' }}>{e.fromStatus.replace(/_/g,' ')}</span> → <strong>{e.toStatus.replace(/_/g,' ')}</strong></>
                        : <strong>{e.toStatus.replace(/_/g,' ')}</strong>}
                      {e.notes && <span style={{ color: 'var(--muted)' }}> · {e.notes}</span>}
                    </p>
                    <p style={{ color: 'var(--faint)', fontSize: 10, marginTop: 2 }}>{<Ts value={e.changedAt} />}</p>
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
