# Stage 1: build the frontend
FROM node:22-slim AS builder
WORKDIR /repo

RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/hub/ apps/hub/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @homeport/hub build

# Stage 2: Python runtime
FROM python:3.11-slim
WORKDIR /app

COPY apps/hub/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/hub/backend/ .
COPY --from=builder /repo/apps/hub/dist ./static

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
