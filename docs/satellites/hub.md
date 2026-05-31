# Hub

The hub is the entry point to homeport. It reads `dashboard.json`, proxies satellite API calls, and renders a configurable tab dashboard.

---

## dashboard.json

Mount this file into the container. Edit it without rebuilding. Changes to tabs and widget instances can also be made via the settings drawer in the UI (saved back to the file automatically).

```json
{
  "version": 2,
  "satellites": [
    { "id": "infra",   "url": "http://infra.station",   "widgetUrl": "http://infra:8080" },
    { "id": "vikunja", "url": "http://vikunja.station", "widgetUrl": "http://vikunja-sat:8080" }
  ],
  "tabs": [
    {
      "id": "overview",
      "label": "Overview",
      "widgets": [
        { "instanceId": "infra-main",   "widgetId": "legacy.widget", "satelliteId": "infra",   "config": { "icon": "server" } },
        { "instanceId": "vikunja-main", "widgetId": "legacy.widget", "satelliteId": "vikunja", "config": { "icon": "check-square" } }
      ]
    }
  ]
}
```

### satellites

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique identifier, referenced by widget instances |
| `url` | yes | Public URL used for "open →" links in widget cards |
| `widgetUrl` | yes | Internal Docker URL the hub backend proxies to |

`widgetUrl` should use the internal Docker hostname (e.g. `http://infra:8080`) so traffic stays on the Docker network.

### tabs

| Field | Required | Description |
|---|---|---|
| `id` | yes | URL-safe tab identifier |
| `label` | yes | Display label in the tab bar |
| `widgets` | yes | Ordered list of widget instances |

### widget instances

| Field | Required | Description |
|---|---|---|
| `instanceId` | yes | Unique per-instance ID — allows multiple instances of the same widget |
| `widgetId` | yes | References a registered widget in the hub's widget registry |
| `satelliteId` | yes | References a satellite entry in the `satellites` array |
| `config` | yes | Passed as `config` prop to the widget component |

Multiple instances of the same `widgetId` are allowed — each with different `config` and `satelliteId`.

---

## Widget registry

The hub ships with a built-in `legacy.widget` that calls `GET /widget` on the satellite and renders the standard card layout. This covers all current first-party satellites.

As the widget system matures, additional widget IDs will be added to the registry. See [Widget System](../widgets/index.md) for the full widget architecture.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `HOSTNAME_DISPLAY` | system hostname | Label shown in the top bar |
| `DASHBOARD_PATH` | `/app/dashboard.json` | Path to the dashboard config file |

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/config` | Returns `{ hostname, version }` |
| `GET /api/dashboard` | Returns dashboard config (internal `widgetUrl` stripped) |
| `PUT /api/dashboard` | Saves updated dashboard config (merges back internal `widgetUrl` values) |
| `GET /api/proxy/{satelliteId}/{path}` | Proxies requests to the satellite's internal `widgetUrl` |

Widget components in the browser call `GET /api/proxy/{satelliteId}/widget` (or any other path). The hub backend forwards the request to the satellite's internal Docker URL.

---

## docker-compose.yml

```yaml
services:
  hub:
    image: ghcr.io/sensokame/homeport-hub:latest
    container_name: hub
    restart: unless-stopped
    volumes:
      - ./dashboard.json:/app/dashboard.json
    environment:
      - HOSTNAME_DISPLAY=station
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```
