# Calendar Satellite

ICS-based calendar integration. Reads any iCal feed (Google Calendar, Nextcloud, etc.) and shows the current and next calendar blocks. Supports trade acknowledgment — a one-click confirmation that you're consciously trading scheduled time for project work.

No OAuth required.

---

## Features

- Current calendar block with start/end time
- Next upcoming block
- Trade acknowledgment — mark a block as consciously traded; persists per day in `/data/trades.json`
- Focus mode — full-screen current block with live countdown progress bar
- Recurring event support via `recurring-ical-events`

---

## Widget: `calendar.overview`

The widget shows the current block and a "Trading for project work →" button. Click it to acknowledge the trade. The "focus →" button enters hub focus mode: the block title fills the screen with a progress bar showing time elapsed.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GCAL_ICS_URL` | yes | Secret iCal address of your calendar |

To get the Google Calendar secret iCal URL: Calendar settings → "Secret address in iCal format".

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/catalog` | Widget catalog |
| `GET /widget` | Current + next block (used by widget component) |
| `POST /api/trade` | Record trade acknowledgment `{ date, event_id }` |

Widget response:

```json
{
  "configured": true,
  "current": {
    "id": "abc123",
    "title": "Deep Work",
    "start": "2026-06-07T09:00:00",
    "end": "2026-06-07T11:00:00",
    "start_time": "09:00",
    "end_time": "11:00",
    "traded": false
  },
  "next": { "title": "Lunch", "start_time": "12:00", "end_time": "13:00" }
}
```

---

## MCP

Exposes an MCP server (Streamable HTTP transport) at `/mcp` — read-only resources, wrapping the same handlers above (no duplicated logic).

| Resource URI | Description |
|---|---|
| `gcal://focus/today` | Weekly focus fields + today's dated note from `life/focus.md` |
| `gcal://events/today` | Today's calendar events, with trade-acknowledgment flags |

See `docs/satellites/building-a-satellite.md`'s "Optional fields" section for the `mcp` catalog field, and `reference_mcp_streamable_http_fastapi_mount` for the Streamable HTTP mounting gotchas every satellite's `/mcp` has to work around.

---

## docker-compose.yml

```yaml
services:
  gcal-sat:
    image: ghcr.io/sensokame/homeport-gcal:latest
    container_name: gcal-sat
    restart: unless-stopped
    volumes:
      - ./data:/data
    environment:
      - GCAL_ICS_URL=https://calendar.google.com/calendar/ical/...
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "gcal", "url": "http://gcal.station", "widgetUrl": "http://gcal-sat:8080" }

// widgets array in a tab
{ "instanceId": "gcal-main", "widgetId": "calendar.overview", "satelliteId": "gcal", "config": {} }
```
