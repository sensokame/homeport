export interface ToolAnnotations {
  title?: string | null
  readOnlyHint?: boolean | null
  destructiveHint?: boolean | null
  idempotentHint?: boolean | null
  openWorldHint?: boolean | null
}

export interface McpResource {
  uri: string
  name: string
  description?: string | null
  mimeType?: string | null
}

export interface McpTool {
  name: string
  description?: string | null
  inputSchema: Record<string, unknown>
  annotations?: ToolAnnotations | null
}

export interface SatelliteIntrospection {
  satellite_id: string
  mcp_url: string
  resources: McpResource[]
  tools: McpTool[]
  error: string | null
}
