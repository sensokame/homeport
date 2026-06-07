import os
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import docker
import psutil
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).parent / "static"
OWN_NAME = os.getenv("CONTAINER_NAME", "infra")

app = FastAPI()
docker_client = docker.from_env()

_update_lock = threading.Lock()
_update_state: dict = {"running": False, "done": False, "results": []}

# Background sampler — owns all psutil.cpu_percent() calls (delta-based, races
# to 0% if called from multiple endpoints) and the Docker container list
# (containers.list() is expensive; no need to hit the daemon every 2s).
_cpu_percent: float = 0.0
_containers_cache: list = []
_containers_cache_lock = threading.Lock()

def _background_sampler():
    global _cpu_percent, _containers_cache
    psutil.cpu_percent()  # warmup
    try:
        with _containers_cache_lock:
            _containers_cache = docker_client.containers.list(all=True)
    except Exception:
        pass
    tick = 0
    while True:
        time.sleep(1)
        _cpu_percent = psutil.cpu_percent()
        tick += 1
        if tick % 10 == 0:  # refresh container list every 10s
            try:
                fresh = docker_client.containers.list(all=True)
                with _containers_cache_lock:
                    _containers_cache = fresh
            except Exception:
                pass

threading.Thread(target=_background_sampler, daemon=True).start()


def _cached_containers(all: bool = True) -> list:
    with _containers_cache_lock:
        containers = list(_containers_cache)
    if not all:
        return [c for c in containers if c.status == "running"]
    return containers


def _run_update():
    results = []
    try:
        containers = [c for c in _cached_containers(all=False) if c.name != OWN_NAME]
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


def _container_info(c) -> dict:
    labels = c.labels or {}
    return {
        "id": c.short_id,
        "name": c.name,
        "status": c.status,
        "image": c.image.tags[0] if c.image.tags else c.image.short_id,
        "started": c.attrs["State"]["StartedAt"],
        "group": labels.get("homeport.group", ""),
    }


def _compute_stats(c) -> dict | None:
    try:
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
    except Exception:
        return None


# ── Catalog ───────────────────────────────────────────────────────────────────

@app.get("/api/catalog")
def catalog():
    return {"widgets": [
        {"id": "infra.overview", "name": "Infrastructure",
         "description": "CPU, RAM, disk metrics and container status grouped by service group",
         "configSchema": {}},
    ]}


# ── Widget ────────────────────────────────────────────────────────────────────

@app.get("/widget")
def widget():
    all_containers = _cached_containers()
    total = len(all_containers)
    running = sum(1 for c in all_containers if c.status == "running")
    stopped = total - running

    if total == 0 or running == total:
        status = "ok"
    else:
        status = "warn"

    cpu = _cpu_percent
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    if cpu > 80 or disk.percent > 80:
        status = "warn"

    return {
        "title": "Infrastructure",
        "status": status,
        "summary": f"{running} / {total} containers running",
        "metrics": [
            {"label": "CPU",  "value": f"{round(cpu, 1)}%", "alert": cpu > 80},
            {"label": "RAM",  "value": f"{mem.used / 1e9:.1f} GB / {mem.total / 1e9:.1f} GB"},
            {"label": "Disk", "value": f"{disk.percent}%", "alert": disk.percent > 80},
        ],
    }


# ── Config ────────────────────────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    return {
        "dozzle_url": os.getenv("DOZZLE_URL", ""),
        "hostname": os.getenv("HOSTNAME_DISPLAY", os.uname().nodename),
    }


# ── Containers ────────────────────────────────────────────────────────────────

@app.get("/api/containers")
def list_containers():
    return [_container_info(c) for c in _cached_containers()]


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
    return _compute_stats(c) or {"cpu_percent": 0, "mem_usage": 0, "mem_limit": 0, "net_rx": 0, "net_tx": 0}


@app.get("/api/stats")
def get_all_stats():
    running = _cached_containers(all=False)
    results: dict = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_compute_stats, c): c.name for c in running}
        for future in as_completed(futures):
            name = futures[future]
            data = future.result()
            if data is not None:
                results[name] = data
    return results


@app.post("/api/containers/{name}/redeploy")
def redeploy_container(name: str):
    if name == OWN_NAME:
        raise HTTPException(status_code=400, detail="cannot redeploy self")
    try:
        c = docker_client.containers.get(name)
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="not found")
    labels = c.labels or {}
    config_file = labels.get("com.docker.compose.project.config_files")
    service = labels.get("com.docker.compose.service")
    if not config_file or not service:
        raise HTTPException(status_code=400, detail="not a compose-managed container")
    result = subprocess.run(
        ["docker", "compose", "-f", config_file, "up", "-d", "--no-deps", "--force-recreate", service],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or result.stdout)
    return {"ok": True}


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


@app.post("/api/groups/{group}/{action}")
def group_action(group: str, action: str):
    if action not in ("restart", "stop", "start", "redeploy"):
        raise HTTPException(status_code=400, detail="invalid action")
    containers = [
        c for c in _cached_containers()
        if c.labels.get("homeport.group") == group
    ]
    if not containers:
        raise HTTPException(status_code=404, detail="no containers in group")
    for c in containers:
        if c.name == OWN_NAME:
            continue
        try:
            if action == "redeploy":
                labels = c.labels or {}
                config_file = labels.get("com.docker.compose.project.config_files")
                service = labels.get("com.docker.compose.service")
                if config_file and service:
                    subprocess.run(
                        ["docker", "compose", "-f", config_file, "up", "-d", "--no-deps", "--force-recreate", service],
                        capture_output=True, text=True, timeout=120,
                    )
            else:
                getattr(c, action)()
        except Exception:
            pass
    return {"ok": True, "count": len(containers)}


# ── System ────────────────────────────────────────────────────────────────────

@app.get("/api/system")
def system_stats():
    cpu = _cpu_percent
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


# ── Actions ───────────────────────────────────────────────────────────────────

@app.post("/api/actions/restart-all")
def restart_all():
    containers = [c for c in _cached_containers(all=False) if c.name != OWN_NAME]
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
