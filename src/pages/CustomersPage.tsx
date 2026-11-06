import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerDetail } from '../api/types'
import { PageHeader } from '../components/Layout'
import {
  Badge, btn, ErrorBox, Field, formatDate, input, localPhone, locationStatus, mapsUrl,
  packageStatus, Spinner,
} from '../components/ui'

const SOURCE: Record<string, string> = {
  whatsapp: 'La envió por WhatsApp', delivery: 'GPS de una entrega', manual: 'Manual',
}

function Fit ({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 16)
    else if (points.length > 1) map.fitBounds(points, { padding: [30, 30] })
  }, [map, points])
  return null
}

function CustomerProfile ({ id }: { id: number }) {
  const qc = useQueryClient()
  const { data: c, isLoading, error } = useQuery({ queryKey: ['customer', id], queryFn: () => api.customer(id) })
  const [name, setName] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [phone, setPhone] = useState('')

  const onSaved = (d: CustomerDetail) => {
    qc.setQueryData(['customer', id], d)
    qc.invalidateQueries({ queryKey: ['customers'] })
  }
  const save = useMutation({
    mutationFn: () => api.updateCustomer(id, { name: name ?? c?.name ?? null, notes: notes ?? c?.notes ?? null }),
    onSuccess: d => { onSaved(d); setName(null); setNotes(null) },
  })
  const addPhone = useMutation({ mutationFn: () => api.addCustomerPhone(id, phone), onSuccess: d => { onSaved(d); setPhone('') } })
  const primary = useMutation({ mutationFn: (locId: number) => api.setPrimaryLocation(id, locId), onSuccess: onSaved })
  const removeLoc = useMutation({
    mutationFn: (locId: number) => api.deleteLocation(id, locId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', id] }),
  })

  if (isLoading) return <Spinner />
  if (!c) return <ErrorBox error={error} />

  const points = c.locations.map(l => [l.latitude, l.longitude] as [number, number])
  const dirty = name !== null || notes !== null

  return (
    <div className='space-y-6'>
      <ErrorBox error={save.error || addPhone.error || primary.error || removeLoc.error} />
      <div className='grid gap-6 lg:grid-cols-2'>
        <section className='space-y-3 rounded-2xl border border-slate-200 bg-white p-5'>
          <Field label='Nombre'>
            <input className={input} value={name ?? c.name ?? ''} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label='Notas' hint='Ej: portón verde, dejar con el vecino, perro bravo…'>
            <textarea className={input} rows={3} value={notes ?? c.notes ?? ''} onChange={e => setNotes(e.target.value)} />
          </Field>
          {dirty && <button className={btn.primary} onClick={() => save.mutate()} disabled={save.isPending}>Guardar</button>}

          <div>
            <div className='mb-1 text-sm font-medium'>Teléfonos</div>
            <div className='flex flex-wrap gap-2'>
              {c.phones.map(p => <Badge key={p} color='bg-slate-100 text-slate-700'>{localPhone(p)}</Badge>)}
            </div>
            <form className='mt-2 flex gap-2' onSubmit={e => { e.preventDefault(); addPhone.mutate() }}>
              <input className={input} placeholder='Otro celular, ej. 6123-4567' value={phone} onChange={e => setPhone(e.target.value)} />
              <button className={btn.ghost} disabled={!phone || addPhone.isPending}>Agregar</button>
            </form>
          </div>
          <div className='text-sm text-slate-600'>{c.packages} paquetes · {c.delivered} entregados</div>
        </section>

        <section className='overflow-hidden rounded-2xl border border-slate-200 bg-white'>
          {points.length === 0
            ? <p className='p-5 text-sm text-slate-500'>Sin ubicaciones todavía. Se guardan cuando el cliente comparte su ubicación por WhatsApp.</p>
            : (
              <MapContainer center={points[0]} zoom={15} className='h-72 w-full'>
                <TileLayer attribution='&copy; OpenStreetMap' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
                <Fit points={points} />
                {c.locations.map(l => (
                  <CircleMarker key={l.id} center={[l.latitude, l.longitude]} radius={l.is_primary ? 11 : 8}
                    pathOptions={{ color: '#fff', weight: 2, fillColor: l.is_primary ? '#16a34a' : '#64748b', fillOpacity: 0.95 }}>
                    <Popup>{l.is_primary ? 'Principal' : 'Otra ubicación'}</Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            )}
          <ul className='divide-y divide-slate-100'>
            {c.locations.map(l => (
              <li key={l.id} className='flex items-start justify-between gap-3 p-4 text-sm'>
                <div>
                  <div className='flex items-center gap-2'>
                    {l.is_primary && <Badge color='bg-green-100 text-green-800'>Principal</Badge>}
                    <span>{SOURCE[l.source] ?? l.source}</span>
                  </div>
                  {l.address && <div className='text-xs text-slate-500'>{l.address}</div>}
                  <div className='text-xs text-slate-500'>
                    Confirmada {l.last_confirmed_at ? formatDate(l.last_confirmed_at) : '—'} · {l.times_delivered} entregas ahí
                  </div>
                </div>
                <div className='flex shrink-0 gap-3'>
                  <a className={btn.link} href={mapsUrl(l.latitude, l.longitude)} target='_blank' rel='noreferrer'>Mapa</a>
                  {!l.is_primary && <button className={btn.link} onClick={() => primary.mutate(l.id)}>Principal</button>}
                  <button className='text-sm font-medium text-red-600 hover:underline'
                    onClick={() => confirm('¿Borrar esta ubicación?') && removeLoc.mutate(l.id)}>Borrar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className='overflow-hidden rounded-2xl border border-slate-200 bg-white'>
        <h2 className='border-b border-slate-100 px-5 py-3 font-semibold'>Historial de paquetes</h2>
        <table className='w-full text-sm'>
          <tbody className='divide-y divide-slate-100'>
            {c.history.map(p => (
              <tr key={p.id}>
                <td className='px-5 py-2 font-mono text-xs'>{p.tracking_number}</td>
                <td className='px-5 py-2 text-xs text-slate-500'>{formatDate(p.created_at)}</td>
                <td className='px-5 py-2'><Badge color={packageStatus[p.status][1]}>{packageStatus[p.status][0]}</Badge></td>
                <td className='px-5 py-2'><Badge color={locationStatus[p.location_status][1]}>{locationStatus[p.location_status][0]}</Badge></td>
                <td className='px-5 py-2 text-right'><Link className={btn.link} to={`/cargas/${p.batch_id}`}>Ver carga</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default function CustomersPage () {
  const params = useParams()
  const navigate = useNavigate()
  const selected = params.id ? Number(params.id) : null
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const list = useQuery({ queryKey: ['customers', debounced], queryFn: () => api.customers(debounced) })
  const current = list.data?.find(c => c.id === selected)

  return (
    <div className='flex h-full flex-col'>
      <PageHeader
        title={selected ? (current?.name ?? 'Cliente') : 'Clientes'}
        subtitle='Se reconocen por su teléfono; su ubicación se reutiliza en los próximos paquetes'
        actions={selected ? <Link to='/clientes' className={btn.ghost}>← Todos</Link> : undefined}
      />
      <div className='flex min-h-0 flex-1'>
        <aside className='w-72 shrink-0 overflow-auto border-r border-slate-200 bg-white p-3'>
          <input className={input} placeholder='Buscar nombre o teléfono…' value={search} onChange={e => setSearch(e.target.value)} />
          <ErrorBox error={list.error} />
          <ul className='mt-3 space-y-1'>
            {(list.data ?? []).map(c => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${c.id === selected ? 'bg-brand/10 text-brand' : 'hover:bg-slate-50'}`}
                >
                  <div className='flex justify-between font-medium'>
                    <span className='truncate'>{c.name ?? 'Sin nombre'}</span>
                    {c.has_location && <span title='Tiene ubicación'>📍</span>}
                  </div>
                  <div className='text-xs text-slate-500'>{c.phones.map(localPhone).join(', ')} · {c.packages} paq.</div>
                </button>
              </li>
            ))}
          </ul>
          {list.data?.length === 0 && <p className='mt-4 text-sm text-slate-500'>Sin resultados.</p>}
        </aside>
        <div className='min-w-0 flex-1 overflow-auto p-6'>
          {selected
            ? <CustomerProfile key={selected} id={selected} />
            : <p className='text-sm text-slate-500'>Elige un cliente para ver su ficha.</p>}
        </div>
      </div>
    </div>
  )
}
