FROM node:22-slim AS builder
WORKDIR /repo

RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/finance/ apps/finance/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @homeport/finance build

FROM python:3.11-slim
WORKDIR /app

COPY apps/finance/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/finance/backend/ .
COPY --from=builder /repo/apps/finance/dist ./static

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
