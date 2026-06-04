import os
from datetime import date, timezone, datetime
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

VIKUNJA_URL = os.getenv("VIKUNJA_URL", "http://vikunja:3456/api/v1")
VIKUNJA_TOKEN = os.getenv("VIKUNJA_TOKEN", "")
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI()


def headers():
    return {"Authorization": f"Bearer {VIKUNJA_TOKEN}"}


def vikunja_get(path: str, params: dict = None):
    try:
        r = httpx.get(f"{VIKUNJA_URL}{path}", headers=headers(), params=params, timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


def is_zero_date(d: str | None) -> bool:
    return not d or d.startswith("0001-")


def parse_due(d: str) -> date | None:
    if is_zero_date(d):
        return None
    try:
        return datetime.fromisoformat(d.replace("Z", "+00:00")).date()
    except Exception:
        return None


def fetch_tasks():
    tasks = []
    page = 1
    while True:
        batch = vikunja_get("/tasks", {"per_page": 500, "page": page})
        if not batch:
            break
        tasks.extend(batch)
        if len(batch) < 500:
            break
        page += 1
    return [t for t in tasks if not t.get("done")]


def fetch_projects():
    projects = vikunja_get("/projects")
    return [p for p in projects if not p.get("is_archived")]


def _parse_version(description: str) -> str | None:
    for line in description.splitlines():
        if line.startswith("version:"):
            v = line[len("version:"):].strip()
            return v if v else None
    return None


def is_waiting(task: dict) -> bool:
    return any(
        lbl.get("title", "").lower() == "waiting"
        for lbl in (task.get("labels") or [])
    )


@app.get("/widget")
def widget():
    try:
        tasks = fetch_tasks()
        projects = fetch_projects()
    except HTTPException:
        return {
            "title": "Tasks",
            "status": "error",
            "summary": "Could not reach Vikunja",
            "metrics": [],
        }

    today = date.today()
    due_today = [t for t in tasks if parse_due(t.get("due_date")) == today]
    overdue = [t for t in tasks if (d := parse_due(t.get("due_date"))) and d < today]
    blocked = [t for t in tasks if is_waiting(t)]

    status = "warn" if overdue else "ok"
    parts = []
    if due_today:
        parts.append(f"{len(due_today)} due today")
    if overdue:
        parts.append(f"{len(overdue)} overdue")
    if blocked:
        parts.append(f"{len(blocked)} blocked")
    summary = " · ".join(parts) if parts else "All clear"

    return {
        "title": "Tasks",
        "status": status,
        "summary": summary,
        "metrics": [
            {"label": "Due today", "value": len(due_today)},
            {"label": "Overdue", "value": len(overdue), "alert": len(overdue) > 0},
            {"label": "Blocked", "value": len(blocked), "alert": len(blocked) > 0},
            {"label": "Projects", "value": len(projects)},
        ],
    }


@app.get("/api/tasks")
def get_tasks():
    tasks = fetch_tasks()
    projects = {p["id"]: p["title"] for p in fetch_projects()}
    today = date.today()

    result = []
    for t in tasks:
        due = parse_due(t.get("due_date"))
        result.append({
            "id": t["id"],
            "title": t["title"],
            "project_id": t.get("project_id"),
            "project_name": projects.get(t.get("project_id"), "Inbox"),
            "due_date": due.isoformat() if due else None,
            "is_today": due == today,
            "is_overdue": due is not None and due < today,
            "is_waiting": is_waiting(t),
            "priority": t.get("priority", 0),
        })
    return result


@app.get("/api/projects")
def get_projects():
    projects = fetch_projects()
    tasks = fetch_tasks()

    task_counts: dict[int, int] = {}
    blocked_counts: dict[int, int] = {}
    for t in tasks:
        pid = t.get("project_id")
        if pid:
            task_counts[pid] = task_counts.get(pid, 0) + 1
            if is_waiting(t):
                blocked_counts[pid] = blocked_counts.get(pid, 0) + 1

    return [
        {
            "id": p["id"],
            "title": p["title"],
            "task_count": task_counts.get(p["id"], 0),
            "blocked_count": blocked_counts.get(p["id"], 0),
            "version": _parse_version(p.get("description") or ""),
        }
        for p in projects
    ]


@app.get("/api/blocked")
def get_blocked():
    tasks = fetch_tasks()
    projects = {p["id"]: p["title"] for p in fetch_projects()}

    waiting_tasks = [t for t in tasks if is_waiting(t)]

    by_project: dict[str, list] = {}
    for t in waiting_tasks:
        project_name = projects.get(t.get("project_id"), "Inbox")
        if project_name not in by_project:
            by_project[project_name] = []

        desc = t.get("description", "") or ""
        waiting_for = None
        for line in desc.splitlines():
            if line.lower().startswith("waiting for:"):
                waiting_for = line[len("waiting for:"):].strip()
                break

        by_project[project_name].append({
            "id": t["id"],
            "title": t["title"],
            "waiting_for": waiting_for,
        })

    return {
        "blocked": [
            {"project": project, "count": len(items), "tasks": items}
            for project, items in by_project.items()
        ]
    }


@app.get("/health")
def health():
    return {"status": "ok"}


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
