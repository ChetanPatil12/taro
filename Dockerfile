# Taro — single-container deployment: TrueForge harness + Taro server + built web UI.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @taro/web build

FROM node:22-slim
WORKDIR /app
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000 \
    TRUEFORGE_URL=http://127.0.0.1:8790 \
    MCP_PUBLIC_URL=http://127.0.0.1:8000/mcp \
    WEB_DIST=/app/apps/web/dist \
    DATABASE_PATH=/data/taro.db \
    ARTIFACTS_DIR=/data/artifacts \
    FILES_DIR=/data/files \
    REQUIRE_UNLOCK=true

# /data survives restarts when mounted as a volume.
VOLUME /data

EXPOSE 8000
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
