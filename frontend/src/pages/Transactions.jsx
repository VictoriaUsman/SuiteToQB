import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, RefreshCw, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { transactionsApi, quickbooksApi } from '../api/client'

const typeColors = {
  deposit: 'bg-green-100 text-green-700',
  withdrawal: 'bg-red-100 text-red-700',
  transfer: 'bg-blue-100 text-blue-700',
  fee: 'bg-orange-100 text-orange-700',
  interest: 'bg-purple-100 text-purple-700',
}

export default function Transactions() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ transaction_type: '', ai_category: '', is_reviewed: '' })
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
    onError: (err) => toast.error(err.response?.data?.detail || 'Sync failed. Is QuickBooks connected?'),
  })

  const toggleSelect = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  const toggleAll = () => setSelected(selected.length === txns.length ? [] : txns.map((t) => t.id))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        {selected.length > 0 && (
          <button
            onClick={() => syncToQb.mutate(selected)}
            disabled={syncToQb.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={16} className={syncToQb.isPending ? 'animate-spin' : ''} />
            Sync {selected.length} to QuickBooks
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <select
          className="input w-auto"
          value={filters.transaction_type}
          onChange={(e) => setFilters({ ...filters, transaction_type: e.target.value })}
        >
          <option value="">All types</option>
          {['deposit', 'withdrawal', 'transfer', 'fee', 'interest'].map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filters.is_reviewed}
          onChange={(e) => setFilters({ ...filters, is_reviewed: e.target.value })}
        >
          <option value="">All review status</option>
          <option value="false">Needs review</option>
          <option value="true">Reviewed</option>
        </select>
        <button onClick={() => setFilters({ transaction_type: '', ai_category: '', is_reviewed: '' })} className="btn-secondary text-sm">
          Clear
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={selected.length === txns.length && txns.length > 0} onChange={toggleAll} className="rounded" />
                </th>
                {['Date', 'Description', 'Payee', 'Type', 'AI Category', 'Amount', 'QB', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {txns.map((txn) => (
                <tr key={txn.id} className={`hover:bg-gray-50 ${selected.includes(txn.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.includes(txn.id)} onChange={() => toggleSelect(txn.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{txn.date}</td>
                  <td className="px-4 py-3 max-w-[220px] truncate" title={txn.description}>{txn.description}</td>
                  <td className="px-4 py-3 max-w-[140px] truncate text-gray-600">{txn.payee || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${typeColors[txn.transaction_type] || 'bg-gray-100 text-gray-600'}`}>
                      {txn.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {txn.ai_category?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—'}
                    {txn.ai_confidence && <span className="text-gray-400 ml-1">({Math.round(txn.ai_confidence * 100)}%)</span>}
                  </td>
                  <td className={`px-4 py-3 font-medium whitespace-nowrap ${txn.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {txn.transaction_type === 'deposit' ? '+' : '-'}${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    {txn.qb_synced ? (
                      <span className="badge bg-green-100 text-green-700">Synced</span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-500">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!txn.is_reviewed && (
                      <button onClick={() => markReviewed.mutate(txn.id)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-green-600 transition-colors" title="Mark reviewed">
                        <CheckCircle size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {txns.length === 0 && (
            <p className="text-center py-12 text-gray-400">No transactions found</p>
          )}
        </div>
      )}
    </div>
  )
}
