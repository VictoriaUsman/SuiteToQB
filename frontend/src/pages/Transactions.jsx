import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, RefreshCw, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import { transactionsApi, quickbooksApi } from '../api/client'

const typeStyles = {
  deposit:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  withdrawal: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  transfer:   'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  fee:        'bg-orange-50 text-orange-600 ring-1 ring-orange-200',
  interest:   'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
}

export default function Transactions() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ transaction_type: '', is_reviewed: '' })
  const [selected, setSelected] = useState([])

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      return transactionsApi.list({ ...params, limit: 200 }).then((r) => r.data)
    },
  })

  const markReviewed = useMutation({
    mutationFn: (id) => transactionsApi.update(id, { is_reviewed: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })

  const syncToQb = useMutation({
    mutationFn: (ids) => quickbooksApi.sync(ids),
    onSuccess: (res) => {
      const { synced, failed } = res.data
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['txn-stats'] })
      toast.success(`Synced ${synced.length} transaction(s) to QuickBooks`)
      if (failed.length > 0) toast.error(`${failed.length} failed to sync`)
      setSelected([])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Sync failed — is QuickBooks connected?'),
  })

  const toggleSelect = (id) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  const toggleAll = () =>
    setSelected(selected.length === txns.length ? [] : txns.map((t) => t.id))

  return (
    <div className="p-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <SlidersHorizontal size={14} className="text-gray-400" />
            <select
              className="text-sm text-gray-700 bg-transparent focus:outline-none"
              value={filters.transaction_type}
              onChange={(e) => setFilters({ ...filters, transaction_type: e.target.value })}
            >
              <option value="">All types</option>
              {['deposit', 'withdrawal', 'transfer', 'fee', 'interest'].map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <select
              className="text-sm text-gray-700 bg-transparent focus:outline-none"
              value={filters.is_reviewed}
              onChange={(e) => setFilters({ ...filters, is_reviewed: e.target.value })}
            >
              <option value="">All status</option>
              <option value="false">Needs review</option>
              <option value="true">Reviewed</option>
            </select>
          </div>
          {(filters.transaction_type || filters.is_reviewed) && (
            <button
              onClick={() => setFilters({ transaction_type: '', is_reviewed: '' })}
              className="text-xs text-indigo-600 font-medium hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {selected.length > 0 && (
          <button
            onClick={() => syncToQb.mutate(selected)}
            disabled={syncToQb.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={14} className={syncToQb.isPending ? 'animate-spin' : ''} />
            Sync {selected.length} to QuickBooks
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-300 text-sm">Loading…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3.5 text-left">
                  <input
                    type="checkbox"
                    checked={selected.length === txns.length && txns.length > 0}
                    onChange={toggleAll}
                    className="rounded accent-indigo-600"
                  />
                </th>
                {['Date', 'Description', 'Payee', 'Type', 'Category', 'Amount', 'QB', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {txns.map((txn) => (
                <tr
                  key={txn.id}
                  className={`transition-colors ${selected.includes(txn.id) ? 'bg-indigo-50/60' : 'hover:bg-gray-50/60'}`}
                >
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(txn.id)}
                      onChange={() => toggleSelect(txn.id)}
                      className="rounded accent-indigo-600"
                    />
                  </td>
                  <td className="px-5 py-3 text-gray-400 whitespace-nowrap text-xs">{txn.date}</td>
                  <td className="px-5 py-3 max-w-[200px] truncate font-medium text-gray-800" title={txn.description}>
                    {txn.description}
                  </td>
                  <td className="px-5 py-3 max-w-[130px] truncate text-gray-500 text-xs">{txn.payee || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${typeStyles[txn.transaction_type] || 'bg-gray-100 text-gray-500'}`}>
                      {txn.transaction_type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {txn.ai_category?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—'}
                    {txn.ai_confidence && (
                      <span className="text-gray-300 ml-1">({Math.round(txn.ai_confidence * 100)}%)</span>
                    )}
                  </td>
                  <td className={`px-5 py-3 font-semibold whitespace-nowrap ${
                    txn.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {txn.transaction_type === 'deposit' ? '+' : '-'}$
                    {txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3">
                    {txn.qb_synced ? (
                      <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Synced</span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-400">Pending</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {!txn.is_reviewed && (
                      <button
                        onClick={() => markReviewed.mutate(txn.id)}
                        className="w-7 h-7 rounded-lg hover:bg-emerald-50 text-gray-300 hover:text-emerald-500 flex items-center justify-center transition-colors"
                        title="Mark reviewed"
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {txns.length === 0 && (
            <p className="text-center py-14 text-gray-300 text-sm">No transactions found</p>
          )}
        </div>
      )}
    </div>
  )
}
