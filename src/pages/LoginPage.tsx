import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import KorwayLogo from '../components/KorwayLogo'
import { ErrorBox } from '../components/ui'

const field = 'w-full rounded-xl border border-mist bg-mist-light px-4 py-3 text-sm outline-none ' +
  'transition focus:border-elite focus:bg-white focus:ring-2 focus:ring-elite/20'

export default function LoginPage () {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to='/' replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='flex min-h-full flex-col items-center justify-center bg-mist-light p-4'>
      <div className='w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl shadow-elite/10'>
        {/* Encabezado en onda con el logo */}
        <div className='relative bg-gradient-to-br from-elite to-elite-dark px-8 pb-20 pt-10 text-center text-white'>
          <div className='flex justify-center'><KorwayLogo size={72} /></div>
          <div className='mt-4 text-3xl font-extrabold tracking-tight'>Korway</div>
          <div className='text-xs tracking-wide text-white/65'>un producto de Korvan</div>
          <svg className='absolute inset-x-0 -bottom-px h-14 w-full' viewBox='0 0 400 56' preserveAspectRatio='none' aria-hidden='true'>
            <path d='M0 26 Q100 56 200 30 T400 34 V56 H0 Z' fill='white' />
          </svg>
        </div>

        <form onSubmit={submit} className='space-y-4 px-8 pb-8 pt-2'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-elite-dark'>Bienvenido a Korway</h1>
            <p className='mt-1 text-sm text-slate-500'>Gestiona tus rutas, repartidores y envíos en tiempo real.</p>
          </div>
          <label className='block'>
            <span className='mb-1 block text-xs font-semibold text-slate-600'>Usuario</span>
            <input className={field} value={username} onChange={e => setUsername(e.target.value)}
              autoComplete='username' autoFocus required />
          </label>
          <label className='block'>
            <span className='mb-1 block text-xs font-semibold text-slate-600'>Contraseña</span>
            <div className='relative'>
              <input className={`${field} pr-12`} type={show ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} autoComplete='current-password' required />
              <button type='button' onClick={() => setShow(v => !v)}
                className='absolute inset-y-0 right-0 px-4 text-sm text-slate-500 hover:text-elite'
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {show ? '🙈' : '👁'}
              </button>
            </div>
          </label>
          <ErrorBox error={error} />
          <button disabled={busy}
            className='w-full rounded-xl bg-elite py-3.5 text-base font-bold text-volt shadow-lg shadow-elite/25 transition hover:bg-elite-dark disabled:opacity-60'>
            {busy ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
      <p className='mt-6 text-xs text-slate-500'>© 2026 Korvan. Todos los derechos reservados.</p>
    </div>
  )
}
