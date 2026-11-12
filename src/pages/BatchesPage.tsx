import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { Badge, ErrorBox, formatDate, input, Spinner } from '../components/ui'

export default function BatchesPage () {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [owner, setOwner] = useState<number | undefined>()
  const { data, isLoading, error } = useQuery({ queryKey: ['batches', owner], queryFn: () => api.batches(owner) })
  const users = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: isAdmin })

  return (
    <>
      <PageHeader title='Cargas' subtitle={isAdmin ? 'Todas las cargas (filtra por repartidor)' : 'Tus cargas · la fecha más reciente primero'}
        actions={isAdmin && (
          <select className={input} value={owner ?? ''} onChange={e => setOwner(e.target.value ? Number(e.target.value) : undefined)}>
            <option value=''>Todos los repartidores</option>
            {(users.data ?? []).map(u => <option key={u.id} value={u.id}>{u.name}{u.is_active ? '' : ' (de baja)'}</option>)}
          </select>
        )} />
      <div className='p-8'>
        <ErrorBox error={error} />
        {isLoading ? <Spinner /> : (
          <div className='overflow-hidden rounded-2xl border border-slate-200 bg-white'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
                <tr>
                  <th className='px-4 py-3'>Fecha</th>
                  <th className='px-4 py-3'>Ruta</th>
                  <th className='px-4 py-3'>Código</th>
                  {isAdmin && <th className='px-4 py-3'>Repartidor</th>}
                  <th className='px-4 py-3 text-right'>Cargados</th>
                  <th className='px-4 py-3 text-right'>Entregados</th>
                  <th className='px-4 py-3'>Progreso</th>
                  <th className='px-4 py-3'>Estado</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {(data ?? []).map(b => {
                  const pct = Math.round(b.progress * 100)
                  return (
                    <tr key={b.id} className='hover:bg-slate-50'>
                      <td className='whitespace-nowrap px-4 py-3'>{formatDate(b.batch_date)}</td>
                      <td className='px-4 py-3'>
                        <Link to={`/cargas/${b.id}`} className='font-medium text-brand hover:underline'>{b.name}</Link>
                        {b.notes && <div className='text-xs text-slate-500'>{b.notes}</div>}
                      </td>
                      <td className='px-4 py-3 text-xs text-slate-500'>{b.code}</td>
                      {isAdmin && <td className='px-4 py-3'>{b.owner_name ?? '—'}</td>}
                      <td className='px-4 py-3 text-right'>{b.total_packages}/{b.expected_packages}</td>
                      <td className='px-4 py-3 text-right'>{b.delivered_packages}</td>
                      <td className='w-40 px-4 py-3'>
                        <div className='h-2 rounded bg-slate-100'>
                          <div className='h-2 rounded bg-green-500' style={{ width: `${pct}%` }} />
                        </div>
                        <div className='mt-1 text-xs text-slate-500'>{pct}%</div>
                      </td>
                      <td className='px-4 py-3'>
                        <Badge color={b.status === 'closed' ? 'bg-slate-200 text-slate-700' : 'bg-green-100 text-green-800'}>
                          {b.status === 'closed' ? 'Cerrada' : 'Abierta'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {data?.length === 0 && <p className='p-6 text-center text-sm text-slate-500'>Todavía no hay cargas. Se crean desde la app móvil.</p>}
          </div>
        )}
      </div>
    </>
  )
}
