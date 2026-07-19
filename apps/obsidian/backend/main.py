import json
import os
import re
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone, timedelta
from email.utils import parsedate
from pathlib import Path
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx
import frontmatter
from io import BytesIO

import markdown as md_parser
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Route
from weasyprint import HTML

VAULT_PATH = Path(os.getenv("VAULT_PATH", "/vault"))
GOODREADS_USER_ID = os.getenv("GOODREADS_USER_ID", "")
GOODREADS_FEED = f"https://www.goodreads.com/review/list_rss/{GOODREADS_USER_ID}?shelf=currently-reading"
QUARTZ_URL = os.getenv("QUARTZ_URL", "http://quartz.station")

BOOKS_PATH = VAULT_PATH / "life" / "Books"
WRITING_PATH = VAULT_PATH / "Writing" / "Writing"
PROJECTS_PATH = VAULT_PATH / "Projects" / "projects"
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


@app.get("/api/catalog")
def catalog():
    return {
        "widgets": [
            {"id": "knowledge.reading", "name": "Reading",
             "description": "Currently reading books with per-book details and vault links",
             "configSchema": {}},
            {"id": "knowledge.project-tasks", "name": "Project Tasks",
             "description": "Open tasks and notes for one vault project (config: project_slug)",
             "configSchema": {"project_slug": {"type": "string", "label": "Project slug", "required": True}}},
            {"id": "knowledge.writing", "name": "Writing",
             "description": "Writing projects with chapter status, word counts, and tracked writing sessions",
             "configSchema": {}},
            {"id": "knowledge.music", "name": "Music",
             "description": "Practice log, theory curriculum, and ear-training/scales/sight-reading progress",
             "configSchema": {}},
        ],
        "provides": ["project"],
        "projectWidget": "knowledge.project-tasks",
        "projectOrder": 10,
        "mcp": {"url": "http://knowledge:8080/mcp"},
    }


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


# ── Writing ──────────────────────────────────────────────────────────────────

_CONTENT_FOLDERS = ("book", "stories", "draft")
_COLLECTION_FOLDER = "entries"

_PDF_CSS = """
@page {
    size: A4;
    margin: 2.5cm 3cm;
    @bottom-center {
        content: counter(page);
        font-family: 'Liberation Serif', Georgia, serif;
        font-size: 9pt;
        color: #888;
    }
}
body {
    font-family: 'Liberation Serif', Georgia, 'Times New Roman', serif;
    font-size: 11.5pt;
    line-height: 1.6;
    color: #1a1a1a;
}
.project-name {
    text-align: center;
    font-size: 9pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #888;
    margin: 0 0 6pt 0;
    text-indent: 0;
}
h1 {
    font-size: 17pt;
    font-weight: 700;
    text-align: center;
    margin: 0 0 28pt 0;
}
h2 { font-size: 13pt; margin-top: 20pt; margin-bottom: 8pt; }
p {
    margin: 0 0 10pt 0;
    text-align: left;
    text-indent: 1.2em;
    orphans: 2;
    widows: 2;
}
p:first-of-type, h1 + p, h2 + p { text-indent: 0; }
em { font-style: italic; }
strong { font-weight: 700; }
blockquote {
    border-left: 2px solid #bbb;
    margin: 16pt 0;
    padding-left: 14pt;
    color: #555;
    font-style: italic;
}
hr {
    border: none;
    text-align: center;
    margin: 22pt 0;
    break-before: avoid;
    break-after: avoid;
}
hr::before { content: '\\2022 \\2022 \\2022'; letter-spacing: 0.5em; color: #999; }
"""


def _writing_project_path(name: str) -> Path:
    return WRITING_PATH / name


def _list_md_stems(folder: Path) -> list[str]:
    if not folder.exists():
        return []
    return sorted(f.stem for f in folder.glob("*.md") if f.is_file())


_FRONTMATTER_RE = re.compile(r"^---[\s\S]*?---\n?")
_FENCED_CODE_RE = re.compile(r"```[\s\S]*?```")
_INLINE_CODE_RE = re.compile(r"`[^`]*`")
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_LINK_RE = re.compile(r"!?\[([^\]]*)\]\([^)]*\)")
_HEADING_RE = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_EMPHASIS_RE = re.compile(r"[*_~]{1,3}([^*_~]+)[*_~]{1,3}")
_LIST_RE = re.compile(r"^\s*[-*+>|]\s*", re.MULTILINE)
_ORDERED_LIST_RE = re.compile(r"^\s*\d+\.\s+", re.MULTILINE)


def _word_count(text: str) -> int:
    t = _FRONTMATTER_RE.sub("", text)
    t = _FENCED_CODE_RE.sub("", t)
    t = _INLINE_CODE_RE.sub("", t)
    t = _HTML_TAG_RE.sub("", t)
    t = _LINK_RE.sub(r"\1", t)
    t = _HEADING_RE.sub("", t)
    t = _EMPHASIS_RE.sub(r"\1", t)
    t = _LIST_RE.sub("", t)
    t = _ORDERED_LIST_RE.sub("", t)
    return len(t.split())


_DEFAULT_STATUS_VALUES = ["draft", "revision", "final"]
_PROJECT_STATUS_VALUES = ["draft", "in-progress", "on-hold", "ongoing", "complete"]


def _project_notes_path(project_name: str) -> Path:
    return _writing_project_path(project_name) / "notes.md"


def _heuristic_content_path(project_name: str) -> str | None:
    """Folder-order guess, used only when a project hasn't declared
    content_path in its notes.md frontmatter. Kept only as a fallback for
    projects with no declaration yet — see [[reference_writing_vault_schema]]."""
    base = _writing_project_path(project_name)
    for folder_name in _CONTENT_FOLDERS:
        if (base / folder_name).exists() and any((base / folder_name).glob("*.md")):
            return folder_name
    if (base / _COLLECTION_FOLDER).exists():
        return _COLLECTION_FOLDER
    return None


