import json
import os
import sqlite3
import uuid
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Route

DB_PATH = Path(os.getenv("DB_PATH", "/data/inventory.db"))
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI()


# ── Database ──────────────────────────────────────────────────────────────────

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS items (
                id                   TEXT PRIMARY KEY,
                name                 TEXT NOT NULL,
                category             TEXT DEFAULT '',
                subcategory          TEXT DEFAULT '',
                quantity             REAL DEFAULT 0,
                unit                 TEXT DEFAULT 'pcs',
                location             TEXT DEFAULT '',
                status               TEXT DEFAULT 'in_stock',
                threshold            REAL DEFAULT 0,
                specs                TEXT DEFAULT '{}',
                notes                TEXT DEFAULT '',
                created_at           TEXT NOT NULL,
                updated_at           TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS item_assignments (
                id                 TEXT PRIMARY KEY,
                item_id            TEXT NOT NULL,
                project_slug       TEXT NOT NULL,
                quantity_reserved  REAL DEFAULT 0,
                notes              TEXT DEFAULT '',
                FOREIGN KEY (item_id) REFERENCES items(id)
            );
        """)


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


ITEM_SELECT = """
    SELECT i.*,
           COALESCE((SELECT SUM(ia.quantity_reserved)
                     FROM item_assignments ia WHERE ia.item_id = i.id), 0) AS quantity_reserved
    FROM items i
"""

def item_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["specs"] = json.loads(d.get("specs") or "{}")
    d.setdefault("quantity_reserved", 0)
    d.setdefault("quantity_on_order", 0)
    d["available"] = d["quantity"] - d["quantity_reserved"]
    return d


# v1.3.0: inventory's own `projects` table (freeform, disconnected from the vault) is
# retired in favor of referencing vault project folder slugs directly. One-time mapping
# from the old project ids to their vault slug, used to migrate existing assignments below.
LEGACY_PROJECT_SLUGS = {
    "fb50512e-2fc9-42be-87c7-fc2d81e5a7ed": "home-server",        # Home Server Build
    "04f14f10-5c88-4119-8ec9-d736f224a54e": "home-server",        # ZFS Pool Setup -> merged into home-server
    "54926983-2585-4a88-867a-73df4780d273": "cyber-deck-phone",   # Cyber Deck (Repurposed Phone)
    "b6132232-0acc-4baf-aeef-96fc9fdc69fa": "cyber-deck-console", # Cyber Deck (Console)
    "7822ac04-59af-43a7-bb47-377e36a84e10": "4wd-robot-car",      # 4WD Robot Car
    "4ec28579-40c6-4d3a-b6fe-84d63023ffd0": "beacon",             # Beacon
}


def migrate_db():
    with sqlite3.connect(DB_PATH) as conn:
        try:
            conn.execute("ALTER TABLE items ADD COLUMN quantity_on_order REAL DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # column already exists

        columns = {row[1] for row in conn.execute("PRAGMA table_info(item_assignments)")}
        if "project_id" in columns:
            # project_id is part of a FOREIGN KEY constraint, which SQLite's
            # ALTER TABLE ... DROP COLUMN refuses to touch — rebuild the table instead.
            if "project_slug" not in columns:
                conn.execute("ALTER TABLE item_assignments ADD COLUMN project_slug TEXT")
            for old_id, slug in LEGACY_PROJECT_SLUGS.items():
                conn.execute(
                    "UPDATE item_assignments SET project_slug = ? WHERE project_id = ? AND project_slug IS NULL",
                    (slug, old_id),
                )
            conn.execute("""
                CREATE TABLE item_assignments_new (
                    id                 TEXT PRIMARY KEY,
                    item_id            TEXT NOT NULL,
                    project_slug       TEXT NOT NULL,
                    quantity_reserved  REAL DEFAULT 0,
                    notes              TEXT DEFAULT '',
                    FOREIGN KEY (item_id) REFERENCES items(id)
                )
            """)
            conn.execute("""
                INSERT INTO item_assignments_new (id, item_id, project_slug, quantity_reserved, notes)
                SELECT id, item_id, project_slug, quantity_reserved, notes FROM item_assignments
            """)
            conn.execute("DROP TABLE item_assignments")
            conn.execute("ALTER TABLE item_assignments_new RENAME TO item_assignments")
            conn.execute("DROP TABLE IF EXISTS projects")


init_db()
migrate_db()


# ── Pydantic models ───────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    name: str
    category: str = ""
    subcategory: str = ""
    quantity: float = 0
    unit: str = "pcs"
    location: str = ""
    status: str = "in_stock"
    threshold: float = 0
    specs: dict = {}
    notes: str = ""
    quantity_on_order: float = 0


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    threshold: Optional[float] = None
    specs: Optional[dict] = None
    notes: Optional[str] = None
    quantity_on_order: Optional[float] = None


class AssignmentCreate(BaseModel):
    item_id: str
    quantity_reserved: float = 0
    notes: str = ""


# ── Catalog ───────────────────────────────────────────────────────────────────

@app.get("/api/catalog")
def catalog():
    return {
        "widgets": [
            {"id": "inventory.overview", "name": "Inventory",
             "description": "Stock overview and per-project item needs",
             "configSchema": {}},
            {"id": "inventory.project-items", "name": "Project Items",
             "description": "Items assigned to one project (config: project_slug)",
             "configSchema": {"project_slug": {"type": "string", "label": "Project slug", "required": True}}},
        ],
        "provides": ["project"],
        "projectWidget": "inventory.project-items",
        "projectOrder": 20,
        "mcp": {"url": "http://inventory:8080/mcp"},
    }


# ── Widget ────────────────────────────────────────────────────────────────────

@app.get("/widget")
def widget():
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
        projects = conn.execute("SELECT COUNT(DISTINCT project_slug) FROM item_assignments").fetchone()[0]
        low = conn.execute(
            """SELECT COUNT(*) FROM items i
               WHERE (threshold > 0 AND
                      quantity - COALESCE((SELECT SUM(ia.quantity_reserved) FROM item_assignments ia WHERE ia.item_id = i.id), 0) <= threshold)
                  OR status IN ('low','depleted','needed')"""
        ).fetchone()[0]
    status = "warn" if low > 0 else "ok"
    summary = f"{total} items · {low} low stock" if low > 0 else f"{total} items · {projects} projects"
    return {
        "title": "Inventory",
        "status": status,
        "summary": summary,
        "metrics": [
            {"label": "Items", "value": total},
            {"label": "Projects", "value": projects},
            {"label": "Low stock", "value": low, "alert": low > 0},
        ],
    }


# ── Widget endpoints ──────────────────────────────────────────────────────────

@app.get("/api/widget/projects")
def widget_projects():
    with get_conn() as conn:
        slugs = conn.execute(
            "SELECT DISTINCT project_slug FROM item_assignments ORDER BY project_slug"
        ).fetchall()
        result = []
        for row in slugs:
            slug = row["project_slug"]
            assignments = conn.execute(
                """SELECT ia.item_id, i.name AS item_name, i.status AS item_status,
                          ia.quantity_reserved, i.unit, ia.notes
                   FROM item_assignments ia
                   JOIN items i ON i.id = ia.item_id
                   WHERE ia.project_slug = ? AND i.status != 'in_stock'
                   ORDER BY i.name""",
                (slug,),
            ).fetchall()
            if assignments:
                result.append({"slug": slug, "assignments": [dict(a) for a in assignments]})
    return result


# ── Items ─────────────────────────────────────────────────────────────────────

@app.get("/api/items/shopping-list")
def shopping_list():
    with get_conn() as conn:
        rows = conn.execute(
            f"""{ITEM_SELECT}
               WHERE (i.threshold > 0 AND
                      i.quantity - COALESCE((SELECT SUM(ia.quantity_reserved) FROM item_assignments ia WHERE ia.item_id = i.id), 0) <= i.threshold)
                  OR i.status IN ('low', 'ordered', 'depleted', 'needed')
               ORDER BY i.name"""
        ).fetchall()
    return [item_row(r) for r in rows]


@app.get("/api/items")
def list_items(category: str = "", status: str = "", search: str = ""):
    clauses, params = [], []
    if category:
        clauses.append("i.category = ?")
        params.append(category)
    if status:
        clauses.append("i.status = ?")
        params.append(status)
    if search:
        clauses.append("(i.name LIKE ? OR i.category LIKE ? OR i.location LIKE ?)")
        params.extend([f"%{search}%"] * 3)
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    with get_conn() as conn:
        rows = conn.execute(f"{ITEM_SELECT} {where} ORDER BY i.name", params).fetchall()
    return [item_row(r) for r in rows]


@app.post("/api/items", status_code=201)
def create_item(body: ItemCreate):
    item_id = new_id()
    ts = now()
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO items (id,name,category,subcategory,quantity,unit,location,status,threshold,specs,notes,created_at,updated_at,quantity_on_order)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (item_id, body.name, body.category, body.subcategory,
             body.quantity, body.unit, body.location, body.status,
             body.threshold, json.dumps(body.specs), body.notes, ts, ts,
             body.quantity_on_order),
        )
        row = conn.execute(f"{ITEM_SELECT} WHERE i.id = ?", (item_id,)).fetchone()
    return item_row(row)


@app.get("/api/items/{item_id}")
def get_item(item_id: str):
    with get_conn() as conn:
        row = conn.execute(f"{ITEM_SELECT} WHERE i.id = ?", (item_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return item_row(row)


@app.put("/api/items/{item_id}")
def update_item(item_id: str, body: ItemUpdate):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="no fields to update")
    if "specs" in fields:
        fields["specs"] = json.dumps(fields["specs"])
    fields["updated_at"] = now()
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    with get_conn() as conn:
        conn.execute(
            f"UPDATE items SET {set_clause} WHERE id = ?",
            list(fields.values()) + [item_id],
        )
        row = conn.execute(f"{ITEM_SELECT} WHERE i.id = ?", (item_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return item_row(row)


@app.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: str):
    with get_conn() as conn:
        conn.execute("DELETE FROM item_assignments WHERE item_id = ?", (item_id,))
        conn.execute("DELETE FROM items WHERE id = ?", (item_id,))


# ── Projects (vault-backed — inventory only stores assignments scoped by slug) ──

@app.get("/api/projects")
def list_project_slugs():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT project_slug AS slug, COUNT(*) AS item_count
               FROM item_assignments GROUP BY project_slug ORDER BY project_slug"""
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/projects/{slug}/items")
def get_project_items(slug: str):
    with get_conn() as conn:
        assignments = conn.execute(
            """SELECT ia.id, ia.item_id, i.name as item_name, i.status as item_status,
                      ia.quantity_reserved, i.unit, ia.notes
               FROM item_assignments ia
               JOIN items i ON i.id = ia.item_id
               WHERE ia.project_slug = ?
               ORDER BY i.name""",
            (slug,),
        ).fetchall()
    return {"slug": slug, "assignments": [dict(a) for a in assignments]}


# ── Assignments ───────────────────────────────────────────────────────────────

@app.post("/api/projects/{slug}/assignments", status_code=201)
def create_assignment(slug: str, body: AssignmentCreate):
    aid = new_id()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO item_assignments VALUES (?,?,?,?,?)",
            (aid, body.item_id, slug, body.quantity_reserved, body.notes),
        )
        row = conn.execute(
            """SELECT ia.id, ia.item_id, i.name as item_name,
                      ia.quantity_reserved, ia.notes
               FROM item_assignments ia
               JOIN items i ON i.id = ia.item_id
               WHERE ia.id = ?""",
            (aid,),
        ).fetchone()
    return dict(row)


