// Cliente de la API. El panel se autentica con la sesión del usuario
// (Authorization: Bearer); NUNCA con la API key de la app móvil.
import type {
  AppRelease, Batch, BatchEdit, CustomerDetail, ManagedUser, UserActivity, MonitorErrors, MonitorMetrics, MonitorStatus, CustomerSummary, Package, PackageEdit, StatsSummary, TodayRoute, User, UserSettings,
  WaAccount, WaMessage, WaTemplate,
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
const upload = <T>(p: string, form: FormData) => request<T>('POST', p, form)
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
  waMessages: (packageId: number) => get<WaMessage[]>(`/whatsapp/packages/${packageId}/messages`),
  waSend: (packageId: number, body: string) =>
    post<WaMessage>(`/whatsapp/packages/${packageId}/messages`, { body }),
  accessNotice: (packageId: number) => post<{ queued: boolean }>(`/packages/${packageId}/access-notice`),
  setAccessControl: (packageId: number, value: boolean | null) =>
    request<{ access_control: boolean }>('PUT', `/packages/${packageId}/access-control`, { value }),
  waQueue: () => get<Record<string, number>>('/whatsapp/queue'),
  waTemplates: () => get<WaTemplate[]>('/whatsapp/templates'),
  waUpdateTemplate: (key: string, body: string) => put<WaTemplate>(`/whatsapp/templates/${key}`, { body }),

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
  uploadAppRelease: (file: File, data: { version_name: string, version_code: number, notes: string, mandatory: boolean }) => {
    const form = new FormData()
    form.append('file', file)
    form.append('version_name', data.version_name)
    form.append('version_code', String(data.version_code))
    form.append('notes', data.notes)
    form.append('mandatory', String(data.mandatory))
    return upload<AppRelease>('/app/releases', form)
  },
  updateAppRelease: (id: number, data: { mandatory?: boolean, active?: boolean, notes?: string }) =>
    patch<AppRelease>(`/app/releases/${id}`, data),
  deleteAppRelease: (id: number) => del(`/app/releases/${id}`),

  // Monitoreo
  monitorStatus: () => get<MonitorStatus>('/monitor/status'),
  monitorMetrics: (days: number) => get<MonitorMetrics>(`/monitor/metrics?days=${days}`),
  monitorErrors: (hours: number, source?: string) =>
    get<MonitorErrors>(`/monitor/errors?hours=${hours}${source ? `&source=${source}` : ''}`),
  monitorCheckAlerts: () =>
    post<{ problems: Record<string, string>, notified: number, lines: string[] }>('/monitor/check-alerts'),
}
