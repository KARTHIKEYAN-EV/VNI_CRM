import api from './client'

export const compRequestsApi = {
  list:               (params)   => api.get('/comp-requests', { params }),
  get:                (id)       => api.get(`/comp-requests/${id}`),
  create:             (data)     => api.post('/comp-requests', data),
  update:             (id, data) => api.put(`/comp-requests/${id}`, data),
  submit:             (id, data) => api.post(`/comp-requests/${id}/submit`, data ?? {}),
  cancel:             (id, data) => api.post(`/comp-requests/${id}/cancel`, data ?? {}),
  checkLineDuplicate: (data)     => api.post('/comp-requests/line-duplicate-check', data),
}

// Phase E — Approval & Fulfilment actions
export const workflowApi = {
  rejectionReasons: ()           => api.get('/comp-requests/rejection-reasons'),
  approve:          (id, data)   => api.post(`/comp-requests/${id}/approve`,       data ?? {}),
  reject:           (id, data)   => api.post(`/comp-requests/${id}/reject`,        data),
  dispatch:         (id, data)   => api.post(`/comp-requests/${id}/dispatch`,      data ?? {}),
  deliver:          (id, data)   => api.post(`/comp-requests/${id}/deliver`,       data ?? {}),
  markAdoption:     (id, adopted, notes) =>
    api.post(`/comp-requests/${id}/mark-adoption`, { adopted, notes }),
}

// Phase F — Token / faculty form
export const tokensApi = {
  sendForm:    (requestId, data)  => api.post(`/comp-requests/${requestId}/send-form`, data),
  listTokens:  (requestId)        => api.get(`/comp-requests/${requestId}/tokens`),
  getForm:     (tokenHash)        => api.get(`/public/form/${tokenHash}`),
  submitForm:  (tokenHash, data)  => api.post(`/public/form/${tokenHash}`, data),
  searchBooks: (tokenHash, q)     => api.get(`/public/form/${tokenHash}/books`, { params: { q } }),
}

// Phase I — New-request token (faculty-initiated blank form)
export const newRequestTokensApi = {
  // Authenticated: rep generates a blank form token for a faculty member
  create:     (data)             => api.post('/new-request-tokens', data),
  list:       (params)           => api.get('/new-request-tokens', { params }),

  // Public: no auth required
  getForm:    (tokenHash)        => api.get(`/public/new-request-form/${tokenHash}`),
  searchBooks:(tokenHash, q)     => api.get(`/public/new-request-form/${tokenHash}/books`, { params: { q } }),
  submit:     (tokenHash, data)  => api.post(`/public/new-request-form/${tokenHash}`, data),
}
