export interface Container {
  id: string
  name: string
  status: string
  image: string
  started: string
  group: string
  url: string
}

export interface ContainerDetail extends Container {
  ports: Record<string, Array<{ HostPort: string }> | null>
  mounts: string[]
  networks: string[]
  restart_policy: string
}

export interface ContainerStats {
  cpu_percent: number
  mem_usage: number
  mem_limit: number
  net_rx: number
  net_tx: number
}

export interface SystemStats {
  cpu_percent: number
  mem_used: number
  mem_total: number
  mem_percent: number
  disk_used: number
  disk_total: number
  disk_percent: number
}

export interface Config {
  dozzle_url: string
  hostname: string
}

export interface UpdateStatus {
  running: boolean
  done: boolean
  results: Array<{ name: string; status: string; reason?: string }>
}

export interface SmartStats {
  passed: boolean | null
  temperature_c: number | null
  percentage_used: number | null
  available_spare: number | null
  media_errors: number | null
  unsafe_shutdowns: number | null
  power_on_hours: number | null
  critical_warning: number | null
}

export interface Fail2banStats {
  currently_banned: number
  total_banned: number
  banned_ips: string[]
}

export interface HealthStatusSnapshot {
  checked_at: string
  smart: SmartStats | null
  fail2ban: Fail2banStats | null
  apt: { upgradable_total: number; upgradable_security: number }
  unattended_upgrades_last_run: string | null
}

export interface IntegrityFinding { flags: string; path: string; package: string; kind: 'missing' | 'modified' }
export interface IntegritySnapshot {
  started_at: string
  finished_at: string
  clean: boolean
  findings: IntegrityFinding[]
}

export type CheckLevel = 'ok' | 'warn' | 'error'
export interface StationCheck {
  label: string
  level: CheckLevel
  detail: string
  since: string
  checked_at: string
}
export interface StationChecks {
  status: CheckLevel
  checked_at: string
  checks: Record<string, StationCheck>
}

export interface HealthResponse {
  status: HealthStatusSnapshot | null
  integrity: IntegritySnapshot | null
  checks: StationChecks | null
  stale: boolean
  scan_running: boolean
  summary_status: 'ok' | 'warn' | 'error'
}

export interface ScanStatus {
  running: boolean
  integrity: IntegritySnapshot | null
}
