import { useQuery } from '@tanstack/react-query'
import { FileText, Download, BarChart2, Building2 } from 'lucide-react'
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
    } catch { toast.error('Failed to generate PDF') }
  }

  const exportExcel = async (doc) => {
    try {
      const { data } = await reportsApi.excel(doc.id)
      downloadBlob(data, `${doc.original_filename.replace(/\.[^/.]+$/, '')}_report.xlsx`)
      toast.success('Excel downloaded')
    } catch { toast.error('Failed to generate Excel') }
  }

  if (doneDocs.length === 0) {
    return (
      <div className="p-8">
        <div className="card p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <BarChart2 size={22} className="text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">No processed documents yet. Upload and process a document first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="grid gap-4">
        {doneDocs.map((doc) => (
          <div key={doc.id} className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm">{doc.original_filename}</h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    {doc.institution_name && (
                      <>
                        <Building2 size={11} />
                        <span>{doc.institution_name}</span>
                        <span>·</span>
                      </>
                    )}
                    {doc.statement_period_start && (
                      <span>{doc.statement_period_start} to {doc.statement_period_end}</span>
                    )}
                  </div>

                  {/* Financials row */}
                  <div className="flex flex-wrap gap-4 mt-3">
                    {doc.total_deposits != null && (
                      <div className="bg-emerald-50 rounded-xl px-3 py-1.5">
                        <p className="text-xs text-emerald-600 font-medium">Deposits</p>
                        <p className="text-sm font-bold text-emerald-700">${doc.total_deposits.toLocaleString()}</p>
                      </div>
                    )}
                    {doc.total_withdrawals != null && (
                      <div className="bg-red-50 rounded-xl px-3 py-1.5">
                        <p className="text-xs text-red-500 font-medium">Withdrawals</p>
                        <p className="text-sm font-bold text-red-600">${doc.total_withdrawals.toLocaleString()}</p>
                      </div>
                    )}
                    {doc.ending_balance != null && (
                      <div className="bg-gray-50 rounded-xl px-3 py-1.5">
                        <p className="text-xs text-gray-500 font-medium">Ending Balance</p>
                        <p className="text-sm font-bold text-gray-700">${doc.ending_balance.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {doc.ai_summary && (
                    <p className="text-xs text-gray-400 mt-3 leading-relaxed max-w-xl">{doc.ai_summary}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => exportPdf(doc)} className="btn-secondary flex items-center gap-2 text-xs">
                  <BarChart2 size={13} /> PDF
                </button>
                <button onClick={() => exportExcel(doc)} className="btn-primary flex items-center gap-2 text-xs">
                  <Download size={13} /> Excel
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
