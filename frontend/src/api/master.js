import api from './client'

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------
export const regionsApi = {
  list:      (params) => api.get('/regions', { params }),
  listAll:   ()       => api.get('/regions/all'),
  get:       (id)     => api.get(`/regions/${id}`),
  create:    (data)   => api.post('/regions', data),
  update:    (id, data) => api.put(`/regions/${id}`, data),
  deactivate:(id)     => api.delete(`/regions/${id}`),
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const usersApi = {
  list:      (params)   => api.get('/users', { params }),
  me:        ()         => api.get('/users/me'),
  get:       (id)       => api.get(`/users/${id}`),
  create:    (data)     => api.post('/users', data),
  update:    (id, data) => api.put(`/users/${id}`, data),
  deactivate:(id)       => api.delete(`/users/${id}`),
}

// ---------------------------------------------------------------------------
// Colleges
// ---------------------------------------------------------------------------
export const collegesApi = {
  list:           (params)   => api.get('/colleges', { params }),
  listAll:        (params)   => api.get('/colleges/all', { params }),
  search:         (q, limit) => api.get('/colleges/search', { params: { q, limit } }),
  checkDuplicate: (data)     => api.post('/colleges/check-duplicate', data),
  get:            (id)       => api.get(`/colleges/${id}`),
  create:         (data)     => api.post('/colleges', data),
  update:         (id, data) => api.put(`/colleges/${id}`, data),
  deactivate:     (id)       => api.delete(`/colleges/${id}`),
  approve:        (id)       => api.patch(`/colleges/${id}/approve`),
  reject:         (id, notes) => api.patch(`/colleges/${id}/reject`, null, { params: { notes } }),
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
export const departmentsApi = {
  list:      (params)   => api.get('/departments', { params }),
  listAll:   (params)   => api.get('/departments/all', { params }),
  get:       (id)       => api.get(`/departments/${id}`),
  create:    (data)     => api.post('/departments', data),
  update:    (id, data) => api.put(`/departments/${id}`, data),
  deactivate:(id)       => api.delete(`/departments/${id}`),
}

// ---------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------
export const facultyApi = {
  list:           (params)    => api.get('/faculty', { params }),
  search:         (q, params) => api.get('/faculty/search', { params: { q, ...params } }),
  checkDuplicate: (data)      => api.post('/faculty/check-duplicate', data),
  get:            (id)        => api.get(`/faculty/${id}`),
  create:         (data)      => api.post('/faculty', data),
  update:         (id, data)  => api.put(`/faculty/${id}`, data),
  deactivate:     (id)        => api.delete(`/faculty/${id}`),
  approve:        (id)        => api.patch(`/faculty/${id}/approve`),
  reject:         (id, notes) => api.patch(`/faculty/${id}/reject`, null, { params: { notes } }),
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------
export const authorsApi = {
  list:      (params)   => api.get('/authors', { params }),
  listAll:   ()         => api.get('/authors/all'),
  get:       (id)       => api.get(`/authors/${id}`),
  create:    (data)     => api.post('/authors', data),
  update:    (id, data) => api.put(`/authors/${id}`, data),
  deactivate:(id)       => api.delete(`/authors/${id}`),
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------
export const booksApi = {
  list:      (params)   => api.get('/books', { params }),
  search:    (q, limit) => api.get('/books/search', { params: { q, limit } }),
  get:       (id)       => api.get(`/books/${id}`),
  create:    (data)     => api.post('/books', data),
  update:    (id, data) => api.put(`/books/${id}`, data),
  deactivate:(id)       => api.delete(`/books/${id}`),
}
