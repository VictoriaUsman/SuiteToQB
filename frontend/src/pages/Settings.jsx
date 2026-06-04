import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Link, Unlink, RefreshCw, User, Cpu } from 'lucide-react'
import toast from 'react-hot-toast'
import { quickbooksApi } from '../api/client'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

function SettingSection({ title, description, icon: Icon, children }) {
  return (
    <div className="card p-6 mb-5">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-50">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function Settings() {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (searchParams.get('qb') === 'connected') {
      toast.success('QuickBooks connected successfully!')
      qc.invalidateQueries({ queryKey: ['qb-status'] })
    }
  }, [searchParams])

  const { data: qbStatus } = useQuery({
    queryKey: ['qb-status'],
    queryFn: () => quickbooksApi.status().then((r) => r.data),
  })

  const connectMutation = useMutation({
    mutationFn: () => quickbooksApi.connect(),
    onSuccess: ({ data }) => { window.location.href = data.auth_url },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to start QB OAuth'),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => quickbooksApi.disconnect(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qb-status'] })
      toast.success('Disconnected from QuickBooks')
    },
    onError: () => toast.error('Disconnect failed'),
  })

  return (
    <div className="p-8 max-w-2xl">

      {/* Account */}
      <SettingSection title="Account" description="Your profile and login information" icon={User}>
        <div className="space-y-3">
          {[
            { label: 'Full name', value: user.full_name },
            { label: 'Email', value: user.email },
            { label: 'Role', value: user.is_admin ? 'Admin' : 'User' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-400 font-medium">{label}</span>
              <span className="text-sm font-medium text-gray-800">{value}</span>
            </div>
          ))}
        </div>
      </SettingSection>

      {/* QuickBooks */}
      <SettingSection
        title="QuickBooks Advanced"
        description="Connect your company to sync transactions directly"
        icon={RefreshCw}
      >
        {qbStatus?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Connected</p>
                <p className="text-xs text-emerald-600">{qbStatus.company_name}</p>
                <p className="text-xs text-emerald-500 mt-0.5">
                  Token expires {new Date(qbStatus.access_token_expires_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => connectMutation.mutate()} className="btn-secondary flex items-center gap-2 text-xs">
                <RefreshCw size={12} /> Reconnect
              </button>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all"
              >
                <Unlink size={12} /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <XCircle size={18} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Not connected</p>
                <p className="text-xs text-gray-400">Connect to sync transactions to QuickBooks Advanced</p>
              </div>
            </div>
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Link size={14} />
              {connectMutation.isPending ? 'Redirecting…' : 'Connect QuickBooks'}
            </button>
          </div>
        )}

        <div className="mt-4 p-4 bg-indigo-50 rounded-xl text-xs text-indigo-600 leading-relaxed">
          <strong>How it works:</strong> Clicking Connect redirects you to Intuit's secure OAuth page. After
          authorizing, return here and sync any extracted transaction. Deposits sync as Bank Deposits;
          withdrawals sync as Purchases/Expenses.
        </div>
      </SettingSection>

      {/* AI Model */}
      <SettingSection title="AI Model" description="The AI engine powering extraction and analysis" icon={Cpu}>
        <div className="flex items-center gap-3">
          <span className="badge bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 text-xs">GPT-4o</span>
          <span className="text-xs text-gray-400">Vision-enabled · JSON structured output · OpenAI API</span>
        </div>
      </SettingSection>
    </div>
  )
}
