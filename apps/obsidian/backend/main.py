import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate
from pathlib import Path
from urllib.parse import quote

import httpx
import frontmatter
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

VAULT_PATH = Path(os.getenv("VAULT_PATH", "/vault"))
GOODREADS_USER_ID = os.getenv("GOODREADS_USER_ID", "")
GOODREADS_FEED = f"https://www.goodreads.com/review/list_rss/{GOODREADS_USER_ID}?shelf=currently-reading"
QUARTZ_URL = os.getenv("QUARTZ_URL", "http://quartz.station")

BOOKS_PATH = VAULT_PATH / "life" / "Books"
STATIC_DIR = Path(__file__).parent / "static"
_YEAR_RE = re.compile(r"^\d{4}$")

app = FastAPI()


def _slugify(name: str) -> str:
    return name.lower().replace(" ", "-")


def _clean_title(title: str) -> str:
    """Use the portion before ':' as the short title (matches how notes are named)."""
    return title.split(":")[0].strip() if ":" in title else title


def _find_vault_note(title: str) -> str | None:
    if not BOOKS_PATH.exists():
        return None
    candidates = {_slugify(title), _slugify(_clean_title(title))}
    for year_dir in BOOKS_PATH.iterdir():
        if not year_dir.is_dir() or not _YEAR_RE.match(year_dir.name):
            continue
        for md_file in year_dir.glob("*.md"):
            if _slugify(md_file.stem) in candidates:
                path = f"life/books/{year_dir.name}/{quote(_slugify(md_file.stem))}"
                return f"{QUARTZ_URL}/{path}"
    return None


def _count_by_year() -> dict[str, int]:
    if not BOOKS_PATH.exists():
        return {}
    counts: dict[str, int] = {}
    for year_dir in sorted(BOOKS_PATH.iterdir()):
        if year_dir.is_dir() and _YEAR_RE.match(year_dir.name):
            n = sum(1 for f in year_dir.glob("*.md") if f.is_file())
            if n:
                counts[year_dir.name] = n
    return counts


def _parse_year(date_str: str) -> int:
    t = parsedate(date_str)
    return t[0] if t else datetime.now(timezone.utc).year


def _note_content(book: dict) -> str:
    lines = ["## summary"]
    if book.get("goodreads_url"):
        lines.append(f'[{book["title"]}]({book["goodreads_url"]})')
    if book.get("author"):
        lines.append(f'by {book["author"]}')
    if book.get("year"):
        lines.append(f'Published: {book["year"]}')
    lines += [
        "",
        "## verdict",
        "",
        "## about the author",
        book.get("author", ""),
        "",
        "## while reading",
        "",
        "## reading experience",
        "",
    ]
    return "\n".join(lines)


def fetch_goodreads():
    if not GOODREADS_USER_ID:
        return []
    try:
        r = httpx.get(GOODREADS_FEED, timeout=5, follow_redirects=True)
        r.raise_for_status()
        root = ET.fromstring(r.text)
        books = []
        for item in root.findall(".//item"):
            title = item.findtext("title", "").strip()
            author = item.findtext("author_name", "").strip()
            if title:
                books.append({"title": title, "author": author})
        return books
    except Exception:
        return []


def _fetch_shelf(shelf: str) -> list:
    if not GOODREADS_USER_ID:
        return []
    url = f"https://www.goodreads.com/review/list_rss/{GOODREADS_USER_ID}?shelf={shelf}"
    try:
        r = httpx.get(url, timeout=8, follow_redirects=True)
        r.raise_for_status()
        root = ET.fromstring(r.text)
        books = []
        for item in root.findall(".//item"):
            title = item.findtext("title", "").strip()
            if not title:
                continue
            year_raw = item.findtext("book_published", "").strip()
            added_raw = item.findtext("user_date_added", "").strip()
            rating_raw = item.findtext("user_rating", "0").strip()
            books.append({
                "title": title,
                "author": item.findtext("author_name", "").strip(),
                "year": int(year_raw) if year_raw.isdigit() else None,
                "added_year": _parse_year(added_raw) if added_raw else datetime.now(timezone.utc).year,
                "goodreads_url": item.findtext("link", "").strip(),
                "cover_url": item.findtext("book_image_url", "").strip(),
                "average_rating": item.findtext("average_rating", "").strip(),
                "user_rating": int(rating_raw) if rating_raw.isdigit() else 0,
                "vault_url": _find_vault_note(title),
            })
        return books
    except Exception:
        return []


