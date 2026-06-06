import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, RefreshCw, SlidersHorizontal, AlertTriangle, ClipboardCheck, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { transactionsApi, quickbooksApi } from '../api/client'

const CONFIDENCE_THRESHOLD = 0.75

const CATEGORIES = [
  'payroll', 'rent', 'utilities', 'groceries', 'fuel', 'insurance',
  'taxes', 'loan_payment', 'transfer', 'bank_fee', 'interest_income',
  'sales_revenue', 'vendor_payment', 'office_supplies', 'travel',
  'entertainment', 'medical', 'other',
]

const typeStyles = {
  deposit:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  withdrawal: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  transfer:   'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  fee:        'bg-orange-50 text-orange-600 ring-1 ring-orange-200',
  interest:   'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
}

function confidenceColor(score) {
  if (score == null) return 'text-gray-300'
  if (score >= 0.85) return 'text-emerald-600'
  if (score >= 0.65) return 'text-amber-500'
  return 'text-red-500 font-semibold'
}

function ConfidenceBadge({ score }) {
  if (score == null) return <span className="text-gray-300">—</span>
  return (
    <span className={`text-xs ${confidenceColor(score)}`}>
      {Math.round(score * 100)}%
    </span>
  )
}

function formatCategory(cat) {
  return cat?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—'
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />
  return sort.dir === 'asc'
    ? <ChevronUp size={12} className="text-indigo-500 ml-1 inline" />
    : <ChevronDown size={12} className="text-indigo-500 ml-1 inline" />
}

const SORT_KEYS = {
  Date: 'date',
  Description: 'description',
  Payee: 'payee',
  Type: 'transaction_type',
  Category: 'ai_category',
  Confidence: 'ai_confidence',
  Amount: 'amount',
}

function applySorting(rows, sort) {
  if (!sort.col) return rows
  return [...rows].sort((a, b) => {
    const av = a[sort.col] ?? ''
    const bv = b[sort.col] ?? ''
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return sort.dir === 'asc' ? cmp : -cmp
  })
}

