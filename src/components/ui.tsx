// Piezas de interfaz reutilizables y textos de estados.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { ContactStatus, LocationStatus, PackageStatus, WaAccount } from '../api/types'

export function Modal ({ title, onClose, children, wide = false }: {
  title: string, onClose: () => void, children: ReactNode, wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4' onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full overflow-auto rounded-2xl bg-white p-6 shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>{title}</h2>
          <button className='rounded-lg px-2 text-2xl leading-none text-slate-400 hover:text-slate-700' onClick={onClose} aria-label='Cerrar'>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Badge ({ children, color }: { children: ReactNode, color: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>{children}</span>
}

export const btn = {
  primary: 'rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50',
  wa: 'rounded-lg bg-wa px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50',
  ghost: 'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50',
  danger: 'rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50',
  link: 'text-sm font-medium text-brand hover:underline disabled:opacity-50',
}

export const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

export function Field ({ label, children, hint }: { label: string, children: ReactNode, hint?: string }) {
  return (
    <label className='block'>
      <span className='mb-1 block text-sm font-medium text-slate-700'>{label}</span>
      {children}
      {hint && <span className='mt-1 block text-xs text-slate-500'>{hint}</span>}
    </label>
  )
}

export function ErrorBox ({ error }: { error: unknown }) {
  if (!error) return null
  return <div className='rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700'>{error instanceof Error ? error.message : String(error)}</div>
}

export function Spinner () {
  return <div className='flex justify-center p-10'><div className='h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent' /></div>
}

// ── Estados ─────────────────────────────────────────────

export const packageStatus: Record<PackageStatus, [string, string]> = {
  pending: ['Por entregar', 'bg-amber-100 text-amber-800'],
  delivered: ['Entregado', 'bg-green-100 text-green-800'],
  failed: ['Intento fallido', 'bg-red-100 text-red-700'],
  returned: ['Devuelto', 'bg-slate-200 text-slate-700'],
}

export const contactStatus: Record<ContactStatus, [string, string]> = {
  not_contacted: ['Sin contactar', 'bg-slate-100 text-slate-600'],
  queued: ['En cola', 'bg-amber-100 text-amber-800'],
  sent: ['Enviado', 'bg-blue-100 text-blue-800'],
  responded: ['Respondió', 'bg-green-100 text-green-800'],
  failed: ['Falló', 'bg-red-100 text-red-700'],
  no_whatsapp: ['Sin WhatsApp', 'bg-red-100 text-red-700'],
}

export const locationStatus: Record<LocationStatus, [string, string]> = {
  unknown: ['Sin ubicación', 'bg-slate-100 text-slate-600'],
  requested: ['Pedida', 'bg-amber-100 text-amber-800'],
  received: ['📍 Recibida', 'bg-green-100 text-green-800'],
  historical: ['📍 Anterior', 'bg-teal-100 text-teal-800'],
}

export function accountStatus (a: WaAccount): [string, string] {
  if (!a.enabled) return ['Pausada', 'bg-slate-200 text-slate-700']
  return ({
    connected: ['Conectada', 'bg-green-100 text-green-800'],
    connecting: ['Vinculando…', 'bg-amber-100 text-amber-800'],
    disconnected: ['Desconectada', 'bg-red-100 text-red-700'],
    logged_out: ['Sesión cerrada', 'bg-red-100 text-red-700'],
    pending: ['Sin vincular', 'bg-slate-100 text-slate-600'],
  } as const)[a.status] as [string, string]
}

/** 50761234567 / 61234567 → 6123-4567 */
export function localPhone (phone: string | null) {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '').replace(/^507(?=\d{8}$)/, '')
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4)}` : phone
}

export function formatDate (iso: string, withTime = false) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return d.toLocaleString('es-PA', withTime
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
