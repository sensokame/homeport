# Building a Satellite

A satellite is a standalone Docker container that plugs into the homeport hub. It provides:

1. **A backend API** — serves data to its widget components and (optionally) its own full-page UI
2. **One or more widget components** — React components that run in the hub's browser context
3. **A catalog endpoint** — tells the hub what widgets it offers

This guide walks through creating a satellite from scratch.

---

## The hub + satellite contract

The hub and satellites communicate in two ways:

```
browser ──► hub frontend ──► hub backend ──► satellite backend
                │                                   │
                │  (module federation)               │
                └── satellite widgets ◄─────────────┘
                        │
                        └── fetches via /api/proxy/{id}/...
```

1. **Widget loading**: the hub fetches `GET /api/remote/{id}/assets/remoteEntry.js` (served by the hub backend, which proxies to the satellite's `widgetUrl`). This loads the satellite's React widget components into the hub's page via module federation.

2. **API calls**: widget components fetch data using relative URLs like `/api/proxy/{satelliteId}/api/tasks`. The hub backend proxies these to `{widgetUrl}/api/tasks`.

The satellite's `widgetUrl` (internal Docker URL) never reaches the browser. Only the hub backend communicates with it server-to-server.

---

## Directory structure

```
apps/<name>/
├── backend/
│   ├── main.py          FastAPI app (or Node.js server.js)
│   └── requirements.txt
├── src/
│   ├── widgets/
│   │   ├── MyWidget.tsx          widget component
│   │   ├── MyWidget.entry.ts     federation entry point
│   │   └── MyWidget.module.css
│   ├── main.tsx                  satellite's own full-page app (optional)
│   └── App.tsx
├── vite.config.ts
├── package.json
└── Dockerfile
```

---

## Backend

The satellite backend must expose two endpoints. Everything else is up to you.

### GET /api/catalog

Returns the list of widgets this satellite offers. The hub aggregates all satellites' catalogs for its "Add widget" dialog.

```python
@app.get("/api/catalog")
def catalog():
    return {
        "widgets": [
            {
                "id": "mysatellite.overview",
                "name": "My Widget",
                "description": "A one-line description",
                "configSchema": {}
            }
        ]
    }
```

`configSchema` uses the same format as `WidgetManifest.configSchema` in `@homeport/ui` — an object of `{ type, label, required? }` entries.

### GET /assets/remoteEntry.js (served by Vite build)

The module federation entry point. Vite generates this automatically from your `vite.config.ts`. The hub's backend proxies requests for it.

### Everything else

Add whatever API endpoints your widget needs. Widget components fetch them via `satelliteUrl`:

```typescript
// in your widget component
fetch(`${satelliteUrl}/api/data`)
```

which the hub proxies to `{widgetUrl}/api/data`.

---

## Widget component

```tsx
// src/widgets/MyWidget.tsx
import { useEffect, useState } from 'react'
import type { WidgetProps } from '@homeport/ui'
import styles from './MyWidget.module.css'

interface MyData { summary: string; count: number }

export function MyWidget({ satelliteUrl, onStatusChange }: WidgetProps) {
  const [data, setData] = useState<MyData | null>(null)

  useEffect(() => {
    fetch(`${satelliteUrl}/api/data`)
      .then(r => r.json())
      .then((d: MyData) => {
        setData(d)
        onStatusChange?.('ok')
      })
      .catch(() => onStatusChange?.('error'))
  }, [satelliteUrl])

  if (!data) return null
  return (
    <div className={styles.panel}>
      <p>{data.summary}</p>
    </div>
  )
}
```

Create a federation entry file alongside it:

```typescript
// src/widgets/MyWidget.entry.ts
export { MyWidget as default } from './MyWidget'
```

---

## Vite config

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'mysatellite',
      filename: 'remoteEntry.js',
      exposes: {
        './MyWidget': './src/widgets/MyWidget.entry',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.3.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.3.0' },
      },
    }),
  ],
  resolve: {
    alias: { '@homeport/ui': resolve(__dirname, '../../packages/ui/src') },
  },
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,   // required — federation runtime won't load split CSS files
  },
})
```

`cssCodeSplit: false` is required. Vite's default splits CSS into separate chunks that the federation runtime won't load, resulting in missing styles.

---

## Register with the hub

Three files in `apps/hub/` need updating to add a new satellite:

### 1. vite.config.ts — add the remote

```typescript
federation({
  remotes: {
    // ... existing remotes ...
    mysatellite: '/api/remote/mysatellite/assets/remoteEntry.js',
  },
})
```

### 2. src/declarations.d.ts — declare the module

```typescript
declare module 'mysatellite/MyWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}
```

### 3. src/registry/index.ts — add the manifest

```typescript
const MyWidget = lazy(() => import('mysatellite/MyWidget'))

export const registry = {
  // ... existing entries ...
  'mysatellite.overview': {
    id: 'mysatellite.overview',
    name: 'My Widget',
    description: 'A one-line description',
    configSchema: {},
    component: MyWidget,
    defaultIcon: 'package',
  },
}
```

Rebuild the hub after these changes.

---

## Add to dashboard.json

```json
{
  "satellites": [
    { "id": "mysatellite", "url": "http://mysatellite.station", "widgetUrl": "http://mysatellite:8080" }
  ],
  "tabs": [
    {
      "id": "overview",
      "label": "Overview",
      "widgets": [
        { "instanceId": "my-main", "widgetId": "mysatellite.overview", "satelliteId": "mysatellite", "config": {} }
      ]
    }
  ]
}
```

Alternatively, use the hub's "Add widget" settings drawer after deploying your satellite — it reads the catalog automatically.

---

## Dockerfile

Satellites serve both their frontend and backend from port 8080. The Dockerfile uses a multi-stage build: compile the frontend, then serve it alongside the FastAPI backend with nginx.

See any first-party satellite's `Dockerfile` as a template. The build context must be the monorepo root:

```bash
docker build -f apps/mysatellite/Dockerfile -t homeport-mysatellite .
```

---

## Icons

The hub resolves `config.icon` (from `dashboard.json`) and falls back to `manifest.defaultIcon`. Icons come from the hub's `ICON_MAP` in `apps/hub/src/utils/icons.tsx`. When adding a new satellite, pick the closest existing icon name or add a new entry to `ICON_MAP`.

---

## Checklist

- [ ] Backend exposes `GET /api/catalog` with widget list
- [ ] Widget component implements `WidgetProps` from `@homeport/ui`
- [ ] Entry file exports the component as default
- [ ] `vite.config.ts` sets `cssCodeSplit: false` and exposes the entry
- [ ] Hub `vite.config.ts` declares the remote
- [ ] Hub `declarations.d.ts` declares the module
- [ ] Hub `registry/index.ts` adds the manifest with `lazy(() => import(...))`
- [ ] Hub rebuilt and redeployed
- [ ] Satellite entry added to `dashboard.json`
