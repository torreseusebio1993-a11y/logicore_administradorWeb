import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { UserSettings } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { btn, ErrorBox, Field, input, Spinner } from '../components/ui'

const hourLabel = (h: number) =>
  h === 24 ? '12:00 a. m. (medianoche)' : `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`

export default function SettingsPage () {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['my-settings'], queryFn: api.mySettings })
  const [form, setForm] = useState<UserSettings | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (data) setForm(data) }, [data])

  const save = useMutation({
    mutationFn: () => api.saveMySettings(form!),
    onSuccess: d => {
      qc.setQueryData(['my-settings'], d)
      qc.invalidateQueries({ queryKey: ['wa-accounts'] })
      setSaved(true)
    },
  })
  const set = (k: keyof UserSettings, v: number) => { setForm(f => f && { ...f, [k]: v }); setSaved(false) }

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
                <select className={input} value={form.wa_start_hour} onChange={e => set('wa_start_hour', Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </Field>
              <Field label='Hasta'>
                <select className={input} value={form.wa_end_hour} onChange={e => set('wa_end_hour', Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </Field>
            </div>
            <Field label='Pausa entre mensajes (segundos)' hint='Mínimo 10. Más pausa = menos riesgo de bloqueo'>
              <input className={input} type='number' min={10} max={3600} value={form.wa_min_interval_s}
                onChange={e => set('wa_min_interval_s', Number(e.target.value))} required />
            </Field>
            <Field label='Mensajes por día, por cuenta' hint='En números nuevos empieza bajo (20–30) y sube de a poco'>
              <input className={input} type='number' min={1} max={1000} value={form.wa_daily_limit}
                onChange={e => set('wa_daily_limit', Number(e.target.value))} required />
            </Field>
            {form.wa_end_hour <= form.wa_start_hour && (
              <p className='text-sm text-red-600'>La hora de fin debe ser después de la de inicio.</p>
            )}
            <div className='flex items-center gap-3'>
              <button className={btn.primary} disabled={save.isPending || form.wa_end_hour <= form.wa_start_hour}>
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
