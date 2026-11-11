import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { UserSettings } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { btn, ErrorBox, Field, input, Spinner } from '../components/ui'

// Minutos desde la medianoche ↔ "HH:MM" (input type=time). 1440 = medianoche.
const toClock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fromClock = (v: string, isEnd = false) => {
  const [h, m] = v.split(':').map(Number)
  const total = h * 60 + m
  return isEnd && total === 0 ? 1440 : total
}

type Unit = [label: string, factor: number]
const SECONDS: Unit[] = [['segundos', 1], ['minutos', 60]]
const MINUTES: Unit[] = [['minutos', 1], ['horas', 60]]

/** Número + unidad (45 minutos, 2 horas). `value` en la unidad base. */
function DurationInput ({ value, units, min, max, onChange }: {
  value: number, units: Unit[], min: number, max: number, onChange: (v: number) => void,
}) {
  // La unidad más grande que lo representa exacto: 120 min → 2 horas
  const [factor, setFactor] = useState(() =>
    [...units].reverse().find(([, f]) => value >= f && value % f === 0)?.[1] ?? units[0][1])
  const [text, setText] = useState(String(value / factor))
  return (
    <div className='flex gap-2'>
      <input className={input} type='number' min={Math.ceil(min / factor)} max={Math.floor(max / factor)}
        value={text} required
        onChange={e => { setText(e.target.value); onChange(Number(e.target.value) * factor) }} />
      <select className={`${input} w-32`} value={factor}
        onChange={e => { const f = Number(e.target.value); setFactor(f); onChange(Number(text) * f) }}>
        {units.map(([label, f]) => <option key={f} value={f}>{label}</option>)}
      </select>
    </div>
  )
}

