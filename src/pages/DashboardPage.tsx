import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { PageHeader } from '../components/Layout'
import { accountStatus, Badge, formatDate, Spinner } from '../components/ui'

function Stat ({ label, value, color = 'text-slate-900' }: { label: string, value: number | string, color?: string }) {
  return (
    <div className='rounded-2xl border border-slate-200 bg-white p-5'>
      <div className='text-sm text-slate-500'>{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

export default function DashboardPage () {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 30_000 })
  const batches = useQuery({ queryKey: ['batches'], queryFn: api.batches })
  const accounts = useQuery({ queryKey: ['wa-accounts'], queryFn: api.waAccounts, refetchInterval: 15_000 })
  const queue = useQuery({ queryKey: ['wa-queue'], queryFn: api.waQueue, refetchInterval: 15_000 })

  const s = stats.data
  const open = (batches.data ?? []).filter(b => b.status !== 'closed').slice(0, 5)

  return (
    <>
      <PageHeader title='Inicio' subtitle='Resumen de la operación' />
      <div className='space-y-6 p-8'>
        {!s ? <Spinner /> : (
          <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
            <Stat label='Paquetes registrados' value={s.total_packages} />
            <Stat label='Entregados' value={s.total_delivered} color='text-green-600' />
            <Stat label='Por entregar' value={s.total_pending} color='text-amber-600' />
            <Stat label='Cargas abiertas' value={s.open_batches} color='text-brand' />
          </div>
        )}

        <div className='grid gap-6 lg:grid-cols-2'>
          <section className='rounded-2xl border border-slate-200 bg-white p-5'>
            <div className='mb-3 flex items-center justify-between'>
              <h2 className='font-semibold'>Cargas abiertas</h2>
              <Link to='/cargas' className='text-sm text-brand hover:underline'>Ver todas</Link>
            </div>
            {open.length === 0 && <p className='text-sm text-slate-500'>No hay cargas abiertas.</p>}
            <ul className='divide-y divide-slate-100'>
              {open.map(b => (
                <li key={b.id}>
                  <Link to={`/cargas/${b.id}`} className='flex items-center justify-between py-3 hover:text-brand'>
                    <div>
                      <div className='font-medium'>{b.name}</div>
                      <div className='text-xs text-slate-500'>{formatDate(b.batch_date)}</div>
                    </div>
                    <div className='text-right text-sm'>
                      <div>{b.total_packages}/{b.expected_packages} cargados</div>
                      <div className='text-xs text-slate-500'>{b.delivered_packages} entregados</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className='rounded-2xl border border-slate-200 bg-white p-5'>
            <div className='mb-3 flex items-center justify-between'>
              <h2 className='font-semibold'>WhatsApp</h2>
              <Link to='/whatsapp' className='text-sm text-brand hover:underline'>Administrar</Link>
            </div>
            <div className='mb-3 flex gap-4 text-sm'>
              <span>En cola: <b>{queue.data?.queued ?? 0}</b></span>
              <span>Fallidos: <b className='text-red-600'>{queue.data?.failed ?? 0}</b></span>
            </div>
            {(accounts.data ?? []).length === 0 && <p className='text-sm text-slate-500'>Sin cuentas todavía.</p>}
            <ul className='divide-y divide-slate-100'>
              {(accounts.data ?? []).map(a => {
                const [label, color] = accountStatus(a)
                return (
                  <li key={a.id} className='flex items-center justify-between py-2 text-sm'>
                    <span>{a.name}</span>
                    <span className='flex items-center gap-3'>
                      <span className='text-slate-500'>{a.sent_today}/{a.daily_limit} hoy</span>
                      <Badge color={color}>{label}</Badge>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
