# Workspace

`workspace-sat` is a **first party optional satellite** that ships with homeport. It provides **workflow widgets** — swipeable cards that compose multiple widgets from other satellites into a single project-scoped view.

Deploy it when you want to group related widgets from different satellites (tasks, inventory, notes) into one place organised around a project. Leave it out if you don't need it — the hub works without it.

---

## How it works

`workspace-sat` is a Tier 2 satellite: it ships a React bundle (`remoteEntry.js`) and registers a single widget, `workspace.panel`. That widget uses the `renderWidget` prop the hub injects into every Tier 2 component to embed child widgets from other satellites.

```
workspace.panel (SwipeableCard)
├── home:   workspace summary (label + slot count)
├── page 1: renderWidget("vikunja", "vikunja.project-focus", { project_id: 6 })
├── page 2: renderWidget("inventory", "inventory.stock-summary", { project: "Robot Car" })
└── page 3: renderWidget("knowledge", "knowledge.quick-note", { folder: "Robot Car" })
```

The hub handles all loading for child widgets — whether they're Tier 1 or Tier 2. `workspace-sat` never touches internal Docker URLs or module federation directly.

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

`workspace-sat` has no standalone UI — `url` can be left empty.

---

## Configuring a workspace widget

Add a `workspace.panel` instance to any tab in `dashboard.json`. The `config` block declares the workspace label and its slots:

```json
{
  "instanceId": "workspace-robot-car",
  "widgetId": "workspace.panel",
  "satelliteId": "workspace",
  "config": {
    "label": "Robot Car",
    "context": {
      "tags": ["robot-car"]
    },
    "slots": [
      {
        "satelliteId": "vikunja",
        "widgetId": "vikunja.project-focus",
        "config": { "project_id": 6 }
      },
      {
        "satelliteId": "inventory",
        "widgetId": "inventory.stock-summary",
        "config": { "project": "Robot Car" }
      },
      {
        "satelliteId": "knowledge",
        "widgetId": "knowledge.quick-note",
        "config": { "folder": "Robot Car" }
      }
    ]
  }
}
```

| Field | Description |
|---|---|
| `label` | Display name shown in the workspace summary card |
| `context.tags` | Optional shared tags passed to all child widgets as a hint |
| `slots[].satelliteId` | Must match a satellite `id` in the `satellites` array |
| `slots[].widgetId` | Any registered widget ID |
| `slots[].config` | Passed directly to the child widget as its `config` prop |

---

## Context prop

Every child widget receives a `workspaceContext` field injected into its `config`:

```typescript
config: {
  ...slotConfig,
  workspaceContext: {
    label: string   // e.g. "Robot Car"
    tags: string[]  // e.g. ["robot-car"]
  }
}
```

Satellites that want to participate in workspace filtering read this field and scope their data accordingly. Satellites that ignore it work fine too — context is a hint, not a requirement.

---

## Building a context-aware widget

To make your widget respond to workspace context:

```tsx
export function ProjectFocusWidget({ config, satelliteUrl }: WidgetProps) {
  const projectId = config.project_id as number
  const context = config.workspaceContext as { label: string; tags: string[] } | undefined

  // context?.label can be shown as a heading, used as a filter fallback, etc.
  // use project_id as the primary filter; context is supplementary

  // ...
}
```

No changes to the `WidgetProps` interface or widget registration are needed — the context arrives via `config`.

---

## Building your own composition satellite

`workspace-sat` is a reference implementation. You can build your own composition satellite with a different layout — a grid instead of swipe pages, a tabbed panel, a timeline view — by following the same pattern:

1. Create a Tier 2 widget component that accepts `renderWidget` from `WidgetProps`
2. Use `renderWidget(satelliteId, widgetId, config)` wherever you want to embed a child widget
3. Build the layout using `@homeport/ui` primitives (`Card`, `SwipeableCard`, etc.)
4. Register and deploy as a normal satellite

The hub provides `renderWidget` to every Tier 2 widget automatically — no special registration needed.
