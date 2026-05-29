import asyncio
import json
import os
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

SATELLITES_PATH = Path(os.getenv("SATELLITES_PATH", "/app/satellites.json"))
STATIC_DIR = Path(__file__).parent / "static"
VERSION = "0.1.0"

app = FastAPI()


def load_satellites() -> list[dict]:
    if not SATELLITES_PATH.exists():
        print(f"Warning: satellites.json not found at {SATELLITES_PATH}")
        return []
    return json.loads(SATELLITES_PATH.read_text())


async def fetch_widget(client: httpx.AsyncClient, sat: dict) -> dict:
    widget_url = sat.get("widget_url")
    public = {k: v for k, v in sat.items() if k != "widget_url"}
    if not widget_url:
        return {**public, "widget": None}
    try:
        r = await client.get(widget_url)
        r.raise_for_status()
        return {**public, "widget": r.json()}
    except Exception:
        return {
            **public,
            "widget": {
                "status": "error",
                "title": sat["name"],
                "summary": "unreachable",
                "metrics": [],
            },
        }


@app.get("/api/config")
def get_config():
    return {
        "hostname": os.getenv("HOSTNAME_DISPLAY", os.uname().nodename),
        "version": VERSION,
    }


@app.get("/api/satellites")
async def get_satellites():
    satellites = load_satellites()
    async with httpx.AsyncClient(timeout=5.0) as client:
        results = await asyncio.gather(*(fetch_widget(client, s) for s in satellites))
    return list(results)


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
