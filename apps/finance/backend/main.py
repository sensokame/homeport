import json
import os
import subprocess
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).parent / "static"
DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))

SC_BIN = os.getenv("SC_BIN", "sc")
SC_TIMEOUT_SECONDS = 10

app = FastAPI()


def run_sc(*args: str) -> dict:
    result = subprocess.run(
        [SC_BIN, *args, "--json"],
        capture_output=True,
        text=True,
        timeout=SC_TIMEOUT_SECONDS,
    )
    payload = json.loads(result.stdout)
    if not payload.get("ok"):
        raise RuntimeError(payload.get("error", "sc CLI returned ok=false"))
    return payload["data"]["result"]


def fetch_portfolio() -> dict:
    overview = run_sc("broker", "overview")
    holdings = run_sc("broker", "holdings")
    cash = run_sc("broker", "cash-breakdown")

    return {
        "configured": True,
        "totalValue": overview["valuation"]["total"],
        "cash": cash["cash_balance"],
        "holdings": [
            {
                "isin": item["isin"],
                "name": item["name"],
                "quantity": item["quantity"],
                "valuation": item["valuation"],
                "currency": item["valuation_currency"],
            }
            for item in holdings["items"]
        ],
    }


@app.get("/api/catalog")
def catalog():
    return {
        "widgets": [
            {"id": "finance.overview", "name": "Finance",
             "description": "Portfolio overview and trade proposals",
             "configSchema": {}},
        ],
    }


@app.get("/api/status")
def status():
    try:
        fetch_portfolio()
        return {"configured": True}
    except Exception:
        return {"configured": False}


@app.get("/api/portfolio")
def portfolio():
    try:
        return fetch_portfolio()
    except Exception as exc:
        return {"configured": False, "error": str(exc)}


@app.get("/widget")
def widget():
    return {"configured": True}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True))
