import { useRef, useState } from 'react'

/**
 * CsvImportExport — drop-in component for admin data pages.
 *
 * Props:
 *   entityLabel     string        — e.g. "Books", "Faculty"
 *   onExport        async fn()    — called when Export button clicked
 *   onImport        async fn(file) → axios response with { imported, skipped, errors }
 *   templateHeaders string[]      — column names shown as a hint
 *   disabled        bool
 */
export default function CsvImportExport({
  entityLabel,
  onExport,
  onImport,
  templateHeaders,
  disabled = false,
}) {
  const fileRef = useRef(null)
  const [busy,   setBusy]   = useState(false)
  const [result, setResult] = useState(null)   // { imported, skipped, errors }
  const [error,  setError]  = useState('')

  async function handleExport() {
    setBusy(true)
    setError('')
    try {
      await onExport()
    } catch {
      setError('Export failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setError('Please select a .csv file.')
      return
    }
    setBusy(true)
    setResult(null)
    setError('')
    try {
      const { data } = await onImport(file)
      setResult(data)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Import failed. Check the file format.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-3 mb-5">
      {/* Button row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleExport}
          disabled={disabled || busy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/6 text-gray-300
                     hover:bg-white/10 border border-white/10 disabled:opacity-40 transition"
        >
          {busy ? 'Exporting…' : `↓ Export ${entityLabel} CSV`}
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/6 text-gray-300
                     hover:bg-white/10 border border-white/10 disabled:opacity-40 transition"
        >
          {busy ? 'Importing…' : `↑ Import ${entityLabel} CSV`}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />

        {templateHeaders && (
          <span className="text-[10px] text-gray-600">
            Columns: {templateHeaders.join(', ')}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Import result */}
      {result && (
        <div className="rounded-lg border border-white/8 bg-white/3 p-3 text-xs">
          <p className="text-gray-300 mb-1">
            <span className="text-green-400 font-semibold">{result.imported} imported</span>
            {result.skipped > 0 && (
              <span className="text-amber-400 font-semibold ml-3">{result.skipped} skipped</span>
            )}
          </p>
          {result.errors?.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto">
              <p className="text-gray-500 mb-1 uppercase tracking-wider text-[10px]">Row errors</p>
              {result.errors.map((e, idx) => (
                <div key={idx} className="flex gap-2 py-0.5">
                  <span className="text-gray-600 w-14 flex-shrink-0">Row {e.row}</span>
                  <span className="text-amber-300">{e.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
