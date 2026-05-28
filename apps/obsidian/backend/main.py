import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx
import frontmatter
from fastapi import FastAPI

VAULT_PATH = Path(os.getenv("VAULT_PATH", "/vault"))
GOODREADS_USER_ID = os.getenv("GOODREADS_USER_ID", "")
GOODREADS_FEED = f"https://www.goodreads.com/review/list_rss/{GOODREADS_USER_ID}?shelf=currently-reading"

app = FastAPI()


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
    # Goodreads is primary; fall back to Obsidian frontmatter
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


@app.get("/health")
def health():
    return {"status": "ok"}
