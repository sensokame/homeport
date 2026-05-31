import type { ComponentType } from 'react'

export interface WidgetProps {
  config: Record<string, unknown>
  satelliteUrl: string  // proxy base URL for API calls (e.g. /api/proxy/vikunja)
  publicUrl: string     // public URL for "open →" links
  /** Called by the widget when its status is determined; shell uses this to colour the card border. */
  onStatusChange?: (status: 'ok' | 'warn' | 'error') => void
}

export type WidgetComponent = ComponentType<WidgetProps>

export interface ConfigField {
  type: 'string' | 'number' | 'boolean'
  label: string
  required?: boolean
  default?: unknown
}

export interface WidgetManifest {
  id: string
  name: string
  description: string
  configSchema: Record<string, ConfigField>
  component: WidgetComponent
  /**
   * When true, the hub renders the widget without its default shell (no status/icon
   * header, no "open →" footer). The widget is responsible for its own chrome.
   * Defaults to false — most widgets should leave this unset.
   */
  fullScreen?: boolean
}
