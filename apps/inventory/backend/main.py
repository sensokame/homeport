import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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
            CREATE TABLE IF NOT EXISTS projects (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                description  TEXT DEFAULT '',
                status       TEXT DEFAULT 'planning',
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS item_assignments (
                id                 TEXT PRIMARY KEY,
                item_id            TEXT NOT NULL,
                project_id         TEXT NOT NULL,
                quantity_reserved  REAL DEFAULT 0,
                notes              TEXT DEFAULT '',
                FOREIGN KEY (item_id)    REFERENCES items(id),
                FOREIGN KEY (project_id) REFERENCES projects(id)
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


def migrate_db():
    with sqlite3.connect(DB_PATH) as conn:
        try:
            conn.execute("ALTER TABLE items ADD COLUMN quantity_on_order REAL DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # column already exists


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


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    status: str = "planning"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class AssignmentCreate(BaseModel):
    item_id: str
    quantity_reserved: float = 0
    notes: str = ""


# ── Catalog ───────────────────────────────────────────────────────────────────

@app.get("/api/catalog")
def catalog():
    return {"widgets": [
        {"id": "inventory.overview", "name": "Inventory",
         "description": "Stock overview and per-project item needs",
         "configSchema": {}},
    ]}


# ── Widget ────────────────────────────────────────────────────────────────────

@app.get("/widget")
def widget():
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
        projects = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
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
        projects = conn.execute("SELECT * FROM projects ORDER BY name").fetchall()
        result = []
        for p in projects:
            assignments = conn.execute(
                """SELECT ia.item_id, i.name AS item_name, i.status AS item_status,
                          ia.quantity_reserved, i.unit, ia.notes
                   FROM item_assignments ia
                   JOIN items i ON i.id = ia.item_id
                   WHERE ia.project_id = ? AND i.status != 'in_stock'
                   ORDER BY i.name""",
                (p["id"],),
            ).fetchall()
            if assignments:
                result.append({**dict(p), "assignments": [dict(a) for a in assignments]})
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


# ── Projects ──────────────────────────────────────────────────────────────────

@app.get("/api/projects")
def list_projects():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY name").fetchall()
        result = []
        for r in rows:
            p = dict(r)
            p["item_count"] = conn.execute(
                "SELECT COUNT(*) FROM item_assignments WHERE project_id = ?", (p["id"],)
            ).fetchone()[0]
            result.append(p)
    return result


@app.post("/api/projects", status_code=201)
def create_project(body: ProjectCreate):
    pid = new_id()
    ts = now()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO projects VALUES (?,?,?,?,?,?)",
            (pid, body.name, body.description, body.status, ts, ts),
        )
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    return dict(row)


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="not found")
        p = dict(row)
        assignments = conn.execute(
            """SELECT ia.id, ia.item_id, i.name as item_name,
                      ia.quantity_reserved, ia.notes
               FROM item_assignments ia
               JOIN items i ON i.id = ia.item_id
               WHERE ia.project_id = ?""",
            (project_id,),
        ).fetchall()
        p["assignments"] = [dict(a) for a in assignments]
    return p


@app.put("/api/projects/{project_id}")
def update_project(project_id: str, body: ProjectUpdate):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="no fields to update")
    fields["updated_at"] = now()
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    with get_conn() as conn:
        conn.execute(
            f"UPDATE projects SET {set_clause} WHERE id = ?",
            list(fields.values()) + [project_id],
        )
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return dict(row)


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str):
    with get_conn() as conn:
        conn.execute("DELETE FROM item_assignments WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))


# ── Assignments ───────────────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/assignments", status_code=201)
def create_assignment(project_id: str, body: AssignmentCreate):
    aid = new_id()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO item_assignments VALUES (?,?,?,?,?)",
            (aid, body.item_id, project_id, body.quantity_reserved, body.notes),
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


@app.delete("/api/projects/{project_id}/assignments/{assignment_id}", status_code=204)
def delete_assignment(project_id: str, assignment_id: str):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM item_assignments WHERE id = ? AND project_id = ?",
            (assignment_id, project_id),
        )


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
