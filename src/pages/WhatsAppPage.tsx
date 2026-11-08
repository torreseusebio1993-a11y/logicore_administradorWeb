import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { WaAccount } from '../api/types'
import { PageHeader } from '../components/Layout'
import { accountStatus, Badge, btn, ErrorBox, Field, input, localPhone, Modal, Spinner } from '../components/ui'

// ── Vincular por QR ─────────────────────────────────────

function QrModal ({ account, onClose }: { account: WaAccount, onClose: () => void }) {
  const qc = useQueryClient()
  const [image, setImage] = useState<string | null>(null)
  const start = useMutation({ mutationFn: () => api.waStartQr(account.id) })

  // Iniciar la vinculación al abrir
  useEffect(() => { start.mutate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // WhatsApp renueva el QR cada ~20 s: consultar cada 2 s
  const live = useQuery({
    queryKey: ['wa-qr', account.id],
    queryFn: () => api.waQr(account.id),
    enabled: start.isSuccess,
    refetchInterval: q => (q.state.data?.connected ? false : 2000),
  })

  const qr = live.data?.qr ?? start.data?.qr ?? null
  const connected = live.data?.connected ?? false

  useEffect(() => {
    if (qr) QRCode.toDataURL(qr, { width: 280, margin: 1 }).then(setImage)
  }, [qr])

  useEffect(() => {
    if (connected) qc.invalidateQueries({ queryKey: ['wa-accounts'] })
  }, [connected, qc])

  return (
    <Modal title={`Vincular ${account.name} (${localPhone(account.phone)})`} onClose={onClose}>
      <ErrorBox error={start.error} />
      {connected ? (
        <div className='space-y-4 py-6 text-center'>
          <div className='text-5xl'>✅</div>
          <div className='font-semibold'>¡Cuenta conectada!</div>
          <button className={btn.primary} onClick={onClose}>Listo</button>
        </div>
      ) : !image ? (
        start.isError ? null : <><Spinner /><p className='text-center text-sm text-slate-500'>Pidiendo el QR a WhatsApp…</p></>
      ) : (
        <div className='flex flex-col items-center gap-4 sm:flex-row sm:items-start'>
          <img src={image} alt='Código QR de WhatsApp' className='h-[280px] w-[280px] rounded-lg border' />
          <ol className='list-decimal space-y-2 pl-5 text-sm'>
            <li>En el teléfono del <b>{localPhone(account.phone)}</b>, abre WhatsApp.</li>
            <li>Toca <b>⋮ → Dispositivos vinculados</b>.</li>
            <li>Toca <b>Vincular un dispositivo</b>.</li>
            <li>Escanea este código.</li>
            <li className='list-none pt-2 text-xs text-slate-500'>El código se renueva solo cada ~20 segundos.</li>
          </ol>
        </div>
      )}
    </Modal>
  )
}

// ── Crear / editar cuenta ───────────────────────────────

function AccountModal ({ account, onClose, onCreated }: {
  account?: WaAccount, onClose: () => void, onCreated: (a: WaAccount) => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(account?.name ?? '')
  const [phone, setPhone] = useState(account ? localPhone(account.phone) : '')

  const save = useMutation({
    mutationFn: () => account
      ? api.waUpdateAccount(account.id, { name })
      : api.waCreateAccount({ name, phone, daily_limit: 30 }),
    onSuccess: a => {
      qc.invalidateQueries({ queryKey: ['wa-accounts'] })
      onClose()
      if (!account) onCreated(a)
    },
  })

  return (
    <Modal title={account ? 'Editar cuenta' : 'Nueva cuenta de WhatsApp'} onClose={onClose}>
      <form className='space-y-3' onSubmit={e => { e.preventDefault(); save.mutate() }}>
        <Field label='Nombre'><input className={input} value={name} onChange={e => setName(e.target.value)} placeholder='Ej: Reparto 1' required minLength={2} /></Field>
        <Field label='Celular' hint={account ? 'El número no se puede cambiar' : 'Celular de Panamá, ej. 6123-4567'}>
          <input className={input} value={phone} onChange={e => setPhone(e.target.value)} disabled={!!account} required />
        </Field>
        <p className='text-xs text-slate-500'>
          El horario, la pausa y el límite diario se configuran en <b>Ajustes</b> y aplican a todas tus cuentas.
        </p>
        <ErrorBox error={save.error} />
        <div className='flex justify-end gap-2 pt-2'>
          <button type='button' className={btn.ghost} onClick={onClose}>Cancelar</button>
          <button className={btn.wa} disabled={save.isPending}>{account ? 'Guardar' : 'Crear y vincular'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Mensaje (plantilla) ─────────────────────────────────

function TemplateModal ({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const templates = useQuery({ queryKey: ['wa-templates'], queryFn: api.waTemplates })
  const [key, setKey] = useState('request_location')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const tpl = templates.data?.find(t => t.key === key)
  const save = useMutation({
    mutationFn: () => Promise.all(
      Object.entries(edits).map(([k, body]) => api.waUpdateTemplate(k, body))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-templates'] })
      onClose()
    },
  })
  const text = edits[key] ?? tpl?.body ?? ''
  const preview = text
    .replaceAll('{nombre}', 'Leticia Oses')
    .replaceAll('{tracking}', 'PRSPTY07262635987')
    .replaceAll('{tracking_corto}', '35987')

  return (
    <Modal title='Mensajes de WhatsApp' onClose={onClose} wide>
      {!templates.data ? <Spinner /> : (
        <div className='space-y-4'>
          <div className='flex gap-2'>
            {templates.data.map(t => (
              <button
                key={t.key}
                onClick={() => setKey(t.key)}
                className={`rounded-full border px-3 py-1 text-sm ${key === t.key ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-slate-300'}`}
              >
                {t.title}{edits[t.key] !== undefined ? ' •' : ''}
              </button>
            ))}
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <textarea className={input} rows={8} value={text} onChange={e => setEdits(v => ({ ...v, [key]: e.target.value }))} />
              <p className='text-xs text-slate-500'>Variables: <code>{'{nombre}'}</code> <code>{'{tracking}'}</code> <code>{'{tracking_corto}'}</code></p>
            </div>
            <div>
              <div className='mb-1 text-xs font-semibold uppercase text-slate-500'>Vista previa</div>
              <div className='whitespace-pre-wrap rounded-xl bg-green-100 p-3 text-sm'>{preview}</div>
            </div>
          </div>
          <ErrorBox error={save.error} />
          <div className='flex justify-end gap-2'>
            <button className={btn.ghost} onClick={onClose}>Cancelar</button>
            <button
              className={btn.primary}
              disabled={save.isPending || Object.keys(edits).length === 0 || Object.values(edits).some(b => b.trim().length < 10)}
              onClick={() => save.mutate()}
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Página ──────────────────────────────────────────────


/** 510 → "8:30" (horario de envío) */
const clock = (m: number) => m >= 1440 ? '24:00' : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`

export default function WhatsAppPage () {
  const qc = useQueryClient()
  const accounts = useQuery({ queryKey: ['wa-accounts'], queryFn: api.waAccounts, refetchInterval: 5000 })
  const service = useQuery({ queryKey: ['wa-service'], queryFn: api.waService, refetchInterval: 15_000 })
  const queue = useQuery({ queryKey: ['wa-queue'], queryFn: api.waQueue, refetchInterval: 10_000 })

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<WaAccount | null>(null)
  const [linking, setLinking] = useState<WaAccount | null>(null)
  const [template, setTemplate] = useState(false)

  const toggle = useMutation({
    mutationFn: (a: WaAccount) => api.waUpdateAccount(a.id, { enabled: !a.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-accounts'] }),
  })
  const remove = useMutation({
    mutationFn: (a: WaAccount) => api.waDeleteAccount(a.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-accounts'] }),
  })

  return (
    <>
      <PageHeader
        title='WhatsApp'
        subtitle='Cuentas con las que se escribe a los clientes (puedes tener las que quieras)'
        actions={<>
          <button className={btn.ghost} onClick={() => setTemplate(true)}>✏️ Editar mensajes</button>
          <button className={btn.wa} onClick={() => setCreating(true)}>+ Agregar cuenta</button>
        </>}
      />
      <div className='space-y-4 p-8'>
        {service.data && !service.data.online && (
          <div className='rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700'>
            El servicio de WhatsApp no está corriendo. Los mensajes quedan en cola hasta que se inicie.
          </div>
        )}
        <div className='flex gap-6 text-sm'>
          <span>En cola: <b>{queue.data?.queued ?? 0}</b></span>
          <span>Enviados: <b>{(queue.data?.sent ?? 0) + (queue.data?.delivered ?? 0) + (queue.data?.read ?? 0)}</b></span>
          <span>Leídos: <b>{queue.data?.read ?? 0}</b></span>
          <span>Fallidos: <b className='text-red-600'>{queue.data?.failed ?? 0}</b></span>
        </div>
        <ErrorBox error={accounts.error || toggle.error || remove.error} />

        {accounts.isLoading ? <Spinner /> : (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {(accounts.data ?? []).map(a => {
              const [label, color] = accountStatus(a)
              const usage = Math.min(a.clients_today / a.daily_limit, 1)   // límite = clientes distintos
              const needsLink = a.enabled && ['pending', 'logged_out', 'disconnected'].includes(a.status)
              return (
                <div key={a.id} className='space-y-3 rounded-2xl border border-slate-200 bg-white p-5'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <div className='font-semibold'>{a.name}</div>
                      <div className='text-sm text-slate-500'>{localPhone(a.phone)}</div>
                    </div>
                    <Badge color={color}>{label}</Badge>
                  </div>
                  {a.status_detail && <div className='text-xs text-slate-600'>{a.status_detail}</div>}
                  <div>
                    <div className='h-2 rounded bg-slate-100'>
                      <div className={`h-2 rounded ${usage >= 1 ? 'bg-red-500' : 'bg-wa'}`} style={{ width: `${usage * 100}%` }} />
                    </div>
                    <div className='mt-1 text-xs text-slate-500'>
                      {a.clients_today}/{a.daily_limit} clientes hoy ({a.sent_today} mensajes) · pausa {a.min_interval_s}s · {clock(a.send_start_min)}–{clock(a.send_end_min)}
                    </div>
                  </div>
                  <div className='flex flex-wrap gap-3 border-t border-slate-100 pt-3'>
                    {needsLink && <button className={btn.wa} onClick={() => setLinking(a)}>Vincular con QR</button>}
                    <button className={btn.link} onClick={() => setEditing(a)}>Editar</button>
                    <button className={btn.link} onClick={() => toggle.mutate(a)}>{a.enabled ? 'Pausar' : 'Reanudar'}</button>
                    <button
                      className='text-sm font-medium text-red-600 hover:underline'
                      onClick={() => confirm(`¿Eliminar "${a.name}"? Se desvincula de WhatsApp; sus clientes pasan a otra cuenta.`) && remove.mutate(a)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {accounts.data?.length === 0 && (
          <p className='rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500'>
            Todavía no hay cuentas. Agrega los números de WhatsApp con los que se escribirá a los clientes.
          </p>
        )}
        <p className='text-xs text-slate-500'>
          ⚠️ Usa números dedicados al reparto, no personales. WhatsApp puede restringir cuentas que escriben a
          muchos números nuevos: cada cuenta tiene un límite diario y pausas entre mensajes, y el servicio deja de
          usarla si WhatsApp avisa una restricción.
        </p>
      </div>

      {creating && <AccountModal onClose={() => setCreating(false)} onCreated={a => setLinking(a)} />}
      {editing && <AccountModal account={editing} onClose={() => setEditing(null)} onCreated={() => {}} />}
      {linking && <QrModal account={linking} onClose={() => setLinking(null)} />}
      {template && <TemplateModal onClose={() => setTemplate(false)} />}
    </>
  )
}
