import { useState } from 'react'

/**
 * Generic data table.
 *
 * columns: Array<{
 *   key:       string          — used for sort key
 *   header:    string          — column header label
 *   render:    (row) => node   — cell renderer
 *   sortable?: boolean
 *   width?:    string          — Tailwind width class e.g. "w-40"
 * }>
 *
 * actions: (row) => Array<{ label, onClick, danger? }>
 */
export default function DataTable({
  columns,
  rows,
  actions,
  keyField = 'id',
  loading  = false,
  emptyNode,
}) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey] ?? ''
        const bv = b[sortKey] ?? ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : rows

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-6 w-6 text-gray-600" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor"
                  strokeWidth="3" strokeDasharray="40" strokeDashoffset="15" />
        </svg>
      </div>
    )
  }

  if (!rows.length && emptyNode) return emptyNode

  return (
    <div className="overflow-x-auto rounded-xl border border-white/8">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 bg-white/3">
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => col.sortable && toggleSort(col.key)}
                className={`
                  px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider
                  ${col.sortable ? 'cursor-pointer hover:text-white select-none' : ''}
                  ${col.width ?? ''}
                `}
              >
                {col.header}
                {col.sortable && sortKey === col.key && (
                  <span className="ml-1 text-brand-red">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
            {actions && (
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-24">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sorted.map(row => {
            const rowActions = actions ? actions(row) : []
            return (
              <tr key={row[keyField]} className="hover:bg-white/3 transition-colors group">
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 text-gray-300 ${col.width ?? ''}`}>
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {rowActions.map(action => (
                        <button
                          key={action.label}
                          onClick={() => action.onClick(row)}
                          title={action.label}
                          className={`
                            px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                            ${action.danger
                              ? 'text-red-400 hover:bg-red-950/50'
                              : 'text-gray-400 hover:bg-white/8 hover:text-white'
                            }
                          `}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
