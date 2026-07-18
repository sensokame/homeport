from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI()


# workspace-sat composes other satellites' widgets in the hub's frontend (via the
# renderWidget prop) — it has no data of its own, so there's nothing to proxy here.
@app.get("/api/catalog")
def catalog():
    return {"widgets": [
        {"id": "workspace.panel", "name": "Workspace",
         "description": "Composes widgets from other satellites into one card — "
                         "either a manual slot list, or every project-providing "
                         "satellite's view for one vault project slug",
         "configSchema": {
             "label": {"type": "string", "label": "Label", "required": True},
             "mode": {"type": "string", "label": "Mode (\"project\" or omit for manual slots)"},
             "slug": {"type": "string", "label": "Project slug (project mode only)"},
         }},
    ]}


@app.get("/health")
def health():
    return {"status": "ok"}


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
