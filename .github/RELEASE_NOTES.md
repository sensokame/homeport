## homeport v0.2.0

Widget system overhaul. The hub now renders rich, interactive widget components instead of flat data cards — and every widget gets consistent chrome provided by the hub.

---

### What's new

**Widget system (Phases 3 + 4)**

- **`WidgetShell`** — the hub wraps every widget in a shell that provides a status indicator, icon, satellite name, and `open →` link. Widgets focus purely on data and layout.
- **`fullScreen` manifest flag** — widgets that manage their own chrome can opt out of the shell entirely.
- **`onStatusChange` callback** — widgets report their ok/warn/error status to the shell via a prop callback; no extra API call needed.

**Tasks widget (`vikunja.task-overview`)**

- Replaces the flat summary card with a swipeable widget
- Home page: "Overview" — total open tasks, due today, overdue, blocked counts
- Per-project pages: swipe to see each project's full task list
- Overdue tasks highlighted; blocked/waiting tasks badged

**Blocked task tracking**

- Tasks labelled `waiting` in Vikunja are surfaced as blocked items
- Task description `waiting for: <what>` is parsed and shown in the widget
- Satellite exposes `GET /api/blocked` — waiting tasks grouped by project with parsed reason

**`SwipeableCard` improvements**

- Now content-only (no Card wrapper) — the shell provides the card
- Navigation: `← home` button + `‹ · dots · ›` arrows flanking the dot indicators
- `overflow: hidden` scoped to the slide track only — fixes nav visibility bug

---

### Docker images

```
ghcr.io/sensokame/homeport-hub:0.2.0
ghcr.io/sensokame/homeport-vikunja:0.2.0
```

Other satellite images are unchanged from v0.1.0.
