# Widget System

homeport's dashboard is built from **widgets** — self-contained React components that each satellite provides. The hub is a shell that arranges widgets into tabs according to `dashboard.json`. The widgets themselves own their data fetching, layout, and interactivity.

---

## Mental model

```
dashboard.json          widget registry         rendered hub
─────────────────       ─────────────────       ──────────────────
tab: Overview           vikunja.task-overview   ┌─ shell header ─┐
  widget:                 component ──────────► │ Tasks          │
    vikunja.task-overview satellite url         │ SwipeableCard  │
    satelliteId: vikunja  config: {}            │  home: summary │
    config: {}                                  │  pages: proj.  │
                                                └── open →  ─────┘
```

The hub only knows: *which widget goes where, and which satellite to talk to*. Everything else is the widget's concern.

---

## Interfaces

### WidgetProps

Every widget component receives these props:

```typescript
interface WidgetProps {
  config: Record<string, unknown>       // instance config from dashboard.json
  satelliteUrl: string                  // proxy base: /api/proxy/{satelliteId}
  publicUrl: string                     // public URL for "open →" links
  onStatusChange?: (status: 'ok' | 'warn' | 'error') => void
  onFocusRequest?: () => void           // call to enter hub focus mode
  isFocused?: boolean                   // true when hub is in focus mode for this widget
}
```

`satelliteUrl` is always a relative path (`/api/proxy/{id}`) — the hub backend proxies all calls so widgets never talk directly to internal Docker URLs.

`onStatusChange` drives the status dot in the widget shell header. Call it whenever your data changes: `'ok'` when everything is fine, `'warn'` when output needs attention, `'error'` when the widget cannot do its job.

`onFocusRequest` is only present in the normal grid. When defined, show a "focus →" trigger. When the user activates focus mode, the hub re-renders your widget full-screen with `isFocused: true`.

### WidgetComponent

A widget is a standard React component:

```typescript
type WidgetComponent = React.ComponentType<WidgetProps>
```

### ConfigField

Describes a configurable parameter a widget accepts:

```typescript
interface ConfigField {
  type: 'string' | 'number' | 'boolean'
  label: string
  required?: boolean
  default?: unknown
}
```

### WidgetManifest

Declares a widget to the registry:

```typescript
interface WidgetManifest {
  id: string                                // e.g. "vikunja.task-overview"
  name: string                              // shown in shell header + settings drawer
  description: string
  configSchema: Record<string, ConfigField> // empty object if no config needed
  component: WidgetComponent
  fullScreen?: boolean                      // true → hub renders widget without shell wrapper
  defaultIcon?: string                      // icon name from hub ICON_MAP; used when config.icon not set
}
```

---

## SwipeableCard

`SwipeableCard` is the standard shell for widgets that have a home view and detail pages. It is content-only — the hub shell provides the card border, header, and footer.

```typescript
interface SwipeableCardProps {
  home: React.ReactNode        // always-visible first panel
  pages?: React.ReactNode[]    // additional panels, navigated by swipe or dot click
}
```

Usage:

```tsx
<SwipeableCard
  home={<TaskSummaryPanel tasks={inProgress} />}
  pages={projects.map(p => (
    <ProjectPanel key={p.id} project={p} tasks={tasksByProject[p.id]} />
  ))}
/>
```

Navigation: swipe left/right, dot indicators, `← home` button. Do not nest `SwipeableCard` inside another `SwipeableCard`'s pages — gesture conflicts will break navigation.

---

## dashboard.json

The hub reads `dashboard.json` on startup. Changes to tabs and widget instances can be made through the settings drawer (⚙ in the tab bar) — they are saved back to the file automatically.

```json
{
  "version": 2,
  "satellites": [
    {
      "id": "vikunja",
      "url": "http://vikunja.station",
      "widgetUrl": "http://vikunja-sat:8080"
    }
  ],
  "tabs": [
    {
      "id": "overview",
      "label": "Overview",
      "widgets": [
        {
          "instanceId": "tasks-overview",
          "widgetId": "vikunja.task-overview",
          "satelliteId": "vikunja",
          "config": {}
        },
        {
          "instanceId": "rc-tasks",
          "widgetId": "vikunja.project-focus",
          "satelliteId": "vikunja",
          "config": { "project_id": 6 }
        }
      ]
    }
  ]
}
```

| Field | Description |
|---|---|
| `satellites[].id` | Unique identifier, referenced by widget instances |
| `satellites[].url` | Public URL used for "open →" links |
| `satellites[].widgetUrl` | Internal Docker URL — stripped before sending to browser |
| `tabs[].id` | URL-safe tab identifier |
| `tabs[].label` | Display label in the tab bar |
| `widgets[].instanceId` | Unique per-instance ID — allows multiple instances of the same widget |
| `widgets[].widgetId` | References a registered widget manifest |
| `widgets[].satelliteId` | References a satellite entry above |
| `widgets[].config` | Passed as `config` prop to the widget component |

You can have **multiple instances of the same widget** with different configs — for example two `vikunja.project-focus` widgets on different tabs, each showing a different project.

