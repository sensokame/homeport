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
    today_is_training = date.today().weekday() in TRAINING_DAYS

    # Determine next A/B
    try:
        last = fetch_last_session()
        if last:
            notes = (last.get("notes") or "").strip()
            next_letter = "B" if notes.startswith("A") else "A"
        else:
            next_letter = "A"
    except Exception:
        next_letter = None

    if logged_today:
        day_name = (session.get("notes") or "").strip() or "—"
        status = "ok"
        summary = f"Logged: {day_name}"
    elif today_is_training:
        status = "warn"
        next_label = f"Session {next_letter}" if next_letter else "workout"
        summary = f"{next_label} — not logged yet"
    else:
        status = "ok"
        next_label = f"Session {next_letter}" if next_letter else ""
        summary = f"Rest day · Up next: {next_label}" if next_label else "Rest day"

    if meals_today > 0:
        summary += f" · {meals_today} meal entr{'y' if meals_today == 1 else 'ies'} logged"

    return {
        "title": "Fitness",
        "status": status,
        "summary": summary,
        "metrics": [
            {"label": "Today", "value": (session.get("notes") or "Logged ✓") if logged_today else ("Training day" if today_is_training else "Rest day")},
            {"label": "Up next", "value": f"Session {next_letter}" if next_letter else "—"},
            {"label": "Meals logged", "value": meals_today},
        ],
    }


@app.get("/api/today")
def get_today():
    session = fetch_today_session()
    nutrition = fetch_nutrition_today()

    workout_logs = []
    logged: list[dict] = []
    if session:
        try:
            logs = wger_get("/workoutlog/", {"format": "json", "limit": 100, "workout": session["workout"]})
            workout_logs = logs.get("results", [])
            set_counts: dict[int, int] = {}
            for log in workout_logs:
                eid = log["exercise"]
                set_counts[eid] = set_counts.get(eid, 0) + 1
            for eid, count in set_counts.items():
                name = f"Exercise {eid}"
                try:
                    info = wger_get(f"/exerciseinfo/{eid}/")
                    translations = info.get("translations", [])
                    en = next((t for t in translations if t.get("language") == 2), None)
                    best = en or (translations[0] if translations else None)
                    if best:
                        name = best.get("name", name)
                except Exception:
                    pass
                logged.append({"exercise_id": eid, "name": name, "sets": count})
        except Exception:
            pass

    return {
        "session": session,
        "logs": workout_logs,
        "logged": logged,
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
    page_url = f"{WGER_URL}/exercise-translation/?format=json&language=2&limit=100"
    matches = []
    q_lower = q.lower()
    while page_url and len(matches) < 20:
        try:
            r = httpx.get(page_url, headers=headers(), timeout=10)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))
        for item in data.get("results", []):
            if q_lower in item["name"].lower():
                matches.append({"id": item["exercise"], "name": item["name"]})
        page_url = data.get("next") if len(matches) < 5 else None
    return matches


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

TRAINING_DAYS = {1, 3, 5}  # Tue, Thu, Sat (0=Mon)


def fetch_last_session():
    data = wger_get("/workoutsession/", {"format": "json", "limit": 10, "ordering": "-date"})
    results = data.get("results", [])
    today = today_str()
    for s in results:
        if not s.get("date", "").startswith(today):
            return s
    return None


@app.get("/api/next-session")
def get_next_session():
    last = fetch_last_session()
    today_is_training = date.today().weekday() in TRAINING_DAYS
    today_session = fetch_today_session()

    if last:
        notes = (last.get("notes") or "").strip()
        next_letter = "B" if notes.startswith("A") else "A"
    else:
        next_letter = "A"  # no history → start with A

    return {
        "next": next_letter,
        "training_day_today": today_is_training,
        "logged_today": today_session is not None,
        "last_session": {
            "date": last["date"] if last else None,
            "day_name": (last.get("notes") or "").strip() if last else None,
        },
    }


class SessionCreate(BaseModel):
    workout_id: int | None = None
    day_name: str = ""  # e.g. "A - Gym" — stored in notes for A/B tracking


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
        "notes": body.day_name,
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


class NutritionPlanCreate(BaseModel):
    description: str = "Daily"
    energy_unit: int = 1  # 1=kcal, 2=kJ


@app.post("/api/nutrition-plan")
def create_nutrition_plan(body: NutritionPlanCreate):
    return wger_post("/nutritionplan/", {"description": body.description, "energy_unit": body.energy_unit})


@app.delete("/api/nutrition-diary/{diary_id}")
def delete_nutrition_diary(diary_id: int):
    try:
        r = httpx.delete(f"{WGER_URL}/nutritiondiary/{diary_id}/", headers=headers(), timeout=5)
        if r.status_code >= 400:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class DiaryUpdate(BaseModel):
    amount: float


