import json
import os
import re
from contextlib import asynccontextmanager
from datetime import date, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import recurring_ical_events
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from icalendar import Calendar
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Route

STATIC_DIR = Path(__file__).parent / "static"
DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))
TRADES_FILE = DATA_DIR / "trades.json"
GCAL_ICS_URL = os.getenv("GCAL_ICS_URL", "")
FOCUS_FILE = Path(os.getenv("FOCUS_FILE", "")) if os.getenv("FOCUS_FILE") else None
TZ = ZoneInfo("Europe/Berlin")

app = FastAPI()


def _parse_focus() -> dict:
    if not FOCUS_FILE or not FOCUS_FILE.exists():
        return {"fields": {}, "today": None}

    lines = FOCUS_FILE.read_text().splitlines()

    # Isolate the ## Focus section
    in_focus = False
    focus_lines: list[str] = []
    for line in lines:
        if re.match(r"^## Focus\b", line):
            in_focus = True
            continue
        if in_focus and re.match(r"^## ", line):
            break
        if in_focus:
            focus_lines.append(line)

    # Collect all key: value lines into lists
    fields: dict[str, list[str]] = {}
    for line in focus_lines:
        m = re.match(r"^(\w+):\s*(.+)", line)
        if m:
            key, val = m.group(1), m.group(2).strip()
            if val:
                fields.setdefault(key, []).append(val)

    # Extract today's dated note
    today_str = date.today().isoformat()
    today_lines: list[str] = []
    in_today = False
    for line in focus_lines:
        if re.match(rf"^### {re.escape(today_str)}", line):
            in_today = True
            continue
        if in_today and re.match(r"^### ", line):
            break
        if in_today and line.strip():
            today_lines.append(line.strip())

    return {"fields": fields, "today": " ".join(today_lines) or None}


def _load_trades() -> dict:
    if TRADES_FILE.exists():
        return json.loads(TRADES_FILE.read_text())
    return {}


def _save_trades(trades: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TRADES_FILE.write_text(json.dumps(trades, indent=2))


async def _fetch_events_today() -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(GCAL_ICS_URL)
        r.raise_for_status()

    cal = Calendar.from_ical(r.content)
    today = date.today()
    day_start = datetime.combine(today, time.min, tzinfo=TZ)
    day_end = datetime.combine(today, time.max, tzinfo=TZ)

    events = []
    for e in recurring_ical_events.of(cal).between(day_start, day_end):
        dtstart = e.get("DTSTART").dt
        dtend = e.get("DTEND").dt

        if not isinstance(dtstart, datetime):
            continue  # skip all-day events

        dtstart = dtstart.astimezone(TZ) if dtstart.tzinfo else dtstart.replace(tzinfo=TZ)
        dtend = dtend.astimezone(TZ) if dtend.tzinfo else dtend.replace(tzinfo=TZ)

        events.append({
            "id": str(e.get("UID", "")),
            "title": str(e.get("SUMMARY", "(no title)")),
            "start": dtstart.isoformat(),
            "end": dtend.isoformat(),
            "start_time": dtstart.strftime("%H:%M"),
            "end_time": dtend.strftime("%H:%M"),
            "_start_dt": dtstart,
            "_end_dt": dtend,
        })

    events.sort(key=lambda e: e["_start_dt"])
    return events


# ── Catalog ───────────────────────────────────────────────────────────────────

@app.get("/api/catalog")
def catalog():
    return {
        "widgets": [
            {"id": "calendar.overview", "name": "Calendar",
             "description": "Current calendar block with one-click trade acknowledgment",
             "configSchema": {}},
        ],
        "mcp": {"url": "http://gcal-sat:8080/mcp"},
    }


# ── Focus ─────────────────────────────────────────────────────────────────────

@app.get("/api/focus")
def focus():
    return _parse_focus()


# ── Status ────────────────────────────────────────────────────────────────────

@app.get("/api/status")
def status():
    return {"configured": bool(GCAL_ICS_URL)}


# ── Events ────────────────────────────────────────────────────────────────────

@app.get("/api/events/today")
async def events_today():
    if not GCAL_ICS_URL:
        return JSONResponse({"error": "GCAL_ICS_URL not configured"}, status_code=503)

    events = await _fetch_events_today()
    today_trades = _load_trades().get(date.today().isoformat(), {})

    for e in events:
        e["traded"] = e["id"] in today_trades
        del e["_start_dt"]
        del e["_end_dt"]

    return {"events": events}


# ── Trade ─────────────────────────────────────────────────────────────────────

class TradeRequest(BaseModel):
    event_id: str
    event_title: str


@app.post("/api/trade")
def record_trade(req: TradeRequest):
    trades = _load_trades()
    today_key = date.today().isoformat()
    if today_key not in trades:
        trades[today_key] = {}
    trades[today_key][req.event_id] = {
        "event_title": req.event_title,
        "traded_at": datetime.now(TZ).isoformat(),
    }
    _save_trades(trades)
    return {"ok": True}


# ── Widget ────────────────────────────────────────────────────────────────────

@app.get("/widget")
async def widget():
    if not GCAL_ICS_URL:
        return {"configured": False, "current": None, "next": None}

    events = await _fetch_events_today()
    today_trades = _load_trades().get(date.today().isoformat(), {})
    now = datetime.now(TZ)

    current = None
    next_event = None

    for e in events:
        if e["_start_dt"] <= now < e["_end_dt"]:
            current = {
                "id": e["id"],
                "title": e["title"],
                "start": e["start"],
                "end": e["end"],
                "start_time": e["start_time"],
                "end_time": e["end_time"],
                "traded": e["id"] in today_trades,
            }
        elif e["_start_dt"] > now and next_event is None:
            next_event = {
                "id": e["id"],
                "title": e["title"],
                "start_time": e["start_time"],
                "end_time": e["end_time"],
            }

    return {"configured": True, "current": current, "next": next_event}


# ── MCP (read-only — mirrors knowledge-sat, see homeport vault agent-integration.md) ──
# Resources wrap the same REST handlers above; no duplicated logic.

mcp_server = FastMCP(
    "gcal",
    streamable_http_path="/",
    # No auth on any REST route here either — internal-network-only satellite.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


@mcp_server.resource("gcal://focus/today", mime_type="application/json")
def mcp_focus_today() -> dict:
    """Weekly focus fields plus today's dated note from life/focus.md."""
    return focus()


@mcp_server.resource("gcal://events/today", mime_type="application/json")
async def mcp_events_today() -> dict:
    """Today's calendar events, with trade-acknowledgment flags."""
    result = await events_today()
    if isinstance(result, JSONResponse):
        raise ValueError("GCAL_ICS_URL not configured")
    return result


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
    rather than relying on Starlette's redirect-slash fallback — this satellite's
    catch-all is a StaticFiles Mount("/", ...) rather than a Route, which is why
    this /mcp mount+route is registered *before* it below: Starlette's Mount
    matching doesn't filter by method, so a catch-all Mount registered first
    would swallow every request path, /mcp included, regardless of method. Must
    be a callable *instance* — see reference_mcp_streamable_http_fastapi_mount
    for why a plain function would default to GET-only and reintroduce the bug."""

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope["path"] = "/"
        await mcp_app(scope, receive, send)


app.router.routes.append(Route("/mcp", endpoint=_McpBareMount()))


# ── Static ────────────────────────────────────────────────────────────────────

app.mount("/", StaticFiles(directory=STATIC_DIR, html=True))
