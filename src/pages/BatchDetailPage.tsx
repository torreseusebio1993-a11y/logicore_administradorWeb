import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Package } from '../api/types'
import { PageHeader } from '../components/Layout'
import { ConversationModal, EditPackageModal } from '../components/PackageModals'
import {
  Badge, btn, contactStatus, ErrorBox, formatDate, input, localPhone, locationStatus,
  mapsUrl, packageStatus, Spinner,
} from '../components/ui'

type Filter = 'all' | 'pending' | 'delivered' | 'no_location' | 'check'

const FILTERS: [Filter, string, (p: Package) => boolean][] = [
  ['all', 'Todos', () => true],
  ['pending', 'Por entregar', p => p.status === 'pending' || p.status === 'failed'],
  ['delivered', 'Entregados', p => p.status === 'delivered'],
  ['no_location', 'Sin ubicación', p => p.location_status !== 'received' && p.status !== 'delivered'],
  ['check', 'Verificar tracking', p => p.tracking_source === 'text'],
]

export default function BatchDetailPage () {
  const id = Number(useParams().id)
  const qc = useQueryClient()
  const batch = useQuery({ queryKey: ['batch', id], queryFn: () => api.batch(id) })
  const packages = useQuery({ queryKey: ['packages', id], queryFn: () => api.packages(id), refetchInterval: 20_000 })

  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Package | null>(null)
  const [chat, setChat] = useState<Package | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['packages', id] })
    qc.invalidateQueries({ queryKey: ['batch', id] })
  }

  const remove = useMutation({
    mutationFn: (p: Package) => api.deletePackage(p.id),
    onSuccess: refresh,
  })
  const askOne = useMutation({
    mutationFn: (p: Package) => api.waRequestLocation(p.id),
    onSuccess: () => { setNotice('Mensaje en cola'); refresh() },
  })
  const askAll = useMutation({
    mutationFn: () => api.waRequestLocationBatch(id),
    onSuccess: r => {
      setNotice(`${r.queued} mensajes en cola${r.skipped.length ? ` · ${r.skipped.length} omitidos (sin celular válido)` : ''}`)
      refresh()
    },
  })

  const rows = useMemo(() => {
    const test = FILTERS.find(f => f[0] === filter)![2]
    const q = search.trim().toLowerCase()
    return (packages.data ?? []).filter(p => test(p) && (!q || [
      p.customer_name, p.tracking_number, p.customer_phone, p.address, p.corregimiento,
    ].some(v => v?.toLowerCase().includes(q))))
  }, [packages.data, filter, search])

  const b = batch.data
  const pending = (packages.data ?? []).filter(FILTERS[3][2]).length

  return (
    <>
      <PageHeader
        title={b?.name ?? 'Carga'}
        subtitle={b ? `${formatDate(b.batch_date)} · ${b.code} · ${b.total_packages}/${b.expected_packages} cargados · ${b.delivered_packages} entregados` : undefined}
        actions={<>
          <Link to='/cargas' className={btn.ghost}>← Cargas</Link>
          <Link to={`/mapa?carga=${id}`} className={btn.ghost}>🗺️ Ver en mapa</Link>
          <button
            className={btn.wa}
            disabled={askAll.isPending || pending === 0}
            onClick={() => confirm(`¿Pedir ubicación por WhatsApp a los ${pending} paquetes sin ubicación? Se envían de a poco, con pausas y límite diario.`) && askAll.mutate()}
          >
            💬 Pedir ubicación a todos
          </button>
        </>}
      />
      <div className='space-y-4 p-8'>
        <ErrorBox error={packages.error || remove.error || askOne.error || askAll.error} />
        {notice && (
          <div className='flex justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800'>
            {notice}<button onClick={() => setNotice(null)}>×</button>
          </div>
        )}

        <div className='flex flex-wrap items-center gap-2'>
          {FILTERS.map(([key, label, test]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-sm ${filter === key ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-slate-300 bg-white'}`}
            >
              {label} ({(packages.data ?? []).filter(test).length})
            </button>
          ))}
          <input className={`${input} ml-auto max-w-xs`} placeholder='Buscar nombre, tracking, teléfono…' value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {packages.isLoading ? <Spinner /> : (
          <div className='overflow-x-auto rounded-2xl border border-slate-200 bg-white'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
                <tr>
                  <th className='px-4 py-3'>Cliente</th>
                  <th className='px-4 py-3'>Tracking</th>
                  <th className='px-4 py-3'>Ubicación (sector)</th>
                  <th className='px-4 py-3'>Estado</th>
                  <th className='px-4 py-3'>WhatsApp</th>
                  <th className='px-4 py-3'>Ubicación</th>
                  <th className='px-4 py-3' />
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {rows.map(p => {
                  const [sLabel, sColor] = packageStatus[p.status]
                  const [cLabel, cColor] = contactStatus[p.contact_status]
                  const [lLabel, lColor] = locationStatus[p.location_status]
                  const canAsk = !!p.customer_phone && p.location_status !== 'received' &&
                    !['queued', 'no_whatsapp'].includes(p.contact_status)
                  return (
                    <tr key={p.id} className='align-top hover:bg-slate-50'>
                      <td className='px-4 py-3'>
                        <div className='font-medium'>{p.customer_name ?? '—'}</div>
                        <div className='text-xs text-slate-500'>{localPhone(p.customer_phone)}</div>
                        {p.address && <div className='max-w-xs truncate text-xs text-slate-500' title={p.address}>{p.address}</div>}
                      </td>
                      <td className='px-4 py-3 font-mono text-xs'>
                        {p.tracking_number ?? '—'}
                        {p.tracking_source === 'text' && <div><Badge color='bg-red-100 text-red-700'>Verificar</Badge></div>}
                      </td>
                      <td className='px-4 py-3 text-xs'>
                        <div>{p.distrito ?? '—'}</div>
                        <div className='font-medium'>{p.corregimiento ?? ''}</div>
                      </td>
                      <td className='px-4 py-3'><Badge color={sColor}>{sLabel}</Badge></td>
                      <td className='px-4 py-3'><Badge color={cColor}>{cLabel}</Badge></td>
                      <td className='px-4 py-3'>
                        {p.dest_latitude != null && p.dest_longitude != null
                          ? <a href={mapsUrl(p.dest_latitude, p.dest_longitude)} target='_blank' rel='noreferrer'><Badge color={lColor}>{lLabel}</Badge></a>
                          : <Badge color={lColor}>{lLabel}</Badge>}
                      </td>
                      <td className='whitespace-nowrap px-4 py-3 text-right'>
                        <div className='flex justify-end gap-3'>
                          {canAsk && <button className={btn.link} onClick={() => askOne.mutate(p)}>Pedir ubicación</button>}
                          {p.contact_status !== 'not_contacted' && <button className={btn.link} onClick={() => setChat(p)}>Chat</button>}
                          <button className={btn.link} onClick={() => setEditing(p)}>Editar</button>
                          {p.status === 'pending' && p.attempt_count === 0 && (
                            <button
                              className='text-sm font-medium text-red-600 hover:underline'
                              onClick={() => confirm(`¿Borrar ${p.tracking_number ?? 'este paquete'}? No se puede deshacer.`) && remove.mutate(p)}
                            >
                              Borrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length === 0 && <p className='p-6 text-center text-sm text-slate-500'>No hay paquetes aquí.</p>}
          </div>
        )}
      </div>
      {editing && <EditPackageModal pkg={editing} onClose={() => setEditing(null)} />}
      {chat && <ConversationModal pkg={chat} onClose={() => setChat(null)} />}
    </>
  )
}
