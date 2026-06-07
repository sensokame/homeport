# Hub

The hub is the entry point to homeport. It reads `dashboard.json`, proxies satellite API calls, loads widget components via module federation, and renders a configurable tab dashboard.

---

## dashboard.json

Mount this file into the container. Edit it without rebuilding. Changes to tabs and widget instances can also be made via the settings drawer in the UI (⚙ button in the tab bar) — they are saved back to the file automatically.

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
        { "instanceId": "infra-main",   "widgetId": "infra.overview",         "satelliteId": "infra",   "config": {} },
        { "instanceId": "vikunja-main", "widgetId": "vikunja.task-overview",  "satelliteId": "vikunja", "config": {} },
        { "instanceId": "rc-focus",     "widgetId": "vikunja.project-focus",  "satelliteId": "vikunja", "config": { "project_id": 6 } }
      ]
    }
  ]
}
```

### satellites

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique identifier, referenced by widget instances |
| `url` | yes | Public URL used for "open →" links in widget shells |
| `widgetUrl` | yes | Internal Docker URL the hub backend proxies to |

`widgetUrl` should use the internal Docker hostname (e.g. `http://infra:8080`) so traffic stays on the Docker network. It is stripped before sending config to the browser.

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
| `satelliteId` | no | References a satellite entry above (omit for builtin widgets) |
| `config` | yes | Passed as `config` prop to the widget component |

See [Widget System](../widgets/index.md) for the available widget IDs and their config schemas.

---

## Widget registry

The hub ships a built-in widget registry. See [Built-in widget IDs](../widgets/index.md#built-in-widget-ids) for the full list.

To add widgets from a new satellite, see [Building a Satellite](building-a-satellite.md).

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
| `GET /api/dashboard` | Returns dashboard config (`widgetUrl` stripped) |
| `PUT /api/dashboard` | Saves updated dashboard config (merges back `widgetUrl` values) |
| `GET /api/catalog` | Aggregates `GET /api/catalog` from all registered satellites |
| `GET /api/proxy/{satelliteId}/{path}` | Proxies requests to the satellite's internal `widgetUrl` |
| `GET /api/remote/{satelliteId}/{path}` | Serves satellite assets (including `remoteEntry.js`) for module federation |

Widget components in the browser call `GET /api/proxy/{satelliteId}/api/...`. The hub backend forwards the request to the satellite's internal Docker URL.

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
