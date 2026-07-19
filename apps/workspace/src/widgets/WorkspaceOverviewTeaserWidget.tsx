import { useEffect } from 'react'
import { LinkCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'

export function WorkspaceOverviewTeaserWidget({ onStatusChange }: WidgetProps) {
  useEffect(() => { onStatusChange?.('ok') }, [onStatusChange])

  return (
    <LinkCard
      name="Workspace Overview"
      url="http://workspace.station"
      description="Everything currently Active, Planning, New, or Idea — one screen, grouped by category."
    />
  )
}
