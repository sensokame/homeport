# Architecture

## Hub + satellite model

```
┌─────────────────────────────────────┐
│               hub                   │
│  reads dashboard.json on startup    │
│  renders tab bar + widget grid      │
│  mounts widget components by id     │
└──────┬──────────────────────────────┘
       │  API calls (internal Docker network)
       ├──────────────────► infra:8080
       ├──────────────────► inventory:8080
       ├──────────────────► knowledge:8080
       ├──────────────────► vikunja-sat:8080
       ├──────────────────► wger-sat:8080
       ├──────────────────► actual-sat:8080
       └──────────────────► (any future satellite)
```

The hub is a pure shell. It has no domain logic and no database. Everything domain-specific lives in the satellites and their widget components.

API calls happen server-side (hub backend → satellite backend) to avoid CORS and keep satellites off the public internet.

---

## Dashboard + widget system

The hub renders a configurable dashboard of **widgets**. Each widget is a React component provided by a satellite. The hub places widgets into tabs according to `dashboard.json`.

See the [Widget System](../widgets/index.md) docs for the full architecture: interfaces, `SwipeableCard` pattern, `dashboard.json` schema, and how to build a widget.

**Key properties of the system:**

- The same widget can appear multiple times with different config (e.g. two project-focus widgets for different projects)
- Widgets decide their own layout — a flat card, a swipable card, a grid of cards, a chart
- The tab bar and settings drawer let users build their own dashboard without editing JSON
- The static widget registry (bundled) will be replaced by module federation in a future release, with no changes required to widget code

---

## Satellite types

**Widget satellites** expose one or more widget components and a backend API:

- The hub mounts widget components in the dashboard grid
- Each component fetches from its satellite's backend directly
- Clicking "open →" links to the satellite's own full UI

**Link cards** have no widget components — just a name and URL:

- The hub renders a simple link card with an "open →" button
- No integration code required

**Composition satellites** are widget satellites whose components use the `renderWidget` prop to embed other widgets. The hub injects `renderWidget` into every Tier 2 widget — any satellite can use it. `workspace-sat` is the first party example: it provides `workspace.panel`, a swipeable card whose pages are populated by widgets from other satellites. See [Widget composition](../widgets/index.md#widget-composition) and [Workspace](../satellites/workspace.md).

---

## Legacy widget protocol (v1)

> The flat `/widget` endpoint is the v1 protocol, used by all current satellites. It will be replaced by the component-based widget system during the Phase 2–3 migration. Both protocols will coexist during the transition.

Every first-party satellite currently exposes:

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
    { "label": "string", "value": "string or number", "alert": true }
  ]
}
```

If a satellite is unreachable, the hub returns `{ "status": "error", "summary": "unreachable" }` — the page never breaks.

---

## Monorepo structure

```
homeport/
├── packages/
│   └── ui/                  @homeport/ui — shared React component library
│       ├── src/
│       │   ├── components/  Card, WidgetCard, SwipeableCard, NavBar, …
│       │   └── tokens.css   CSS custom properties
│       └── package.json
├── apps/
│   ├── hub/                 Hub — dashboard shell
│   │   ├── backend/         FastAPI
│   │   ├── src/
│   │   │   └── registry/    Widget registry (widgetId → WidgetManifest)
│   │   ├── dashboard.json   Volume-mounted config
│   │   └── Dockerfile
│   ├── workspace/           Workspace satellite (first party, optional)
│   │   ├── src/             React widget components (workspace.panel)
│   │   └── Dockerfile
│   ├── infra/               Infrastructure satellite
│   │   ├── backend/         FastAPI + Docker SDK + psutil
│   │   ├── src/             React frontend + widget components
│   │   └── Dockerfile
│   ├── inventory/           Inventory satellite
│   │   ├── backend/         FastAPI + SQLite
│   │   ├── src/             React frontend + widget components
│   │   └── Dockerfile
│   ├── obsidian/            Knowledge satellite
│   │   ├── backend/         FastAPI — reads vault + Goodreads RSS
│   │   └── Dockerfile
│   ├── vikunja/             Tasks satellite
│   │   ├── backend/         FastAPI — Vikunja API wrapper
│   │   ├── src/             Widget components
│   │   └── Dockerfile
│   ├── wger/                Fitness satellite
│   │   ├── backend/         FastAPI — wger API wrapper
│   │   └── Dockerfile
│   └── actual/              Budget satellite
│       ├── server/          Node.js + @actual-app/api
│       ├── src/             React frontend + widget components
│       └── Dockerfile
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Adding a new satellite

1. Create `apps/<name>/` with a backend and React widget components
2. Implement `GET /widget` (v1 protocol, for backward compat) and your API endpoints
3. Write widget components implementing `WidgetComponent` from `@homeport/ui`
4. Register manifests in `apps/hub/src/registry/index.ts`
5. Add a satellite entry + widget instances to `dashboard.json`
6. Add a `Dockerfile` and service to `internal.yml`

If your widget composes other widgets, use the `renderWidget` prop — no special registration or hub changes required. The hub injects it into every Tier 2 widget automatically.
