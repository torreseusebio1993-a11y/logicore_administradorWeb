// Tipos de la API de LogiCore (backend FastAPI).

export interface User {
  id: number
  username: string
  name: string
}

export interface Batch {
  id: number
  code: string
  batch_date: string
  name: string
  zone: string | null
  notes: string | null
  expected_packages: number
  total_packages: number
  delivered_packages: number
  pending_packages: number
  progress: number
  status: 'open' | 'in_progress' | 'closed'
  loaded_at: string
  closed_at: string | null
}

export type PackageStatus = 'pending' | 'delivered' | 'failed' | 'returned'
export type ContactStatus = 'not_contacted' | 'queued' | 'sent' | 'responded' | 'failed' | 'no_whatsapp'
export type LocationStatus = 'unknown' | 'requested' | 'received' | 'historical'

export interface Package {
  id: number
  batch_id: number
  customer_id: number | null
  tracking_number: string | null
  tracking_source: 'qr' | 'text' | 'manual' | null
  customer_name: string | null
  customer_phone: string | null
  address: string | null
  provincia: string | null
  distrito: string | null
  corregimiento: string | null
  weight_kg: number | null
  declared_value: number | null
  label_template: string | null
  status: PackageStatus
  attempt_count: number
  failure_reason: string | null
  delivery_notes: string | null
  delivered_at: string | null
  contact_status: ContactStatus
  location_status: LocationStatus
  dest_latitude: number | null
  dest_longitude: number | null
  location_received_at: string | null
  geo_barriada: string | null     // dirección real según el mapa
  geo_calle: string | null
  geo_referencia: string | null
  created_at: string
  // Calculados por el backend
  sector: string | null
  out_of_route: boolean
  access_control?: boolean   // residencial con garita (solo en la ruta)
}

export type PackageEdit = Partial<Pick<Package,
  'tracking_number' | 'customer_name' | 'customer_phone' | 'address' |
  'provincia' | 'distrito' | 'corregimiento'>>

export interface WaAccount {
  id: number
  name: string
  phone: string
  status: 'pending' | 'connecting' | 'connected' | 'disconnected' | 'logged_out'
  status_detail: string | null
  enabled: boolean
  daily_limit: number
  min_interval_s: number
  sent_today: number
  clients_today: number      // clientes distintos hoy: cuenta para el límite
  send_start_min: number     // minutos desde la medianoche
  send_end_min: number
  send_start_hour: number
  send_end_hour: number
  user_id: number | null
  last_sent_at: string | null
  created_at: string
}

export interface WaMessage {
  id: number
  account_id: number | null
  package_id: number | null
  direction: 'out' | 'in'
  kind: 'text' | 'location'
  body: string | null
  latitude: number | null
  longitude: number | null
  status: string
  error: string | null
  created_at: string
  sent_at: string | null
}

export interface WaTemplate {
  key: string
  title: string
  body: string
}

export interface StatsSummary {
  total_batches: number
  open_batches: number
  total_packages: number
  total_delivered: number
  total_pending: number
  overall_progress: number
}

export interface RouteStop {
  order: number
  distance_km: number | null
  duration_min: number | null
  package: Package
}

export interface TodayRoute {
  origin: [number, number] | null
  next: Package | null
  stops: RouteStop[]
  without_location: Package[]
  total_km: number
  total_min: number | null
  distance_source: 'calles' | 'linea_recta'
  pending: number
  geometry: [number, number][] | null
  sectors: string[]          // en el orden en que se recorren
  out_of_route: number
  outlier_km: number
}

export interface CustomerSummary {
  id: number
  name: string | null
  phones: string[]
  packages: number
  delivered: number
  has_location: boolean
}

export interface CustomerLocation {
  id: number
  latitude: number
  longitude: number
  source: 'whatsapp' | 'delivery' | 'manual'
  address: string | null
  is_primary: boolean
  times_delivered: number
  captured_at: string
  last_confirmed_at: string | null
}

export interface CustomerDetail extends CustomerSummary {
  notes: string | null
  locations: CustomerLocation[]
  history: Package[]
}

