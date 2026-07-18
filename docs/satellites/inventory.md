# Inventory Satellite

Equipment and project tracker. Manages items by category, quantity, and location. Assigns items to projects. Generates a shopping list for low-stock items.

---

## Features

- **Inventory tab** — search and filter items by category or status, add/edit/delete
- **Projects tab** — browse item assignments by vault project slug, assign items with reserved quantities (slug is free-text, matching a `Projects/projects/<slug>/` vault folder)
- **Shopping list** — items at or below their restock threshold, or marked `ordered`/`depleted`/`needed`
- `GET /widget` — live summary for the hub

---

## Widget response

```json
{
  "title": "Inventory",
  "status": "warn",
  "summary": "47 items · 3 low stock",
  "metrics": [
    { "label": "Items",    "value": 47 },
    { "label": "Projects", "value": 5 },
    { "label": "Low stock","value": 3, "alert": true }
  ]
}
```

Status: `ok` if no low-stock items, `warn` if any.

---

## Data model

Project identity lives in the Obsidian vault (`Projects/projects/<slug>/`), not in inventory. Inventory has no `projects` table — it only stores assignments keyed on the vault's folder name (a plain string, no foreign key, no CRUD ownership).

### items

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `name` | TEXT | |
| `category` | TEXT | Free text, e.g. `Electronics` |
| `subcategory` | TEXT | |
| `quantity` | REAL | |
| `unit` | TEXT | `pcs`, `m`, `g`, etc. |
| `location` | TEXT | e.g. `Shelf A3` |
| `status` | TEXT | `in_stock`, `low`, `ordered`, `depleted`, `needed` |
| `threshold` | REAL | Restock trigger quantity |
| `specs` | TEXT | JSON blob — flexible key-value pairs |
| `notes` | TEXT | |
| `quantity_on_order` | REAL | |

### item_assignments

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `item_id` | TEXT | FK → items |
| `project_slug` | TEXT | Vault project folder name, e.g. `4wd-robot-car` — no FK, no validation against a project table |
| `quantity_reserved` | REAL | |
| `notes` | TEXT | |

---

## API

**Items**

| Endpoint | Description |
|---|---|
| `GET /api/items` | List items — query params: `category`, `status`, `search` |
| `POST /api/items` | Create item |
| `GET /api/items/{id}` | Single item |
| `PUT /api/items/{id}` | Update item |
| `DELETE /api/items/{id}` | Delete item and its assignments |
| `GET /api/items/shopping-list` | Items at/below threshold or ordered/depleted/needed |

**Projects** (derived from assignments — inventory doesn't own project identity)

| Endpoint | Description |
|---|---|
| `GET /api/projects` | Distinct slugs with at least one assignment, plus `item_count` — not the full vault project list, see [knowledge-sat](knowledge.md) for that |
| `GET /api/projects/{slug}/items` | Assignments for one slug (always 200, empty list if none) |

**Assignments**

| Endpoint | Description |
|---|---|
| `POST /api/projects/{slug}/assignments` | Assign item to a project slug (creates the slug's first appearance implicitly — no separate "create project" step) |
| `DELETE /api/projects/{slug}/assignments/{aid}` | Remove assignment |

---

## Widgets

| Widget id | Config | Description |
|---|---|---|
| `inventory.overview` | none | Card + focus SwipeableCard: item attention list, plus one page per project slug with active (non-`in_stock`) assignments |
| `inventory.project-items` | `project_slug` (required) | Renders one project's assigned items — designed to be embedded by [workspace-sat](workspace.md) in project mode, not added directly to a dashboard tab |

---

## docker-compose.yml

```yaml
services:
  inventory:
    build:
      context: ../..
      dockerfile: apps/inventory/Dockerfile
    container_name: inventory
    restart: unless-stopped
    volumes:
      - ./data:/data
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

The SQLite database is stored at `/data/inventory.db` inside the container, persisted via the `./data` volume mount.
