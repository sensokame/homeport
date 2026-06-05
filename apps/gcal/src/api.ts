import type { TodayEventsResponse } from './types'

export async function fetchStatus(): Promise<{ configured: boolean }> {
  return fetch('/api/status').then(r => r.json())
}

export async function fetchTodayEvents(): Promise<TodayEventsResponse> {
  const r = await fetch('/api/events/today')
  if (!r.ok) throw new Error('unavailable')
  return r.json()
}

export async function recordTrade(event_id: string, event_title: string): Promise<void> {
  await fetch('/api/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id, event_title }),
  })
}
