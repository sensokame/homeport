# Budget Satellite

Wraps a self-hosted [Actual Budget](https://actualbudget.org) instance. Shows this month's total spending vs. budgeted, and flags over-budget categories.

---

## Features

- Monthly spend vs. budgeted across all expense categories
- Over-budget category count
- React frontend with a category breakdown table
- `GET /widget` — live summary for the hub

---

## Widget response

```json
{
  "title": "Budget",
  "status": "warn",
  "summary": "€420 spent of €600 budgeted · 2 over",
  "metrics": [
    { "label": "Spent",     "value": "€420" },
    { "label": "Budgeted",  "value": "€600" },
    { "label": "Over budget","value": 2, "alert": true }
  ]
}
```

Status: `ok` if all categories within budget, `warn` if any over budget, `error` if Actual Budget is unreachable.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ACTUAL_SERVER_URL` | `http://actual:5006` | Actual Budget server URL |
| `ACTUAL_PASSWORD` | _(empty)_ | Actual Budget server password |
| `ACTUAL_BUDGET_ID` | _(empty)_ | Budget file ID (shown in Actual Budget settings) |
| `ACTUAL_CURRENCY` | `EUR` | Currency symbol for display |

Passwords containing `$` or other shell-special characters must be quoted in `.env` files using single quotes.

---

## API

| Endpoint | Description |
|---|---|
| `GET /widget` | Hub widget data |
| `GET /api/budget` | Full category breakdown for the current month |

---

## HTTPS requirement

Actual Budget uses WebAssembly SQLite (via SharedArrayBuffer), which requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). The budget satellite's own UI does not have this constraint, but **the Actual Budget UI itself must be served over HTTPS**.

When using Nginx Proxy Manager, add these headers to the Actual Budget proxy host under Advanced:

```nginx
add_header Cross-Origin-Opener-Policy same-origin;
add_header Cross-Origin-Embedder-Policy require-corp;
```

---

## docker-compose.yml

```yaml
services:
  actual-sat:
    image: ghcr.io/sensokame/homeport-actual:latest
    container_name: actual-sat
    restart: unless-stopped
    environment:
      - ACTUAL_SERVER_URL=http://actual:5006
      - ACTUAL_PASSWORD=your_password
      - ACTUAL_BUDGET_ID=your_budget_id
      - ACTUAL_CURRENCY=EUR
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

The satellite is internal-only. The hub calls `http://actual-sat:8080/widget` directly — the satellite never needs to be exposed via a reverse proxy.
