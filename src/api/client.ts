// Cliente de la API. El panel se autentica con la sesión del usuario
// (Authorization: Bearer); NUNCA con la API key de la app móvil.
import type {
  AppRelease, Batch, BatchEdit, CustomerDetail, ManagedUser, UserActivity, MonitorErrors, MonitorMetrics, MonitorStatus, CustomerSummary, Package, PackageEdit, StatsSummary, TodayRoute, User, UserSettings,
  WaAccount, WaMessage, WaTemplate,
  RouteFeedbackItem,
  CustomerAuditItem,
} from './types'

const BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
/** URL completa de un archivo del backend (fotos y audios de WhatsApp). */
export const fileUrl = (path: string) => BASE + path
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
  // X-Client: el monitoreo distingue el panel de la app móvil
  const headers: Record<string, string> = { 'X-Client': 'panel' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(BASE + path, {
      method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
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
  let data: any
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    // No vino de la API: Cloudflare o el servidor respondieron con una página
    throw new ApiError(res.status, friendlyHttpError(res.status))
  }
  if (!res.ok) {
    const detail = data?.detail
    const msg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail) ? detail[0]?.msg ?? 'Datos inválidos' : `Error ${res.status}`
    throw new ApiError(res.status, msg)
  }
  return data as T
}

/** Mensaje entendible cuando no responde la API sino Cloudflare o el proxy. */
function friendlyHttpError (status: number): string {
  if (status === 524 || status === 504) return 'El servidor tardó demasiado en responder. Inténtalo de nuevo.'
  if (status === 413) return 'El archivo es demasiado grande para enviarlo de una vez.'
  if (status === 502 || status === 503 || status === 521 || status === 522 || status === 523 || status === 530) {
    return 'El servidor no está disponible en este momento. Revisa que esté encendido e inténtalo de nuevo.'
  }
  if (status >= 500) return `El servidor tuvo un problema (error ${status}). Inténtalo de nuevo.`
  return `Respuesta inesperada del servidor (error ${status}).`
}

/** Sube un archivo grande en partes de 4 MB (Cloudflare corta peticiones de
 * más de 100 s): cada parte es corta y, si falla, se reintenta solo esa. */
async function uploadInChunks<T> (file: File, finishBody: unknown,
  onProgress?: (fraction: number) => void): Promise<T> {
  const start = await request<{ upload_id: string, chunk_size: number }>(
    'POST', '/app/uploads', { file_name: file.name, size: file.size })
  const { upload_id: id, chunk_size: size } = start
  for (let offset = 0; offset < file.size; offset += size) {
    const part = file.slice(offset, offset + size)
    for (let attempt = 1; ; attempt++) {
      try {
        await sendChunk(id, offset, part)
        break
      } catch (e) {
        if (attempt >= 4) throw e
        await new Promise(r => setTimeout(r, 1500 * attempt))
      }
    }
    onProgress?.(Math.min((offset + size) / file.size, 1))
  }
  return request<T>('POST', `/app/uploads/${id}/finish`, finishBody)
}

