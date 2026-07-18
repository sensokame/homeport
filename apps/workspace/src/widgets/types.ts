export interface WorkspaceSlot {
  satelliteId: string
  widgetId: string
  config?: Record<string, unknown>
}

// GET /api/catalog (hub's own aggregated endpoint, not proxied — same-origin)
export interface HubCatalog {
  builtins: unknown[]
  satellites: Record<string, unknown[]>
  projectProviders?: Record<string, string> // satelliteId -> projectWidget id
  projectOrder?: Record<string, number>     // satelliteId -> display order (lower first)
}
