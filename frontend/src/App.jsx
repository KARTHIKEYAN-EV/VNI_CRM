import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import Dashboard          from './pages/Dashboard'
import Login              from './pages/Login'
import MasterData         from './pages/MasterData'
import Regions            from './pages/Regions'
import Colleges           from './pages/Colleges'
import Departments        from './pages/Departments'
import Faculty            from './pages/Faculty'
import Books              from './pages/Books'
import Authors            from './pages/Authors'
import Courses            from './pages/Courses'
import Subjects           from './pages/Subjects'
import Syllabi            from './pages/Syllabi'
import CompRequests       from './pages/CompRequests'
import CompRequestNew     from './pages/CompRequestNew'
import CompRequestDetail  from './pages/CompRequestDetail'
import WorkflowQueue      from './pages/WorkflowQueue'
import FollowUpQueue      from './pages/FollowUpQueue'
import FacultyForm        from './pages/FacultyForm'
import FacultyNewRequestForm from './pages/FacultyNewRequestForm'
import Reports            from './pages/Reports'
import Users              from './pages/Users'

// Shorthand: wraps in ProtectedRoute with optional role restriction
const Priv = ({ children, roles }) => (
  <ProtectedRoute roles={roles}>{children}</ProtectedRoute>
)

// Role sets (keeps route declarations readable)
const ALL_STAFF   = ['rep', 'manager', 'ceo', 'admin', 'back_office']
const FIELD_STAFF = ['rep', 'manager', 'ceo', 'admin']
const MGMT        = ['manager', 'ceo', 'admin']
const APPROVAL    = ['ceo', 'admin']
const FULFILMENT  = ['back_office', 'admin']
const ADMIN_ONLY  = ['admin']

export default function App() {
  return (
    <Routes>
      {/* ── Public / unauthenticated ──────────────────────────────────── */}
      <Route path="/login"               element={<Login />} />
      <Route path="/form/:token"         element={<FacultyForm />} />
      <Route path="/new-request/:token"  element={<FacultyNewRequestForm />} />

      {/* ── Dashboard — all roles ─────────────────────────────────────── */}
      <Route path="/dashboard" element={<Priv><Dashboard /></Priv>} />

      {/* ── Comp Requests — all staff ─────────────────────────────────── */}
      <Route path="/requests"          element={<Priv roles={ALL_STAFF}><CompRequests /></Priv>} />
      <Route path="/requests/new"      element={<Priv roles={FIELD_STAFF}><CompRequestNew /></Priv>} />
      <Route path="/requests/:id"      element={<Priv roles={ALL_STAFF}><CompRequestDetail /></Priv>} />
      <Route path="/requests/:id/edit" element={<Priv roles={FIELD_STAFF}><CompRequestNew /></Priv>} />

      {/* ── Workflow Queue ─────────────────────────────────────────────── */}
      {/* Each role sees a different view inside WorkflowQueue */}
      <Route path="/workflow"    element={<Priv roles={ALL_STAFF}><WorkflowQueue /></Priv>} />

      {/* ── Follow-ups — reps, managers, ceo, admin ───────────────────── */}
      <Route path="/follow-ups"  element={<Priv roles={FIELD_STAFF}><FollowUpQueue /></Priv>} />

      {/* ── Reports — managers, ceo, admin, back_office ───────────────── */}
      <Route path="/reports"     element={<Priv roles={[...MGMT, 'back_office']}><Reports /></Priv>} />

      {/* ── Master data — admin only for config pages ─────────────────── */}
      <Route path="/master-data" element={<Priv roles={ADMIN_ONLY}><MasterData /></Priv>} />
      <Route path="/regions"     element={<Priv roles={ADMIN_ONLY}><Regions /></Priv>} />
      <Route path="/authors"     element={<Priv roles={ADMIN_ONLY}><Authors /></Priv>} />

      {/* ── Master data — field staff can read ────────────────────────── */}
      <Route path="/colleges"    element={<Priv roles={FIELD_STAFF}><Colleges /></Priv>} />
      <Route path="/departments" element={<Priv roles={FIELD_STAFF}><Departments /></Priv>} />
      <Route path="/faculty"     element={<Priv roles={FIELD_STAFF}><Faculty /></Priv>} />
      <Route path="/books"       element={<Priv roles={ALL_STAFF}><Books /></Priv>} />

      {/* ── Academic ──────────────────────────────────────────────────── */}
      <Route path="/courses"     element={<Priv roles={FIELD_STAFF}><Courses /></Priv>} />
      <Route path="/subjects"    element={<Priv roles={FIELD_STAFF}><Subjects /></Priv>} />
      <Route path="/syllabi"     element={<Priv roles={FIELD_STAFF}><Syllabi /></Priv>} />

      {/* ── User management — admin only ──────────────────────────────── */}
      <Route path="/users"       element={<Priv roles={ADMIN_ONLY}><Users /></Priv>} />

      {/* ── Fallbacks ─────────────────────────────────────────────────── */}
      <Route path="/"  element={<Navigate to="/dashboard" replace />} />
      <Route path="*"  element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
