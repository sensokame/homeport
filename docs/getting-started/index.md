# Getting Started

## Prerequisites

- Docker and Docker Compose
- A shared Docker network named `proxy-network`:
  ```bash
  docker network create proxy-network
  ```

---

## Pull images from GHCR

Images are published on every release:

```bash
docker pull ghcr.io/sensokame/homeport-hub:latest
docker pull ghcr.io/sensokame/homeport-infra:latest
docker pull ghcr.io/sensokame/homeport-inventory:latest
docker pull ghcr.io/sensokame/homeport-obsidian:latest
docker pull ghcr.io/sensokame/homeport-vikunja:latest
docker pull ghcr.io/sensokame/homeport-wger:latest
docker pull ghcr.io/sensokame/homeport-actual:latest
docker pull ghcr.io/sensokame/homeport-gcal:latest
```

To build from source instead, see [Contributing](../contributing/index.md).

---

## Deploy the hub

Create a `dashboard.json` file, then bring up the hub:

```json
{
  "version": 2,
  "satellites": [],
  "tabs": [
    { "id": "overview", "label": "Overview", "widgets": [] }
  ]
}
```

```yaml
# docker-compose.yml
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

```bash
docker compose up -d
```

The hub serves on port 8080. Point your reverse proxy at it. Open the settings drawer (⚙ button in the tab bar) to add widgets — or edit `dashboard.json` directly.

---

## Deploy satellites

Each satellite is independent — deploy only what you need. For each one:

1. Save the snippet below as `docker-compose.yml` in its own folder
2. Run `docker compose up -d`
3. Add the satellite and a widget instance to `dashboard.json`

---

### Infrastructure

```yaml
services:
  infra:
    image: ghcr.io/sensokame/homeport-infra:latest
    container_name: infra
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "infra", "url": "http://infra.station", "widgetUrl": "http://infra:8080" }

// widgets array in a tab
{ "instanceId": "infra-main", "widgetId": "infra.overview", "satelliteId": "infra", "config": {} }
```

---

### Inventory

```yaml
services:
  inventory:
    image: ghcr.io/sensokame/homeport-inventory:latest
    container_name: inventory
    restart: unless-stopped
    volumes:
      - ./data:/data
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "inventory", "url": "http://inventory.station", "widgetUrl": "http://inventory:8080" }

// widgets array in a tab
{ "instanceId": "inventory-main", "widgetId": "inventory.overview", "satelliteId": "inventory", "config": {} }
```

---

### Knowledge

Requires an Obsidian vault on the host.

```yaml
services:
  knowledge:
    image: ghcr.io/sensokame/homeport-obsidian:latest
    container_name: knowledge
    restart: unless-stopped
    volumes:
      - /path/to/vault:/vault:ro
    environment:
      - GOODREADS_USER_ID=your_user_id
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "knowledge", "url": "http://knowledge.station", "widgetUrl": "http://knowledge:8080" }

// widgets array in a tab
{ "instanceId": "knowledge-main", "widgetId": "knowledge.reading", "satelliteId": "knowledge", "config": {} }
```

---

### Tasks

Requires a running [Vikunja](https://vikunja.io) instance on the same Docker network.

```yaml
services:
  vikunja-sat:
    image: ghcr.io/sensokame/homeport-vikunja:latest
    container_name: vikunja-sat
    restart: unless-stopped
    environment:
      - VIKUNJA_URL=http://vikunja:3456/api/v1
      - VIKUNJA_TOKEN=your_token
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "vikunja", "url": "http://vikunja.station", "widgetUrl": "http://vikunja-sat:8080" }

// widgets array in a tab
{ "instanceId": "vikunja-main", "widgetId": "vikunja.task-overview", "satelliteId": "vikunja", "config": {} }
```

---

### Fitness

Requires a running [wger](https://wger.de) instance on the same Docker network.

```yaml
services:
  wger-sat:
    image: ghcr.io/sensokame/homeport-wger:latest
    container_name: wger-sat
    restart: unless-stopped
    environment:
      - WGER_URL=http://wger/api/v2
      - WGER_TOKEN=your_token
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "wger", "url": "http://wger.station", "widgetUrl": "http://wger-sat:8080" }

// widgets array in a tab
{ "instanceId": "wger-main", "widgetId": "fitness.overview", "satelliteId": "wger", "config": {} }
```

---

### Budget

Requires a running [Actual Budget](https://actualbudget.org) server on the same Docker network.

```yaml
services:
  actual-sat:
    image: ghcr.io/sensokame/homeport-actual:latest
    container_name: actual-sat
    restart: unless-stopped
    environment:
      - ACTUAL_SERVER_URL=http://actual:5006
      - ACTUAL_PASSWORD=your_password
      - ACTUAL_BUDGET_ID=your_budget_id
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "budget", "url": "http://budget.station", "widgetUrl": "http://actual-sat:8080" }

// widgets array in a tab
{ "instanceId": "budget-main", "widgetId": "budget.overview", "satelliteId": "budget", "config": {} }
```

---

### Calendar

Configure a Google Calendar secret ICS address (or any iCal URL) in the `GCAL_ICS_URL` env var. No OAuth required.

```yaml
services:
  gcal-sat:
    image: ghcr.io/sensokame/homeport-gcal:latest
    container_name: gcal-sat
    restart: unless-stopped
    environment:
      - GCAL_ICS_URL=https://calendar.google.com/calendar/ical/...
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "gcal", "url": "http://gcal.station", "widgetUrl": "http://gcal-sat:8080" }

// widgets array in a tab
{ "instanceId": "gcal-main", "widgetId": "calendar.overview", "satelliteId": "gcal", "config": {} }
```

---

## Reverse proxy

All containers attach to `proxy-network`. Use Nginx Proxy Manager (or any reverse proxy) to route subdomains to each container's port 8080.

| Subdomain | Container | Port |
|---|---|---|
| `panel.station` | `hub` | 8080 |
| `infra.station` | `infra` | 8080 |
| `inventory.station` | `inventory` | 8080 |
| `gcal.station` | `gcal-sat` | 8080 |
