import api from './client'

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------
export const coursesApi = {
  list:      (params)   => api.get('/courses', { params }),
  listAll:   (params)   => api.get('/courses/all', { params }),
  get:       (id)       => api.get(`/courses/${id}`),
  create:    (data)     => api.post('/courses', data),
  update:    (id, data) => api.put(`/courses/${id}`, data),
  deactivate:(id)       => api.delete(`/courses/${id}`),
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
export const subjectsApi = {
  list:             (params)   => api.get('/subjects', { params }),
  listAll:          (params)   => api.get('/subjects/all', { params }),
  get:              (id)       => api.get(`/subjects/${id}`),
  create:           (data)     => api.post('/subjects', data),
  update:           (id, data) => api.put(`/subjects/${id}`, data),
  deactivate:       (id)       => api.delete(`/subjects/${id}`),
  listFaculty:      (subjectId) => api.get(`/subjects/${subjectId}/faculty`),
  assignFaculty:    (data)     => api.post('/subjects/faculty-assignments', data),
  removeFaculty:    (id)       => api.delete(`/subjects/faculty-assignments/${id}`),
}

// ---------------------------------------------------------------------------
// Syllabi
// ---------------------------------------------------------------------------
export const syllabiApi = {
  list:        (params)          => api.get('/syllabi', { params }),
  get:         (id)              => api.get(`/syllabi/${id}`),
  create:      (data)            => api.post('/syllabi', data),
  update:      (id, data)        => api.put(`/syllabi/${id}`, data),
  deactivate:  (id)              => api.delete(`/syllabi/${id}`),
  assignBook:  (id, data)        => api.post(`/syllabi/${id}/books`, data),
  removeBook:  (syllabusId, bookId) => api.delete(`/syllabi/${syllabusId}/books/${bookId}`),
}
