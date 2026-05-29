# Satellites

Satellites are the services homeport aggregates. Each is a standalone Docker container with its own UI and API.

- **[Hub](hub.md)** — configuration, satellites.json format, env vars, API reference
- **[Infrastructure](infra.md)** — Docker monitoring, system metrics, container actions
- **[Inventory](inventory.md)** — equipment and project tracker, data model, API reference
- **[Knowledge](knowledge.md)** — currently-reading books (Goodreads) + active Obsidian notes
- **[Tasks](vikunja.md)** — Vikunja wrapper; due today, overdue, project count
- **[Fitness](wger.md)** — wger wrapper; workout schedule and nutrition logging
- **[Budget](actual.md)** — Actual Budget wrapper; monthly spend vs. budgeted

## Adding a third-party satellite

Any service with a URL can be a satellite. No code needed — just add an entry without `widget_url` to `satellites.json`:

```json
{
  "id": "notes",
  "name": "Notes",
  "url": "http://quartz.station",
  "icon": "book"
}
```

The hub renders a link card. See the [widget protocol](../architecture/index.md#widget-protocol) docs for the full spec if you want live data on the card.
