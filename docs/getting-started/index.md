# Getting Started

## Prerequisites

- Docker and Docker Compose
- A shared Docker network named `proxy-network`:
  ```bash
  docker network create proxy-network
  ```

---

## Pull images from GHCR

Images are published on every release. Use them instead of building locally:

```bash
docker pull ghcr.io/sensokame/homeport-hub:latest
docker pull ghcr.io/sensokame/homeport-infra:latest
docker pull ghcr.io/sensokame/homeport-inventory:latest
docker pull ghcr.io/sensokame/homeport-obsidian:latest
docker pull ghcr.io/sensokame/homeport-vikunja:latest
docker pull ghcr.io/sensokame/homeport-wger:latest
docker pull ghcr.io/sensokame/homeport-actual:latest
```

To build from source instead, see [Contributing](../contributing/index.md).

---

## Deploy the hub

Create a `dashboard.json` file (see [Hub](../satellites/hub.md) for the full format), then save the following as `docker-compose.yml` and bring it up:

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

The hub serves on port 8080. Point your reverse proxy at it.

---

## Deploy satellites

Each satellite is independent — deploy only what you need. For each one:

1. Save the snippet below as `docker-compose.yml` in its own folder
2. Run `docker compose up -d`
3. Add the satellite to `dashboard.json`

---

### Infrastructure

```yaml
# docker-compose.yml
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

```bash
docker compose up -d
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "infra", "url": "http://infra.station", "widgetUrl": "http://infra:8080" }

// widgets array in a tab
{ "instanceId": "infra-main", "widgetId": "legacy.widget", "satelliteId": "infra", "config": { "icon": "server" } }
```

---

### Inventory

```yaml
# docker-compose.yml
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

```bash
docker compose up -d
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "inventory", "url": "http://inventory.station", "widgetUrl": "http://inventory:8080" }

// widgets array in a tab
{ "instanceId": "inventory-main", "widgetId": "legacy.widget", "satelliteId": "inventory", "config": { "icon": "package" } }
```

---

### Knowledge

Requires an Obsidian vault on the host.

```yaml
# docker-compose.yml
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

```bash
docker compose up -d
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "knowledge", "url": "http://quartz.station", "widgetUrl": "http://knowledge:8080" }

// widgets array in a tab
{ "instanceId": "knowledge-main", "widgetId": "legacy.widget", "satelliteId": "knowledge", "config": { "icon": "book-open" } }
```

---

### Tasks

Requires a running Vikunja instance on the same Docker network.

```yaml
# docker-compose.yml
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

```bash
docker compose up -d
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "vikunja", "url": "http://vikunja.station", "widgetUrl": "http://vikunja-sat:8080" }

// widgets array in a tab
{ "instanceId": "vikunja-main", "widgetId": "legacy.widget", "satelliteId": "vikunja", "config": { "icon": "check-square" } }
```

---

### Fitness

Requires a running wger instance on the same Docker network.

```yaml
# docker-compose.yml
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

```bash
docker compose up -d
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "wger", "url": "http://wger.station", "widgetUrl": "http://wger-sat:8080" }

// widgets array in a tab
{ "instanceId": "wger-main", "widgetId": "legacy.widget", "satelliteId": "wger", "config": { "icon": "activity" } }
```

---

### Budget

Requires a running Actual Budget instance on the same Docker network.

```yaml
# docker-compose.yml
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

```bash
docker compose up -d
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "budget", "url": "http://budget.station", "widgetUrl": "http://actual-sat:8080" }

// widgets array in a tab
{ "instanceId": "budget-main", "widgetId": "legacy.widget", "satelliteId": "budget", "config": { "icon": "dollar-sign" } }
```

---

### Workspace (optional)

Deploy this if you want workflow widgets — swipeable cards that combine multiple satellite widgets into a project-scoped view. See [Workspace](../satellites/workspace.md) for configuration.

```yaml
# docker-compose.yml
services:
  workspace-sat:
    image: ghcr.io/sensokame/homeport-workspace:latest
    container_name: workspace-sat
    restart: unless-stopped
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

```bash
docker compose up -d
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "workspace", "url": "", "widgetUrl": "http://workspace-sat:8080" }

// widgets array in a tab (one instance per workflow you want)
{
  "instanceId": "workspace-my-project",
  "widgetId": "workspace.panel",
  "satelliteId": "workspace",
  "config": {
    "label": "My Project",
    "context": { "tags": ["my-project"] },
    "slots": [
      { "satelliteId": "vikunja", "widgetId": "vikunja.project-focus", "config": { "project_id": 1 } }
    ]
  }
}
```

---

## Reverse proxy

All containers attach to `proxy-network`. Use Nginx Proxy Manager (or any reverse proxy) to route subdomains to each container's port 8080.

| Subdomain | Container | Port |
|---|---|---|
| `panel.station` | `hub` | 8080 |
| `infra.station` | `infra` | 8080 |
| `inventory.station` | `inventory` | 8080 |
