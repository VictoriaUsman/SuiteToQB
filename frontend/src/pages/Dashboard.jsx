import { useQuery } from '@tanstack/react-query'
import { FileText, ArrowDownCircle, ArrowUpCircle, RefreshCw, TrendingUp, ArrowUpRight } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { transactionsApi, documentsApi } from '../api/client'
import { Link } from 'react-router-dom'

const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#f97316', '#84cc16']

const statusStyles = {
  done:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  processing: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  pending:    'bg-gray-100 text-gray-600',
  error:      'bg-red-50 text-red-600 ring-1 ring-red-200',
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, trend }) {
  return (
    <div className="card p-5 flex items-start justify-between group hover:shadow-card-hover transition-shadow">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <p className="text-xs text-emerald-600 font-medium flex items-center gap-0.5 mt-1">
            <ArrowUpRight size={12} />{trend}
          </p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-card text-xs">
      <p className="font-semibold text-gray-700 capitalize">{payload[0].name?.replace(/_/g, ' ')}</p>
      <p className="text-gray-500">${payload[0].value?.toLocaleString()}</p>
    </div>
  )
}

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['txn-stats'],
    queryFn: () => transactionsApi.stats().then((r) => r.data),
  })
  const { data: docs } = useQuery({
    queryKey: ['docs'],
    queryFn: () => documentsApi.list({ limit: 5 }).then((r) => r.data),
  })

  const deposits     = stats?.by_type?.deposit?.total || 0
  const withdrawals  = stats?.by_type?.withdrawal?.total || 0
  const total        = stats?.total || 0
  const categoryData = (stats?.by_category || []).slice(0, 6).map((c) => ({
    name: c.category?.replace(/_/g, ' ') || 'other',
    value: Math.round(c.total || 0),
  }))

  // Build monthly trend from docs
  const monthlyData = (docs || [])
    .filter((d) => d.status === 'done')
    .slice(0, 6)
    .reverse()
    .map((d) => ({
      month: d.statement_period_start?.slice(0, 7) || '',
      deposits: d.total_deposits || 0,
      withdrawals: d.total_withdrawals || 0,
    }))

  return (
    <div className="p-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard
          label="Total Transactions"
          value={total.toLocaleString()}
          icon={TrendingUp}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          trend="All time"
        />
        <StatCard
          label="Total Deposits"
          value={`$${(deposits / 1000).toFixed(1)}k`}
          icon={ArrowDownCircle}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Total Withdrawals"
          value={`$${(withdrawals / 1000).toFixed(1)}k`}
          icon={ArrowUpCircle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
        />
        <StatCard
          label="Unsynced to QB"
          value={stats?.unsynced_count || 0}
          icon={RefreshCw}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">
        {/* Area chart — 3/5 width */}
        <div className="card p-6 lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Cash Flow</h2>
              <p className="text-xs text-gray-400 mt-0.5">Monthly deposits vs withdrawals</p>
            </div>
          </div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="gradDeposit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradWithdraw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="deposits" name="Deposits"
                  stroke="#6366f1" strokeWidth={2} fill="url(#gradDeposit)" dot={false} />
                <Area type="monotone" dataKey="withdrawals" name="Withdrawals"
                  stroke="#ef4444" strokeWidth={2} fill="url(#gradWithdraw)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">
              Upload documents to see cash flow
            </div>
          )}
        </div>

        {/* Donut chart — 2/5 width */}
        <div className="card p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-900">Spending by Category</h2>
            <p className="text-xs text-gray-400 mt-0.5">Top 6 withdrawal categories</p>
          </div>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, '']} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent documents */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Recent Documents</h2>
            <p className="text-xs text-gray-400 mt-0.5">Latest uploaded bank statements</p>
          </div>
          <Link to="/documents" className="text-xs text-indigo-600 font-medium hover:underline">
            View all
          </Link>
        </div>
        {docs?.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {docs.map((doc) => (
              <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.original_filename}</p>
                    <p className="text-xs text-gray-400">
                      {doc.institution_name || doc.file_type.toUpperCase()}
                      {doc.statement_period_start && ` · ${doc.statement_period_start}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {doc.total_deposits != null && (
                    <span className="text-xs font-medium text-emerald-600">
                      +${doc.total_deposits.toLocaleString()}
                    </span>
                  )}
                  <span className={`badge ${statusStyles[doc.status] || 'bg-gray-100 text-gray-600'}`}>
                    {doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
              <FileText size={20} className="text-indigo-400" />
            </div>
            <p className="text-sm text-gray-400 mb-3">No documents yet</p>
            <Link to="/documents" className="btn-primary">Upload your first document</Link>
          </div>
        )}
      </div>
    </div>
  )
}
