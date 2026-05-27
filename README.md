# homeport

A self-hosted personal hub. Aggregates independent **satellite** services into one dashboard — no lock-in, no domain logic.

**[Documentation →](https://sensokame.github.io/homeport)**

---

## How it works

The hub reads `satellites.json` and renders a card grid. Each satellite is a standalone Docker container that exposes `GET /widget`. Adding a new domain = deploy a container + one line in `satellites.json`. The hub never changes.

Third-party tools (Vikunja, Actual Budget, Quartz) are link cards — no integration code needed.

## Apps

| App | Description |
|---|---|
| `apps/hub` | Hub — aggregates satellites into a card grid |
| `apps/infra` | Infrastructure satellite — Docker monitoring, system metrics, container actions |
| `apps/inventory` | Inventory satellite — equipment and project tracker with shopping list |

## Packages

| Package | Description |
|---|---|
| `packages/ui` | `@homeport/ui` — shared React component library and CSS design tokens |

## Quick start

```bash
git clone https://github.com/sensokame/homeport
cd homeport

# hub
docker compose -f apps/hub/docker-compose.yml up -d

# infra satellite
docker compose -f apps/infra/docker-compose.yml up -d

# inventory satellite
docker compose -f apps/inventory/docker-compose.yml up -d
```

See the [full documentation](https://sensokame.github.io/homeport) for configuration, the widget protocol, and how to add new satellites.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | React + TypeScript + Vite |
| Shared UI | `@homeport/ui` — React components + CSS tokens |
| Backend | FastAPI (Python) per satellite |
| Database | SQLite per data-bearing satellite |

## License

MIT
