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
export type LocationStatus = 'unknown' | 'requested' | 'received'

export interface Package {
  id: number
  batch_id: number
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
  created_at: string
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
