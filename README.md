# station

A lightweight Docker control panel for your home server — container cards, live system metrics, and one-click workflows.

![station dashboard](docs/screenshot.png)

## Features

- **Live container cards** — status, uptime, CPU and RAM per container, stop/restart/start in one click
- **System metrics** — CPU, RAM, and disk usage bars updated every 5 seconds
- **Container detail view** — image, ports, mounts, networks, live stats, Dozzle deep link
- **Restart all** — restarts every container except the dashboard itself
- **Update all** — pulls latest images for all containers, restarts only those that changed
- **No framework** — vanilla JS SPA, hash routing, no build step; static files reload instantly on save
- **Mobile friendly** — responsive layout works on phones and tablets

## Deploy

```yaml
services:
  dashboard:
    build: ./app
    container_name: dashboard
    restart: unless-stopped
    ports:
      - "3001:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./app/static:/app/static:ro
      - ./data:/data
    environment:
      - DOZZLE_URL=http://your-host:9999   # URL of your Dozzle instance
      - CONTAINER_NAME=dashboard            # must match container_name above
      - HOSTNAME_DISPLAY=station            # label shown in the top bar
```

```bash
docker compose up -d --build
```

Then open `http://your-host:3001`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DOZZLE_URL` | `http://localhost:9999` | Base URL of your [Dozzle](https://dozzle.dev) instance |
| `CONTAINER_NAME` | `dashboard` | Name of this container — excluded from restart-all and update-all |
| `HOSTNAME_DISPLAY` | system hostname | Label shown in the top bar |

## Requirements

- Docker with socket access (`/var/run/docker.sock`)
- Python 3.11+ (handled by the Dockerfile)
- [Dozzle](https://dozzle.dev) for log links (optional — links just won't resolve without it)

## Stack

| Layer | Tech |
|---|---|
| Backend | [FastAPI](https://fastapi.tiangolo.com), [Docker SDK for Python](https://docker-py.readthedocs.io), [psutil](https://github.com/giampaolo/psutil) |
| Frontend | Vanilla JS, CSS custom properties, hash routing |
| Container | Python 3.11-slim |

## Development

Static files (`app/static/`) are volume-mounted read-only — JS and CSS changes apply on browser refresh with no rebuild.

Python changes require a rebuild:

```bash
docker compose up -d --build
```

## License

MIT
