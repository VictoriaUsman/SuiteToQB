import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Trash2, Download, BarChart2, CloudUpload } from 'lucide-react'
import toast from 'react-hot-toast'
import { documentsApi, reportsApi } from '../api/client'

const statusStyles = {
  done:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  processing: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 animate-pulse',
  pending:    'bg-gray-100 text-gray-500',
  error:      'bg-red-50 text-red-600 ring-1 ring-red-200',
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Documents() {
  const qc = useQueryClient()
  const [uploadProgress, setUploadProgress] = useState(null)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['docs'],
    queryFn: () => documentsApi.list().then((r) => r.data),
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === 'processing' || d.status === 'pending') ? 3000 : false,
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => documentsApi.upload(file, setUploadProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs'] })
      toast.success('Document uploaded — AI extraction started')
      setUploadProgress(null)
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Upload failed')
      setUploadProgress(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => documentsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docs'] }); toast.success('Deleted') },
    onError: () => toast.error('Delete failed'),
  })

  const onDrop = useCallback((files) => {
    files.forEach((file) => uploadMutation.mutate(file))
  }, [uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'],
    },
    multiple: true,
  })

  const exportPdf = async (doc) => {
    try {
      const { data } = await reportsApi.pdf(doc.id)
      downloadBlob(data, `${doc.original_filename.replace(/\.[^/.]+$/, '')}_report.pdf`)
    } catch { toast.error('Failed to generate PDF') }
  }

  const exportExcel = async (doc) => {
    try {
      const { data } = await reportsApi.excel(doc.id)
      downloadBlob(data, `${doc.original_filename.replace(/\.[^/.]+$/, '')}_report.xlsx`)
    } catch { toast.error('Failed to generate Excel') }
  }

  return (
    <div className="p-8">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-7 ${
          isDragActive
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <CloudUpload size={26} className={isDragActive ? 'text-indigo-600' : 'text-indigo-400'} />
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-1">
          {isDragActive ? 'Drop files here' : 'Drag & drop files, or click to browse'}
        </p>
        <p className="text-xs text-gray-400">PDF, Excel, CSV, PNG, JPG — max 50 MB each</p>

        {uploadProgress !== null && (
          <div className="mt-5 max-w-xs mx-auto">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Uploading…</span><span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-300 text-sm">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <FileText size={22} className="text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">No documents yet — upload your first bank statement above</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['File', 'Type', 'Institution', 'Period', 'Deposits', 'Withdrawals', 'Status', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-indigo-500" />
                      </div>
                      <span className="font-medium text-gray-800 truncate max-w-[160px]" title={doc.original_filename}>
                        {doc.original_filename}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="badge bg-gray-100 text-gray-500 uppercase">{doc.file_type}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 max-w-[130px] truncate">{doc.institution_name || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                    {doc.statement_period_start
                      ? `${doc.statement_period_start} – ${doc.statement_period_end}`
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-emerald-600">
                    {doc.total_deposits != null ? `$${doc.total_deposits.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-red-500">
                    {doc.total_withdrawals != null ? `$${doc.total_withdrawals.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`badge ${statusStyles[doc.status] || 'bg-gray-100 text-gray-500'}`}
                      title={doc.status === 'error' && doc.error_message ? doc.error_message : undefined}
                    >
                      {doc.status}
                    </span>
                    {doc.status === 'error' && doc.error_message && (
                      <p className="text-xs text-red-500 mt-1 max-w-[220px] truncate" title={doc.error_message}>
                        {doc.error_message}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      {doc.status === 'done' && (
                        <>
                          <button onClick={() => exportPdf(doc)} title="Export PDF"
                            className="w-7 h-7 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 flex items-center justify-center transition-colors">
                            <BarChart2 size={14} />
                          </button>
                          <button onClick={() => exportExcel(doc)} title="Export Excel"
                            className="w-7 h-7 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 flex items-center justify-center transition-colors">
                            <Download size={14} />
                          </button>
                        </>
                      )}
                      <button onClick={() => deleteMutation.mutate(doc.id)}
                        className="w-7 h-7 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 flex items-center justify-center transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
