# homeport

A self-hosted personal dashboard for technical users. Aggregates independent **satellite** services into one configurable tab dashboard — no lock-in, no domain logic in the hub.

[View on GitHub](https://github.com/sensokame/homeport){ .md-button .md-button--primary }
[Get Started](getting-started/index.md){ .md-button }

---

## What it is

homeport is a pure aggregation layer. The **hub** reads from independent satellite containers and renders a configurable tab dashboard. Each satellite is a standalone service — usable without homeport, independently deployable, and independently removable.

Adding a new domain means deploying a container and adding one entry to `dashboard.json`. The hub never needs to change.

homeport is designed to run on a **wall-mounted panel** — a tablet in always-on display mode. The interface is touch-first: swipe left/right to switch tabs, focus mode for full-screen widgets, PWA manifest for home-screen installation.

---

## First party satellites

| Satellite | Image | Description |
|---|---|---|
| [Infrastructure](satellites/infra.md) | `homeport-infra` | Docker container monitoring — status, CPU, RAM, disk, actions |
| [Inventory](satellites/inventory.md) | `homeport-inventory` | Equipment and project tracker with shopping list |
| [Knowledge](satellites/knowledge.md) | `homeport-obsidian` | Currently-reading books (Goodreads) + active Obsidian notes |
| [Tasks](satellites/vikunja.md) | `homeport-vikunja` | Vikunja wrapper — due today, overdue, project count |
| [Fitness](satellites/wger.md) | `homeport-wger` | wger wrapper — workout schedule and nutrition logging |
| [Budget](satellites/actual.md) | `homeport-actual` | Actual Budget wrapper — monthly spend vs. budgeted |
| [Calendar](satellites/gcal.md) | `homeport-gcal` | ICS-based calendar — current block + trade acknowledgment |

Each satellite ships a widget component loaded into the hub via module federation. See [Building a Satellite](satellites/building-a-satellite.md) to add your own.

---

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | React + TypeScript + Vite |
| Shared UI | `@homeport/ui` — React components + CSS tokens |
| Backend | FastAPI (Python) or Node.js per satellite |
| Database | SQLite per data-bearing satellite |
| Widget loading | Module federation (`@originjs/vite-plugin-federation`) |