@app.patch("/api/nutrition-diary/{diary_id}")
def update_nutrition_diary(diary_id: int, body: DiaryUpdate):
    try:
        r = httpx.patch(
            f"{WGER_URL}/nutritiondiary/{diary_id}/",
            headers={**headers(), "Content-Type": "application/json"},
            json={"amount": str(body.amount)},
            timeout=5,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class PlanGoalsUpdate(BaseModel):
    goal_energy: float | None = None
    goal_protein: float | None = None
    goal_carbohydrates: float | None = None
    goal_fat: float | None = None
    goal_fiber: float | None = None


@app.patch("/api/nutrition-plan/{plan_id}/goals")
def update_plan_goals(plan_id: int, body: PlanGoalsUpdate):
    payload = {k: str(v) for k, v in body.model_dump().items() if v is not None}
    try:
        r = httpx.patch(
            f"{WGER_URL}/nutritionplan/{plan_id}/",
            headers={**headers(), "Content-Type": "application/json"},
            json=payload,
            timeout=5,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


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


# ── routine management ────────────────────────────────────────────────────────

class RoutineCreate(BaseModel):
    name: str
    description: str = ""
    start: str | None = None  # YYYY-MM-DD, defaults to today
    end: str | None = None    # YYYY-MM-DD, defaults to +1 year


@app.post("/api/routine")
def create_routine(body: RoutineCreate):
    from datetime import timedelta
    start = body.start or date.today().isoformat()
    end = body.end or (date.today() + timedelta(days=119)).isoformat()
    return wger_post("/routine/", {
        "name": body.name,
        "description": body.description,
        "start": start,
        "end": end,
    })


@app.delete("/api/routine/{routine_id}")
def delete_routine(routine_id: int):
    try:
        r = httpx.delete(f"{WGER_URL}/routine/{routine_id}/", headers=headers(), timeout=5)
        if r.status_code >= 400:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class DayCreate(BaseModel):
    routine_id: int
    name: str
    weekdays: list[int]  # 0=Monday … 6=Sunday


@app.post("/api/day")
def create_day(body: DayCreate):
    return wger_post("/day/", {"routine": body.routine_id, "name": body.name, "day": body.weekdays})


class ExerciseToDay(BaseModel):
    day_id: int
    exercise_id: int


@app.post("/api/exercise-to-day")
def add_exercise_to_day(body: ExerciseToDay):
    slots = wger_get("/slot/", {"format": "json", "day": body.day_id, "limit": 100}).get("results", [])
    order = len(slots) + 1
    slot = wger_post("/slot/", {"day": body.day_id, "order": order})
    entry = wger_post("/slot-entry/", {"slot": slot["id"], "exercise": body.exercise_id, "order": 1})
    return {"slot_id": slot["id"], "entry_id": entry["id"], "exercise_id": body.exercise_id}


# ── all-days ──────────────────────────────────────────────────────────────────

@app.get("/api/all-days")
def get_all_days():
    days_data = wger_get("/day/", {"format": "json", "limit": 100}).get("results", [])
    result = []
    for day in days_data:
        slots = wger_get("/slot/", {"format": "json", "day": day["id"], "limit": 100}).get("results", [])
        seen: set[int] = set()
        exercise_ids: list[int] = []
        for slot in slots:
            entries = wger_get("/slot-entry/", {"format": "json", "slot": slot["id"], "limit": 100}).get("results", [])
            for entry in entries:
                eid = entry["exercise"]
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
        result.append({
            "id": day["id"],
            "name": day["name"],
            "weekdays": day.get("day", []),
            "day_names": [DAYS[i] for i in day.get("day", []) if 0 <= i <= 6],
            "exercises": exercises,
        })
    return {"days": result}


# ── weight tracking ───────────────────────────────────────────────────────────

@app.get("/api/weight")
def get_weight():
    data = wger_get("/weightentry/", {"format": "json", "limit": 7, "ordering": "-date"})
    return {"entries": [{"id": e["id"], "date": e["date"], "weight": e["weight"]} for e in data.get("results", [])]}


class WeightCreate(BaseModel):
    weight: float
    date: str | None = None


@app.post("/api/weight")
def log_weight(body: WeightCreate):
    entry = wger_post("/weightentry/", {"date": body.date or today_str(), "weight": str(body.weight)})
    return {"id": entry["id"], "date": entry["date"], "weight": entry["weight"]}


# ── personal records ───────────────────────────────────────────────────────────

@app.get("/api/records")
def get_records():
    days_data = wger_get("/day/", {"format": "json", "limit": 100}).get("results", [])
    seen: set[int] = set()
    exercise_ids: list[int] = []

    for day in days_data:
        slots = wger_get("/slot/", {"format": "json", "day": day["id"], "limit": 100}).get("results", [])
        for slot in slots:
            entries = wger_get("/slot-entry/", {"format": "json", "slot": slot["id"], "limit": 100}).get("results", [])
            for e in entries:
                eid = e["exercise"]
                if eid not in seen:
                    seen.add(eid)
                    exercise_ids.append(eid)

    if not exercise_ids:
        return {"records": []}

    names: dict[int, str] = {}
    for eid in exercise_ids:
        try:
            info = wger_get(f"/exerciseinfo/{eid}/")
            translations = info.get("translations", [])
            name = next((t["name"] for t in translations if t.get("language") == 2), None)
            if not name and translations:
                name = translations[0].get("name")
            names[eid] = name or f"Exercise {eid}"
        except Exception:
            names[eid] = f"Exercise {eid}"

    all_logs = wger_get("/workoutlog/", {"format": "json", "limit": 500, "ordering": "-date"}).get("results", [])

    records = []
    for eid in exercise_ids:
        logs = [l for l in all_logs if l.get("exercise") == eid]
        if not logs:
            continue
        max_weight = max((float(l.get("weight") or 0) for l in logs), default=0)
        if max_weight > 0:
            best = max(logs, key=lambda l: float(l.get("weight") or 0))
            records.append({
                "exercise_id": eid, "name": names[eid],
                "best_weight": max_weight, "best_reps": best.get("repetitions", 0),
                "date": best.get("date"), "type": "weighted",
            })
        else:
            best = max(logs, key=lambda l: l.get("repetitions", 0))
            records.append({
                "exercise_id": eid, "name": names[eid],
                "best_weight": 0, "best_reps": best.get("repetitions", 0),
                "date": best.get("date"), "type": "bodyweight",
            })

    return {"records": records}


# ── exercise info ──────────────────────────────────────────────────────────────

@app.get("/api/exercise/{exercise_id}/info")
def get_exercise_info(exercise_id: int):
    info = wger_get(f"/exerciseinfo/{exercise_id}/")
    translations = info.get("translations", [])
    t = next((t for t in translations if t.get("language") == 2), translations[0] if translations else {})
    return {
        "id": exercise_id,
        "name": t.get("name", f"Exercise {exercise_id}"),
        "description": t.get("description", ""),
        "has_image": bool(info.get("images")),
        "muscles": [m.get("name_en") for m in info.get("muscles", []) if m.get("name_en")],
        "equipment": [e.get("name") for e in info.get("equipment", []) if e.get("name")],
    }


# ── today meals (with resolved ingredient names) ───────────────────────────────

@app.get("/api/today-meals")
def get_today_meals():
    diary = fetch_nutrition_today()
    plans = wger_get("/nutritionplan/", {"format": "json"}).get("results", [])
    plan = plans[0] if plans else None
    plan_id = plan["id"] if plan else None

    resolved = []
    total_energy = total_protein = total_carbs = total_fat = 0.0

    for entry in diary:
        iid = entry.get("ingredient")
        try:
            ing = wger_get(f"/ingredient/{iid}/")
            name = ing.get("name", f"Item {iid}")
            factor = float(entry.get("amount", 0)) / 100.0
            energy = round(float(ing.get("energy") or 0) * factor, 1)
            protein = round(float(ing.get("protein") or 0) * factor, 1)
            carbs = round(float(ing.get("carbohydrates") or 0) * factor, 1)
            fat = round(float(ing.get("fat") or 0) * factor, 1)
            total_energy += energy
            total_protein += protein
            total_carbs += carbs
            total_fat += fat
        except Exception:
            name = f"Item {iid}"
            energy = protein = carbs = fat = 0.0
        resolved.append({
            "id": entry["id"],
            "ingredient_id": iid,
            "ingredient_name": name,
            "amount": entry.get("amount", "0"),
            "energy": energy,
            "protein": protein,
            "carbohydrates": carbs,
            "fat": fat,
        })

    return {
        "plan_id": plan_id,
        "entries": resolved,
        "totals": {
            "energy": round(total_energy, 1),
            "protein": round(total_protein, 1),
            "carbohydrates": round(total_carbs, 1),
            "fat": round(total_fat, 1),
        },
        "goals": {
            "energy": plan.get("goal_energy"),
            "protein": plan.get("goal_protein"),
            "carbohydrates": plan.get("goal_carbohydrates"),
            "fat": plan.get("goal_fat"),
        } if plan else None,
    }


# ── health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