def _project_config(project_name: str) -> dict:
    """Reads content_path / shape / status_values from the project's own
    notes.md frontmatter — the source of truth for how a project is laid
    out, rather than inferring it by guessing which folder has files. Falls
    back to the folder heuristic only when nothing is declared, so existing
    projects keep working until their notes.md is updated."""
    notes_path = _project_notes_path(project_name)
    declared: dict = {}
    if notes_path.exists():
        declared = frontmatter.loads(notes_path.read_text()).metadata or {}
    content_path = declared.get("content_path") or _heuristic_content_path(project_name)
    shape = declared.get("shape") or (
        "collection" if content_path == _COLLECTION_FOLDER else "manuscript"
    )
    status_values = declared.get("status_values") or _DEFAULT_STATUS_VALUES
    return {"content_path": content_path, "shape": shape, "status_values": status_values}


def _content_files(project_name: str) -> list[Path]:
    content_path = _project_config(project_name)["content_path"]
    if not content_path:
        return []
    folder = _writing_project_path(project_name) / content_path
    return sorted(folder.glob("*.md")) if folder.exists() else []


def _content_stems(project_name: str) -> list[str]:
    return [f.stem for f in _content_files(project_name)]


def _find_chapter_file(project_name: str, stem: str) -> Path | None:
    content_path = _project_config(project_name)["content_path"]
    if not content_path:
        return None
    f = _writing_project_path(project_name) / content_path / f"{stem}.md"
    return f if f.exists() else None


def _recent_activity(path: Path, days: int = 7) -> int:
    if not path.exists():
        return 0
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)
    return sum(
        1 for f in path.rglob("*.md")
        if datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc) >= cutoff
    )


def _writing_meta_path(name: str) -> Path:
    return _writing_project_path(name) / ".writing-meta.json"


def _load_writing_meta(name: str) -> dict:
    p = _writing_meta_path(name)
    if not p.exists():
        return {"chapter_status": {}, "sessions": [], "open_session": None, "project_status": None}
    meta = json.loads(p.read_text())
    meta.setdefault("project_status", None)
    return meta


def _save_writing_meta(name: str, meta: dict) -> None:
    _writing_meta_path(name).write_text(json.dumps(meta, indent=2))


def _project_word_count(name: str) -> int:
    return sum(_word_count(f.read_text()) for f in _content_files(name))


def _current_streak_days(sessions: list[dict]) -> int:
    session_dates = {
        datetime.fromisoformat(s["ended_at"]).date() for s in sessions
    }
    streak = 0
    day = date.today()
    while day in session_dates:
        streak += 1
        day -= timedelta(days=1)
    return streak


@app.get("/api/writing/projects")
def list_projects():
    if not WRITING_PATH.exists():
        return []
    return sorted(
        d.name for d in WRITING_PATH.iterdir()
        if d.is_dir() and not d.name.startswith("_") and not d.name.startswith(".")
    )


class ProjectRequest(BaseModel):
    name: str


@app.post("/api/writing/projects")
def create_project(body: ProjectRequest):
    slug = _slugify(body.name)
    base = WRITING_PATH / slug
    for folder in ("characters", "locations", "events", "timelines", "book"):
        (base / folder).mkdir(parents=True, exist_ok=True)
    return {"name": slug}


@app.get("/api/writing/projects/{name}")
def get_project(name: str):
    base = _writing_project_path(name)
    if not base.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    config = _project_config(name)
    chapter_files = _content_files(name)
    word_count = sum(_word_count(f.read_text()) for f in chapter_files)
    meta = _load_writing_meta(name)
    status_counts = {v: 0 for v in config["status_values"]}
    for f in chapter_files:
        status_counts[meta["chapter_status"].get(f.stem, config["status_values"][0])] += 1
    return {
        "name": name,
        "shape": config["shape"],
        "status_values": config["status_values"],
        "project_status": meta["project_status"] or _PROJECT_STATUS_VALUES[0],
        "project_status_values": _PROJECT_STATUS_VALUES,
        "characters": len(_list_md_stems(base / "characters")),
        "locations": len(_list_md_stems(base / "locations")),
        "events": len(_list_md_stems(base / "events")),
        "chapters": len(chapter_files),
        "word_count": word_count,
        "recent_activity": _recent_activity(base),
        "chapter_status_counts": status_counts,
        "current_streak_days": _current_streak_days(meta["sessions"]),
    }


@app.get("/api/writing/projects/{name}/characters")
def list_characters(name: str):
    return _list_md_stems(_writing_project_path(name) / "characters")


class CharacterRequest(BaseModel):
    name: str


@app.post("/api/writing/projects/{name}/characters")
def create_character(name: str, body: CharacterRequest):
    folder = _writing_project_path(name) / "characters"
    folder.mkdir(parents=True, exist_ok=True)
    filepath = folder / f"{body.name}.md"
    if not filepath.exists():
        filepath.write_text(f"# {body.name}\n\n## Description\n\n## Backstory\n\n## Arc\n")
    return {"name": body.name, "created": not filepath.exists()}


@app.get("/api/writing/projects/{name}/chapters")
def list_chapters(name: str):
    meta = _load_writing_meta(name)
    default_status = _project_config(name)["status_values"][0]
    return [
        {
            "stem": f.stem,
            "word_count": _word_count(f.read_text()),
            "status": meta["chapter_status"].get(f.stem, default_status),
        }
        for f in _content_files(name)
    ]


class ChapterRequest(BaseModel):
    title: str


@app.post("/api/writing/projects/{name}/chapters")
def create_chapter(name: str, body: ChapterRequest):
    folder = _writing_project_path(name) / "book"
    folder.mkdir(parents=True, exist_ok=True)
    filepath = folder / f"{body.title}.md"
    if not filepath.exists():
        filepath.write_text(f"# {body.title}\n\n")
    return {"title": body.title, "created": not filepath.exists()}


@app.get("/api/writing/projects/{name}/chapters/{chapter}")
def get_chapter(name: str, chapter: str):
    f = _find_chapter_file(name, chapter)
    if not f:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return {"content": f.read_text()}


