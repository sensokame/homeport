import json
import os
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import docker
import psutil
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Route

STATIC_DIR = Path(__file__).parent / "static"
OWN_NAME = os.getenv("CONTAINER_NAME", "infra")

HEALTH_DIR = Path(os.getenv("HEALTH_DIR", "/data/health"))
HEALTH_STATUS_FILE = HEALTH_DIR / "status.json"
HEALTH_INTEGRITY_FILE = HEALTH_DIR / "integrity.json"
HEALTH_CHECKS_FILE = HEALTH_DIR / "checks.json"  # written by the host's station-checks timers
HEALTH_SCAN_RUNNING = HEALTH_DIR / "scan.running"
HEALTH_SCAN_TRIGGER = HEALTH_DIR / "scan.trigger"

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
        "url": labels.get("homeport.url", ""),
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
    return {
        "widgets": [
            {"id": "infra.overview", "name": "Infrastructure",
             "description": "CPU, RAM, disk metrics and container status grouped by service group",
             "configSchema": {}},
        ],
        "mcp": {"url": "http://infra:8080/mcp"},
    }


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

    health = _read_json_file(HEALTH_STATUS_FILE)
    integrity = _read_json_file(HEALTH_INTEGRITY_FILE)
    checks = _read_json_file(HEALTH_CHECKS_FILE)
    if _health_status_summary(health, integrity, checks) == "warn":
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


# ── Health & Security ────────────────────────────────────────────────────────
# Data is produced host-side by systemd timers (homeport-health-check.timer every
# 5 min, homeport-integrity-scan.timer daily) writing JSON into HEALTH_DIR — kept
# out of this container's own privileges (no NVMe device, no fail2ban socket) by
# design; see reference_homeport_satellite_template / project_dashboard memory.

def _read_json_file(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def _health_status_summary(status: dict | None, integrity: dict | None, checks: dict | None = None) -> str:
    """warn only for things that actually need attention — never for routine
    pending-update counts, per feedback_widget_status_semantics."""
    if status is None:
        return "error"
    smart = status.get("smart")
    if smart and (smart.get("passed") is False or (smart.get("media_errors") or 0) > 0):
        return "warn"
    f2b = status.get("fail2ban")
    if f2b and (f2b.get("currently_banned") or 0) > 0:
        return "warn"
    # Only escalate on real content mismatches ('modified') — a 'missing' finding
    # is frequently a deliberate admin action (masked unit, disabled config) and
    # shouldn't itself flip the dashboard badge.
    if integrity and any(f.get("kind") == "modified" for f in integrity.get("findings", [])):
        return "warn"
    # station-checks: only its error tier (new admin, unexpected route, site down, stale
    # snapshots) flips the badge; its warn tier (e.g. CVEs waiting on upstream) is routine.
    if checks and any(c.get("level") == "error" for c in checks.get("checks", {}).values()):
        return "warn"
    return "ok"


@app.get("/api/health")
def get_health():
    status = _read_json_file(HEALTH_STATUS_FILE)
    integrity = _read_json_file(HEALTH_INTEGRITY_FILE)
    checks = _read_json_file(HEALTH_CHECKS_FILE)
    stale = True
    if status and status.get("checked_at"):
        try:
            checked = datetime.fromisoformat(status["checked_at"].replace("Z", "+00:00"))
            stale = (datetime.now(timezone.utc) - checked).total_seconds() > 900  # 3 missed ticks
        except Exception:
            stale = True
    return {
        "status": status,
        "integrity": integrity,
        "checks": checks,
        "stale": stale,
        "scan_running": HEALTH_SCAN_RUNNING.exists(),
        "summary_status": _health_status_summary(status, integrity, checks),
    }


@app.post("/api/health/scan")
def start_integrity_scan():
    if HEALTH_SCAN_RUNNING.exists():
        return {"ok": False, "reason": "already running"}
    HEALTH_DIR.mkdir(parents=True, exist_ok=True)
    HEALTH_SCAN_TRIGGER.write_text(str(time.time()))
    return {"ok": True}


@app.get("/api/health/scan-status")
def integrity_scan_status():
    return {
        "running": HEALTH_SCAN_RUNNING.exists(),
        "integrity": _read_json_file(HEALTH_INTEGRITY_FILE),
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


# ── MCP (read-only — mirrors knowledge-sat, see homeport vault agent-integration.md) ──
# Resources wrap the same REST handlers above; no duplicated logic.

mcp_server = FastMCP(
    "infra",
    streamable_http_path="/",
    # No auth on any REST route here either — internal-network-only satellite.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


@mcp_server.resource("infra://containers", mime_type="application/json")
def mcp_containers() -> list[dict]:
    """Every known container's status, image, and service group."""
    return list_containers()


@mcp_server.resource("infra://system", mime_type="application/json")
def mcp_system() -> dict:
    """Current CPU/RAM/disk usage on the host."""
    return system_stats()


@mcp_server.resource("infra://health", mime_type="application/json")
def mcp_health() -> dict:
    """SMART/fail2ban/pending-updates/package-integrity health snapshot."""
    return get_health()


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
