import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, ArrowLeftRight,
  BarChart2, Search, Settings, LogOut, Layers,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/documents',    label: 'Documents',    icon: FileText },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/reports',      label: 'Reports',      icon: BarChart2 },
  { to: '/search',       label: 'AI Search',    icon: Search },
  { to: '/settings',     label: 'Settings',     icon: Settings },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const initials = user.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <aside className="w-60 flex flex-col shrink-0" style={{ backgroundColor: '#1e1b4b' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: '#2e2b5e' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Layers size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">AccountingSuite</p>
            <p className="text-indigo-400 text-xs">Financial Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest px-3 mb-3">Main Menu</p>
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-200 hover:text-white hover:bg-white/10'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                  isActive ? 'bg-white/20' : 'bg-white/5'
                )}>
                  <Icon size={15} />
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t" style={{ borderColor: '#2e2b5e' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user.full_name}</p>
            <p className="text-indigo-400 text-xs truncate">{user.email}</p>
          </div>
          <button onClick={logout} className="text-indigo-400 hover:text-white transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
