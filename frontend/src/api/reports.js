import api from './client'

const r = (path, params) => api.get(`/reports/${path}`, { params })

export const reportsApi = {
  compSummary:      (p) => r('comp-summary',       p),
  subjectCoverage:  (p) => r('subject-coverage',   p),
  collegeCoverage:  (p) => r('college-coverage',   p),
  bookComping:      (p) => r('book-comping',        p),
  adoptionRate:     (p) => r('adoption-rate',       p),
  pendingFollowUps: (p) => r('pending-follow-ups',  p),
  fulfilmentTat:    (p) => r('fulfilment-tat',      p),
  printRunImpact:   (p) => r('print-run-impact',    p),
}

// ---------------------------------------------------------------------------
// Frontend CSV export — avoids a second network round-trip for small datasets
// ---------------------------------------------------------------------------
export function downloadCsv(rows, columns, filename) {
  if (!rows?.length) return
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map(c => c.label).join(',')
  const body   = rows.map(row => columns.map(c => escape(row[c.key])).join(',')).join('\n')
  const blob   = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
