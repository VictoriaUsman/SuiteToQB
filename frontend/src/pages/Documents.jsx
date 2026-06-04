import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Trash2, Download, BarChart2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { documentsApi, reportsApi } from '../api/client'

const statusColors = {
  done: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700 animate-pulse',
  pending: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700',
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
    refetchInterval: (query) => query.state.data?.some((d) => d.status === 'processing' || d.status === 'pending') ? 3000 : false,
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
    const { data } = await reportsApi.pdf(doc.id)
    downloadBlob(data, `${doc.original_filename.replace(/\.[^/.]+$/, '')}_report.pdf`)
  }

  const exportExcel = async (doc) => {
    const { data } = await reportsApi.excel(doc.id)
    downloadBlob(data, `${doc.original_filename.replace(/\.[^/.]+$/, '')}_report.xlsx`)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Documents</h1>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-8 ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={36} className="mx-auto text-gray-400 mb-3" />
        <p className="text-base font-medium text-gray-700">
          {isDragActive ? 'Drop files here' : 'Drag & drop files, or click to browse'}
        </p>
        <p className="text-sm text-gray-500 mt-1">PDF, Excel, CSV, and image files supported (max 50MB)</p>
        {uploadProgress !== null && (
          <div className="mt-4 max-w-xs mx-auto">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">{uploadProgress}%</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No documents yet. Upload your first bank statement above.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['File', 'Type', 'Institution', 'Period', 'Deposits', 'Withdrawals', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gray-400 shrink-0" />
                      <span className="font-medium truncate max-w-[180px]" title={doc.original_filename}>{doc.original_filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 uppercase text-gray-500">{doc.file_type}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{doc.institution_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {doc.statement_period_start ? `${doc.statement_period_start} – ${doc.statement_period_end}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">
                    {doc.total_deposits != null ? `$${doc.total_deposits.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-red-500 font-medium">
                    {doc.total_withdrawals != null ? `$${doc.total_withdrawals.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusColors[doc.status] || 'bg-gray-100 text-gray-600'}`}>{doc.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {doc.status === 'done' && (
                        <>
                          <button onClick={() => exportPdf(doc)} title="Export PDF" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                            <BarChart2 size={15} />
                          </button>
                          <button onClick={() => exportExcel(doc)} title="Export Excel" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                            <Download size={15} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(doc.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
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