export default function SettingsPage () {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['my-settings'], queryFn: api.mySettings })
  const [form, setForm] = useState<UserSettings | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (data) setForm(data) }, [data])

  const save = useMutation({
    mutationFn: () => {
      // Solo el formato nuevo (en minutos); las horas son para apps viejas
      const { wa_start_hour: _a, wa_end_hour: _b, wa_retry_hours: _c, ...rest } = form!
      return api.saveMySettings(rest)
    },
    onSuccess: d => {
      qc.setQueryData(['my-settings'], d)
      qc.invalidateQueries({ queryKey: ['wa-accounts'] })
      setSaved(true)
    },
  })
  const set = (k: keyof UserSettings, v: number | boolean | string) => { setForm(f => f && { ...f, [k]: v }); setSaved(false) }
  const badWindow = form ? form.wa_end_min <= form.wa_start_min : false

  return (
    <>
      <PageHeader title='Ajustes' subtitle={`Preferencias de ${user?.name ?? 'tu usuario'}`} />
      <div className='max-w-xl space-y-4 p-8'>
        <ErrorBox error={error || save.error} />
        {isLoading || !form ? <Spinner /> : (
          <form className='space-y-4 rounded-2xl border border-slate-200 bg-white p-6'
            onSubmit={e => { e.preventDefault(); save.mutate() }}>
            <div>
              <h2 className='font-semibold'>Mensajes de WhatsApp</h2>
              <p className='text-sm text-slate-500'>
                Aplican a tus cuentas de WhatsApp. Fuera del horario los mensajes esperan en cola.
              </p>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <Field label='Desde'>
                <input className={input} type='time' value={toClock(form.wa_start_min)} required
                  onChange={e => e.target.value && set('wa_start_min', fromClock(e.target.value))} />
              </Field>
              <Field label='Hasta' hint='00:00 = medianoche'>
                <input className={input} type='time' value={toClock(form.wa_end_min)} required
                  onChange={e => e.target.value && set('wa_end_min', fromClock(e.target.value, true))} />
              </Field>
            </div>
            <Field label='Pausa entre mensajes' hint='Mínimo 10 segundos. Más pausa = menos riesgo de bloqueo'>
              <DurationInput value={form.wa_min_interval_s} units={SECONDS} min={10} max={3600}
                onChange={v => set('wa_min_interval_s', v)} />
            </Field>
            <Field label='Clientes por día, por cuenta'
              hint='Cuenta clientes distintos, no mensajes: escribirle varias veces al mismo cliente gasta 1. En números nuevos empieza bajo (20–30)'>
              <input className={input} type='number' min={1} max={1000} value={form.wa_daily_limit}
                onChange={e => set('wa_daily_limit', Number(e.target.value))} required />
            </Field>

            <div className='pt-2'>
              <h2 className='font-semibold'>Reintento para pedir ubicación</h2>
              <p className='text-sm text-slate-500'>
                Si el cliente no responde, se le vuelve a pedir la ubicación con la plantilla
                “Recordatorio”. Si respondió con un texto no se reintenta: lo revisas tú.
              </p>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <Field label='Volver a pedir a los'>
                <DurationInput value={form.wa_retry_min} units={MINUTES} min={5} max={10080}
                  onChange={v => set('wa_retry_min', v)} />
              </Field>
              <Field label='Reintentos'>
                <select className={input} value={form.wa_max_retries} onChange={e => set('wa_max_retries', Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 0 ? 'Ninguno' : `Máximo ${n}`}</option>)}
                </select>
              </Field>
            </div>
            {form.wa_retry_min < 30 && (
              <p className='rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800'>
                ⚠️ Menos de 30 minutos: el cliente quizá ni vio el primer mensaje y la insistencia
                aumenta el riesgo de que WhatsApp bloquee el número.
              </p>
            )}

            <div className='pt-2'>
              <h2 className='font-semibold'>Avisos automáticos al cliente</h2>
            </div>
            <label className='flex items-start gap-3 text-sm'>
              <input type='checkbox' className='mt-1' checked={form.wa_auto_on_the_way}
                onChange={e => set('wa_auto_on_the_way', e.target.checked)} />
              <span>
                <b>Avisar “vamos en camino”</b>
                <span className='block text-slate-500'>Al entregar al anterior o tocar Navegar en la app: le llega el tiempo aproximado y que tenga su identificación a mano.</span>
              </span>
            </label>
            <label className='flex items-start gap-3 text-sm'>
              <input type='checkbox' className='mt-1' checked={form.wa_auto_eta_reply}
                onChange={e => set('wa_auto_eta_reply', e.target.checked)} />
              <span>
                <b>Responder “¿a qué hora llega?”</b>
                <span className='block text-slate-500'>Contesta con un tiempo aproximado según su puesto en la ruta.</span>
              </span>
            </label>
            <Field label='Esperar entre respuestas al mismo cliente'>
              <DurationInput value={form.wa_eta_cooldown_min} units={MINUTES} min={5} max={1440}
                onChange={v => set('wa_eta_cooldown_min', v)} />
            </Field>

            <div className='pt-2'>
              <h2 className='font-semibold'>Residenciales con control de acceso</h2>
              <p className='text-sm text-slate-500'>
                Si la dirección o la barriada del cliente tiene una de estas palabras, el aviso
                “vamos en camino” le pide que te anuncie en la garita con tu nombre, vehículo y placa
                (plantilla “Residencial con control de acceso”).
              </p>
            </div>
            <Field label='Palabras clave (separadas por coma)' hint='Puedes agregar barriadas completas: “Costa Verde, Bosque Dorado”'>
              <input className={input} value={form.access_keywords} placeholder='PH, Torre, Edificio, Condominio, Garita'
                onChange={e => set('access_keywords', e.target.value)} />
            </Field>
            <Field label='Tu nombre (como lo verá el cliente)'>
              <input className={input} value={form.driver_name ?? ''} onChange={e => set('driver_name', e.target.value)} />
            </Field>
            <div className='grid grid-cols-3 gap-4'>
              <div className='col-span-2'>
                <Field label='Vehículo y color'>
                  <input className={input} value={form.vehicle ?? ''} placeholder='Toyota Hilux blanca'
                    onChange={e => set('vehicle', e.target.value)} />
                </Field>
              </div>
              <Field label='Placa'>
                <input className={`${input} uppercase`} value={form.vehicle_plate ?? ''}
                  onChange={e => set('vehicle_plate', e.target.value)} />
              </Field>
            </div>

            <div className='pt-2'>
              <h2 className='font-semibold'>Ruta</h2>
            </div>
            <Field label='Marcar “fuera de ruta” a más de (km)'
              hint='Clientes lejos de la mayoría de entregas: se marcan y van al final de la ruta'>
              <input className={input} type='number' min={0.5} max={50} step={0.5} value={form.route_outlier_km}
                onChange={e => set('route_outlier_km', Number(e.target.value))} required />
            </Field>
            <Field label='Minutos por entrega'
              hint='Lo que tardas en cada cliente (estacionar, entregar). Se usa para calcular la hora de llegada'>
              <input className={input} type='number' min={0} max={60} value={form.route_service_min}
                onChange={e => set('route_service_min', Number(e.target.value))} required />
            </Field>

            {badWindow && (
              <p className='text-sm text-red-600'>La hora de fin debe ser después de la de inicio.</p>
            )}
            <div className='flex items-center gap-3'>
              <button className={btn.primary} disabled={save.isPending || badWindow}>
                {save.isPending ? 'Guardando…' : 'Guardar'}
              </button>
              {saved && <span className='text-sm text-green-700'>✓ Guardado</span>}
            </div>
          </form>
        )}
      </div>
    </>
  )
}
