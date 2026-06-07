import os
from datetime import date, datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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


def wger_post(path: str, body: dict):
    try:
        r = httpx.post(
            f"{WGER_URL}{path}",
            headers={**headers(), "Content-Type": "application/json"},
            json=body,
            timeout=5,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return r.json()
    except HTTPException:
        raise
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
    today_weekday = date.today().weekday()
    try:
        days = wger_get("/day/", {"format": "json", "limit": 100}).get("results", [])
        return any(today_weekday in d.get("day", []) for d in days)
    except Exception:
        return False


def fetch_nutrition_today():
    data = wger_get("/nutritiondiary/", {"format": "json", "limit": 100})
    today = today_str()
    return [e for e in data.get("results", []) if e.get("datetime", "").startswith(today)]


# ── Catalog ───────────────────────────────────────────────────────────────────

@app.get("/api/catalog")
def catalog():
    return {"widgets": [
        {"id": "fitness.overview", "name": "Fitness",
         "description": "Today's workout status, active routine, and nutrition log count",
         "configSchema": {}},
    ]}


# ── read endpoints ────────────────────────────────────────────────────────────

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


@app.get("/api/exercises")
def search_exercises(q: str):
    results = wger_get("/exercise/search/", {"term": q, "language": "english", "format": "json"})
    suggestions = results.get("suggestions", [])
    return [{"id": s["data"]["base_id"], "name": s["value"]} for s in suggestions]


@app.get("/api/today-exercises")
def get_today_exercises():
    today_weekday = date.today().weekday()
    days_data = wger_get("/day/", {"format": "json", "limit": 100}).get("results", [])
    today_days = [d for d in days_data if today_weekday in d.get("day", [])]

    if not today_days:
        return {"scheduled": False, "exercises": [], "logs": []}

    seen: set[int] = set()
    exercise_ids: list[int] = []
    for day in today_days:
        slots = wger_get("/slot/", {"format": "json", "day": day["id"], "limit": 100}).get("results", [])
        for slot in slots:
            entries = wger_get("/slot-entry/", {"format": "json", "slot": slot["id"], "limit": 100}).get("results", [])
            for e in entries:
                eid = e["exercise"]
                if eid not in seen:
                    seen.add(eid)
                    exercise_ids.append(eid)

    exercises = []
    for eid in exercise_ids:
        try:
            info = wger_get(f"/exerciseinfo/{eid}/")
            translations = info.get("translations", [])
            name = next((t["name"] for t in translations if t.get("language") == 2), None)
            if not name and translations:
                name = translations[0].get("name")
            exercises.append({"id": eid, "name": name or f"Exercise {eid}"})
        except Exception:
            exercises.append({"id": eid, "name": f"Exercise {eid}"})

    logs_data = wger_get("/workoutlog/", {"format": "json", "limit": 100})
    today = today_str()
    logs = [l for l in logs_data.get("results", []) if l.get("date", "").startswith(today)]
    set_counts: dict[int, int] = {}
    for l in logs:
        eid = l["exercise"]
        set_counts[eid] = set_counts.get(eid, 0) + 1

    return {
        "scheduled": True,
        "exercises": [
            {"id": ex["id"], "name": ex["name"], "logged": ex["id"] in set_counts, "set_count": set_counts.get(ex["id"], 0)}
            for ex in exercises
        ],
        "logs": logs,
    }


@app.get("/api/ingredients")
def search_ingredients(q: str):
    results = wger_get("/ingredient/", {"format": "json", "name": q, "limit": 20})
    return [{"id": i["id"], "name": i["name"]} for i in results.get("results", [])]


# ── write endpoints ───────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    workout_id: int | None = None
    notes: str = ""


@app.post("/api/session")
def create_session(body: SessionCreate):
    existing = fetch_today_session()
    if existing:
        return {"created": False, "session": existing}

    workout_id = body.workout_id
    if not workout_id:
        routines = fetch_routines()
        if not routines:
            raise HTTPException(status_code=400, detail="No routines found in wger")
        workout_id = routines[0]["id"]

    session = wger_post("/workoutsession/", {
        "workout": workout_id,
        "date": today_str(),
        "notes": body.notes,
        "impression": "3",
    })
    return {"created": True, "session": session}


class LogEntry(BaseModel):
    exercise_id: int
    workout_id: int  # routine ID (session.workout)
    repetitions: int
    weight: float
    weight_unit: int = 1  # 1=kg, 2=lbs
    rir: int | None = None
    date: str | None = None  # YYYY-MM-DD, defaults to today


@app.post("/api/log")
def log_set(body: LogEntry):
    payload = {
        "exercise": body.exercise_id,
        "workout": body.workout_id,
        "repetitions": body.repetitions,
        "weight": str(body.weight),
        "weight_unit": body.weight_unit,
        "date": body.date or today_str(),
    }
    if body.rir is not None:
        payload["rir"] = body.rir
    return wger_post("/workoutlog/", payload)


class NutritionDiaryEntry(BaseModel):
    plan_id: int
    ingredient_id: int
    amount: float
    weight_unit: str | None = None
    logged_at: str | None = None  # ISO datetime, defaults to now


@app.post("/api/nutrition-diary")
def log_nutrition_diary(body: NutritionDiaryEntry):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    payload = {
        "plan": body.plan_id,
        "ingredient": body.ingredient_id,
        "amount": str(body.amount),
        "datetime": body.logged_at or now,
    }
    if body.weight_unit:
        payload["weight_unit"] = body.weight_unit
    return wger_post("/nutritiondiary/", payload)


# ── health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
