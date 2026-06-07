# Contributing

## Development Setup

1. Install [pnpm](https://pnpm.io) (v9+) and Python 3.11+
2. Clone the repo:
   ```bash
   git clone https://github.com/sensokame/homeport
   cd homeport
   pnpm install
   ```
3. Start the hub in dev mode:
   ```bash
   pnpm --filter hub dev
   ```
   This starts the hub frontend on `http://localhost:5173`. The dev server proxies `/api` to `http://localhost:8000` and each satellite's remote entry to its dev port.

4. Start the hub backend:
   ```bash
   cd apps/hub/backend
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

5. Start a satellite's frontend (for widget development):
   ```bash
   pnpm --filter vikunja dev   # or infra, inventory, wger, actual, gcal
   ```
   Each satellite frontend runs on a dedicated port (5174–5180). The hub dev proxy picks them up automatically.

6. Start a satellite's backend:
   ```bash
   cd apps/infra/backend
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8080
   ```

## Project Structure

```
homeport/
├── packages/ui/        shared React component library (@homeport/ui)
├── apps/hub/           hub app (frontend + FastAPI backend)
├── apps/infra/         infrastructure satellite
├── apps/inventory/     inventory satellite
├── apps/obsidian/      knowledge satellite (Python backend only)
├── apps/vikunja/       tasks satellite (Python backend + React widgets)
├── apps/wger/          fitness satellite (Python backend + React widgets)
├── apps/actual/        budget satellite (Node.js + React)
└── apps/gcal/          calendar satellite (Node.js + React widgets)
```

See [Architecture](../architecture/index.md) for how the pieces fit together.

## Contributor mindset

homeport is open source. When adding features or designing interfaces, think from the perspective of an external contributor who doesn't know your specific setup:

- **Is the contract self-contained?** A satellite author shouldn't need to know internal hub details to implement `WidgetProps` correctly.
- **Are IDs and values generic?** Don't design config schemas that only make sense with specific service instances — use label-based or ID-based filtering so any deployment can use it.
- **Is it optional?** New first party satellites should be deployable independently. The hub works without them.
- **Does `@homeport/ui` provide the building blocks?** Custom UI should be composable from existing primitives before reaching for new ones.

## Adding a New Satellite

See [Building a Satellite](../satellites/building-a-satellite.md) for the full guide. In short:

1. Create `apps/<name>/` with a backend, React widget components, and a `Dockerfile`
2. Expose `GET /api/catalog` from the backend
3. Write widget components implementing `WidgetProps` from `@homeport/ui`
4. Configure module federation in `vite.config.ts` (`cssCodeSplit: false` is required)
5. Register in the hub: update `vite.config.ts`, `declarations.d.ts`, and `registry/index.ts`
6. Add a satellite entry and widget instances to `apps/hub/dashboard.json`
7. Add a doc page at `docs/satellites/<name>.md`

## Adding a Component to @homeport/ui

1. Create `packages/ui/src/components/MyComponent.tsx` and `MyComponent.module.css`
2. Export it from `packages/ui/src/components/index.ts`
3. Document it in `docs/ui/index.md`

## Commit Style

Use clear, imperative commit messages. GPG-sign commits:

```bash
git commit -S -m "add inventory shopping list endpoint"
```

## Building Docker Images

Each app has a multi-stage Dockerfile. Build from the monorepo root:

```bash
docker build -f apps/hub/Dockerfile -t homeport-hub .
```

The build context must be the repo root so the Dockerfile can access `packages/ui` and `tsconfig.base.json`.
