FROM node:22-slim AS builder
WORKDIR /repo

RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/wger/ apps/wger/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @homeport/wger build

FROM python:3.11-slim
WORKDIR /app

COPY apps/wger/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/wger/backend/ .
COPY --from=builder /repo/apps/wger/dist ./static

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
