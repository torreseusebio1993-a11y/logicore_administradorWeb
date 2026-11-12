import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { ManagedUser } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { BarChart } from '../components/BarChart'
import { PageHeader } from '../components/Layout'
import { Badge, btn, ErrorBox, Field, formatDate, input, Modal, Spinner } from '../components/ui'

const ROLE: Record<string, [string, string]> = {
  admin: ['Administrador', 'bg-violet-100 text-violet-800'],
  driver: ['Repartidor', 'bg-sky-100 text-sky-800'],
}

export default function UsersPage () {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: api.users, refetchInterval: 60_000 })
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [password, setPassword] = useState<ManagedUser | null>(null)
  const [activity, setActivity] = useState<ManagedUser | null>(null)

  const toggle = useMutation({
    mutationFn: (u: ManagedUser) => api.updateUser(u.id, { is_active: !u.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
    <>
      <PageHeader title='Usuarios' subtitle='Cuentas del sistema: cada repartidor ve solo sus cargas, clientes y WhatsApp'
        actions={<button className={btn.primary} onClick={() => setCreating(true)}>＋ Nuevo usuario</button>} />
      <div className='space-y-4 p-8'>
        <ErrorBox error={users.error || toggle.error} />
        {users.isLoading ? <Spinner /> : (
          <div className='overflow-x-auto rounded-2xl border border-slate-200 bg-white'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
                <tr>
                  <th className='px-4 py-3'>Usuario</th><th className='px-4 py-3'>Rol</th>
                  <th className='px-4 py-3'>Estado</th><th className='px-4 py-3'>Última vez</th>
                  <th className='px-4 py-3'>App</th><th className='px-4 py-3 text-right'>Cargas abiertas</th>
                  <th className='px-4 py-3 text-right'>Entregas (7 días)</th><th className='px-4 py-3 text-right'>Errores (24 h)</th>
                  <th className='px-4 py-3' />
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {(users.data ?? []).map(u => (
                  <tr key={u.id} className={`align-top ${u.is_active ? '' : 'bg-slate-50 text-slate-400'}`}>
                    <td className='px-4 py-3'>
                      <div className='font-medium'>{u.name}{u.id === me?.id && <span className='ml-1 text-xs text-slate-500'>(tú)</span>}</div>
                      <div className='text-xs text-slate-500'>@{u.username}</div>
                    </td>
                    <td className='px-4 py-3'><Badge color={ROLE[u.role][1]}>{ROLE[u.role][0]}</Badge></td>
                    <td className='px-4 py-3'>
                      {u.is_active ? <span>✅ Activo</span> : <span>⛔ De baja{u.deactivated_at ? ` desde ${formatDate(u.deactivated_at)}` : ''}</span>}
                    </td>
                    <td className='whitespace-nowrap px-4 py-3 text-xs'>{u.last_seen ? formatDate(u.last_seen, true) : 'Nunca'}</td>
                    <td className='px-4 py-3'>{u.app_version ?? '—'}</td>
                    <td className='px-4 py-3 text-right'>{u.open_batches}</td>
                    <td className='px-4 py-3 text-right'>{u.deliveries_7d}</td>
                    <td className='px-4 py-3 text-right'>{u.errors_24h > 0 ? <b className='text-red-700'>⚠️ {u.errors_24h}</b> : '0'}</td>
                    <td className='whitespace-nowrap px-4 py-3 text-right'>
                      <div className='flex justify-end gap-3'>
                        <button className={btn.link} onClick={() => setActivity(u)}>Actividad</button>
                        <button className={btn.link} onClick={() => setEditing(u)}>Editar</button>
                        <button className={btn.link} onClick={() => setPassword(u)}>Contraseña</button>
                        {u.id !== me?.id && (
                          <button
                            className={`text-sm font-medium hover:underline ${u.is_active ? 'text-red-600' : 'text-green-700'}`}
                            onClick={() => (!u.is_active || confirm(`¿Dar de baja a ${u.name}? Se cierran sus sesiones y se pausan sus cuentas de WhatsApp. Sus cargas quedan guardadas.`)) && toggle.mutate(u)}
                          >
                            {u.is_active ? 'Dar de baja' : 'Reactivar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && <CreateUserModal onClose={() => setCreating(false)} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
      {password && <PasswordModal user={password} onClose={() => setPassword(null)} />}
      {activity && <ActivityModal user={activity} onClose={() => setActivity(null)} />}
    </>
  )
}

function CreateUserModal ({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ username: '', name: '', password: '', role: 'driver' as 'driver' | 'admin' })
  const save = useMutation({
    mutationFn: () => api.createUser(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose() },
  })
  return (
    <Modal title='Nuevo usuario' onClose={onClose}>
      <form className='space-y-3' onSubmit={e => { e.preventDefault(); save.mutate() }}>
        <Field label='Nombre completo'><input className={input} required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label='Usuario (para entrar)' hint='Sin espacios: letras, números, punto o guion'>
          <input className={input} required minLength={3} pattern='[A-Za-z0-9._\-]+' value={f.username} onChange={e => setF({ ...f, username: e.target.value })} />
        </Field>
        <Field label='Contraseña inicial' hint='Mínimo 10 caracteres. Dísela a la persona por un medio seguro.'>
          <input className={input} type='text' required minLength={10} autoComplete='new-password' value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
        </Field>
        <Field label='Rol'>
          <select className={input} value={f.role} onChange={e => setF({ ...f, role: e.target.value as 'driver' | 'admin' })}>
            <option value='driver'>Repartidor — ve solo sus cargas, clientes y WhatsApp</option>
            <option value='admin'>Administrador — ve y administra todo</option>
          </select>
        </Field>
        <ErrorBox error={save.error} />
        <div className='flex justify-end gap-2 pt-2'>
          <button type='button' className={btn.ghost} onClick={onClose}>Cancelar</button>
          <button className={btn.primary} disabled={save.isPending}>{save.isPending ? 'Creando…' : 'Crear usuario'}</button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal ({ user, onClose }: { user: ManagedUser, onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(user.name)
  const [role, setRole] = useState(user.role)
  const save = useMutation({
    mutationFn: () => api.updateUser(user.id, { name, role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose() },
  })
  return (
    <Modal title={`Editar a @${user.username}`} onClose={onClose}>
      <form className='space-y-3' onSubmit={e => { e.preventDefault(); save.mutate() }}>
        <Field label='Nombre completo'><input className={input} required minLength={2} value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label='Rol'>
          <select className={input} value={role} onChange={e => setRole(e.target.value as 'driver' | 'admin')}>
            <option value='driver'>Repartidor</option>
            <option value='admin'>Administrador</option>
          </select>
        </Field>
        <ErrorBox error={save.error} />
        <div className='flex justify-end gap-2 pt-2'>
          <button type='button' className={btn.ghost} onClick={onClose}>Cancelar</button>
          <button className={btn.primary} disabled={save.isPending}>Guardar</button>
        </div>
      </form>
    </Modal>
  )
}

function PasswordModal ({ user, onClose }: { user: ManagedUser, onClose: () => void }) {
  const [password, setPassword] = useState('')
  const save = useMutation({ mutationFn: () => api.setUserPassword(user.id, password), onSuccess: onClose })
  return (
    <Modal title={`Nueva contraseña para ${user.name}`} onClose={onClose}>
      <form className='space-y-3' onSubmit={e => { e.preventDefault(); save.mutate() }}>
        <Field label='Contraseña nueva' hint='Mínimo 10 caracteres. Se cierran sus sesiones: tendrá que entrar de nuevo.'>
          <input className={input} type='text' required minLength={10} autoComplete='new-password' value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        <ErrorBox error={save.error} />
        <div className='flex justify-end gap-2 pt-2'>
          <button type='button' className={btn.ghost} onClick={onClose}>Cancelar</button>
          <button className={btn.primary} disabled={save.isPending}>Cambiar contraseña</button>
        </div>
      </form>
    </Modal>
  )
}

function ActivityModal ({ user, onClose }: { user: ManagedUser, onClose: () => void }) {
  const q = useQuery({ queryKey: ['user-activity', user.id], queryFn: () => api.userActivity(user.id, 14) })
  const a = q.data
  return (
    <Modal title={`Actividad de ${user.name}`} wide onClose={onClose}>
      <ErrorBox error={q.error} />
      {!a ? <Spinner /> : (
        <div className='space-y-5 text-sm'>
          <div className='grid grid-cols-4 gap-3'>
            <div><div className='text-xs text-slate-500'>Entregados</div><div className='text-xl font-bold'>{a.delivered_total}</div></div>
            <div><div className='text-xs text-slate-500'>Pendientes</div><div className='text-xl font-bold'>{a.pending_total}</div></div>
            <div><div className='text-xs text-slate-500'>Último ingreso</div><div>{a.user.last_login_at ? formatDate(a.user.last_login_at, true) : '—'}</div></div>
            <div><div className='text-xs text-slate-500'>Versión de la app</div><div>{a.user.app_version ?? '—'}</div></div>
          </div>
          <div>
            <h3 className='mb-1 font-semibold'>Uso por día (14 días)</h3>
            <BarChart ariaLabel='Uso por día' height={110}
              data={a.per_day.map(d => ({ label: d.day.slice(5), value: d.requests, hint: `${d.errors} errores` }))} />
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <div>
              <h3 className='mb-1 font-semibold'>Lo que más usa</h3>
              <ul className='space-y-1 font-mono text-xs'>
                {a.top_actions.map(t => <li key={t.method + t.path} className='flex justify-between gap-2'><span className='truncate'>{t.method} {t.path}</span><b>{t.count}</b></li>)}
              </ul>
            </div>
            <div>
              <h3 className='mb-1 font-semibold'>Errores y avisos</h3>
              {a.events.length === 0 ? <p className='text-slate-500'>Ninguno 🎉</p> : (
                <ul className='space-y-1 text-xs'>
                  {a.events.slice(0, 10).map((e, i) => <li key={i}><span className='text-slate-500'>{formatDate(e.ts, true)}</span> · {e.message}</li>)}
                </ul>
              )}
            </div>
          </div>
          <div>
            <h3 className='mb-1 font-semibold'>Últimas acciones</h3>
            <ul className='max-h-64 divide-y divide-slate-100 overflow-auto font-mono text-xs'>
              {a.recent.map((r, i) => (
                <li key={i} className='flex gap-3 py-1'>
                  <span className='w-32 shrink-0 text-slate-500'>{formatDate(r.ts, true)}</span>
                  <span className='w-14 shrink-0'>{r.client === 'app' ? '📱' : r.client === 'panel' ? '💻' : ''} {r.method}</span>
                  <span className='flex-1 truncate'>{r.path}</span>
                  <span className={r.status >= 400 ? 'text-red-600' : 'text-slate-500'}>{r.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}
