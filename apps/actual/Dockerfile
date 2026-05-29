FROM node:22-slim AS frontend-builder
WORKDIR /repo

RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/actual/ apps/actual/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @homeport/actual build

FROM node:22-slim
# build tools required for better-sqlite3 (used by @actual-app/api)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/actual/server/package.json ./
RUN npm install

COPY apps/actual/server/index.ts ./
COPY --from=frontend-builder /repo/apps/actual/dist ./static

EXPOSE 8080
CMD ["node_modules/.bin/tsx", "index.ts"]
