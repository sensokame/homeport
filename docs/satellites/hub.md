# Hub

The hub is the entry point to homeport. It reads `satellites.json`, proxies each satellite's `/widget` endpoint, and renders a card grid.

---

## satellites.json

Mount this file into the container. Edit it without rebuilding.

```json
[
  {
    "id": "infra",
    "name": "Infrastructure",
    "url": "http://infra.station",
    "widget_url": "http://infra:8080/widget",
    "icon": "server"
  },
  {
    "id": "notes",
    "name": "Notes",
    "url": "http://quartz.station",
    "icon": "book"
  }
]
```

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique identifier |
| `name` | yes | Display name on the card |
| `url` | yes | URL opened when the user clicks the card |
| `widget_url` | no | Internal URL for `GET /widget` — omit for link cards |
| `icon` | no | Icon name (decorative) |

`widget_url` should use the internal Docker hostname (e.g. `http://infra:8080`) so traffic stays on the Docker network and doesn't pass through the reverse proxy.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `HOSTNAME_DISPLAY` | system hostname | Label shown in the top bar |
| `SATELLITES_PATH` | `/app/satellites.json` | Path to the satellites config file |

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/config` | Returns `{ hostname, version }` |
| `GET /api/satellites` | Returns all satellites with widget data attached |

Widget fetch failures are handled gracefully — a failed satellite returns `{ "status": "error", "summary": "unreachable" }` without affecting the rest of the page.

---

## docker-compose.yml

```yaml
services:
  hub:
    build:
      context: ../..
      dockerfile: apps/hub/Dockerfile
    container_name: hub
    restart: unless-stopped
    volumes:
      - ./satellites.json:/app/satellites.json:ro
    environment:
      - HOSTNAME_DISPLAY=station
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```
