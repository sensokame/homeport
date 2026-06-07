# Satellites

Satellites are the services homeport aggregates. Each is a standalone Docker container with its own UI and API.

- **[Hub](hub.md)** — `dashboard.json` format, env vars, API reference
- **[Building a Satellite](building-a-satellite.md)** — how to create your own satellite
- **[Infrastructure](infra.md)** — Docker monitoring, system metrics, container actions
- **[Inventory](inventory.md)** — equipment and project tracker, data model, API reference
- **[Knowledge](knowledge.md)** — currently-reading books (Goodreads) + active Obsidian notes
- **[Tasks](vikunja.md)** — Vikunja wrapper; due today, overdue, project count
- **[Fitness](wger.md)** — wger wrapper; workout schedule and nutrition logging
- **[Budget](actual.md)** — Actual Budget wrapper; monthly spend vs. budgeted

---

## Adding a third-party service

Any service with a URL can be included in homeport. If the service has no widget component, add a satellite entry to `dashboard.json` and use `builtin.clock` as a placeholder, or just omit widgets and use the public URL as a navigation target.

To add a proper interactive widget for a third-party service, see [Building a Satellite](building-a-satellite.md).