@app.get("/api/writing/projects/{name}/chapters/{chapter}/export.pdf")
def export_chapter_pdf(name: str, chapter: str):
    f = _find_chapter_file(name, chapter)
    if not f:
        raise HTTPException(status_code=404, detail="Chapter not found")
    html_body = md_parser.markdown(f.read_text(), extensions=["extra", "smarty"])
    project_label = name.replace("-", " ").replace("_", " ").title()
    kicker = f'<p class="project-name">{project_label}</p>'
    html = f"<html><head><style>{_PDF_CSS}</style></head><body>{kicker}{html_body}</body></html>"
    buf = BytesIO()
    HTML(string=html).write_pdf(target=buf)
    filename = f"{chapter}.pdf"
    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class ChapterStatusRequest(BaseModel):
    status: str


@app.patch("/api/writing/projects/{name}/chapters/{chapter}/status")
def set_chapter_status(name: str, chapter: str, body: ChapterStatusRequest):
    if not _find_chapter_file(name, chapter):
        raise HTTPException(status_code=404, detail="Chapter not found")
    status_values = _project_config(name)["status_values"]
    if body.status not in status_values:
        raise HTTPException(status_code=422, detail=f"status must be one of {status_values}")
    meta = _load_writing_meta(name)
    meta["chapter_status"][chapter] = body.status
    _save_writing_meta(name, meta)
    return {"stem": chapter, "status": body.status}


class ProjectStatusRequest(BaseModel):
    status: str


@app.patch("/api/writing/projects/{name}/status")
def set_project_status(name: str, body: ProjectStatusRequest):
    if not _writing_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")
    if body.status not in _PROJECT_STATUS_VALUES:
        raise HTTPException(status_code=422, detail=f"status must be one of {_PROJECT_STATUS_VALUES}")
    meta = _load_writing_meta(name)
    meta["project_status"] = body.status
    _save_writing_meta(name, meta)
    return {"name": name, "project_status": body.status}


@app.post("/api/writing/projects/{name}/sessions/start")
def start_writing_session(name: str):
    if not _writing_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")
    meta = _load_writing_meta(name)
    if meta["open_session"] is not None:
        raise HTTPException(status_code=409, detail="A session is already open")
    meta["open_session"] = {
        "started_at": datetime.now(tz=timezone.utc).isoformat(),
        "word_count_start": _project_word_count(name),
    }
    _save_writing_meta(name, meta)
    return meta["open_session"]


@app.post("/api/writing/projects/{name}/sessions/end")
def end_writing_session(name: str):
    meta = _load_writing_meta(name)
    open_session = meta["open_session"]
    if open_session is None:
        raise HTTPException(status_code=409, detail="No session is open")
    ended_at = datetime.now(tz=timezone.utc)
    started_at = datetime.fromisoformat(open_session["started_at"])
    word_count_end = _project_word_count(name)
    record = {
        "started_at": open_session["started_at"],
        "ended_at": ended_at.isoformat(),
        "word_count_start": open_session["word_count_start"],
        "word_count_end": word_count_end,
        "delta": word_count_end - open_session["word_count_start"],
        "duration_seconds": int((ended_at - started_at).total_seconds()),
    }
    meta["sessions"].append(record)
    meta["open_session"] = None
    _save_writing_meta(name, meta)
    return record


@app.get("/api/writing/projects/{name}/sessions")
def list_writing_sessions(name: str):
    meta = _load_writing_meta(name)
    return {"sessions": meta["sessions"], "open_session": meta["open_session"]}


# ── Projects (v1.3.0 workspace-sat support) ─────────────────────────────────────

_TASKS_HEADING_RE = re.compile(r"^##\s+Tasks\s*$", re.MULTILINE)
_COMPLETED_HEADING_RE = re.compile(r"^##\s+Completed\s*$", re.MULTILINE)
_NEXT_H2_RE = re.compile(r"^##\s+\S", re.MULTILINE)
_H3_SPLIT_RE = re.compile(r"^###\s+(.+)$", re.MULTILINE)
_CHECKBOX_RE = re.compile(r"^\s*-\s+\[ \]\s+(.+)$", re.MULTILINE)


def _project_working_file(slug: str) -> Path | None:
    base = PROJECTS_PATH / slug
    for filename in ("tasks.md", "idea.md"):
        f = base / filename
        if f.exists():
            return f
    return None


_BLOCK_START_RE = re.compile(r"^\s*(#{1,6}\s|>|\||[-*+]\s|\d+\.\s|\*\*[^*]+\*\*\s*:)")
_INLINE_CODE_CAPTURE_RE = re.compile(r"`([^`]*)`")
_WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def _project_description(slug: str) -> str | None:
    """First plain paragraph right after the H1 title in idea.md — the vault's
    established (if unwritten) convention for a one-line project pitch.

    Always reads idea.md specifically, independent of _project_working_file:
    tasks.md (what active projects graduate to) usually drops this paragraph
    entirely in favour of milestone tables, so falling back to whichever file
    tasks/notes came from would silently lose the description for exactly the
    more mature projects.
    """
    f = PROJECTS_PATH / slug / "idea.md"
    if not f.exists():
        return None
    lines = frontmatter.load(f).content.splitlines()
    h1_idx = next((i for i, l in enumerate(lines) if l.startswith("# ")), None)
    if h1_idx is None:
        return None
    i = h1_idx + 1
    while i < len(lines) and not lines[i].strip():
        i += 1
    if i >= len(lines) or _BLOCK_START_RE.match(lines[i]):
        return None
    para: list[str] = []
    while i < len(lines) and lines[i].strip():
        para.append(lines[i].strip())
        i += 1
    text = " ".join(para)
    text = _WIKILINK_RE.sub(lambda m: m.group(2) or m.group(1), text)
    text = _LINK_RE.sub(r"\1", text)
    text = _INLINE_CODE_CAPTURE_RE.sub(r"\1", text)
    text = _EMPHASIS_RE.sub(r"\1", text)
    text = _HTML_TAG_RE.sub("", text)
    return text.strip() or None


