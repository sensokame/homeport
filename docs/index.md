# homeport

A self-hosted personal hub for technical users. Aggregates independent **satellite** services into one dashboard — no lock-in, no domain logic.

[View on GitHub](https://github.com/sensokame/homeport){ .md-button .md-button--primary }
[Get Started](getting-started/index.md){ .md-button }

---

## What it is

Homeport is a pure aggregation layer. The **hub** reads from independent satellite containers and renders a card grid. Each satellite is a standalone service — usable without homeport, independently deployable, and independently removable.

Adding a new domain means deploying a container and adding one line to `satellites.json`. The hub never needs to change.

---

## Satellites

| Satellite | Type | Description |
|---|---|---|
| [Infrastructure](satellites/infra.md) | First-party | Docker container monitoring — status, CPU, RAM, disk, actions |
| [Inventory](satellites/inventory.md) | First-party | Equipment and project tracker with shopping list |
| Quartz | Link card | Obsidian knowledge vault, served as a static site |
| Vikunja | Link card | Self-hosted task management |
| Actual Budget | Link card | Self-hosted finance tracking |

First-party satellites expose a `GET /widget` endpoint. Third-party tools are link cards — no integration code, just a URL in `satellites.json`.

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
