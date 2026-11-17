import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { RouteFeedbackItem, RouteFeedbackPkg } from '../api/types'
import { PageHeader } from '../components/Layout'
import { ErrorBox, formatDate, input, Spinner } from '../components/ui'

const KIND: Record<string, [string, string]> = {
  far: ['Me mandó lejos', 'bg-red-100 text-red-700'],
  sector: ['Sector equivocado', 'bg-amber-100 text-amber-800'],
  other: ['Otro', 'bg-slate-100 text-slate-700'],
  pinned: ['Eligió otro cliente', 'bg-blue-100 text-blue-700'],
  skipped: ['Entregó otro', 'bg-blue-50 text-blue-700'],
}

const km = (v: number | null) => v == null ? '—' : `${v.toFixed(1)} km`
const gmaps = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`

function Pkg ({ label, p }: { label: string, p: RouteFeedbackPkg | null }) {
  if (!p) return null
  return (
    <div className='text-xs'>
      <span className='font-semibold text-slate-500'>{label}: </span>
      {p.address || p.tracking}
      {p.sector && <span className='ml-1 rounded bg-slate-100 px-1'>{p.sector}</span>}
      {p.geo_barriada && p.geo_barriada !== p.sector && <span className='ml-1 text-slate-400'>(mapa: {p.geo_barriada})</span>}
      {p.lat != null && p.lng != null && (
        <a className='ml-1 text-brand hover:underline' href={gmaps(p.lat, p.lng)} target='_blank' rel='noreferrer'>📍</a>
      )}
    </div>
  )
}

/** Fallas de la ruta: lo que reportan los repartidores y los desvíos que se
 * registran solos (eligió o entregó otro cliente). Sirve para mejorar el
 * algoritmo de la ruta y los sectores. */
export default function RouteFeedbackPage () {
  const [days, setDays] = useState(14)
  const [kind, setKind] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['route-feedback', days], queryFn: () => api.routeFeedback(days),
  })
  const rows = (data ?? []).filter(r => !kind || r.kind === kind)
  const counts = (data ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {})

  return (
    <>
      <PageHeader title='Fallas de ruta' subtitle='Reportes de los repartidores y desvíos automáticos'
        actions={
          <select className={input} value={days} onChange={e => setDays(Number(e.target.value))}>
            {[7, 14, 30, 90].map(d => <option key={d} value={d}>Últimos {d} días</option>)}
          </select>
        } />
      <div className='space-y-4 p-8'>
        <ErrorBox error={error} />
        <div className='flex flex-wrap gap-2'>
          <button onClick={() => setKind('')} className={`rounded-full border px-3 py-1 text-sm ${!kind ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-slate-300'}`}>
            Todas ({data?.length ?? 0})
          </button>
          {Object.entries(KIND).map(([k, [label]]) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-sm ${kind === k ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-slate-300'}`}>
              {label} ({counts[k] ?? 0})
            </button>
          ))}
        </div>
        {isLoading ? <Spinner /> : rows.length === 0 ? (
          <p className='text-sm text-slate-500'>Sin fallas registradas en este periodo.</p>
        ) : (
          <div className='overflow-x-auto rounded-2xl border border-slate-200 bg-white'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
                <tr>
                  <th className='px-4 py-3'>Cuándo</th>
                  <th className='px-4 py-3'>Tipo</th>
                  <th className='px-4 py-3'>Repartidor</th>
                  <th className='px-4 py-3'>Distancias desde donde estaba</th>
                  <th className='px-4 py-3'>Detalle</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {rows.map((r: RouteFeedbackItem) => {
                  const [label, cls] = KIND[r.kind] ?? [r.kind, 'bg-slate-100']
                  const worse = r.suggested_km != null && r.nearest_km != null && r.suggested_km - r.nearest_km > 1
                  return (
                    <tr key={r.id} className='align-top'>
                      <td className='whitespace-nowrap px-4 py-3'>{formatDate(r.ts, true)}</td>
                      <td className='px-4 py-3'><span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span></td>
                      <td className='px-4 py-3'>{r.user ?? '—'}</td>
                      <td className='px-4 py-3 text-xs'>
                        <div className={worse ? 'font-semibold text-red-700' : ''}>Propuesto: {km(r.suggested_km)}</div>
                        <div>Más cercano: {km(r.nearest_km)}</div>
                        {r.chosen_km != null && <div>Elegido: {km(r.chosen_km)}</div>}
                        {r.latitude != null && r.longitude != null && (
                          <a className='text-brand hover:underline' href={gmaps(r.latitude, r.longitude)} target='_blank' rel='noreferrer'>📍 dónde estaba</a>
                        )}
                      </td>
                      <td className='space-y-1 px-4 py-3'>
                        {r.comment && <div className='italic'>“{r.comment}”</div>}
                        <Pkg label='Propuesto' p={r.details?.suggested ?? null} />
                        <Pkg label='Elegido' p={r.details?.chosen ?? null} />
                        <Pkg label='Más cercano' p={r.details?.nearest ?? null} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
