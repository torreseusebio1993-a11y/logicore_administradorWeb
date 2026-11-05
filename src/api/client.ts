// Cliente de la API. El panel se autentica con la sesión del usuario
// (Authorization: Bearer); NUNCA con la API key de la app móvil.
import type {
  Batch, Package, PackageEdit, StatsSummary, User, WaAccount, WaMessage, WaTemplate,
} from './types'

const BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const TOKEN_KEY = 'logicore.token'

export class ApiError extends Error {
  status: number
  constructor (status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** Se dispara cuando la sesión vence: el AuthProvider manda al login. */
export const SESSION_EXPIRED = 'logicore:session-expired'

async function request<T> (method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(BASE + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor')
  }

  if (res.status === 401 && path !== '/auth/login') {
    tokenStore.clear()
    window.dispatchEvent(new Event(SESSION_EXPIRED))
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const detail = data?.detail
    const msg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail) ? detail[0]?.msg ?? 'Datos inválidos' : `Error ${res.status}`
    throw new ApiError(res.status, msg)
  }
  return data as T
}

const get = <T>(p: string) => request<T>('GET', p)
const post = <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {})
const patch = <T>(p: string, b: unknown) => request<T>('PATCH', p, b)
const put = <T>(p: string, b: unknown) => request<T>('PUT', p, b)
const del = (p: string) => request<void>('DELETE', p)

export const api = {
  // Auth
  login: (username: string, password: string) =>
    post<{ token: string, expires_at: string, user: User }>('/auth/login', { username, password }),
  me: () => get<User>('/auth/me'),
  logout: () => post<void>('/auth/logout'),

  // Cargas y paquetes
  stats: () => get<StatsSummary>('/batches/stats/summary'),
  batches: () => get<Batch[]>('/batches/'),
  batch: (id: number) => get<Batch>(`/batches/${id}`),
  closeBatch: (id: number) => post<Batch>(`/batches/${id}/close`),
  packages: (batchId: number) => get<Package[]>(`/packages/batch/${batchId}`),
  updatePackage: (id: number, data: PackageEdit) => patch<Package>(`/packages/${id}`, data),
  deletePackage: (id: number) => del(`/packages/${id}`),
  mapPackages: (batchId?: number, includeDelivered = false) => {
    const q = new URLSearchParams()
    if (batchId) q.set('batch_id', String(batchId))
    if (includeDelivered) q.set('include_delivered', 'true')
    return get<Package[]>(`/packages/map?${q}`)
  },

  // WhatsApp
  waService: () => get<{ online: boolean, detail?: string }>('/whatsapp/service'),
  waAccounts: () => get<WaAccount[]>('/whatsapp/accounts'),
  waCreateAccount: (data: { name: string, phone: string, daily_limit: number }) =>
    post<WaAccount>('/whatsapp/accounts', data),
  waUpdateAccount: (id: number, data: Partial<Pick<WaAccount, 'name' | 'enabled' | 'daily_limit' | 'min_interval_s'>>) =>
    patch<WaAccount>(`/whatsapp/accounts/${id}`, data),
  waDeleteAccount: (id: number) => del(`/whatsapp/accounts/${id}`),
  waStartQr: (id: number) => post<{ qr: string }>(`/whatsapp/accounts/${id}/link-qr`),
  waQr: (id: number) => get<{ qr: string | null, connected: boolean }>(`/whatsapp/accounts/${id}/qr`),
  waRequestLocation: (packageId: number) => post<WaMessage>(`/whatsapp/packages/${packageId}/request-location`),
  waRequestLocationBatch: (batchId: number) =>
    post<{ queued: number, skipped: { package_id: number, tracking: string | null, reason: string }[] }>(
      `/whatsapp/batches/${batchId}/request-location`),
  waMessages: (packageId: number) => get<WaMessage[]>(`/whatsapp/packages/${packageId}/messages`),
  waQueue: () => get<Record<string, number>>('/whatsapp/queue'),
  waTemplates: () => get<WaTemplate[]>('/whatsapp/templates'),
  waUpdateTemplate: (key: string, body: string) => put<WaTemplate>(`/whatsapp/templates/${key}`, { body }),
}
