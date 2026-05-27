# UI Library

`@homeport/ui` is the shared React component library used by the hub and all first-party satellites. It provides a consistent dark-theme design system.

---

## Installation

Already available in the monorepo via pnpm workspaces:

```ts
import { Button, Card, NavBar } from '@homeport/ui'
import '@homeport/ui/tokens.css'
```

---

## Design tokens

Defined in `tokens.css` as CSS custom properties. Import once at your app root.

**Colors**

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#0d1117` | Page background |
| `--color-surface` | `#161b22` | Card / panel background |
| `--color-border` | `#30363d` | Borders |
| `--color-text` | `#e6edf3` | Primary text |
| `--color-muted` | `#8b949e` | Secondary text, labels |
| `--color-link` | `#58a6ff` | Links |

**Status**

| Token | Value |
|---|---|
| `--color-ok` | `#3fb950` |
| `--color-warn` | `#e3b341` |
| `--color-error` | `#f85149` |

**Spacing** — 4px base scale: `--space-1` (4px) through `--space-8` (48px)

**Typography** — `--text-xs` through `--text-xl`, `--font-mono`

**Shape** — `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px)

---

## Components

### NavBar

Top bar with hostname label and optional navigation links.

```tsx
<NavBar hostname="station" links={[
  { label: 'Inventory', href: '/', active: true },
  { label: 'Projects',  href: '/projects' },
]} />
```

| Prop | Type | Description |
|---|---|---|
| `hostname` | `string` | Label shown on the left |
| `links` | `NavLink[]` | Optional nav links |

### Card

Base surface card. Accepts an optional status border tint and click handler.

```tsx
<Card status="warn" onClick={() => {}}>
  content
</Card>
```

| Prop | Type | Description |
|---|---|---|
| `status` | `ok \| warn \| error` | Tints the left border |
| `onClick` | `() => void` | Makes the card clickable |
| `children` | `ReactNode` | Card content |

### WidgetCard

Renders a satellite widget: status dot, title, summary, metrics, and an "open →" link.

```tsx
<WidgetCard data={widgetData} url="http://infra.station" />
```

`data` follows the [widget protocol](architecture.md#widget-protocol).

### LinkCard

Satellite with no widget data — name and "open →" link only.

```tsx
<LinkCard name="Notes" url="http://quartz.station" description="Obsidian vault" />
```

### StatusDot

Colored indicator dot.

```tsx
<StatusDot status="ok" />
```

Accepts `ok`, `warn`, `error`, or `unknown`.

### MetricBar

Label + value + progress bar. Color shifts green → yellow → red by percentage.

```tsx
<MetricBar label="RAM" value="6.2 GB / 16 GB" percent={39} />
```

### Badge

Colored pill label for status values and categories.

```tsx
<Badge label="active" variant="ok" />
<Badge label="depleted" variant="error" />
```

Variants: `ok`, `warn`, `error`, `default`.

### Button

```tsx
<Button variant="primary">Save</Button>
<Button variant="danger" size="sm">Delete</Button>
<Button variant="ghost">Cancel</Button>
```

| Prop | Values | Default |
|---|---|---|
| `variant` | `primary`, `danger`, `ghost` | `primary` |
| `size` | `default`, `sm` | `default` |

All other `<button>` HTML attributes are forwarded.

### Modal

Centered overlay with a close button.

```tsx
<Modal title="Add item" onClose={() => setOpen(false)}>
  <form>…</form>
</Modal>
```

### Input, Select, Textarea

Styled form primitives.

```tsx
<Input placeholder="Item name" />
<Select value={val} onChange={…}>
  <option value="pcs">pcs</option>
</Select>
<Textarea rows={3} />
```
