import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Link, Unlink, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { quickbooksApi } from '../api/client'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qb-status'] }); toast.success('Disconnected from QuickBooks') },
    onError: () => toast.error('Disconnect failed'),
  })

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {/* Account */}
      <div className="card p-6 mb-6">
        <h2 className="text-base font-semibold mb-4">Account</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Name</span>
            <span className="font-medium">{user.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Role</span>
            <span className="font-medium">{user.is_admin ? 'Admin' : 'User'}</span>
          </div>
        </div>
      </div>

      {/* QuickBooks */}
      <div className="card p-6 mb-6">
        <h2 className="text-base font-semibold mb-1">QuickBooks Advanced</h2>
        <p className="text-sm text-gray-500 mb-5">
          Connect your QuickBooks company to sync extracted transactions directly.
        </p>

        {qbStatus?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle size={20} className="text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-800">Connected</p>
                <p className="text-sm text-green-700">{qbStatus.company_name}</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Token expires: {new Date(qbStatus.access_token_expires_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => connectMutation.mutate()}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <RefreshCw size={15} /> Reconnect
              </button>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Unlink size={15} /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <XCircle size={20} className="text-gray-400 shrink-0" />
              <div>
                <p className="font-medium text-gray-700">Not connected</p>
                <p className="text-sm text-gray-500">Connect to sync transactions to QuickBooks</p>
              </div>
            </div>
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Link size={16} />
              {connectMutation.isPending ? 'Redirecting…' : 'Connect QuickBooks'}
            </button>
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-xs text-blue-700">
          <strong>How it works:</strong> Clicking "Connect QuickBooks" redirects to Intuit's secure OAuth page.
          After authorizing, you'll return here and can sync any extracted transaction to your QB company.
          Deposits are created as Bank Deposits; withdrawals as Purchases/Expenses.
        </div>
      </div>

      {/* AI Model */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-1">AI Model</h2>
        <p className="text-sm text-gray-500">Currently using OpenAI GPT-4o for document extraction and analysis.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="badge bg-blue-100 text-blue-700">GPT-4o</span>
          <span className="text-xs text-gray-400">Vision-enabled · JSON structured output</span>
        </div>
      </div>
    </div>
  )
}
