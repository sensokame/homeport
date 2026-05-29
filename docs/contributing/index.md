# Contributing

## Development Setup

1. Install [pnpm](https://pnpm.io) (v9+) and Python 3.11+
2. Clone the repo:
   ```bash
   git clone https://github.com/sensokame/homeport
   cd homeport
   pnpm install
   ```
3. Start any app in dev mode:
   ```bash
   # hub frontend (hot reload)
   pnpm --filter hub dev

   # infra frontend
   pnpm --filter infra dev

   # inventory frontend
   pnpm --filter inventory dev
   ```
4. Run the backend for a satellite:
   ```bash
   cd apps/infra/backend
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8080
   ```

## Project Structure

```
homeport/
├── packages/ui/        shared React component library
├── apps/hub/           hub app (frontend + backend)
├── apps/infra/         infrastructure satellite
├── apps/inventory/     inventory satellite
├── apps/obsidian/      knowledge satellite (Python only)
├── apps/vikunja/       tasks satellite (Python only)
├── apps/wger/          fitness satellite (Python only)
└── apps/actual/        budget satellite (Node.js + React)
```

See [Architecture](../architecture/index.md) for how the pieces fit together.

## Adding a New Satellite

1. Create `apps/<name>/` with the standard structure:
   ```
   apps/<name>/
   ├── backend/main.py        FastAPI app with GET /widget
   ├── src/                   React frontend
   ├── Dockerfile
   └── docker-compose.yml
   ```
2. Implement the [widget protocol](../architecture/index.md#widget-protocol)
3. Add to `apps/hub/satellites.json`
4. Add a doc page at `docs/satellites/<name>.md`

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

The build context must be the repo root (`..`) so the Dockerfile can access `packages/ui` and `tsconfig.base.json`.
