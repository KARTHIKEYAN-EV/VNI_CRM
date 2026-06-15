import api from './client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _triggerDownload(blob, filename) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

async function _download(url, params, filename) {
  const response = await api.get(url, { params, responseType: 'blob' })
  _triggerDownload(response.data, filename)
}

function _upload(url, file) {
  const form = new FormData()
  form.append('file', file)
  return api.post(url, form, {
    // The api instance sets a default 'Content-Type: application/json' header,
    // which axios won't override for FormData bodies (it only sets the
    // multipart boundary header if none is already present). Explicitly
    // delete it here so the browser can set 'multipart/form-data; boundary=...'.
    transformRequest: (data, headers) => {
      headers.delete('Content-Type')
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Export — each fn triggers a file download
// ---------------------------------------------------------------------------

export const exportApi = {
  authors:     ()           => _download('/export/authors',     null,                                        'vni_authors.csv'),
  books:       ()           => _download('/export/books',       null,                                        'vni_books.csv'),
  colleges:    (regionId)   => _download('/export/colleges',    regionId  ? { region_id:  regionId  } : null, 'vni_colleges.csv'),
  departments: (collegeId)  => _download('/export/departments', collegeId ? { college_id: collegeId } : null, 'vni_departments.csv'),
  faculty:     (collegeId)  => _download('/export/faculty',     collegeId ? { college_id: collegeId } : null, 'vni_faculty.csv'),
}

// ---------------------------------------------------------------------------
// Import — each fn returns the axios response (data = { imported, skipped, errors })
// ---------------------------------------------------------------------------

export const importApi = {
  authors:     (file) => _upload('/import/authors',     file),
  books:       (file) => _upload('/import/books',       file),
  colleges:    (file) => _upload('/import/colleges',    file),
  departments: (file) => _upload('/import/departments', file),
  faculty:     (file) => _upload('/import/faculty',     file),
}
