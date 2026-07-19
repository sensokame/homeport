import json
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

DASHBOARD_PATH = Path(os.getenv("DASHBOARD_PATH", "/app/dashboard.json"))
STATIC_DIR = Path(__file__).parent / "static"
VERSION = "1.0.0"

app = FastAPI()


def load_dashboard() -> dict:
    if not DASHBOARD_PATH.exists():
        print(f"Warning: dashboard.json not found at {DASHBOARD_PATH}")
        return {"version": 2, "satellites": [], "tabs": []}
    return json.loads(DASHBOARD_PATH.read_text())


def save_dashboard(data: dict):
    DASHBOARD_PATH.write_text(json.dumps(data, indent=2))


@app.get("/api/config")
def get_config():
    return {
        "hostname": os.getenv("HOSTNAME_DISPLAY", os.uname().nodename),
        "version": VERSION,
    }


@app.get("/api/dashboard")
def get_dashboard():
    data = load_dashboard()
    # Strip internal widgetUrl before sending to browser
    public_sats = [{k: v for k, v in s.items() if k != "widgetUrl"} for s in data.get("satellites", [])]
    return {**data, "satellites": public_sats}


@app.put("/api/dashboard")
async def put_dashboard(request: Request):
    body = await request.json()
    existing = load_dashboard()
    # Preserve widgetUrl values — client never sees them so can't send them back
    sat_map = {s["id"]: s.get("widgetUrl") for s in existing.get("satellites", [])}
    merged_sats = []
    for s in body.get("satellites", []):
        widget_url = sat_map.get(s["id"])
        merged_sats.append({**s, **({"widgetUrl": widget_url} if widget_url else {})})
    save_dashboard({**body, "satellites": merged_sats})
    return {"ok": True}


@app.get("/api/catalog")
async def catalog():
    data = load_dashboard()
    results = {}
    project_providers = {}
    project_order = {}
    mcp_servers = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for sat in data.get("satellites", []):
            widget_url = sat.get("widgetUrl")
            if not widget_url:
                continue
            try:
                r = await client.get(widget_url.rstrip("/") + "/api/catalog")
                payload = r.json()
                results[sat["id"]] = payload.get("widgets", [])
                project_widget = payload.get("projectWidget")
                if "project" in payload.get("provides", []) and project_widget:
                    project_providers[sat["id"]] = project_widget
                    project_order[sat["id"]] = payload.get("projectOrder", 100)
                mcp = payload.get("mcp")
                if mcp and mcp.get("url"):
                    mcp_servers[sat["id"]] = {"url": mcp["url"]}
            except Exception:
                results[sat["id"]] = []
    builtins = [
        {"id": "builtin.clock", "name": "Clock",
         "description": "Current time display", "configSchema": {}},
    ]
    return {
        "builtins": builtins,
        "satellites": results,
        "projectProviders": project_providers,
        "projectOrder": project_order,
        "mcp": mcp_servers,
    }


@app.api_route("/api/remote/{satellite_id}/{path:path}", methods=["GET"])
async def remote_asset(satellite_id: str, path: str, request: Request):
    data = load_dashboard()
    sat = next((s for s in data.get("satellites", []) if s["id"] == satellite_id), None)
    if not sat or not sat.get("widgetUrl"):
        raise HTTPException(status_code=404, detail=f"Satellite '{satellite_id}' not found")
    target = sat["widgetUrl"].rstrip("/") + "/" + path
    async with httpx.AsyncClient(timeout=10.0) as client:
        upstream = await client.get(target, headers={
            k: v for k, v in request.headers.items()
            if k.lower() not in ("host", "content-length")
        })
    headers = dict(upstream.headers)
    if path.endswith("remoteEntry.js"):
        headers["Cache-Control"] = "no-store"
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=headers,
    )


@app.api_route("/api/proxy/{satellite_id}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(satellite_id: str, path: str, request: Request):
    data = load_dashboard()
    sat = next((s for s in data.get("satellites", []) if s["id"] == satellite_id), None)
    if not sat or not sat.get("widgetUrl"):
        raise HTTPException(status_code=404, detail=f"Satellite '{satellite_id}' not found")
    target = sat["widgetUrl"].rstrip("/") + "/" + path
    if request.url.query:
        target += "?" + request.url.query
    async with httpx.AsyncClient(timeout=10.0) as client:
        upstream = await client.request(
            method=request.method,
            url=target,
            headers={k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")},
            content=await request.body(),
        )
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=dict(upstream.headers),
    )


if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    static_file = STATIC_DIR / full_path
    if static_file.exists() and static_file.is_file():
        return FileResponse(static_file)
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"detail": "frontend not built — run pnpm build"}
