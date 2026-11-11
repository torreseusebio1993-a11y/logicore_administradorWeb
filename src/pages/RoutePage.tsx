import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { api } from '../api/client'
import type { Package, RouteStop } from '../api/types'
import { PageHeader } from '../components/Layout'
import { Badge, btn, ErrorBox, input, localPhone, mapAddress, mapsUrl, Spinner } from '../components/ui'

const DEFAULT_CENTER: [number, number] = [8.88, -79.78]
const OUT_COLOR = '#ea580c'

function OutBadge () {
  return <Badge color='bg-orange-100 text-orange-700'>Fuera de ruta</Badge>
}

function StopItem ({ s, onNotify }: { s: RouteStop, onNotify?: (p: Package) => void }) {
  return (
    <li className='flex gap-3 rounded-lg border border-slate-100 p-2 text-sm'>
      <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white'
        style={{ background: s.package.out_of_route ? OUT_COLOR : '#2563eb' }}>{s.order}</span>
      <div className='min-w-0'>
        <div className='truncate font-medium'>
          {s.package.customer_name ?? s.package.tracking_number}
          {s.package.access_control && <span className='ml-1 text-xs text-violet-700'>🔐 Garita</span>}
        </div>
        <div className='text-xs text-slate-500'>
          {[mapAddress(s.package) ? `📍 ${mapAddress(s.package)}` : s.package.address, s.distance_km != null && `${s.distance_km} km`, s.duration_min != null && `${Math.round(s.duration_min)} min`].filter(Boolean).join(' · ')}
        </div>
        {onNotify && s.package.customer_phone && (
          <button className='text-xs font-medium text-green-700 hover:underline' onClick={() => onNotify(s.package)}>
            💬 Avisar en camino
          </button>
        )}
      </div>
    </li>
  )
}

function NoLocItem ({ p }: { p: Package }) {
  return (
    <li className='flex gap-3 rounded-lg border border-dashed border-slate-200 p-2 text-sm text-slate-600'>
      <span className='flex h-6 w-6 shrink-0 items-center justify-center text-xs'>📍</span>
      <div className='min-w-0'>
        <div className='truncate'>{p.customer_name ?? p.tracking_number}</div>
        <div className='text-xs text-slate-400'>sin ubicación{p.address ? ` · ${p.address}` : ''}</div>
      </div>
    </li>
  )
}

/** Marcador con el número de parada (sin imágenes: evita problemas de rutas en Vite). */
const numberIcon = (n: number | string, color = '#2563eb') => L.divIcon({
  className: '',
  html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
    border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function FitBounds ({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15)
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40] })
  }, [map, points])
  return null
}