def _parse_tasks_section(text: str) -> list[dict]:
    """Extract the ## Tasks section, split into ### sub-heading groups when present."""
    m = _TASKS_HEADING_RE.search(text)
    if not m:
        return []
    rest = text[m.end():]
    next_h2 = _NEXT_H2_RE.search(rest)
    section = rest[:next_h2.start()] if next_h2 else rest

    groups: list[dict] = []
    h3_matches = list(_H3_SPLIT_RE.finditer(section))
    if not h3_matches:
        items = _CHECKBOX_RE.findall(section)
        if items:
            groups.append({"heading": None, "items": items})
        return groups

    leading = section[:h3_matches[0].start()]
    items = _CHECKBOX_RE.findall(leading)
    if items:
        groups.append({"heading": None, "items": items})
    for i, hm in enumerate(h3_matches):
        end = h3_matches[i + 1].start() if i + 1 < len(h3_matches) else len(section)
        chunk = section[hm.end():end]
        groups.append({"heading": hm.group(1).strip(), "items": _CHECKBOX_RE.findall(chunk)})
    return groups


def _project_payload(slug: str, filename: str, content: str) -> dict:
    return {
        "slug": slug,
        "source_file": filename,
        "description": _project_description(slug),
        "tasks": _parse_tasks_section(content),
        "milestones": _parse_milestones(content),
        "links": _project_links(slug),
        "notes_html": md_parser.markdown(content, extensions=["extra", "smarty"]),
    }


def _tasks_section_span(text: str) -> tuple[int, int] | None:
    """Offsets of the ## Tasks section body (after the heading line, before the next H2)."""
    m = _TASKS_HEADING_RE.search(text)
    if not m:
        return None
    rest = text[m.end():]
    next_h2 = _NEXT_H2_RE.search(rest)
    return m.end(), m.end() + (next_h2.start() if next_h2 else len(rest))


_CHECKBOX_LINE_RE = re.compile(r"^\s*-\s+\[ \]\s+(.+)$")


def _find_task_line(section: str, heading: str | None, index: int) -> tuple[int, int, str] | None:
    """Locate the checkbox line for (heading, index) within a ## Tasks section body.

    Returns (start, end, task_text) with offsets relative to `section` (end excludes the
    trailing newline), or None if the (heading, index) pair no longer matches — e.g. the
    note was hand-edited in Obsidian since the widget last loaded it.

    Matches line-by-line rather than with a cross-line regex: `_CHECKBOX_RE`'s leading
    `\\s*` will happily eat the newline that separates a heading from its first item when
    that item sits at position 0 of a finditer'd chunk, which would corrupt the file on
    removal. Splitting into real lines first means `^` never sees anything but the line's
    own content.
    """
    h3_matches = list(_H3_SPLIT_RE.finditer(section))
    if heading is None:
        chunk_start, chunk_end = 0, (h3_matches[0].start() if h3_matches else len(section))
    else:
        target = next((hm for hm in h3_matches if hm.group(1).strip() == heading), None)
        if target is None:
            return None
        i = h3_matches.index(target)
        chunk_start = target.end()
        chunk_end = h3_matches[i + 1].start() if i + 1 < len(h3_matches) else len(section)

    found: list[tuple[int, int, str]] = []
    pos = chunk_start
    for line in section[chunk_start:chunk_end].splitlines(keepends=True):
        bare = line.rstrip("\n")
        m = _CHECKBOX_LINE_RE.match(bare)
        if m:
            found.append((pos, pos + len(bare), m.group(1)))
        pos += len(line)
    if not (0 <= index < len(found)):
        return None
    return found[index]


@app.get("/api/projects")
def list_project_slugs():
    if not PROJECTS_PATH.exists():
        return []
    return sorted(
        d.name for d in PROJECTS_PATH.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    )


# ── Projects index overview (workspace-sat standalone page support) ────────────

_INDEX_MD_PATH = PROJECTS_PATH / "index.md"
_CATEGORY_H2_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
_TABLE_ROW_RE = re.compile(r"^\|(.+)\|\s*$")
_TABLE_SEP_RE = re.compile(r"^\|?[\s:|-]+\|?$")
_STATUS_SPLIT_RE = re.compile(r"^(\S+)\s+(.+)$")
_NOTES_SLUG_RE = re.compile(r"`([\w.-]+)/[^`]*`")


def _clean_cell(text: str) -> str:
    text = text.strip()
    text = _WIKILINK_RE.sub(lambda m: m.group(2) or m.group(1), text)
    text = _LINK_RE.sub(r"\1", text)
    text = _INLINE_CODE_CAPTURE_RE.sub(r"\1", text)
    text = _EMPHASIS_RE.sub(r"\1", text)
    text = _HTML_TAG_RE.sub("", text)
    return text.strip()


def _parse_table_rows(section: str) -> list[list[str]] | None:
    """Raw (uncleaned) cell strings for each data row of a 4-column
    `| Project | Status | Next action | Notes |` table under some H2, or
    None if this section's table isn't that shape (e.g. index.md's
    On Hold/Inactive and Merged/Renamed tables use different column sets)."""
    lines = [l for l in section.splitlines() if _TABLE_ROW_RE.match(l)]
    if len(lines) < 2:
        return None
    header_cells = [c.strip() for c in lines[0].strip("|").split("|")]
    if len(header_cells) != 4 or header_cells[1].lower() != "status":
        return None
    rows = []
    for line in lines[2:]:  # skip header + separator row
        if _TABLE_SEP_RE.match(line):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) == 4:
            rows.append(cells)
    return rows


_MILESTONES_HEADING_RE = re.compile(r"^##\s+.*Milestones?\s*$", re.MULTILINE | re.IGNORECASE)


