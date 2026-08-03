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
| `knowledge.writing` | none | Writing projects with chapter status, word counts, and streaks; card + focus session mode (start/end tracked writing sessions) |
| `knowledge.dev` | none | Recently worked-on projects (any project with dev-companion session history) with last-worked time and streak; each row links to the project's live workspace focus view |

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

### Writing companion (v1.4.0)

| Endpoint | Description |
|---|---|
| `GET /api/writing/projects/{name}` | Word count, chapter/character/event counts, `chapter_status_counts` (draft/revision/final tallies), `current_streak_days` |
| `GET /api/writing/projects/{name}/chapters` | Per-chapter `{stem, word_count, status}` |
| `PATCH /api/writing/projects/{name}/chapters/{chapter}/status` | Body `{status: "draft"\|"revision"\|"final"}` |
| `POST /api/writing/projects/{name}/sessions/start` | Snapshots current word count; 409 if a session is already open |
| `POST /api/writing/projects/{name}/sessions/end` | Computes word delta + duration from the open session, appends it to the log; 409 if none is open |
| `GET /api/writing/projects/{name}/sessions` | Closed session history + the current `open_session` if any |
| `GET /api/writing/projects/{name}/chapters/{chapter}/export.pdf` | Single-chapter PDF export |
| `POST /api/writing/projects/{name}/export.pdf` | Project-level PDF export. Body: `{stems: string[] \| null, include_counts: bool}` — `stems` omitted/null exports every chapter in canonical order, a subset exports only those (an excerpt, flagged as such in the PDF header). `include_counts` bakes a page/word-count annotation near the title, computed via a real WeasyPrint render pass (not an estimate) |

Chapter status and session history are stored in a hidden per-project sidecar file, `<project>/.writing-meta.json`, inside the vault — no separate database. Prose chapter files are never touched by this feature (status lives in the sidecar, not chapter frontmatter). Both PDF export routes reuse the same markdown → HTML → WeasyPrint pipeline; the project-level export adds a `break-before: page` div between chapters.

### Dev companion (v1.8.0)

| Endpoint | Description |
|---|---|
| `POST /api/dev/projects/{slug}/sessions/start` | 409 if a session is already open |
| `POST /api/dev/projects/{slug}/sessions/end` | Computes duration from the open session, appends it to the log; 409 if none is open |
| `GET /api/dev/projects/{slug}/sessions` | Closed session history + `open_session` + `current_streak_days` for one project |
| `GET /api/dev/projects` | Aggregates every project directory with a `.dev-meta.json` sidecar into `{slug, open_session, last_worked, current_streak_days}`, sorted most-recent-first — powers the `knowledge.dev` hub widget |

Session data lives in the same per-project sidecar pattern as writing/music (`<project>/.dev-meta.json`), duration-only — no progress/curriculum field, since task state already lives in the project's own `idea.md`/`tasks.md`. Driven by the `/dev-companion` skill (session start/end), not manual UI controls, so the widget itself is read-only.

---

## MCP

Exposes an MCP server (Streamable HTTP transport) at `/mcp` — the pilot for homeport's agent-access layer (see `agent-integration.md` in the Projects vault).

**Resources** (read-only, wrap the same handlers above — no duplicated logic):

| Resource URI | Description |
|---|---|
| `obsidian://journal/today` | Today's journal entry, if one exists |
| `obsidian://reading/current` | Currently-reading books + read-by-year totals |
| `obsidian://activity/recent` | Vault notes modified in the last 7 days, most recent first |
| `obsidian://projects` | Every project slug under `Projects/projects/` |
| `obsidian://writing/projects` | Every writing project under `Writing/Writing/` |

**Tools** (mutating — first pilot of homeport's write-tool safety policy):

| Tool | Description |
|---|---|
| `mcp_complete_task(slug, index, heading=None)` | Same effect as `POST /api/projects/{slug}/tasks/complete`. Declares `destructiveHint=True`/`idempotentHint=False` annotations, and calls `ctx.elicit(...)` to request explicit confirmation (showing the task's text) before mutating the vault file — the pause is enforced by this satellite's own tool handler, not left to client-side judgment. Note: MCP elicitation doesn't guarantee a *human* saw the prompt (a fully autonomous client is allowed to auto-answer per spec) — the real backstop is that any homeport-built client (the future `agent-host-sat`) always surfaces it. |

See `reference_mcp_streamable_http_fastapi_mount` for the Streamable HTTP mounting gotchas this satellite's `/mcp` had to work around originally.

---

## docker-compose.yml

```yaml
services:
  knowledge:
    image: ghcr.io/sensokame/homeport-obsidian:latest
    container_name: knowledge
    restart: unless-stopped
    volumes:
      - /path/to/vault:/vault
    environment:
      - GOODREADS_USER_ID=your_user_id
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

The vault is mounted read-write: the satellite reads reading/writing/project data from it and also writes to it — completing a project task moves it into a `## Completed` section in the source file, and the writing companion above stores its `.writing-meta.json` sidecar per project.