def fetch_goodreads_detailed():
    return _fetch_shelf("currently-reading")


def scan_vault_activity():
    now = datetime.now(tz=timezone.utc)
    week_ago = now - timedelta(days=7)
    count = 0
    for md_file in VAULT_PATH.rglob("*.md"):
        try:
            mtime = datetime.fromtimestamp(md_file.stat().st_mtime, tz=timezone.utc)
            if mtime >= week_ago:
                count += 1
        except Exception:
            continue
    return count


def scan_vault_reading():
    reading = []
    for md_file in VAULT_PATH.rglob("*.md"):
        try:
            post = frontmatter.load(md_file)
            if str(post.get("status", "")).lower() == "reading":
                reading.append({
                    "title": post.get("title", md_file.stem),
                    "author": post.get("author", ""),
                })
        except Exception:
            continue
    return reading


@app.get("/widget")
def widget():
    books = fetch_goodreads() or scan_vault_reading()
    active_count = scan_vault_activity()

    if books:
        current = books[0]
        title = current["title"]
        author = current["author"]
        summary = f"Reading: {title}" + (f" by {author}" if author else "")
        extra = f" +{len(books) - 1} more" if len(books) > 1 else ""
        summary += extra
    else:
        title = "—"
        author = "—"
        summary = "Nothing marked as reading"

    return {
        "title": "Knowledge",
        "status": "ok",
        "summary": summary,
        "metrics": [
            {"label": "Reading", "value": title},
            {"label": "Author", "value": author if author else "—"},
            {"label": "Active notes (7d)", "value": active_count},
        ],
    }


@app.get("/api/reading")
def reading():
    current = fetch_goodreads_detailed()
    read_by_year = _count_by_year()
    return {
        "current": current,
        "read_by_year": read_by_year,
        "total_read": sum(read_by_year.values()),
    }


@app.post("/api/reading/sync")
def sync_reading_notes():
    books = fetch_goodreads_detailed()
    created, skipped = [], []
    for book in books:
        if book["vault_url"]:
            skipped.append(_clean_title(book["title"]))
            continue
        year_dir = BOOKS_PATH / str(book["added_year"])
        year_dir.mkdir(parents=True, exist_ok=True)
        filename = _clean_title(book["title"]) + ".md"
        filepath = year_dir / filename
        if not filepath.exists():
            filepath.write_text(_note_content(book))
            created.append(_clean_title(book["title"]))
        else:
            skipped.append(_clean_title(book["title"]))
    return {"created": created, "skipped": skipped}


class NoteRequest(BaseModel):
    title: str
    author: str = ""
    year: int | None = None
    added_year: int | None = None
    goodreads_url: str = ""


@app.post("/api/notes/create")
def create_note(body: NoteRequest):
    year_dir = BOOKS_PATH / str(body.added_year or datetime.now(timezone.utc).year)
    year_dir.mkdir(parents=True, exist_ok=True)
    filename = _clean_title(body.title) + ".md"
    filepath = year_dir / filename
    if not filepath.exists():
        filepath.write_text(_note_content(body.model_dump()))
    vault_url = _find_vault_note(body.title)
    return {"vault_url": vault_url}


@app.get("/api/books")
def books(shelf: str = Query(default="currently-reading")):
    return _fetch_shelf(shelf)


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
    return {"detail": "frontend not built"}
