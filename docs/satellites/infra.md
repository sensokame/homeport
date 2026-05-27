# Infrastructure Satellite

Docker container monitoring. Exposes live container status, system metrics, and management actions.

---

## Features

- Container card grid — status, image, uptime, CPU, RAM per container
- Container detail view — ports, mounts, networks, live stats, Dozzle log link
- System metrics bar — CPU%, RAM, disk usage
- Actions: stop, start, restart per container
- **Restart all** — restarts every container except infra itself
- **Update all** — pulls latest images, restarts only those that changed
- `GET /widget` — live summary for the hub

---

## Widget response

```json
{
  "title": "Infrastructure",
  "status": "ok",
  "summary": "12 / 12 containers running",
  "metrics": [
    { "label": "CPU",  "value": "4%" },
    { "label": "RAM",  "value": "6.2 GB / 16 GB" },
    { "label": "Disk", "value": "42%" }
  ]
}
```

Status logic: `ok` if all containers running, `error` if >20% stopped, `warn` otherwise.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `CONTAINER_NAME` | `infra` | This container's name — excluded from restart-all and update-all |
| `DOZZLE_URL` | _(empty)_ | Base URL of your Dozzle instance for log links |
| `HOSTNAME_DISPLAY` | system hostname | Label shown in the top bar |

---

## API

| Endpoint | Description |
|---|---|
| `GET /widget` | Hub widget data |
| `GET /api/containers` | List all containers |
| `GET /api/containers/{name}` | Single container detail |
| `GET /api/containers/{name}/stats` | Live CPU/RAM/network stats |
| `POST /api/containers/{name}/{action}` | `start`, `stop`, or `restart` |
| `GET /api/system` | CPU, RAM, disk metrics |
| `POST /api/actions/restart-all` | Restart all containers except self |
| `POST /api/actions/update-all` | Pull + restart updated containers (async) |
| `GET /api/actions/update-status` | Poll update-all progress |

---

## docker-compose.yml

```yaml
services:
  infra:
    build:
      context: ../..
      dockerfile: apps/infra/Dockerfile
    container_name: infra
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - DOZZLE_URL=${DOZZLE_URL:-}
      - CONTAINER_NAME=infra
      - HOSTNAME_DISPLAY=${HOSTNAME_DISPLAY:-station}
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

The Docker socket is mounted read-write for container actions (start/stop/restart/pull). If you only need monitoring, you can add `:ro`.
