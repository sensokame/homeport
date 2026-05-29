## homeport v0.1.0

First release. A self-hosted personal hub that aggregates independent satellite services into a single dashboard — no lock-in, no domain logic.

---

### What's included

**Hub**
- Card grid dashboard — live widget cards for first-party satellites, link cards for third-party tools
- Reads `satellites.json` at runtime — add or remove services without rebuilding
- Server-side widget fetching — satellites stay off the public internet
- Auto-refreshes every 30 seconds

**Infrastructure satellite**
- Live container status, CPU, RAM, disk per container
- Container detail view — ports, mounts, networks, live stats
- Actions: start, stop, restart, redeploy per container and per group
- Restart all / Update all (pull + recreate only changed images)

**Inventory satellite**
- Equipment and project tracker with SQLite storage
- Items with category, quantity, location, status, and restock threshold
- Project assignments with reserved quantities
- Shopping list — items at or below threshold, or marked as needed/depleted/ordered

**Knowledge satellite**
- Currently-reading books via Goodreads public RSS feed
- Falls back to Obsidian vault frontmatter (`status: reading`) when Goodreads is unavailable
- Active notes count (vault files modified in the last 7 days)

**Tasks satellite**
- Wraps a self-hosted Vikunja instance
- Shows tasks due today, overdue count, and project list

**Fitness satellite**
- Wraps a self-hosted wger instance
- Shows today's workout status (scheduled / logged / rest day), active routine, and meals logged

**Budget satellite**
- Wraps a self-hosted Actual Budget instance
- Shows monthly spend vs. budgeted across expense categories, and flags over-budget categories

---

### Docker images

All images are published to the GitHub Container Registry:

```
ghcr.io/sensokame/homeport-hub:0.1.0
ghcr.io/sensokame/homeport-infra:0.1.0
ghcr.io/sensokame/homeport-inventory:0.1.0
ghcr.io/sensokame/homeport-obsidian:0.1.0
ghcr.io/sensokame/homeport-vikunja:0.1.0
ghcr.io/sensokame/homeport-wger:0.1.0
ghcr.io/sensokame/homeport-actual:0.1.0
```

See the [Getting Started guide](https://sensokame.github.io/homeport/getting-started/) for deployment instructions.

---

### Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | React + TypeScript + Vite |
| Shared UI | `@homeport/ui` — React components + CSS tokens |
| Backend | FastAPI (Python) or Node.js per satellite |
| Database | SQLite per data-bearing satellite |
