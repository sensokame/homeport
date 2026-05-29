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

Create a `satellites.json` file (see [Hub](../satellites/hub.md) for the format), then save the following as `docker-compose.yml` and bring it up:

```yaml
# docker-compose.yml
services:
  hub:
    image: ghcr.io/sensokame/homeport-hub:latest
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

```bash
docker compose up -d
```

The hub serves on port 8080. Point your reverse proxy at it.

---

## Deploy satellites

Each satellite is independent — deploy only what you need. For each one:

1. Save the snippet below as `docker-compose.yml` in its own folder
2. Run `docker compose up -d`
3. Add the `satellites.json` entry to the hub's config

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

Add to `satellites.json`:

```json
{ "id": "infra", "name": "Infrastructure", "url": "http://infra.station", "widget_url": "http://infra:8080/widget", "icon": "server" }
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

Add to `satellites.json`:

```json
{ "id": "inventory", "name": "Inventory", "url": "http://inventory.station", "widget_url": "http://inventory:8080/widget", "icon": "package" }
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

Add to `satellites.json`:

```json
{ "id": "knowledge", "name": "Knowledge", "url": "http://quartz.station", "widget_url": "http://knowledge:8080/widget", "icon": "book-open" }
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

Add to `satellites.json`:

```json
{ "id": "vikunja", "name": "Tasks", "url": "http://vikunja.station", "widget_url": "http://vikunja-sat:8080/widget", "icon": "check-square" }
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

Add to `satellites.json`:

```json
{ "id": "wger", "name": "Fitness", "url": "http://wger.station", "widget_url": "http://wger-sat:8080/widget", "icon": "activity" }
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

Add to `satellites.json`:

```json
{ "id": "budget", "name": "Finances", "url": "http://budget.station", "widget_url": "http://actual-sat:8080/widget", "icon": "dollar-sign" }
```

---

## Add a third-party link card

No code needed. Add an entry without `widget_url` to `satellites.json`:

```json
{
  "id": "notes",
  "name": "Notes",
  "url": "http://quartz.station",
  "icon": "book"
}
```

The hub renders a link card with an "open →" button.

---

## Reverse proxy

All containers attach to `proxy-network`. Use Nginx Proxy Manager (or any reverse proxy) to route subdomains to each container's port 8080.

| Subdomain | Container | Port |
|---|---|---|
| `panel.station` | `hub` | 8080 |
| `infra.station` | `infra` | 8080 |
| `inventory.station` | `inventory` | 8080 |
