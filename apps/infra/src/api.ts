import type { Container, ContainerDetail, ContainerStats, SystemStats, Config, UpdateStatus } from './types'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, opts)
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

export const getConfig      = () => req<Config>('/config')
export const getContainers  = () => req<Container[]>('/containers')
export const getContainer   = (name: string) => req<ContainerDetail>(`/containers/${encodeURIComponent(name)}`)
export const getStats       = (name: string) => req<ContainerStats>(`/containers/${encodeURIComponent(name)}/stats`)
export const getAllStats     = () => req<Record<string, ContainerStats>>('/stats')
export const groupAction    = (group: string, action: string) =>
  req<{ ok: boolean; count: number }>(`/groups/${encodeURIComponent(group)}/${action}`, { method: 'POST' })
export const containerAction  = (name: string, action: string) =>
  req<{ ok: boolean }>(`/containers/${encodeURIComponent(name)}/${action}`, { method: 'POST' })
export const redeployContainer = (name: string) =>
  req<{ ok: boolean }>(`/containers/${encodeURIComponent(name)}/redeploy`, { method: 'POST' })
export const getSystem      = () => req<SystemStats>('/system')
export const restartAll     = () => req<{ ok: boolean; count: number }>('/actions/restart-all', { method: 'POST' })
export const updateAll      = () => req<{ ok: boolean; reason?: string }>('/actions/update-all', { method: 'POST' })
export const getUpdateStatus = () => req<UpdateStatus>('/actions/update-status')

export function formatBytes(b: number): string {
  if (!b) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1)
  return (b / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

export function formatUptime(iso: string): string {
  if (!iso || iso.startsWith('0001')) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
