import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../api/client'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', full_name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        const { data } = await authApi.login(form.email, form.password)
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('user', JSON.stringify(data.user))
        navigate('/')
      } else {
        await authApi.register(form)
        toast.success('Account created — please sign in')
        setMode('login')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#1e1b4b' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ backgroundColor: '#1e1b4b' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center">
            <Layers size={18} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg">AccountingSuite</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            AI-powered financial<br />document extraction
          </h2>
          <p className="text-indigo-300 text-sm leading-relaxed max-w-sm">
            Upload bank statements and financial documents. GPT-4o extracts every transaction,
            categorizes it, and syncs it directly to QuickBooks — in seconds.
          </p>
          <div className="flex flex-wrap gap-2 mt-8">
            {['GPT-4o Extraction', 'OCR Support', 'QuickBooks Sync', 'PDF & Excel Reports'].map((tag) => (
              <span key={tag} className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-indigo-200 font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <p className="text-indigo-500 text-xs">Financial Platform v1.0</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Layers size={16} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900">AccountingSuite</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-sm text-gray-400 mb-7">
            {mode === 'login' ? 'Sign in to your account' : 'Get started for free'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full name</label>
                <input className="input" placeholder="Jane Smith"
                  value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <input className="input" type="email" placeholder="you@company.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <input className="input" type="password" placeholder="••••••••"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                required minLength={8} />
            </div>
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}
            <button type="submit" className="btn-primary w-full py-2.5 text-sm" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-center text-gray-400 mt-5">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button className="text-indigo-600 font-semibold hover:underline"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {mode === 'login' && (
            <div className="mt-5 p-3.5 bg-indigo-50 rounded-xl text-center">
              <p className="text-xs text-indigo-600 font-medium">Demo credentials</p>
              <p className="text-xs text-indigo-400 mt-0.5">demo@accountingsuite.com · demo1234</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
