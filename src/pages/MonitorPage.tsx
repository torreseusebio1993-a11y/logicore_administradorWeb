import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { MonitorErrors, MonitorMetrics, MonitorStatus, SystemEventItem } from '../api/types'
import { BarChart } from '../components/BarChart'
import { PageHeader } from '../components/Layout'
import { Badge, btn, ErrorBox, formatDate, Modal, Spinner } from '../components/ui'

type Tab = 'resumen' | 'errores' | 'ocr' | 'whatsapp' | 'rutas' | 'usuarios'
const TABS: [Tab, string][] = [
  ['resumen', 'Resumen'], ['errores', 'Errores'], ['ocr', 'OCR'], ['whatsapp', 'WhatsApp'],
  ['rutas', 'Rutas y entregas'], ['usuarios', 'Usuarios'],
]

// Estado: siempre ícono + texto (nunca solo color)
const STATE: Record<string, [string, string, string]> = {
  ok: ['✅', 'Bien', 'border-green-200 bg-green-50 text-green-800'],
  warn: ['⚠️', 'Atención', 'border-amber-200 bg-amber-50 text-amber-800'],
  error: ['⛔', 'Falla', 'border-red-200 bg-red-50 text-red-800'],
}
const LEVEL: Record<string, string> = {
  error: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-800', info: 'bg-slate-100 text-slate-700',
}
const SOURCE: Record<string, string> = {
  backend: 'Backend', ocr: 'OCR', whatsapp: 'WhatsApp', ruta: 'Rutas', mapa: 'Mapa', app: 'App móvil',
  servidor: 'Servidor', alerta: 'Alerta',
}
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0)
const short = (d: string) => d.slice(5)          // 2026-11-10 → 11-10

export default function MonitorPage () {
  const [tab, setTab] = useState<Tab>('resumen')
  const [days, setDays] = useState(7)
  const status = useQuery({ queryKey: ['monitor-status'], queryFn: api.monitorStatus, refetchInterval: 30_000 })
  const metrics = useQuery({ queryKey: ['monitor-metrics', days], queryFn: () => api.monitorMetrics(days), refetchInterval: 60_000 })
  const check = useMutation({ mutationFn: api.monitorCheckAlerts })

  const s = status.data
  return (
    <>
      <PageHeader
        title='Monitoreo'
        subtitle={s ? `Revisado ${formatDate(s.checked_at, true)} · se actualiza solo` : 'Estado del sistema'}
        actions={<>
          <select className='rounded-lg border border-slate-300 px-3 py-2 text-sm' value={days} onChange={e => setDays(Number(e.target.value))}>
            {[1, 7, 14, 30].map(d => <option key={d} value={d}>{d === 1 ? 'Hoy' : `Últimos ${d} días`}</option>)}
          </select>
          <button className={btn.ghost} onClick={() => { status.refetch(); metrics.refetch() }}>↻ Actualizar</button>
          <button className={btn.ghost} disabled={check.isPending} onClick={() => check.mutate()}>🔔 Revisar alertas ahora</button>
        </>}
      />
      <div className='space-y-5 p-8'>
        <ErrorBox error={status.error || metrics.error || check.error} />
        {check.data && (
          <div className='rounded-lg bg-slate-100 px-3 py-2 text-sm'>
            {Object.keys(check.data.problems).length === 0
              ? '✅ No hay problemas activos.'
              : <>Problemas activos: {Object.values(check.data.problems).join(' · ')}</>}
            {check.data.notified > 0 && <> · Aviso enviado por WhatsApp.</>}
          </div>
        )}
        <div className='flex flex-wrap gap-2'>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-full border px-3 py-1 text-sm ${tab === k ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-slate-300 bg-white'}`}>
              {label}
            </button>
          ))}
        </div>
        {!s || !metrics.data ? <Spinner /> : (
          <>
            {tab === 'resumen' && <Summary s={s} m={metrics.data} />}
            {tab === 'errores' && <Errors />}
            {tab === 'ocr' && <Ocr s={s} m={metrics.data} />}
            {tab === 'whatsapp' && <WhatsApp s={s} m={metrics.data} />}
            {tab === 'rutas' && <Routes s={s} m={metrics.data} />}
            {tab === 'usuarios' && <Users m={metrics.data} />}
          </>
        )}
      </div>
    </>
  )
}