async function sendChunk (id: string, offset: number, part: Blob): Promise<void> {
  const headers: Record<string, string> = { 'X-Client': 'panel', 'Content-Type': 'application/octet-stream' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`${BASE}/app/uploads/${id}?offset=${offset}`, { method: 'PUT', headers, body: part })
  } catch {
    throw new ApiError(0, 'Se cortó la conexión durante la subida')
  }
  if (!res.ok) {
    let msg = friendlyHttpError(res.status)
    try { msg = (await res.json()).detail ?? msg } catch { /* página de error */ }
    throw new ApiError(res.status, msg)
  }
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
  mySettings: () => get<UserSettings>('/auth/me/settings'),
  saveMySettings: (s: Partial<UserSettings>) => put<UserSettings>('/auth/me/settings', s),

  // Cargas y paquetes
  stats: () => get<StatsSummary>('/batches/stats/summary'),
  batches: (userId?: number) => get<Batch[]>(`/batches/${userId ? `?user_id=${userId}` : ''}`),
  batch: (id: number) => get<Batch>(`/batches/${id}`),
  closeBatch: (id: number) => post<Batch>(`/batches/${id}/close`),
  updateBatch: (id: number, data: BatchEdit) => patch<Batch>(`/batches/${id}`, data),
  onTheWay: (packageId: number) =>
    post<{ queued: boolean, tiempo?: string, reason?: string }>(`/packages/${packageId}/on-the-way`, {}),
  endOfDay: (batchId?: number) =>
    post<{ marked: number, skipped: number }>('/packages/incident/end-of-day',
      batchId ? { batch_id: batchId } : {}),
  packages: (batchId: number) => get<Package[]>(`/packages/batch/${batchId}`),
  updatePackage: (id: number, data: PackageEdit) => patch<Package>(`/packages/${id}`, data),
  deletePackage: (id: number) => del(`/packages/${id}`),
  mapPackages: (batchId?: number, includeDelivered = false) => {
    const q = new URLSearchParams()
    if (batchId) q.set('batch_id', String(batchId))
    if (includeDelivered) q.set('include_delivered', 'true')
    return get<Package[]>(`/packages/map?${q}`)
  },

  // Clientes
  customers: (search = '') => get<CustomerSummary[]>(`/customers/${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  customer: (id: number) => get<CustomerDetail>(`/customers/${id}`),
  customerAudit: (id: number) => get<CustomerAuditItem[]>(`/customers/${id}/audit`),
  customersAuditRecent: (days = 7, action?: string) =>
    get<CustomerAuditItem[]>(`/customers/audit/recent?days=${days}${action ? `&action=${action}` : ''}`),
  updateCustomer: (id: number, data: { name?: string | null, notes?: string | null }) =>
    patch<CustomerDetail>(`/customers/${id}`, data),
  addCustomerPhone: (id: number, phone: string) => post<CustomerDetail>(`/customers/${id}/phones`, { phone }),
  setPrimaryLocation: (id: number, locId: number) =>
    post<CustomerDetail>(`/customers/${id}/locations/${locId}/primary`),
  deleteLocation: (id: number, locId: number) => del(`/customers/${id}/locations/${locId}`),

  // Ruta del día (por calles con OSRM; si no, en línea recta)
  todayRoute: (opts: { lat?: number, lng?: number, batchId?: number, driverId?: number }) => {
    const q = new URLSearchParams({ with_geometry: 'true' })
    if (opts.driverId) q.set('driver_id', String(opts.driverId))
    if (opts.lat != null && opts.lng != null) { q.set('lat', String(opts.lat)); q.set('lng', String(opts.lng)) }
    if (opts.batchId) q.set('batch_id', String(opts.batchId))
    return get<TodayRoute>(`/routes/today?${q}`)
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
  noticePreview: (key: string, batchId: number) =>
    get<{ clients: number, packages: number, skipped: { reason: string, count: number }[], template: string }>(
      `/whatsapp/notices/${key}/preview?batch_id=${batchId}`),
  sendNotice: (key: string, batchId: number) =>
    post<{ queued: number }>(`/whatsapp/notices/${key}?batch_id=${batchId}`),
  cancelQueue: (batchId: number) => post<{ cancelled: number }>(`/whatsapp/queue/cancel?batch_id=${batchId}`),
  waMessages: (packageId: number) => get<WaMessage[]>(`/whatsapp/packages/${packageId}/messages`),
  waSend: (packageId: number, body: string) =>
    post<WaMessage>(`/whatsapp/packages/${packageId}/messages`, { body }),
  accessNotice: (packageId: number) => post<{ queued: boolean }>(`/packages/${packageId}/access-notice`),
  setAccessControl: (packageId: number, value: boolean | null) =>
    request<{ access_control: boolean }>('PUT', `/packages/${packageId}/access-control`, { value }),
  waQueue: () => get<Record<string, number>>('/whatsapp/queue'),
  waTemplates: () => get<WaTemplate[]>('/whatsapp/templates'),
  waUpdateTemplate: (key: string, body: string) => put<WaTemplate>(`/whatsapp/templates/${key}`, { body }),
  waResetTemplate: (key: string) => request<WaTemplate>('DELETE', `/whatsapp/templates/${key}`),

  // Usuarios (solo administrador)
  users: () => get<ManagedUser[]>('/users'),
  createUser: (data: { username: string, name: string, password: string, role: 'admin' | 'driver' }) =>
    post<ManagedUser>('/users', data),
  updateUser: (id: number, data: { name?: string, role?: 'admin' | 'driver', is_active?: boolean }) =>
    patch<ManagedUser>(`/users/${id}`, data),
  setUserPassword: (id: number, password: string) => post<void>(`/users/${id}/password`, { password }),
  userActivity: (id: number, days = 7) => get<UserActivity>(`/users/${id}/activity?days=${days}`),

  // Versiones de la app móvil
  appReleases: () => get<AppRelease[]>('/app/releases'),
  uploadAppRelease: (file: File, data: { version_name: string, version_code: number, notes: string, mandatory: boolean },
    onProgress?: (fraction: number) => void) =>
    uploadInChunks<AppRelease>(file, data, onProgress),
  updateAppRelease: (id: number, data: { mandatory?: boolean, active?: boolean, notes?: string }) =>
    patch<AppRelease>(`/app/releases/${id}`, data),
  deleteAppRelease: (id: number) => del(`/app/releases/${id}`),

  // Monitoreo
  monitorStatus: () => get<MonitorStatus>('/monitor/status'),
  routeFeedback: (days: number) => get<RouteFeedbackItem[]>(`/monitor/route-feedback?days=${days}`),
  monitorMetrics: (days: number) => get<MonitorMetrics>(`/monitor/metrics?days=${days}`),
  monitorErrors: (hours: number, source?: string) =>
    get<MonitorErrors>(`/monitor/errors?hours=${hours}${source ? `&source=${source}` : ''}`),
  monitorCheckAlerts: () =>
    post<{ problems: Record<string, string>, notified: number, lines: string[] }>('/monitor/check-alerts'),
}
