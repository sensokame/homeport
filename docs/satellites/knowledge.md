# Knowledge Satellite

Aggregates reading and note-taking activity. Shows currently-reading books from Goodreads, with an Obsidian vault fallback, and counts recently active vault notes.

---

## Features

- Currently-reading book from Goodreads public RSS feed
- Falls back to Obsidian frontmatter (`status: reading`) if Goodreads is unavailable
- Active notes count — notes modified in the last 7 days
- `GET /widget` — live summary for the hub

---

## Widget response

```json
{
  "title": "Knowledge",
  "status": "ok",
  "summary": "Reading: The Pragmatic Programmer by David Thomas",
  "metrics": [
    { "label": "Reading",          "value": "The Pragmatic Programmer" },
    { "label": "Author",           "value": "David Thomas" },
    { "label": "Active notes (7d)","value": 12 }
  ]
}
```

Status is always `ok` — the satellite is read-only and degrades gracefully.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VAULT_PATH` | `/vault` | Path to the Obsidian vault root |
| `GOODREADS_USER_ID` | _(empty)_ | Your Goodreads user ID — enables RSS feed |

If `GOODREADS_USER_ID` is not set, reading status falls back to vault frontmatter only.

---

## API

| Endpoint | Description |
|---|---|
| `GET /widget` | Hub widget data |
| `GET /health` | Health check |

---

## docker-compose.yml

```yaml
services:
  knowledge:
    image: ghcr.io/sensokame/homeport-obsidian:latest
    container_name: knowledge
    restart: unless-stopped
    volumes:
      - /path/to/vault:/vault:ro
    environment:
      - GOODREADS_USER_ID=your_user_id
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

The vault is mounted read-only. The satellite never writes to it.
