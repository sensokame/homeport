# Tasks Satellite

Wraps a self-hosted [Vikunja](https://vikunja.io) instance. Shows tasks due today, overdue tasks, project count, and blocked items.

---

## Features

- Tasks due today and overdue count
- Project list with blocked-item counts
- Blocked task summary via the `waiting` label
- `GET /widget` — live summary for the hub

---

## Widget response

```json
{
  "title": "Tasks",
  "status": "warn",
  "summary": "2 due today · 1 overdue",
  "metrics": [
    { "label": "Due today", "value": 2 },
    { "label": "Overdue",   "value": 1, "alert": true },
    { "label": "Projects",  "value": 5 }
  ]
}
```

Status: `ok` if no overdue tasks, `warn` if any overdue, `error` if Vikunja is unreachable.

---

## Waiting / blocked tasks

Tasks labelled **`waiting`** in Vikunja represent work that is blocked on an external dependency (e.g. hardware delivery, another task completing). The task description states what is being waited for.

```
Title:       Flash Scoppy firmware to Pico
Label:       waiting
Description: waiting for: SMD hook clips
```

The satellite surfaces these in two ways:

1. **Widget metric** — a `Blocked` counter appears alongside due/overdue when any `waiting` tasks exist.
2. **`GET /api/blocked`** — returns all `waiting`-labelled tasks grouped by project, for richer widget views.

```json
{
  "blocked": [
    {
      "project": "Scoppy",
      "count": 3,
      "tasks": [
        { "id": 14, "title": "Flash Scoppy firmware to Pico", "waiting_for": "SMD hook clips" },
        { "id": 15, "title": "Verify signal with known source", "waiting_for": "SMD hook clips" },
        { "id": 16, "title": "Print and assemble case",        "waiting_for": "SMD hook clips + case design complete" }
      ]
    }
  ]
}
```

The `waiting_for` value is parsed from the task description line `waiting for: <value>`. Tasks without that line still appear in the blocked list but with `"waiting_for": null`.

---

## Vikunja API quirks

### Labels are not applied during task creation

The `labels` field in `PUT /api/v1/projects/{id}/tasks` is **silently ignored**. Labels must be applied after creation via a separate call:

```bash
# Create task first
curl -X PUT .../projects/9/tasks -d '{"title": "Flash firmware"}'
# → returns { "id": 14, ... }

# Then apply the label
curl -X PUT .../tasks/14/labels -d '{"label_id": 1}'
```

### The bulk `/tasks` endpoint includes labels when applied

`GET /api/v1/tasks` returns a `labels` array per task — but only when labels have been applied via the labels endpoint above. Tasks created without labels return `"labels": null`.

### Label filter on `/tasks` is not supported

`?filter=label_id=1` and similar filter syntaxes return `4016 Invalid model provided`. To find all tasks with a specific label, fetch all tasks and filter client-side on the `labels` array.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VIKUNJA_URL` | `http://vikunja:3456/api/v1` | Vikunja API base URL |
| `VIKUNJA_TOKEN` | _(empty)_ | API token — generate in Vikunja user settings |

---

## API

| Endpoint | Description |
|---|---|
| `GET /widget` | Hub widget data (includes blocked count) |
| `GET /api/tasks` | Tasks with project name and due status |
| `GET /api/projects` | Project list |
| `GET /api/blocked` | All `waiting`-labelled tasks grouped by project |

---

## docker-compose.yml

```yaml
services:
  vikunja-sat:
    image: ghcr.io/sensokame/homeport-vikunja:latest
    container_name: vikunja-sat
    restart: unless-stopped
    environment:
      - VIKUNJA_URL=http://vikunja:3456/api/v1
      - VIKUNJA_TOKEN=your_token
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

The satellite container name (`vikunja-sat`) is what you reference in `dashboard.json` as the `widgetUrl` host (e.g. `"widgetUrl": "http://vikunja-sat:8080"`).
