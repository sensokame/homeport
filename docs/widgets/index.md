# Widget System

homeport's dashboard is built from **widgets** — self-contained React components that each satellite provides. The hub is a shell that arranges widgets into tabs according to a config file. The widgets themselves own their data fetching, layout, and interactivity.

---

## Mental model

```
dashboard.json          widget registry         rendered hub
─────────────────       ─────────────────       ─────────────────
tab: Overview           vikunja.overview   ──►  SwipeableCard
  widget:                 component              ├── home: all tasks
    vikunja.overview      satelliteUrl           └── pages: per project
    satelliteId: vikunja
    config: {}

tab: Overview           vikunja.project    ──►  Card
  widget:                 component              └── RC tasks only
    vikunja.project       satelliteUrl
    satelliteId: vikunja
    config: { project_id: 6 }
```

The hub only knows: *which widget goes where, and which satellite to talk to*. Everything else is the widget's concern.

---

## Interfaces

### WidgetProps

Every widget component receives these props:

```typescript
interface WidgetProps {
  config: Record<string, unknown>  // instance config from dashboard.json
  satelliteUrl: string             // proxy base URL: /api/proxy/{satelliteId}
  publicUrl: string                // public URL for "open →" links
  renderWidget: (
    satelliteId: string,
    widgetId: string,
    config: Record<string, unknown>
  ) => React.ReactNode             // hub-injected; use to compose other widgets
}
```

The hub always injects all four props. Widgets that don't compose others simply ignore `renderWidget`.

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
  name: string                              // display name in settings drawer
  description: string
  configSchema: Record<string, ConfigField> // empty object if no config needed
  component: WidgetComponent
}
```

---

## SwipeableCard

`SwipeableCard` is an optional shell from `@homeport/ui` for widgets that have a home view and detail pages. Widgets that have nothing to swipe to can render a plain `<Card>` instead.

```typescript
interface SwipeableCardProps {
  home: React.ReactNode       // always visible first
  pages?: React.ReactNode[]   // additional pages, navigated by swipe or dot click
  status?: 'ok' | 'warn' | 'error'
}
```

Usage:

```tsx
<SwipeableCard
  status="ok"
  home={<TaskOverviewCard tasks={inProgressTasks} />}
  pages={projects.map(p => (
    <ProjectCard key={p.id} project={p} tasks={tasksByProject[p.id]} />
  ))}
/>
```

**Pages are just React nodes.** A page can be a single `<Card>`, a row of cards, a list, a chart — anything. The `SwipeableCard` shell handles navigation (swipe gesture, dot indicators, home button). The cards themselves know nothing about swiping.

**Do not nest `SwipeableCard` inside a page.** Gesture conflicts make the UX unusable. If a page needs deeper navigation, use expand/collapse or a separate route.

### Navigation UX

- Dot indicators at the bottom show current position (home + N pages)
- Swipe left/right or click dots to navigate
- A home button (visible on any detail page) returns to the home view

---

## Widget composition

Any Tier 2 widget can render other widgets inside itself using the `renderWidget` prop the hub injects. The hub handles all loading — whether the child is a Tier 1 data widget or a Tier 2 React component — so the composing widget never needs to know the difference.

```tsx
export function WorkspacePanelWidget({ config, renderWidget }: WidgetProps) {
  const slots = config.slots as Array<{
    satelliteId: string
    widgetId: string
    config: Record<string, unknown>
  }>

  return (
    <SwipeableCard
      home={<WorkspaceSummaryCard label={config.label as string} />}
      pages={slots.map((slot, i) => (
        <div key={i}>
          {renderWidget(slot.satelliteId, slot.widgetId, slot.config)}
        </div>
      ))}
    />
  )
}
```

**Rules:**
- `renderWidget` is synchronous from the caller's perspective — the hub handles async loading and error boundaries internally
- Do not nest `SwipeableCard` inside a rendered child widget's page — see the SwipeableCard section below
- The child widget receives its own `satelliteUrl`, `publicUrl`, and `renderWidget` props normally — composition can be arbitrarily deep, though more than two levels is rarely useful

**The workspace satellite** (`workspace-sat`) is a first party optional satellite that ships with homeport and is built entirely around this pattern. See [Workspace](../satellites/workspace.md) for details.

---

## dashboard.json

Replaces `satellites.json` as the hub's config file. Defines satellite connection details, tabs, and widget instances.

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
          "instanceId": "homeport-tasks",
          "widgetId": "vikunja.project-focus",
          "satelliteId": "vikunja",
          "config": { "project_id": 2 }
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
| `satellites[].widgetUrl` | Internal URL the hub backend uses for API calls |
| `tabs[].id` | URL-safe tab identifier |
| `tabs[].label` | Display label in the tab bar |
| `widgets[].instanceId` | Unique per-instance ID (allows multiple instances of the same widget) |
| `widgets[].widgetId` | References a registered widget manifest |
| `widgets[].satelliteId` | References a satellite entry above |
| `widgets[].config` | Passed as `config` prop to the widget component |

You can have **multiple instances of the same widget** with different configs — for example two `vikunja.project-focus` widgets on the same tab, each showing a different project.

---

## Widget registry

The registry maps `widgetId → WidgetManifest`. Currently implemented as a static map in the hub (all widgets bundled at build time). The interface is identical to what a dynamic federation loader would consume.

```typescript
// apps/hub/src/registry/index.ts
import { TaskOverviewWidget } from '@homeport/vikunja-widgets'
import { ProjectFocusWidget } from '@homeport/vikunja-widgets'

