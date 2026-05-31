# homeport

A self-hosted personal hub for technical users. Aggregates independent **satellite** services into one dashboard — no lock-in, no domain logic.

[View on GitHub](https://github.com/sensokame/homeport){ .md-button .md-button--primary }
[Get Started](getting-started/index.md){ .md-button }

---

## What it is

Homeport is a pure aggregation layer. The **hub** reads from independent satellite containers and renders a configurable tab dashboard. Each satellite is a standalone service — usable without homeport, independently deployable, and independently removable.

Adding a new domain means deploying a container and adding one entry to `dashboard.json`. The hub never needs to change.

---

## Satellites

| Satellite | Type | Description |
|---|---|---|
| [Infrastructure](satellites/infra.md) | First-party | Docker container monitoring — status, CPU, RAM, disk, actions |
| [Inventory](satellites/inventory.md) | First-party | Equipment and project tracker with shopping list |
| [Knowledge](satellites/knowledge.md) | First-party | Currently-reading books (Goodreads) + active Obsidian notes |
| [Tasks](satellites/vikunja.md) | First-party | Vikunja wrapper — due today, overdue, project count |
| [Fitness](satellites/wger.md) | First-party | wger wrapper — workout schedule and nutrition logging |
| [Budget](satellites/actual.md) | First-party | Actual Budget wrapper — monthly spend vs. budgeted |

First-party satellites expose a `GET /widget` endpoint and their own UI. Any service with a public URL can be added as a link card in `dashboard.json`.

---

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | React + TypeScript + Vite |
| Shared UI | `@homeport/ui` — React components + CSS tokens |
| Backend | FastAPI (Python) per satellite |
| Database | SQLite per data-bearing satellite |
| Proxy | Nginx Proxy Manager + Cloudflare Tunnel |
