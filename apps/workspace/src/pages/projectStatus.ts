const VISIBLE_STATUSES = new Set(['active', 'planning', 'new', 'idea'])

export function isVisibleStatus(statusLabel: string): boolean {
  return VISIBLE_STATUSES.has(statusLabel.toLowerCase())
}

export function badgeVariant(statusLabel: string): 'ok' | 'warn' | 'default' {
  const s = statusLabel.toLowerCase()
  if (s === 'active') return 'ok'
  if (s === 'planning' || s === 'new') return 'warn'
  return 'default'
}
