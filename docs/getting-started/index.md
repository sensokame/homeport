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

Create a `satellites.json` file (see [Hub](../satellites/hub.md) for the format), then:

```yaml
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

The hub serves on port 8080. Point your reverse proxy at it.

---

## Deploy satellites

Each satellite is independent — deploy only what you need.

**Infrastructure**

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
```

**Inventory**

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
```

**Knowledge** (requires an Obsidian vault mounted at `/vault`)

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
```

**Tasks** (requires a running Vikunja instance)

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
```

**Fitness** (requires a running wger instance)

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
```

**Budget** (requires a running Actual Budget instance)

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