def _parse_milestones(text: str) -> list[dict]:
    """Structured read of a '## ... Milestones' table. Not every project has
    one (only version-tagged projects like homeport/beacon do) — matched by
    heading text + a 'Version' first column rather than a fixed column set,
    since some tables add a Gate column and some don't. Returns [] (nothing
    shown) when the shape doesn't match, same "declared or absent, never
    guessed" precedent as the rest of this endpoint."""
    m = _MILESTONES_HEADING_RE.search(text)
    if not m:
        return []
    rest = text[m.end():]
    next_h2 = _NEXT_H2_RE.search(rest)
    section = rest[:next_h2.start()] if next_h2 else rest
    lines = [l for l in section.splitlines() if _TABLE_ROW_RE.match(l)]
    if len(lines) < 2:
        return []
    headers = [_clean_cell(c) for c in lines[0].strip("|").split("|")]
    if not headers or headers[0].lower() != "version":
        return []
    keys = [h.lower() for h in headers]
    rows = []
    for line in lines[2:]:
        if _TABLE_SEP_RE.match(line):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) != len(keys):
            continue
        rows.append({k: _clean_cell(c) for k, c in zip(keys, cells)})
    return rows


def _project_links(slug: str) -> list[str]:
    """Related project slugs pulled from [[wikilink]] targets in idea.md and
    tasks.md. The vault convention (see CLAUDE.md) is to link related projects
    by slug — e.g. [[playground-game]] or [[cyber-deck-console/idea|Console]].
    Only targets resolving to a real Projects/projects directory are kept;
    links to non-project vault notes (e.g. [[Syncthing]]) are silently
    dropped rather than guessed at."""
    slugs: list[str] = []
    for filename in ("idea.md", "tasks.md"):
        f = PROJECTS_PATH / slug / filename
        if not f.exists():
            continue
        content = frontmatter.load(f).content
        for wm in _WIKILINK_RE.finditer(content):
            candidate = wm.group(1).split("/")[0].split("#")[0].strip()
            if candidate and candidate != slug and candidate not in slugs and (PROJECTS_PATH / candidate).is_dir():
                slugs.append(candidate)
    return slugs


@app.get("/api/projects/index")
def get_projects_index():
    """Structured read of Projects/projects/index.md's category tables — the
    vault's single declared source of truth for cross-project status, used by
    workspace-sat's standalone overview page. Returns every row regardless of
    status; Active/Planning/New/Idea filtering is a display concern (per
    index.md's own note), not something this endpoint decides.
    """
    categories: list[dict] = []
    if _INDEX_MD_PATH.exists():
        content = frontmatter.load(_INDEX_MD_PATH).content
        headings = list(_CATEGORY_H2_RE.finditer(content))
        for i, h in enumerate(headings):
            start = h.end()
            end = headings[i + 1].start() if i + 1 < len(headings) else len(content)
            rows = _parse_table_rows(content[start:end])
            if not rows:
                continue

            projects = []
            for name_raw, status_raw, next_action_raw, notes_raw in rows:
                status_match = _STATUS_SPLIT_RE.match(status_raw.strip())
                status_emoji, status_label = (
                    (status_match.group(1), status_match.group(2))
                    if status_match else ("", status_raw.strip())
                )

                # A Notes cell can have multiple backtick file-refs (e.g. a cross-link
                # to another vault section before the project's own idea.md/tasks.md) —
                # take the first one that's an actual Projects/projects slug, not just
                # the first backtick span found.
                slug = next(
                    (c for c in _NOTES_SLUG_RE.findall(notes_raw) if (PROJECTS_PATH / c).is_dir()),
                    None,
                )

                projects.append({
                    "name": _clean_cell(name_raw),
                    "status_emoji": status_emoji,
                    "status_label": status_label,
                    "next_action": _clean_cell(next_action_raw),
                    "notes": _clean_cell(notes_raw),
                    "slug": slug,
                })

            categories.append({"name": h.group(1).strip(), "projects": projects})

    # Scoped CORS: workspace.station's standalone page fetches this cross-origin.
    # A plain GET with default headers never triggers a preflight, so setting
    # this response header alone is sufficient — no app-wide CORSMiddleware needed.
    return Response(
        content=json.dumps({"categories": categories}),
        media_type="application/json",
        headers={"Access-Control-Allow-Origin": "*"},
    )


@app.get("/api/projects/{slug}")
def get_project_tasks(slug: str):
    f = _project_working_file(slug)
    if not f:
        raise HTTPException(status_code=404, detail="Project not found")
    post = frontmatter.load(f)
    payload = _project_payload(slug, f.name, post.content)
    # Scoped CORS: workspace.station's per-project page fetches this cross-origin,
    # same reasoning as /api/projects/index. Harmless for the existing same-origin
    # callers (hub proxy, knowledge.project-tasks widget).
    return Response(
        content=json.dumps(payload),
        media_type="application/json",
        headers={"Access-Control-Allow-Origin": "*"},
    )


class CompleteTaskRequest(BaseModel):
    heading: str | None = None
    index: int


@app.post("/api/projects/{slug}/tasks/complete")
def complete_task(slug: str, body: CompleteTaskRequest):
    f = _project_working_file(slug)
    if not f:
        raise HTTPException(status_code=404, detail="Project not found")
    post = frontmatter.load(f)
    content = post.content

    tasks_span = _tasks_section_span(content)
    if not tasks_span:
        raise HTTPException(status_code=404, detail="No Tasks section")
    section_start, section_end = tasks_span
    found = _find_task_line(content[section_start:section_end], body.heading, body.index)
    if not found:
        raise HTTPException(status_code=404, detail="Task not found")
    rel_start, rel_end, task_text = found
    line_start, line_end = section_start + rel_start, section_start + rel_end
    if line_end < len(content) and content[line_end] == "\n":
        line_end += 1
    content = content[:line_start] + content[line_end:]

    completed_line = f"- [x] {task_text}\n"
    completed_m = _COMPLETED_HEADING_RE.search(content)
    if completed_m:
        rest = content[completed_m.end():]
        next_h2 = _NEXT_H2_RE.search(rest)
        insert_at = completed_m.end() + (next_h2.start() if next_h2 else len(rest))
        content = content[:insert_at] + completed_line + content[insert_at:]
    else:
        sep = "" if content.endswith("\n") else "\n"
        content = content + f"{sep}\n## Completed\n{completed_line}"

    post.content = content
    f.write_text(frontmatter.dumps(post) if post.metadata else content)
    return _project_payload(slug, f.name, content)


