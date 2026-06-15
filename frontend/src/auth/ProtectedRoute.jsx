import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Wrap any route that requires authentication.
 * Optionally pass `roles` to also enforce role-based access.
 *
 * <ProtectedRoute roles={["admin"]}>
 *   <AdminPage />
 * </ProtectedRoute>
 */
export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, hasRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // Preserve the attempted URL so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !hasRole(...roles)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center max-w-sm">
          <div className="text-3xl mb-3">🔒</div>
          <h2 className="text-white font-semibold font-display mb-2">Access Denied</h2>
          <p className="text-gray-500 text-sm">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    )
  }

  return children
}
