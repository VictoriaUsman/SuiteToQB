import { Outlet, useLocation } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'
import Sidebar from './Sidebar'

const pageTitles = {
  '/':             { title: 'Dashboard',    sub: 'Welcome back — here\'s your financial overview' },
  '/documents':    { title: 'Documents',    sub: 'Upload and manage your financial documents' },
  '/transactions': { title: 'Transactions', sub: 'Review and sync your extracted transactions' },
  '/reports':      { title: 'Reports',      sub: 'Export PDF and Excel financial reports' },
  '/search':       { title: 'AI Search',    sub: 'Search transactions and ask GPT-4o questions' },
  '/settings':     { title: 'Settings',     sub: 'Manage your account and QuickBooks connection' },
}

export default function Layout() {
  const { pathname } = useLocation()
  const meta = pageTitles[pathname] || { title: 'AccountingSuite', sub: '' }
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0 shadow-sm">
          <div>
            <h1 className="text-base font-bold text-gray-900">{meta.title}</h1>
            <p className="text-xs text-gray-400">{meta.sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all">
              <Bell size={16} />
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {user.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
