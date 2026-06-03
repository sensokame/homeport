import { useEffect, useState } from 'react'
import { WidgetCard } from '@homeport/ui'
import type { WidgetData, WidgetProps } from '@homeport/ui'
import { resolveIcon } from '../utils/icons'

export function LegacyWidget({ satelliteUrl, publicUrl, config, onStatusChange }: WidgetProps) {
  const [data, setData] = useState<WidgetData | null>(null)

  useEffect(() => {
    fetch(`${satelliteUrl}/widget`)
      .then(r => r.json())
      .then((d: WidgetData) => {
        setData(d)
        onStatusChange?.(d.status)
      })
      .catch(() => {
        setData({ status: 'error', title: 'Error', summary: 'unreachable', metrics: [] })
        onStatusChange?.('error')
      })
  }, [satelliteUrl])

  if (!data) return null

  return (
    <WidgetCard
      data={data}
      url={publicUrl}
      icon={resolveIcon(config.icon as string | undefined)}
    />
  )
}