# ── Journal ──────────────────────────────────────────────────────────────────

JOURNAL_PATH = VAULT_PATH / "life" / "Journal"
_TZ = ZoneInfo("Europe/Berlin")

_JOURNAL_TEMPLATE = """\
## what's happening
In case of random urgent thoughts. Write here
## what happened
Write down what you went through
## what we learned
What we learned from this day

## what we want to do
Ideas for the future"""


def _today_journal_path() -> Path:
    now = datetime.now(tz=_TZ)
    day_name = now.strftime("%A")
    filename = now.strftime(f"%Y-%m-%d-{day_name}.md")
    return JOURNAL_PATH / now.strftime("%Y") / now.strftime("%m") / filename


@app.get("/api/journal/today")
def get_today_journal():
    path = _today_journal_path()
    if path.exists():
        return {"exists": True, "content": path.read_text()}
    return {"exists": False, "content": ""}


@app.post("/api/journal/today")
def create_today_journal():
    path = _today_journal_path()
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_JOURNAL_TEMPLATE)
    return {"exists": True, "content": path.read_text()}


class JournalUpdate(BaseModel):
    content: str


@app.put("/api/journal/today")
def save_today_journal(body: JournalUpdate):
    path = _today_journal_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.content)
    return {"exists": True, "content": body.content}


# ── Music ────────────────────────────────────────────────────────────────────
# v1.6.0: mirrors the writing companion's "no new satellite, no new DB" pattern
# (see homeport vault agent-integration.md / tasks.md) — a JSON sidecar for
# session/progress data, direct in-place edits for the one real vault
# checklist (schedule.md's Theory Curriculum), same as Journal for the daily
# practice log.

MUSIC_PATH = VAULT_PATH / "life" / "Music"
MUSIC_SCHEDULE_PATH = MUSIC_PATH / "schedule.md"
MUSIC_PRACTICE_LOG_PATH = MUSIC_PATH / "practice-log"

_MUSIC_SUBJECTS = {"theory", "piano", "ear_training", "guitar", "review", "open"}
_MUSIC_PROGRESS_SUBJECTS = {"ear_training", "scales", "sight_reading"}
_MUSIC_PROGRESS_STATUS_VALUES = ["introduced", "practicing", "solid"]

_MUSIC_ROTATION_HEADING_RE = re.compile(r"^##\s+Weekly Rotation\s*$", re.MULTILINE)
_MUSIC_CURRICULUM_HEADING_RE = re.compile(r"^##\s+Theory Curriculum.*$", re.MULTILINE)
_MUSIC_CHECKBOX_LINE_RE = re.compile(r"^(\s*-\s+\[)([ xX])(\]\s+)(.+)$")


def _music_meta_path() -> Path:
    return MUSIC_PATH / ".music-meta.json"


def _load_music_meta() -> dict:
    p = _music_meta_path()
    if not p.exists():
        meta = {"sessions": [], "open_session": None, "progress": {}}
    else:
        meta = json.loads(p.read_text())
    meta.setdefault("sessions", [])
    meta.setdefault("open_session", None)
    meta.setdefault("progress", {})
    for subject in _MUSIC_PROGRESS_SUBJECTS:
        meta["progress"].setdefault(subject, {})
    return meta


def _save_music_meta(meta: dict) -> None:
    _music_meta_path().write_text(json.dumps(meta, indent=2))


def _normalize_subject(label: str) -> str:
    return label.strip().lower().replace(" ", "_")


def _parse_music_schedule(text: str) -> list[dict]:
    """Structured read of schedule.md's '## Weekly Rotation' table (day/focus/
    session shape) — same table-parsing approach as _parse_table_rows, just a
    3-column shape instead of the Projects index's 4-column one."""
    m = _MUSIC_ROTATION_HEADING_RE.search(text)
    if not m:
        return []
    rest = text[m.end():]
    next_h2 = _NEXT_H2_RE.search(rest)
    section = rest[:next_h2.start()] if next_h2 else rest
    lines = [l for l in section.splitlines() if _TABLE_ROW_RE.match(l)]
    if len(lines) < 2:
        return []
    rows = []
    for line in lines[2:]:  # skip header + separator row
        if _TABLE_SEP_RE.match(line):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) == 3:
            rows.append({"day": cells[0], "focus": cells[1], "session_shape": cells[2]})
    return rows


def _todays_music_slot() -> dict | None:
    if not MUSIC_SCHEDULE_PATH.exists():
        return None
    today_name = datetime.now(tz=_TZ).strftime("%A")
    for row in _parse_music_schedule(MUSIC_SCHEDULE_PATH.read_text()):
        if row["day"].strip().lower() == today_name.lower():
            return {**row, "subject": _normalize_subject(row["focus"])}
    return None


def _music_curriculum_section_span(text: str) -> tuple[int, int] | None:
    m = _MUSIC_CURRICULUM_HEADING_RE.search(text)
    if not m:
        return None
    rest = text[m.end():]
    next_h2 = _NEXT_H2_RE.search(rest)
    return m.end(), m.end() + (next_h2.start() if next_h2 else len(rest))


def _parse_music_curriculum(text: str) -> list[dict]:
    span = _music_curriculum_section_span(text)
    if not span:
        return []
    section_start, section_end = span
    items = []
    for line in text[section_start:section_end].splitlines():
        m = _MUSIC_CHECKBOX_LINE_RE.match(line)
        if m:
            items.append({"index": len(items), "text": m.group(4).strip(), "done": m.group(2).lower() == "x"})
    return items


