# Fitness Satellite

Wraps a self-hosted [wger](https://wger.de) instance. Shows today's workout status, active routine, and nutrition logging.

---

## Features

- Today's workout status — scheduled, logged, or rest day
- Active routine name
- Meals logged today
- `GET /widget` — live summary for the hub

---

## Widget response

```json
{
  "title": "Fitness",
  "status": "warn",
  "summary": "Workout scheduled — not logged yet",
  "metrics": [
    { "label": "Today's workout", "value": "Scheduled" },
    { "label": "Active routine",  "value": "Push / Pull / Legs" },
    { "label": "Meals logged",    "value": 2 }
  ]
}
```

Status: `ok` if workout logged or rest day, `warn` if workout is scheduled but not yet logged, `error` if wger is unreachable.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `WGER_URL` | `http://wger/api/v2` | wger API base URL |
| `WGER_TOKEN` | _(empty)_ | API token — generate in wger user settings |

---

## API

| Endpoint | Description |
|---|---|
| `GET /widget` | Hub widget data |
| `GET /api/today` | Today's workout session and nutrition entries |
| `GET /api/routines` | Active routine list |

---

## docker-compose.yml

```yaml
services:
  wger-sat:
    image: ghcr.io/sensokame/homeport-wger:latest
    container_name: wger-sat
    restart: unless-stopped
    environment:
      - WGER_URL=http://wger/api/v2
      - WGER_TOKEN=your_token
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

The satellite container name (`wger-sat`) is what you reference in `dashboard.json` as the `widgetUrl` host (e.g. `"widgetUrl": "http://wger-sat:8080"`).
