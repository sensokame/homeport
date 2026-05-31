# Satellites

Satellites are the services homeport aggregates. Each is a standalone Docker container with its own UI and API.

- **[Hub](hub.md)** — dashboard.json format, env vars, API reference
- **[Workspace](workspace.md)** — first party optional satellite; workflow widgets that compose multiple satellite widgets into a project-scoped view
- **[Infrastructure](infra.md)** — Docker monitoring, system metrics, container actions
- **[Inventory](inventory.md)** — equipment and project tracker, data model, API reference
- **[Knowledge](knowledge.md)** — currently-reading books (Goodreads) + active Obsidian notes
- **[Tasks](vikunja.md)** — Vikunja wrapper; due today, overdue, project count
- **[Fitness](wger.md)** — wger wrapper; workout schedule and nutrition logging
- **[Budget](actual.md)** — Actual Budget wrapper; monthly spend vs. budgeted

## Adding a third-party service

Any service with a URL can be added to the hub as a link card. Add an entry to `dashboard.json` with a satellite definition and a `legacy.widget` instance — omit `widgetUrl` if you only want an "open →" link (the hub will show a placeholder card):

```json
{
  "satellites": [
    { "id": "notes", "url": "http://quartz.station", "widgetUrl": "http://quartz:8080" }
  ],
  "tabs": [
    {
      "id": "overview",
      "label": "Overview",
      "widgets": [
        { "instanceId": "notes-main", "widgetId": "legacy.widget", "satelliteId": "notes", "config": { "icon": "book" } }
      ]
    }
  ]
}
```

See [Widget System](../widgets/index.md) for the full widget architecture.
