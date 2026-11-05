import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Package } from '../api/types'
import { PageHeader } from '../components/Layout'
import { ErrorBox, input, localPhone, mapsUrl, packageStatus } from '../components/ui'

// La Chorrera, Panamá Oeste
const DEFAULT_CENTER: [number, number] = [8.88, -79.78]

const STATUS_COLOR: Record<Package['status'], string> = {
  pending: '#f59e0b',
  failed: '#ef4444',
  delivered: '#22c55e',
  returned: '#64748b',
}

/** Ajusta el zoom para que se vean todos los puntos. */
function FitBounds ({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15)
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40] })
  }, [map, points])
  return null
}

export default function MapPage () {
  const [params, setParams] = useSearchParams()
  const batchId = params.get('carga') ? Number(params.get('carga')) : undefined
  const [includeDelivered, setIncludeDelivered] = useState(false)
  const [sector, setSector] = useState('')

  const batches = useQuery({ queryKey: ['batches'], queryFn: api.batches })
  const pins = useQuery({
    queryKey: ['map', batchId, includeDelivered],
    queryFn: () => api.mapPackages(batchId, includeDelivered),
    refetchInterval: 30_000,
  })

  const sectors = useMemo(() => {
    const count = new Map<string, number>()
    for (const p of pins.data ?? []) {
      const key = p.corregimiento ?? 'Sin corregimiento'
      count.set(key, (count.get(key) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1])
  }, [pins.data])

  const visible = (pins.data ?? []).filter(p => !sector || (p.corregimiento ?? 'Sin corregimiento') === sector)
  const points = useMemo(
    () => visible.map(p => [p.dest_latitude!, p.dest_longitude!] as [number, number]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pins.data, sector],
  )

  return (
    <div className='flex h-full flex-col'>
      <PageHeader
        title='Mapa de clientes'
        subtitle='Ubicaciones que los clientes enviaron por WhatsApp'
        actions={<>
          <select
            className={input}
            value={batchId ?? ''}
            onChange={e => setParams(e.target.value ? { carga: e.target.value } : {})}
          >
            <option value=''>Todas las cargas</option>
            {(batches.data ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <label className='flex items-center gap-2 whitespace-nowrap text-sm'>
            <input type='checkbox' checked={includeDelivered} onChange={e => setIncludeDelivered(e.target.checked)} />
            Incluir entregados
          </label>
        </>}
      />
      <ErrorBox error={pins.error} />
      <div className='flex min-h-0 flex-1'>
        <aside className='w-64 shrink-0 overflow-auto border-r border-slate-200 bg-white p-4'>
          <div className='mb-2 text-sm font-semibold'>{visible.length} clientes en el mapa</div>
          <div className='mb-4 space-y-1 text-xs text-slate-600'>
            {Object.entries(STATUS_COLOR).map(([s, c]) => (
              <div key={s} className='flex items-center gap-2'>
                <span className='inline-block h-3 w-3 rounded-full' style={{ background: c }} />
                {packageStatus[s as Package['status']][0]}
              </div>
            ))}
          </div>
          <div className='mb-2 text-xs font-semibold uppercase text-slate-500'>Por corregimiento</div>
          <button onClick={() => setSector('')} className={`block w-full rounded px-2 py-1 text-left text-sm ${!sector ? 'bg-brand/10 font-medium text-brand' : 'hover:bg-slate-50'}`}>
            Todos
          </button>
          {sectors.map(([name, n]) => (
            <button
              key={name}
              onClick={() => setSector(name)}
              className={`flex w-full justify-between rounded px-2 py-1 text-left text-sm ${sector === name ? 'bg-brand/10 font-medium text-brand' : 'hover:bg-slate-50'}`}
            >
              <span>{name}</span><span>{n}</span>
            </button>
          ))}
          {pins.data?.length === 0 && (
            <p className='mt-4 text-xs text-slate-500'>
              Todavía no hay ubicaciones. Pide la ubicación a los clientes desde una carga
              (botón “Pedir ubicación a todos”).
            </p>
          )}
        </aside>
        <div className='min-w-0 flex-1'>
          <MapContainer center={DEFAULT_CENTER} zoom={12} className='h-full w-full'>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            <FitBounds points={points} />
            {visible.map(p => (
              <CircleMarker
                key={p.id}
                center={[p.dest_latitude!, p.dest_longitude!]}
                radius={9}
                pathOptions={{ color: '#fff', weight: 2, fillColor: STATUS_COLOR[p.status], fillOpacity: 0.95 }}
              >
                <Popup>
                  <div className='space-y-1 text-sm'>
                    <div className='font-semibold'>{p.customer_name ?? '—'}</div>
                    <div>{localPhone(p.customer_phone)}</div>
                    <div className='font-mono text-xs'>{p.tracking_number}</div>
                    {p.address && <div className='text-xs'>{p.address}</div>}
                    <div className='text-xs'>{[p.distrito, p.corregimiento].filter(Boolean).join(' · ')}</div>
                    <div className='text-xs'>{packageStatus[p.status][0]}</div>
                    <a href={mapsUrl(p.dest_latitude!, p.dest_longitude!)} target='_blank' rel='noreferrer'>
                      Abrir en Google Maps
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
