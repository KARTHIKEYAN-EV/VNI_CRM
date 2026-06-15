import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader, EmptyState, Spinner } from '../components/ui'
import { compRequestsApi, workflowApi } from '../api/comp_requests'
import api from '../api/client'
import { useAuth } from '../auth/AuthContext'

// ---------------------------------------------------------------------------
// Days badge
// ---------------------------------------------------------------------------
function DaysBadge({ deliveredAt }) {
  if (!deliveredAt) return <span style={{ color: '#4b5563', fontSize: 12 }}>—</span>
  const days = Math.floor((Date.now() - new Date(deliveredAt)) / 86400000)
  const s = days >= 60
    ? { bg: 'rgba(69,10,10,0.5)', border: 'rgba(248,113,113,0.25)', text: '#fca5a5' }
    : days >= 30
    ? { bg: 'rgba(78,63,7,0.5)',  border: 'rgba(251,191,36,0.25)',  text: '#fde68a' }
    : { bg: 'rgba(7,89,133,0.5)', border: 'rgba(56,189,248,0.25)',  text: '#7dd3fc' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {days}d
    </span>
  )
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------
function StatusPill({ value }) {
  const isPending = value === 'PENDING_FOLLOW_UP'
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
      background: isPending ? 'rgba(78,63,7,0.5)'   : 'rgba(19,78,74,0.5)',
      border: `1px solid ${isPending ? 'rgba(251,191,36,0.25)' : 'rgba(45,212,191,0.25)'}`,
      color: isPending ? '#fde68a' : '#99f6e4',
    }}>
      {isPending ? 'FOLLOW UP' : 'DELIVERED'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Request card
// ---------------------------------------------------------------------------
function FollowUpCard({ request, onAction, acting }) {
  const navigate  = useNavigate()
  const busy      = acting === request.requestId

  return (
    <div className={`card p-4 transition-all ${busy ? 'opacity-60' : ''}`}>
      <div className="flex flex-col xs:flex-row items-start justify-between gap-3">

        {/* Left — request info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <button
              onClick={() => navigate(`/requests/${request.requestId}`)}
              className="text-brand-blue font-mono text-xs font-semibold hover:underline">
              {request.requestRef}
            </button>
            <StatusPill value={request.status} />
            <DaysBadge deliveredAt={request.deliveredAt} />
          </div>

          <p className="text-white font-semibold text-sm">
            {request.faculty?.facultyName ?? '—'}
          </p>
          <p className="text-gray-500 text-xs">
            {request.college?.collegeName}
            {request.department?.deptName ? ` · ${request.department.deptName}` : ''}
          </p>

          {/* Books summary */}
          {request.lineItems?.length > 0 && (
            <p className="text-gray-600 text-xs mt-1.5">
              {request.lineItems.slice(0, 2).map(li => li.bookTitle).join(', ')}
              {request.lineItems.length > 2 ? ` + ${request.lineItems.length - 2} more` : ''}
            </p>
          )}

          {/* Contact info */}
          {request.faculty?.phonePersonal && (
            <p className="text-gray-600 text-xs mt-1 font-mono">
              📞 {request.faculty.phonePersonal}
            </p>
          )}
        </div>

        {/* Right — action buttons */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => onAction(request.requestId, true)}
            disabled={busy}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
              background: 'rgba(6,78,59,0.5)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.3)',
              opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap', transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'rgba(6,78,59,0.7)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(6,78,59,0.5)' }}
          >
            ✓ Adopted
          </button>
          <button
            onClick={() => onAction(request.requestId, false)}
            disabled={busy}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
              background: 'transparent', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)',
              opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap', transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'rgba(67,20,7,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            ✗ Not Adopted
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function FollowUpQueue() {
  const { hasRole } = useAuth()

  const [delivered,       setDelivered]       = useState([])
  const [pendingFollowUp, setPendingFollowUp] = useState([])
  const [loading,         setLoading]         = useState(true)
  const [acting,          setActing]          = useState(null)
  const [triggerLoading,  setTriggerLoading]  = useState(false)
  const [triggerResult,   setTriggerResult]   = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      compRequestsApi.list({ status: 'DELIVERED',         pageSize: 100 }),
      compRequestsApi.list({ status: 'PENDING_FOLLOW_UP', pageSize: 100 }),
    ]).then(([d, p]) => {
      setDelivered(d.data.items)
      setPendingFollowUp(p.data.items)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdoption(requestId, adopted) {
    setActing(requestId)
    try {
      await workflowApi.markAdoption(requestId, adopted)
      load()
    } finally { setActing(null) }
  }

  async function handleTriggerCheck() {
    setTriggerLoading(true); setTriggerResult(null)
    try {
      const { data } = await api.post('/admin/follow-up-check')
      setTriggerResult(data)
      load()
    } finally { setTriggerLoading(false) }
  }

  const allItems  = [...pendingFollowUp, ...delivered]
  const totalCount = allItems.length

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-3xl">
        <PageHeader
          title="Adoption Follow-up"
          subtitle={`${totalCount} request${totalCount !== 1 ? 's' : ''} awaiting adoption marking`}
          action={
            hasRole('admin') && (
              <button
                onClick={handleTriggerCheck}
                disabled={triggerLoading}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/20 text-gray-400 hover:text-white hover:bg-white/8 transition-all disabled:opacity-50">
                {triggerLoading ? 'Running…' : '⚙ Run Follow-up Check'}
              </button>
            )
          }
        />

        {/* Trigger result banner */}
        {triggerResult && (
          <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-4 py-3 mb-5">
            <p className="text-emerald-400 text-sm">
              Follow-up check complete — {triggerResult.updated} request(s) transitioned to PENDING_FOLLOW_UP,{' '}
              {triggerResult.emails_sent} reminder email(s) sent.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : totalCount === 0 ? (
          <EmptyState
            icon="🎉"
            title="All caught up"
            subtitle="No delivered requests are awaiting adoption marking."
          />
        ) : (
          <div className="space-y-6">

            {/* Overdue — PENDING_FOLLOW_UP */}
            {pendingFollowUp.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                    Overdue Follow-up
                  </span>
                  <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pendingFollowUp.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {pendingFollowUp.map(r => (
                    <FollowUpCard
                      key={r.requestId}
                      request={r}
                      onAction={handleAdoption}
                      acting={acting}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recently delivered */}
            {delivered.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">
                    Recently Delivered
                  </span>
                  <span className="bg-teal-500/20 text-teal-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {delivered.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {delivered.map(r => (
                    <FollowUpCard
                      key={r.requestId}
                      request={r}
                      onAction={handleAdoption}
                      acting={acting}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
