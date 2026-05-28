import os
from datetime import date, datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

WGER_URL = os.getenv("WGER_URL", "http://wger/api/v2")
WGER_TOKEN = os.getenv("WGER_TOKEN", "")
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI()

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def headers():
    return {"Authorization": f"Token {WGER_TOKEN}"}


def wger_get(path: str, params: dict = None):
    try:
        r = httpx.get(f"{WGER_URL}{path}", headers=headers(), params=params, timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


def today_str():
    return date.today().isoformat()


def fetch_today_session():
    data = wger_get("/workoutsession/", {"format": "json", "limit": 10})
    today = today_str()
    for s in data.get("results", []):
        if s.get("date", "").startswith(today):
            return s
    return None


def fetch_routines():
    return wger_get("/routine/", {"format": "json"}).get("results", [])


def fetch_scheduled_today():
    """Check if today's weekday has a scheduled training day in any routine."""
    today_weekday = date.today().weekday()  # 0=Monday
    try:
        days = wger_get("/day/", {"format": "json", "limit": 100}).get("results", [])
        return any(today_weekday in d.get("day", []) for d in days)
    except Exception:
        return False


def fetch_nutrition_today():
    data = wger_get("/nutritiondiary/", {"format": "json", "limit": 100})
    today = today_str()
    return [e for e in data.get("results", []) if e.get("datetime", "").startswith(today)]


@app.get("/widget")
def widget():
    try:
        session = fetch_today_session()
        routines = fetch_routines()
        scheduled = fetch_scheduled_today()
        nutrition = fetch_nutrition_today()
    except HTTPException:
        return {
            "title": "Fitness",
            "status": "error",
            "summary": "Could not reach wger",
            "metrics": [],
        }

    routine_name = routines[0]["name"] if routines else None
    logged_today = session is not None
    meals_today = len(nutrition)

    if scheduled and not logged_today:
        status = "warn"
        summary = "Workout scheduled — not logged yet"
    elif logged_today:
        status = "ok"
        summary = "Workout logged today"
    else:
        status = "ok"
        summary = "Rest day"

    if meals_today > 0:
        summary += f" · {meals_today} meal entr{'y' if meals_today == 1 else 'ies'} logged"

    return {
        "title": "Fitness",
        "status": status,
        "summary": summary,
        "metrics": [
            {"label": "Today's workout", "value": "Logged ✓" if logged_today else ("Scheduled" if scheduled else "Rest day")},
            {"label": "Active routine", "value": routine_name or "—"},
            {"label": "Meals logged", "value": meals_today},
        ],
    }


@app.get("/api/today")
def get_today():
    session = fetch_today_session()
    nutrition = fetch_nutrition_today()

    workout_logs = []
    if session:
        try:
            logs = wger_get("/workoutlog/", {"format": "json", "limit": 100, "workout": session["workout"]})
            workout_logs = logs.get("results", [])
        except Exception:
            pass

    return {
        "session": session,
        "logs": workout_logs,
        "nutrition": nutrition,
    }


@app.get("/api/plan")
def get_plan():
    routines = fetch_routines()
    days = []
    try:
        days = wger_get("/day/", {"format": "json", "limit": 100}).get("results", [])
    except Exception:
        pass

    return {
        "routines": routines,
        "days": [
            {**d, "day_names": [DAYS[i] for i in d.get("day", []) if 0 <= i <= 6]}
            for d in days
        ],
    }


@app.get("/api/nutrition")
def get_nutrition():
    plans = wger_get("/nutritionplan/", {"format": "json"}).get("results", [])
    diary = fetch_nutrition_today()
    return {"plans": plans, "diary_today": diary}


@app.get("/health")
def health():
    return {"status": "ok"}


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
