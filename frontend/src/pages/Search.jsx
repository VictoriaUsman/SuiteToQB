import { useState } from 'react'
import { Search as SearchIcon, Sparkles, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { searchApi } from '../api/client'

const EXAMPLE_QUESTIONS = [
  'What is my total spending on payroll?',
  'List all bank fees charged',
  'What are my largest single transactions?',
  'How much did I deposit in total?',
]

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
    if (aiQuestion.trim().length < 3) return
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
    <div className="p-8 max-w-3xl">
      {/* Keyword search */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
            <SearchIcon size={15} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Keyword Search</h2>
            <p className="text-xs text-gray-400">Search by description, payee, category, or reference number</p>
          </div>
        </div>
        <form onSubmit={runSearch} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="e.g. Shell, Amazon, payroll, #123456…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-primary px-5" disabled={loading}>
            {loading ? <Loader size={15} className="animate-spin" /> : 'Search'}
          </button>
        </form>

        {results !== null && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-3 font-medium">{results.length} result{results.length !== 1 ? 's' : ''}</p>
            {results.length > 0 ? (
              <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {results.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.date}
                        {t.payee && ` · ${t.payee}`}
                        {t.ai_category && ` · ${t.ai_category.replace(/_/g, ' ')}`}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ml-4 ${
                      t.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {t.transaction_type === 'deposit' ? '+' : '-'}${t.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-300 text-sm py-8">No transactions matched</p>
            )}
          </div>
        )}
      </div>

      {/* AI Q&A */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Sparkles size={15} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Ask AI</h2>
            <p className="text-xs text-gray-400">GPT-4o answers questions about your transaction data</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 mb-4">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setAiQuestion(q)}
              className="text-xs px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-full text-indigo-600 font-medium transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        <form onSubmit={askAi} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Ask anything about your finances…"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
          />
          <button type="submit" className="btn-primary px-5 whitespace-nowrap" disabled={aiLoading || aiQuestion.trim().length < 3}>
            {aiLoading ? <Loader size={15} className="animate-spin" /> : 'Ask'}
          </button>
        </form>

        {aiLoading && (
          <div className="flex items-center gap-2 text-indigo-500 text-xs mt-4">
            <Loader size={13} className="animate-spin" />
            Analyzing your financial data…
          </div>
        )}

        {aiAnswer && (
          <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
            <p className="text-xs font-semibold text-indigo-500 mb-2 uppercase tracking-wide">
              GPT-4o · {aiAnswer.transactions_analyzed} transactions analyzed
            </p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{aiAnswer.answer}</p>
          </div>
        )}
      </div>
    </div>
  )
}
