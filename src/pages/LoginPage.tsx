import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { btn, ErrorBox, Field, input } from '../components/ui'

export default function LoginPage () {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
    <div className='flex h-full items-center justify-center bg-gradient-to-br from-brand to-brand-dark p-4'>
      <form onSubmit={submit} className='w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-xl'>
        <div>
          <h1 className='text-2xl font-bold'>LogiCore</h1>
          <p className='text-sm text-slate-500'>Panel de administración</p>
        </div>
        <Field label='Usuario'>
          <input className={input} value={username} onChange={e => setUsername(e.target.value)} autoComplete='username' autoFocus required />
        </Field>
        <Field label='Contraseña'>
          <input className={input} type='password' value={password} onChange={e => setPassword(e.target.value)} autoComplete='current-password' required />
        </Field>
        <ErrorBox error={error} />
        <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
