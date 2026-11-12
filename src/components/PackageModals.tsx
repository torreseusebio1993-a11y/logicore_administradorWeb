// Editar paquete y ver la conversación de WhatsApp con el cliente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, fileUrl } from '../api/client'
import type { Batch, Package, PackageEdit, WaMessage } from '../api/types'
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

/** Corregir la carga: nombre, fecha, cantidad o nota. La cantidad no puede
 * quedar por debajo de los paquetes ya registrados. */
export function EditBatchModal ({ batch, onClose }: { batch: Batch, onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(batch.name)
  const [date, setDate] = useState(batch.batch_date)
  const [qty, setQty] = useState(batch.expected_packages)
  const [notes, setNotes] = useState(batch.notes ?? '')
  const tooLow = qty < batch.total_packages

  const save = useMutation({
    mutationFn: () => api.updateBatch(batch.id, {
      name: name.trim(), batch_date: date, expected_packages: qty, notes: notes.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batch', batch.id] })
      qc.invalidateQueries({ queryKey: ['batches'] })
      onClose()
    },
  })

  return (
    <Modal title='Editar carga' onClose={onClose}>
      <form className='space-y-3' onSubmit={e => { e.preventDefault(); if (!tooLow) save.mutate() }}>
        <Field label='Nombre de la ruta'>
          <input className={input} value={name} minLength={3} required onChange={e => setName(e.target.value)} />
        </Field>
        <Field label='Fecha'>
          <input className={input} type='date' value={date} required onChange={e => setDate(e.target.value)} />
        </Field>
        <Field
          label='Cantidad de paquetes'
          hint={`Registrados: ${batch.total_packages}. Súbela si falta un paquete; para bajarla de ${batch.total_packages} borra primero los que sobran.`}
        >
          <input className={input} type='number' min={Math.max(1, batch.total_packages)} max={5000} value={qty} required
            onChange={e => setQty(Number(e.target.value))} />
        </Field>
        {tooLow && <p className='text-sm text-red-600'>No puede ser menor que los {batch.total_packages} paquetes registrados.</p>}
        <Field label='Observación (opcional)'>
          <textarea className={input} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
        <ErrorBox error={save.error} />
        <div className='flex justify-end gap-2 pt-2'>
          <button type='button' className={btn.ghost} onClick={onClose}>Cancelar</button>
          <button className={btn.primary} disabled={save.isPending || tooLow}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

const STATUS_TEXT: Record<string, string> = {
  queued: 'en cola', sending: 'enviando…', sent: '✓', delivered: '✓✓', read: '✓✓ leído', failed: 'falló',
}

const MEDIA_LABEL: Record<string, string> = {
  image: '📷 Foto', audio: '🎤 Nota de voz', video: '🎬 Video', document: '📄 Documento',
}

/** Foto, nota de voz, video o documento dentro del chat. */
function MediaView ({ m }: { m: WaMessage }) {
  const label = MEDIA_LABEL[m.kind] ?? 'Archivo'
  if (!m.media_url) {
    return <div className='italic text-slate-500'>{label} {m.media_expired ? '(ya no está: se guardan 30 días)' : '(no se pudo descargar)'}</div>
  }
  const url = fileUrl(m.media_url)
  if (m.kind === 'image') {
    return (
      <a href={url} target='_blank' rel='noreferrer'>
        <img src={url} alt='Foto del cliente' className='mb-1 max-h-64 rounded-lg' loading='lazy' />
      </a>
    )
  }
  if (m.kind === 'audio') return <audio controls preload='none' src={url} className='mb-1 w-64' />
  if (m.kind === 'video') return <video controls preload='none' src={url} className='mb-1 max-h-64 rounded-lg' />
  return <a href={url} target='_blank' rel='noreferrer' className='font-medium text-green-700 hover:underline'>{label}: abrir</a>
}

/** 507XXXXXXXX si es un celular de Panamá (como el backend). */
function waPhone (raw: string | null | undefined): string | null {
  let d = (raw ?? '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('507')) d = d.slice(3)
  return d.length === 8 && d.startsWith('6') ? '507' + d : null
}

export function ConversationModal ({ pkg, onClose }: { pkg: Package, onClose: () => void }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['wa-messages', pkg.id],
    queryFn: () => api.waMessages(pkg.id),
    refetchInterval: 5_000,
  })
  const send = useMutation({
    mutationFn: () => api.waSend(pkg.id, text.trim()),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['wa-messages', pkg.id] }) },
  })
  const phone = waPhone(pkg.customer_phone)
  return (
    <Modal title={`Chat · ${pkg.customer_name ?? pkg.tracking_number}`} onClose={onClose}>
      {phone && (
        <a className='mb-2 inline-block text-sm text-green-700 hover:underline' href={`https://wa.me/${phone}`}
          target='_blank' rel='noreferrer'>↗ Abrir en WhatsApp (para llamar)</a>
      )}
      <ErrorBox error={error || send.error} />
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
                {m.kind !== 'text' && m.kind !== 'location' && <MediaView m={m} />}
                {m.body && <div className='whitespace-pre-wrap'>{m.body}</div>}
                {m.error && <div className='text-xs text-red-600'>{m.error}</div>}
                <div className='mt-1 text-right text-[11px] text-slate-500'>
                  {formatDate(m.created_at, true)} {m.direction === 'out' ? STATUS_TEXT[m.status] ?? '' : ''}
                  {m.template_key === 'phone' && ' · desde el celular'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {phone && (
        <form className='mt-3 flex gap-2' onSubmit={e => { e.preventDefault(); if (text.trim()) send.mutate() }}>
          <textarea className={`${input} min-h-[42px] flex-1`} rows={2} maxLength={2000} value={text}
            placeholder='Escribe un mensaje (sale por la cuenta de WhatsApp de este cliente)'
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) send.mutate() } }} />
          <button className={btn.primary} disabled={send.isPending || !text.trim()}>
            {send.isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      )}
    </Modal>
  )
}
