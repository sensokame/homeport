FROM node:22-slim AS builder
WORKDIR /repo

RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/gcal/ apps/gcal/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @homeport/gcal build

FROM python:3.11-slim
WORKDIR /app
# Pick up Debian security fixes newer than the base image.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

COPY apps/gcal/backend/requirements.txt .
# setuptools/wheel are build-time only and carry vendored packages with known CVEs.
RUN pip install --no-cache-dir -r requirements.txt && pip uninstall -y setuptools wheel

COPY apps/gcal/backend/ .
COPY --from=builder /repo/apps/gcal/dist ./static

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