function Card ({ title, children, className = '' }: { title: string, children: React.ReactNode, className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <h2 className='mb-3 font-semibold'>{title}</h2>
      {children}
    </section>
  )
}

function Stat ({ label, value, hint }: { label: string, value: React.ReactNode, hint?: string }) {
  return (
    <div>
      <div className='text-xs text-slate-500'>{label}</div>
      <div className='text-2xl font-bold tracking-tight'>{value}</div>
      {hint && <div className='text-xs text-slate-500'>{hint}</div>}
    </div>
  )
}

function Light ({ name, state, message, extra }: { name: string, state: string, message: string, extra?: string }) {
  const [icon, label, cls] = STATE[state] ?? STATE.warn
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className='flex items-center justify-between'>
        <span className='font-semibold'>{name}</span>
        <span className='text-sm'>{icon} {label}</span>
      </div>
      <div className='mt-1 text-sm'>{message}</div>
      {extra && <div className='mt-1 text-xs opacity-80'>{extra}</div>}
    </div>
  )
}

// ── Resumen ─────────────────────────────────────────

function Summary ({ s, m }: { s: MonitorStatus, m: MonitorMetrics }) {
  const [icon, label] = STATE[s.overall]
  return (
    <>
      <div className={`rounded-2xl border p-5 text-lg font-semibold ${STATE[s.overall][2]}`}>
        {icon} Sistema: {label}
      </div>
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
        <Light name='Backend' state={s.backend.state} message={s.backend.message}
          extra={`Encendido hace ${s.backend.uptime_h} h${s.backend.p95_ms != null ? ` · 95 % responde en < ${s.backend.p95_ms} ms` : ''}`} />
        <Light name='Base de datos' state={s.database.state} message={s.database.message}
          extra={s.database.size_mb != null ? `${s.database.size_mb} MB · ${s.database.connections} conexiones` : undefined} />
        <Light name='WhatsApp' state={s.whatsapp.state} message={s.whatsapp.message}
          extra={`${s.whatsapp.queued} en cola · ${s.whatsapp.failed_24h} fallidos (24 h)`} />
        <Light name='OCR' state={s.ocr.state} message={s.ocr.message}
          extra={s.ocr.avg_ms ? `${(s.ocr.avg_ms / 1000).toFixed(1)} s por etiqueta` : undefined} />
        <Light name='Rutas por calles (OSRM)' state={s.osrm.state} message={s.osrm.message}
          extra={s.osrm.ms != null ? `${s.osrm.ms} ms` : undefined} />
        <Light name='Mapa (Nominatim)' state={s.nominatim.state} message={s.nominatim.message} />
        <Light name='Servidor' state={s.server.state} message={s.server.message || '—'}
          extra={s.server.disk_total_gb ? `Disco ${s.server.disk_used_gb} de ${s.server.disk_total_gb} GB · RAM ${Math.round((s.server.ram_used_mb ?? 0) / 1024 * 10) / 10} de ${Math.round((s.server.ram_total_mb ?? 0) / 1024)} GB` : undefined} />
      </div>
      <div className='grid gap-4 xl:grid-cols-3'>
        <Card title='CPU del servidor (24 h)'>
          <BarChart ariaLabel='CPU' unit=' %' max={100} data={m.server.map(p => ({ label: p.t.slice(11), value: p.cpu_pct }))} />
        </Card>
        <Card title='RAM del servidor (24 h)'>
          <BarChart ariaLabel='RAM' unit=' %' max={100} data={m.server.map(p => ({ label: p.t.slice(11), value: p.ram_pct }))} />
        </Card>
        <Card title='Disco del servidor (24 h)'>
          <BarChart ariaLabel='Disco' unit=' %' max={100} data={m.server.map(p => ({ label: p.t.slice(11), value: p.disk_pct }))} />
        </Card>
      </div>
      <div className='grid gap-4 xl:grid-cols-2'>
        <Card title='Uso del sistema por hora (24 h)'>
          <BarChart ariaLabel='Peticiones por hora' data={m.requests_by_hour.map(h => ({
            label: h.hour.slice(11, 16), value: h.requests,
            hint: `${h.errors} errores · ${h.client_errors} rechazadas · ${h.avg_ms} ms promedio` }))} />
        </Card>
        <Card title='Errores del servidor por hora (24 h)'>
          <BarChart ariaLabel='Errores por hora' color='#dc2626' data={m.requests_by_hour.map(h => ({
            label: h.hour.slice(11, 16), value: h.errors }))} />
        </Card>
      </div>
    </>
  )
}

