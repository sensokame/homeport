# Inventory Satellite

Equipment and project tracker. Manages items by category, quantity, and location. Assigns items to projects. Generates a shopping list for low-stock items.

---

## Features

- **Inventory tab** — search and filter items by category or status, add/edit/delete
- **Projects tab** — create projects, assign items with reserved quantities
- **Shopping list** — items at or below their restock threshold, or marked `ordered`/`depleted`
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
| `status` | TEXT | `in_stock`, `low`, `ordered`, `depleted` |
| `threshold` | REAL | Restock trigger quantity |
| `specs` | TEXT | JSON blob — flexible key-value pairs |
| `notes` | TEXT | |

### projects

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `name` | TEXT | |
| `description` | TEXT | |
| `status` | TEXT | `planning`, `active`, `paused`, `done` |

### item_assignments

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `item_id` | TEXT | FK → items |
| `project_id` | TEXT | FK → projects |
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
| `GET /api/items/shopping-list` | Items at/below threshold or ordered/depleted |

**Projects**

| Endpoint | Description |
|---|---|
| `GET /api/projects` | List projects |
| `POST /api/projects` | Create project |
| `GET /api/projects/{id}` | Project with assigned items |
| `PUT /api/projects/{id}` | Update project |
| `DELETE /api/projects/{id}` | Delete project and its assignments |

**Assignments**

| Endpoint | Description |
|---|---|
| `POST /api/projects/{id}/assignments` | Assign item to project |
| `DELETE /api/projects/{id}/assignments/{aid}` | Remove assignment |

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
