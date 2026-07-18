# Workspace

`workspace-sat` is a **first party optional satellite** that ships with homeport. It provides **workflow widgets** — swipeable cards that compose multiple widgets from other satellites into a single view.

Deploy it when you want to group related widgets from different satellites (tasks, inventory, notes) into one place. Leave it out if you don't need it — the hub works without it.

It has two composition modes:

- **Manual slots** — you hand-pick which satellite/widget/config combinations appear, in `dashboard.json`. General-purpose: works for any widgets, related to a project or not.
- **Project mode** — you give it a vault project slug; it automatically discovers every satellite that declares project support and composes their views for that slug. No manual wiring, but only works for satellites that implement the project-widget contract.

---

## How it works

`workspace-sat` is a Tier 2 satellite: it ships a React bundle (`remoteEntry.js`) and registers a single widget, `workspace.panel`. That widget uses the `renderWidget` prop the hub injects into every Tier 2 component to embed child widgets from other satellites, live, inside itself.

```
workspace.panel (SwipeableCard)
├── home:   workspace summary (label + slot count)
├── page 1: renderWidget("inventory", "inventory.project-items", { project_slug: "4wd-robot-car" })
└── page 2: renderWidget("knowledge", "knowledge.project-tasks", { project_slug: "4wd-robot-car" })
```

The hub handles all loading for child widgets — whether they're Tier 1 or Tier 2 — via its existing module federation and proxy infrastructure. `workspace-sat` never touches internal Docker URLs or module federation directly, and never calls another satellite's backend itself — composition happens entirely in the hub's frontend.

---

## Deploy

```yaml
# docker-compose.yml
services:
  workspace-sat:
    image: ghcr.io/sensokame/homeport-workspace:latest
    container_name: workspace-sat
    restart: unless-stopped
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

```bash
docker compose up -d
```

Add the satellite to `dashboard.json`:

```json
// satellites array
{ "id": "workspace", "url": "", "widgetUrl": "http://workspace-sat:8080" }
```

`workspace-sat` has no meaningful standalone UI — `url` can be left empty.

---

## Project mode

The simplest way to get a unified view of one vault project (`Projects/projects/<slug>/`):

```json
{
  "instanceId": "workspace-robot-car",
  "widgetId": "workspace.panel",
  "satelliteId": "workspace",
  "config": {
    "label": "4WD Robot Car",
    "mode": "project",
    "slug": "4wd-robot-car"
  }
}
```

At render time, `workspace.panel` fetches the hub's own aggregated `GET /api/catalog` (same-origin, not proxied — this is a hub endpoint, not a satellite one) and reads its `projectProviders` field:

```json
{ "projectProviders": { "inventory": "inventory.project-items", "knowledge": "knowledge.project-tasks" } }
```

For every entry it calls `renderWidget(satelliteId, projectWidgetId, { project_slug: slug })` — one page per project-providing satellite, automatically. Add a new satellite that declares project support later and every existing project-mode workspace card picks it up with zero `dashboard.json` changes.

### Declaring project support (for satellite authors)

A satellite opts in by adding two fields to its own `GET /api/catalog` response:

```python
@app.get("/api/catalog")
def catalog():
    return {
        "widgets": [
            {"id": "myapp.project-view", "name": "My Project View",
             "description": "...", "configSchema": {
                 "project_slug": {"type": "string", "label": "Project slug", "required": True}
             }},
        ],
        "provides": ["project"],
        "projectWidget": "myapp.project-view",
    }
```

- `provides: ["project"]` — marks this satellite as a project data source.
- `projectWidget` — which of its own registered widget ids to render for a project view. That widget must accept `config.project_slug` and fetch/render whatever it needs itself (e.g. `GET ${satelliteUrl}/api/projects/{slug}`) — workspace-sat never fetches this data on your behalf.

The hub's backend (`apps/hub/backend/main.py`, `GET /api/catalog`) collects these into the top-level `projectProviders` map without touching the existing per-satellite `widgets` array, so the "Add widget" catalog UI is unaffected.

See `docs/satellites/inventory.md` (`inventory.project-items`) and `docs/satellites/knowledge.md` (`knowledge.project-tasks`) for two working examples.

---

## Manual slots mode

For grouping widgets that have nothing to do with a shared project slug — or when you want precise control over which widgets appear — list them explicitly:

```json
{
  "instanceId": "workspace-custom",
  "widgetId": "workspace.panel",
  "satelliteId": "workspace",
  "config": {
    "label": "Morning Brief",
    "context": {
      "tags": ["morning"]
    },
    "slots": [
      { "satelliteId": "gcal", "widgetId": "calendar.overview", "config": {} },
      { "satelliteId": "infra", "widgetId": "infra.overview", "config": {} }
    ]
  }
}
```

| Field | Description |
|---|---|
| `label` | Display name shown in the workspace summary card |
| `context.tags` | Optional shared tags passed to all child widgets as a hint |
| `slots[].satelliteId` | Must match a satellite `id` in the `satellites` array |
| `slots[].widgetId` | Any registered widget id |
| `slots[].config` | Passed directly to the child widget as its `config` prop |

If `config.mode` is omitted (or anything other than `"project"`), `workspace.panel` uses `config.slots` as-is — no catalog discovery involved.

---

## Context prop

Every child widget rendered in **slots mode** receives a `workspaceContext` field injected into its `config` (project mode injects it too, alongside `project_slug`):

```typescript
config: {
  ...slotConfig,
  workspaceContext: {
    label: string   // e.g. "Morning Brief"
    tags: string[]  // e.g. ["morning"]
  }
}
```

Satellites that want to participate in workspace filtering read this field and scope their data accordingly. Satellites that ignore it work fine too — context is a hint, not a requirement. Neither `inventory.project-items` nor `knowledge.project-tasks` currently reads it; they rely on `project_slug` directly.

---

## Building your own composition satellite

`workspace-sat` is a reference implementation. You can build your own composition satellite with a different layout — a grid instead of swipe pages, a tabbed panel, a timeline view — by following the same pattern:

1. Create a Tier 2 widget component. `WidgetProps` (from `@homeport/ui`) already includes an optional `renderWidget?: (satelliteId: string, widgetId: string, config: Record<string, unknown>) => ReactNode` — no type changes needed, just destructure it from your props.
2. Call `renderWidget(satelliteId, widgetId, config)` wherever you want to embed a child widget.
3. Build the layout using `@homeport/ui` primitives (`Card`, `SwipeableCard`, etc.)
4. Register and deploy as a normal satellite.

The hub only passes `renderWidget` to widgets it renders itself (via `WidgetShell` in the grid, and the focused-mode path) — it is `undefined` if your widget is somehow rendered outside the hub, so check for it before calling.
