import { useQuery } from '@tanstack/react-query'
import { FileText, Download, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { documentsApi, reportsApi } from '../api/client'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { data: docs = [] } = useQuery({
    queryKey: ['docs'],
    queryFn: () => documentsApi.list().then((r) => r.data),
  })

  const doneDocs = docs.filter((d) => d.status === 'done')

  const exportPdf = async (doc) => {
    try {
      const { data } = await reportsApi.pdf(doc.id)
      downloadBlob(data, `${doc.original_filename.replace(/\.[^/.]+$/, '')}_report.pdf`)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to generate PDF')
    }
  }

  const exportExcel = async (doc) => {
    try {
      const { data } = await reportsApi.excel(doc.id)
      downloadBlob(data, `${doc.original_filename.replace(/\.[^/.]+$/, '')}_report.xlsx`)
      toast.success('Excel downloaded')
    } catch {
      toast.error('Failed to generate Excel')
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Reports</h1>
      <p className="text-gray-500 mb-8">Export processed documents as PDF or Excel reports</p>

      {doneDocs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart2 size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No processed documents yet. Upload and process documents first.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {doneDocs.map((doc) => (
            <div key={doc.id} className="card p-6 flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileText size={24} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{doc.original_filename}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {doc.institution_name && <span>{doc.institution_name} · </span>}
                    {doc.statement_period_start && (
                      <span>{doc.statement_period_start} to {doc.statement_period_end}</span>
                    )}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm">
                    {doc.total_deposits != null && (
                      <span className="text-emerald-600 font-medium">
                        Deposits: ${doc.total_deposits.toLocaleString()}
                      </span>
                    )}
                    {doc.total_withdrawals != null && (
                      <span className="text-red-500 font-medium">
                        Withdrawals: ${doc.total_withdrawals.toLocaleString()}
                      </span>
                    )}
                    {doc.ending_balance != null && (
                      <span className="text-gray-600 font-medium">
                        Balance: ${doc.ending_balance.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {doc.ai_summary && (
                    <p className="text-xs text-gray-500 mt-2 max-w-xl">{doc.ai_summary}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 ml-4">
                <button onClick={() => exportPdf(doc)} className="btn-secondary flex items-center gap-2 text-sm">
                  <BarChart2 size={15} /> PDF
                </button>
                <button onClick={() => exportExcel(doc)} className="btn-primary flex items-center gap-2 text-sm">
                  <Download size={15} /> Excel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
