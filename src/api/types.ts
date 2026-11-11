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
  // Formato anterior (horas), solo lectura
  wa_start_hour?: number
  wa_end_hour?: number
  wa_retry_hours?: number
  wa_auto_on_the_way: boolean   // aviso "vamos en camino" automático
  wa_auto_eta_reply: boolean    // responder "¿a qué hora llega?"
}

export type BatchEdit = Partial<Pick<Batch, 'name' | 'batch_date' | 'expected_packages' | 'notes'>>
