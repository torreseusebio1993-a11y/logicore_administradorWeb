// Editar paquete y ver la conversación de WhatsApp con el cliente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Package, PackageEdit } from '../api/types'
import { btn, ErrorBox, Field, formatDate, input, mapsUrl, Modal, Spinner } from './ui'

const FIELDS: [keyof PackageEdit, string, string?][] = [
  ['tracking_number', 'Tracking'],
  ['customer_name', 'Nombre del cliente'],
  ['customer_phone', 'Teléfono', '8 dígitos, ej. 6123-4567'],
  ['address', 'Dirección'],
  ['provincia', 'Provincia'],
  ['distrito', 'Distrito'],
  ['corregimiento', 'Corregimiento', 'Se ajusta solo al catálogo (mayúsculas, tildes, errores)'],
]

export function EditPackageModal ({ pkg, onClose }: { pkg: Package, onClose: () => void }) {
  const qc = useQueryClient()
  const [values, setValues] = useState<PackageEdit>(() =>
    Object.fromEntries(FIELDS.map(([k]) => [k, pkg[k] ?? ''])) as PackageEdit)

  const save = useMutation({
    mutationFn: () => {
      // Solo se envía lo que cambió
      const changes: PackageEdit = {}
      for (const [k] of FIELDS) {
        const v = (values[k] ?? '').trim()
        if (v !== (pkg[k] ?? '')) changes[k] = v || null
      }
      return api.updatePackage(pkg.id, changes)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] })
      onClose()
    },
  })

  return (
    <Modal title='Editar paquete' onClose={onClose}>
      <form className='space-y-3' onSubmit={e => { e.preventDefault(); save.mutate() }}>
        {FIELDS.map(([k, label, hint]) => (
          <Field key={k} label={label} hint={hint}>
            {k === 'address'
              ? <textarea className={input} rows={2} value={values[k] ?? ''} onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))} />
              : <input className={input} value={values[k] ?? ''} onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))} />}
          </Field>
        ))}
        <ErrorBox error={save.error} />
        <div className='flex justify-end gap-2 pt-2'>
          <button type='button' className={btn.ghost} onClick={onClose}>Cancelar</button>
          <button className={btn.primary} disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

const STATUS_TEXT: Record<string, string> = {
  queued: 'en cola', sending: 'enviando…', sent: '✓', delivered: '✓✓', read: '✓✓ leído', failed: 'falló',
}

export function ConversationModal ({ pkg, onClose }: { pkg: Package, onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['wa-messages', pkg.id],
    queryFn: () => api.waMessages(pkg.id),
    refetchInterval: 10_000,
  })
  return (
    <Modal title={`Conversación · ${pkg.customer_name ?? pkg.tracking_number}`} onClose={onClose}>
      <ErrorBox error={error} />
      {isLoading ? <Spinner /> : (
        <div className='space-y-2'>
          {data?.length === 0 && <p className='text-sm text-slate-500'>Sin mensajes todavía.</p>}
          {data?.map(m => (
            <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.direction === 'out' ? 'bg-green-100' : 'bg-slate-100'}`}>
                {m.kind === 'location' && m.latitude != null && m.longitude != null && (
                  <a className='block font-medium text-green-700 hover:underline' href={mapsUrl(m.latitude, m.longitude)} target='_blank' rel='noreferrer'>
                    📍 Ubicación compartida
                  </a>
                )}
                {m.body && <div className='whitespace-pre-wrap'>{m.body}</div>}
                {m.error && <div className='text-xs text-red-600'>{m.error}</div>}
                <div className='mt-1 text-right text-[11px] text-slate-500'>
                  {formatDate(m.created_at, true)} {m.direction === 'out' ? STATUS_TEXT[m.status] ?? '' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
