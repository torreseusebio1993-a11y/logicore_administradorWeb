import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { PageHeader } from '../components/Layout'
import { Badge, ErrorBox, formatDate, Spinner } from '../components/ui'

export default function BatchesPage () {
  const { data, isLoading, error } = useQuery({ queryKey: ['batches'], queryFn: api.batches })

  return (
    <>
      <PageHeader title='Cargas' subtitle='La fecha más reciente primero' />
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
