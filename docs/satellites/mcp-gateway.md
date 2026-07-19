# MCP Gateway Satellite

UI-less* discovery and aggregation point for homeport's agent access layer. No domain data of its own — see [agent-integration.md](../../../Projects/projects/homeport/agent-integration.md) in the Projects vault for the full design.

*"UI-less" refers to the design's original intent (no agent-facing chat/interaction surface) — this satellite does have one small page: a live introspection view of what every satellite currently exposes, purely for observability, not for driving an agent.

---

## Features

- Discovers every satellite that self-declares an `mcp` field via the hub's already-aggregated `GET /api/catalog` — no separate scanning logic, reuses the same contract every other consumer of that endpoint uses
- `GET /servers` — raw `[{satellite_id, mcp_url}]` list, for agent hosts that want direct connections instead of going through the aggregation below
- `/mcp` — aggregated MCP server (Streamable HTTP): merges every satellite's resources and tools live (not cached at startup), namespaces tools as `<satellite_id>.<tool_name>` to avoid collisions, and proxies `read_resource`/`call_tool` to the right upstream satellite
- **Write-tool calls proxy elicitation correctly**: if a proxied tool pauses to confirm (see `knowledge.mcp_complete_task`), the confirmation request is forwarded to whoever is actually calling the gateway, not answered by the gateway itself
- A small frontend page (`GET /`) showing every satellite's resources/tools live, via `GET /api/introspect` — the browser-facing equivalent of connecting an MCP client, without needing one

---

## Why aggregation is dynamic, not static

Every other MCP server in this repo (obsidian/inventory/infra/gcal-sat) uses the high-level `FastMCP` decorator API, since each has a small, fixed set of resources/tools known at import time. The gateway can't do that — its resource/tool list changes as satellites are added, removed, or redeployed. It uses the low-level `mcp.server.lowlevel.Server` API instead: `list_resources`/`list_tools` handlers re-scan the hub's catalog and query every satellite live on each call, so a satellite that just added a new resource shows up immediately, no gateway redeploy needed.

## Why the gateway doesn't self-declare its own `mcp` field

Every other satellite's `mcp` field means "here's my own domain state, read it." The gateway has no domain state of its own — it only proxies others'. Self-declaring would either be a no-op (nothing new to expose) or, worse, create a recursive aggregation loop if some future scanning logic weren't careful. `GET /servers` is the correct, explicit way to discover it instead.

## Known limitation: resource-owner cache

`read_resource` looks up which upstream satellite owns a given URI via an in-memory cache populated by the most recent `list_resources` call (standard MCP client behavior always calls `list_resources` before `read_resource`, so this is safe in practice). If two satellites ever declared the same URI scheme, the last one scanned would win — not handled specially, since every satellite so far picked a distinct scheme (`obsidian://`, `inventory://`, `infra://`, `gcal://`).

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `HUB_URL` | `http://hub:8080` | Where to fetch the aggregated satellite/`mcp` map from |

---

## API

| Endpoint | Description |
|---|---|
| `GET /servers` | Raw `[{satellite_id, mcp_url}]` — direct-connection list |
| `GET /api/introspect` | Per-satellite resources/tools, live — powers this satellite's own frontend page |
| `/mcp` | Aggregated MCP server (Streamable HTTP) |
| `GET /health` | Health check |

---

## docker-compose.yml

```yaml
services:
  mcp-gateway:
    image: ghcr.io/sensokame/homeport-mcp-gateway:latest
    container_name: mcp-gateway
    restart: unless-stopped
    environment:
      - HUB_URL=http://hub:8080
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

No `dashboard.json` satellite entry — it has no widgets and doesn't need the hub's federation proxy. Reachable directly (e.g. `gateway.station` via an NPM proxy host) for its own page, `/servers`, and `/mcp`.
