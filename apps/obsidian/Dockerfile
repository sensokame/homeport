FROM node:22-slim AS builder
WORKDIR /repo

RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/obsidian/ apps/obsidian/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @homeport/knowledge build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY apps/obsidian/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/obsidian/backend/ .
COPY --from=builder /repo/apps/obsidian/dist ./static

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
