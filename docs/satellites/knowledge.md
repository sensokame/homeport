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

## Widgets

| Widget id | Config | Description |
|---|---|---|
| `knowledge.reading` | none | Currently-reading books, card + focus session mode |
| `knowledge.project-tasks` | `project_slug` (required) | Open task checklist + collapsible rendered notes for one project — designed to be embedded by [workspace-sat](workspace.md) in project mode, not added directly to a dashboard tab |

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
| `GET /api/projects` | Every folder under `Projects/projects/` in the vault (dirs only) — the full slug list, unlike [inventory-sat's](inventory.md) `/api/projects` which only lists slugs it has assignment data for |
| `GET /api/projects/{slug}` | 404 if the folder doesn't exist, else `{ slug, source_file, tasks, notes_html }` — see below |

### `GET /api/projects/{slug}`

Reads the project's working file — `tasks.md` if present, else `idea.md` (the vault-wide convention, see `docs/contributing/index.md` if documented, or `Projects/projects/index.md`'s "Conventions" section in the vault itself).

```json
{
  "slug": "homeport",
  "source_file": "tasks.md",
  "tasks": [
    { "heading": null, "items": ["Open task with no sub-heading", "..."] },
    { "heading": "some-sub-project", "items": ["Open task under a ### sub-heading"] }
  ],
  "notes_html": "<h1>...</h1><p>...</p>"
}
```

- `tasks` parses the `## Tasks` section only — open `- [ ]` checkboxes, never checked ones (those live in `## Completed`). Grouped by `### <sub-heading>` when the project uses multi-track task lists (e.g. a project with several independent efforts under one folder); a `heading: null` group holds items with no sub-heading.
- `notes_html` is the *entire* working file rendered as HTML (frontmatter stripped, `markdown` + `extra`/`smarty` extensions — same renderer used for chapter PDF export). Not just the Tasks section — callers decide how much to show.

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
