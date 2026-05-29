# Tasks Satellite

Wraps a self-hosted [Vikunja](https://vikunja.io) instance. Shows tasks due today, overdue tasks, and project count.

---

## Features

- Tasks due today and overdue count
- Project list
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

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VIKUNJA_URL` | `http://vikunja:3456/api/v1` | Vikunja API base URL |
| `VIKUNJA_TOKEN` | _(empty)_ | API token — generate in Vikunja user settings |

---

## API

| Endpoint | Description |
|---|---|
| `GET /widget` | Hub widget data |
| `GET /api/tasks` | Tasks with project name and due status |
| `GET /api/projects` | Project list |

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

The satellite container name (`vikunja-sat`) is what you reference in `satellites.json` as the `widget_url` host.
