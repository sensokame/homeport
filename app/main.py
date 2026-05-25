import json
import os
import threading
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import docker
import psutil

STATIC = Path(__file__).parent / "static"
TODOS_FILE = Path("/data/todos.json")
OWN_NAME = os.getenv("CONTAINER_NAME", "dashboard")

app = FastAPI()
docker_client = docker.from_env()

_update_lock = threading.Lock()
_update_state: dict = {"running": False, "done": False, "results": []}


def _run_update():
    results = []
    try:
        containers = [c for c in docker_client.containers.list() if c.name != OWN_NAME]
        for c in containers:
            try:
                tag = c.image.tags[0] if c.image.tags else None
                if not tag:
                    results.append({"name": c.name, "status": "skipped"})
                    continue
                old_id = c.image.id
                new_img = docker_client.images.pull(tag)
                if new_img.id != old_id:
                    c.restart()
                    results.append({"name": c.name, "status": "updated"})
                else:
                    results.append({"name": c.name, "status": "up-to-date"})
            except Exception as e:
                results.append({"name": c.name, "status": "error", "reason": str(e)})
    finally:
        with _update_lock:
            _update_state["running"] = False
            _update_state["done"] = True
            _update_state["results"] = results


# ── Helpers ──

def _container_info(c):
    return {
        "id": c.short_id,
        "name": c.name,
        "status": c.status,
        "image": c.image.tags[0] if c.image.tags else c.image.short_id,
        "started": c.attrs["State"]["StartedAt"],
    }

def _load_todos():
    if TODOS_FILE.exists():
        return json.loads(TODOS_FILE.read_text())
    return []

def _save_todos(todos):
    TODOS_FILE.parent.mkdir(parents=True, exist_ok=True)
    TODOS_FILE.write_text(json.dumps(todos, indent=2))


# ── Config ──

@app.get("/api/config")
def get_config():
    return {
        "dozzle_url": os.getenv("DOZZLE_URL", "http://localhost:9999"),
        "hostname": os.getenv("HOSTNAME_DISPLAY", os.uname().nodename),
    }


# ── Containers ──

@app.get("/api/containers")
def list_containers():
    return [_container_info(c) for c in docker_client.containers.list(all=True)]


@app.get("/api/containers/{name}")
def get_container(name: str):
    try:
        c = docker_client.containers.get(name)
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="not found")
    attrs = c.attrs
    return {
        **_container_info(c),
        "ports": attrs["NetworkSettings"]["Ports"],
        "mounts": [f"{m['Source']}:{m['Destination']}" for m in attrs.get("Mounts", [])],
        "networks": list(attrs["NetworkSettings"]["Networks"].keys()),
        "restart_policy": attrs["HostConfig"].get("RestartPolicy", {}).get("Name", ""),
    }


@app.get("/api/containers/{name}/stats")
def get_container_stats(name: str):
    try:
        c = docker_client.containers.get(name)
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="not found")
    if c.status != "running":
        return {"cpu_percent": 0, "mem_usage": 0, "mem_limit": 0, "net_rx": 0, "net_tx": 0}
    s = c.stats(stream=False)
    cpu_delta = (
        s["cpu_stats"]["cpu_usage"]["total_usage"]
        - s["precpu_stats"]["cpu_usage"]["total_usage"]
    )
    sys_delta = s["cpu_stats"]["system_cpu_usage"] - s["precpu_stats"]["system_cpu_usage"]
    ncpus = s["cpu_stats"].get("online_cpus", 1)
    cpu = round((cpu_delta / sys_delta) * ncpus * 100, 2) if sys_delta > 0 else 0
    return {
        "cpu_percent": cpu,
        "mem_usage": s["memory_stats"].get("usage", 0),
        "mem_limit": s["memory_stats"].get("limit", 0),
        "net_rx": sum(v["rx_bytes"] for v in s.get("networks", {}).values()),
        "net_tx": sum(v["tx_bytes"] for v in s.get("networks", {}).values()),
    }


@app.post("/api/containers/{name}/{action}")
def container_action(name: str, action: str):
    if action not in ("restart", "stop", "start"):
        raise HTTPException(status_code=400, detail="invalid action")
    try:
        c = docker_client.containers.get(name)
        getattr(c, action)()
        return {"ok": True}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="not found")


@app.post("/api/actions/restart-all")
def restart_all():
    containers = [c for c in docker_client.containers.list() if c.name != OWN_NAME]
    for c in containers:
        c.restart()
    return {"ok": True, "count": len(containers)}


@app.post("/api/actions/update-all")
def update_all():
    with _update_lock:
        if _update_state["running"]:
            return {"ok": False, "reason": "already running"}
        _update_state["running"] = True
        _update_state["done"] = False
        _update_state["results"] = []
    threading.Thread(target=_run_update, daemon=True).start()
    return {"ok": True}


@app.get("/api/actions/update-status")
def update_status():
    return dict(_update_state)


# ── System ──

@app.get("/api/system")
def system_stats():
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu_percent": round(cpu, 1),
        "mem_used": mem.used,
        "mem_total": mem.total,
        "mem_percent": round(mem.percent, 1),
        "disk_used": disk.used,
        "disk_total": disk.total,
        "disk_percent": round(disk.percent, 1),
    }


# ── Todos ──

@app.get("/api/todos")
def get_todos():
    return _load_todos()


@app.post("/api/todos")
async def add_todo(request: Request):
    body = await request.json()
    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text required")
    todos = _load_todos()
    todo = {"id": str(uuid4()), "text": text, "done": False}
    todos.append(todo)
    _save_todos(todos)
    return todo


@app.patch("/api/todos/{todo_id}")
def toggle_todo(todo_id: str):
    todos = _load_todos()
    for t in todos:
        if t["id"] == todo_id:
            t["done"] = not t["done"]
            _save_todos(todos)
            return t
    raise HTTPException(status_code=404, detail="not found")


@app.delete("/api/todos/{todo_id}")
def delete_todo(todo_id: str):
    todos = _load_todos()
    _save_todos([t for t in todos if t["id"] != todo_id])
    return {"ok": True}


# ── Static / SPA ──

app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")

@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    return FileResponse(STATIC / "index.html")