export const registry: Record<string, WidgetManifest> = {
  'vikunja.task-overview': {
    id: 'vikunja.task-overview',
    name: 'Task Overview',
    description: 'All in-progress tasks across projects',
    configSchema: {},
    component: TaskOverviewWidget,
  },
  'vikunja.project-focus': {
    id: 'vikunja.project-focus',
    name: 'Project Focus',
    description: 'Tasks for a single project',
    configSchema: {
      project_id: { type: 'number', label: 'Project ID', required: true },
    },
    component: ProjectFocusWidget,
  },
}
```

---

## Building a widget

### 1. Create the component

```tsx
// apps/vikunja/src/widgets/TaskOverviewWidget.tsx
import { useEffect, useState } from 'react'
import { SwipeableCard, Card } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'

export function TaskOverviewWidget({ satelliteUrl, publicUrl, config, renderWidget }: WidgetProps) {
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    fetch(`${satelliteUrl}/api/tasks`)
      .then(r => r.json())
      .then(setTasks)
  }, [satelliteUrl])

  const inProgress = tasks.filter(t => !t.done)
  const byProject = groupByProject(inProgress)

  return (
    <SwipeableCard
      home={<TaskSummaryCard tasks={inProgress} />}
      pages={Object.entries(byProject).map(([project, tasks]) => (
        <ProjectCard key={project} project={project} tasks={tasks} />
      ))}
    />
  )
}
```

### 2. Register the manifest

```typescript
// apps/hub/src/registry/index.ts
import { TaskOverviewWidget } from '../../vikunja/src/widgets/TaskOverviewWidget'

export const registry = {
  'vikunja.task-overview': {
    id: 'vikunja.task-overview',
    name: 'Task Overview',
    description: 'All in-progress tasks across projects',
    configSchema: {},
    component: TaskOverviewWidget,
  },
}
```

### 3. Add an instance to dashboard.json

```json
{
  "instanceId": "tasks-main",
  "widgetId": "vikunja.task-overview",
  "satelliteId": "vikunja",
  "config": {}
}
```

---

## Widget naming convention

Widget IDs follow `<satellite>.<widget-name>` — all lowercase, hyphen-separated:

```
vikunja.task-overview
vikunja.project-focus
infra.container-health
infra.resource-usage
inventory.stock-summary
wger.workout-today
actual.budget-overview
actual.category-breakdown
```

---

## Hub shell

The hub wraps every widget in a **shell** that provides the standard chrome:

- **Top** — status dot + icon + widget name (hub-controlled; icon comes from `config.icon` in `dashboard.json`, status from `GET /widget`)
- **Middle** — the widget component itself (satellite-controlled; can be a `SwipeableCard`, a plain `Card`, a chart, anything)
- **Bottom** — `open →` link to the satellite's public URL (hub-controlled)

This keeps widget components focused on data and layout — they never need to render status indicators or open links themselves.

### Opting out — `fullScreen` mode

A widget can opt out of the hub shell entirely by setting `fullScreen: true` in its `WidgetManifest`. The hub renders it without any wrapper:

```typescript
export const manifest: WidgetManifest = {
  id: 'my-satellite.full-widget',
  name: 'Full Widget',
  fullScreen: true,   // hub renders nothing around this widget
  // ...
}
```

Use `fullScreen` only when the widget needs to own its own title, status presentation, or navigation chrome — for example a widget that already includes a `SwipeableCard` with custom header and footer. Most widgets should leave this unset.

> **Not yet implemented.** The shell and `fullScreen` flag are part of the planned Phase 4 refactor. Currently the hub renders widgets directly with no wrapper.

---

## Roadmap

| Phase | What ships | Status |
|---|---|---|
| **1** | `WidgetManifest`, `WidgetComponent`, `WidgetProps` interfaces in `@homeport/ui`; `SwipeableCard` component | ✅ Done |
| **2** | Hub refactored: `dashboard.json` config, static widget registry, tab bar, settings drawer, proxy endpoint | ✅ Done |
| **3** | Vikunja satellite migrated: `task-overview` and `project-focus` widgets as proof of concept | ✅ Done |
| **4** | Hub shell: wraps every widget with status/icon header + `open →` footer; `fullScreen` flag lets widgets opt out; all remaining satellites migrated | 🔲 Next |
| **5** | Module federation: each satellite ships `manifest.json` + `remoteEntry.js`; hub discovers and loads widgets at runtime without rebuild | 🔲 |
| **6** | `workspace-sat`: first party optional satellite; `renderWidget` prop on hub; workflow widgets that compose other widgets into a project-scoped swipeable view | 🔲 |