def _set_music_curriculum_item(index: int, done: bool) -> list[dict]:
    """Toggles the real checkbox in schedule.md in place — same line-by-line
    approach as _find_task_line, for the same reason: a MULTILINE regex's
    leading \\s* can eat the previous line's newline when matched mid-string,
    corrupting the file. See the Projects section's _find_task_line docstring."""
    if not MUSIC_SCHEDULE_PATH.exists():
        raise HTTPException(status_code=404, detail="schedule.md not found")
    text = MUSIC_SCHEDULE_PATH.read_text()
    span = _music_curriculum_section_span(text)
    if not span:
        raise HTTPException(status_code=404, detail="No Theory Curriculum section")
    section_start, section_end = span

    found: list[tuple[int, int, re.Match]] = []
    pos = section_start
    for line in text[section_start:section_end].splitlines(keepends=True):
        bare = line.rstrip("\n")
        m = _MUSIC_CHECKBOX_LINE_RE.match(bare)
        if m:
            found.append((pos, pos + len(bare), m))
        pos += len(line)

    if not (0 <= index < len(found)):
        raise HTTPException(status_code=404, detail="Curriculum item not found")
    line_start, line_end, m = found[index]
    new_line = f"{m.group(1)}{'x' if done else ' '}{m.group(3)}{m.group(4)}"
    text = text[:line_start] + new_line + text[line_end:]
    MUSIC_SCHEDULE_PATH.write_text(text)
    return _parse_music_curriculum(text)


@app.get("/api/music/overview")
def get_music_overview():
    meta = _load_music_meta()
    curriculum = _parse_music_curriculum(MUSIC_SCHEDULE_PATH.read_text()) if MUSIC_SCHEDULE_PATH.exists() else []
    sessions = meta["sessions"]
    return {
        "today": _todays_music_slot(),
        "current_streak_days": _current_streak_days(sessions),
        "curriculum_done": sum(1 for c in curriculum if c["done"]),
        "curriculum_total": len(curriculum),
        "progress": meta["progress"],
        "last_session": sessions[-1] if sessions else None,
        "open_session": meta["open_session"],
    }


@app.get("/api/music/schedule")
def get_music_schedule():
    if not MUSIC_SCHEDULE_PATH.exists():
        return {"rotation": []}
    return {"rotation": _parse_music_schedule(MUSIC_SCHEDULE_PATH.read_text())}


@app.get("/api/music/curriculum/theory")
def get_music_curriculum():
    if not MUSIC_SCHEDULE_PATH.exists():
        return []
    return _parse_music_curriculum(MUSIC_SCHEDULE_PATH.read_text())


class MusicCurriculumUpdate(BaseModel):
    done: bool


@app.patch("/api/music/curriculum/theory/{index}")
def patch_music_curriculum(index: int, body: MusicCurriculumUpdate):
    return _set_music_curriculum_item(index, body.done)


@app.get("/api/music/progress")
def get_music_progress():
    return _load_music_meta()["progress"]


class MusicProgressUpdate(BaseModel):
    label: str
    status: str


@app.patch("/api/music/progress/{subject}/{item_slug}")
def set_music_progress(subject: str, item_slug: str, body: MusicProgressUpdate):
    if subject not in _MUSIC_PROGRESS_SUBJECTS:
        raise HTTPException(status_code=422, detail=f"subject must be one of {sorted(_MUSIC_PROGRESS_SUBJECTS)}")
    if body.status not in _MUSIC_PROGRESS_STATUS_VALUES:
        raise HTTPException(status_code=422, detail=f"status must be one of {_MUSIC_PROGRESS_STATUS_VALUES}")
    meta = _load_music_meta()
    meta["progress"][subject][item_slug] = {"label": body.label, "status": body.status}
    _save_music_meta(meta)
    return meta["progress"][subject]


class MusicSessionStartRequest(BaseModel):
    subject: str


@app.post("/api/music/sessions/start")
def start_music_session(body: MusicSessionStartRequest):
    if body.subject not in _MUSIC_SUBJECTS:
        raise HTTPException(status_code=422, detail=f"subject must be one of {sorted(_MUSIC_SUBJECTS)}")
    meta = _load_music_meta()
    if meta["open_session"] is not None:
        raise HTTPException(status_code=409, detail="A session is already open")
    meta["open_session"] = {
        "started_at": datetime.now(tz=timezone.utc).isoformat(),
        "subject": body.subject,
    }
    _save_music_meta(meta)
    return meta["open_session"]


@app.post("/api/music/sessions/end")
def end_music_session():
    meta = _load_music_meta()
    open_session = meta["open_session"]
    if open_session is None:
        raise HTTPException(status_code=409, detail="No session is open")
    ended_at = datetime.now(tz=timezone.utc)
    started_at = datetime.fromisoformat(open_session["started_at"])
    record = {
        "started_at": open_session["started_at"],
        "ended_at": ended_at.isoformat(),
        "subject": open_session["subject"],
        "duration_seconds": int((ended_at - started_at).total_seconds()),
    }
    meta["sessions"].append(record)
    meta["open_session"] = None
    _save_music_meta(meta)
    return record


@app.get("/api/music/sessions")
def list_music_sessions():
    meta = _load_music_meta()
    return {"sessions": meta["sessions"], "open_session": meta["open_session"]}


_MUSIC_PRACTICE_LOG_TEMPLATE_SECTIONS = (
    "Focus", "What I worked on", "What clicked", "What needs more work", "Notes / questions",
)


def _music_practice_log_template(day_str: str) -> str:
    body = "\n\n\n".join(f"## {s}" for s in _MUSIC_PRACTICE_LOG_TEMPLATE_SECTIONS)
    return f"# Practice Log — {day_str}\n\n{body}"


def _today_practice_log_path() -> Path:
    now = datetime.now(tz=_TZ)
    return MUSIC_PRACTICE_LOG_PATH / now.strftime("%Y") / now.strftime("%m") / now.strftime("%Y-%m-%d.md")


@app.get("/api/music/practice-log/today")
def get_today_practice_log():
    path = _today_practice_log_path()
    if path.exists():
        return {"exists": True, "content": path.read_text()}
    return {"exists": False, "content": ""}


