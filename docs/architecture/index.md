# Architecture

## Hub + satellite model

```
┌─────────────────────────────────────┐
│               hub                   │
│  reads dashboard.json on startup    │
│  renders tab bar + widget grid      │
│  mounts widget components by id     │
└──────┬──────────────────────────────┘
       │  API proxying (internal Docker network)
       ├──────────────────► infra:8080
       ├──────────────────► inventory:8080
       ├──────────────────► knowledge:8080
       ├──────────────────► vikunja-sat:8080
       ├──────────────────► wger-sat:8080
       ├──────────────────► actual-sat:8080
       ├──────────────────► gcal-sat:8080
       └──────────────────► (your satellite)
```

The hub is a pure shell. It has no domain logic and no database. Everything domain-specific lives in the satellites and their widget components.

API calls happen server-side (hub backend → satellite backend) to avoid CORS and keep satellites off the public internet. Widget components in the browser use relative `/api/proxy/{id}/...` URLs — the hub backend forwards them to the satellite's internal Docker URL.

---

## Dashboard + widget system

The hub renders a configurable dashboard of **widgets**. Each widget is a React component shipped by a satellite via module federation. The hub places them into tabs according to `dashboard.json`.

See the [Widget System](../widgets/index.md) docs for the full architecture: interfaces, `SwipeableCard` pattern, `dashboard.json` schema, and how to build a widget. To build your own satellite, see [Building a Satellite](../satellites/building-a-satellite.md).

**Key properties:**

- The same widget can appear multiple times with different config (e.g. two project-focus widgets for different projects)
- Widget components are loaded at runtime via module federation — adding a satellite doesn't require rebuilding the hub frontend (only a hub registry update + rebuild is needed)
- The tab bar and settings drawer let users build their own dashboard without editing JSON
- Swipe left/right on the main content area to switch tabs (touch devices)

---

## Satellite types

**Widget satellites** expose one or more widget components and a backend API:

- Widgets are React components loaded by the hub via module federation
- Each component fetches data through the hub proxy (`/api/proxy/{satelliteId}/...`)
- The satellite also serves its own full-page UI at `url` (optional — the "open →" link)

**Builtin widgets** ship with the hub and need no satellite:

- `builtin.clock` — current time display

**Link cards** have no widget components — just a satellite entry with a `url`:

- Add the satellite entry to `dashboard.json` without a widget instance
- Use `builtin.clock` or a future `builtin.link` widget type for a simple open → card

---

## Homeport as a panel

homeport is designed to run on a wall-mounted panel (e.g. a tablet in always-on display mode). The PWA manifest enables full-screen installation. The touch-based tab switching (swipe left/right) and focus mode are built for this use case.

The satellite contract is the extension point: any service can become a panel widget by implementing `GET /api/catalog` and shipping a federated widget component. The hub never changes to add new domain knowledge — that lives in satellites.

---

## Monorepo structure

```
homeport/
├── packages/
│   └── ui/                  @homeport/ui — shared React component library
│       ├── src/
│       │   ├── components/  Card, SwipeableCard, NavBar, Badge, …
│       │   └── tokens.css   CSS custom properties
│       └── package.json
├── apps/
│   ├── hub/                 Hub — dashboard shell
│   │   ├── backend/         FastAPI
│   │   ├── src/
│   │   │   └── registry/    Widget registry (widgetId → WidgetManifest)
│   │   ├── public/          PWA manifest + icon
│   │   ├── dashboard.json   Volume-mounted config
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
│   │   ├── src/             Widget components
│   │   └── Dockerfile
│   ├── actual/              Budget satellite
│   │   ├── server/          Node.js + @actual-app/api
│   │   ├── src/             React frontend + widget components
│   │   └── Dockerfile
│   └── gcal/                Calendar satellite
│       ├── backend/         Node.js — ICS parsing
│       ├── src/             Widget components
│       └── Dockerfile
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Adding a new satellite

See [Building a Satellite](../satellites/building-a-satellite.md) for the full guide.

In short:

1. Create `apps/<name>/` with a backend and React widget components
2. Expose `GET /api/catalog` from the backend
3. Write widget components implementing `WidgetProps` from `@homeport/ui`
4. Configure module federation in the satellite's `vite.config.ts`
5. Register in `apps/hub/src/registry/index.ts` (three files to update)
6. Add a satellite entry + widget instances to `dashboard.json`
7. Add a `Dockerfile` that serves everything on port 8080
