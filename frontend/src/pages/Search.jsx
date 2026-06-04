import { useState } from 'react'
import { Search as SearchIcon, Sparkles, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { searchApi } from '../api/client'

export default function Search() {
  const [query, setQuery] = useState('')
  const [aiQuestion, setAiQuestion] = useState('')
  const [results, setResults] = useState(null)
  const [aiAnswer, setAiAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const runSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const { data } = await searchApi.transactions(query)
      setResults(data)
    } catch {
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const askAi = async (e) => {
    e.preventDefault()
    if (!aiQuestion.trim()) return
    setAiLoading(true)
    setAiAnswer(null)
    try {
      const { data } = await searchApi.ask(aiQuestion)
      setAiAnswer(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'AI query failed')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">Search & AI Analysis</h1>

      {/* Keyword Search */}
      <div className="card p-6 mb-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <SearchIcon size={18} /> Keyword Search
        </h2>
        <form onSubmit={runSearch} className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="Search by description, payee, category, reference…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader size={16} className="animate-spin" /> : 'Search'}
          </button>
        </form>

        {results !== null && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-3">{results.length} result(s)</p>
            {results.length > 0 ? (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {results.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium">{t.description}</p>
                      <p className="text-xs text-gray-500">{t.date} · {t.payee || t.ai_category?.replace(/_/g, ' ')}</p>
                    </div>
                    <span className={`font-medium text-sm ${t.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.transaction_type === 'deposit' ? '+' : '-'}${t.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-6">No transactions matched your search</p>
            )}
          </div>
        )}
      </div>

      {/* AI Q&A */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
          <Sparkles size={18} className="text-blue-500" /> Ask AI About Your Finances
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Ask natural language questions about your transactions — GPT-4o will analyze your data and answer.
        </p>
        <form onSubmit={askAi} className="flex gap-3 mb-4">
          <input
            className="input flex-1"
            placeholder="e.g. What were my top 5 expenses last month? How much did I spend on utilities?"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
          />
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={aiLoading}>
            {aiLoading ? <Loader size={16} className="animate-spin" /> : 'Ask AI'}
          </button>
        </form>

        {aiLoading && (
          <div className="flex items-center gap-2 text-blue-600 text-sm py-4">
            <Loader size={16} className="animate-spin" />
            Analyzing your financial data…
          </div>
        )}

        {aiAnswer && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <p className="text-xs font-medium text-blue-600 mb-2">
              AI answer — {aiAnswer.transactions_analyzed} transactions analyzed
            </p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{aiAnswer.answer}</p>
          </div>
        )}

        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 font-medium mb-2">Example questions:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'What is my total spending on payroll?',
              'List all bank fees charged',
              'What are my largest single transactions?',
              'How much did I deposit in total?',
            ].map((q) => (
              <button
                key={q}
                onClick={() => setAiQuestion(q)}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
