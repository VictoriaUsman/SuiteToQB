import { useQuery } from '@tanstack/react-query'
import { FileText, ArrowDownCircle, ArrowUpCircle, RefreshCw, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { transactionsApi, documentsApi } from '../api/client'
import { Link } from 'react-router-dom'

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card p-6 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  )
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

export default function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ['txn-stats'], queryFn: () => transactionsApi.stats().then((r) => r.data) })
  const { data: docs } = useQuery({ queryKey: ['docs'], queryFn: () => documentsApi.list({ limit: 5 }).then((r) => r.data) })

  const deposits = stats?.by_type?.deposit?.total || 0
  const withdrawals = stats?.by_type?.withdrawal?.total || 0
  const total = stats?.total || 0
  const categoryData = stats?.by_category || []

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Transactions" value={total.toLocaleString()} icon={TrendingUp} color="bg-blue-600" />
        <StatCard label="Total Deposits" value={`$${deposits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={ArrowDownCircle} color="bg-emerald-600" />
        <StatCard label="Total Withdrawals" value={`$${withdrawals.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={ArrowUpCircle} color="bg-red-500" />
        <StatCard label="Unsynced to QB" value={stats?.unsynced_count || 0} icon={RefreshCw} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h2 className="text-base font-semibold mb-4">Spending by Category</h2>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData.slice(0, 8)} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={110}
                  tickFormatter={(v) => v?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || ''} />
                <Tooltip formatter={(v) => [`$${v?.toLocaleString()}`, 'Total']} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {categoryData.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-16">Upload documents to see category analysis</p>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Recent Documents</h2>
            <Link to="/documents" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          {docs?.length > 0 ? (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <FileText size={18} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.original_filename}</p>
                    <p className="text-xs text-gray-500">{doc.institution_name || doc.file_type.toUpperCase()}</p>
                  </div>
                  <span className={`badge ${
                    doc.status === 'done' ? 'bg-green-100 text-green-700' :
                    doc.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                    doc.status === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm mb-3">No documents yet</p>
              <Link to="/documents" className="btn-primary text-sm">Upload your first document</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
