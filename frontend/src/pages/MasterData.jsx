import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader, StatusBadge } from '../components/ui'
import { collegesApi, facultyApi } from '../api/master'
import { useAuth } from '../auth/AuthContext'

const SECTIONS = [
  {
    title: 'Core Entities',
    cards: [
      { label: 'Regions',     icon: '🗺️', path: '/regions',     desc: 'Sales territories' },
      { label: 'Colleges',    icon: '🏫', path: '/colleges',    desc: 'Colleges across Tamil Nadu' },
      { label: 'Departments', icon: '📂', path: '/departments', desc: 'Academic departments' },
      { label: 'Faculty',     icon: '👤', path: '/faculty',     desc: 'Faculty receiving comp copies' },
      { label: 'Books',       icon: '📚', path: '/books',       desc: '600+ title catalog' },
      { label: 'Authors',     icon: '✍️', path: '/authors',     desc: 'Book authors' },
    ],
  },
  {
    title: 'Academic Hierarchy',
    cards: [
      { label: 'Courses',  icon: '🎓', path: '/courses',  desc: 'B.Com, B.E. and other programmes' },
      { label: 'Subjects', icon: '📖', path: '/subjects', desc: 'Papers within a course' },
      { label: 'Syllabi',  icon: '📄', path: '/syllabi',  desc: 'Unit breakdown + prescribed books' },
    ],
  },
]

export default function MasterData() {
  const navigate    = useNavigate()
  const { hasRole } = useAuth()
  const isAdmin     = hasRole('admin')

  const [pendingColleges, setPendingColleges] = useState([])
  const [pendingFaculty,  setPendingFaculty]  = useState([])
  const [loading,         setLoading]         = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    Promise.all([
      collegesApi.list({ dqFlag: 'PENDING_REVIEW', pageSize: 5 }),
      facultyApi.list({  dqFlag: 'PENDING_REVIEW', pageSize: 5 }),
    ]).then(([c, f]) => {
      setPendingColleges(c.data.items)
      setPendingFaculty(f.data.items)
    }).finally(() => setLoading(false))
  }, [isAdmin])

  const totalPending = pendingColleges.length + pendingFaculty.length

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <PageHeader title="Master Data" subtitle="Foundation records for the comp copy system" />

        {SECTIONS.map(section => (
          <div key={section.title} className="mb-8">
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-widest mb-3">
              {section.title}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {section.cards.map(({ label, icon, path, desc }) => (
                <button key={path} onClick={() => navigate(path)}
                  className="card p-4 text-left hover:border-brand-red/30 hover:bg-white/4 transition-all group">
                  <span className="text-2xl mb-2 block">{icon}</span>
                  <p className="text-white font-medium text-sm group-hover:text-brand-red transition-colors">{label}</p>
                  <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Pending review queue — Admin only */}
        {isAdmin && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold font-display">Pending Review Queue</h2>
                <p className="text-gray-500 text-xs mt-0.5">On-the-fly field additions awaiting verification</p>
              </div>
              {totalPending > 0 && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
                  {totalPending} pending
                </span>
              )}
            </div>

            {loading ? <p className="text-gray-600 text-sm">Loading…</p>
              : totalPending === 0 ? (
                <div className="flex items-center gap-2 py-2">
                  <span className="text-xl">✅</span>
                  <p className="text-gray-500 text-sm">All clear — no records pending review</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingColleges.length > 0 && (
                    <PendingList title="Colleges" items={pendingColleges}
                      labelKey="collegeName" detailKey="addressCity"
                      onClick={() => navigate('/colleges?dqFlag=PENDING_REVIEW')} />
                  )}
                  {pendingFaculty.length > 0 && (
                    <PendingList title="Faculty" items={pendingFaculty}
                      labelKey="facultyName" detailFn={r => r.college?.collegeName}
                      onClick={() => navigate('/faculty?dqFlag=PENDING_REVIEW')} />
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </Layout>
  )
}

function PendingList({ title, items, labelKey, detailKey, detailFn, onClick }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{title}</p>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-amber-950/20 border border-amber-900/30 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-white text-sm font-medium">{item[labelKey]}</p>
              <p className="text-gray-500 text-xs">{detailFn ? detailFn(item) : item[detailKey]}</p>
            </div>
            <StatusBadge value="PENDING_REVIEW" />
          </div>
        ))}
      </div>
      <button onClick={onClick} className="mt-2 text-xs text-amber-500 hover:text-amber-300 transition-colors">
        Review all →
      </button>
    </div>
  )
}
