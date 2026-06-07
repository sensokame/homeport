import type { ComponentType, LazyExoticComponent } from 'react'

export interface WidgetProps {
  config: Record<string, unknown>
  satelliteUrl: string  // proxy base URL for API calls (e.g. /api/proxy/vikunja)
  publicUrl: string     // public URL for "open →" links
  /** Called by the widget when its status is determined; shell uses this to colour the card border. */
  onStatusChange?: (status: 'ok' | 'warn' | 'error') => void
  /** Called by the widget to request entering focus mode (hub takes over full-screen layout). */
  onFocusRequest?: () => void
  /** True when the hub has entered focus mode for this widget; widget should render its focused view. */
  isFocused?: boolean
}

export type WidgetComponent = ComponentType<WidgetProps>

export interface CatalogWidget {
  id: string
  name: string
  description: string
  configSchema: Record<string, ConfigField>
}

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
  component: WidgetComponent | LazyExoticComponent<WidgetComponent>
  /**
   * When true, the hub renders the widget without its default shell (no status/icon
   * header, no "open →" footer). The widget is responsible for its own chrome.
   * Defaults to false — most widgets should leave this unset.
   */
  fullScreen?: boolean
  /** Icon name from the hub ICON_MAP to show in the shell header when config.icon is not set. */
  defaultIcon?: string
}
