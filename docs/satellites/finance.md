# Finance Satellite

Read-only brokerage portfolio overview. Wraps the official [Scalable Capital CLI](https://de.scalable.capital/) (`sc`) and shows total value, cash, and holdings.

The satellite only calls read commands (`sc broker overview`, `holdings`, `cash-breakdown`). It never places orders.

---

## Features

- Total portfolio value and cash balance
- Holdings list with quantity and current valuation
- Degrades to a "not connected" state when the CLI session has expired, instead of erroring

---

## Widget: `finance.overview`

Shows total value, cash, and the holdings list in a single panel. The standalone page at the satellite's own URL shows the same data.

---

## Requirements

The image does **not** contain the CLI or any credentials. Both are mounted from the host at runtime:

1. Install the `sc` binary on the host and log in yourself (`sc login`). The login is interactive (browser sign-in + 2FA) and must be done by a person, not an agent.
2. Mount the binary read-only and the CLI's config directory read-write. The CLI writes lock and refresh files on every call, so a read-only mount does not work.

Sessions are time-limited by the broker. When a session expires, the widget shows "not connected" until you run `sc login` again on the host.

!!! warning
    The mounted config directory holds a live brokerage session. Anything that can reach the satellite's API can read your portfolio, and anything that can write inside the container can use the session. Keep the satellite on an internal network only — never expose it publicly.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SC_BIN` | `sc` | Path to the CLI binary inside the container |
| `DATA_DIR` | `/data` | Data directory (reserved for future use) |

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/catalog` | Widget catalog |
| `GET /api/portfolio` | Total value, cash, holdings — or `{ "configured": false, "error": ... }` |
| `GET /api/status` | `{ "configured": true/false }` |

Portfolio response:

```json
{
  "configured": true,
  "totalValue": 1250.00,
  "cash": 250.00,
  "holdings": [
    { "isin": "IE00EXAMPLE0", "name": "Example ETF", "quantity": 1, "valuation": 1000.00, "currency": "EUR" }
  ]
}
```

---

## Deploy

```yaml
services:
  finance:
    image: ghcr.io/sensokame/homeport-finance:latest
    container_name: finance
    restart: unless-stopped
    volumes:
      - ./finance-data:/data
      - /path/to/sc:/usr/local/bin/sc:ro
      - ~/.config/scalable-cli:/root/.config/scalable-cli
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Add to `dashboard.json`:

```json
// satellites array
{ "id": "finance", "url": "http://finance.station", "widgetUrl": "http://finance:8080" }

// widgets array in a tab
{ "instanceId": "finance-main", "widgetId": "finance.overview", "satelliteId": "finance", "config": {} }
```