// Tiempos en minutos (la pausa entre mensajes, en segundos)
export interface UserSettings {
  wa_start_min: number       // minutos desde la medianoche (8:30 a. m. = 510)
  wa_end_min: number         // 1440 = medianoche
  wa_min_interval_s: number
  wa_daily_limit: number     // clientes distintos por día
  wa_retry_min: number
  wa_max_retries: number
  wa_eta_cooldown_min: number
  route_outlier_km: number
  route_service_min: number
  driver_name: string | null    // perfil del repartidor (aviso en residenciales con garita)
  vehicle: string | null
  vehicle_plate: string | null
  access_keywords: string       // "PH, Torre, Edificio, Condominio, Garita"
  alert_phone: string | null    // alertas del monitoreo por WhatsApp
  alerts_enabled: boolean
  // Formato anterior (horas), solo lectura
  wa_start_hour?: number
  wa_end_hour?: number
  wa_retry_hours?: number
  wa_auto_on_the_way: boolean   // aviso "vamos en camino" automático
  wa_auto_eta_reply: boolean    // responder "¿a qué hora llega?"
}

export type BatchEdit = Partial<Pick<Batch, 'name' | 'batch_date' | 'expected_packages' | 'notes'>>

// ── Monitoreo ──────────────────────────────────────────

type State = 'ok' | 'warn' | 'error'
interface Check { ok: boolean, state: State, message: string, ms?: number | null }

export interface MonitorStatus {
  overall: State
  checked_at: string
  backend: Check & { requests_1h: number, errors_1h: number, p95_ms: number | null, uptime_h: number }
  database: Check & { size_mb?: number, connections?: number }
  whatsapp: Check & {
    service_online: boolean, queued: number, failed_24h: number, oldest_queued_min: number | null
    accounts: { id: number, name: string, status: string, enabled: boolean, last_sent_at: string | null,
      sent_today: number, clients_today: number }[]
  }
  ocr: Check & { scans_24h: number, success_24h: number, success_rate: number | null, avg_ms: number | null }
  osrm: Check
  nominatim: Check
  server: Check & { cpu_pct?: number | null, ram_used_mb?: number | null, ram_total_mb?: number | null,
    disk_used_gb?: number | null, disk_total_gb?: number | null }
}

export interface MonitorMetrics {
  days: number
  requests_by_hour: { hour: string, requests: number, errors: number, client_errors: number, avg_ms: number }[]
  server: { t: string, cpu_pct: number | null, ram_pct: number | null, disk_pct: number | null }[]
  ocr: {
    daily: { day: string, scans: number, success: number, avg_confidence: number | null, avg_ms: number,
      qr: number, text: number, manual: number, corrected: number }[]
    recent_failures: { ts: string, template: string | null, confidence: number | null, error: string | null, text: string }[]
  }
  whatsapp: {
    daily: { day: string, sent: number, read: number, failed: number, queued: number }[]
    by_template: { template: string, count: number }[]
    failure_reasons: { error: string | null, count: number }[]
    location_requests: number, location_answered: number, median_answer_min: number | null
  }
  routes: { pending: number, with_location: number, with_map_address: number, historical_location: number,
    route_requests: number, route_avg_ms: number, route_max_ms: number, map_service_failures: number }
  deliveries: {
    days: { day: string, deliveries: number, first: string, last: string, avg_gap_min: number | null,
      sector_jumps: number, failed: number, incidents: number }[]
    by_hour: { hour: number, deliveries: number }[]
  }
  users: { id: number, name: string, username: string, last_seen: string | null, last_client: string | null,
    app_version: string | null, requests_24h: number, errors_24h: number,
    top_actions: { path: string, count: number }[] }[]
}

export interface SystemEventItem {
  id: number, ts: string, level: 'info' | 'warning' | 'error', source: string, kind: string
  message: string, details: Record<string, unknown> | null, path: string | null
  user: string | null, app_version: string | null
}

export interface MonitorErrors {
  hours: number
  events: SystemEventItem[]
  groups: { source: string, kind: string, count: number, level: string, last: string, message: string,
    users: string[], paths: string[] }[]
  by_path: { path: string, status: number, count: number }[]
  by_user: { user: string, count: number }[]
  by_source: { source: string, count: number }[]
}

// ── Versiones de la app móvil ──────────────────────────
export interface AppRelease {
  id: number, version_name: string, version_code: number, notes: string | null
  mandatory: boolean, active: boolean, size_bytes: number, sha256: string
  downloads: number, created_at: string
}