@app.post("/api/music/practice-log/today")
def create_today_practice_log():
    path = _today_practice_log_path()
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_music_practice_log_template(datetime.now(tz=_TZ).strftime("%Y-%m-%d")))
    return {"exists": True, "content": path.read_text()}


class MusicPracticeLogUpdate(BaseModel):
    content: str


@app.put("/api/music/practice-log/today")
def save_today_practice_log(body: MusicPracticeLogUpdate):
    path = _today_practice_log_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.content)
    return {"exists": True, "content": body.content}


# ── Activity ──────────────────────────────────────────────────────────────────

_SKIP_PARTS = {".obsidian", ".trash", "Templates", ".git"}


@app.get("/api/activity")
def vault_activity():
    now = datetime.now(tz=timezone.utc)
    week_ago = now - timedelta(days=7)
    results = []
    for md_file in VAULT_PATH.rglob("*.md"):
        if any(p in _SKIP_PARTS or p.startswith(".") for p in md_file.parts):
            continue
        try:
            mtime = datetime.fromtimestamp(md_file.stat().st_mtime, tz=timezone.utc)
            if mtime < week_ago:
                continue
            rel = md_file.relative_to(VAULT_PATH)
            vault = rel.parts[0] if len(rel.parts) > 1 else "root"
            results.append({
                "name": md_file.stem,
                "vault": vault,
                "modified": mtime.isoformat(),
            })
        except Exception:
            continue
    results.sort(key=lambda x: x["modified"], reverse=True)
    return results[:30]


# ── MCP (read-only pilot — see homeport vault agent-integration.md) ────────────
# Resources wrap the same REST handlers above; no duplicated logic.

mcp_server = FastMCP(
    "obsidian",
    streamable_http_path="/",
    # No auth on any REST route here either — this satellite is internal-network-only,
    # so DNS-rebinding host checks would just reject legitimate internal Host headers.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


@mcp_server.resource("obsidian://journal/today", mime_type="application/json")
def mcp_journal_today() -> dict:
    """Today's journal entry, if one exists."""
    return get_today_journal()


@mcp_server.resource("obsidian://reading/current", mime_type="application/json")
def mcp_reading_current() -> dict:
    """Currently-reading books plus read-by-year totals."""
    return reading()


@mcp_server.resource("obsidian://activity/recent", mime_type="application/json")
def mcp_activity_recent() -> list[dict]:
    """Vault notes modified in the last 7 days, most recent first."""
    return vault_activity()


@mcp_server.resource("obsidian://projects", mime_type="application/json")
def mcp_projects() -> list[str]:
    """Every project slug under Projects/projects/ in the vault."""
    return list_project_slugs()


@mcp_server.resource("obsidian://writing/projects", mime_type="application/json")
def mcp_writing_projects() -> list[str]:
    """Every writing project under Writing/Writing/ in the vault."""
    return list_projects()


@mcp_server.resource("obsidian://music/overview", mime_type="application/json")
def mcp_music_overview() -> dict:
    """Today's music practice slot, streak, and curriculum/progress summary."""
    return get_music_overview()


def _task_text(slug: str, heading: str | None, index: int) -> str | None:
    """Look up one task's display text by (heading, index) via the same
    grouping the REST payload already exposes — avoids re-deriving the
    line-offset regex logic in _find_task_line just to show a confirmation
    message.

    Calls _project_payload directly rather than the get_project_tasks route
    function: that route now wraps its payload in a raw Response (for a
    scoped CORS header), so calling it as a plain function no longer returns
    a dict — _project_payload is the actual reusable data-only helper.
    """
    f = _project_working_file(slug)
    if not f:
        return None
    post = frontmatter.load(f)
    payload = _project_payload(slug, f.name, post.content)
    for group in payload["tasks"]:
        if group["heading"] == heading:
            items = group["items"]
            return items[index] if 0 <= index < len(items) else None
    return None


class TaskCompleteConfirmation(BaseModel):
    confirm: bool = Field(description="Confirm marking this task complete")


# First write tool exposed over MCP — see the write-tool safety policy in
# homeport vault agent-integration.md: every mutating tool must (1) declare
# destructiveHint/idempotentHint so any spec-compliant client knows it isn't
# a plain read, and (2) call ctx.elicit(...) before mutating so the pause is
# enforced by this satellite itself, not left to client-side judgment. Note
# elicitation doesn't guarantee a *human* saw the prompt (an agent client is
# free to auto-answer per the MCP spec) — the real backstop is that any
# homeport-built client (the future agent-host-sat) always surfaces it.
@mcp_server.tool(
    annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False),
)
async def mcp_complete_task(slug: str, index: int, ctx: Context, heading: str | None = None) -> dict:
    """Mark one open task complete in a project's vault file (moves it from
    ## Tasks into ## Completed). Requires user confirmation."""
    task_text = _task_text(slug, heading, index)
    if task_text is None:
        raise ValueError(f"No task found at index {index} (heading={heading!r}) in project '{slug}'")

    result = await ctx.elicit(
        message=f'Mark task "{task_text}" complete in project "{slug}"?',
        schema=TaskCompleteConfirmation,
    )
    if result.action != "accept" or not result.data.confirm:
        return {"completed": False, "task": task_text, "action": result.action}

    payload = complete_task(slug, CompleteTaskRequest(heading=heading, index=index))
    return {"completed": True, "task": task_text, "project": payload}


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
    rather than relying on Starlette's redirect-slash fallback, which never
    triggers here because the catch-all SPA route below produces a GET-only
    partial match for "/mcp" first, winning as a 405 before the redirect check
    runs. Must be a callable *instance*: Starlette treats plain functions as
    request/response endpoints (defaulting to GET-only) rather than raw ASGI
    apps, which would reintroduce the same bug."""

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope["path"] = "/"
        await mcp_app(scope, receive, send)


app.router.routes.append(Route("/mcp", endpoint=_McpBareMount()))


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
