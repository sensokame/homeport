import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import mcp.types as t
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from mcp.server.fastmcp.server import StreamableHTTPASGIApp
from mcp.server.lowlevel import Server
from mcp.server.lowlevel.helper_types import ReadResourceContents
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Route

HUB_URL = os.getenv("HUB_URL", "http://hub:8080")
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI()


# ── Discovery ────────────────────────────────────────────────────────────────
# The gateway has no satellite-scan logic of its own — it reuses the hub's
# already-aggregated `/api/catalog` (which extracts each satellite's own
# self-declared `mcp` field), same as every other consumer of that endpoint.

async def _get_satellite_mcp_map() -> dict[str, str]:
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(f"{HUB_URL}/api/catalog")
        r.raise_for_status()
        data = r.json()
    return {sat_id: info["url"] for sat_id, info in data.get("mcp", {}).items()}


async def _list_resources_raw(url: str) -> list[t.Resource]:
    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.list_resources()
            return result.resources


async def _list_tools_raw(url: str) -> list[t.Tool]:
    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.list_tools()
            return result.tools


@app.get("/api/catalog")
def catalog():
    # No widgets, and deliberately no self-declared `mcp` field: the gateway
    # aggregates other satellites' MCP servers, it doesn't have domain state
    # of its own to expose the same way they do — see docs/satellites/mcp-gateway.md.
    return {"widgets": []}


@app.get("/servers")
async def servers():
    """Raw self-declared satellite list, for agent hosts that want direct
    connections instead of going through the aggregated /mcp below."""
    sats = await _get_satellite_mcp_map()
    return [{"satellite_id": sat_id, "mcp_url": url} for sat_id, url in sats.items()]


@app.get("/api/introspect")
async def introspect():
    """Live view of what every self-declared satellite currently exposes —
    powers this satellite's own frontend page. Not part of the MCP protocol
    itself, just a plain REST convenience so a browser doesn't need an MCP
    client to see what's available."""
    sats = await _get_satellite_mcp_map()
    results = []
    for sat_id, url in sats.items():
        entry = {"satellite_id": sat_id, "mcp_url": url, "resources": [], "tools": [], "error": None}
        try:
            resources = await _list_resources_raw(url)
            entry["resources"] = [
                {"uri": str(r.uri), "name": r.name, "description": r.description, "mimeType": r.mimeType}
                for r in resources
            ]
            tools = await _list_tools_raw(url)
            entry["tools"] = [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.inputSchema,
                    "annotations": tool.annotations.model_dump() if tool.annotations else None,
                }
                for tool in tools
            ]
        except Exception as e:
            entry["error"] = str(e)
        results.append(entry)
    return results


# ── Aggregated MCP server ────────────────────────────────────────────────────
# Low-level Server (not FastMCP) because the set of resources/tools is
# dynamic — discovered live from whichever satellites currently self-declare
# `mcp`, not a fixed list registered once at startup via decorators.

aggregate_server = Server("mcp-gateway")

# uri -> upstream mcp url, populated by the last list_resources call. Good
# enough for a handful of satellites with distinct URI schemes; a real
# collision (two satellites reusing the same scheme) isn't handled specially.
_resource_owner: dict[str, str] = {}

# "satellite_id.tool_name" -> (upstream mcp url, real tool name on that satellite)
_tool_owner: dict[str, tuple[str, str]] = {}


@aggregate_server.list_resources()
async def handle_list_resources() -> list[t.Resource]:
    sats = await _get_satellite_mcp_map()
    all_resources: list[t.Resource] = []
    for sat_id, url in sats.items():
        try:
            resources = await _list_resources_raw(url)
        except Exception:
            continue
        for r in resources:
            _resource_owner[str(r.uri)] = url
            all_resources.append(r)
    return all_resources


@aggregate_server.read_resource()
async def handle_read_resource(uri) -> list[ReadResourceContents]:
    url = _resource_owner.get(str(uri))
    if url is None:
        await handle_list_resources()
        url = _resource_owner.get(str(uri))
    if url is None:
        raise ValueError(f"Unknown resource: {uri}")

    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.read_resource(uri)
            return [
                ReadResourceContents(
                    content=c.text if isinstance(c, t.TextResourceContents) else c.blob,
                    mime_type=c.mimeType,
                )
                for c in result.contents
            ]


@aggregate_server.list_tools()
async def handle_list_tools() -> list[t.Tool]:
    sats = await _get_satellite_mcp_map()
    all_tools: list[t.Tool] = []
    for sat_id, url in sats.items():
        try:
            tools = await _list_tools_raw(url)
        except Exception:
            continue
        for tool in tools:
            namespaced = f"{sat_id}.{tool.name}"
            _tool_owner[namespaced] = (url, tool.name)
            all_tools.append(
                t.Tool(
                    name=namespaced,
                    description=tool.description,
                    inputSchema=tool.inputSchema,
                    annotations=tool.annotations,
                )
            )
    return all_tools


@aggregate_server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    if name not in _tool_owner:
        await handle_list_tools()
    if name not in _tool_owner:
        raise ValueError(f"Unknown tool: {name}")
    url, real_name = _tool_owner[name]

    # Elicitation bridge: if the upstream satellite's tool pauses mid-call to
    # confirm (see the write-tool safety policy in the homeport vault's
    # agent-integration.md), forward that request to whoever is actually
    # calling *this* gateway, rather than answering it ourselves. Without
    # this, a confirmation prompt from a proxied tool would vanish into the
    # gateway's own outbound client session and never reach a human/agent.
    inbound_session = aggregate_server.request_context.session

    async def _elicitation_bridge(context, params):
        return await inbound_session.elicit(message=params.message, requestedSchema=params.requestedSchema)

    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write, elicitation_callback=_elicitation_bridge) as session:
            await session.initialize()
            result = await session.call_tool(real_name, arguments)
            return result.content


session_manager = StreamableHTTPSessionManager(
    app=aggregate_server,
    # No auth on any REST route here either — internal-network-only satellite.
    security_settings=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)
mcp_asgi_app = StreamableHTTPASGIApp(session_manager)
# CORS: browser-based MCP clients (e.g. MCP Inspector's web UI) connect directly
# to this URL cross-origin, so the preflight OPTIONS request needs real CORS headers.
mcp_app = CORSMiddleware(
    mcp_asgi_app,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["mcp-session-id"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with session_manager.run():
        yield


app.router.lifespan_context = lifespan
app.mount("/mcp", mcp_app)


class _McpBareMount:
    """See reference_mcp_streamable_http_fastapi_mount / the other satellites'
    main.py for why this is needed: Starlette's Mount only matches "/mcp/*",
    but MCP clients commonly POST to the bare "/mcp" path, and the catch-all
    SPA route below would otherwise win as a 405 before the redirect-slash
    fallback ever runs."""

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope["path"] = "/"
        await mcp_app(scope, receive, send)


app.router.routes.append(Route("/mcp", endpoint=_McpBareMount()))


# ── Static / SPA ──────────────────────────────────────────────────────────────

if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"detail": "frontend not built — run pnpm build"}
