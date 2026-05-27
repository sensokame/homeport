# Getting Started

## Prerequisites

- Docker and Docker Compose
- A shared Docker network named `proxy-network`:
  ```bash
  docker network create proxy-network
  ```
- [pnpm](https://pnpm.io) (only needed if building locally)

---

## Deploy the hub

```bash
git clone https://github.com/sensokame/homeport
cd homeport

# configure which satellites to show
cp apps/hub/satellites.json apps/hub/satellites.local.json
# edit satellites.local.json — see Satellites › Hub for the format

docker compose -f apps/hub/docker-compose.yml up -d
```

The hub serves on port 8080. Point your reverse proxy at it.

---

## Deploy the infra satellite

```bash
docker compose -f apps/infra/docker-compose.yml up -d
```

Add it to the hub's `satellites.json`:

```json
{
  "id": "infra",
  "name": "Infrastructure",
  "url": "http://infra.station",
  "widget_url": "http://infra:8080/widget",
  "icon": "server"
}
```

---

## Deploy the inventory satellite

```bash
docker compose -f apps/inventory/docker-compose.yml up -d
```

Add it to the hub's `satellites.json`:

```json
{
  "id": "inventory",
  "name": "Inventory",
  "url": "http://inventory.station",
  "widget_url": "http://inventory:8080/widget",
  "icon": "package"
}
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
