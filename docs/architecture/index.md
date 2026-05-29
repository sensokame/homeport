# Architecture

## Hub + satellite model

```
┌─────────────────────────────────────┐
│               hub                   │
│  reads satellites.json on startup   │
│  proxies GET /widget server-side    │
│  renders card grid in browser       │
└──────┬──────────────────────────────┘
       │  GET /widget (internal Docker network)
       ├──────────────────► infra:8080
       ├──────────────────► inventory:8080
       ├──────────────────► knowledge:8080
       ├──────────────────► vikunja-sat:8080
       ├──────────────────► wger-sat:8080
       ├──────────────────► actual-sat:8080
       └──────────────────► (any future satellite)
```

The hub is a pure aggregation layer. It has no domain logic and no database. Everything domain-specific lives in the satellites.

Widget fetches happen server-side (hub backend → satellite backend) to avoid CORS and keep satellites off the public internet.

---

## Satellite types

**First-party satellites** expose `GET /widget` and have their own UI:

- The hub shows a live widget card (status, summary, metrics)
- Clicking the card opens the satellite's own interface

**Third-party / link cards** have no `widget_url` in `satellites.json`:

- The hub renders a simple link card with an "open →" button
- No integration code required — just a URL

---

## Widget protocol

Every first-party satellite must expose this endpoint:

```
GET /widget
Content-Type: application/json
```

Response schema:

```json
{
  "title": "string",
  "status": "ok | warn | error",
  "summary": "string",
  "metrics": [
    {
      "label": "string",
      "value": "string or number",
      "alert": true
    }
  ]
}
```

`metrics` is optional. `alert: true` highlights the metric in warn color.

If a satellite is unreachable, the hub returns `{ "status": "error", "summary": "unreachable" }` for that entry — the page never breaks.

---

## Monorepo structure

```
homeport/
├── packages/
│   └── ui/                  @homeport/ui — shared React component library
│       ├── src/
│       │   ├── components/
│       │   └── tokens.css   CSS custom properties
│       └── package.json
├── apps/
│   ├── hub/                 Hub — aggregator
│   │   ├── backend/         FastAPI
│   │   ├── src/             React frontend
│   │   ├── satellites.json  Volume-mounted config
│   │   └── Dockerfile
│   ├── infra/               Infrastructure satellite
│   │   ├── backend/         FastAPI + Docker SDK + psutil
│   │   ├── src/             React frontend
│   │   └── Dockerfile
│   ├── inventory/           Inventory satellite
│   │   ├── backend/         FastAPI + SQLite
│   │   ├── src/             React frontend
│   │   └── Dockerfile
│   ├── obsidian/            Knowledge satellite
│   │   ├── backend/         FastAPI — reads vault + Goodreads RSS
│   │   └── Dockerfile
│   ├── vikunja/             Tasks satellite
│   │   ├── backend/         FastAPI — Vikunja API wrapper
│   │   └── Dockerfile
│   ├── wger/                Fitness satellite
│   │   ├── backend/         FastAPI — wger API wrapper
│   │   └── Dockerfile
│   └── actual/              Budget satellite
│       ├── server/          Node.js + @actual-app/api
│       ├── src/             React frontend
│       └── Dockerfile
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Adding a new satellite

1. Create `apps/<name>/` with a FastAPI backend and a React frontend
2. Implement `GET /widget` returning the standard schema
3. Add a `Dockerfile` and `docker-compose.yml`
4. Add one entry to the hub's `satellites.json` — no hub code changes needed
