export interface Container {
  id: string
  name: string
  status: string
  image: string
  started: string
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
