import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import AppReleasesPage from './pages/AppReleasesPage'
import BatchDetailPage from './pages/BatchDetailPage'
import BatchesPage from './pages/BatchesPage'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import MonitorPage from './pages/MonitorPage'
import RoutePage from './pages/RoutePage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import WhatsAppPage from './pages/WhatsAppPage'

/** Páginas solo del administrador (el backend también lo exige). */
function AdminOnly () {
  const { user } = useAuth()
  return user?.role === 'admin' ? <Outlet /> : <Navigate to='/' replace />
}

function Protected () {
  const { user, checking } = useAuth()
  if (checking) return <Spinner />
  if (!user) return <Navigate to='/login' replace />
  return <Layout />
}

export default function App () {
  return (
    <Routes>
      <Route path='/login' element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route index element={<DashboardPage />} />
        <Route path='cargas' element={<BatchesPage />} />
        <Route path='cargas/:id' element={<BatchDetailPage />} />
        <Route path='clientes' element={<CustomersPage />} />
        <Route path='clientes/:id' element={<CustomersPage />} />
        <Route path='mapa' element={<MapPage />} />
        <Route path='ruta' element={<RoutePage />} />
        <Route path='whatsapp' element={<WhatsAppPage />} />
        <Route element={<AdminOnly />}>
          <Route path='monitoreo' element={<MonitorPage />} />
          <Route path='app' element={<AppReleasesPage />} />
          <Route path='usuarios' element={<UsersPage />} />
        </Route>
        <Route path='ajustes' element={<SettingsPage />} />
      </Route>
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}
