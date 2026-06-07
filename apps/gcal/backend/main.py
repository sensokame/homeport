import json
import os
from datetime import date, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import recurring_ical_events
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from icalendar import Calendar
from pydantic import BaseModel

STATIC_DIR = Path(__file__).parent / "static"
DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))
TRADES_FILE = DATA_DIR / "trades.json"
GCAL_ICS_URL = os.getenv("GCAL_ICS_URL", "")
TZ = ZoneInfo("Europe/Berlin")

app = FastAPI()


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
    return {"widgets": [
        {"id": "calendar.overview", "name": "Calendar",
         "description": "Current calendar block with one-click trade acknowledgment",
         "configSchema": {}},
    ]}


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


# ── Static ────────────────────────────────────────────────────────────────────

app.mount("/", StaticFiles(directory=STATIC_DIR, html=True))