export default function Transactions() {
  const qc = useQueryClient()
  const [mode, setMode] = useState('all') // 'all' | 'review'
  const [filters, setFilters] = useState({ transaction_type: '', is_reviewed: '' })
  const [selected, setSelected] = useState([])
  const [editingCategory, setEditingCategory] = useState(null) // { id, value }
  const [sort, setSort] = useState({ col: null, dir: 'asc' })

  const toggleSort = (header) => {
    const col = SORT_KEYS[header]
    if (!col) return
    setSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    )
  }

  const { data: stats } = useQuery({
    queryKey: ['txn-stats'],
    queryFn: () => transactionsApi.stats().then((r) => r.data),
  })

  const queryParams =
    mode === 'review'
      ? { is_reviewed: 'false', max_confidence: CONFIDENCE_THRESHOLD, limit: 200 }
      : Object.fromEntries(
          Object.entries({ ...filters, limit: 200 }).filter(([, v]) => v !== '')
        )

  const { data: rawTxns = [], isLoading } = useQuery({
    queryKey: ['transactions', mode, filters],
    queryFn: () => transactionsApi.list(queryParams).then((r) => r.data),
  })

  const txns = useMemo(() => applySorting(rawTxns, sort), [rawTxns, sort])

  const markReviewed = useMutation({
    mutationFn: (id) => transactionsApi.update(id, { is_reviewed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['txn-stats'] })
    },
  })

  const updateCategory = useMutation({
    mutationFn: ({ id, category }) => transactionsApi.update(id, { ai_category: category }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setEditingCategory(null)
      toast.success('Category updated')
    },
    onError: () => toast.error('Failed to update category'),
  })

  const bulkApprove = useMutation({
    mutationFn: (ids) => transactionsApi.bulkReview(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['txn-stats'] })
      toast.success(`Approved ${res.data.approved} transaction(s)`)
      setSelected([])
    },
    onError: () => toast.error('Bulk approve failed'),
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
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleAll = () =>
    setSelected(selected.length === txns.length ? [] : txns.map((t) => t.id))

  const needsReview = stats?.needs_review ?? 0

  const switchMode = (next) => {
    setMode(next)
    setSelected([])
    setEditingCategory(null)
  }

  return (
    <div className="p-8">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => switchMode('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All Transactions
        </button>
        <button
          onClick={() => switchMode('review')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === 'review'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle size={14} />
          Review Queue
          {needsReview > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full leading-none">
              {needsReview}
            </span>
          )}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {mode === 'all' ? (
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
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
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
        ) : (
          <p className="text-sm text-gray-400">
            Unreviewed transactions with AI confidence below {Math.round(CONFIDENCE_THRESHOLD * 100)}%.
            Click a category to correct it, then approve.
          </p>
        )}

        <div className="flex items-center gap-2">
          {selected.length > 0 && mode === 'review' && (
            <button
              onClick={() => bulkApprove.mutate(selected)}
              disabled={bulkApprove.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              <ClipboardCheck size={14} />
              Approve {selected.length} selected
            </button>
          )}
          {selected.length > 0 && mode === 'all' && (
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
                {[
                  'Date',
                  'Description',
                  'Payee',
                  'Type',
                  'Category',
                  'Confidence',
                  'Amount',
                  ...(mode === 'all' ? ['QB'] : []),
                  '',
                ].map((h) => {
                  const sortable = h in SORT_KEYS
                  return (
                    <th
                      key={h}
                      onClick={() => sortable && toggleSort(h)}
                      className={`px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide select-none ${sortable ? 'cursor-pointer hover:text-gray-600' : ''}`}
                    >
                      {h}
                      {sortable && <SortIcon col={SORT_KEYS[h]} sort={sort} />}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {txns.map((txn) => (
                <tr
                  key={txn.id}
                  className={`transition-colors ${
                    selected.includes(txn.id) ? 'bg-indigo-50/60' : 'hover:bg-gray-50/60'
                  }`}
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
                  <td
                    className="px-5 py-3 max-w-[200px] truncate font-medium text-gray-800"
                    title={txn.description}
                  >
                    {txn.description}
                  </td>
                  <td className="px-5 py-3 max-w-[130px] truncate text-gray-500 text-xs">
                    {txn.payee || '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`badge ${typeStyles[txn.transaction_type] || 'bg-gray-100 text-gray-500'}`}
                    >
                      {txn.transaction_type}
                    </span>
                  </td>

                  {/* Category — editable in review mode */}
                  <td className="px-5 py-3">
                    {mode === 'review' && editingCategory?.id === txn.id ? (
                      <select
                        autoFocus
                        className="text-xs border border-indigo-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={editingCategory.value}
                        onChange={(e) => setEditingCategory({ id: txn.id, value: e.target.value })}
                        onBlur={() => {
                          if (editingCategory.value !== txn.ai_category) {
                            updateCategory.mutate({ id: txn.id, category: editingCategory.value })
                          } else {
                            setEditingCategory(null)
                          }
                        }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {formatCategory(c)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() =>
                          mode === 'review' &&
                          setEditingCategory({ id: txn.id, value: txn.ai_category || 'other' })
                        }
                        className={`text-xs text-gray-500 text-left ${
                          mode === 'review'
                            ? 'hover:text-indigo-600 hover:underline cursor-pointer'
                            : 'cursor-default'
                        }`}
                        title={mode === 'review' ? 'Click to edit category' : undefined}
                      >
                        {formatCategory(txn.ai_category)}
                      </button>
                    )}
                  </td>

                  <td className="px-5 py-3">
                    <ConfidenceBadge score={txn.ai_confidence} />
                  </td>

                  <td
                    className={`px-5 py-3 font-semibold whitespace-nowrap ${
                      txn.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {txn.transaction_type === 'deposit' ? '+' : '-'}$
                    {txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>

                  {mode === 'all' && (
                    <td className="px-5 py-3">
                      {txn.qb_synced ? (
                        <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                          Synced
                        </span>
                      ) : (
                        <span className="badge bg-gray-100 text-gray-400">Pending</span>
                      )}
                    </td>
                  )}

                  <td className="px-5 py-3">
                    {mode === 'review' ? (
                      <button
                        onClick={() => markReviewed.mutate(txn.id)}
                        disabled={markReviewed.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg ring-1 ring-emerald-200 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={12} />
                        Approve
                      </button>
                    ) : (
                      !txn.is_reviewed && (
                        <button
                          onClick={() => markReviewed.mutate(txn.id)}
                          className="w-7 h-7 rounded-lg hover:bg-emerald-50 text-gray-300 hover:text-emerald-500 flex items-center justify-center transition-colors"
                          title="Mark reviewed"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {txns.length === 0 && (
            <p className="text-center py-14 text-gray-300 text-sm">
              {mode === 'review'
                ? 'No transactions need review — all categorized with high confidence.'
                : 'No transactions found'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
