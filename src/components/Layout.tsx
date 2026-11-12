import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const nav = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/cargas', label: 'Cargas', icon: '📦' },
  { to: '/clientes', label: 'Clientes', icon: '👥' },
  { to: '/mapa', label: 'Mapa de clientes', icon: '🗺️' },
  { to: '/ruta', label: 'Ruta del día', icon: '🧭' },
  { to: '/whatsapp', label: 'WhatsApp', icon: '💬' },
  { to: '/usuarios', label: 'Usuarios', icon: '👥', admin: true },
  { to: '/monitoreo', label: 'Monitoreo', icon: '📊', admin: true },
  { to: '/app', label: 'App móvil', icon: '📲', admin: true },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
]

export default function Layout () {
  const { user, logout } = useAuth()
  return (
    <div className='flex h-full'>
      <aside className='flex w-60 shrink-0 flex-col bg-gradient-to-b from-brand to-brand-dark text-white'>
        <div className='px-5 py-6'>
          <div className='text-xl font-bold tracking-tight'>LogiCore</div>
          <div className='text-xs text-white/70'>Panel de administración</div>
        </div>
        <nav className='flex-1 space-y-1 px-3'>
          {nav.filter(n => !n.admin || user?.role === 'admin').map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              <span>{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className='border-t border-white/15 p-4 text-sm'>
          <div className='font-medium'>{user?.name}</div>
          <div className='text-xs text-white/70'>@{user?.username} · {user?.role === 'admin' ? 'Administrador' : 'Repartidor'}</div>
          <button onClick={logout} className='mt-3 text-xs text-white/80 underline hover:text-white'>Cerrar sesión</button>
        </div>
      </aside>
      <main className='min-w-0 flex-1 overflow-auto'>
        <Outlet />
      </main>
    </div>
  )
}

export function PageHeader ({ title, subtitle, actions }: {
  title: string, subtitle?: string, actions?: React.ReactNode
}) {
  return (
    <header className='flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-white px-8 py-5'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
        {subtitle && <p className='text-sm text-slate-500'>{subtitle}</p>}
      </div>
      <div className='flex flex-wrap gap-2'>{actions}</div>
    </header>
  )
}