@app.delete("/api/projects/{slug}/assignments/{assignment_id}", status_code=204)
def delete_assignment(slug: str, assignment_id: str):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM item_assignments WHERE id = ? AND project_slug = ?",
            (assignment_id, slug),
        )


# ── MCP (read-only — mirrors knowledge-sat, see homeport vault agent-integration.md) ──
# Resources wrap the same REST handlers above; no duplicated logic.

mcp_server = FastMCP(
    "inventory",
    streamable_http_path="/",
    # No auth on any REST route here either — internal-network-only satellite.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


@mcp_server.resource("inventory://items/shopping-list", mime_type="application/json")
def mcp_shopping_list() -> list[dict]:
    """Items needing attention: low stock, ordered, depleted, or needed."""
    return shopping_list()


@mcp_server.resource("inventory://items/all", mime_type="application/json")
def mcp_items_all() -> list[dict]:
    """Every inventory item, unfiltered."""
    return list_items()


@mcp_server.resource("inventory://projects", mime_type="application/json")
def mcp_projects() -> list[dict]:
    """Projects with items currently assigned to them."""
    return list_project_slugs()


mcp_app = mcp_server.streamable_http_app()
# CORS: browser-based MCP clients (e.g. MCP Inspector's web UI) connect directly
# to this URL cross-origin, so the preflight OPTIONS request needs real CORS headers.
mcp_app = CORSMiddleware(
    mcp_app,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["mcp-session-id"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with mcp_server.session_manager.run():
        yield


app.router.lifespan_context = lifespan
app.mount("/mcp", mcp_app)


class _McpBareMount:
    """Starlette's Mount only matches "/mcp/*" (it requires the trailing slash),
    but MCP clients commonly POST to the bare "/mcp" path. Forward it explicitly
    rather than relying on Starlette's redirect-slash fallback, which never
    triggers here because the catch-all SPA route below produces a GET-only
    partial match for "/mcp" first, winning as a 405 before the redirect check
    runs. Must be a callable *instance*: Starlette treats plain functions as
    request/response endpoints (defaulting to GET-only) rather than raw ASGI
    apps, which would reintroduce the same bug. See
    reference_mcp_streamable_http_fastapi_mount for the full writeup."""

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope["path"] = "/"
        await mcp_app(scope, receive, send)


app.router.routes.append(Route("/mcp", endpoint=_McpBareMount()))


# ── Static / SPA ──────────────────────────────────────────────────────────────

if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"detail": "frontend not built — run pnpm build"}