export default function RoutePage () {
  const batches = useQuery({ queryKey: ['batches'], queryFn: api.batches })
  const [batchId, setBatchId] = useState<number | undefined>()
  const [origin, setOrigin] = useState<{ lat: number, lng: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const qc = useQueryClient()

  const route = useQuery({
    queryKey: ['route', batchId, origin?.lat, origin?.lng],
    queryFn: () => api.todayRoute({ ...origin, batchId }),
    refetchInterval: 60_000,
  })

  const useMyLocation = () => {
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      p => setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoError('No se pudo obtener la ubicación del navegador'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const r = route.data

  const notify = useMutation({
    mutationFn: (p: Package) => api.onTheWay(p.id).then(res => ({ res, p })),
    onSuccess: ({ res, p }) => setNotice(res.queued
      ? `Aviso “en camino” en cola para ${p.customer_name ?? 'el cliente'} (llegada ${res.tiempo})`
      : res.reason ?? 'No se envió'),
  })

  // Terminar el día: lo pendiente pasa a mañana y se avisa a cada cliente
  const endOfDay = useMutation({
    mutationFn: () => api.endOfDay(batchId),
    onSuccess: res => {
      setNotice(`${res.marked} clientes avisados de que se les entrega mañana${res.skipped ? ` · ${res.skipped} ya tenían el aviso de hoy` : ''}`)
      qc.invalidateQueries({ queryKey: ['route'] })
    },
  })
  const bounds = useMemo(() => {
    const pts: [number, number][] = (r?.stops ?? []).map(s => [s.package.dest_latitude!, s.package.dest_longitude!])
    if (r?.origin) pts.unshift(r.origin)
    return pts
  }, [r])

  return (
    <div className='flex h-full flex-col'>
      <PageHeader
        title='Ruta del día'
        subtitle='Sector por sector, en orden de cercanía (por calles reales cuando OSRM está activo)'
        actions={<>
          <select className={input} value={batchId ?? ''} onChange={e => setBatchId(e.target.value ? Number(e.target.value) : undefined)}>
            <option value=''>Todas las cargas abiertas</option>
            {(batches.data ?? []).filter(b => b.status !== 'closed').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button className={btn.ghost} onClick={useMyLocation}>⌖ Desde mi ubicación</button>
          {origin && <button className={btn.link} onClick={() => setOrigin(null)}>Quitar origen</button>}
          <button
            className={btn.ghost}
            disabled={endOfDay.isPending || !r?.pending}
            onClick={() => confirm(`¿Terminar el día? Los ${r?.pending ?? 0} paquetes pendientes se marcan como incidente “falta de tiempo” y a cada cliente se le avisa por WhatsApp que se le entrega mañana. No cuenta como intento fallido.`) && endOfDay.mutate()}
          >
            🌙 Terminar el día
          </button>
        </>}
      />
      <ErrorBox error={route.error || geoError || endOfDay.error || notify.error} />
      {notice && (
        <div className='mx-8 mt-3 flex justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800'>
          {notice}<button onClick={() => setNotice(null)}>×</button>
        </div>
      )}
      <div className='flex min-h-0 flex-1'>
        <aside className='w-80 shrink-0 overflow-auto border-r border-slate-200 bg-white p-4'>
          {!r ? <Spinner /> : (
            <>
              <div className='mb-3 space-y-1 text-sm'>
                <div><b>{r.pending}</b> por entregar</div>
                {r.stops.length > 0 && (
                  <div>
                    {r.total_km.toFixed(1)} km{r.total_min != null && <> · {Math.round(r.total_min)} min</>}{' '}
                    <Badge color={r.distance_source === 'calles' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                      {r.distance_source === 'calles' ? 'por calles' : 'en línea recta'}
                    </Badge>
                  </div>
                )}
                {!r.origin && <div className='text-xs text-slate-500'>Sin origen: empieza por la parada más al norte.</div>}
              </div>
              {r.sectors.map(sector => {
                const stops = r.stops.filter(s => !s.package.out_of_route && s.package.sector === sector)
                const noLoc = r.without_location.filter(p => p.sector === sector)
                if (!stops.length && !noLoc.length) return null
                return (
                  <section key={sector} className='mb-4'>
                    <h3 className='mb-2 flex justify-between font-bold text-slate-800'>
                      <span>📍 {sector}</span>
                      <span className='font-normal text-slate-500'>{stops.length + noLoc.length}</span>
                    </h3>
                    <ol className='space-y-2'>
                      {stops.map(s => <StopItem key={s.package.id} s={s} onNotify={notify.mutate} />)}
                      {noLoc.map(p => <NoLocItem key={p.id} p={p} />)}
                    </ol>
                  </section>
                )
              })}
              {r.out_of_route > 0 && (
                <section className='mb-4'>
                  <h3 className='mb-1 flex justify-between font-bold' style={{ color: OUT_COLOR }}>
                    <span>Fuera de ruta</span><span className='font-normal'>{r.out_of_route}</span>
                  </h3>
                  <p className='mb-2 text-xs text-slate-500'>
                    A más de {r.outlier_km} km de las demás entregas. Van al final para no desviar la ruta.
                  </p>
                  <ol className='space-y-2'>
                    {r.stops.filter(s => s.package.out_of_route).map(s => <StopItem key={s.package.id} s={s} />)}
                  </ol>
                </section>
              )}
            </>
          )}
        </aside>
        <div className='min-w-0 flex-1'>
          <MapContainer center={DEFAULT_CENTER} zoom={12} className='h-full w-full'>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            <FitBounds points={bounds} />
            {r?.geometry && <Polyline positions={r.geometry} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.8 }} />}
            {r?.origin && <Marker position={r.origin} icon={numberIcon('⌖', '#0f172a')}><Popup>Punto de salida</Popup></Marker>}
            {r?.stops.map(s => (
              <Marker key={s.package.id} position={[s.package.dest_latitude!, s.package.dest_longitude!]}
                icon={numberIcon(s.order, s.package.out_of_route ? OUT_COLOR : undefined)}>
                <Popup>
                  <div className='space-y-1 text-sm'>
                    <div className='font-semibold'>{s.order}. {s.package.customer_name ?? '—'}</div>
                    <div className='text-xs'>Sector: <b>{s.package.sector ?? '—'}</b></div>
                    {s.package.out_of_route && <OutBadge />}
                    <div>{localPhone(s.package.customer_phone)}</div>
                    {s.package.address && <div className='text-xs'>{s.package.address}</div>}
                    <a href={mapsUrl(s.package.dest_latitude!, s.package.dest_longitude!)} target='_blank' rel='noreferrer'>Abrir en Google Maps</a>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
