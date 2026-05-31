# homeport

A self-hosted personal hub. Aggregates independent **satellite** services into one dashboard — no lock-in, no domain logic.

**[Documentation →](https://sensokame.github.io/homeport)**

---

## How it works

The hub reads `dashboard.json` and renders a configurable tab dashboard. Each satellite is a standalone Docker container. Adding a new domain = deploy a container + one entry in `dashboard.json`. The hub never changes.

## Apps

| App | Description |
|---|---|
| `apps/hub` | Hub — aggregates satellites into a tabbed widget dashboard |
| `apps/infra` | Infrastructure satellite — Docker monitoring, system metrics, container actions |
| `apps/inventory` | Inventory satellite — equipment and project tracker with shopping list |
| `apps/obsidian` | Knowledge satellite — currently-reading books (Goodreads) + active Obsidian notes |
| `apps/vikunja` | Tasks satellite — wraps Vikunja; shows due today and overdue |
| `apps/wger` | Fitness satellite — wraps wger; shows workout and nutrition status |
| `apps/actual` | Budget satellite — wraps Actual Budget; shows monthly spend summary |

## Packages

| Package | Description |
|---|---|
| `packages/ui` | `@homeport/ui` — shared React component library and CSS design tokens |

## Quick start

Images are published to GHCR on every release:

```bash
docker pull ghcr.io/sensokame/homeport-hub:latest
docker pull ghcr.io/sensokame/homeport-infra:latest
docker pull ghcr.io/sensokame/homeport-inventory:latest
```

Or build from source (build context must be the repo root):

```bash
git clone https://github.com/sensokame/homeport
cd homeport
docker build -f apps/hub/Dockerfile -t homeport-hub .
```

See the [full documentation](https://sensokame.github.io/homeport) for configuration, the widget protocol, and how to add new satellites.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | React + TypeScript + Vite |
| Shared UI | `@homeport/ui` — React components + CSS tokens |
| Backend | FastAPI (Python) or Node.js per satellite |
| Database | SQLite per data-bearing satellite |

## License

MIT
