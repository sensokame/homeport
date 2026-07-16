import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
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
from pydantic import BaseModel
from weasyprint import HTML

VAULT_PATH = Path(os.getenv("VAULT_PATH", "/vault"))
GOODREADS_USER_ID = os.getenv("GOODREADS_USER_ID", "")
GOODREADS_FEED = f"https://www.goodreads.com/review/list_rss/{GOODREADS_USER_ID}?shelf=currently-reading"
QUARTZ_URL = os.getenv("QUARTZ_URL", "http://quartz.station")

BOOKS_PATH = VAULT_PATH / "life" / "Books"
WRITING_PATH = VAULT_PATH / "Writing" / "Writing"
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
    return {"widgets": [
        {"id": "knowledge.reading", "name": "Reading",
         "description": "Currently reading books with per-book details and vault links",
         "configSchema": {}},
    ]}


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


def _content_files(project_name: str) -> list[Path]:
    base = _writing_project_path(project_name)
    for folder_name in _CONTENT_FOLDERS:
        folder = base / folder_name
        files = sorted(folder.glob("*.md")) if folder.exists() else []
        if files:
            return files
    return []


def _content_stems(project_name: str) -> list[str]:
    return [f.stem for f in _content_files(project_name)]


def _find_chapter_file(project_name: str, stem: str) -> Path | None:
    base = _writing_project_path(project_name)
    for folder_name in _CONTENT_FOLDERS:
        f = base / folder_name / f"{stem}.md"
        if f.exists():
            return f
    return None


def _recent_activity(path: Path, days: int = 7) -> int:
    if not path.exists():
        return 0
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)
    return sum(
        1 for f in path.rglob("*.md")
        if datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc) >= cutoff
    )


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
    chapter_files = _content_files(name)
    word_count = sum(_word_count(f.read_text()) for f in chapter_files)
    return {
        "name": name,
        "characters": len(_list_md_stems(base / "characters")),
        "locations": len(_list_md_stems(base / "locations")),
        "events": len(_list_md_stems(base / "events")),
        "chapters": len(chapter_files),
        "word_count": word_count,
        "recent_activity": _recent_activity(base),
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
    return [
        {"stem": f.stem, "word_count": _word_count(f.read_text())}
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