// ── Errores ─────────────────────────────────────────

function Errors () {
  const [hours, setHours] = useState(24)
  const [source, setSource] = useState('')
  const [detail, setDetail] = useState<SystemEventItem | null>(null)
  const q = useQuery({
    queryKey: ['monitor-errors', hours, source],
    queryFn: () => api.monitorErrors(hours, source || undefined), refetchInterval: 30_000,
  })
  const e: MonitorErrors | undefined = q.data
  return (
    <>
      <div className='flex flex-wrap gap-2'>
        <select className='rounded-lg border border-slate-300 px-3 py-2 text-sm' value={hours} onChange={x => setHours(Number(x.target.value))}>
          {[[1, 'Última hora'], [24, 'Últimas 24 h'], [168, 'Últimos 7 días'], [720, 'Últimos 30 días']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className='rounded-lg border border-slate-300 px-3 py-2 text-sm' value={source} onChange={x => setSource(x.target.value)}>
          <option value=''>Todos los servicios</option>
          {Object.entries(SOURCE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <ErrorBox error={q.error} />
      {!e ? <Spinner /> : (
        <>
          <div className='grid gap-4 xl:grid-cols-3'>
            <Card title='Por servicio'>
              {e.by_source.length === 0 ? <p className='text-sm text-slate-500'>Sin errores 🎉</p> : (
                <ul className='space-y-1 text-sm'>{e.by_source.map(x => <li key={x.source} className='flex justify-between'><span>{SOURCE[x.source] ?? x.source}</span><b>{x.count}</b></li>)}</ul>
              )}
            </Card>
            <Card title='Por usuario'>
              <ul className='space-y-1 text-sm'>{e.by_user.map(x => <li key={x.user} className='flex justify-between'><span>{x.user}</span><b>{x.count}</b></li>)}</ul>
            </Card>
            <Card title='Peticiones rechazadas por endpoint'>
              <ul className='space-y-1 text-sm'>{e.by_path.map(x => (
                <li key={x.path + x.status} className='flex justify-between gap-2'>
                  <span className='truncate font-mono text-xs' title={x.path}>{x.path}</span>
                  <span className='whitespace-nowrap'><Badge color={x.status >= 500 ? LEVEL.error : LEVEL.warning}>{x.status}</Badge> <b>{x.count}</b></span>
                </li>))}</ul>
              {e.by_path.length === 0 && <p className='text-sm text-slate-500'>Ninguna</p>}
            </Card>
          </div>
          <Card title='Qué está fallando (agrupado)'>
            <table className='w-full text-sm'>
              <thead className='text-left text-xs uppercase text-slate-500'>
                <tr><th className='py-1'>Servicio</th><th>Problema</th><th>Veces</th><th>Usuarios</th><th>Dónde</th><th>Último</th></tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {e.groups.map(g => (
                  <tr key={g.source + g.kind} className='align-top'>
                    <td className='py-2'><Badge color={LEVEL[g.level]}>{SOURCE[g.source] ?? g.source}</Badge></td>
                    <td className='max-w-md'><div className='font-mono text-xs text-slate-500'>{g.kind}</div>{g.message}</td>
                    <td className='font-bold'>{g.count}</td>
                    <td className='text-xs'>{g.users.join(', ') || '—'}</td>
                    <td className='font-mono text-xs'>{g.paths.join(', ') || '—'}</td>
                    <td className='whitespace-nowrap text-xs'>{formatDate(g.last, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {e.groups.length === 0 && <p className='py-4 text-center text-sm text-slate-500'>Sin errores en este periodo 🎉</p>}
          </Card>
          <Card title={`Últimos eventos (${e.events.length})`}>
            <ul className='divide-y divide-slate-100 text-sm'>
              {e.events.map(ev => (
                <li key={ev.id} className='flex cursor-pointer gap-3 py-2 hover:bg-slate-50' onClick={() => setDetail(ev)}>
                  <span className='w-32 shrink-0 text-xs text-slate-500'>{formatDate(ev.ts, true)}</span>
                  <Badge color={LEVEL[ev.level]}>{SOURCE[ev.source] ?? ev.source}</Badge>
                  <span className='min-w-0 flex-1 truncate'>{ev.message}</span>
                  <span className='shrink-0 text-xs text-slate-500'>{ev.user ?? ''}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
      {detail && (
        <Modal title='Detalle del evento' wide onClose={() => setDetail(null)}>
          <dl className='grid grid-cols-[8rem_1fr] gap-y-1 text-sm'>
            <dt className='text-slate-500'>Cuándo</dt><dd>{formatDate(detail.ts, true)}</dd>
            <dt className='text-slate-500'>Servicio</dt><dd>{SOURCE[detail.source] ?? detail.source} · <span className='font-mono'>{detail.kind}</span></dd>
            <dt className='text-slate-500'>Usuario</dt><dd>{detail.user ?? '—'}{detail.app_version ? ` · app ${detail.app_version}` : ''}</dd>
            <dt className='text-slate-500'>Dónde</dt><dd className='font-mono'>{detail.path ?? '—'}</dd>
            <dt className='text-slate-500'>Mensaje</dt><dd>{detail.message}</dd>
          </dl>
          {detail.details && (
            <pre className='mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100'>
              {typeof detail.details.traceback === 'string' ? detail.details.traceback
                : typeof detail.details.stack === 'string' ? detail.details.stack
                  : JSON.stringify(detail.details, null, 2)}
            </pre>
          )}
        </Modal>
      )}
    </>
  )
}

// ── OCR ────────────────────────────────────────────

function Ocr ({ s, m }: { s: MonitorStatus, m: MonitorMetrics }) {
  const d = m.ocr.daily
  const scans = d.reduce((a, x) => a + x.scans, 0)
  const ok = d.reduce((a, x) => a + x.success, 0)
  const qr = d.reduce((a, x) => a + x.qr, 0)
  const text = d.reduce((a, x) => a + x.text, 0)
  const manual = d.reduce((a, x) => a + x.manual, 0)
  const corrected = d.reduce((a, x) => a + x.corrected, 0)
  return (
    <>
      <div className='grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-5'>
        <Stat label='Etiquetas escaneadas' value={scans} />
        <Stat label='Tracking leído' value={`${pct(ok, scans)} %`} hint={`${ok} de ${scans}`} />
        <Stat label='Del QR (exacto)' value={`${pct(qr, qr + text + manual)} %`} hint={`${qr} paquetes`} />
        <Stat label='Corregidos a mano' value={corrected} hint='el OCR leyó mal algún dato' />
        <Stat label='Tiempo por etiqueta' value={s.ocr.avg_ms ? `${(s.ocr.avg_ms / 1000).toFixed(1)} s` : '—'} hint='últimas 24 h' />
      </div>
      <div className='grid gap-4 xl:grid-cols-2'>
        <Card title='Tracking leído por día (%)'>
          <BarChart ariaLabel='Porcentaje de lectura por día' unit=' %' max={100}
            data={d.map(x => ({ label: short(x.day), value: x.scans ? pct(x.success, x.scans) : null, hint: `${x.success} de ${x.scans}` }))} />
        </Card>
        <Card title='Paquetes corregidos a mano por día'>
          <BarChart ariaLabel='Correcciones por día' color='#d97706'
            data={d.map(x => ({ label: short(x.day), value: x.corrected }))} />
        </Card>
      </div>
      <Card title='Últimas etiquetas que no se pudieron leer'>
        {m.ocr.recent_failures.length === 0 ? <p className='text-sm text-slate-500'>Ninguna 🎉</p> : (
          <ul className='divide-y divide-slate-100 text-sm'>
            {m.ocr.recent_failures.map((f, i) => (
              <li key={i} className='py-2'>
                <div className='flex justify-between text-xs text-slate-500'>
                  <span>{formatDate(f.ts, true)} · plantilla {f.template} · confianza {f.confidence?.toFixed(2) ?? '—'}</span>
                </div>
                <div className='truncate font-mono text-xs'>{f.error ?? f.text}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

// ── WhatsApp ────────────────────────────────────────

function WhatsApp ({ s, m }: { s: MonitorStatus, m: MonitorMetrics }) {
  const w = m.whatsapp
  const sent = w.daily.reduce((a, x) => a + x.sent, 0)
  const failed = w.daily.reduce((a, x) => a + x.failed, 0)
  return (
    <>
      <div className='grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-5'>
        <Stat label='Enviados' value={sent} />
        <Stat label='Fallidos' value={failed} hint={sent + failed ? `${pct(failed, sent + failed)} %` : undefined} />
        <Stat label='En cola ahora' value={s.whatsapp.queued}
          hint={s.whatsapp.oldest_queued_min != null ? `el más viejo: hace ${s.whatsapp.oldest_queued_min} min` : undefined} />
        <Stat label='Mandaron su ubicación' value={`${pct(w.location_answered, w.location_requests)} %`}
          hint={`${w.location_answered} de ${w.location_requests} a los que se les pidió`} />
        <Stat label='Tardan en responder' value={w.median_answer_min != null ? `${w.median_answer_min} min` : '—'} hint='mediana' />
      </div>
      <Card title='Cuentas'>
        <table className='w-full text-sm'>
          <thead className='text-left text-xs uppercase text-slate-500'><tr><th className='py-1'>Cuenta</th><th>Estado</th><th>Hoy</th><th>Último envío</th></tr></thead>
          <tbody className='divide-y divide-slate-100'>
            {s.whatsapp.accounts.map(a => (
              <tr key={a.id}>
                <td className='py-2'>{a.name}{!a.enabled && ' (pausada)'}</td>
                <td>{a.status === 'connected' ? '✅ Conectada' : a.status === 'logged_out' ? '⛔ Sesión cerrada' : `⚠️ ${a.status}`}</td>
                <td>{a.clients_today} clientes · {a.sent_today} mensajes</td>
                <td className='text-xs'>{a.last_sent_at ? formatDate(a.last_sent_at, true) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!s.whatsapp.service_online && <p className='mt-2 text-sm text-red-700'>⛔ El servicio de WhatsApp no responde.</p>}
      </Card>
      <div className='grid gap-4 xl:grid-cols-2'>
        <Card title='Mensajes enviados por día'>
          <BarChart ariaLabel='Mensajes por día' data={w.daily.map(x => ({ label: short(x.day), value: x.sent, hint: `${x.read} leídos` }))} />
        </Card>
        <Card title='Mensajes fallidos por día'>
          <BarChart ariaLabel='Fallidos por día' color='#dc2626' data={w.daily.map(x => ({ label: short(x.day), value: x.failed }))} />
        </Card>
      </div>
      <div className='grid gap-4 xl:grid-cols-2'>
        <Card title='Por tipo de mensaje'>
          <ul className='space-y-1 text-sm'>{w.by_template.map(t => <li key={t.template} className='flex justify-between'><span className='font-mono text-xs'>{t.template}</span><b>{t.count}</b></li>)}</ul>
        </Card>
        <Card title='Por qué fallan'>
          {w.failure_reasons.length === 0 ? <p className='text-sm text-slate-500'>Sin fallas 🎉</p> : (
            <ul className='space-y-1 text-sm'>{w.failure_reasons.map(r => <li key={r.error ?? '-'} className='flex justify-between gap-2'><span className='truncate'>{r.error ?? 'Sin detalle'}</span><b>{r.count}</b></li>)}</ul>
          )}
        </Card>
      </div>
    </>
  )
}

// ── Rutas y entregas ────────────────────────────────

function Routes ({ s, m }: { s: MonitorStatus, m: MonitorMetrics }) {
  const r = m.routes
  const days = m.deliveries.days
  const jumps = days.reduce((a, x) => a + x.sector_jumps, 0)
  return (
    <>
      <div className='grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-5'>
        <Stat label='Por entregar' value={r.pending} />
        <Stat label='Con ubicación' value={`${pct(r.with_location, r.pending)} %`} hint={`${r.with_location} de ${r.pending}`} />
        <Stat label='Con dirección del mapa' value={`${pct(r.with_map_address, r.with_location)} %`} hint='barriada / calle reales' />
        <Stat label='Cálculo de ruta' value={r.route_requests ? `${(r.route_avg_ms / 1000).toFixed(1)} s` : '—'} hint={`máx. ${(r.route_max_ms / 1000).toFixed(1)} s · ${r.route_requests} veces`} />
        <Stat label='Salidas de barriada con pendientes' value={jumps} hint='debería ser 0' />
      </div>
      {(s.osrm.state !== 'ok' || r.map_service_failures > 0) && (
        <p className='rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800'>
          ⚠️ {s.osrm.state !== 'ok' ? s.osrm.message : `Los servicios de mapa fallaron ${r.map_service_failures} veces en el periodo.`}
        </p>
      )}
      <div className='grid gap-4 xl:grid-cols-2'>
        <Card title='Entregas por día'>
          <BarChart ariaLabel='Entregas por día' data={days.map(x => ({ label: short(x.day), value: x.deliveries, hint: `${x.first}–${x.last} · ${x.failed} no entregados · ${x.incidents} para mañana` }))} />
        </Card>
        <Card title='Entregas por hora del día'>
          <BarChart ariaLabel='Entregas por hora' data={m.deliveries.by_hour.map(h => ({ label: `${h.hour}:00`, value: h.deliveries }))} />
        </Card>
      </div>
      <Card title='Día por día'>
        <table className='w-full text-sm'>
          <thead className='text-left text-xs uppercase text-slate-500'>
            <tr><th className='py-1'>Día</th><th>Entregas</th><th>Horario</th><th>Entre entregas</th><th>Salidas de barriada</th><th>No entregados</th><th>Para mañana</th></tr>
          </thead>
          <tbody className='divide-y divide-slate-100'>
            {[...days].reverse().map(x => (
              <tr key={x.day}>
                <td className='py-2'>{x.day}</td><td>{x.deliveries}</td><td>{x.first}–{x.last}</td>
                <td>{x.avg_gap_min != null ? `${x.avg_gap_min} min` : '—'}</td>
                <td>{x.sector_jumps > 0 ? `⚠️ ${x.sector_jumps}` : '✅ 0'}</td>
                <td>{x.failed}</td><td>{x.incidents}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {days.length === 0 && <p className='py-4 text-center text-sm text-slate-500'>Sin entregas en el periodo</p>}
      </Card>
    </>
  )
}

// ── Usuarios ────────────────────────────────────────

function Users ({ m }: { m: MonitorMetrics }) {
  return (
    <Card title='Usuarios'>
      <table className='w-full text-sm'>
        <thead className='text-left text-xs uppercase text-slate-500'>
          <tr><th className='py-1'>Usuario</th><th>Última vez</th><th>Desde</th><th>Versión de la app</th><th>Uso (24 h)</th><th>Errores (24 h)</th><th>Lo que más usa</th></tr>
        </thead>
        <tbody className='divide-y divide-slate-100'>
          {m.users.map(u => (
            <tr key={u.id} className='align-top'>
              <td className='py-2'>{u.name}<div className='text-xs text-slate-500'>@{u.username}</div></td>
              <td className='text-xs'>{u.last_seen ? formatDate(u.last_seen, true) : 'Nunca'}</td>
              <td>{u.last_client === 'app' ? '📱 App' : u.last_client === 'panel' ? '💻 Panel' : '—'}</td>
              <td>{u.app_version ?? '—'}</td>
              <td>{u.requests_24h}</td>
              <td>{u.errors_24h > 0 ? <b className='text-red-700'>⚠️ {u.errors_24h}</b> : '0'}</td>
              <td className='font-mono text-xs'>{u.top_actions.map(a => `${a.path} (${a.count})`).join(' · ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
