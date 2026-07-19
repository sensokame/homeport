import type { SatelliteIntrospection } from './types'

export async function getIntrospection(): Promise<SatelliteIntrospection[]> {
  const r = await fetch('/api/introspect')
  if (!r.ok) throw new Error(`introspect failed: ${r.status}`)
  return r.json()
}