---

## Widget registry

The registry maps `widgetId → WidgetManifest`. Satellite widgets are loaded at runtime via **module federation** — each satellite exposes a `remoteEntry.js`. The hub fetches and mounts it without a rebuild.

```typescript
// apps/hub/src/registry/index.ts
import { lazy } from 'react'
import type { WidgetManifest } from '@homeport/ui'
import { ClockWidget } from '../widgets/builtin/ClockWidget'

const TaskOverviewWidget = lazy(() => import('vikunja/TaskOverviewWidget'))
const ProjectFocusWidget = lazy(() => import('vikunja/ProjectFocusWidget'))

export const registry: Record<string, WidgetManifest> = {
  'builtin.clock': {
    id: 'builtin.clock',
    name: 'Clock',
    description: 'Current time display',
    configSchema: {},
    component: ClockWidget,
    defaultIcon: 'clock',
  },
  'vikunja.task-overview': {
    id: 'vikunja.task-overview',
    name: 'Tasks',
    description: 'All open tasks with per-project pages',
    configSchema: {},
    component: TaskOverviewWidget,
    defaultIcon: 'check-square',
  },
  'vikunja.project-focus': {
    id: 'vikunja.project-focus',
    name: 'Project Focus',
    description: 'Tasks for a single project',
    configSchema: {
      project_id: { type: 'number', label: 'Project ID', required: true },
    },
    component: ProjectFocusWidget,
    defaultIcon: 'folder',
  },
}
```

---

## Hub shell

The hub wraps every non-`fullScreen` widget in a **shell** that provides consistent chrome:

- **Top** — status dot + icon + `manifest.name` (hub-controlled; icon resolves `config.icon ?? manifest.defaultIcon`)
- **Middle** — the widget component (satellite-controlled; can be a `SwipeableCard`, a plain div, anything)
- **Bottom** — `open →` link to `publicUrl` (hub-controlled)

Widgets receive `onStatusChange` from the shell. Call it to drive the status dot.

### fullScreen mode

Set `fullScreen: true` in `WidgetManifest` to opt out of the shell entirely. The hub renders the component directly with no wrapper. Use this only when the widget manages its own chrome. Most widgets should leave it unset.

---

## Focus mode

Focus mode hides the hero bar, tab bar, and widget grid, and renders one widget full-screen.

A widget participates in focus mode by:

1. Showing a trigger when `onFocusRequest` is defined (normal grid view)
2. Rendering a rich full-screen view when `isFocused` is `true`

```tsx
export function MyWidget({ satelliteUrl, onFocusRequest, isFocused }: WidgetProps) {
  if (isFocused) {
    return <div className={styles.focusedView}>…</div>
  }
  return (
    <div className={styles.normalView}>
      {onFocusRequest && (
        <button onClick={onFocusRequest}>focus →</button>
      )}
    </div>
  )
}
```

---

## Widget naming convention

Widget IDs follow `<satellite>.<widget-name>` — all lowercase, hyphen-separated:

```
builtin.clock
vikunja.task-overview
vikunja.project-focus
infra.overview
inventory.overview
knowledge.reading
fitness.overview
budget.overview
calendar.overview
```

---

## Built-in widget IDs

| Widget ID | Satellite | Description |
|---|---|---|
| `builtin.clock` | (none) | Current time |
| `vikunja.task-overview` | `vikunja` | All tasks with per-project swipe pages |
| `vikunja.project-focus` | `vikunja` | Tasks for one project (requires `project_id` in config) |
| `infra.overview` | `infra` | Container status, CPU/RAM/disk |
| `inventory.overview` | `inventory` | Stock overview and project needs |
| `knowledge.reading` | `knowledge` | Currently reading books + Obsidian notes |
| `fitness.overview` | `wger` | Workout status and nutrition log |
| `budget.overview` | `budget` | Monthly spend vs. budgeted |
| `calendar.overview` | `gcal` | Current calendar block with trade acknowledgment |

---

## Roadmap

| Phase | What shipped | Status |
|---|---|---|
| 1 | `WidgetManifest`, `WidgetComponent`, `WidgetProps`, `SwipeableCard` | ✅ v0.6.0 |
| 2 | `dashboard.json`, static registry, tab bar, proxy endpoint | ✅ v0.7.0 |
| 3 | Vikunja widgets (`task-overview`, `project-focus`) as proof of concept | ✅ v0.7.0 |
| 4 | `WidgetShell` — hub wraps every widget with status/icon header + `open →` footer | ✅ v0.8.0 |
| 5 | Module federation — each satellite ships `remoteEntry.js`; hub loads at runtime | ✅ v0.8.0 |
| 6 | Dashboard management UI — add from catalog, create/rename/delete tabs, drag-and-drop | ✅ v0.9.0 |
| 7 | Focus mode — full-screen widget rendering with `onFocusRequest`/`isFocused` props | ✅ v0.9.0 |
| 8 | PWA manifest + swipe tab switching (Lenovo P12 panel) | ✅ v1.0.0 |
