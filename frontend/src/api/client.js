import axios from 'axios'

// Convert camelCase string to snake_case
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
}

// Recursively convert all object keys to snake_case
function keysToSnake(obj) {
  if (Array.isArray(obj)) return obj.map(keysToSnake)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toSnakeCase(k), keysToSnake(v)])
    )
  }
  return obj
}

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vni_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Convert query params from camelCase to snake_case
  // e.g. pageSize → page_size, collegeId → college_id, dqFlag → dq_flag
  if (config.params) {
    config.params = keysToSnake(config.params)
  }

  return config
})

// Global 401 handler — clear session and redirect to login
// Skip redirect for public routes (faculty tokenised forms don't use auth)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? ''
      const isPublicRoute = url.includes('/public/')
      if (!isPublicRoute) {
        localStorage.removeItem('vni_token')
        localStorage.removeItem('vni_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
