import { useState } from 'react'
import { Card, StatusDot } from '@homeport/ui'
import type { WidgetManifest, WidgetProps } from '@homeport/ui'
import { resolveIcon } from '../utils/icons'
import styles from './WidgetShell.module.css'

interface WidgetShellProps {
  manifest: WidgetManifest
  instance: { config: Record<string, unknown> }
  satelliteUrl: string
  publicUrl: string
  onStatusChange?: (status: 'ok' | 'warn' | 'error') => void
  onFocusRequest?: () => void
}

export function WidgetShell({ manifest, instance, satelliteUrl, publicUrl, onStatusChange: onParentStatusChange, onFocusRequest }: WidgetShellProps) {
  const [status, setStatus] = useState<'ok' | 'warn' | 'error'>('ok')

  const handleStatusChange = (s: 'ok' | 'warn' | 'error') => {
    setStatus(s)
    onParentStatusChange?.(s)
  }

  const Widget = manifest.component
  const widgetProps: WidgetProps = {
    config: instance.config,
    satelliteUrl,
    publicUrl,
    onStatusChange: handleStatusChange,
    onFocusRequest,
  }

  if (manifest.fullScreen) {
    return <Widget {...widgetProps} />
  }

  const icon = resolveIcon(instance.config.icon as string | undefined)

  return (
    <Card status={status} className={styles.shell}>
      <div className={styles.header}>
        <StatusDot status={status} />
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.title}>{manifest.name}</span>
      </div>
      <div className={styles.content}>
        <Widget {...widgetProps} />
      </div>
      {publicUrl && (
        <div className={styles.footer}>
          <a className={styles.link} href={publicUrl} target="_blank" rel="noopener">open →</a>
        </div>
      )}
    </Card>
  )
}
